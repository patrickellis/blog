import { Check, Map as MapIcon, Plus } from 'lucide-react'
import { subdivisionLabel } from '../data/countries'
import { cx, money, pct } from '../lib/format'
import { useRows, type Row } from '../state/results'
import { useApp } from '../state/store'
import { Delta } from './ui'

const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th')}`

/** Small chip marking a destination whose taxes are set per state/province/canton/region. */
export function RegionChip({ row, className }: { row: Row; className?: string }) {
  if (!row.dest.subdivision) return null
  const label = subdivisionLabel(row.dest)
  return (
    <span className={cx('chip border-teal-300/30 bg-teal-400/10 text-teal-100', className)} title={`${row.dest.countryName}: ${label.adjective.toLowerCase()} taxes differ — each ${label.one.toLowerCase()} is ranked separately`}>
      <MapIcon className="h-3 w-3" /> {label.adjective} tax
    </span>
  )
}

/** National + regional top rates and the regional tax on the current profile, with its rank among sibling regions. */
export function RegionalTaxBreakdown({ row }: { row: Row }) {
  const currency = useApp((s) => s.currency)
  const siblings = useRows().byCountry.get(row.dest.iso2)
  const sub = row.dest.subdivision
  if (!sub || !siblings) return null
  const label = subdivisionLabel(row.dest)
  const byTax = [...siblings].sort((a, b) => a.tax - b.tax)
  const rank = byTax.findIndex((s) => s.dest.id === row.dest.id) + 1
  const cheapest = byTax[0]
  const combined = row.dest.headline.topIncome
  const regionalTop = sub.regionalTopRate
  const tile = (title: string, value: string, tone: string) => (
    <div className={cx('rounded-lg px-2 py-2 ring-1', tone)}>
      <div className="text-[11px] text-slate-400">{title}</div>
      <div className="text-lg font-semibold text-white tabular-nums">{value}</div>
    </div>
  )

  return (
    <div className="space-y-3 rounded-xl bg-teal-400/[0.06] p-4 ring-1 ring-teal-300/20">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-sm font-medium text-teal-100">
          <MapIcon className="h-4 w-4 text-teal-300" /> How {row.dest.name}’s income tax adds up
        </span>
        <span className="chip border-teal-300/30 bg-teal-400/10 text-teal-100">
          {ordinal(rank)} lowest tax of {siblings.length} {label.many}
        </span>
      </div>
      {regionalTop !== undefined ? (
        <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-2 text-center">
          {tile(`${label.national} top rate`, pct(combined - regionalTop, 1), 'bg-white/[0.03] ring-white/10')}
          <span className="text-slate-500">+</span>
          {tile(`${label.adjective} top rate`, pct(regionalTop, 1), 'bg-teal-400/10 ring-teal-300/30')}
          <span className="text-slate-500">=</span>
          {tile('Combined top rate', pct(combined, 1), 'bg-white/[0.03] ring-white/10')}
        </div>
      ) : (
        <p className="text-sm text-slate-300">
          Foral system: {row.dest.name} levies the entire income tax itself (top rate {pct(combined, 1)}) instead of splitting it with the state.
        </p>
      )}
      <dl className="space-y-1 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-slate-400">{regionalTop !== undefined ? `${label.adjective} & local income tax` : 'Foral income tax'} on your income</dt>
          <dd className="text-white tabular-nums">
            {money(row.regionalTax, currency)} <span className="text-xs text-slate-400">{row.gross > 0 ? pct(row.regionalTax / row.gross) : '—'}</span>
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-slate-400">Total tax vs lowest-tax {label.one.toLowerCase()}</dt>
          <dd className="tabular-nums">
            {cheapest.dest.id === row.dest.id ? (
              <span className="text-emerald-300">Lowest in {row.dest.countryName}</span>
            ) : (
              <span className="text-rose-300">
                +{money(row.tax - cheapest.tax, currency)} / yr <span className="text-xs text-slate-400">vs {cheapest.dest.name}</span>
              </span>
            )}
          </dd>
        </div>
      </dl>
    </div>
  )
}

/** Where this region sits among its country's other regions (take-home), compact or as a full list. */
export function RegionalSpread({ row, compact }: { row: Row; compact?: boolean }) {
  const currency = useApp((s) => s.currency)
  const targets = useApp((s) => s.targets)
  const { openDrawer, toggleTarget, focusOn } = useApp.getState()
  const siblings = useRows().byCountry.get(row.dest.iso2)
  if (!row.dest.subdivision || !siblings || siblings.length < 2) return null
  const label = subdivisionLabel(row.dest)
  const rank = siblings.findIndex((s) => s.dest.id === row.dest.id) + 1
  const best = siblings[0]
  const worst = siblings[siblings.length - 1]
  const spread = best.net - worst.net
  const pos = spread > 0 ? (row.net - worst.net) / spread : 1

  const summary = (
    <div className="space-y-1.5">
      {compact && (
        <div className="flex items-baseline justify-between gap-2 text-xs">
          <span className="text-slate-300">{row.dest.subdivision.regionalTopRate !== undefined ? `${label.adjective} tax` : 'Foral income tax'}</span>
          <span className="font-semibold text-teal-100 tabular-nums">
            {money(row.regionalTax, currency, { compact: true })}
            <span className="ml-1 font-normal text-slate-400">
              {row.gross > 0 ? pct(row.regionalTax / row.gross) : ''}
              {row.dest.subdivision.regionalTopRate !== undefined && ` · top ${pct(row.dest.subdivision.regionalTopRate, 1)}`}
            </span>
          </span>
        </div>
      )}
      <div className="flex items-center gap-1.5 text-xs text-teal-100">
        <MapIcon className="h-3.5 w-3.5 shrink-0 text-teal-300" />
        <span>
          <b className="font-semibold">{ordinal(rank)}</b> of {siblings.length} {label.many} in {row.dest.countryName} for take-home
        </span>
      </div>
      <div className="relative h-1.5 rounded-full bg-gradient-to-r from-rose-400/50 via-slate-400/40 to-emerald-400/60" aria-hidden>
        <span className="absolute top-1/2 h-3 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow" style={{ left: `${pos * 100}%` }} />
      </div>
      <div className="flex justify-between text-[10px] text-slate-400 tabular-nums">
        <span>
          {worst.dest.name} {money(worst.net, currency, { compact: true })}
        </span>
        <span>
          {best.dest.name} {money(best.net, currency, { compact: true })}
        </span>
      </div>
    </div>
  )

  if (compact) return <div className="mt-3 rounded-lg bg-teal-400/[0.06] px-2.5 py-2 ring-1 ring-teal-300/20">{summary}</div>

  return (
    <div className="space-y-3">
      {summary}
      <div className="scrollbar-thin max-h-80 overflow-y-auto rounded-xl ring-1 ring-white/10">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-ink-900 text-left text-xs text-slate-400">
            <tr>
              <th className="px-3 py-2 font-medium">{label.one}</th>
              <th className="px-3 py-2 text-right font-medium">Take-home</th>
              <th className="px-3 py-2 text-right font-medium">vs {row.dest.name}</th>
              <th className="px-3 py-2 text-right font-medium">Total tax</th>
              <th className="px-3 py-2">
                <span className="sr-only">Compare</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {siblings.map((s, i) => {
              const current = s.dest.id === row.dest.id
              const comparing = targets.includes(s.dest.id)
              return (
                <tr
                  key={s.dest.id}
                  onClick={() => {
                    focusOn(s.dest.id)
                    openDrawer(s.dest.id)
                  }}
                  className={cx('cursor-pointer border-t border-white/5 hover:bg-white/[0.04]', current && 'bg-teal-400/[0.08]')}
                >
                  <td className="px-3 py-1.5">
                    <span className="flex items-center gap-2">
                      <span className="w-5 text-right text-xs text-slate-500 tabular-nums">{i + 1}</span>
                      <span className={cx('truncate', current ? 'font-medium text-white' : 'text-slate-200')}>{s.dest.name}</span>
                      {s.isHome && <span className="chip border-amber-400/40 bg-amber-400/15 py-0 text-[10px] text-amber-200">Home</span>}
                    </span>
                    <span className="ml-7 block text-xs text-slate-500">{s.city.name}</span>
                  </td>
                  <td className="px-3 py-1.5 text-right text-slate-100 tabular-nums">{money(s.net, currency, { compact: true })}</td>
                  <td className="px-3 py-1.5 text-right">{current ? <span className="text-slate-500">—</span> : <Delta value={s.net - row.net} currency={currency} />}</td>
                  <td className="px-3 py-1.5 text-right text-slate-300 tabular-nums">{pct(s.res.effectiveRate)}</td>
                  <td className="px-2 py-1.5 text-right">
                    {!s.isHome && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleTarget(s.dest.id)
                        }}
                        className={cx('btn px-1.5 py-1', comparing ? 'text-cyan-300' : 'text-slate-500 hover:text-white')}
                        aria-label={comparing ? `Remove ${s.dest.label} from comparison` : `Compare ${s.dest.label}`}
                      >
                        {comparing ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
