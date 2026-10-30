import { Check, Coins, Home, PiggyBank, Plus, TrendingUp } from 'lucide-react'
import type { ReactNode } from 'react'
import { money, pct } from '../lib/format'
import { useRows, type Row } from '../state/results'
import { useApp } from '../state/store'
import { Delta, Flag } from './ui'

function Tile({ icon, title, row, value, sub }: { icon: ReactNode; title: string; row?: Row; value: ReactNode; sub: ReactNode }) {
  const { toggleTarget, openDrawer, focusOn } = useApp.getState()
  if (!row) return null
  return (
    <div className="panel group flex flex-col gap-3 p-4">
      <div className="label flex items-center gap-1.5">
        {icon} {title}
      </div>
      <button
        className="flex items-center gap-3 text-left"
        onClick={() => {
          focusOn(row.country.iso2)
          openDrawer(row.country.iso2)
        }}
      >
        <Flag iso={row.country.iso2} className="text-3xl" />
        <span className="min-w-0">
          <span className="block truncate font-semibold text-white group-hover:text-cyan-200">{row.country.name}</span>
          <span className="block text-xs text-slate-400">{row.city.name}{row.res.regime ? ` · ${row.res.regime.name}` : ''}</span>
        </span>
      </button>
      <div className="flex items-end justify-between gap-2">
        <div>
          <div className="text-xl font-semibold text-white tabular-nums">{value}</div>
          <div className="text-xs">{sub}</div>
        </div>
        <button onClick={() => toggleTarget(row.country.iso2)} className="btn-outline px-2 py-1 text-xs" aria-label={row.isTarget ? 'In comparison' : `Compare ${row.country.name}`}>
          {row.isTarget ? <Check className="h-3.5 w-3.5 text-cyan-300" /> : <Plus className="h-3.5 w-3.5" />}
          {row.isTarget ? 'Comparing' : 'Compare'}
        </button>
      </div>
    </div>
  )
}

export function Insights() {
  const { currency, profile } = useApp()
  const { rows } = useRows()
  const others = rows.filter((r) => !r.isHome)
  const best = (f: (r: Row) => number) =>
    others.reduce<Row | undefined>((b, r) => {
      if (!b) return r
      const d = f(r) - f(b)
      return d > 1 || (Math.abs(d) <= 1 && r.afterHousing > b.afterHousing) ? r : b
    }, undefined)
  const capital = profile.gains + profile.dividends + profile.interest

  const topNet = best((r) => r.net)
  const topHousing = best((r) => r.afterHousing)
  const topPower = best((r) => r.spendingPower)
  const lowestInv = capital > 0 ? best((r) => -r.investmentTax) : undefined

  return (
    <section aria-labelledby="insights-title" className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 id="insights-title" className="text-sm font-semibold tracking-wide text-slate-300">
          Best matches for your profile
        </h2>
        <span className="text-xs text-slate-500">from {others.length} destinations</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Tile icon={<Coins className="h-3.5 w-3.5" />} title="Highest take-home" row={topNet} value={topNet && money(topNet.net, currency)} sub={topNet && <Delta value={topNet.delta.net} pctValue={topNet.delta.netPct} currency={currency} />} />
        <Tile
          icon={<Home className="h-3.5 w-3.5" />}
          title="Most left after rent"
          row={topHousing}
          value={topHousing && money(topHousing.afterHousing, currency)}
          sub={topHousing && <Delta value={topHousing.delta.afterHousing} currency={currency} />}
        />
        <Tile
          icon={<TrendingUp className="h-3.5 w-3.5" />}
          title="Best spending power"
          row={topPower}
          value={topPower && money(topPower.spendingPower, currency)}
          sub={topPower && (<span className="text-slate-400">home-price equivalent · <Delta value={topPower.delta.spendingPower} currency={currency} /></span>)}
        />
        {lowestInv ? (
          <Tile
            icon={<PiggyBank className="h-3.5 w-3.5" />}
            title="Lowest tax on investments"
            row={lowestInv}
            value={money(lowestInv.investmentTax, currency)}
            sub={<span className="text-slate-400">{pct(lowestInv.res.investmentRate)} of investment income</span>}
          />
        ) : (
          <div className="panel flex flex-col justify-center gap-1 p-4 text-sm text-slate-400">
            <PiggyBank className="h-5 w-5 text-slate-500" />
            Add capital gains, dividends or net worth to find the best place for your investments.
          </div>
        )}
      </div>
    </section>
  )
}
