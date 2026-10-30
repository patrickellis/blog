import { Check, Compass, Link2 } from 'lucide-react'
import { useState } from 'react'
import { DATA_YEAR } from '../data/countries'
import { DISPLAY_CURRENCIES } from '../data/fx'
import { useFx } from '../state/fx-context'
import { useApp } from '../state/store'

const NAV = [
  ['#explore', 'Explore'],
  ['#compare', 'Compare'],
  ['#rankings', 'Rankings'],
  ['#method', 'Method'],
] as const

export function Header() {
  const currency = useApp((s) => s.currency)
  const setCurrency = useApp((s) => s.setCurrency)
  const fx = useFx()
  const [copied, setCopied] = useState(false)

  const share = async () => {
    await navigator.clipboard?.writeText(location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  return (
    <header className="sticky top-0 z-30 border-b border-white/5 bg-ink-950/75 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-4 px-4 sm:px-6">
        <a href="#" className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-cyan-400/30 to-amber-400/20 ring-1 ring-white/15">
            <Compass className="h-5 w-5 text-cyan-300" />
          </span>
          <span className="leading-tight">
            <span className="block font-semibold tracking-tight text-white">Expat Compass</span>
            <span className="hidden text-[11px] text-slate-400 sm:block">Income &amp; wealth taxes, worldwide</span>
          </span>
        </a>

        <nav className="ml-6 hidden items-center gap-1 md:flex" aria-label="Sections">
          {NAV.map(([href, label]) => (
            <a key={href} href={href} className="btn-ghost">
              {label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <span
            className="hidden items-center gap-1.5 text-xs text-slate-400 lg:flex"
            title={fx.live ? `Live FX rates, updated ${fx.updated ?? ''}` : 'Using built-in fallback FX rates'}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${fx.live ? 'bg-emerald-400' : 'bg-amber-400'}`} />
            {fx.live ? 'Live FX' : 'Offline FX'} · {DATA_YEAR} tax rules
          </span>
          <label className="sr-only" htmlFor="currency">
            Display currency
          </label>
          <select
            id="currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value, fx.rates)}
            className="field w-auto cursor-pointer py-1.5 pr-8 font-medium"
          >
            {DISPLAY_CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <button onClick={share} className="btn-outline" aria-live="polite">
            {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Link2 className="h-4 w-4" />}
            <span className="hidden sm:inline">{copied ? 'Link copied' : 'Share'}</span>
          </button>
        </div>
      </div>
    </header>
  )
}
