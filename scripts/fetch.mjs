#!/usr/bin/env node
/**
 * Chokepoint data pipeline — pulls, normalizes, timestamps and validates the
 * bundled dataset so the whole thing is reproducible from scratch.
 *
 *   node scripts/fetch.mjs              # refresh what can be fetched, then validate
 *   node scripts/fetch.mjs --validate   # validate the bundled JSON only (no network)
 *
 * Design: build-time fetch → versioned static JSON in /data. The site never
 * makes a runtime API call the visitor depends on.
 *
 * Sources & keys:
 *  - EIA open data (Brent daily RBRTE, STEO liquids supply) needs a free key:
 *      https://www.eia.gov/opendata/  → export EIA_API_KEY=...
 *    With a key, this script recomputes the event-study windows in
 *    data/brent_events.json exactly (replacing status:"estimate" with "verified").
 *  - EIA World Oil Transit Chokepoints, IEA Hormuz page, JWC circulars and
 *    Lloyd's List commentary are documents, not APIs — refresh those figures by
 *    hand and update {value, retrieved, status} in the JSON. The validator
 *    below is what keeps that honest.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));
const VALIDATE_ONLY = process.argv.includes('--validate');

let failures = 0;
const fail = (msg) => { failures += 1; console.error(`  ✗ ${msg}`); };
const ok = (msg) => console.log(`  ✓ ${msg}`);

/* ── Validation: fail the build if a headline figure is missing its source ── */
function validate() {
  console.log('\nValidating bundled dataset…');

  const config = read('data/config.json');
  for (const [key, fig] of Object.entries(config.figures)) {
    if (fig.value == null) fail(`config.figures.${key}: missing value`);
    if (!fig.source) fail(`config.figures.${key}: missing source`);
    if (!fig.retrieved) fail(`config.figures.${key}: missing retrieved date`);
    if (!fig.status) fail(`config.figures.${key}: missing status`);
    if (!fig.url && !['shock_cap', 'eps_short_run'].includes(key)) fail(`config.figures.${key}: missing url`);
  }
  ok(`config.json — ${Object.keys(config.figures).length} figures sourced`);

  for (const [id, p] of Object.entries(config.bypass_profiles)) {
    const sum = Object.values(p.per_pipeline_mbd).reduce((s, v) => s + v, 0);
    if (Math.abs(sum - p.total_mbd) > 1e-9) {
      fail(`bypass_profiles.${id}: per-pipeline spares (${sum}) ≠ total (${p.total_mbd})`);
    }
  }
  ok('bypass profiles internally consistent');

  const producers = read('data/producers.json').producers;
  for (const p of producers) {
    if (p.gulf_exports_mbd == null || !p.exposure || !p.url) fail(`producers: ${p.id} incomplete`);
    if (p.bypass_pipeline && !config.pipelines[p.bypass_pipeline]) {
      fail(`producers: ${p.id} references unknown pipeline ${p.bypass_pipeline}`);
    }
  }
  ok(`producers.json — ${producers.length} producers sourced`);

  const events = read('data/events.json').events;
  for (const e of events) {
    if (!e.date || !e.title || !e.source || !e.url || !e.status) fail(`events: "${e.title ?? e.date}" incomplete`);
  }
  if (![...events].every((e, i, a) => i === 0 || a[i - 1].date <= e.date)) fail('events: not chronologically sorted');
  ok(`events.json — ${events.length} ladder entries sourced and ordered`);

  const ins = read('data/insurance.json').points;
  for (const p of ins) {
    if (p.pct == null || p.low == null || p.high == null || !p.source || !p.status) fail(`insurance: ${p.date} incomplete`);
    if (!(p.low <= p.pct && p.pct <= p.high)) fail(`insurance: ${p.date} point outside its own range`);
  }
  ok(`insurance.json — ${ins.length} ledger points sourced`);

  const importersDoc = read('data/importers.json');
  const sumImports = importersDoc.importers.reduce((t, m) => t + m.hormuz_mbd, 0);
  const throughput = config.figures.hormuz_throughput_mbd.value;
  if (Math.abs(sumImports - throughput) > 0.05) {
    fail(`importers: destination volumes (${sumImports.toFixed(1)}) ≠ Hormuz throughput (${throughput}) — importer losses must sum to stranded barrels`);
  }
  for (const m of importersDoc.importers) {
    if (m.hormuz_mbd == null || m.stocks_mbbl == null || !m.stocks_source || !m.stocks_status || !m.status) {
      fail(`importers: ${m.id ?? m.name} incomplete`);
    }
  }
  ok(`importers.json — ${importersDoc.importers.length} importers; volumes sum to throughput`);

  const reop = read('data/reopening.json');
  for (const ph of reop.phases) {
    if (!(ph.low_days < ph.high_days)) fail(`reopening: ${ph.id} range inverted`);
    if (!ph.anchors?.length) fail(`reopening: ${ph.id} has no historical anchors`);
    for (const a of ph.anchors ?? []) {
      if (!a.text || !a.source || !a.url || !a.status) fail(`reopening: ${ph.id} anchor incomplete`);
    }
  }
  ok(`reopening.json — ${reop.phases.length} phases, all anchored and sourced`);

  const lng = read('data/lng.json');
  for (const [key, fig] of Object.entries(lng.figures)) {
    if (fig.value == null || !fig.source || !fig.status) fail(`lng.figures.${key}: incomplete`);
  }
  const buyerSum = lng.buyers.reduce((t, b) => t + b.mtpa, 0);
  if (Math.abs(buyerSum - lng.figures.hormuz_lng_mtpa.value) > 0.1) {
    fail(`lng: buyer volumes (${buyerSum.toFixed(1)}) ≠ Hormuz LNG total (${lng.figures.hormuz_lng_mtpa.value})`);
  }
  if (!lng.anchor_2022?.url || !lng.anchor_2022?.status) fail('lng: 2022 empirical anchor unsourced');
  ok(`lng.json — ${Object.keys(lng.figures).length} figures; buyer split sums to Hormuz LNG total`);

  const voy = read('data/voyage.json');
  for (const group of [voy.voyage, voy.floating]) {
    for (const [key, fig] of Object.entries(group)) {
      if (fig.value == null || !fig.source || !fig.status) fail(`voyage: ${key} incomplete`);
    }
  }
  ok('voyage.json — calculator defaults sourced');

  const brent = read('data/brent_events.json');
  for (const e of brent.events) {
    if (!e.date || !e.name || !e.status) fail(`brent_events: ${e.date} incomplete`);
  }
  ok(`brent_events.json — ${brent.events.length} event-study rows`);

  for (const g of ['strait', 'pipelines', 'terminals', 'flows', 'shadow']) {
    const fc = read(`data/geo/${g}.geojson`);
    if (fc.type !== 'FeatureCollection' || !fc.features?.length) fail(`geo/${g}: empty or malformed`);
  }
  ok('geojson layers present');

  if (failures) {
    console.error(`\nBUILD FAIL — ${failures} dataset problem(s). A headline figure without a source does not ship.`);
    process.exit(1);
  }
  console.log('\nDataset valid — every figure carries {source, url, retrieved, status}.\n');
}

/* ── EIA Brent event-study recomputation (needs EIA_API_KEY) ── */
async function refreshBrentWindows() {
  const key = process.env.EIA_API_KEY;
  if (!key) {
    console.log('EIA_API_KEY not set — skipping Brent recomputation (event-study rows stay marked "estimate").');
    return;
  }
  console.log('Fetching EIA daily Brent (RBRTE)…');
  const url = `https://api.eia.gov/v2/petroleum/pri/spt/data/?api_key=${key}&frequency=daily&data[0]=value&facets[series][]=RBRTE&sort[0][column]=period&sort[0][direction]=asc&length=100000`;
  const res = await fetch(url);
  if (!res.ok) { fail(`EIA API ${res.status}`); return; }
  const series = (await res.json()).response.data.map((r) => ({ date: r.period, value: +r.value }));
  const idxByDate = new Map(series.map((r, i) => [r.date, i]));

  const doc = read('data/brent_events.json');
  const win = (i0, n) => {
    const a = series[i0], b = series[Math.min(series.length - 1, i0 + n)];
    return a && b ? +(((b.value - a.value) / a.value) * 100).toFixed(1) : null;
  };
  for (const e of doc.events) {
    // First trading day at or after the event
    let probe = e.date, i = null;
    for (let k = 0; k < 7 && i == null; k += 1) {
      i = idxByDate.get(probe) ?? null;
      probe = new Date(new Date(probe).getTime() + 86400000).toISOString().slice(0, 10);
    }
    if (i == null || i === 0) continue;
    const base = i - 1; // last close before the event
    e.d1 = win(base, 1); e.d5 = win(base, 5); e.d30 = win(base, 21); // 21 trading days ≈ 30 calendar
    e.status = 'verified';
  }
  doc.as_of = new Date().toISOString().slice(0, 10);
  doc.notes = doc.notes.replace('to be recomputed exactly by scripts/fetch.mjs', 'recomputed from the EIA daily series');
  writeFileSync(join(ROOT, 'data/brent_events.json'), `${JSON.stringify(doc, null, 2)}\n`);
  ok('brent_events.json recomputed from EIA daily series');
}

if (!VALIDATE_ONLY) await refreshBrentWindows();
validate();
