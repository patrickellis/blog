import { BadgePercent, Info } from 'lucide-react'
import type { ReactNode } from 'react'
import { cx, money, pct } from '../lib/format'
import type { Row } from '../state/results'
import type { Brackets, LocalTax, Regime, SocialItem, TaxSystem, Treatment, WealthTax } from '../types'
import { ExtLink, HoverCard } from './ui'

type Fmt = (v: number) => string

const rate = (r: number) => pct(r, 2)
const host = (url: string) => new URL(url).hostname.replace(/^www\./, '')

function range(from: number, upTo: number, m: Fmt) {
  if (upTo === Infinity) return from ? `Over ${m(from)}` : 'All'
  return from ? `${m(from)} – ${m(upTo)}` : `Up to ${m(upTo)}`
}

/** "3% over €250,000; 4% over €500,000" — for short schedules shown inline. */
function inline(brackets: Brackets, m: Fmt) {
  const parts = brackets.flatMap(([upTo, r], i) => {
    const from = i ? brackets[i - 1][0] : 0
    if (!r) return []
    return [from ? `${rate(r)} over ${m(from)}` : upTo === Infinity ? rate(r) : `${rate(r)} up to ${m(upTo)}`]
  })
  return parts.join('; ') || '0%'
}

const socialText = (s: SocialItem, m: Fmt) =>
  `${rate(s.rate)} of salary${s.floor && s.cap ? ` between ${m(s.floor)} and ${m(s.cap)}` : s.cap ? ` up to ${m(s.cap)}` : s.floor ? ` over ${m(s.floor)}` : ''}`

function Title({ children }: { children: ReactNode }) {
  return <div className="mb-2 text-sm font-semibold text-white">{children}</div>
}

function Sub({ children }: { children: ReactNode }) {
  return <div className="mt-3 mb-1 text-[10px] font-semibold tracking-wider text-slate-500 uppercase">{children}</div>
}

function Facts({ items, className }: { items: (ReactNode | false | undefined | 0)[]; className?: string }) {
  const list = items.filter(Boolean)
  if (!list.length) return null
  return (
    <ul className={cx('space-y-1', className)}>
      {list.map((x, i) => (
        <li key={i} className="flex gap-2">
          <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-slate-500" aria-hidden />
          <span>{x}</span>
        </li>
      ))}
    </ul>
  )
}

function Bands({ brackets, m, head }: { brackets: Brackets; m: Fmt; head: string }) {
  return (
    <table className="w-full tabular-nums">
      <thead className="text-[10px] tracking-wider text-slate-500 uppercase">
        <tr>
          <th className="pb-1 text-left font-medium">{head}</th>
          <th className="pb-1 text-right font-medium">Rate</th>
        </tr>
      </thead>
      <tbody>
        {brackets.map(([upTo, r], i) => (
          <tr key={upTo} className="border-t border-white/5">
            <td className="py-1 text-slate-300">{range(i ? brackets[i - 1][0] : 0, upTo, m)}</td>
            <td className="py-1 text-right font-medium text-slate-100">{rate(r)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function LocalBlock({ l, m }: { l: LocalTax; m: Fmt }) {
  const facts = [
    l.allowance && `allowance ${m(l.allowance)}`,
    l.credit && `credit ${m(l.credit)}`,
    l.base === 'allIncome' && 'applies to salary and investment income',
    l.gainsInclusion !== undefined && l.gainsInclusion < 1 && `${pct(1 - l.gainsInclusion, 0)} of long-term gains exempt`,
    l.surtax && `surtax ${l.surtax.map(([th, r]) => `${pct(r, 0)} of tax over ${m(th)}`).join(', ')}`,
  ].filter(Boolean)
  return (
    <>
      <Sub>{l.name}</Sub>
      {!!facts.length && <p className="mb-1 text-slate-400">{facts.join(' · ').replace(/^./, (ch) => ch.toUpperCase())}</p>}
      <Bands brackets={l.brackets} m={m} head="Taxable income" />
    </>
  )
}

function RegimeNote({ regime }: { regime?: Regime }) {
  if (!regime) return null
  return (
    <p className="mt-3 flex gap-1.5 rounded-lg bg-violet-500/10 px-2.5 py-2 text-violet-200 ring-1 ring-violet-400/25">
      <BadgePercent className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>
        Standard rules shown. Your estimate uses <b className="font-semibold">{regime.name}</b>, which changes this — see special regimes below.
      </span>
    </p>
  )
}

function affects(r: Regime | undefined, key: 'income' | 'gains' | 'dividends' | 'wealth') {
  if (!r) return undefined
  const hit =
    r.replacesAll ||
    (key === 'income' ? !!(r.salaryBrackets || r.salaryExempt || r.noDeductions || r.noLocal || r.noSurtaxes) : key === 'wealth' ? !!r.noWealthTax : !!r.capital?.[key])
  return hit ? r : undefined
}

function IncomeDetail({ row, m }: { row: Row; m: Fmt }) {
  const sys = row.dest.tax
  const local = row.city.local ?? []
  const regional = local.filter((l) => l.base === 'ordinary' || l.base === 'allIncome')
  const payroll = local.filter((l) => l.base === 'salary')
  const ded = sys.employmentDeduction
  const s = sys.surcharge
  return (
    <>
      <Title>Income tax · {row.dest.currency}</Title>
      <Facts
        className="mb-3"
        items={[
          sys.allowance && `Tax-free allowance of ${m(sys.allowance)}${sys.allowanceTaper ? `, withdrawn at ${pct(sys.allowanceTaper.rate, 0)} of income over ${m(sys.allowanceTaper.start)}` : ''}.`,
          ded && (ded.pct >= 1 ? `Flat employment deduction of ${m(ded.cap)}.` : `Employment-expense deduction of ${pct(ded.pct, 0)} of salary, up to ${m(ded.cap)}.`),
          ...(sys.credits ?? []).map((c) => `Tax credit of ${m(c.amount)}${c.phaseStart !== undefined ? `, phased out at ${rate(c.phaseRate ?? 0)} of income over ${m(c.phaseStart)}` : ''}.`),
          sys.socialDeductible && 'Social contributions are deducted before income tax.',
        ]}
      />
      {!!regional.length && <Sub>National</Sub>}
      <Bands brackets={sys.brackets} m={m} head={sys.allowance || ded ? 'Taxable income' : 'Income'} />
      <Facts
        className="mt-2"
        items={[
          sys.altStandard && `Or a standard rate of ${inline(sys.altStandard, m)} on net income, whichever is lower.`,
          s?.rate && `${s.name}: ${rate(s.rate)} of income tax${s.threshold !== undefined ? ` once it exceeds ${m(s.threshold)}` : ''}.`,
          s?.tiers && `${s.name}: ${s.tiers.map(([th, r]) => `${pct(r, 0)} of tax on income over ${m(th)}`).join(', ')}.`,
          sys.cess && `Cess of ${rate(sys.cess)} on income tax and surcharge.`,
          ...(sys.surtaxes ?? []).filter((st) => st.base !== 'capital').map((st) => `${st.name}: ${inline(st.brackets, m)}${st.base === 'all' ? ' of total income' : ''}.`),
        ]}
      />
      {regional.map((l) => (
        <LocalBlock key={l.name} l={l} m={m} />
      ))}
      {(!!payroll.length || !!sys.social?.length) && (
        <>
          <Sub>Also on salary</Sub>
          <Facts items={[...payroll.map((l) => `${l.name}: ${inline(l.brackets, m)}.`), ...(sys.social ?? []).map((x) => `${x.name}: ${socialText(x, m)}.`)]} />
        </>
      )}
      <RegimeNote regime={affects(row.res.regime, 'income')} />
    </>
  )
}

function TreatmentBlock({ t, sys, m }: { t: Treatment; sys: TaxSystem; m: Fmt }) {
  const allowance = 'allowance' in t && t.allowance ? ` after an annual allowance of ${m(t.allowance)}` : ''
  switch (t.t) {
    case 'exempt':
      return (
        <p>
          <b className="font-semibold text-slate-100">Not taxed.</b> {t.note && `${t.note}.`}
        </p>
      )
    case 'flat':
      return (
        <p>
          <b className="font-semibold text-slate-100">Flat {rate(t.rate)}</b>
          {allowance}.
        </p>
      )
    case 'ordinary':
      return (
        <p>
          <b className="font-semibold text-slate-100">Taxed as income</b> at your marginal rate{t.inclusion !== undefined && t.inclusion < 1 ? `, on ${pct(t.inclusion, 0)} of the amount` : ''}
          {allowance}.
        </p>
      )
    case 'capital': {
      const cs = sys.capitalSchedule!
      return (
        <>
          <p className="mb-2">
            <b className="font-semibold text-slate-100">{cs.name ?? 'Capital income'} scale</b>, pooled with other investment income
            {t.inclusion !== undefined && t.inclusion < 1 ? ` (${pct(t.inclusion, 0)} included)` : ''}
            {cs.allowance ? `, with a shared allowance of ${m(cs.allowance)}` : ''}.
          </p>
          <Bands brackets={cs.brackets} m={m} head="Investment income" />
        </>
      )
    }
    case 'stacked':
      return (
        <>
          <p className="mb-2">
            <b className="font-semibold text-slate-100">Own bands</b>, stacked on top of your other taxable income{allowance}.
          </p>
          <Bands brackets={t.brackets} m={m} head="Total taxable income" />
        </>
      )
  }
}

function shortTreatment(t: Treatment, sys: TaxSystem, m: Fmt) {
  switch (t.t) {
    case 'exempt':
      return t.note ?? 'Not taxed'
    case 'flat':
      return `Flat ${rate(t.rate)}`
    case 'ordinary':
      return 'Taxed as income'
    case 'capital':
      return `${sys.capitalSchedule?.name ?? 'Capital income'} scale`
    case 'stacked':
      return `Own bands: ${inline(t.brackets, m)}`
  }
}

function CapitalDetail({ row, k, m }: { row: Row; k: 'gains' | 'dividends'; m: Fmt }) {
  const sys = row.dest.tax
  const t = sys[k]
  const niit = sys.investmentSurtax
  const locals = (row.city.local ?? []).flatMap((l) => {
    if (l.base === 'allIncome') return [`${l.name} also applies${k === 'gains' && l.gainsInclusion !== undefined && l.gainsInclusion < 1 ? ` to ${pct(l.gainsInclusion, 0)} of gains` : ''}.`]
    if (l.base === 'ordinary' && t.t === 'ordinary') return [`${l.name} also applies.`]
    return []
  })
  const gainsTaxes = k === 'gains' ? (row.city.local ?? []).filter((l) => l.base === 'gains') : []
  return (
    <>
      <Title>{k === 'gains' ? 'Capital gains' : 'Dividends'}</Title>
      <TreatmentBlock t={t} sys={sys} m={m} />
      <Facts
        className="mt-2"
        items={[
          ...locals,
          niit && t.t !== 'exempt' && `${niit.name}: ${rate(niit.rate)} on investment income once total income exceeds ${m(niit.threshold)}.`,
          ...(sys.surtaxes ?? [])
            .filter((st) => st.base !== 'ordinary')
            .map((st) => `${st.name}: ${inline(st.brackets, m)} of ${st.base === 'all' ? 'total' : 'investment'} income.`),
        ]}
      />
      {gainsTaxes.map((l) => (
        <LocalBlock key={l.name} l={l} m={m} />
      ))}
      {k === 'dividends' && (
        <>
          <Sub>Interest</Sub>
          <p>{shortTreatment(sys.interest, sys, m)}.</p>
        </>
      )}
      <RegimeNote regime={affects(row.res.regime, k)} />
    </>
  )
}

function WealthBlock({ w, m }: { w: WealthTax; m: Fmt }) {
  return (
    <>
      <Facts
        className="mb-2"
        items={[w.allowance && `First ${m(w.allowance)} exempt.`, w.threshold && `Only due once net worth exceeds ${m(w.threshold)} — then on the whole amount.`]}
      />
      <Bands brackets={w.brackets} m={m} head={w.allowance ? 'Taxable wealth' : 'Net wealth'} />
    </>
  )
}

function wealthDetail(row: Row, m: Fmt): ReactNode {
  const sys = row.dest.tax
  const w = row.city.wealth === null ? undefined : (row.city.wealth ?? sys.wealth)
  const floor = sys.wealthFloor
  if (!w && !floor) return null
  return (
    <>
      <Title>{w?.name ?? 'Wealth tax'}</Title>
      {w ? <WealthBlock w={w} m={m} /> : <p>No regional wealth tax here.</p>}
      {floor && (
        <>
          <Sub>{floor.name}</Sub>
          <p className="mb-2 text-slate-400">A national minimum that regional relief can’t remove — the higher of the two is due.</p>
          <WealthBlock w={floor} m={m} />
        </>
      )}
      <RegimeNote regime={affects(row.res.regime, 'wealth')} />
    </>
  )
}

function basis(row: Row): [string, ReactNode] {
  const c = row.dest
  if (c.territorial)
    return [
      'Territorial',
      `${c.countryName} taxes only income earned locally. Foreign salary, dividends and gains are generally outside the tax net, though remittance and residency rules vary.`,
    ]
  if (c.citizenshipTaxation)
    return [
      'Citizenship + residence',
      `Residents are taxed on worldwide income — and so are ${c.countryName} citizens living abroad, who must keep filing. Foreign tax credits and exclusions reduce double taxation.`,
    ]
  return [
    'Residence (worldwide)',
    `Tax residents are taxed on their worldwide income; non-residents only on ${c.countryName}-source income. Residence usually starts after 183 days in a year, or when your home or centre of interests moves there.`,
  ]
}

interface Card {
  label: string
  value: ReactNode
  detail?: ReactNode
  href?: string
}

/** Headline tax facts; hovering (or focusing/tapping) a card reveals the full schedule behind it. */
export function TaxGlance({ row }: { row: Row }) {
  const c = row.dest
  const src = c.sources ?? {}
  const m: Fmt = (v) => money(v, c.currency)
  const [basisLabel, basisText] = basis(row)
  const cards: Card[] = [
    { label: 'Top income rate', value: pct(c.headline.topIncome, 1), detail: <IncomeDetail row={row} m={m} />, href: src.income },
    { label: 'Capital gains', value: c.headline.cgt, detail: <CapitalDetail row={row} k="gains" m={m} />, href: src.gains },
    { label: 'Dividends', value: c.headline.dividends, detail: <CapitalDetail row={row} k="dividends" m={m} />, href: src.dividends },
    { label: 'Wealth tax', value: c.headline.wealth, detail: wealthDetail(row, m), href: src.wealth },
    { label: 'Inheritance', value: c.headline.inheritance, href: src.inheritance },
    { label: 'Basis', value: basisLabel, detail: (
      <>
        <Title>{basisLabel} taxation</Title>
        <p>{basisText}</p>
      </>
    ) },
  ]

  return (
    <ul className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
      {cards.map(({ label, value, detail, href }) => {
        const interactive = !!(detail || href)
        const body = (
          <div
            className={cx(
              'h-full rounded-xl bg-white/[0.03] p-3 ring-1 ring-white/5',
              interactive && 'cursor-help transition group-hover:bg-white/[0.06] group-hover:ring-cyan-400/30 group-focus-within:ring-cyan-400/40',
            )}
          >
            <div className="flex items-start justify-between gap-2 text-xs text-slate-500">
              {label}
              {interactive && <Info className="mt-px h-3.5 w-3.5 shrink-0 text-slate-600 transition group-hover:text-cyan-300" aria-hidden />}
            </div>
            <div className="mt-0.5 font-medium text-slate-100">{value}</div>
          </div>
        )
        if (!interactive) return <li key={label}>{body}</li>
        return (
          <li key={label}>
            <HoverCard label={`${label} details`} className="group h-full" trigger={body}>
              {detail ?? (
                <>
                  <Title>{label}</Title>
                  <p>{value}</p>
                </>
              )}
              {href && (
                <div className="mt-3 border-t border-white/10 pt-2.5">
                  <ExtLink href={href}>Official guidance · {host(href)}</ExtLink>
                </div>
              )}
            </HoverCard>
          </li>
        )
      })}
    </ul>
  )
}
