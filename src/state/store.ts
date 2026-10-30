import { create } from 'zustand'
import { BY_ISO } from '../data/countries'
import { DISPLAY_CURRENCIES, FALLBACK_RATES, convert } from '../data/fx'
import type { Preset } from '../data/presets'
import type { Household, Profile, RegimeChoice } from '../types'

export type ColorBy = 'highlight' | 'net' | 'afterHousing' | 'effective' | 'investment' | 'rent'

export interface AppState {
  currency: string
  profile: Profile
  homeIso: string
  targets: string[]
  cityByIso: Record<string, number>
  regimeByIso: Record<string, RegimeChoice>
  useRegimes: boolean
  colorBy: ColorBy
  drawerIso: string | null
  focus: { iso: string; n: number } | null
  activePreset: string | null

  setCurrency: (currency: string, rates: Record<string, number>) => void
  setProfile: (patch: Partial<Profile>) => void
  applyPreset: (preset: Preset, rates: Record<string, number>) => void
  setHome: (iso: string) => void
  toggleTarget: (iso: string) => void
  setCity: (iso: string, index: number) => void
  setRegime: (iso: string, choice: RegimeChoice) => void
  setUseRegimes: (v: boolean) => void
  setColorBy: (v: ColorBy) => void
  openDrawer: (iso: string | null) => void
  focusOn: (iso: string) => void
}

const POPULAR = ['AE', 'PT', 'SG', 'CH', 'ES', 'US', 'GB']
const MAX_TARGETS = 8

function defaultHome() {
  const region = (navigator.language.split('-')[1] ?? '').toUpperCase()
  return BY_ISO.has(region) ? region : 'GB'
}

function defaultCurrency(home: string) {
  const c = BY_ISO.get(home)?.currency ?? 'USD'
  return DISPLAY_CURRENCIES.includes(c) ? c : 'USD'
}

const HOUSEHOLDS: Household[] = ['single', 'couple', 'family']

function parseMap<T extends string | number>(s: string | null, num: boolean): Record<string, T> {
  if (!s) return {}
  return Object.fromEntries(
    s.split(',').map((kv) => kv.split(':')).filter(([k, v]) => k && v !== undefined && BY_ISO.has(k)).map(([k, v]) => [k, (num ? Number(v) : v) as T]),
  )
}

const encodeMap = (m: Record<string, string | number>) => Object.entries(m).map(([k, v]) => `${k}:${v}`).join(',')

function initialState() {
  const q = new URLSearchParams(location.search)
  const home = q.get('h') && BY_ISO.has(q.get('h')!) ? q.get('h')! : defaultHome()
  const currency = q.get('c') && DISPLAY_CURRENCIES.includes(q.get('c')!) ? q.get('c')! : defaultCurrency(home)
  const targets = q.get('t')
    ? q.get('t')!.split(',').filter((t) => BY_ISO.has(t) && t !== home)
    : POPULAR.filter((t) => t !== home).slice(0, 4)
  const usd = (v: number) => Math.round(convert(FALLBACK_RATES, v, 'USD', currency) / 1000) * 1000
  const num = (k: string, d: number) => (q.has(k) && Number.isFinite(Number(q.get(k))) ? Math.max(0, Number(q.get(k))) : usd(d))
  const hh = q.get('hh') as Household
  return {
    currency,
    homeIso: home,
    targets,
    profile: {
      salary: num('s', 150000),
      gains: num('g', 20000),
      dividends: num('d', 8000),
      interest: num('i', 3000),
      netWorth: num('w', 750000),
      household: HOUSEHOLDS.includes(hh) ? hh : 'single',
    } satisfies Profile,
    cityByIso: parseMap<number>(q.get('cs'), true),
    regimeByIso: parseMap<string>(q.get('rg'), false),
    useRegimes: q.get('r') !== '0',
    colorBy: 'highlight' as ColorBy,
  }
}

export const useApp = create<AppState>((set, get) => ({
  ...initialState(),
  drawerIso: null,
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
  setHome: (iso) => {
    const { targets, homeIso } = get()
    const next = targets.filter((t) => t !== iso)
    if (homeIso && !next.includes(homeIso) && next.length < MAX_TARGETS) next.unshift(homeIso)
    set({ homeIso: iso, targets: next, focus: { iso, n: Date.now() } })
  },
  toggleTarget: (iso) => {
    const { targets, homeIso } = get()
    if (iso === homeIso) return
    set({ targets: targets.includes(iso) ? targets.filter((t) => t !== iso) : [...targets, iso].slice(-MAX_TARGETS) })
  },
  setCity: (iso, index) => set({ cityByIso: { ...get().cityByIso, [iso]: index } }),
  setRegime: (iso, choice) => set({ regimeByIso: { ...get().regimeByIso, [iso]: choice } }),
  setUseRegimes: (useRegimes) => set({ useRegimes }),
  setColorBy: (colorBy) => set({ colorBy }),
  openDrawer: (drawerIso) => set({ drawerIso }),
  focusOn: (iso) => set({ focus: { iso, n: Date.now() } }),
}))

export const MAX_COMPARE = MAX_TARGETS

/** Keep the URL in sync so any view can be shared or bookmarked. */
let urlTimer: number | undefined
useApp.subscribe((s) => {
  clearTimeout(urlTimer)
  urlTimer = window.setTimeout(() => {
    const q = new URLSearchParams()
    q.set('h', s.homeIso)
    q.set('t', s.targets.join(','))
    q.set('c', s.currency)
    q.set('s', String(Math.round(s.profile.salary)))
    q.set('g', String(Math.round(s.profile.gains)))
    q.set('d', String(Math.round(s.profile.dividends)))
    q.set('i', String(Math.round(s.profile.interest)))
    q.set('w', String(Math.round(s.profile.netWorth)))
    q.set('hh', s.profile.household)
    if (!s.useRegimes) q.set('r', '0')
    const cs = encodeMap(s.cityByIso)
    const rg = encodeMap(s.regimeByIso)
    if (cs) q.set('cs', cs)
    if (rg) q.set('rg', rg)
    history.replaceState(null, '', `${location.pathname}?${q.toString().replace(/%2C/g, ',').replace(/%3A/g, ':')}${location.hash}`)
  }, 250)
})
