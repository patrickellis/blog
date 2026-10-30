import { createContext, useContext, useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { BY_ID, DESTINATIONS } from '../data/countries'
import { convert } from '../data/fx'
import { evaluate } from '../lib/tax'
import type { City, Destination, Household, Profile, RegimeChoice, TaxResult } from '../types'
import { useFx } from './fx-context'
import { useApp } from './store'

export interface Row {
  dest: Destination
  city: City
  cityIndex: number
  res: TaxResult
  /** Multiply local-currency amounts by this to get display currency. */
  toDisplay: number
  gross: number
  net: number
  tax: number
  salaryTax: number
  investmentTax: number
  /** State/provincial/cantonal/regional income tax incl. city & payroll levies (whole income tax for foral regions); 0 for whole countries. */
  regionalTax: number
  rentMonthly: number
  afterHousing: number
  /** After-housing income scaled by everyday costs relative to home. */
  spendingPower: number
  isHome: boolean
  isTarget: boolean
  delta: { net: number; afterHousing: number; spendingPower: number; netPct: number }
}

export const rentFor = (city: City, household: Household) =>
  household === 'single' ? city.rent1 : household === 'family' ? city.rent3 : Math.round((city.rent1 + city.rent3) / 2)

export const HOUSING_LABEL: Record<Household, string> = { single: '1-bed', couple: '2-bed', family: '3-bed' }

interface Ctx {
  profile: Profile
  currency: string
  rates: Record<string, number>
  useRegimes: boolean
}

export function computeRow(dest: Destination, cityIndex: number, choice: RegimeChoice, ctx: Ctx) {
  const { profile, currency, rates, useRegimes } = ctx
  const city = dest.cities[cityIndex] ?? dest.cities[0]
  const toLocal = (v: number) => convert(rates, v, currency, dest.currency)
  const res = evaluate(
    dest,
    city,
    { salary: toLocal(profile.salary), gains: toLocal(profile.gains), dividends: toLocal(profile.dividends), interest: toLocal(profile.interest), netWorth: toLocal(profile.netWorth) },
    choice,
    useRegimes,
  )
  const toDisplay = convert(rates, 1, dest.currency, currency)
  const rentMonthly = convert(rates, rentFor(city, profile.household), 'USD', currency)
  const net = res.net * toDisplay
  const sub = dest.subdivision
  const foral = !!sub?.tax?.brackets && !sub.local
  const regionalTax = sub ? res.lines.filter((l) => (foral ? l.key === 'income' : l.key.startsWith('local:'))).reduce((s, l) => s + l.amount, 0) * toDisplay : 0
  return {
    dest,
    city,
    cityIndex: dest.cities.indexOf(city),
    res,
    toDisplay,
    gross: res.gross * toDisplay,
    net,
    tax: res.totalTax * toDisplay,
    salaryTax: res.salaryTax * toDisplay,
    investmentTax: res.investmentTax * toDisplay,
    regionalTax,
    rentMonthly,
    afterHousing: net - rentMonthly * 12,
  }
}

/** Newcomer regimes never apply automatically where you already live (any region of your home country). */
export const regimeChoiceFor = (id: string, homeId: string, regimeById: Record<string, RegimeChoice>): RegimeChoice =>
  regimeById[id] ?? (BY_ID.get(id)?.iso2 === BY_ID.get(homeId)?.iso2 ? 'standard' : 'auto')

/** Computes every destination's result once; consumed through `RowsProvider` / `useRows`. */
export function useComputedRows() {
  const { profile, currency, useRegimes, homeId, targets, cityById, regimeById } = useApp(
    useShallow((s) => ({ profile: s.profile, currency: s.currency, useRegimes: s.useRegimes, homeId: s.homeId, targets: s.targets, cityById: s.cityById, regimeById: s.regimeById })),
  )
  const { rates } = useFx()

  return useMemo(() => {
    const ctx = { profile, currency, rates, useRegimes }
    const base = DESTINATIONS.map((d) => computeRow(d, cityById[d.id] ?? 0, regimeChoiceFor(d.id, homeId, regimeById), ctx))
    const homeBase = base.find((r) => r.dest.id === homeId) ?? base[0]
    const homeCol = homeBase.city.col
    const power = (r: (typeof base)[number]) => r.afterHousing * (homeCol / r.city.col)
    const homePower = power(homeBase)
    const rows: Row[] = base.map((r) => {
      const spendingPower = power(r)
      return {
        ...r,
        spendingPower,
        isHome: r.dest.id === homeId,
        isTarget: targets.includes(r.dest.id),
        delta: {
          net: r.net - homeBase.net,
          afterHousing: r.afterHousing - homeBase.afterHousing,
          spendingPower: spendingPower - homePower,
          netPct: homeBase.net !== 0 ? (r.net - homeBase.net) / Math.abs(homeBase.net) : 0,
        },
      }
    })
    const byId = new Map(rows.map((r) => [r.dest.id, r]))
    /** Rows of subdivided countries grouped by ISO2, best take-home first. */
    const byCountry = new Map<string, Row[]>()
    for (const r of rows) if (r.dest.subdivision) byCountry.set(r.dest.iso2, [...(byCountry.get(r.dest.iso2) ?? []), r])
    for (const list of byCountry.values()) list.sort((a, b) => b.net - a.net)
    return { rows, byId, byCountry, home: byId.get(homeId)!, ctx, homeCol }
  }, [profile, currency, rates, useRegimes, homeId, targets, cityById, regimeById])
}

export type Rows = ReturnType<typeof useComputedRows>

export const RowsContext = createContext<Rows | null>(null)

export function useRows(): Rows {
  const rows = useContext(RowsContext)
  if (!rows) throw new Error('useRows must be used inside <RowsProvider>')
  return rows
}

export const destinationOf = (id: string) => BY_ID.get(id)
