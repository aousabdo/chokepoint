/** Unit tests for the bypass-and-shock model — run with `npm test` (node --test). */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  stranded, strandedShare, shockBand, sprDays, producerExposure, bypassUse, scenario,
  importerExposure, impliedLossOdds, sprRealism, lngShock, voyageEconomics, floatingStorage,
  pricePath, macroPassThrough,
} from '../src/model.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(readFileSync(join(root, 'data/config.json'), 'utf8'));
const producers = JSON.parse(readFileSync(join(root, 'data/producers.json'), 'utf8')).producers;
const importers = JSON.parse(readFileSync(join(root, 'data/importers.json'), 'utf8')).importers;
const lng = JSON.parse(readFileSync(join(root, 'data/lng.json'), 'utf8'));

const THROUGHPUT = config.figures.hormuz_throughput_mbd.value; // 20.9
const SPARE = config.bypass_profiles.eia.total_mbd;            // 2.6
const GLOBAL = config.figures.global_liquids_mbd.value;        // 103
const totals = { throughput: THROUGHPUT, spareBypass: SPARE };

test('d=0: nothing disrupted, nothing stranded, infinite SPR runway', () => {
  const s = stranded(0, totals);
  assert.equal(s.gross, 0);
  assert.equal(s.stranded, 0);
  assert.equal(sprDays(s.stranded, 1200), Infinity);
});

test('small disruptions are fully absorbed by bypass — the gross-vs-net gap', () => {
  // 10% of 20.9 = 2.09 M b/d gross, under the 2.6 spare → zero stranded
  const s = stranded(0.1, totals);
  assert.ok(s.gross > 2);
  assert.equal(s.stranded, 0);
  assert.equal(s.bypass, s.gross);
});

test('full closure: stranded = throughput − spare bypass', () => {
  const s = stranded(1, totals);
  assert.ok(Math.abs(s.stranded - (THROUGHPUT - SPARE)) < 1e-9); // 18.3
  assert.equal(s.bypass, SPARE);
});

test('stranded is monotonically non-decreasing in d', () => {
  let prev = -1;
  for (let d = 0; d <= 1.001; d += 0.05) {
    const s = stranded(d, totals);
    assert.ok(s.stranded >= prev - 1e-12);
    prev = s.stranded;
  }
});

test('d is clamped to [0,1]', () => {
  assert.equal(stranded(-0.5, totals).gross, 0);
  assert.equal(stranded(1.7, totals).gross, THROUGHPUT);
});

test('stranded share of global supply at full closure ≈ 17.8%', () => {
  const s = stranded(1, totals);
  const share = strandedShare(s.stranded, GLOBAL);
  assert.ok(Math.abs(share - (THROUGHPUT - SPARE) / GLOBAL) < 1e-12);
  assert.ok(share > 0.15 && share < 0.2);
});

test('shock band: lo ≤ point ≤ hi, and capping engages', () => {
  const b = shockBand(0.10, { epsLo: 0.08, epsHi: 0.15, eps: 0.11, cap: 3.0 });
  assert.ok(b.lo <= b.point && b.point <= b.hi);
  assert.ok(Math.abs(b.lo - 0.10 / 0.15) < 1e-12);
  assert.ok(Math.abs(b.hi - 0.10 / 0.08) < 1e-12);
  const capped = shockBand(0.5, { epsLo: 0.08, epsHi: 0.15, cap: 3.0 });
  assert.equal(capped.hi, 3.0);
  assert.ok(capped.capped);
});

test('SPR runway: 1200 M bbl over 18.3 M b/d ≈ 65–66 days', () => {
  const days = sprDays(THROUGHPUT - SPARE, 1200);
  assert.ok(days > 64 && days < 67);
});

test('producer exposure: no-bypass producers strand everything at full closure', () => {
  const perPipe = config.bypass_profiles.eia.per_pipeline_mbd;
  const exp = producerExposure(1, producers, perPipe);
  const kuwait = exp.find((p) => p.id === 'kwt');
  const qatar = exp.find((p) => p.id === 'qat');
  assert.equal(kuwait.stranded, kuwait.gulf_exports_mbd);
  assert.equal(qatar.stranded, qatar.gulf_exports_mbd);
  assert.equal(qatar.escaped, 0);
});

test('producer exposure: bypass producers escape up to their pipeline spare', () => {
  const perPipe = config.bypass_profiles.eia.per_pipeline_mbd;
  const exp = producerExposure(1, producers, perPipe);
  const saudi = exp.find((p) => p.id === 'sau');
  assert.equal(saudi.escaped, perPipe.petroline);
  assert.ok(Math.abs(saudi.stranded - (saudi.gulf_exports_mbd - perPipe.petroline)) < 1e-12);
  // Sorted most-stranded first
  assert.ok(exp[0].stranded >= exp[exp.length - 1].stranded);
});

test('bypass utilisation splits pro-rata and never exceeds spare', () => {
  const perPipe = config.bypass_profiles.eia.per_pipeline_mbd;
  const use = bypassUse(1, totals, perPipe);
  const total = Object.values(use).reduce((s, u) => s + u.used, 0);
  assert.ok(Math.abs(total - SPARE) < 1e-9);
  for (const u of Object.values(use)) assert.ok(u.used <= u.spare + 1e-9);
});

test('expanded bypass profile strands less than the conservative one', () => {
  const a = scenario(100, config, producers, 'eia');
  const b = scenario(100, config, producers, 'expanded');
  assert.ok(b.stranded < a.stranded);
  assert.ok(b.shock.hi <= a.shock.hi);
});

test('scenario() returns a coherent bundle for the UI', () => {
  const sc = scenario(70, config, producers, 'eia', 0.11, importers);
  assert.ok(sc.gross > sc.stranded);
  assert.ok(sc.share > 0 && sc.share < 1);
  assert.ok(Number.isFinite(sc.sprDays));
  assert.equal(sc.exposure.length, producers.length);
  assert.equal(sc.importers.length, importers.length);
  assert.ok(sc.sprReal.offset > 0);
  assert.ok(sc.shock.point > 0);
});

test('importer volumes sum to Hormuz throughput — the data invariant', () => {
  const sum = importers.reduce((t, m) => t + m.hormuz_mbd, 0);
  assert.ok(Math.abs(sum - THROUGHPUT) < 0.05);
});

test('importer losses sum exactly to total stranded barrels', () => {
  for (const d of [0.25, 0.7, 1]) {
    const s = stranded(d, totals);
    const exp = importerExposure(d, importers, s);
    const totalLoss = exp.reduce((t, m) => t + m.loss, 0);
    assert.ok(Math.abs(totalLoss - s.stranded) < 1e-9);
  }
});

test('importer exposure: zero disruption → zero loss, infinite cover', () => {
  const exp = importerExposure(0, importers, stranded(0, totals));
  for (const m of exp) {
    assert.equal(m.loss, 0);
    assert.equal(m.daysCover, Infinity);
  }
});

test('importer exposure sorts shortest cover first; China ~85 days at full closure', () => {
  const exp = importerExposure(1, importers, stranded(1, totals));
  for (let i = 1; i < exp.length; i += 1) assert.ok(exp[i - 1].daysCover <= exp[i].daysCover);
  const china = exp.find((m) => m.id === 'chn');
  assert.ok(china.daysCover > 80 && china.daysCover < 90);
});

test('implied loss odds: 4% of hull → 1-in-25; halved severity doubles the probability', () => {
  const o = impliedLossOdds(4);
  assert.ok(Math.abs(o.oneIn - 25) < 1e-9);
  assert.ok(Math.abs(impliedLossOdds(4, 0.5).p - o.p * 2) < 1e-12);
});

test('LNG shock: no bypass, so losses are linear in d; multiplier band ordered and capped', () => {
  const zero = lngShock(0, lng);
  assert.equal(zero.lostMtpa, 0);
  assert.ok(Math.abs(zero.mult.lo - 1) < 1e-12 && Math.abs(zero.mult.hi - 1) < 1e-12);
  const full = lngShock(1, lng);
  assert.equal(full.lostMtpa, lng.figures.hormuz_lng_mtpa.value); // 82.6 — nothing escapes
  assert.ok(full.shareTrade > 0.20 && full.shareTrade < 0.21);    // ≈ a fifth of global trade
  assert.ok(full.mult.lo > 3.5 && full.mult.lo < full.mult.hi && full.mult.hi < 6.3);
  const half = lngShock(0.5, lng);
  assert.ok(Math.abs(half.lostMtpa * 2 - full.lostMtpa) < 1e-9);
});

test('voyage economics: hull × premium vs cargo × freight', () => {
  const ve = voyageEconomics({ hullM: 150, cargoMbbl: 2, freightPerBbl: 4, premiumPct: 5 });
  assert.ok(Math.abs(ve.insuranceM - 7.5) < 1e-12);
  assert.ok(Math.abs(ve.insPerBbl - 3.75) < 1e-12);
  assert.ok(Math.abs(ve.freightM - 8) < 1e-12);
  assert.ok(ve.share > 0.9 && ve.share < 1);           // marginal: underwriter decides
  const calm = voyageEconomics({ hullM: 120, cargoMbbl: 2, freightPerBbl: 4, premiumPct: 0.25 });
  assert.ok(calm.share < 0.05);                        // pre-crisis: a rounding error
});

test('floating storage: ships × cargo against world demand', () => {
  const fs = floatingStorage(150, 1.0, 103);
  assert.equal(fs.mbbl, 150);
  assert.ok(fs.daysGlobal > 1.4 && fs.daysGlobal < 1.5);
});

test('price path: starts at the shock band, decays monotonically, converges to the siege premium', () => {
  const share = 0.178; // ≈ full closure
  const opts = { epsLo: 0.08, epsHi: 0.15, epsLong: 0.35, tauMonths: 6, cap: 3.0, months: 24, step: 0.5 };
  const pts = pricePath(share, opts);
  // t=0 equals the static shock band
  assert.ok(Math.abs(pts[0].hi - share / 0.08) < 1e-9);
  assert.ok(Math.abs(pts[0].lo - share / 0.15) < 1e-9);
  // monotone decreasing, band ordered
  for (let i = 1; i < pts.length; i += 1) {
    assert.ok(pts[i].hi <= pts[i - 1].hi + 1e-12);
    assert.ok(pts[i].lo <= pts[i].hi);
  }
  // converges toward share/eps_longrun
  const last = pts[pts.length - 1];
  const asym = share / 0.35;
  assert.ok(Math.abs(last.hi - asym) / asym < 0.06);
  assert.ok(Math.abs(last.lo - asym) / asym < 0.06);
});

test('price path: cap engages at extreme shares', () => {
  const pts = pricePath(0.5, { epsLo: 0.08, epsHi: 0.15, cap: 3.0 });
  assert.equal(pts[0].hi, 3.0);
});

test('macro pass-through: +10% oil coefficients applied to the band ends', () => {
  const m = macroPassThrough({ lo: 0.78, hi: 1.46 }, { cpi: [0.2, 0.4], gdp: [0.1, 0.2] });
  assert.ok(Math.abs(m.cpi.lo - 1.56) < 1e-9);
  assert.ok(Math.abs(m.cpi.hi - 5.84) < 1e-9);
  assert.ok(Math.abs(m.gdp.lo - 0.78) < 1e-9);
  assert.ok(Math.abs(m.gdp.hi - 2.92) < 1e-9);
});

test('chokepoints data: Hormuz is uniquely sea-trapped', () => {
  const cp = JSON.parse(readFileSync(join(root, 'data/chokepoints.json'), 'utf8')).chokepoints;
  const noAlt = cp.filter((c) => c.sea_alternative == null);
  assert.equal(noAlt.length, 1);
  assert.equal(noAlt[0].id, 'hormuz');
});

test('SPR realism: the tap binds, not the tank', () => {
  const r = sprRealism(THROUGHPUT - SPARE, 1200, 1.3); // full closure, 18.3 stranded
  assert.equal(r.offset, 1.3);
  assert.ok(Math.abs(r.net - (THROUGHPUT - SPARE - 1.3)) < 1e-9);
  assert.ok(r.coverShare < 0.08);
  assert.ok(r.daysAtRate > 900);
  // small disruption: releases can fully cover
  const small = sprRealism(0.8, 1200, 1.3);
  assert.equal(small.net, 0);
  assert.equal(small.coverShare, 1);
});
