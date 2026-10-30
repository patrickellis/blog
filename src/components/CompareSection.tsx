import { ArrowRight, BadgePercent, DoorOpen, Plus, X } from 'lucide-react'
import { BY_ISO } from '../data/countries'
import { cx, money, pct } from '../lib/format'
import { isEligible } from '../lib/tax'
import { HOUSING_LABEL, regimeChoiceFor, useRows, type Row } from '../state/results'
import { MAX_COMPARE, useApp } from '../state/store'
import { CountryPicker } from './CountryPicker'
import { Delta, Flag, Hint } from './ui'

const SEGMENTS = [
  { key: 'income', label: 'Income tax', color: 'bg-rose-400' },
  { key: 'social', label: 'Social security', color: 'bg-orange-300' },
  { key: 'investment', label: 'Investment tax', color: 'bg-violet-400' },
  { key: 'wealth', label: 'Wealth / lump-sum', color: 'bg-fuchsia-400' },
  { key: 'rent', label: 'Rent', color: 'bg-sky-400' },
  { key: 'left', label: 'Left to spend/save', color: 'bg-emerald-400' },
] as const

function Breakdown({ row }: { row: Row }) {
  const { currency } = useApp()
  const totals: Record<string, number> = { income: 0, social: 0, investment: 0, wealth: 0 }
  for (const l of row.res.lines) totals[l.group === 'regime' ? 'wealth' : l.group] += l.amount * row.toDisplay
  const rent = row.rentMonthly * 12
  const left = Math.max(0, row.net - rent)
  const parts: Record<string, number> = { ...totals, rent: Math.min(rent, Math.max(0, row.net)), left }
  const whole = Object.values(parts).reduce((s, v) => s + v, 0) || 1
  return (
    <div className="flex h-2.5 overflow-hidden rounded-full bg-white/5" role="img" aria-label="Where your gross income goes">
      {SEGMENTS.map((s) => {
        const v = parts[s.key]
        return v > 0 ? <div key={s.key} className={s.color} style={{ width: `${(v / whole) * 100}%` }} title={`${s.label}: ${money(v, currency)}`} /> : null
      })}
    </div>
  )
}

function CompareCard({ row }: { row: Row }) {
  const { currency, profile, regimeByIso, homeIso } = useApp()
  const { toggleTarget, setCity, setRegime, openDrawer } = useApp.getState()
  const c = row.country
  const res = row.res
  const salaryLocal = res.salary
  const choice = regimeChoiceFor(c.iso2, homeIso, regimeByIso)

  return (
    <article className={cx('panel relative flex flex-col overflow-hidden', row.isHome && 'ring-1 ring-amber-400/30')}>
      <div className={cx('h-1', row.isHome ? 'bg-home' : 'bg-target')} />
      <div className="flex flex-1 flex-col gap-4 p-5">
        <header className="flex items-start gap-3">
          <Flag iso={c.iso2} className="text-3xl" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="truncate font-semibold text-white">{c.name}</h3>
              {row.isHome && <span className="chip border-amber-400/40 bg-amber-400/15 text-amber-200">Home</span>}
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {c.cities.length > 1 ? (
                <select aria-label={`${c.name} city`} value={row.cityIndex} onChange={(e) => setCity(c.iso2, Number(e.target.value))} className="field w-auto cursor-pointer px-2 py-1 text-xs">
                  {c.cities.map((city, i) => (
                    <option key={city.name} value={i}>
                      {city.name}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="chip">{row.city.name}</span>
              )}
              {!!c.regimes?.length && (
                <select aria-label={`${c.name} tax regime`} value={choice} onChange={(e) => setRegime(c.iso2, e.target.value)} className="field w-auto max-w-[11rem] cursor-pointer px-2 py-1 text-xs">
                  <option value="auto">Best available regime</option>
                  <option value="standard">Standard rules</option>
                  {c.regimes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                      {!isEligible(r, salaryLocal) ? ' (not eligible)' : r.manualOnly ? ' (opt-in)' : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
          {!row.isHome && (
            <button onClick={() => toggleTarget(c.iso2)} className="btn-ghost -mt-1 -mr-2 p-1.5" aria-label={`Remove ${c.name}`}>
              <X className="h-4 w-4" />
            </button>
          )}
        </header>

        <div>
          <div className="label">Take-home per year</div>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-3">
            <span className="text-3xl font-semibold tracking-tight text-white tabular-nums">{money(row.net, currency)}</span>
            <span className="text-sm text-slate-400 tabular-nums">{money(row.net / 12, currency)} / mo</span>
          </div>
          {!row.isHome ? (
            <div className="mt-1 text-sm">
              <Delta value={row.delta.net} pctValue={row.delta.netPct} currency={currency} compact={false} /> <span className="text-slate-500">vs home</span>
            </div>
          ) : (
            <div className="mt-1 text-sm text-slate-500">Your baseline</div>
          )}
        </div>

        <Breakdown row={row} />

        {res.regime && (
          <div className="flex items-start gap-2 rounded-lg bg-violet-500/10 px-3 py-2 text-xs leading-relaxed text-violet-100 ring-1 ring-violet-400/25">
            <BadgePercent className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-300" />
            <span>
              <b>{res.regime.name}</b> · {res.regime.duration}. {res.regime.summary}
            </span>
          </div>
        )}

        <dl className="space-y-1.5 text-sm">
          {res.lines.map((l) => (
            <div key={l.key} className="flex items-center justify-between gap-3">
              <dt className="flex min-w-0 items-center gap-2 text-slate-400">
                <span
                  className={cx(
                    'h-2 w-2 shrink-0 rounded-sm',
                    l.group === 'income' ? 'bg-rose-400' : l.group === 'social' ? 'bg-orange-300' : l.group === 'investment' ? 'bg-violet-400' : 'bg-fuchsia-400',
                  )}
                />
                <span className="truncate">{l.label}</span>
              </dt>
              <dd className="text-slate-200 tabular-nums">−{money(l.amount * row.toDisplay, currency)}</dd>
            </div>
          ))}
          {res.lines.length === 0 && <div className="text-slate-400">No tax due on this profile</div>}
          <div className="flex items-center justify-between border-t border-white/10 pt-2 font-medium">
            <dt className="text-slate-200">Total tax</dt>
            <dd className="text-white tabular-nums">
              −{money(row.tax, currency)} <span className="ml-1 text-xs font-normal text-slate-400">{pct(res.effectiveRate)}</span>
            </dd>
          </div>
        </dl>

        <div className="grid grid-cols-3 gap-2 rounded-xl bg-white/[0.03] p-3 text-center">
          <div>
            <div className="text-[11px] text-slate-500">On salary</div>
            <div className="text-sm font-semibold text-slate-100 tabular-nums">{res.salary > 0 ? pct(res.salaryRate) : '—'}</div>
          </div>
          <div>
            <div className="flex items-center justify-center gap-1 text-[11px] text-slate-500">
              Marginal <Hint>Tax on your next unit of {res.salary > 0 ? 'salary' : 'capital gains'}, including social contributions.</Hint>
            </div>
            <div className="text-sm font-semibold text-slate-100 tabular-nums">{pct(res.marginalRate, 0)}</div>
          </div>
          <div>
            <div className="text-[11px] text-slate-500">On investments</div>
            <div className="text-sm font-semibold text-slate-100 tabular-nums">{res.capitalIncome > 0 ? pct(res.investmentRate) : '—'}</div>
          </div>
        </div>

        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-400">
              Rent · {HOUSING_LABEL[profile.household]}, {row.city.name}
            </span>
            <span className="text-slate-200 tabular-nums">−{money(row.rentMonthly, currency)} / mo</span>
          </div>
          <div className="flex justify-between font-medium">
            <span className="text-slate-200">Left after rent</span>
            <span className="text-white tabular-nums">{money(row.afterHousing, currency)}</span>
          </div>
          {!row.isHome && (
            <div className="flex justify-between text-xs">
              <span className="flex items-center gap-1 text-slate-500">
                Home-equivalent spending power
                <Hint>Money left after rent, adjusted for everyday prices (groceries, dining, transport) relative to your home city.</Hint>
              </span>
              <Delta value={row.delta.spendingPower} currency={currency} />
            </div>
          )}
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-white/10 pt-3 text-xs">
          <div>
            <dt className="text-slate-500">Capital gains</dt>
            <dd className="text-slate-200">{c.headline.cgt}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Wealth tax</dt>
            <dd className="text-slate-200">{c.headline.wealth}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Inheritance</dt>
            <dd className="text-slate-200">{c.headline.inheritance}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Residency routes</dt>
            <dd className="text-slate-200">{c.visas[0]}</dd>
          </div>
        </dl>

        {row.isHome && c.exitTax && (
          <div className="flex gap-2 rounded-lg bg-amber-400/10 px-3 py-2 text-xs leading-relaxed text-amber-100 ring-1 ring-amber-400/25">
            <DoorOpen className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" />
            <span>
              <b>Before you leave:</b> {c.exitTax}
            </span>
          </div>
        )}

        <button onClick={() => openDrawer(c.iso2)} className="btn-ghost mt-auto self-start px-0 text-cyan-300 hover:bg-transparent hover:text-cyan-200">
          Full profile <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </article>
  )
}

export function CompareSection() {
  const { homeIso, targets } = useApp()
  const { toggleTarget } = useApp.getState()
  const { byIso } = useRows()
  const rows = [homeIso, ...targets].map((iso) => byIso.get(iso)!).filter(Boolean)

  return (
    <section id="compare" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-white">Side-by-side</h2>
          <p className="mt-1 text-sm text-slate-400">
            {BY_ISO.get(homeIso)!.name} vs. {targets.length} destination{targets.length === 1 ? '' : 's'}. Change cities and regimes per country.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-3 text-xs text-slate-400 xl:flex">
            {SEGMENTS.map((s) => (
              <span key={s.key} className="flex items-center gap-1.5">
                <span className={cx('h-2 w-2 rounded-sm', s.color)} /> {s.label}
              </span>
            ))}
          </div>
          {targets.length < MAX_COMPARE && (
            <CountryPicker
              label="Add a destination"
              align="right"
              exclude={[homeIso, ...targets]}
              onSelect={toggleTarget}
              trigger={
                <span className="btn-primary">
                  <Plus className="h-4 w-4" /> Add destination
                </span>
              }
            />
          )}
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {rows.map((r) => (
          <CompareCard key={r.country.iso2} row={r} />
        ))}
        {targets.length === 0 && (
          <div className="panel grid place-items-center p-8 text-center text-sm text-slate-400">
            Click countries on the globe, or use “Add destination”, to compare them with home.
          </div>
        )}
      </div>
    </section>
  )
}
