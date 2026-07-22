# Data refresh runbook — Chokepoint

Every figure ships with `{source, url, retrieved, status}`. This runbook keeps those honest.
The site is static: refreshing data = edit JSON → validate → `git push` (Pages redeploys).

## Daily (while the crisis is live)

```bash
npm run fetch-data      # recomputes Brent event-study windows from the public daily series
                        # (EIA API if EIA_API_KEY is set; FRED mirror DCOILBRENTEU otherwise)
npm test                # 26 model tests
npm run smoke           # E2E: boots the real site headless, asserts rendered readouts
                        # match the model — run before any demo or deploy
```

Note: the service worker (sw.js) gives visitors full offline after first visit; normal data
deploys self-heal via revalidation, but bump `VERSION` in sw.js on breaking asset changes.

Then sweep the `reported` figures against current reporting and update values + `retrieved`:

| Figure | File | Watch for |
|---|---|---|
| `current_reported_disruption` | data/config.json | transit-count reporting; also update the "Current reported" preset (index.html) and OG card if it moves |
| Insurance ledger latest point | data/insurance.json | new JWC circulars, broker quotes |
| Ship queue (`floating.ships`) | data/voyage.json | ships-holding counts |
| 2026 ladder entries | data/events.json | new events get new rows — a ceasefire just adds a row |
| Reopening mined-corridor anchor | data/reopening.json | mine counts, clearance progress |

## Quarterly (or when EIA/IEA publish updates)

- `hormuz_throughput_mbd`, bypass profiles, pipeline capacities — EIA WOTC updates
- Producer origin shares (data/producers.json), importer destinations (data/importers.json) — EIA WOTC
- `global_liquids_mbd` — EIA STEO; `opec_spare_mbd` — STEO
- Stocks per importer — IEA/ISPRL/DOE disclosures
- LNG volumes and buyer split — GIIGNL annual report

## Regeneration commands

```bash
npm run validate-data                 # build fails on any unsourced figure — run after every edit
npm run og                            # OG card (needs the dev server: npm run dev)
node scripts/make-intro-geo.mjs       # intro coastline from Natural Earth
scripts/og.sh <url>                   # OG from a non-default server
# offline basemap (rarely needed — geography doesn't move):
#   pmtiles extract https://build.protomaps.com/<latest>.pmtiles vendor/basemap.pmtiles --bbox=34,17,66,34 --maxzoom=10
# brief pack: regenerate briefs/*.pdf via headless Chrome (see README)
```

## Invariants the validator enforces (do not break)

- Importer volumes sum to Hormuz throughput → importer losses sum to stranded barrels
- LNG buyer split sums to the Hormuz LNG total
- Bypass profile per-pipeline spares sum to the profile total
- Exactly one chokepoint lacks a sea alternative, and it is Hormuz
- Every figure carries source, url, retrieved date and status
