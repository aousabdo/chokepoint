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

/**
 * Per-importer exposure: loss_i = hormuz_imports_i · d · (stranded/gross).
 * Bypass relief is pro-rata across buyers — rerouted barrels are fungible, so
 * Petroline crude landing at Yanbu still reaches whoever bought it. Because
 * importer volumes sum to total throughput (validator-enforced), importer
 * losses sum exactly to total stranded barrels.
 */
export function importerExposure(d, importers, { gross, stranded: strandedMbd }) {
  const strandedFrac = gross > 0 ? strandedMbd / gross : 0;
  return importers
    .map((m) => {
      const loss = m.hormuz_mbd * Math.min(1, Math.max(0, d)) * strandedFrac;
      return {
        ...m,
        loss,
        demandShare: m.demand_mbd ? loss / m.demand_mbd : null,
        daysCover: loss > 1e-9 ? m.stocks_mbbl / loss : Infinity,
      };
    })
    .sort((a, b) => a.daysCover - b.daysCover);
}

/**
 * Market-implied loss odds from a war-risk premium: premium ≈ p·severity + loadings,
 * so p ≤ premium/severity — an upper bound on what underwriters believe.
 * severity is loss-given-casualty as a fraction of hull value (1 = total loss).
 */
export function impliedLossOdds(premiumPct, severity = 1) {
  const p = premiumPct / 100 / severity;
  return { p, oneIn: p > 0 ? 1 / p : Infinity };
}

/**
 * SPR release realism: reserves offset stranded barrels only up to the maximum
 * feasible coordinated drawdown RATE — the binding constraint is the tap, not
 * the tank. Returns the offset, the net stranded remainder, the covered share,
 * and how long stocks last at that rate.
 */
export function sprRealism(strandedMbd, reservesMbbl, maxRateMbd) {
  const offset = Math.min(maxRateMbd, strandedMbd);
  return {
    offset,
    net: strandedMbd - offset,
    coverShare: strandedMbd > 0 ? offset / strandedMbd : 0,
    daysAtRate: offset > 0 ? reservesMbbl / offset : Infinity,
  };
}

/**
 * LNG shock: the oil model minus the escape valve. lost = hormuz_lng · d
 * (nothing reroutes — there is no gas Petroline and no strategic LNG reserve).
 * Price multiplier ≈ 1 + (share of global LNG trade lost)/ε_gas, banded, capped.
 */
export function lngShock(d, lng) {
  const clamped = Math.min(1, Math.max(0, d));
  const lostMtpa = lng.figures.hormuz_lng_mtpa.value * clamped;
  const shareTrade = lostMtpa / lng.figures.global_lng_trade_mtpa.value;
  const [epsLo, epsHi] = lng.figures.eps_gas.value;
  const cap = lng.figures.mult_cap.value;
  return {
    lostMtpa,
    bcfd: lostMtpa * lng.figures.bcfd_per_mtpa.value,
    shareTrade,
    mult: { lo: Math.min(1 + shareTrade / epsHi, cap), hi: Math.min(1 + shareTrade / epsLo, cap) },
    capped: 1 + shareTrade / epsLo > cap,
  };
}

/**
 * Voyage economics: does the transit clear once war-risk is priced in?
 * insurance = hull · premium% per transit; compared against freight revenue.
 */
export function voyageEconomics({ hullM, cargoMbbl, freightPerBbl, premiumPct }) {
  const insuranceM = hullM * (premiumPct / 100);
  const freightM = cargoMbbl * freightPerBbl;
  return {
    insuranceM,
    insPerBbl: cargoMbbl > 0 ? insuranceM / cargoMbbl : Infinity,
    freightM,
    share: freightM > 0 ? insuranceM / freightM : Infinity,
  };
}

/** Floating storage: ships holding × average cargo, expressed against world demand. */
export function floatingStorage(ships, avgCargoMbbl, globalMbd) {
  const mbbl = ships * avgCargoMbbl;
  return { mbbl, daysGlobal: globalMbd > 0 ? mbbl / globalMbd : 0 };
}

/**
 * Dynamic price path: the spike decays as elasticity rises with substitution
 * and demand destruction — ε(t) = ε₀ + (ε∞ − ε₀)(1 − e^(−t/τ)). The upper
 * curve starts from the tight short-run elasticity, the lower from the loose
 * one; both converge toward share/ε∞ — the persistent siege premium that
 * remains as long as barrels stay missing.
 */
export function pricePath(share, { epsLo = 0.08, epsHi = 0.15, epsLong = 0.35, tauMonths = 6, cap = 3.0, months = 24, step = 0.5 } = {}) {
  const pts = [];
  for (let t = 0; t <= months + 1e-9; t += step) {
    const ramp = 1 - Math.exp(-t / tauMonths);
    const eTight = epsLo + (epsLong - epsLo) * ramp;
    const eLoose = epsHi + (epsLong - epsHi) * ramp;
    pts.push({ t, hi: Math.min(share / eTight, cap), lo: Math.min(share / eLoose, cap) });
  }
  return pts;
}

/**
 * Macro pass-through, rule-of-thumb tier: +10% oil ≈ +[0.2,0.4] pp CPI and
 * −[0.1,0.2] pp GDP over a year (IMF/Fed staff ranges). Applied to the shock
 * band's ends; illustrative by construction.
 */
export function macroPassThrough(shock, { cpi, gdp }) {
  const per10lo = (shock.lo * 100) / 10;
  const per10hi = (shock.hi * 100) / 10;
  return {
    cpi: { lo: per10lo * cpi[0], hi: per10hi * cpi[1] },
    gdp: { lo: per10lo * gdp[0], hi: per10hi * gdp[1] },
  };
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
export function scenario(dPct, cfg, producers, profileId = 'eia', eps = null, importers = null) {
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
    importers: importers ? importerExposure(d, importers, s) : [],
    sprReal: sprRealism(s.stranded, cfg.figures.spr_releasable_mbbl.value, cfg.figures.max_release_mbd.value),
    pipelines: bypassUse(d, totals, profile.per_pipeline_mbd),
    profile,
  };
}
