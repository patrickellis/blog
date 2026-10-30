import { useMemo } from 'react'
import { BY_ISO, COUNTRIES } from '../data/countries'
import { convert } from '../data/fx'
import { evaluate } from '../lib/tax'
import type { City, Country, Household, Profile, RegimeChoice, TaxResult } from '../types'
import { useFx } from './fx-context'
import { useApp } from './store'

export interface Row {
  country: Country
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

export function computeRow(country: Country, cityIndex: number, choice: RegimeChoice, ctx: Ctx) {
  const { profile, currency, rates, useRegimes } = ctx
  const city = country.cities[cityIndex] ?? country.cities[0]
  const toLocal = (v: number) => convert(rates, v, currency, country.currency)
  const res = evaluate(
    country,
    city,
    { salary: toLocal(profile.salary), gains: toLocal(profile.gains), dividends: toLocal(profile.dividends), interest: toLocal(profile.interest), netWorth: toLocal(profile.netWorth) },
    choice,
    useRegimes,
  )
  const toDisplay = convert(rates, 1, country.currency, currency)
  const rentMonthly = convert(rates, rentFor(city, profile.household), 'USD', currency)
  const net = res.net * toDisplay
  return {
    country,
    city,
    cityIndex: country.cities.indexOf(city),
    res,
    toDisplay,
    gross: res.gross * toDisplay,
    net,
    tax: res.totalTax * toDisplay,
    salaryTax: res.salaryTax * toDisplay,
    investmentTax: res.investmentTax * toDisplay,
    rentMonthly,
    afterHousing: net - rentMonthly * 12,
  }
}

/** Newcomer regimes never apply automatically in the country you already live in. */
export const regimeChoiceFor = (iso: string, homeIso: string, regimeByIso: Record<string, RegimeChoice>): RegimeChoice =>
  regimeByIso[iso] ?? (iso === homeIso ? 'standard' : 'auto')

export function useRows() {
  const { profile, currency, useRegimes, homeIso, targets, cityByIso, regimeByIso } = useApp()
  const { rates } = useFx()

  return useMemo(() => {
    const ctx = { profile, currency, rates, useRegimes }
    const base = COUNTRIES.map((c) => computeRow(c, cityByIso[c.iso2] ?? 0, regimeChoiceFor(c.iso2, homeIso, regimeByIso), ctx))
    const homeBase = base.find((r) => r.country.iso2 === homeIso) ?? base[0]
    const homeCol = homeBase.city.col
    const power = (r: (typeof base)[number]) => r.afterHousing * (homeCol / r.city.col)
    const homePower = power(homeBase)
    const rows: Row[] = base.map((r) => {
      const spendingPower = power(r)
      return {
        ...r,
        spendingPower,
        isHome: r.country.iso2 === homeIso,
        isTarget: targets.includes(r.country.iso2),
        delta: {
          net: r.net - homeBase.net,
          afterHousing: r.afterHousing - homeBase.afterHousing,
          spendingPower: spendingPower - homePower,
          netPct: homeBase.net !== 0 ? (r.net - homeBase.net) / Math.abs(homeBase.net) : 0,
        },
      }
    })
    const byIso = new Map(rows.map((r) => [r.country.iso2, r]))
    return { rows, byIso, home: byIso.get(homeIso)!, ctx, homeCol }
  }, [profile, currency, rates, useRegimes, homeIso, targets, cityByIso, regimeByIso])
}

export const countryOf = (iso: string) => BY_ISO.get(iso)
