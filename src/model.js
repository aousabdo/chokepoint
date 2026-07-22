/**
 * Chokepoint model — the bypass-and-shock engine (build brief §5).
 * Pure functions over the bundled config; no DOM, unit-tested in tests/model.test.mjs.
 *
 *   stranded(d) = throughput·d − min(spare_bypass, throughput·d)
 *
 * The gross-vs-net gap is the product: headlines quote throughput·d,
 * planners need what's left after the overland escape valves.
 */

/** Disruption d ∈ [0,1] → gross disrupted, bypass absorbed, stranded (all M b/d). */
export function stranded(d, { throughput, spareBypass }) {
  const clamped = Math.min(1, Math.max(0, d));
  const gross = throughput * clamped;
  const bypass = Math.min(spareBypass, gross);
  return { d: clamped, gross, bypass, stranded: gross - bypass };
}

/** Stranded barrels as a share of global liquids supply. */
export function strandedShare(strandedMbd, globalSupplyMbd) {
  return globalSupplyMbd > 0 ? strandedMbd / globalSupplyMbd : 0;
}

/**
 * Stylized, clearly-illustrative price shock: ΔP/P ≈ stranded_share / ε.
 * Returns a band across the elasticity range [epsLo, epsHi], plus a point
 * estimate for a user-chosen ε — all capped. Real markets price expectations,
 * OPEC spare capacity and SPR releases; this is a bound, not a forecast.
 */
export function shockBand(share, { epsLo = 0.08, epsHi = 0.15, eps = null, cap = 3.0 } = {}) {
  const at = (e) => Math.min(share / e, cap);
  return {
    lo: at(epsHi),            // higher elasticity → smaller shock
    hi: at(epsLo),
    point: eps ? at(eps) : null,
    capped: share / epsLo > cap,
  };
}

/** Strategic-reserve runway in days: releasable stock ÷ stranded rate. Infinity when nothing is stranded. */
export function sprDays(strandedMbd, releasableMbbl) {
  return strandedMbd > 0 ? releasableMbbl / strandedMbd : Infinity;
}

/**
 * Per-producer exposure at disruption d.
 * A producer can reroute at most its own pipeline's spare capacity (per the
 * selected bypass profile); everything else affected is stranded.
 * Producers without a bypass strand their entire affected volume — that is the
 * Qatar/Kuwait story.
 */
export function producerExposure(d, producers, perPipelineSpare) {
  const clamped = Math.min(1, Math.max(0, d));
  return producers
    .map((p) => {
      const affected = p.gulf_exports_mbd * clamped;
      const spare = p.bypass_pipeline ? (perPipelineSpare[p.bypass_pipeline] ?? 0) : 0;
      const escaped = Math.min(spare, affected);
      const strandedMbd = affected - escaped;
      return {
        ...p,
        affected,
        escaped,
        stranded: strandedMbd,
        strandedShare: p.gulf_exports_mbd > 0 ? strandedMbd / p.gulf_exports_mbd : 0,
      };
    })
    .sort((a, b) => b.stranded - a.stranded);
}

/** Bypass utilisation per pipeline at disruption d, for the map's escape-route animation. */
export function bypassUse(d, totals, perPipelineSpare) {
  const { bypass } = stranded(d, totals);
  const spareSum = Object.values(perPipelineSpare).reduce((s, v) => s + v, 0) || 1;
  const use = {};
  for (const [id, spare] of Object.entries(perPipelineSpare)) {
    use[id] = { used: bypass * (spare / spareSum), spare };
  }
  return use;
}

/** Convenience: everything the UI needs for one scenario, in one call. */
export function scenario(dPct, cfg, producers, profileId = 'eia', eps = null) {
  const profile = cfg.bypass_profiles[profileId];
  const totals = {
    throughput: cfg.figures.hormuz_throughput_mbd.value,
    spareBypass: profile.total_mbd,
  };
  const d = dPct / 100;
  const s = stranded(d, totals);
  const share = strandedShare(s.stranded, cfg.figures.global_liquids_mbd.value);
  const [epsLo, epsHi] = cfg.figures.eps_short_run.value;
  return {
    ...s,
    share,
    shock: shockBand(share, { epsLo, epsHi, eps, cap: cfg.figures.shock_cap.value }),
    sprDays: sprDays(s.stranded, cfg.figures.spr_releasable_mbbl.value),
    exposure: producerExposure(d, producers, profile.per_pipeline_mbd),
    pipelines: bypassUse(d, totals, profile.per_pipeline_mbd),
    profile,
  };
}
