import { COUNTRIES, DATA_YEAR, DESTINATIONS } from '../data/countries'

const REGION_COUNT = DESTINATIONS.filter((d) => d.subdivision).length

const ITEMS: [string, string[]][] = [
  [
    'What’s modelled',
    [
      'Progressive income tax, employee social contributions (with caps), surcharges and tax credits, plus city income and payroll taxes where listed.',
      `Every US state, Canadian province/territory, Swiss canton and Spanish autonomous community (${REGION_COUNT} in total) is its own destination with its own income and wealth taxes — including Quebec’s separate system and the Basque/Navarre foral regimes. Swiss cantonal figures are calibrated to the official ESTV calculator for each canton’s main city.`,
      'Capital gains, dividends and interest — flat, progressive, stacked (US/UK) or pooled schedules (Spain, Germany, Denmark…), plus NIIT-style surtaxes.',
      'Wealth taxes, Netherlands Box 3 deemed returns, New Zealand FIF and Colombian/Norwegian/Spanish/Swiss net-wealth taxes.',
      'Special regimes for newcomers (Beckham, IFICI, 30% ruling, Italian & Greek flat taxes, UK FIG, Swiss forfait and more) — the cheapest eligible one is picked unless you choose otherwise.',
    ],
  ],
  [
    'Key assumptions',
    [
      `Rules reflect the ${DATA_YEAR} tax year (with some announced changes noted). Single filer, no dependants for tax purposes.`,
      'Capital gains are long-term gains on listed securities. In territorial or regime cases, investment income is assumed to be foreign-source and kept offshore where that matters.',
      'Rents are typical city-centre asking rents. The everyday cost index excludes rent and is relative to New York (= 100).',
      'Exchange rates are fetched live (open.er-api.com) with built-in fallbacks.',
    ],
  ],
  [
    'Not included',
    [
      'Employer-side costs, pension/retirement contributions beyond mandatory social security, church tax, tax treaties and foreign tax credits.',
      'Property, crypto-specific and business taxes, VAT/consumption taxes, healthcare premiums and school fees.',
      'Citizenship-based taxation (e.g. US citizens abroad) is flagged but not calculated.',
    ],
  ],
]

export function Methodology() {
  return (
    <section id="method" className="panel p-6 sm:p-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-2xl font-semibold tracking-tight text-white">Methodology</h2>
        <span className="text-sm text-slate-400">
          {COUNTRIES.length} countries · {REGION_COUNT} states, provinces &amp; regions · {DESTINATIONS.reduce((s, d) => s + d.cities.length, 0)} cities ·{' '}
          {COUNTRIES.reduce((s, c) => s + (c.regimes?.length ?? 0), 0)} special regimes
        </span>
      </div>
      <div className="mt-6 grid gap-8 md:grid-cols-3">
        {ITEMS.map(([title, points]) => (
          <div key={title}>
            <h3 className="label mb-3">{title}</h3>
            <ul className="space-y-2.5 text-sm leading-relaxed text-slate-300">
              {points.map((p) => (
                <li key={p} className="flex gap-2">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-cyan-400" />
                  {p}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="mt-8 rounded-xl bg-amber-400/5 p-4 text-xs leading-relaxed text-amber-100/80 ring-1 ring-amber-400/20">
        Expat Compass gives indicative estimates to help you shortlist destinations. Tax law changes frequently and individual circumstances matter enormously — confirm
        with a qualified cross-border tax adviser before making any decision.
      </p>
    </section>
  )
}
