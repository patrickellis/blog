/** Marginal brackets as [upper bound, rate]. The final bound should be Infinity. */
export type Brackets = [number, number][]

export type Treatment =
  | { t: 'exempt'; note?: string }
  /** Flat rate on (amount - allowance). */
  | { t: 'flat'; rate: number; allowance?: number }
  /** Added to ordinary income (optionally with an inclusion rate, e.g. 50% of gains). */
  | { t: 'ordinary'; inclusion?: number; allowance?: number }
  /** Pooled into the country's separate capital-income schedule. */
  | { t: 'capital'; inclusion?: number }
  /** Own brackets stacked on top of ordinary taxable income (US LTCG, UK dividends/CGT). */
  | { t: 'stacked'; brackets: Brackets; allowance?: number }

export interface SocialItem {
  name: string
  rate: number
  /** Contributions apply to salary above this amount. */
  floor?: number
  /** Contributions apply to salary up to this amount. */
  cap?: number
}

export interface Credit {
  amount: number
  /** Credit is reduced by `phaseRate` per unit of income above `phaseStart`. */
  phaseStart?: number
  phaseRate?: number
}

export interface Surcharge {
  name: string
  /** % of income tax. */
  rate?: number
  /** Only applies if income tax exceeds threshold; phaseRate caps it during phase-in (German Soli). */
  threshold?: number
  phaseRate?: number
  /** [incomeThreshold, rate] — picks highest tier where income > threshold (India). */
  tiers?: [number, number][]
}

export interface Surtax {
  name: string
  brackets: Brackets
  /** ordinary = taxable ordinary income; all = gross salary + all capital income; capital = capital income only */
  base: 'ordinary' | 'all' | 'capital'
}

/** US-style Net Investment Income Tax: rate × min(investment income, total income − threshold). */
export interface InvestmentSurtax {
  name: string
  rate: number
  threshold: number
}

export interface WealthTax {
  name: string
  brackets: Brackets
  allowance?: number
  /** Tax only applies when net worth exceeds this (then on the full base after allowance). */
  threshold?: number
}

export interface LocalTax {
  name: string
  brackets: Brackets
  /** ordinary = salary/ordinary base; allIncome = salary + all capital income; gains = capital gains only */
  base: 'ordinary' | 'allIncome' | 'gains'
  allowance?: number
  credit?: number
  /** Ontario-style surtax: Σ rate × max(0, localTax − threshold). */
  surtax?: [number, number][]
}

export interface TaxSystem {
  /** Deduction from salary before brackets. */
  allowance?: number
  /** Allowance reduced by `rate` per unit of income above `start` (UK personal allowance taper). */
  allowanceTaper?: { start: number; rate: number }
  /** Employment-expense style deduction: min(salary × pct, cap). */
  employmentDeduction?: { pct: number; cap: number }
  brackets: Brackets
  credits?: Credit[]
  surcharge?: Surcharge
  /** Applied on (income tax + surcharge), e.g. India's 4% cess. */
  cess?: number
  /** Alternative "standard rate" computation; taxpayer pays the lower (Hong Kong). */
  altStandard?: Brackets
  social?: SocialItem[]
  socialDeductible?: boolean
  surtaxes?: Surtax[]
  investmentSurtax?: InvestmentSurtax
  capitalSchedule?: { brackets: Brackets; allowance?: number; name?: string }
  gains: Treatment
  dividends: Treatment
  interest: Treatment
  wealth?: WealthTax
}

export interface Regime {
  id: string
  name: string
  summary: string
  duration: string
  eligibility: string
  /** Eligibility depends on status (heritage, self-employment…) — never auto-selected, user must opt in. */
  manualOnly?: boolean
  requiresSalary?: boolean
  requiresNoSalary?: boolean
  minSalary?: number
  /** Replaces ordinary brackets for salary (e.g. Beckham law flat 24%). */
  salaryBrackets?: Brackets
  /** Ignore allowances / employment deductions / credits on salary. */
  noDeductions?: boolean
  /** Exempt part of salary: pct × clamp(salary − floor, 0, ceiling − floor). */
  salaryExempt?: { pct: number; floor?: number; ceiling?: number; minSalary?: number }
  capital?: Partial<Pick<TaxSystem, 'gains' | 'dividends' | 'interest'>>
  noWealthTax?: boolean
  noLocal?: boolean
  noSurtaxes?: boolean
  /** Lump-sum annual tax (Italy €200k, Greece €100k, Swiss forfait). */
  fixedAnnualTax?: number
  /** Fixed tax replaces all other income, capital and wealth taxes (Swiss forfait). */
  replacesAll?: boolean
}

export interface City {
  name: string
  /** Rent per month in USD, city centre. */
  rent1: number
  rent3: number
  /** Everyday cost index excluding rent (New York = 100). */
  col: number
  local?: LocalTax[]
  /** Overrides the country's wealth tax (regional variation). */
  wealth?: WealthTax | null
  note?: string
}

export type Region = 'Europe' | 'Middle East' | 'Asia-Pacific' | 'Americas' | 'Africa'

export type English = 'Native' | 'Very high' | 'High' | 'Moderate' | 'Low'

export interface Country {
  iso2: string
  /** ISO 3166-1 numeric, matching world-atlas feature ids. */
  num: number
  name: string
  region: Region
  currency: string
  lat: number
  lng: number
  /** Too small to hover comfortably on the globe – render a marker as well. */
  micro?: boolean
  tax: TaxSystem
  regimes?: Regime[]
  cities: City[]
  /** Headline facts shown in summaries. */
  headline: {
    topIncome: number
    cgt: string
    dividends: string
    wealth: string
    inheritance: string
  }
  exitTax?: string
  visas: string[]
  notes: string[]
  hdi?: number
  english: English
  utc: string
  /** Taxes worldwide income of citizens even when non-resident. */
  citizenshipTaxation?: boolean
  territorial?: boolean
}

export type Household = 'single' | 'couple' | 'family'

export interface Profile {
  salary: number
  gains: number
  dividends: number
  interest: number
  netWorth: number
  household: Household
}

export type RegimeChoice = 'auto' | 'standard' | string

export interface TaxLine {
  key: string
  label: string
  amount: number
  group: 'income' | 'social' | 'investment' | 'wealth' | 'regime'
}

export interface TaxResult {
  lines: TaxLine[]
  gross: number
  salary: number
  capitalIncome: number
  totalTax: number
  salaryTax: number
  investmentTax: number
  wealthTax: number
  net: number
  effectiveRate: number
  salaryRate: number
  investmentRate: number
  marginalRate: number
  regime?: Regime
}
