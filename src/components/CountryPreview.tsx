import { ArrowRight, BadgePercent, Home, Minus, Plus, X } from 'lucide-react'
import { subdivisionLabel } from '../data/countries'
import { cx, money, pct } from '../lib/format'
import { useFx } from '../state/fx-context'
import { HOUSING_LABEL, type Row } from '../state/results'
import { useApp } from '../state/store'
import { RegionalSpread } from './RegionalSpread'
import { Delta, Flag } from './ui'

export function CountryPreview({ row, pinned, onClose }: { row: Row; pinned?: boolean; onClose?: () => void }) {
  const { currency, profile } = useApp()
  const { toggleTarget, setHome, openDrawer } = useApp.getState()
  const c = row.dest
  const res = row.res
  const fxUsd = useFx().rates[currency] ?? 1
  const maxCol = Math.max(...c.cities.map((x) => x.col), 100)

  return (
    <div className="w-[340px] max-w-full overflow-hidden rounded-2xl border border-white/15 bg-ink-900/95 text-left shadow-2xl shadow-black/60 backdrop-blur-xl">
      <div className={cx('h-1', row.isHome ? 'bg-home' : row.isTarget ? 'bg-target' : 'bg-gradient-to-r from-teal-400/60 to-cyan-400/20')} />
      <div className="p-4">
        <div className="flex items-start gap-3">
          <Flag iso={c.iso2} className="text-3xl" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-base font-semibold text-white">{c.name}</h3>
              {row.isHome && <span className="chip border-amber-400/40 bg-amber-400/15 text-amber-200">Home</span>}
              {row.isTarget && <span className="chip border-cyan-400/40 bg-cyan-400/15 text-cyan-200">Comparing</span>}
            </div>
            <div className="truncate text-xs text-slate-400">
              {c.subdivision && `${c.countryName} · `}
              {row.city.name} · {c.currency} · UTC{c.utc}
            </div>
          </div>
          {pinned && (
            <button onClick={onClose} className="btn-ghost -mt-1 -mr-2 p-1.5" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
          <div>
            <div className="label">Take-home / yr</div>
            <div className="text-lg font-semibold text-white tabular-nums">{money(row.net, currency, { compact: true })}</div>
            {!row.isHome && <Delta value={row.delta.net} pctValue={row.delta.netPct} currency={currency} className="text-xs" />}
          </div>
          <div>
            <div className="label">Total tax rate</div>
            <div className="text-lg font-semibold text-white tabular-nums">{pct(res.effectiveRate)}</div>
            <div className="text-xs text-slate-400">marginal {pct(res.marginalRate, 0)}</div>
          </div>
          <div>
            <div className="label">After rent / yr</div>
            <div className="text-base font-semibold text-white tabular-nums">{money(row.afterHousing, currency, { compact: true })}</div>
            {!row.isHome && <Delta value={row.delta.afterHousing} currency={currency} className="text-xs" />}
          </div>
          <div>
            <div className="label">Tax on investments</div>
            <div className="text-base font-semibold text-white tabular-nums">{res.capitalIncome > 0 ? pct(res.investmentRate) : '—'}</div>
            <div className="text-xs text-slate-400">CGT {c.headline.cgt}</div>
          </div>
        </div>

        <RegionalSpread row={row} compact />

        {res.regime && (
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-violet-500/10 px-2.5 py-2 text-xs text-violet-200 ring-1 ring-violet-400/25">
            <BadgePercent className="mt-px h-3.5 w-3.5 shrink-0" />
            <span>
              <b className="font-semibold">{res.regime.name}</b> applied · {res.regime.duration}
            </span>
          </div>
        )}

        <dl className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-white/[0.03] p-2.5 text-center text-xs">
          <div>
            <dt className="text-slate-500">Top income</dt>
            <dd className="font-medium text-slate-200">{pct(c.headline.topIncome, 1)}</dd>
            {c.subdivision?.regionalTopRate !== undefined && (
              <dd className="text-[10px] text-teal-200/80" title={`Includes ${pct(c.subdivision.regionalTopRate, 1)} ${subdivisionLabel(c).adjective.toLowerCase()} tax`}>
                incl. {pct(c.subdivision.regionalTopRate, 1)} {subdivisionLabel(c).short}
              </dd>
            )}
          </div>
          <div>
            <dt className="text-slate-500">Dividends</dt>
            <dd className="truncate font-medium text-slate-200" title={c.headline.dividends}>
              {c.headline.dividends}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Wealth tax</dt>
            <dd className="truncate font-medium text-slate-200" title={c.headline.wealth}>
              {c.headline.wealth.startsWith('None') ? 'None' : 'Yes'}
            </dd>
          </div>
        </dl>

        <div className="mt-3">
          <div className="mb-1.5 flex items-center justify-between text-[11px] text-slate-500">
            <span className="label">Cities</span>
            <span>
              rent / mo · {HOUSING_LABEL.single} · {HOUSING_LABEL.family} · costs
            </span>
          </div>
          <ul className="space-y-1">
            {c.cities.slice(0, 4).map((city) => (
              <li key={city.name} className={cx('grid grid-cols-[1fr_auto_auto_56px] items-center gap-2 text-xs', city === row.city ? 'text-white' : 'text-slate-300')}>
                <span className="truncate">{city.name}</span>
                <span className={cx('tabular-nums', profile.household === 'single' && 'font-semibold')}>{money(city.rent1 * fxUsd, currency, { compact: true })}</span>
                <span className={cx('tabular-nums', profile.household === 'family' && 'font-semibold')}>{money(city.rent3 * fxUsd, currency, { compact: true })}</span>
                <span className="flex items-center gap-1" title={`Everyday cost index ${city.col} (New York = 100)`}>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                    <span className="block h-full rounded-full bg-slate-400" style={{ width: `${(city.col / maxCol) * 100}%` }} />
                  </span>
                  <span className="w-5 text-right text-[10px] text-slate-500 tabular-nums">{city.col}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        {pinned ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {!row.isHome && (
              <button onClick={() => toggleTarget(c.id)} className={row.isTarget ? 'btn-outline' : 'btn-primary'}>
                {row.isTarget ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                {row.isTarget ? 'Remove' : 'Compare'}
              </button>
            )}
            {!row.isHome && (
              <button onClick={() => setHome(c.id)} className="btn-outline" title="Use as where you live now">
                <Home className="h-4 w-4" /> Set home
              </button>
            )}
            <button onClick={() => openDrawer(c.id)} className="btn-ghost ml-auto">
              Details <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="mt-3 text-center text-[11px] text-slate-500">Click to pin · compare · view full details</div>
        )}
      </div>
    </div>
  )
}
