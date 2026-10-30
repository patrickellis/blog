import { Loader2, MousePointerClick, Pause, Play, Search } from 'lucide-react'
import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { BY_ISO, COUNTRIES } from '../../data/countries'
import { DIVERGING_GRADIENT, HOME_COLOR, SEQUENTIAL_GRADIENT, TARGET_COLOR, diverging, sequential } from '../../lib/colors'
import { cx, money } from '../../lib/format'
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

function metric(row: Row, colorBy: ColorBy, home: Row): { color: string } | null {
  switch (colorBy) {
    case 'net':
      return { color: diverging(row.delta.netPct / 0.4, 0.85) }
    case 'afterHousing':
      return { color: diverging(row.delta.afterHousing / Math.max(1, Math.abs(home.afterHousing)) / 0.4, 0.85) }
    case 'effective':
      return { color: sequential(row.res.effectiveRate / 0.5, 0.85) }
    case 'investment':
      return { color: sequential(row.res.investmentRate / 0.35, 0.85) }
    case 'rent':
      return { color: sequential(Math.log(row.city.rent1 / 400) / Math.log(4500 / 400), 0.85) }
    default:
      return null
  }
}

/** Positions children next to (x, y), flipping/clamping using the element's measured size. */
function Floating({ x, y, bounds, className, children }: { x: number; y: number; bounds: { w: number; h: number }; className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [dim, setDim] = useState({ w: 340, h: 460 })
  useLayoutEffect(() => {
    const el = ref.current
    if (el && (el.offsetWidth !== dim.w || el.offsetHeight !== dim.h)) setDim({ w: el.offsetWidth, h: el.offsetHeight })
  })
  const gap = 18
  const left = Math.max(8, Math.min(x + gap + dim.w > bounds.w ? x - dim.w - gap : x + gap, bounds.w - dim.w - 8))
  const top = Math.max(8, Math.min(y - dim.h / 3, bounds.h - dim.h - 8))
  return (
    <div ref={ref} className={cx('absolute z-20', className)} style={{ left, top }}>
      {children}
    </div>
  )
}

const reducedMotion = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

export function GlobePanel() {
  const { homeIso, targets, colorBy, focus, currency, profile } = useApp()
  const { setColorBy, focusOn } = useApp.getState()
  const { byIso, home } = useRows()

  const box = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [hovered, setHovered] = useState<string | null>(null)
  const [hoveredName, setHoveredName] = useState<string | null>(null)
  const [pinned, setPinned] = useState<{ iso: string; x: number; y: number } | null>(null)
  const [mouse, setMouse] = useState({ x: 0, y: 0 })
  const [rotate, setRotate] = useState(!reducedMotion)
  const raf = useRef(0)

  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setSize({ w: Math.round(e.contentRect.width), h: Math.round(e.contentRect.height) }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setPinned(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const styles = useMemo(() => {
    const m = new Map<number, PolyStyle>()
    for (const c of COUNTRIES) {
      const row = byIso.get(c.iso2)!
      const isHome = c.iso2 === homeIso
      const isTarget = targets.includes(c.iso2)
      const heat = metric(row, colorBy, home)
      if (isHome) m.set(c.num, { cap: HOME_COLOR, side: 'rgba(245,158,11,0.5)', stroke: 'rgba(253,230,138,0.9)', alt: 0.04 })
      else if (heat) m.set(c.num, { cap: heat.color, side: 'rgba(15,23,42,0.5)', stroke: isTarget ? TARGET_COLOR : 'rgba(226,232,240,0.35)', alt: isTarget ? 0.035 : 0.012 })
      else if (isTarget) m.set(c.num, { cap: TARGET_COLOR, side: 'rgba(34,211,238,0.45)', stroke: 'rgba(165,243,252,0.9)', alt: 0.035 })
      else m.set(c.num, { cap: 'rgba(45,212,191,0.32)', side: 'rgba(45,212,191,0.12)', stroke: 'rgba(94,234,212,0.55)', alt: 0.012 })
    }
    return m
  }, [byIso, home, homeIso, targets, colorBy])

  const markers = useMemo<Marker[]>(
    () =>
      COUNTRIES.filter((c) => c.micro).map((c) => ({
        iso: c.iso2,
        lat: c.lat,
        lng: c.lng,
        color: c.iso2 === homeIso ? HOME_COLOR : targets.includes(c.iso2) ? TARGET_COLOR : (styles.get(c.num)?.cap ?? '#2dd4bf'),
      })),
    [homeIso, targets, styles],
  )

  const homeC = BY_ISO.get(homeIso)!
  const arcs = useMemo<Arc[]>(
    () => targets.map((t) => BY_ISO.get(t)!).map((t) => ({ startLat: homeC.lat, startLng: homeC.lng, endLat: t.lat, endLng: t.lng })),
    [targets, homeC],
  )
  const labels = useMemo<Label[]>(
    () => [
      { lat: homeC.lat, lng: homeC.lng, text: homeC.name, color: '#fde68a' },
      ...targets.map((t) => BY_ISO.get(t)!).map((c) => ({ lat: c.lat, lng: c.lng, text: c.name, color: '#a5f3fc' })),
    ],
    [targets, homeC],
  )

  const focusPov = useMemo(() => {
    const c = BY_ISO.get(focus?.iso ?? homeIso)!
    return { lat: c.lat - 10, lng: c.lng, n: focus?.n ?? 0 }
  }, [focus, homeIso])

  const onHover = useCallback((iso: string | null, name: string | null) => {
    setHovered(iso)
    setHoveredName(name)
  }, [])
  const onPick = useCallback((iso: string, x: number, y: number) => setPinned({ iso, x, y }), [])
  const onBackground = useCallback(() => setPinned(null), [])

  const onMove = (e: React.PointerEvent) => {
    const rect = box.current!.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    cancelAnimationFrame(raf.current)
    raf.current = requestAnimationFrame(() => setMouse({ x, y }))
  }

  const compact = size.w < 640

  const hoverRow = hovered && hovered !== pinned?.iso ? byIso.get(hovered) : undefined
  const pinnedRow = pinned ? byIso.get(pinned.iso) : undefined
  const legend = COLOR_OPTIONS.find((o) => o.value === colorBy)!

  return (
    <section
      className="panel relative flex h-[560px] flex-col overflow-hidden sm:h-[640px] lg:sticky lg:top-20 lg:h-[calc(100vh-6rem)] lg:max-h-[880px] lg:min-h-[620px]"
      aria-label="Interactive globe"
    >
      <div className="pointer-events-none z-10 flex flex-wrap items-start justify-between gap-3 p-4 sm:absolute sm:inset-x-0 sm:top-0 sm:p-5">
        <div className="pointer-events-auto">
          <h2 className="text-lg font-semibold tracking-tight text-white">Explore {COUNTRIES.length} destinations</h2>
          <p className="mt-0.5 flex items-center gap-1.5 text-sm text-slate-400">
            <MousePointerClick className="h-4 w-4" />
            <span className="pointer-coarse:hidden">Hover a country to preview, click to pin and compare</span>
            <span className="hidden pointer-coarse:inline">Tap a highlighted country to see details</span>
          </p>
        </div>
        <div className="pointer-events-auto flex items-center gap-2">
          <CountryPicker
            label="Find a destination"
            align="right"
            onSelect={(iso) => {
              focusOn(iso)
              setPinned({ iso, x: size.w / 2, y: size.h / 2 - 120 })
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
              markers={markers}
              arcs={arcs}
              labels={labels}
              rotate={rotate && !pinned}
              focus={focusPov}
              onHover={onHover}
              onPick={onPick}
              onBackground={onBackground}
            />
          </Suspense>
        )}

        {hoverRow && !compact && (
          <Floating x={mouse.x} y={mouse.y} bounds={size} className="pointer-events-none">
            <CountryPreview row={hoverRow} />
          </Floating>
        )}
        {hoveredName && !compact && (
          <div className="pointer-events-none absolute z-20 rounded-lg border border-white/10 bg-ink-900/95 px-3 py-2 text-xs shadow-xl" style={{ left: mouse.x + 16, top: mouse.y + 16 }}>
            <div className="font-medium text-slate-200">{hoveredName}</div>
            <div className="text-slate-500">Not yet covered</div>
          </div>
        )}
        {pinnedRow &&
          (compact ? (
            <div className="pointer-events-none absolute inset-3 z-20 flex items-end justify-center">
              <div className="scrollbar-thin pointer-events-auto max-h-full overflow-y-auto rounded-2xl">
                <CountryPreview row={pinnedRow} pinned onClose={() => setPinned(null)} />
              </div>
            </div>
          ) : (
            <Floating x={pinned!.x} y={pinned!.y} bounds={size}>
              <CountryPreview row={pinnedRow} pinned onClose={() => setPinned(null)} />
            </Floating>
          ))}
      </div>

      <div className={cx('pointer-events-none absolute bottom-0 left-0 z-10 p-3 sm:p-5', pinned && compact && 'hidden')}>
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
          {colorBy !== 'highlight' && (
            <div className="mt-2 w-60">
              <div className="mb-1 text-slate-400">{legend.label}</div>
              <div className="h-1.5 rounded-full" style={{ background: colorBy === 'net' || colorBy === 'afterHousing' ? DIVERGING_GRADIENT : SEQUENTIAL_GRADIENT }} />
              <div className="mt-1 flex justify-between text-[10px] text-slate-500">
                {colorBy === 'net' || colorBy === 'afterHousing' ? (
                  <>
                    <span>−40%</span>
                    <span>same as {home.country.name}</span>
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
                    <span>{colorBy === 'investment' && profile.gains + profile.dividends + profile.interest === 0 ? 'add investment income' : ''}</span>
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
