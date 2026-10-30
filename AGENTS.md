# Expat Compass

Vite + React 19 + TypeScript + Tailwind v4 single-page app comparing income, capital-gains and wealth taxes plus cost of living across expat destinations, with an interactive `react-globe.gl` globe.

## Commands

- `npm run dev` – dev server (http://localhost:5173)
- `npm test` – Vitest unit tests (tax engine + dataset integrity)
- `npm run typecheck` – `tsc -b`
- `npm run build` – typecheck + production build

Run `npm test && npm run build` before considering a change done.

## Layout

- `src/lib/tax.ts` – pure tax engine (`computeTax`, `evaluate` picks the cheapest eligible regime).
- `src/data/countries/*.ts` – per-region country data (tax systems in **local currency**, rents in **USD/month**, cost index NYC = 100). Helpers in `src/data/helpers.ts`.
- `src/state/store.ts` – zustand store, synced to the URL query string for sharing.
- `src/state/results.ts` – derives per-country rows (display currency, deltas vs home).
- `src/components/globe/` – lazily loaded globe (`GlobeCanvas`) and its panel/overlays.

## Data conventions

- Brackets are `[upperBound, rate]` with the last bound `Infinity` (enforced by tests).
- `num` must match the ISO 3166-1 numeric id used by `world-atlas/countries-50m.json`.
- Mark tiny countries `micro: true` so they also get a clickable marker.
- Regimes whose eligibility depends on personal status (heritage, self-employment) must set `manualOnly: true`.
- The home country never auto-applies newcomer regimes (`regimeChoiceFor`).
- Rules reflect the 2025 tax year (`DATA_YEAR`); note announced changes in `notes`.
