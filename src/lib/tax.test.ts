import { describe, expect, it } from 'vitest'
import { BY_ISO, COUNTRIES } from '../data/countries'
import { FALLBACK_RATES } from '../data/fx'
import type { Brackets, Country } from '../types'
import { bracketTax, computeTax, evaluate, type Amounts } from './tax'

const A = (p: Partial<Amounts>): Amounts => ({ salary: 0, gains: 0, dividends: 0, interest: 0, netWorth: 0, ...p })
const C = (iso: string) => BY_ISO.get(iso) as Country
const line = (r: ReturnType<typeof computeTax>, key: string) => r.lines.filter((l) => l.key.startsWith(key)).reduce((s, l) => s + l.amount, 0)

describe('bracketTax', () => {
  it('applies marginal rates', () => {
    expect(bracketTax(50000, [[10000, 0], [40000, 0.2], [Infinity, 0.4]])).toBeCloseTo(10000 * 0 + 30000 * 0.2 + 10000 * 0.4)
    expect(bracketTax(0, [[Infinity, 0.5]])).toBe(0)
  })
})

describe('United Kingdom', () => {
  it('£100k salary matches HMRC figures', () => {
    const uk = C('GB')
    const r = computeTax(uk, uk.cities[0], A({ salary: 100000 }))
    expect(line(r, 'income')).toBeCloseTo(27432, 0)
    expect(line(r, 'social')).toBeCloseTo(4010.6, 0)
  })
  it('tapers the personal allowance above £100k', () => {
    const uk = C('GB')
    const r = computeTax(uk, uk.cities[0], A({ salary: 125140 }))
    expect(line(r, 'income')).toBeCloseTo(37700 * 0.2 + (125140 - 37700) * 0.4, 0)
  })
  it('FIG regime exempts foreign gains', () => {
    const uk = C('GB')
    const r = evaluate(uk, uk.cities[0], A({ salary: 100000, gains: 50000 }), 'auto', true)
    expect(r.regime?.id).toBe('gb-fig')
    expect(line(r, 'gains')).toBe(0)
  })
})

describe('United States', () => {
  const us = C('US')
  const miami = us.cities.find((c) => c.name === 'Miami')!
  it('$150k salary in a no-tax state', () => {
    const r = computeTax(us, miami, A({ salary: 150000 }))
    expect(line(r, 'income')).toBeCloseTo(25067, 0)
    expect(line(r, 'social')).toBeCloseTo(9300 + 2175, 0)
  })
  it('LTCG uses unused standard deduction and 0% band', () => {
    const r = computeTax(us, miami, A({ gains: 100000 }))
    expect(line(r, 'gains')).toBeCloseTo((100000 - 15750 - 48350) * 0.15, 0)
    expect(line(r, 'niit')).toBe(0)
  })
  it('NIIT applies above $200k', () => {
    const r = computeTax(us, miami, A({ salary: 250000, dividends: 100000 }))
    expect(line(r, 'niit')).toBeCloseTo(0.038 * 100000, 0)
  })
  it('NYC adds state and city tax', () => {
    const nyc = us.cities[0]
    const r = computeTax(us, nyc, A({ salary: 150000 }))
    expect(line(r, 'local')).toBeGreaterThan(12000)
    expect(line(r, 'local')).toBeLessThan(14500)
  })
})

describe('regimes', () => {
  it('Portugal IFICI = flat 20% + social', () => {
    const pt = C('PT')
    const r = evaluate(pt, pt.cities[0], A({ salary: 100000 }), 'auto', true)
    expect(r.regime?.id).toBe('pt-ifici')
    expect(line(r, 'income')).toBeCloseTo(20000, 0)
    expect(line(r, 'social')).toBeCloseTo(11000, 0)
  })
  it('Spain Beckham ignores regional tax', () => {
    const es = C('ES')
    const r = evaluate(es, es.cities[0], A({ salary: 100000 }), 'es-beckham', true)
    expect(line(r, 'income')).toBeCloseTo(24000, 0)
    expect(line(r, 'local')).toBe(0)
  })
  it('Italy flat tax only wins with large foreign income', () => {
    const it_ = C('IT')
    expect(evaluate(it_, it_.cities[0], A({ dividends: 50000 }), 'auto', true).regime?.id).not.toBe('it-flat')
    const big = evaluate(it_, it_.cities[0], A({ gains: 5000000, netWorth: 20000000 }), 'auto', true)
    expect(big.regime?.id).toBe('it-flat')
    expect(big.totalTax).toBeCloseTo(200000, 0)
  })
  it('standard choice and disabled regimes ignore regimes', () => {
    const pt = C('PT')
    expect(evaluate(pt, pt.cities[0], A({ salary: 100000 }), 'standard', true).regime).toBeUndefined()
    expect(evaluate(pt, pt.cities[0], A({ salary: 100000 }), 'auto', false).regime).toBeUndefined()
  })
  it('respects regime minimum salary', () => {
    const nl = C('NL')
    expect(evaluate(nl, nl.cities[0], A({ salary: 40000 }), 'auto', true).regime).toBeUndefined()
    expect(evaluate(nl, nl.cities[0], A({ salary: 90000 }), 'auto', true).regime?.id).toBe('nl-30')
  })
})

describe('other systems', () => {
  it('Hong Kong uses the lower standard rate for very high incomes', () => {
    const hk = C('HK')
    const r = computeTax(hk, hk.cities[0], A({ salary: 10000000 }))
    expect(line(r, 'income')).toBeCloseTo(5000000 * 0.15 + 5000000 * 0.16, 0)
  })
  it('Zero-tax UAE', () => {
    const ae = C('AE')
    const r = computeTax(ae, ae.cities[0], A({ salary: 500000, gains: 100000 }))
    expect(r.totalTax).toBe(0)
  })
  it('Spain Madrid wealth tax is zero below €3M (solidarity tax only)', () => {
    const es = C('ES')
    const madrid = es.cities[0]
    const barcelona = es.cities[1]
    expect(line(computeTax(es, madrid, A({ netWorth: 2500000 })), 'wealth')).toBe(0)
    expect(line(computeTax(es, barcelona, A({ netWorth: 2500000 })), 'wealth')).toBeGreaterThan(0)
  })
  it('Germany pools capital income with a shared allowance', () => {
    const de = C('DE')
    const r = computeTax(de, de.cities[0], A({ gains: 10000, dividends: 1000 }))
    expect(line(r, 'gains') + line(r, 'dividends')).toBeCloseTo(10000 * 0.26375, 0)
  })
  it('splits salary vs investment tax', () => {
    const fr = C('FR')
    const r = computeTax(fr, fr.cities[0], A({ salary: 100000, dividends: 10000 }))
    expect(r.investmentTax).toBeCloseTo(3000, 0)
    expect(r.salaryTax + r.investmentTax).toBeCloseTo(r.totalTax, 5)
  })
})

describe('dataset integrity', () => {
  const ascending = (b: Brackets) => b.every(([u], i) => i === 0 || u > b[i - 1][0]) && b[b.length - 1][0] === Infinity

  it('has unique identifiers', () => {
    expect(new Set(COUNTRIES.map((c) => c.iso2)).size).toBe(COUNTRIES.length)
    expect(new Set(COUNTRIES.map((c) => c.num)).size).toBe(COUNTRIES.length)
  })

  it.each(COUNTRIES.map((c) => [c.name, c] as const))('%s is well-formed', (_, c) => {
    expect(FALLBACK_RATES[c.currency]).toBeDefined()
    expect(c.cities.length).toBeGreaterThan(0)
    expect(ascending(c.tax.brackets)).toBe(true)
    for (const r of c.regimes ?? []) if (r.salaryBrackets) expect(ascending(r.salaryBrackets)).toBe(true)
    for (const city of c.cities) for (const l of city.local ?? []) expect(ascending(l.brackets)).toBe(true)
    if (c.tax.capitalSchedule) expect(ascending(c.tax.capitalSchedule.brackets)).toBe(true)
    for (const k of ['gains', 'dividends', 'interest'] as const) {
      if (c.tax[k].t === 'capital') expect(c.tax.capitalSchedule).toBeDefined()
    }
    const r = computeTax(c, c.cities[0], A({ salary: 1e5 * (FALLBACK_RATES[c.currency] ?? 1), gains: 5e4, dividends: 2e4, interest: 1e4, netWorth: 2e6 }))
    expect(Number.isFinite(r.totalTax)).toBe(true)
    expect(r.totalTax).toBeGreaterThanOrEqual(0)
    expect(r.effectiveRate).toBeLessThan(0.75)
  })
})
