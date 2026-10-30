import { Loader2, MousePointerClick, Pause, Play, Search } from 'lucide-react'
import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { BY_ID, DESTINATIONS } from '../../data/countries'
import { DIVERGING_GRADIENT, HOME_COLOR, SEQUENTIAL_GRADIENT, TARGET_COLOR, diverging, sequential } from '../../lib/colors'
import { cx, money } from '../../lib/format'
import { useShallow } from 'zustand/react/shallow'
import { useRows, type Row } from '../../state/results'
import { useApp, type ColorBy } from '../../state/store'
import { CountryPicker } from '../CountryPicker'
import { CountryPreview } from '../CountryPreview'
import type { Arc, Label, Marker, PolyStyle } from './GlobeCanvas'

const GlobeCanvas = lazy(() => import('./GlobeCanvas'))

const COLOR_OPTIONS: { value: ColorBy; label: string }[] = [
  { value: 'highlight', label: 'Highlight' },
  { value: 'net', label: 'Take-home vs home' },
  { value: 'afterHousing', label: 'After rent vs home' },
  { value: 'effective', label: 'Total tax rate' },
  { value: 'investment', label: 'Tax on investments' },
  { value: 'rent', label: 'Rent' },
]

const HEAT_ALPHA = 0.82

function metric(row: Row, colorBy: ColorBy, home: Row): { color: string } | null {
  switch (colorBy) {
    case 'net':
      return { color: diverging(row.delta.netPct / 0.4, HEAT_ALPHA) }
    case 'afterHousing':
      return { color: diverging(row.delta.afterHousing / Math.max(1, Math.abs(home.afterHousing)) / 0.4, HEAT_ALPHA) }
    case 'effective':
      return { color: sequential(row.res.effectiveRate / 0.5, HEAT_ALPHA) }
    case 'investment':
      return { color: sequential(row.res.investmentRate / 0.35, HEAT_ALPHA) }
    case 'rent':
      return { color: sequential(Math.log(row.city.rent1 / 400) / Math.log(4500 / 400), HEAT_ALPHA) }
    default:
      return null
  }
}

type Bounds = { w: number; h: number }

/**
 * Place `el` beside (x, y), flipping/clamping with its size. Writes styles directly (no React render).
 * Pass a cached `dim` on hot paths to avoid forcing a layout read on every pointer move.
 */
function place(el: HTMLElement | null, x: number, y: number, bounds: Bounds, dim?: { w: number; h: number }) {
  if (!el) return
  const w = dim?.w ?? el.offsetWidth
  const h = dim?.h ?? el.offsetHeight
  const gap = 18
  el.style.left = `${Math.max(8, Math.min(x + gap + w > bounds.w ? x - w - gap : x + gap, bounds.w - w - 8))}px`
  el.style.top = `${Math.max(8, Math.min(y - h / 3, bounds.h - h - 8))}px`
}

/** Below this globe width the pinned card is a bottom sheet; above it, it docks to the right edge. */
const COMPACT_W = 640
const DOCK_W = 340
const DOCK_GAP = 12
const EASE_OUT = 'cubic-bezier(0.22, 1, 0.36, 1)'

const reducedMotion = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

/** Highlight mode shades each state/province/canton by its total tax relative to the rest of its country, in this many bands. */
const REGION_BANDS = 5
const regionColor = (band: number) => sequential(band / (REGION_BANDS - 1), 0.52)
const SPLIT_COUNT = DESTINATIONS.filter((d) => d.subdivision).length

export function GlobePanel() {
  const { homeId, targets, colorBy, focus, currency, capital } = useApp(
    useShallow((s) => ({ homeId: s.homeId, targets: s.targets, colorBy: s.colorBy, focus: s.focus, currency: s.currency, capital: s.profile.gains + s.profile.dividends + s.profile.interest })),
  )
  const { setColorBy, focusOn } = useApp.getState()
  const { byId, byCountry, home } = useRows()

  const box = useRef<HTMLDivElement>(null)
  const header = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [dockTop, setDockTop] = useState(DOCK_GAP)
  const [hovered, setHovered] = useState<string | null>(null)
  const [hoveredName, setHoveredName] = useState<string | null>(null)
  const [pinned, setPinned] = useState<string | null>(null)
  const [rotate, setRotate] = useState(!reducedMotion)
  const mouse = useRef({ x: 0, y: 0 })
  const hoverEl = useRef<HTMLDivElement>(null)
  const dockEl = useRef<HTMLDivElement>(null)
  /** Where the hover preview sat when it was clicked, so the docked card can fly out from there. */
  const pinFrom = useRef<{ x: number; y: number; h: number } | null>(null)
  const sizeRef = useRef(size)
  sizeRef.current = size
  const raf = useRef(0)

  useLayoutEffect(() => {
    const el = box.current
    const hd = header.current
    if (!el || !hd) return
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect()
      setSize({ w: Math.round(r.width), h: Math.round(r.height) })
      // On wider screens the header floats over the globe; the docked card starts just below its controls.
      setDockTop(Math.max(DOCK_GAP, Math.round(hd.getBoundingClientRect().bottom - r.top - 8)))
    })
    ro.observe(el)
    ro.observe(hd)
    return () => ro.disconnect()
  }, [])

  const unpin = useCallback(() => {
    const el = dockEl.current
    if (!el || reducedMotion) return setPinned(null)
    el.getAnimations().forEach((a) => a.cancel())
    const id = el.dataset.id
    el.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateX(24px)' }], { duration: 180, easing: 'ease-in', fill: 'forwards' }).finished.then(
      () => setPinned((p) => (p === id ? null : p)),
      () => {},
    )
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && unpin()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [unpin])

  // In highlight mode only the quantized regional bands depend on results, so typing in the profile rarely re-styles the globe:
  // the bands are serialised to a string and the Map is only rebuilt when that string changes.
  const bandKey = useMemo(() => {
    if (colorBy !== 'highlight') return ''
    const parts: string[] = []
    for (const list of byCountry.values()) {
      const taxes = list.map((r) => r.tax)
      const min = Math.min(...taxes)
      const span = Math.max(...taxes) - min
      for (const r of list) parts.push(`${r.dest.id}:${span > 0 ? Math.round(((r.tax - min) / span) * (REGION_BANDS - 1)) : 0}`)
    }
    return parts.join(',')
  }, [colorBy, byCountry])
  const regionBands = useMemo(() => new Map(bandKey ? bandKey.split(',').map((p) => [p.split(':')[0], Number(p.split(':')[1])] as const) : []), [bandKey])

  const heatRows = colorBy === 'highlight' ? null : byId
  const heatHome = colorBy === 'highlight' ? null : home
  const styles = useMemo(() => {
    const m = new Map<string, PolyStyle>()
    for (const d of DESTINATIONS) {
      const isHome = d.id === homeId
      const isTarget = targets.includes(d.id)
      const heat = heatRows && heatHome ? metric(heatRows.get(d.id)!, colorBy, heatHome) : null
      if (isHome) m.set(d.id, { cap: HOME_COLOR, side: 'rgba(245,158,11,0.5)', stroke: 'rgba(253,230,138,0.9)', alt: 0.04 })
      else if (heat) m.set(d.id, { cap: heat.color, side: 'rgba(15,23,42,0.5)', stroke: isTarget ? TARGET_COLOR : 'rgba(226,232,240,0.35)', alt: isTarget ? 0.035 : 0.012 })
      else if (isTarget) m.set(d.id, { cap: TARGET_COLOR, side: 'rgba(34,211,238,0.45)', stroke: 'rgba(165,243,252,0.9)', alt: 0.035 })
      else if (regionBands.has(d.id)) m.set(d.id, { cap: regionColor(regionBands.get(d.id)!), side: 'rgba(15,23,42,0.45)', stroke: 'rgba(241,245,249,0.55)', alt: 0.012 })
      else m.set(d.id, { cap: 'rgba(45,212,191,0.32)', side: 'rgba(45,212,191,0.12)', stroke: 'rgba(94,234,212,0.55)', alt: 0.012 })
    }
    return m
  }, [heatRows, heatHome, homeId, targets, colorBy, regionBands])

  const markers = useMemo<Marker[]>(
    () =>
      DESTINATIONS.filter((d) => d.micro).map((d) => ({
        id: d.id,
        lat: d.lat,
        lng: d.lng,
        color: d.id === homeId ? HOME_COLOR : targets.includes(d.id) ? TARGET_COLOR : (styles.get(d.id)?.cap ?? '#2dd4bf'),
      })),
    [homeId, targets, styles],
  )

  const homeD = BY_ID.get(homeId)!
  const arcs = useMemo<Arc[]>(
    () => targets.map((t) => BY_ID.get(t)!).map((t) => ({ startLat: homeD.lat, startLng: homeD.lng, endLat: t.lat, endLng: t.lng })),
    [targets, homeD],
  )
  const labels = useMemo<Label[]>(
    () => [
      { lat: homeD.lat, lng: homeD.lng, text: homeD.name, color: '#fde68a' },
      ...targets.map((t) => BY_ID.get(t)!).map((d) => ({ lat: d.lat, lng: d.lng, text: d.name, color: '#a5f3fc' })),
    ],
    [targets, homeD],
  )

  const focusPov = useMemo(() => {
    const d = BY_ID.get(focus?.id ?? homeId)!
    const altitude = d.subdivision ? (d.focusAltitude ?? 1.4) : 2
    return { lat: d.lat - 5 * altitude, lng: d.lng, altitude, n: focus?.n ?? 0 }
  }, [focus, homeId])

  const onHover = useCallback((id: string | null, name: string | null) => {
    setHovered(id)
    setHoveredName(name)
  }, [])
  const onPick = useCallback((id: string, x: number) => {
    const el = hoverEl.current
    pinFrom.current = el ? { x: el.offsetLeft, y: el.offsetTop, h: el.offsetHeight } : null
    // Bring the country out from under the docked card.
    const { w } = sizeRef.current
    if (w >= COMPACT_W && x > w - DOCK_W - DOCK_GAP * 2) focusOn(id)
    setPinned(id)
  }, [focusOn])

  const compact = size.w < COMPACT_W
  const pinnedRow = pinned ? byId.get(pinned) : undefined
  const docked = !!pinnedRow && !compact
  // While docked, hover previews keep to the free area left of the card.
  const bounds = useMemo(() => (docked ? { w: size.w - DOCK_W - DOCK_GAP, h: size.h } : size), [docked, size])

  const onMove = (e: React.PointerEvent) => {
    const rect = box.current!.getBoundingClientRect()
    mouse.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    if (!raf.current) raf.current = requestAnimationFrame(() => {
      raf.current = 0
      place(hoverEl.current, mouse.current.x, mouse.current.y, bounds, hoverDim.current)
    })
  }

  const hoverRow = hovered && hovered !== pinned ? byId.get(hovered) : undefined
  const hoverDim = useRef({ w: 0, h: 0 })
  useLayoutEffect(() => {
    const el = hoverEl.current
    if (!el) return
    hoverDim.current = { w: el.offsetWidth, h: el.offsetHeight }
    place(el, mouse.current.x, mouse.current.y, bounds, hoverDim.current)
  }, [hoverRow, hoveredName, bounds])

  // First pin: the card flies from the hover preview into the dock, growing downwards to full height (clip-path, so
  // text never distorts). Pinning another destination while docked just refreshes the card in place.
  const lastPinned = useRef<string | null>(null)
  useLayoutEffect(() => {
    const el = dockEl.current
    const was = lastPinned.current
    lastPinned.current = docked ? pinned : null
    if (!el || !docked || reducedMotion) return
    el.getAnimations().forEach((a) => a.cancel())
    const from = pinFrom.current
    pinFrom.current = null
    if (was) el.animate([{ opacity: 0.5, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 220, easing: EASE_OUT })
    else if (from) {
      const clip = Math.max(0, el.offsetHeight - from.h)
      el.animate(
        [
          { transform: `translate(${from.x - el.offsetLeft}px, ${from.y - el.offsetTop}px)`, clipPath: `inset(0 0 ${clip}px 0 round 16px)` },
          { transform: 'none', clipPath: 'inset(0 0 0 0 round 16px)' },
        ],
        { duration: 460, easing: EASE_OUT },
      )
    } else el.animate([{ opacity: 0, transform: 'translateX(24px)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: EASE_OUT })
  }, [pinned, docked])

  const legend = COLOR_OPTIONS.find((o) => o.value === colorBy)!

  return (
    <section
      className="panel relative flex h-[560px] flex-col overflow-hidden sm:h-[640px] lg:sticky lg:top-20 lg:h-[calc(100vh-6rem)] lg:max-h-[880px] lg:min-h-[620px]"
      aria-label="Interactive globe"
    >
      <div ref={header} className="pointer-events-none z-10 flex flex-wrap items-start justify-between gap-3 p-4 sm:absolute sm:inset-x-0 sm:top-0 sm:p-5">
        <div className="pointer-events-auto">
          <h2 className="text-lg font-semibold tracking-tight text-white">Explore {DESTINATIONS.length} destinations</h2>
          <p className="mt-0.5 flex items-center gap-1.5 text-sm text-slate-400">
            <MousePointerClick className="h-4 w-4" />
            <span className="pointer-coarse:hidden">Hover a country or region to preview, click to pin and compare</span>
            <span className="hidden pointer-coarse:inline">Tap a highlighted country or region to see details</span>
          </p>
        </div>
        <div className="pointer-events-auto flex items-center gap-2">
          <CountryPicker
            label="Find a destination"
            align="right"
            onSelect={(id) => {
              focusOn(id)
              pinFrom.current = null
              setPinned(id)
            }}
            trigger={
              <span className="btn-outline bg-ink-900/70">
                <Search className="h-4 w-4" /> <span className="hidden sm:inline">Find</span>
              </span>
            }
          />
          <select aria-label="Colour countries by" value={colorBy} onChange={(e) => setColorBy(e.target.value as ColorBy)} className="field w-auto cursor-pointer bg-ink-900/70 py-1.5">
            {COLOR_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                Colour: {o.label}
              </option>
            ))}
          </select>
          <button onClick={() => setRotate((r) => !r)} className="btn-outline bg-ink-900/70 px-2" aria-label={rotate ? 'Pause rotation' : 'Resume rotation'} title={rotate ? 'Pause rotation' : 'Resume rotation'}>
            {rotate ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div ref={box} className="starfield relative flex-1 cursor-grab active:cursor-grabbing" onPointerMove={onMove} onPointerLeave={() => onHover(null, null)}>
        {size.w > 0 && (
          <Suspense
            fallback={
              <div className="absolute inset-0 grid place-items-center text-sm text-slate-400">
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading globe…
                </span>
              </div>
            }
          >
            <GlobeCanvas
              width={size.w}
              height={size.h}
              styles={styles}
              hovered={hovered}
              hoveredName={hoveredName}
              selected={pinnedRow ? pinned : null}
              markers={markers}
              arcs={arcs}
              labels={labels}
              rotate={rotate && !pinned}
              focus={focusPov}
              onHover={onHover}
              onPick={onPick}
              onBackground={unpin}
            />
          </Suspense>
        )}

        {(hoverRow || hoveredName) && !compact && (
          <div ref={hoverEl} className="pointer-events-none absolute z-20 will-change-[left,top]">
            {hoverRow ? (
              <CountryPreview row={hoverRow} />
            ) : (
              <div className="rounded-lg border border-white/10 bg-ink-900/95 px-3 py-2 text-xs shadow-xl">
                <div className="font-medium text-slate-200">{hoveredName}</div>
                <div className="text-slate-500">Not yet covered</div>
              </div>
            )}
          </div>
        )}
        {pinnedRow &&
          (compact ? (
            <div className="pointer-events-none absolute inset-3 z-20 flex items-end justify-center">
              <div className="scrollbar-thin pointer-events-auto max-h-full cursor-auto overflow-y-auto rounded-2xl">
                <CountryPreview row={pinnedRow} pinned onClose={unpin} />
              </div>
            </div>
          ) : (
            <div
              ref={dockEl}
              data-id={pinned!}
              className="absolute z-20 cursor-auto"
              style={{ top: dockTop, right: DOCK_GAP, bottom: DOCK_GAP, width: DOCK_W }}
              onPointerEnter={() => onHover(null, null)}
            >
              <CountryPreview row={pinnedRow} pinned docked onClose={unpin} />
            </div>
          ))}
      </div>

      <div
        className={cx('pointer-events-none absolute bottom-0 left-0 z-10 p-3 sm:p-5', pinned && compact && 'hidden')}
        style={docked ? { maxWidth: size.w - DOCK_W - DOCK_GAP } : undefined}
      >
        <div className="pointer-events-auto rounded-xl border border-white/10 bg-ink-900/80 px-3 py-2 text-[11px] backdrop-blur sm:py-2.5 sm:text-xs">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-home" /> Home
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-target" /> Comparing
            </span>
            {colorBy === 'highlight' && (
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-teal-400/40 ring-1 ring-teal-300/60" /> Covered
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-slate-500/30" /> Not covered
            </span>
          </div>
          {colorBy === 'highlight' && (
            <div className="mt-2 w-64" title={`US states, Canadian provinces, Swiss cantons and Spanish regions set their own taxes — each of the ${SPLIT_COUNT} is a separate destination, shaded by your total tax there compared with the rest of its country.`}>
              <div className="mb-1 text-slate-400">States, provinces &amp; cantons: tax vs rest of country</div>
              <div className="flex h-1.5 overflow-hidden rounded-full">
                {Array.from({ length: REGION_BANDS }, (_, i) => (
                  <span key={i} className="flex-1" style={{ background: regionColor(i) }} />
                ))}
              </div>
              <div className="mt-1 flex justify-between text-[10px] text-slate-500">
                <span>lowest</span>
                <span>for your income</span>
                <span>highest</span>
              </div>
            </div>
          )}
          {colorBy !== 'highlight' && (
            <div className="mt-2 w-60">
              <div className="mb-1 text-slate-400">{legend.label}</div>
              <div className="h-1.5 rounded-full" style={{ background: colorBy === 'net' || colorBy === 'afterHousing' ? DIVERGING_GRADIENT : SEQUENTIAL_GRADIENT }} />
              <div className="mt-1 flex justify-between text-[10px] text-slate-500">
                {colorBy === 'net' || colorBy === 'afterHousing' ? (
                  <>
                    <span>−40%</span>
                    <span>same as {home.dest.name}</span>
                    <span>+40%</span>
                  </>
                ) : colorBy === 'rent' ? (
                  <>
                    <span>{money(400, 'USD', { compact: true })}</span>
                    <span>1-bed / month (USD)</span>
                    <span>{money(4500, 'USD', { compact: true })}+</span>
                  </>
                ) : (
                  <>
                    <span>0%</span>
                    <span>{colorBy === 'investment' && capital === 0 ? 'add investment income' : ''}</span>
                    <span>{colorBy === 'effective' ? '50%' : '35%'}+</span>
                  </>
                )}
              </div>
            </div>
          )}
          <span className="sr-only">Display currency {currency}</span>
        </div>
      </div>
    </section>
  )
}
