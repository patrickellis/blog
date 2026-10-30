import { ArrowDown, ArrowUp, Check, Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { REGIONS } from '../data/countries'
import { cx, money, pct } from '../lib/format'
import { HOUSING_LABEL, useRows, type Row } from '../state/results'
import { useApp } from '../state/store'
import { Delta, Flag, Hint } from './ui'

type SortKey = 'name' | 'net' | 'delta' | 'afterHousing' | 'spendingPower' | 'effective' | 'investment' | 'rent'

const FILTERS = {
  zeroIncome: { label: '0% income tax', test: (r: Row) => r.country.headline.topIncome === 0 },
  noGains: {
    label: 'No tax on foreign gains',
    test: (r: Row) => r.country.tax.gains.t === 'exempt' || !!r.country.regimes?.some((g) => g.capital?.gains?.t === 'exempt' || g.replacesAll),
  },
  regime: { label: 'Has expat regime', test: (r: Row) => !!r.country.regimes?.length },
  territorial: { label: 'Territorial', test: (r: Row) => !!r.country.territorial },
} as const

type FilterKey = keyof typeof FILTERS

const value = (r: Row, k: SortKey): number | string => {
  switch (k) {
    case 'name': return r.country.name
    case 'net': return r.net
    case 'delta': return r.delta.net
    case 'afterHousing': return r.afterHousing
    case 'spendingPower': return r.spendingPower
    case 'effective': return -r.res.effectiveRate
    case 'investment': return -r.investmentTax
    case 'rent': return -r.rentMonthly
  }
}

export function RankingsTable() {
  const { currency, profile } = useApp()
  const { toggleTarget, openDrawer, focusOn } = useApp.getState()
  const { rows } = useRows()
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: 'afterHousing', desc: true })
  const [region, setRegion] = useState<string>('All')
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState<FilterKey[]>([])
  const capital = profile.gains + profile.dividends + profile.interest

  const sorted = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = rows.filter(
      (r) =>
        (region === 'All' || r.country.region === region) &&
        (!q || r.country.name.toLowerCase().includes(q) || r.city.name.toLowerCase().includes(q)) &&
        filters.every((f) => FILTERS[f].test(r)),
    )
    return list.sort((a, b) => {
      const va = value(a, sort.key)
      const vb = value(b, sort.key)
      const cmp = typeof va === 'string' ? va.localeCompare(vb as string) : (va as number) - (vb as number)
      return sort.desc ? -cmp : cmp
    })
  }, [rows, region, query, filters, sort])

  const Th = ({ k, children, hint, className }: { k: SortKey; children: React.ReactNode; hint?: string; className?: string }) => (
    <th scope="col" className={cx('px-3 py-2.5 font-medium whitespace-nowrap', className)} aria-sort={sort.key === k ? (sort.desc ? 'descending' : 'ascending') : 'none'}>
      <span className="inline-flex items-center gap-1">
        <button className={cx('inline-flex items-center gap-1 hover:text-white', sort.key === k && 'text-white')} onClick={() => setSort((s) => ({ key: k, desc: s.key === k ? !s.desc : k !== 'name' }))}>
          {children}
          {sort.key === k && (sort.desc ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />)}
        </button>
        {hint && <Hint>{hint}</Hint>}
      </span>
    </th>
  )

  return (
    <section id="rankings" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-white">All destinations, ranked for you</h2>
          <p className="mt-1 text-sm text-slate-400">Sorted by what matters most — click any column. “Better” always sorts first.</p>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter by country or city" className="field w-64 pl-9" aria-label="Filter destinations" />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {['All', ...REGIONS].map((r) => (
          <button key={r} onClick={() => setRegion(r)} className={cx('chip px-3 py-1 transition', region === r ? 'border-white/30 bg-white/15 text-white' : 'hover:bg-white/10')} aria-pressed={region === r}>
            {r}
          </button>
        ))}
        <span className="mx-1 h-4 w-px bg-white/10" />
        {(Object.keys(FILTERS) as FilterKey[]).map((f) => {
          const on = filters.includes(f)
          return (
            <button
              key={f}
              aria-pressed={on}
              onClick={() => setFilters((fs) => (on ? fs.filter((x) => x !== f) : [...fs, f]))}
              className={cx('chip px-3 py-1 transition', on ? 'border-cyan-400/50 bg-cyan-400/15 text-cyan-100' : 'hover:bg-white/10')}
            >
              {on && <Check className="h-3 w-3" />} {FILTERS[f].label}
            </button>
          )
        })}
      </div>

      <div className="panel scrollbar-thin overflow-x-auto">
        <table className="w-full min-w-[960px] text-sm">
          <thead className="border-b border-white/10 text-left text-xs text-slate-400">
            <tr>
              <th scope="col" className="w-10 px-3 py-2.5 font-medium">#</th>
              <Th k="name">Destination</Th>
              <Th k="net" className="text-right">Take-home</Th>
              <Th k="delta" className="text-right">vs home</Th>
              <Th k="afterHousing" className="text-right" hint={`Take-home minus a year of city-centre ${HOUSING_LABEL[profile.household]} rent.`}>After rent</Th>
              <Th k="spendingPower" className="text-right" hint="After-rent income adjusted for everyday prices relative to your home city.">Spending power</Th>
              <Th k="effective" className="text-right">Total tax</Th>
              <Th k="investment" className="text-right" hint="Tax attributable to capital gains, dividends, interest and wealth.">Investment tax</Th>
              <Th k="rent" className="text-right">Rent / mo</Th>
              <th scope="col" className="px-3 py-2.5"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => (
              <tr
                key={r.country.iso2}
                className={cx('group cursor-pointer border-b border-white/5 transition last:border-0 hover:bg-white/[0.04]', r.isHome && 'bg-amber-400/[0.06]')}
                onClick={() => {
                  focusOn(r.country.iso2)
                  openDrawer(r.country.iso2)
                }}
              >
                <td className="px-3 py-2.5 text-xs text-slate-500 tabular-nums">{i + 1}</td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <Flag iso={r.country.iso2} className="text-xl" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 font-medium text-slate-100">
                        {r.country.name}
                        {r.isHome && <span className="chip border-amber-400/40 bg-amber-400/15 py-0 text-[10px] text-amber-200">Home</span>}
                      </div>
                      <div className="truncate text-xs text-slate-500">
                        {r.city.name}
                        {r.res.regime && <span className="text-violet-300"> · {r.res.regime.name}</span>}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-right font-medium text-slate-100 tabular-nums">{money(r.net, currency, { compact: true })}</td>
                <td className="px-3 py-2.5 text-right">{r.isHome ? <span className="text-slate-500">—</span> : <Delta value={r.delta.net} pctValue={r.delta.netPct} currency={currency} />}</td>
                <td className="px-3 py-2.5 text-right text-slate-200 tabular-nums">{money(r.afterHousing, currency, { compact: true })}</td>
                <td className="px-3 py-2.5 text-right text-slate-200 tabular-nums">{money(r.spendingPower, currency, { compact: true })}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  <span className="inline-flex items-center gap-2">
                    <span className="hidden h-1.5 w-12 overflow-hidden rounded-full bg-white/10 sm:block">
                      <span className="block h-full rounded-full bg-rose-400/80" style={{ width: `${Math.min(100, r.res.effectiveRate * 200)}%` }} />
                    </span>
                    <span className="w-12 text-slate-200">{pct(r.res.effectiveRate)}</span>
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right text-slate-300 tabular-nums">
                  {capital > 0 || r.investmentTax > 0 ? (
                    <>
                      {money(r.investmentTax, currency, { compact: true })}
                      {capital > 0 && <span className="ml-1 text-xs text-slate-500">{pct(r.res.investmentRate, 0)}</span>}
                    </>
                  ) : (
                    <span className="text-slate-600">—</span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-right text-slate-300 tabular-nums">{money(r.rentMonthly, currency, { compact: true })}</td>
                <td className="px-3 py-2.5 text-right">
                  {!r.isHome && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleTarget(r.country.iso2)
                      }}
                      className={cx('btn px-2 py-1 text-xs', r.isTarget ? 'text-cyan-300' : 'text-slate-400 opacity-60 group-hover:opacity-100 hover:text-white')}
                      aria-label={r.isTarget ? `Remove ${r.country.name} from comparison` : `Compare ${r.country.name}`}
                    >
                      {r.isTarget ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={10} className="px-3 py-10 text-center text-sm text-slate-500">
                  No destinations match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
