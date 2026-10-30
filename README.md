# patrickellis.dev

Currently hosts **Expat Compass** — compare take-home pay, capital gains, dividend and wealth taxes and cost of living across expat destinations (Vite + React + TypeScript, interactive globe).

- `npm run dev` – local dev server
- `npm test` – unit tests
- `npm run build` – production build into `dist/`

Pushing to `main` deploys via Cloud Build (`cloudbuild.yaml`): test → build → sync `dist/` to GCS → invalidate CDN.

Previous sites are kept in `archive/`: `archive/tft` (TFT Personal Tutor) and `archive/blog` (the original Astro blog).
