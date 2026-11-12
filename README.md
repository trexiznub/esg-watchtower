# ESG Watchtower

**See the risks. Understand the impact. Stay ahead.**

ESG news intelligence and corporate controversy monitoring. This repository is the **static frontend**: React + Vite + TypeScript, built for GitHub Pages. It holds no credentials. News discovery, AI classification and database storage are reached through one configurable backend API; when that backend is absent or unreachable the app runs in **demo mode** with clearly labelled synthetic data.

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build in dist/
npm run preview    # serve dist/ locally
npm run typecheck  # TypeScript check (not part of the build)
```

Node 18 or newer. After the first `npm install`, commit the generated `package-lock.json` so CI installs reproducibly.

## Deploy to GitHub Pages

1. Create a GitHub repository and push this project to the `main` branch.
2. In the repository, open **Settings → Pages** and set **Source** to **GitHub Actions**.
3. Push to `main` (or run the workflow manually from the **Actions** tab). `.github/workflows/deploy.yml` installs, builds and publishes `dist/`.
4. The site is served at `https://<user>.github.io/<repo>/`.

Optional, to connect a backend: **Settings → Secrets and variables → Actions → Variables** and add `VITE_API_BASE_URL`. Use *Variables*, not *Secrets*: every `VITE_` value ends up in public JavaScript.

### Base path

GitHub Pages serves a project site from `/<repo>/`, so asset URLs need that prefix. `vite.config.ts` sets it automatically:

| Situation | Base used |
|---|---|
| Built in GitHub Actions for `user/my-repo` | `/my-repo/` (read from `GITHUB_REPOSITORY`) |
| Repository named `user.github.io` | `/` |
| Local `npm run dev` / `npm run build` | `/` |
| `VITE_BASE` is set | that value (use `/` for a custom domain) |

To build locally for a project site: `VITE_BASE=/my-repo/ npm run build`.

### Routing

The app uses `HashRouter`. URLs look like `https://<user>.github.io/<repo>/#/tracker`. GitHub Pages only ever serves `index.html`, so reloads and deep links work at any repository path with no `404.html` workaround.

| Route | Page |
|---|---|
| `#/` | Landing page |
| `#/overview` | Executive overview |
| `#/watchlist` | Company watchlist |
| `#/news` | News intelligence |
| `#/risk` | ESG risk analysis |
| `#/tracker` | Controversy tracker |
| `#/analytics` | Analytics and reports |
| `#/digest` | Weekly digest |
| `#/settings` | Settings |

## Configuration

Copy `.env.example` to `.env.local` for local development.

| Variable | Purpose |
|---|---|
| `VITE_API_BASE_URL` | Base URL of your backend. Empty means demo mode. |
| `VITE_DEMO_MODE` | `true` forces demo mode even when a backend URL is set. |
| `VITE_API_WITH_CREDENTIALS` | `true` sends cookies with API requests (cookie sessions). |
| `VITE_API_TIMEOUT_MS` | Request timeout, default 12000. |
| `VITE_BASE` | Overrides the Vite base path (build time only). |

**Never put an API key, a Supabase service-role key or an AI provider key in a `VITE_` variable or anywhere in this repository.** Those belong in the backend's environment.

## Demo mode and live mode

At start-up the app calls `GET /health` on the configured backend.

| | Demo mode | Live mode |
|---|---|---|
| When | No backend URL, forced, or backend unreachable | Backend answers the health check |
| News | Synthetic scenarios, each prefixed "Demo:" and tagged DEMO, no source URL | Records returned by `POST /news/discover`, tagged LIVE |
| Article analysis | Keyword rules, labelled "Rule classified" | AI service through `POST /ai/classify` |
| Storage | `localStorage` in the browser | `GET`/`PUT /workspace`, cached in `localStorage` |
| Digest summary | Computed from the figures | Optional AI draft through `POST /ai/summarise` |

If a live request fails, the app falls back to demo mode and says so on screen. Company reference details (name, ticker, industry, headquarters) are real in both modes; demo incidents are not real events.

## Backend

A ready-to-deploy Supabase backend is in [`backend/`](backend/README.md): database schema, an hourly news collector (GDELT + RSS) with Claude classification, and the API this site calls. It is separate from the Pages build and deployed with the Supabase CLI. Follow `backend/README.md`, then set `VITE_API_BASE_URL`.

## API service layer

`src/services/api.ts` defines one interface, `ApiProvider`, with two implementations:

- `remoteProvider` calls your backend with `fetch`, a timeout and input validation. Backend records are treated as untrusted: malformed ones are dropped and severity is recomputed locally.
- `demoProvider` serves the same interface with no network access.

The JSON shapes the backend must return are in [`docs/api-contract.md`](docs/api-contract.md). The reference implementation is in `backend/`; any service that returns the same shapes works. It must allow CORS for your Pages origin, authenticate users, and keep all keys server-side.

## Project structure

```
.github/workflows/deploy.yml   GitHub Pages deployment
backend/                       Supabase schema and Edge Functions (deployed separately)
docs/api-contract.md           Backend endpoints and JSON shapes
index.html                     Vite entry
vite.config.ts                 Base path logic
src/
  main.tsx, App.tsx            Entry and HashRouter routes
  styles.css                   Design tokens and all styles (dark and light)
  lib/                         Types, scoring model, demo generator, analytics, SVG charts
  services/api.ts              Configurable API layer (remote + demo)
  services/exporter.ts         CSV, HTML and PDF exports
  state/store.tsx              Workspace state, mode switching, persistence
  components/                  Shell, overlays, shared UI and chart components
  pages/                       One file per route
```

## Scoring

Article severity (0–100) is a weighted sum of seven factors multiplied by an evidence-stage factor, so an allegation scores lower than a confirmed violation with the same facts. Company risk scores decay each incident with a 45-day half-life. The weights and formulas are shown in the app under **Settings → Scoring model** and defined in `src/lib/model.ts`.

## Notes on libraries

Charts are dependency-free SVG and animations are CSS, which keeps the bundle small; styles are plain CSS with design tokens. Recharts, Framer Motion or Tailwind can be added later without changing the data or service layers. Runtime dependencies are `react`, `react-dom`, `react-router-dom` and `jspdf` (loaded on demand for the PDF export).

---

© 2026 Ujwal Raj K.P. All Rights Reserved.
Designed & Developed by Ujwal Raj K.P.
