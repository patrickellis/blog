import { AlertTriangle, Baby, Briefcase, ChevronDown, Landmark, LineChart, PiggyBank, Sparkles, User, Users, Wallet } from 'lucide-react'
import { useState } from 'react'
import { BY_ISO } from '../data/countries'
import { PRESETS } from '../data/presets'
import { cx, money } from '../lib/format'
import { useFx } from '../state/fx-context'
import { HOUSING_LABEL, useRows } from '../state/results'
import { useApp } from '../state/store'
import type { Household } from '../types'
import { CountryPicker } from './CountryPicker'
import { MoneyInput } from './MoneyInput'
import { Segmented, Toggle } from './ui'

export function ProfilePanel() {
  const { profile, currency, homeIso, cityByIso, useRegimes, activePreset } = useApp()
  const { setProfile, applyPreset, setHome, setCity, setUseRegimes } = useApp.getState()
  const { rates } = useFx()
  const { home } = useRows()
  const homeCountry = BY_ISO.get(homeIso)!
  const capital = profile.gains + profile.dividends + profile.interest
  const [showInvest, setShowInvest] = useState(capital > 0 || profile.salary === 0)
  const scale = rates[currency] ?? 1

  return (
    <aside className="panel flex flex-col gap-6 p-5 sm:p-6" aria-label="Your situation">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-white">Your situation</h2>
        <p className="mt-1 text-sm text-slate-400">Everything updates live. Amounts are annual and in {currency}.</p>
      </div>

      <section>
        <div className="label mb-2 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5" /> Start from a profile
        </div>
        <div className="grid grid-cols-2 gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                applyPreset(p, rates)
                setShowInvest(p.profile.gains + p.profile.dividends + p.profile.interest > 0)
              }}
              className={cx(
                'rounded-xl border px-3 py-2 text-left transition',
                activePreset === p.id ? 'border-cyan-400/60 bg-cyan-400/10' : 'border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/5',
              )}
            >
              <div className="text-sm font-medium text-slate-100">{p.label}</div>
              <div className="text-[11px] leading-snug text-slate-400">{p.blurb}</div>
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div className="label flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-home" /> Where you live now
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <CountryPicker label="Home country" value={homeIso} onSelect={setHome} />
          {homeCountry.cities.length > 1 && (
            <select
              aria-label="Home city"
              className="field w-36 cursor-pointer"
              value={cityByIso[homeIso] ?? 0}
              onChange={(e) => setCity(homeIso, Number(e.target.value))}
            >
              {homeCountry.cities.map((c, i) => (
                <option key={c.name} value={i}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
        </div>
        {homeCountry.citizenshipTaxation && (
          <div className="flex gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-xs leading-relaxed text-amber-100">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
            <span>
              US citizens and green-card holders stay taxable in the US wherever they live. Foreign earned income exclusion and tax credits reduce this, but
              low-tax destinations rarely eliminate US tax entirely.
            </span>
          </div>
        )}
      </section>

      <section className="space-y-2">
        <div className="label">Household</div>
        <Segmented<Household>
          label="Household"
          value={profile.household}
          onChange={(household) => setProfile({ household })}
          options={[
            { value: 'single', label: <><User className="h-4 w-4" /> Single</> },
            { value: 'couple', label: <><Users className="h-4 w-4" /> Couple</> },
            { value: 'family', label: <><Baby className="h-4 w-4" /> Family</> },
          ]}
        />
        <p className="text-xs text-slate-500">
          Housing costs use a city-centre {HOUSING_LABEL[profile.household]} rental. Taxes are estimated for a single filer.
        </p>
      </section>

      <section className="space-y-5">
        <MoneyInput
          label="Employment income"
          icon={<Briefcase className="h-4 w-4 text-slate-400" />}
          hint="Gross salary or self-employment income before tax and social contributions."
          value={profile.salary}
          onChange={(salary) => setProfile({ salary })}
          currency={currency}
          range={[10000 * scale, 3000000 * scale]}
        />

        <div className="rounded-xl border border-white/10 bg-white/[0.02]">
          <button
            className="flex w-full items-center justify-between px-3.5 py-3 text-left"
            aria-expanded={showInvest}
            onClick={() => setShowInvest((v) => !v)}
          >
            <span className="flex items-center gap-2 text-sm font-medium text-slate-200">
              <LineChart className="h-4 w-4 text-slate-400" /> Investments &amp; wealth
            </span>
            <span className="flex items-center gap-2 text-xs text-slate-400">
              {!showInvest && capital > 0 && <span className="tabular-nums">{money(capital, currency, { compact: true })} / yr</span>}
              <ChevronDown className={cx('h-4 w-4 transition', showInvest && 'rotate-180')} />
            </span>
          </button>
          {showInvest && (
            <div className="space-y-4 border-t border-white/10 px-3.5 pt-4 pb-4">
              <MoneyInput
                label="Capital gains"
                icon={<LineChart className="h-4 w-4 text-slate-500" />}
                hint="Long-term gains realised this year on shares, funds or crypto (held > 1 year). Property gains are not modelled."
                value={profile.gains}
                onChange={(gains) => setProfile({ gains })}
                currency={currency}
              />
              <div className="grid grid-cols-2 gap-3">
                <MoneyInput
                  label="Dividends"
                  icon={<PiggyBank className="h-4 w-4 text-slate-500" />}
                  value={profile.dividends}
                  onChange={(dividends) => setProfile({ dividends })}
                  currency={currency}
                />
                <MoneyInput
                  label="Interest"
                  icon={<Landmark className="h-4 w-4 text-slate-500" />}
                  value={profile.interest}
                  onChange={(interest) => setProfile({ interest })}
                  currency={currency}
                />
              </div>
              <MoneyInput
                label="Net worth"
                suffix="total"
                icon={<Wallet className="h-4 w-4 text-slate-500" />}
                hint="Used for wealth taxes (Spain, Switzerland, Norway, Netherlands Box 3, Colombia…). Exclude your main home."
                value={profile.netWorth}
                onChange={(netWorth) => setProfile({ netWorth })}
                currency={currency}
              />
            </div>
          )}
        </div>
      </section>

      <Toggle
        checked={useRegimes}
        onChange={setUseRegimes}
        label="Apply expat tax regimes when I'd qualify"
        description="Picks the cheapest eligible option per country — e.g. Spain's Beckham law, Portugal's IFICI, Italy's flat tax. Most need you to be a new resident."
      />

      <div className="rounded-xl bg-gradient-to-br from-amber-400/10 to-transparent p-4 ring-1 ring-amber-400/20">
        <div className="label text-amber-200/80">Your baseline · {home.city.name}</div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-2xl font-semibold text-white tabular-nums">{money(home.net, currency)}</span>
          <span className="text-sm text-slate-400">take-home / yr</span>
        </div>
        <div className="mt-1 text-xs text-slate-400 tabular-nums">
          {money(home.afterHousing, currency)} after rent · {Math.round(home.res.effectiveRate * 100)}% total tax
        </div>
      </div>
    </aside>
  )
}
