import { BadgePercent, DoorOpen, Globe2, Home, Languages, Map as MapIcon, Minus, Plus, ScrollText, Stamp, X } from 'lucide-react'
import { useEffect, useMemo, useRef } from 'react'
import { BY_ID, subdivisionLabel } from '../data/countries'
import { cx, money, pct } from '../lib/format'
import { isEligible } from '../lib/tax'
import { computeRow, HOUSING_LABEL, regimeChoiceFor, useRows } from '../state/results'
import { useApp } from '../state/store'
import { RegionalSpread, RegionalTaxBreakdown } from './RegionalSpread'
import { Delta, ExtLink, Flag } from './ui'

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
        {icon} {title}
      </h3>
      {children}
    </section>
  )
}

export function CountryDrawer() {
  const { drawerId, currency, regimeById, profile, homeId } = useApp()
  const { openDrawer, toggleTarget, setHome, setCity, setRegime } = useApp.getState()
  const { byId, ctx, home, homeCol } = useRows()
  const panel = useRef<HTMLDivElement>(null)
  const country = drawerId ? BY_ID.get(drawerId) : undefined
  const row = drawerId ? byId.get(drawerId) : undefined

  useEffect(() => {
    if (!drawerId) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && openDrawer(null)
    window.addEventListener('keydown', onKey)
    panel.current?.focus()
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [drawerId, openDrawer])

  const choice = country ? regimeChoiceFor(country.id, homeId, regimeById) : 'auto'
  const cityRows = useMemo(() => (country ? country.cities.map((_, i) => computeRow(country, i, choice, ctx)) : []), [country, choice, ctx])

  if (!country || !row) return null
  const res = row.res
  const kind = country.subdivision && subdivisionLabel(country)

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={`${country.label} details`}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => openDrawer(null)} />
      <div ref={panel} tabIndex={-1} className="scrollbar-thin relative flex h-full w-full max-w-2xl flex-col overflow-y-auto border-l border-white/10 bg-ink-900 shadow-2xl outline-none">
        <div className={cx('h-1 shrink-0', row.isHome ? 'bg-home' : row.isTarget ? 'bg-target' : 'bg-teal-400/60')} />
        <header className="sticky top-0 z-10 flex items-center gap-4 border-b border-white/10 bg-ink-900/95 px-6 py-4 backdrop-blur">
          <Flag iso={country.iso2} className="text-4xl" />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-xl font-semibold text-white">{country.name}</h2>
            <p className="truncate text-sm text-slate-400">
              {kind ? `${kind.one}, ${country.countryName}` : country.region} · {country.currency} · UTC{country.utc}
            </p>
          </div>
          {!row.isHome && (
            <>
              <button onClick={() => toggleTarget(country.id)} className={row.isTarget ? 'btn-outline' : 'btn-primary'}>
                {row.isTarget ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                <span className="hidden sm:inline">{row.isTarget ? 'Remove' : 'Compare'}</span>
              </button>
              <button onClick={() => setHome(country.id)} className="btn-outline" title="Set as where you live now">
                <Home className="h-4 w-4" />
              </button>
            </>
          )}
          <button onClick={() => openDrawer(null)} className="btn-ghost p-2" aria-label="Close details">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="space-y-8 px-6 py-6">
          <section className="rounded-2xl bg-white/[0.03] p-5 ring-1 ring-white/10">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="label">Your estimated take-home</div>
                <div className="mt-1 text-3xl font-semibold text-white tabular-nums">{money(row.net, currency)}</div>
                {!row.isHome && (
                  <div className="text-sm">
                    <Delta value={row.delta.net} pctValue={row.delta.netPct} currency={currency} compact={false} /> <span className="text-slate-500">vs {home.dest.name}</span>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-3 gap-4 text-right">
                <div>
                  <div className="label">Total tax</div>
                  <div className="font-semibold text-white tabular-nums">{pct(res.effectiveRate)}</div>
                </div>
                <div>
                  <div className="label">Marginal</div>
                  <div className="font-semibold text-white tabular-nums">{pct(res.marginalRate, 0)}</div>
                </div>
                <div>
                  <div className="label">Investments</div>
                  <div className="font-semibold text-white tabular-nums">{res.capitalIncome > 0 ? pct(res.investmentRate) : '—'}</div>
                </div>
              </div>
            </div>
            {!!country.regimes?.length && (
              <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
                <span className="text-slate-400">Tax treatment</span>
                <select aria-label="Tax regime" value={choice} onChange={(e) => setRegime(country.id, e.target.value)} className="field w-auto cursor-pointer py-1.5">
                  <option value="auto">Best available regime</option>
                  <option value="standard">Standard rules</option>
                  {country.regimes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <dl className="mt-4 space-y-1.5 border-t border-white/10 pt-4 text-sm">
              {res.lines.map((l) => {
                const regional = kind && l.key.startsWith('local:')
                return (
                  <div key={l.key} className="flex justify-between gap-4">
                    <dt className={cx('flex items-center gap-2', regional ? 'text-teal-200' : 'text-slate-400')}>
                      {l.label}
                      {regional && <span className="chip border-teal-300/30 bg-teal-400/10 py-0 text-[10px] text-teal-100">{kind.adjective}</span>}
                    </dt>
                    <dd className="text-slate-200 tabular-nums">−{money(l.amount * row.toDisplay, currency)}</dd>
                  </div>
                )
              })}
              <div className="flex justify-between gap-4 border-t border-white/10 pt-2 font-medium">
                <dt className="text-slate-200">Gross → net</dt>
                <dd className="text-white tabular-nums">
                  {money(row.gross, currency)} → {money(row.net, currency)}
                </dd>
              </div>
            </dl>
          </section>

          <Section icon={<Globe2 className="h-4 w-4 text-cyan-300" />} title="Cities compared">
            <div className="overflow-hidden rounded-xl ring-1 ring-white/10">
              <table className="w-full text-sm">
                <thead className="bg-white/[0.03] text-left text-xs text-slate-400">
                  <tr>
                    <th className="px-3 py-2 font-medium">City</th>
                    <th className="px-3 py-2 text-right font-medium">1-bed</th>
                    <th className="px-3 py-2 text-right font-medium">3-bed</th>
                    <th className="px-3 py-2 text-right font-medium" title="Everyday cost index excluding rent (New York = 100)">Costs</th>
                    <th className="px-3 py-2 text-right font-medium">After {HOUSING_LABEL[profile.household]} rent</th>
                  </tr>
                </thead>
                <tbody>
                  {cityRows.map((cr, i) => {
                    const fx = ctx.rates[currency] ?? 1
                    const selected = i === row.cityIndex
                    return (
                      <tr key={cr.city.name} onClick={() => setCity(country.id, i)} className={cx('cursor-pointer border-t border-white/5 hover:bg-white/[0.04]', selected && 'bg-cyan-400/[0.07]')}>
                        <td className="px-3 py-2 text-slate-100">
                          <span className="flex items-center gap-2">
                            <span className={cx('h-1.5 w-1.5 rounded-full', selected ? 'bg-cyan-300' : 'bg-white/20')} />
                            {cr.city.name}
                          </span>
                          {cr.city.note && <span className="ml-3.5 text-xs text-slate-500">{cr.city.note}</span>}
                          {cr.city.local && <span className="ml-3.5 block text-xs text-slate-500">{cr.city.local.map((l) => l.name).join(' + ')}</span>}
                        </td>
                        <td className="px-3 py-2 text-right text-slate-300 tabular-nums">{money(cr.city.rent1 * fx, currency, { compact: true })}</td>
                        <td className="px-3 py-2 text-right text-slate-300 tabular-nums">{money(cr.city.rent3 * fx, currency, { compact: true })}</td>
                        <td className="px-3 py-2 text-right text-slate-300 tabular-nums">
                          {cr.city.col}
                          <span className={cx('ml-1 text-xs', cr.city.col > homeCol ? 'text-rose-300/80' : 'text-emerald-300/80')}>
                            {cr.city.col === homeCol ? '' : `${cr.city.col > homeCol ? '+' : ''}${Math.round((cr.city.col / homeCol - 1) * 100)}%`}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right font-medium text-slate-100 tabular-nums">{money(cr.afterHousing, currency, { compact: true })}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-slate-500">Monthly city-centre rents. Costs index excludes rent; % shows difference from your home city. Click a city to use it.</p>
          </Section>

          {kind && (
            <Section icon={<MapIcon className="h-4 w-4 text-teal-300" />} title={`${kind.adjective} taxes across ${country.countryName}`}>
              <RegionalSpread row={row} />
              <p className="text-xs text-slate-500">
                Each {kind.one.toLowerCase()} sets its own taxes, so where you settle can matter as much as which country. Click a {kind.one.toLowerCase()} to open it, or + to compare.
              </p>
            </Section>
          )}

          <Section icon={<ScrollText className="h-4 w-4 text-cyan-300" />} title="Tax system at a glance">
            <RegionalTaxBreakdown row={row} />
            <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              {[
                [kind ? `Top income rate (${kind.national.toLowerCase()} + ${kind.adjective.toLowerCase()})` : 'Top income rate', pct(country.headline.topIncome, 1)],
                ['Capital gains', country.headline.cgt],
                ['Dividends', country.headline.dividends],
                ['Wealth tax', country.headline.wealth],
                ['Inheritance', country.headline.inheritance],
                ['Basis', country.territorial ? 'Territorial' : country.citizenshipTaxation ? 'Citizenship + residence' : 'Residence (worldwide)'],
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl bg-white/[0.03] p-3 ring-1 ring-white/5">
                  <dt className="text-xs text-slate-500">{k}</dt>
                  <dd className="mt-0.5 font-medium text-slate-100">{v}</dd>
                </div>
              ))}
            </dl>
            {country.exitTax && (
              <div className="flex gap-2 rounded-xl bg-amber-400/10 p-3 text-sm text-amber-100 ring-1 ring-amber-400/25">
                <DoorOpen className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                <span>
                  <b>Leaving later?</b> {country.exitTax}
                </span>
              </div>
            )}
          </Section>

          {!!country.regimes?.length && (
            <Section icon={<BadgePercent className="h-4 w-4 text-violet-300" />} title="Special regimes for newcomers">
              <ul className="space-y-3">
                {country.regimes.map((r) => {
                  const applied = res.regime?.id === r.id
                  const eligible = isEligible(r, res.salary)
                  return (
                    <li key={r.id} className={cx('rounded-xl p-4 ring-1', applied ? 'bg-violet-500/10 ring-violet-400/40' : 'bg-white/[0.03] ring-white/10')}>
                      <div className="flex flex-wrap items-center gap-2">
                        {r.url ? (
                          <ExtLink href={r.url} className="font-medium text-white">
                            {r.name}
                          </ExtLink>
                        ) : (
                          <span className="font-medium text-white">{r.name}</span>
                        )}
                        <span className="chip">{r.duration}</span>
                        {r.manualOnly && <span className="chip" title="Depends on personal status, so never applied automatically">Opt-in</span>}
                        {applied ? (
                          <span className="chip border-violet-400/40 bg-violet-400/20 text-violet-100">Applied</span>
                        ) : !eligible ? (
                          <span className="chip text-slate-400">Not eligible with this profile</span>
                        ) : null}
                        {!applied && (
                          <button onClick={() => setRegime(country.id, r.id)} className="btn-ghost ml-auto px-2 py-1 text-xs text-violet-200">
                            Try it
                          </button>
                        )}
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-slate-300">{r.summary}</p>
                      <p className="mt-1.5 text-xs text-slate-500">
                        <b className="font-medium text-slate-400">Eligibility:</b> {r.eligibility}
                      </p>
                    </li>
                  )
                })}
              </ul>
            </Section>
          )}

          <Section icon={<Stamp className="h-4 w-4 text-cyan-300" />} title="Residency routes">
            <div className="flex flex-wrap gap-2">
              {country.visas.map((v) => {
                const href = country.sources?.visas?.[v]
                return href ? (
                  <ExtLink key={v} href={href} className="chip px-3 py-1 text-sm text-slate-200 hover:border-cyan-400/40 hover:bg-cyan-400/10 hover:text-white hover:no-underline">
                    {v}
                  </ExtLink>
                ) : (
                  <span key={v} className="chip px-3 py-1 text-sm">
                    {v}
                  </span>
                )
              })}
            </div>
            {country.sources?.visas && <p className="text-xs text-slate-500">Linked routes open the official immigration page.</p>}
          </Section>

          <Section icon={<Languages className="h-4 w-4 text-cyan-300" />} title="Living there">
            <dl className="grid grid-cols-3 gap-3 text-sm">
              <div className="rounded-xl bg-white/[0.03] p-3 ring-1 ring-white/5">
                <dt className="text-xs text-slate-500">Human Development Index</dt>
                <dd className="mt-0.5 font-medium text-slate-100">{country.hdi?.toFixed(3) ?? 'n/a'}</dd>
              </div>
              <div className="rounded-xl bg-white/[0.03] p-3 ring-1 ring-white/5">
                <dt className="text-xs text-slate-500">English proficiency</dt>
                <dd className="mt-0.5 font-medium text-slate-100">{country.english}</dd>
              </div>
              <div className="rounded-xl bg-white/[0.03] p-3 ring-1 ring-white/5">
                <dt className="text-xs text-slate-500">Time zone</dt>
                <dd className="mt-0.5 font-medium text-slate-100">UTC{country.utc}</dd>
              </div>
            </dl>
            <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-slate-300 marker:text-slate-600">
              {country.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </Section>

          <p className="border-t border-white/10 pt-4 text-xs leading-relaxed text-slate-500">
            Estimates based on simplified 2025 rules for a single filer. Always confirm with a qualified tax adviser before relocating.
          </p>
        </div>
      </div>
    </div>
  )
}
