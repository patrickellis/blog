import { create } from 'zustand'
import { BY_ID, resolveId } from '../data/countries'
import { DISPLAY_CURRENCIES, FALLBACK_RATES, convert } from '../data/fx'
import type { Preset } from '../data/presets'
import type { Household, Profile, RegimeChoice } from '../types'

export type ColorBy = 'highlight' | 'net' | 'afterHousing' | 'effective' | 'investment' | 'rent'

/** All ids are destination ids: ISO2 for whole countries, ISO 3166-2 (e.g. 'CA-ON') for subdivisions. */
export interface AppState {
  currency: string
  profile: Profile
  homeId: string
  targets: string[]
  cityById: Record<string, number>
  regimeById: Record<string, RegimeChoice>
  useRegimes: boolean
  colorBy: ColorBy
  drawerId: string | null
  focus: { id: string; n: number } | null
  activePreset: string | null

  setCurrency: (currency: string, rates: Record<string, number>) => void
  setProfile: (patch: Partial<Profile>) => void
  applyPreset: (preset: Preset, rates: Record<string, number>) => void
  setHome: (id: string) => void
  toggleTarget: (id: string) => void
  /** Replace a destination (home or target) in place, e.g. switching Ontario → Alberta. */
  swapDestination: (from: string, to: string) => void
  setCity: (id: string, index: number) => void
  setRegime: (id: string, choice: RegimeChoice) => void
  setUseRegimes: (v: boolean) => void
  setColorBy: (v: ColorBy) => void
  openDrawer: (id: string | null) => void
  focusOn: (id: string) => void
}

const POPULAR = ['AE', 'PT', 'SG', 'CH', 'ES', 'US', 'GB'].map((c) => resolveId(c)!)
const MAX_TARGETS = 8

function defaultHome() {
  return resolveId((navigator.language.split('-')[1] ?? '').toUpperCase()) ?? 'GB'
}

function defaultCurrency(home: string) {
  const c = BY_ID.get(home)?.currency ?? 'USD'
  return DISPLAY_CURRENCIES.includes(c) ? c : 'USD'
}

const HOUSEHOLDS: Household[] = ['single', 'couple', 'family']
const COLOR_BY: ColorBy[] = ['highlight', 'net', 'afterHousing', 'effective', 'investment', 'rent']
const STORAGE_KEY = 'expat-compass:settings'

function parseMap<T extends string | number>(s: string | null, num: boolean): Record<string, T> {
  if (!s) return {}
  return Object.fromEntries(
    s.split(',').map((kv) => kv.split(':')).filter(([k, v]) => k && v !== undefined && BY_ID.has(k)).map(([k, v]) => [k, (num ? Number(v) : v) as T]),
  )
}

const encodeMap = (m: Record<string, string | number>) => Object.entries(m).map(([k, v]) => `${k}:${v}`).join(',')

/** A shared link (`?h=…`) wins over saved settings; either way the address bar is left clean. */
function readSettings() {
  const url = new URLSearchParams(location.search)
  if (location.search) history.replaceState(null, '', `${location.pathname}${location.hash}`)
  if (url.has('h')) return url
  try {
    return new URLSearchParams(localStorage.getItem(STORAGE_KEY) ?? '')
  } catch {
    return new URLSearchParams()
  }
}

function encodeSettings(s: AppState) {
  const q = new URLSearchParams()
  q.set('h', s.homeId)
  q.set('t', s.targets.join(','))
  q.set('c', s.currency)
  q.set('s', String(Math.round(s.profile.salary)))
  q.set('g', String(Math.round(s.profile.gains)))
  q.set('d', String(Math.round(s.profile.dividends)))
  q.set('i', String(Math.round(s.profile.interest)))
  q.set('w', String(Math.round(s.profile.netWorth)))
  q.set('hh', s.profile.household)
  if (!s.useRegimes) q.set('r', '0')
  if (s.colorBy !== 'highlight') q.set('cb', s.colorBy)
  const cs = encodeMap(s.cityById)
  const rg = encodeMap(s.regimeById)
  if (cs) q.set('cs', cs)
  if (rg) q.set('rg', rg)
  return q.toString().replace(/%2C/g, ',').replace(/%3A/g, ':')
}

function initialState() {
  const q = readSettings()
  const home = resolveId(q.get('h')) ?? defaultHome()
  const currency = q.get('c') && DISPLAY_CURRENCIES.includes(q.get('c')!) ? q.get('c')! : defaultCurrency(home)
  const targets = q.get('t')
    ? [...new Set(q.get('t')!.split(',').map(resolveId))].filter((t): t is string => !!t && t !== home)
    : POPULAR.filter((t) => t !== home).slice(0, 4)
  const usd = (v: number) => Math.round(convert(FALLBACK_RATES, v, 'USD', currency) / 1000) * 1000
  const num = (k: string, d: number) => (q.has(k) && Number.isFinite(Number(q.get(k))) ? Math.max(0, Number(q.get(k))) : usd(d))
  const hh = q.get('hh') as Household
  return {
    currency,
    homeId: home,
    targets,
    profile: {
      salary: num('s', 150000),
      gains: num('g', 20000),
      dividends: num('d', 8000),
      interest: num('i', 3000),
      netWorth: num('w', 750000),
      household: HOUSEHOLDS.includes(hh) ? hh : 'single',
    } satisfies Profile,
    cityById: parseMap<number>(q.get('cs'), true),
    regimeById: parseMap<string>(q.get('rg'), false),
    useRegimes: q.get('r') !== '0',
    colorBy: COLOR_BY.includes(q.get('cb') as ColorBy) ? (q.get('cb') as ColorBy) : 'highlight',
  }
}

export const useApp = create<AppState>((set, get) => ({
  ...initialState(),
  drawerId: null,
  focus: null,
  activePreset: null,

  setCurrency: (currency, rates) => {
    const { profile, currency: from } = get()
    const c = (v: number) => Math.round(convert(rates, v, from, currency) / 100) * 100
    set({
      currency,
      profile: { ...profile, salary: c(profile.salary), gains: c(profile.gains), dividends: c(profile.dividends), interest: c(profile.interest), netWorth: c(profile.netWorth) },
    })
  },
  setProfile: (patch) => set({ profile: { ...get().profile, ...patch }, activePreset: null }),
  applyPreset: (preset, rates) => {
    const { currency } = get()
    const c = (v: number) => Math.round(convert(rates, v, 'USD', currency) / 1000) * 1000
    const p = preset.profile
    set({
      activePreset: preset.id,
      profile: { household: p.household, salary: c(p.salary), gains: c(p.gains), dividends: c(p.dividends), interest: c(p.interest), netWorth: c(p.netWorth) },
    })
  },
  setHome: (id) => {
    const { targets, homeId } = get()
    const next = targets.filter((t) => t !== id)
    if (homeId && !next.includes(homeId) && next.length < MAX_TARGETS) next.unshift(homeId)
    set({ homeId: id, targets: next, focus: { id, n: Date.now() } })
  },
  toggleTarget: (id) => {
    const { targets, homeId } = get()
    if (id === homeId) return
    set({ targets: targets.includes(id) ? targets.filter((t) => t !== id) : [...targets, id].slice(-MAX_TARGETS) })
  },
  swapDestination: (from, to) => {
    const { targets, homeId, drawerId } = get()
    if (from === to || to === homeId) return
    const drawer = drawerId === from ? to : drawerId
    if (from === homeId) set({ homeId: to, targets: targets.filter((t) => t !== to), drawerId: drawer })
    else set({ targets: targets.includes(to) ? targets.filter((t) => t !== from) : targets.map((t) => (t === from ? to : t)), drawerId: drawer })
  },
  setCity: (id, index) => set({ cityById: { ...get().cityById, [id]: index } }),
  setRegime: (id, choice) => set({ regimeById: { ...get().regimeById, [id]: choice } }),
  setUseRegimes: (useRegimes) => set({ useRegimes }),
  setColorBy: (colorBy) => set({ colorBy }),
  openDrawer: (drawerId) => set({ drawerId }),
  focusOn: (id) => set({ focus: { id, n: Date.now() } }),
}))

export const MAX_COMPARE = MAX_TARGETS

/** A link that reproduces the current view; only built on demand so the address bar stays clean. */
export const shareUrl = () => `${location.origin}${location.pathname}?${encodeSettings(useApp.getState())}`

/** Remember the current settings across visits. */
function saveSettings(s: AppState) {
  try {
    localStorage.setItem(STORAGE_KEY, encodeSettings(s))
  } catch {
    /* storage unavailable (private mode, quota) */
  }
}

saveSettings(useApp.getState())
let saveTimer: number | undefined
useApp.subscribe((s) => {
  clearTimeout(saveTimer)
  saveTimer = window.setTimeout(() => saveSettings(s), 250)
})
