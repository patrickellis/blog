import { describe, expect, it } from 'vitest'
import atlas110 from 'world-atlas/countries-110m.json'
import { BY_ID, COUNTRIES, DESTINATIONS, resolveId } from '../data/countries'
import subdivisionsTopo from '../data/geo/subdivisions.json'
import { FALLBACK_RATES } from '../data/fx'
import type { Brackets, Destination } from '../types'
import { bracketTax, computeTax, evaluate, type Amounts } from './tax'

const A = (p: Partial<Amounts>): Amounts => ({ salary: 0, gains: 0, dividends: 0, interest: 0, netWorth: 0, ...p })
const C = (id: string) => BY_ID.get(id) as Destination
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
  const us = C('US-FL')
  const miami = us.cities[0]
  it('$150k salary in a no-tax state', () => {
    const r = computeTax(us, miami, A({ salary: 150000 }))
    expect(line(r, 'local')).toBe(0)
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
    const ny = C('US-NY')
    const r = computeTax(ny, ny.cities[0], A({ salary: 150000 }))
    expect(line(r, 'local:New York State')).toBeCloseTo(bracketTax(142000, ny.subdivision!.local![0].brackets), 0)
    expect(line(r, 'local:NYC')).toBeGreaterThan(5000)
    expect(line(r, 'local')).toBeGreaterThan(12000)
    expect(line(r, 'local')).toBeLessThan(15000)
  })
  it('state gains exclusions only shrink the gains part of the base', () => {
    const az = C('US-AZ')
    const r = computeTax(az, az.cities[0], A({ salary: 100000, gains: 40000 }))
    expect(line(r, 'local:Arizona')).toBeCloseTo((100000 + 40000 * 0.75 - 15750) * 0.025, 0)
  })
  it('city wage taxes apply to salary only', () => {
    const pa = C('US-PA')
    const r = computeTax(pa, pa.cities[0], A({ salary: 100000, dividends: 50000 }))
    expect(line(r, 'local:Philadelphia')).toBeCloseTo(3740, 0)
    expect(line(r, 'local:Pennsylvania')).toBeCloseTo(150000 * 0.0307, 0)
  })
  it('Missouri exempts capital gains, Washington only taxes large gains', () => {
    const mo = C('US-MO')
    expect(line(computeTax(mo, mo.cities[0], A({ gains: 100000 })), 'local')).toBe(0)
    const wa = C('US-WA')
    expect(line(computeTax(wa, wa.cities[0], A({ gains: 378000 })), 'local:WA capital gains')).toBeCloseTo(7000, 0)
  })
})

describe('Canada', () => {
  it('Quebec applies the 16.5% federal abatement and QPP', () => {
    const on = C('CA-ON')
    const qc = C('CA-QC')
    const a = A({ salary: 120000 })
    expect(line(computeTax(qc, qc.cities[0], a), 'income')).toBeCloseTo(line(computeTax(on, on.cities[0], a), 'income') * 0.835, -1)
    expect(line(computeTax(qc, qc.cities[0], a), 'social:QPP')).toBeGreaterThan(0)
  })
  it('Alberta pays less provincial tax than Ontario at C$200k', () => {
    const on = C('CA-ON')
    const ab = C('CA-AB')
    const a = A({ salary: 200000 })
    expect(computeTax(ab, ab.cities[0], a).totalTax).toBeLessThan(computeTax(on, on.cities[0], a).totalTax)
  })
})

describe('Switzerland', () => {
  it('cantonal tax matches ESTV figures for CHF 100k taxable income in Zurich', () => {
    const zh = C('CH-ZH')
    expect(bracketTax(100000, zh.cities[0].local![0].brackets)).toBeCloseTo(13469, -1)
  })
  it('Zug and Schwyz beat Geneva by a wide margin', () => {
    const a = A({ salary: 250000, netWorth: 3000000 })
    const tax = (id: string) => computeTax(C(id), C(id).cities[0], a).totalTax
    expect(tax('CH-ZG')).toBeLessThan(tax('CH-GE') * 0.75)
    expect(tax('CH-SZ')).toBeLessThan(tax('CH-GE') * 0.75)
  })
  it('lump-sum taxation is unavailable where abolished', () => {
    expect(C('CH-ZH').regimes?.some((r) => r.id === 'ch-forfait')).toBe(false)
    expect(C('CH-ZG').regimes?.some((r) => r.id === 'ch-forfait')).toBe(true)
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
    const es = C('ES-MD')
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
    const madrid = C('ES-MD')
    const catalonia = C('ES-CT')
    expect(line(computeTax(madrid, madrid.cities[0], A({ netWorth: 2500000 })), 'wealth')).toBe(0)
    expect(line(computeTax(catalonia, catalonia.cities[0], A({ netWorth: 2500000 })), 'wealth')).toBeGreaterThan(0)
  })
  it('Spanish solidarity tax is a floor under regional wealth tax', () => {
    const madrid = C('ES-MD')
    const r = computeTax(madrid, madrid.cities[0], A({ netWorth: 5000000 }))
    expect(line(r, 'wealth')).toBeCloseTo((5000000 - 700000 - 3000000) * 0.017, 0)
    expect(r.lines.find((l) => l.key === 'wealth')?.label).toMatch(/Solidarity/)
    const aragon = C('ES-AR')
    const ar = computeTax(aragon, aragon.cities[0], A({ netWorth: 5000000 }))
    expect(line(ar, 'wealth')).toBeGreaterThan(line(r, 'wealth'))
  })
  it('Basque Country uses its own foral system without the Beckham law', () => {
    const pv = C('ES-PV')
    const r = computeTax(pv, pv.cities[0], A({ salary: 100000 }))
    expect(line(r, 'local')).toBe(0)
    expect(pv.regimes?.some((x) => x.id === 'es-beckham')).toBe(false)
    expect(evaluate(pv, pv.cities[0], A({ salary: 100000 }), 'auto', true).regime).toBeUndefined()
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

  it('every country is a globe polygon (110m atlas) or has a marker', () => {
    const ids = new Set((atlas110 as unknown as { objects: { countries: { geometries: { id?: string }[] } } }).objects.countries.geometries.map((g) => Number(g.id)))
    expect(COUNTRIES.filter((c) => !ids.has(c.num) && !c.micro).map((c) => c.name)).toEqual([])
  })

  it('has unique identifiers', () => {
    expect(new Set(COUNTRIES.map((c) => c.iso2)).size).toBe(COUNTRIES.length)
    expect(new Set(COUNTRIES.map((c) => c.num)).size).toBe(COUNTRIES.length)
    expect(new Set(DESTINATIONS.map((d) => d.id)).size).toBe(DESTINATIONS.length)
  })

  it('subdivided countries have no country-level cities and a valid default', () => {
    for (const c of COUNTRIES.filter((x) => x.subdivisions)) {
      expect(c.cities).toHaveLength(0)
      expect(c.subdivisionKind).toBeDefined()
      expect(resolveId(c.iso2)).toBe(`${c.iso2}-${c.defaultSubdivision}`)
      expect(BY_ID.has(resolveId(c.iso2)!)).toBe(true)
    }
  })

  it('regional top rates split the combined headline rate into national + regional parts', () => {
    const national: Record<string, number> = { US: 0.37, CA: 0.33, CH: 0.115, ES: 0.245 }
    for (const d of DESTINATIONS.filter((x) => x.subdivision?.regionalTopRate !== undefined && !x.subdivision.tax)) {
      expect(d.headline.topIncome - d.subdivision!.regionalTopRate!, d.id).toBeCloseTo(national[d.iso2], 2)
    }
    expect(C('CA-QC').headline.topIncome - C('CA-QC').subdivision!.regionalTopRate!).toBeCloseTo(0.33 * 0.835, 2)
    expect(C('ES-PV').subdivision!.regionalTopRate).toBeUndefined()
  })

  it('every subdivision has a matching map feature', () => {
    const ids = new Set(subdivisionsTopo.objects.subdivisions.geometries.map((g) => g.id))
    for (const d of DESTINATIONS.filter((x) => x.subdivision)) expect(ids.has(d.id), d.id).toBe(true)
  })

  it('official links are https and match a listed visa', () => {
    for (const c of COUNTRIES) {
      const { visas, ...pages } = c.sources ?? {}
      const urls = [...Object.values(pages), ...Object.values(visas ?? {}), ...(c.regimes ?? []).map((r) => r.url)].filter((u): u is string => !!u)
      for (const u of urls) expect(new URL(u).protocol, `${c.name}: ${u}`).toBe('https:')
      for (const v of Object.keys(visas ?? {})) expect(c.visas, `${c.name}: unknown visa "${v}"`).toContain(v)
    }
  })

  it.each(DESTINATIONS.map((c) => [c.label, c] as const))('%s is well-formed', (_, c) => {
    expect(FALLBACK_RATES[c.currency]).toBeDefined()
    expect(c.cities.length).toBeGreaterThan(0)
    expect(ascending(c.tax.brackets)).toBe(true)
    for (const r of c.regimes ?? []) if (r.salaryBrackets) expect(ascending(r.salaryBrackets)).toBe(true)
    for (const city of c.cities) {
      for (const l of city.local ?? []) expect(ascending(l.brackets)).toBe(true)
      if (city.wealth) expect(ascending(city.wealth.brackets)).toBe(true)
    }
    if (c.tax.wealth) expect(ascending(c.tax.wealth.brackets)).toBe(true)
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
