import type { Brackets, City, Country, Regime, RegimeChoice, TaxLine, TaxResult, Treatment, WealthTax } from '../types'

export interface Amounts {
  salary: number
  gains: number
  dividends: number
  interest: number
  netWorth: number
}

type CapitalKey = 'gains' | 'dividends' | 'interest'

const CAPITAL_LABEL: Record<CapitalKey, string> = {
  gains: 'Capital gains tax',
  dividends: 'Dividend tax',
  interest: 'Tax on interest',
}

const pos = (n: number) => (n > 0 ? n : 0)

export function bracketTax(income: number, brackets: Brackets): number {
  let tax = 0
  let prev = 0
  for (const [upTo, rate] of brackets) {
    if (income <= prev) break
    tax += (Math.min(income, upTo) - prev) * rate
    prev = upTo
  }
  return tax
}

export function topRate(brackets: Brackets): number {
  return brackets.reduce((m, [, r]) => Math.max(m, r), 0)
}

function core(country: Country, city: City, a: Amounts, r?: Regime) {
  const sys = country.tax
  const lines: TaxLine[] = []
  const add = (key: string, label: string, amount: number, group: TaxLine['group']) => {
    if (amount <= 0.005) return
    const existing = lines.find((l) => l.key === key)
    if (existing) existing.amount += amount
    else lines.push({ key, label, amount, group })
  }

  if (r?.replacesAll) {
    add('fixed', `${r.name} (annual lump sum)`, r.fixedAnnualTax ?? 0, 'regime')
    return lines
  }

  const S = a.salary
  let social = 0
  for (const item of sys.social ?? []) {
    const amt = item.rate * pos(Math.min(S, item.cap ?? Infinity) - (item.floor ?? 0))
    social += amt
    add(`social:${item.name}`, item.name, amt, 'social')
  }

  const noDed = !!r?.noDeductions
  const empDed = !noDed && sys.employmentDeduction ? Math.min(S * sys.employmentDeduction.pct, sys.employmentDeduction.cap) : 0
  let exempt = 0
  if (r?.salaryExempt && S >= (r.salaryExempt.minSalary ?? 0)) {
    const { pct, floor = 0, ceiling = Infinity } = r.salaryExempt
    exempt = pct * Math.min(pos(S - floor), ceiling - floor)
  }
  const socialDed = sys.socialDeductible && !noDed ? social : 0
  const salaryBase = pos(S - empDed - exempt - socialDed)

  const tr: Record<CapitalKey, Treatment> = {
    gains: r?.capital?.gains ?? sys.gains,
    dividends: r?.capital?.dividends ?? sys.dividends,
    interest: r?.capital?.interest ?? sys.interest,
  }

  const ordinaryParts: [CapitalKey, number][] = []
  const poolParts: [CapitalKey, number][] = []
  for (const k of ['interest', 'dividends', 'gains'] as const) {
    const amt = a[k]
    const t = tr[k]
    if (amt <= 0) continue
    if (t.t === 'flat') add(k, CAPITAL_LABEL[k], pos(amt - (t.allowance ?? 0)) * t.rate, 'investment')
    else if (t.t === 'ordinary') ordinaryParts.push([k, pos(amt - (t.allowance ?? 0)) * (t.inclusion ?? 1)])
    else if (t.t === 'capital') poolParts.push([k, amt * (t.inclusion ?? 1)])
  }
  const ordinaryCap = ordinaryParts.reduce((s, [, v]) => s + v, 0)

  let allowance = noDed ? 0 : (sys.allowance ?? 0)
  if (sys.allowanceTaper && !noDed) {
    allowance = pos(allowance - sys.allowanceTaper.rate * pos(S + ordinaryCap - sys.allowanceTaper.start))
  }

  const incomeTax = (capBase: number) => {
    let tax: number
    if (r?.salaryBrackets) {
      tax = bracketTax(salaryBase, r.salaryBrackets) + bracketTax(capBase, sys.brackets)
    } else {
      tax = bracketTax(pos(salaryBase + capBase - allowance), sys.brackets)
      if (sys.altStandard) tax = Math.min(tax, bracketTax(salaryBase + capBase, sys.altStandard))
      if (!noDed) {
        const income = S + capBase
        for (const c of sys.credits ?? []) {
          const credit = pos(c.amount - (c.phaseRate ?? 0) * pos(income - (c.phaseStart ?? Infinity)))
          tax = pos(tax - credit)
        }
      }
    }
    let sur = 0
    const s = sys.surcharge
    if (s) {
      if (s.tiers) {
        const tier = [...s.tiers].reverse().find(([th]) => S + capBase > th)
        if (tier) sur += tax * tier[1]
      }
      if (s.rate) {
        let v = tax * s.rate
        if (s.threshold !== undefined) v = tax <= s.threshold ? 0 : s.phaseRate ? Math.min(v, s.phaseRate * (tax - s.threshold)) : v
        sur += v
      }
    }
    if (sys.cess) sur += (tax + sur) * sys.cess
    return { tax, sur }
  }

  const base = incomeTax(0)
  add('income', r?.salaryBrackets ? `Income tax (${r.name})` : 'Income tax', base.tax, 'income')
  add('surcharge', sys.surcharge?.name ?? 'Health & education cess', base.sur, 'income')
  let cum = 0
  let prevTotal = base.tax + base.sur
  for (const [k, v] of ordinaryParts) {
    cum += v
    const next = incomeTax(cum)
    add(k, CAPITAL_LABEL[k], next.tax + next.sur - prevTotal, 'investment')
    prevTotal = next.tax + next.sur
  }

  let stackBase = salaryBase + ordinaryCap - allowance
  for (const k of ['dividends', 'gains', 'interest'] as const) {
    const t = tr[k]
    if (t.t !== 'stacked' || a[k] <= 0) continue
    const amt = pos(a[k] - (t.allowance ?? 0))
    add(k, CAPITAL_LABEL[k], bracketTax(pos(stackBase + amt), t.brackets) - bracketTax(pos(stackBase), t.brackets), 'investment')
    stackBase += amt
  }

  if (poolParts.length && sys.capitalSchedule) {
    const pool = poolParts.reduce((s, [, v]) => s + v, 0)
    const tax = bracketTax(pos(pool - (sys.capitalSchedule.allowance ?? 0)), sys.capitalSchedule.brackets)
    for (const [k, v] of poolParts) add(k, CAPITAL_LABEL[k], (tax * v) / pool, 'investment')
  }

  const capitalIncome = a.gains + a.dividends + a.interest
  if (!r?.noSurtaxes) {
    for (const st of sys.surtaxes ?? []) {
      const b = st.base === 'ordinary' ? pos(salaryBase + ordinaryCap - allowance) : st.base === 'all' ? S + capitalIncome : capitalIncome
      add(`surtax:${st.name}`, st.name, bracketTax(b, st.brackets), st.base === 'capital' ? 'investment' : 'income')
    }
    const niit = sys.investmentSurtax
    if (niit) {
      const nii = (['gains', 'dividends', 'interest'] as const).reduce((s, k) => s + (tr[k].t === 'exempt' ? 0 : a[k]), 0)
      add('niit', niit.name, niit.rate * Math.min(nii, pos(S + nii - niit.threshold)), 'investment')
    }
  }

  if (!r?.noLocal) {
    for (const l of city.local ?? []) {
      const b =
        l.base === 'ordinary' ? salaryBase + ordinaryCap
        : l.base === 'allIncome' ? S - socialDed + capitalIncome - a.gains * (1 - (l.gainsInclusion ?? 1))
        : l.base === 'salary' ? S
        : a.gains
      let t = pos(bracketTax(pos(b - (l.allowance ?? 0)), l.brackets) - (l.credit ?? 0))
      if (l.surtax) t += l.surtax.reduce((s, [th, rate]) => s + rate * pos(t - th), 0)
      add(`local:${l.name}`, l.name, t, 'income')
    }
  }

  if (!r?.noWealthTax) {
    const wealthTax = (w?: WealthTax) => (w && (!w.threshold || a.netWorth > w.threshold) ? bracketTax(pos(a.netWorth - (w.allowance ?? 0)), w.brackets) : 0)
    const w = city.wealth === null ? undefined : (city.wealth ?? sys.wealth)
    const regional = wealthTax(w)
    const floor = wealthTax(sys.wealthFloor)
    const applied = floor > regional ? sys.wealthFloor : w
    if (applied) add('wealth', applied.name, Math.max(regional, floor), 'wealth')
  }

  if (r?.fixedAnnualTax) add('fixed', `${r.name} (annual lump sum)`, r.fixedAnnualTax, 'regime')
  return lines.sort((x, y) => GROUP_ORDER.indexOf(x.group) - GROUP_ORDER.indexOf(y.group))
}

const GROUP_ORDER: TaxLine['group'][] = ['income', 'social', 'investment', 'wealth', 'regime']

const sum = (lines: TaxLine[]) => lines.reduce((s, l) => s + l.amount, 0)

export function computeTax(country: Country, city: City, a: Amounts, regime?: Regime): TaxResult {
  const lines = core(country, city, a, regime)
  const totalTax = sum(lines)
  const salaryLines = core(country, city, { ...a, gains: 0, dividends: 0, interest: 0, netWorth: 0 }, regime)
  const salaryTax = sum(salaryLines.filter((l) => l.group !== 'regime' && l.group !== 'wealth'))
  const capitalIncome = a.gains + a.dividends + a.interest
  const gross = a.salary + capitalIncome
  const investmentTax = totalTax - salaryTax
  const wealthTax = sum(lines.filter((l) => l.group === 'wealth'))

  const step = Math.max(100, (a.salary || a.gains || 10000) * 0.01)
  const bumped = a.salary > 0 ? { ...a, salary: a.salary + step } : { ...a, gains: a.gains + step }
  const marginalRate = (sum(core(country, city, bumped, regime)) - totalTax) / step

  return {
    lines,
    gross,
    salary: a.salary,
    capitalIncome,
    totalTax,
    salaryTax,
    investmentTax,
    wealthTax,
    net: gross - totalTax,
    effectiveRate: gross > 0 ? totalTax / gross : 0,
    salaryRate: a.salary > 0 ? salaryTax / a.salary : 0,
    investmentRate: capitalIncome > 0 ? investmentTax / capitalIncome : 0,
    marginalRate,
    regime,
  }
}

export function isEligible(r: Regime, salary: number) {
  if (r.requiresSalary && salary <= 0) return false
  if (r.requiresNoSalary && salary > 0) return false
  if (r.minSalary && salary < r.minSalary) return false
  return true
}

export function evaluate(country: Country, city: City, a: Amounts, choice: RegimeChoice, allowRegimes: boolean): TaxResult {
  const standard = computeTax(country, city, a)
  if (choice !== 'auto' && choice !== 'standard') {
    const r = country.regimes?.find((x) => x.id === choice)
    if (r) return computeTax(country, city, a, r)
  }
  if (choice === 'standard' || !allowRegimes) return standard
  let best = standard
  for (const r of country.regimes ?? []) {
    if (r.manualOnly || !isEligible(r, a.salary)) continue
    const res = computeTax(country, city, a, r)
    if (res.totalTax < best.totalTax - 1) best = res
  }
  return best
}
