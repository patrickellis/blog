# Expat Compass

Vite + React 19 + TypeScript + Tailwind v4 single-page app comparing income, capital-gains and wealth taxes plus cost of living across expat destinations, with an interactive `react-globe.gl` globe.

## Commands

- `npm run dev` – dev server (http://localhost:5173)
- `npm test` – Vitest unit tests (tax engine + dataset integrity)
- `npm run typecheck` – `tsc -b`
- `npm run build` – typecheck + production build
- `npm run build:geo` – regenerates `src/data/geo/subdivisions.json` (Natural Earth admin-1 → TopoJSON via mapshaper; only needed when adding a split country)

Run `npm test && npm run build` before considering a change done.

## Layout

- `src/lib/tax.ts` – pure tax engine (`computeTax`, `evaluate` picks the cheapest eligible regime).
- `src/data/countries/*.ts` – per-region country data (tax systems in **local currency**, rents in **USD/month**, cost index NYC = 100). Helpers in `src/data/helpers.ts`.
- `src/data/countries/subdivisions/` – US states, Canadian provinces, Swiss cantons (generated from ESTV calculator samples) and Spanish autonomous communities.
- `src/data/countries/index.ts` – flattens countries into `DESTINATIONS` (`BY_ID`); `resolveId` maps a bare country code to its default subdivision.
- `src/state/store.ts` – zustand store, persisted to `localStorage` (`expat-compass:settings`). The URL stays clean: Share builds a `?h=…` link on demand (`shareUrl`), which is imported on load and then stripped from the address bar.
- `src/state/results.ts` – derives per-destination rows (display currency, deltas vs home) plus `byCountry` sibling groups for split countries.
- `src/components/globe/` – lazily loaded globe (`GlobeCanvas`) and its panel/overlays. Split countries are drawn from `subdivisions.json` instead of their atlas polygon.

## Destinations and subdivisions

- Everything in state/UI is keyed by **destination id**: ISO2 for whole countries, ISO 3166-2 (`CA-ON`, `US-TX`, `CH-ZG`, `ES-MD`) for subdivisions. `Destination.iso2` is always the country code (flags, grouping).
- A split country sets `subdivisionKind`, `subdivisions`, `defaultSubdivision`, `focusAltitude` and `cities: []`. Each `Subdivision` carries its own cities, `local` taxes (added to every city), `wealth`, optional `tax` overrides (Quebec abatement, Spanish foral systems) and `excludeRegimes`.
- Subdivision `code` must match a feature id in `subdivisions.json` (enforced by tests); regions without data (Ceuta, Melilla) are drawn as uncovered.
- Newcomer regimes never auto-apply anywhere in the home *country* (moving Ontario → Alberta isn't immigrating).

## Rendering

- Don't put `backdrop-blur` on large or numerous elements (e.g. the `panel` utility). Each one becomes its own blurred compositor layer, and with the continuously animating WebGL globe this starves raster and causes missing or late-drawn text. Keep it to small overlays (header, dropdowns, drawer).

## Data conventions

- Brackets are `[upperBound, rate]` with the last bound `Infinity` (enforced by tests).
- `num` must match the ISO 3166-1 numeric id used by `world-atlas/countries-110m.json`.
- `LocalTax.base`: `ordinary` (taxable income incl. ordinary capital), `allIncome` (salary + capital, with optional `gainsInclusion` for state gains exclusions), `salary` (city wage taxes, payroll levies), `gains`.
- `TaxSystem.wealthFloor` is a minimum wealth tax regional relief can't remove (Spain's solidarity tax).
- Mark tiny countries `micro: true` so they also get a clickable marker.
- Regimes whose eligibility depends on personal status (heritage, self-employment) must set `manualOnly: true`.
- The home country never auto-applies newcomer regimes (`regimeChoiceFor`).
- Rules reflect the 2025 tax year (`DATA_YEAR`); note announced changes in `notes`.
- Official links: `Regime.url` and `Country.sources` (`income`, `gains`, `dividends`, `wealth`, `inheritance`, `visas` keyed by the exact visa name). Only add government pages you've actually loaded; tests enforce https and matching visa names.

## UI notes

- "Tax system at a glance" cards (`TaxGlance.tsx`) derive their hover detail from the structured tax data, so new tax fields should be described there too. `HoverCard` (in `ui.tsx`) keeps its panel in DOM order but `position: fixed`, so don't add transforms to the drawer or its ancestors.
- A pinned globe destination docks as a full-height card on the right (`GlobePanel`, `DOCK_W`); below `COMPACT_W` it's a bottom sheet. The pinned id is passed to `GlobeCanvas` as `selected` and highlighted like a hover.

## Globe performance (`GlobeCanvas.tsx`)

Draw calls are the bottleneck (~55/frame; it was 7,500 at first). Keep it that way:
- Covered caps and outlines are each ONE merged mesh with per-vertex RGBA, recoloured in place. Only raised polygons (home/targets) go through three-globe's polygon layer.
- Uncovered land is painted into the globe texture; borders are one `LineSegments`.
- Hover/click use lat/lng point-in-polygon, not raycasting. Only the globe (analytic sphere) and markers are raycast.
- Pass globe.gl accessors with stable identities (module constants or `useMemo`). A new function makes it re-process the whole layer.
- Geometry is unwrapped across the antimeridian at load; anything that projects rings must handle longitudes beyond ±180°.
