/** Unit tests for the bypass-and-shock model — run with `npm test` (node --test). */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  stranded, strandedShare, shockBand, sprDays, producerExposure, bypassUse, scenario,
  importerExposure, impliedLossOdds, sprRealism,
} from '../src/model.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(readFileSync(join(root, 'data/config.json'), 'utf8'));
const producers = JSON.parse(readFileSync(join(root, 'data/producers.json'), 'utf8')).producers;
const importers = JSON.parse(readFileSync(join(root, 'data/importers.json'), 'utf8')).importers;

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
