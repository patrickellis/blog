import type { Brackets, TaxSystem, Treatment } from '../types'

export const I = Infinity

export const EXEMPT: Treatment = { t: 'exempt' }
export const FOREIGN_EXEMPT: Treatment = { t: 'exempt', note: 'Foreign-source income not taxed' }
export const flat = (rate: number, allowance?: number): Treatment => ({ t: 'flat', rate, allowance })
export const ord = (inclusion?: number, allowance?: number): Treatment => ({ t: 'ordinary', inclusion, allowance })
export const pooled = (inclusion?: number): Treatment => ({ t: 'capital', inclusion })
export const stacked = (brackets: Brackets, allowance?: number): Treatment => ({ t: 'stacked', brackets, allowance })

/** Common shape for capital treatments overridden by a regime. */
export const ALL_CAPITAL_EXEMPT = { gains: FOREIGN_EXEMPT, dividends: FOREIGN_EXEMPT, interest: FOREIGN_EXEMPT }

/** Highest marginal rate of a schedule. */
export const top = (b: Brackets) => Math.max(...b.map(([, r]) => r))

/** Rounds a combined headline rate to 0.1%. */
export const rate = (r: number) => Math.round(r * 1000) / 1000

/** A zero personal income tax system with optional social contributions. */
export const zeroTax = (social?: TaxSystem['social']): TaxSystem => ({
  brackets: [[I, 0]],
  social,
  gains: EXEMPT,
  dividends: EXEMPT,
  interest: EXEMPT,
})
