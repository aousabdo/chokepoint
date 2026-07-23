# Chokepoint

**The Strait of Hormuz consequence engine** — not another live tanker map, but a public-data model
of what happens to the world's oil when the strait is disrupted: how much can bypass overland, who's
exposed, what the price shock is, and what history says happens next.

`chokepoint.analyticadss.com` · Analytica Data Science Solutions · sibling of Skywatch, Watchstander,
Drift, Crucible and Constellation.

## The product in one interaction

Drag **Hormuz disruption** from 0% to 100% and watch stranded barrels, exposed producers, the modeled
Brent shock band and the strategic-reserve runway recompute live — while the map reroutes flow into
the bypass pipelines and pools the stranded remainder red at the narrows.

The analytical spine is the **gross-vs-net gap**: headlines quote ~20.9 M b/d of gross throughput;
the honest damage number subtracts the overland escape valves (EIA's usable spare bypass ≈ 2.6 M b/d;
a post-2025-expansion upper bound of 5.5 is exposed as a switchable assumption).

## Architecture

Static, client-side, no backend, no login, no paid APIs. Zero build step: vanilla ES modules served
as-is (brief §9 allows Vite or vanilla; vanilla wins on reproducibility — the repo *is* the deploy
artifact). Deploys to GitHub Pages behind Cloudflare.

```
index.html            app shell (map · insights · methodology + scenario rail)
css/                  design tokens (§3), layout, components, print brief
src/model.js          the bypass-and-shock engine — pure, unit-tested
src/map.js            MapLibre GL operator map (Carto dark_matter, keyless)
src/insights.js       exposure board · event study · insurance ledger · escalation ladder
src/methodology.js    Skywatch-depth methodology, generated from the data so it can't drift
src/intro.js          "The Narrows" scrollytelling intro (?intro=skip to suppress)
src/state.js          URL-hash deep links — every view is shareable
src/tour.js           guided spotlight tour of the console
data/*.json           versioned dataset; every figure carries {source, url, retrieved, status}
data/geo/*.geojson    schematic strait lanes, pipelines, terminals, flows, shadow zones
vendor/               vendored basemap style (see Basemap resilience)
scripts/fetch.mjs     reproducible data pipeline + validator (build fails on unsourced figures)
tests/model.test.mjs  model unit tests (node --test)
```

## Run

```bash
npm run dev        # python3 http.server on :5173 (any static server works)
npm test           # model unit tests
npm run validate-data   # dataset validation — every figure must carry its source
EIA_API_KEY=... npm run fetch-data  # recompute Brent event-study windows exactly
```

## Data honesty

Provenance statuses used across the dataset and surfaced in the UI:
`verified` (checked against the named public source at build time) · `reported` (live-crisis public
reporting) · `estimate` · `illustrative` (model assumption) · `brief-baseline` (pending a fresh
primary-source check). If a figure is an estimate, it says so — that reproducibility is the brand.

## OG card

`og.png` (1200×630, referenced by the meta tags) is generated from `og.html` with headless Chrome:
`npm run og` (requires a static server running; pass a URL to override).

## Fully self-contained basemap

The map runs **entirely from this repository**: a Protomaps PMTiles extract of the Gulf
(`vendor/basemap.pmtiles`, OpenStreetMap data, open license, z0–10), the Protomaps black style,
Noto glyphs, sprites, and vendored MapLibre + pmtiles libraries. Zero external requests — the whole
site works from a copied directory in disconnected environments. Fallback chain if the PMTiles file
is stripped: vendored Carto style → remote Carto (note: Carto's free basemaps carry usage terms;
the offline Protomaps path is the licensed-for-anything default). Regenerate the extract with
`pmtiles extract` (see REFRESH.md).

Styles must be passed to MapLibre **as URLs, not parsed objects**: object styles load via a
requestAnimationFrame-deferred path, and rAF never fires in a backgrounded tab. For the same reason,
layer setup keys off `styledata` (network-callback driven), never the rAF-gated `load` event.

## Government-readiness

- **ACCESSIBILITY.md** — WCAG 2.1 AA conformance statement (axe-core: 0 violations; keyboard, motion,
  color redundancy, known canvas limitations documented).
- **REFRESH.md** — data-refresh runbook: daily crisis sweep, quarterly baselines, validator invariants.
- **docs/CAPABILITY.md** — capability statement; **briefs/** — pre-generated analyst briefs at
  40/90/100% (linked from the Methodology panel).

## Intended use

Decision-support for shipping, energy and policy analysis from 100% public data. No real-time vessel
positions, no navigational data, nothing that could serve as a targeting aid. Incident markers are
historical/reported at approximate positions; vessel-behavior content is pattern-level. See the
Methodology panel's "Intended use" note.
