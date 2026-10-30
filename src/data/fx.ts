import { useEffect, useState } from 'react'

/** Units of currency per 1 USD. Used until (or if) the live request fails. */
export const FALLBACK_RATES: Record<string, number> = {
  USD: 1, EUR: 0.86, GBP: 0.75, CHF: 0.8, SEK: 9.4, NOK: 10.0, DKK: 6.4, PLN: 3.65, CZK: 20.9, HUF: 330, TRY: 42,
  GEL: 2.7, AED: 3.6725, SAR: 3.75, QAR: 3.64, BHD: 0.376, ILS: 3.3, ZAR: 17.4, MUR: 45.5, MAD: 9.2, KES: 129,
  SGD: 1.29, HKD: 7.78, JPY: 150, KRW: 1400, TWD: 30.5, CNY: 7.12, INR: 88, THB: 32.5, MYR: 4.2, IDR: 16500,
  PHP: 58, AUD: 1.53, NZD: 1.73, CAD: 1.39, MXN: 18.4, CRC: 502, COP: 3900, BRL: 5.35, CLP: 950, UYU: 40,
  PYG: 7100, BSD: 1, KYD: 0.833, BMD: 1,
}

export const DISPLAY_CURRENCIES = ['USD', 'EUR', 'GBP', 'CHF', 'CAD', 'AUD', 'SGD', 'AED', 'HKD', 'JPY', 'INR', 'SEK', 'NOK', 'DKK', 'NZD', 'BRL', 'MXN', 'ZAR', 'ILS', 'CNY', 'KRW']

export interface FxState {
  rates: Record<string, number>
  live: boolean
  updated?: string
}

const CACHE_KEY = 'expat-compass:fx'

export function useFxRates(): FxState {
  const [state, setState] = useState<FxState>(() => {
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null')
      if (cached?.rates) return { rates: { ...FALLBACK_RATES, ...cached.rates }, live: true, updated: cached.updated }
    } catch {
      /* ignore corrupt cache */
    }
    return { rates: FALLBACK_RATES, live: false }
  })

  useEffect(() => {
    const ctrl = new AbortController()
    fetch('https://open.er-api.com/v6/latest/USD', { signal: ctrl.signal })
      .then((r) => r.json())
      .then((d) => {
        if (d?.result !== 'success') return
        const next = { rates: { ...FALLBACK_RATES, ...d.rates }, live: true, updated: d.time_last_update_utc as string }
        setState(next)
        localStorage.setItem(CACHE_KEY, JSON.stringify({ rates: d.rates, updated: next.updated }))
      })
      .catch(() => {})
    return () => ctrl.abort()
  }, [])

  return state
}

/** Convert `amount` from currency `from` to `to`. */
export const convert = (rates: Record<string, number>, amount: number, from: string, to: string) =>
  from === to ? amount : (amount / (rates[from] ?? 1)) * (rates[to] ?? 1)
