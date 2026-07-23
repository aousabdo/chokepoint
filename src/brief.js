/** The scenario brief — a five-page analyst report generated from the live model.
 *  Populated into #print-brief; print.css does the layout. ?brief=1 pre-populates
 *  for headless PDF export. All charts here are print-light variants. */
import { fmt } from './format.js';
import { lngShock, impliedLossOdds, voyageEconomics, pricePath } from './model.js';

const PRESET_NAMES = { 0: 'Open', 15: 'Harassment', 40: 'Partial closure', 90: 'Current reported', 100: 'Full closure' };
const C = { ink: '#101820', dim: '#5A6B7A', grid: '#D5DDE4', crim: '#C7431F', amber: '#B97A14', teal: '#1E8C7C', cyan: '#0E7C8C', gold: '#8A5A0D' };

const badge = (s) => (s ? `<span class="pb-badge s-${s}">${s}</span>` : '');

function pageHead(n, total, section, title) {
  return `<div class="pb-head">
    <span class="wm">CHOKEPOINT</span>
    <span class="sec">${section}</span>
    <span class="pg">${title} · p. ${n}/${total}</span>
  </div>`;
}

/* ── Print charts ─────────────────────────────────────────── */

function insuranceChartPrint(insurance) {
  const W = 940, H = 240, L = 48, R = 12, T = 14, B = 26;
  const pts = insurance.points.map((p) => ({ ...p, t: new Date(p.date).getTime() }));
  const t0 = new Date('2018-06-01').getTime();
  const t1 = new Date('2026-10-01').getTime();
  const x = (t) => L + ((t - t0) / (t1 - t0)) * (W - L - R);
  const lgMin = Math.log10(0.004), lgMax = Math.log10(12);
  const y = (v) => T + (1 - (Math.log10(v) - lgMin) / (lgMax - lgMin)) * (H - T - B);

  const grid = [0.01, 0.1, 1, 10].map((v) =>
    `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="${C.grid}" stroke-width="0.8"/>
     <text x="${L - 5}" y="${y(v) + 3}" text-anchor="end" class="pax">${v}%</text>`).join('');
  const years = [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026].map((yr) =>
    `<text x="${x(new Date(`${yr}-01-01`).getTime())}" y="${H - 7}" text-anchor="middle" class="pax">${yr}</text>`).join('');
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.pct).toFixed(1)}`).join(' ');
  const ranges = pts.map((p) =>
    `<line x1="${x(p.t)}" x2="${x(p.t)}" y1="${y(p.low)}" y2="${y(p.high)}" stroke="${C.amber}" stroke-width="3" stroke-linecap="round" opacity="0.35"/>`).join('');
  const dots = pts.map((p) => `<circle cx="${x(p.t)}" cy="${y(p.pct)}" r="3" fill="${C.amber}" stroke="#fff"/>`).join('');
  const labels = pts.map((p, i) =>
    `<text x="${x(p.t)}" y="${y(p.pct) + (i % 2 ? 15 : -9)}" text-anchor="middle" class="pann">${p.label}</text>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%">
    <style>.pax{fill:${C.dim};font:9px Menlo,monospace}.pann{fill:${C.ink};font:9px -apple-system,sans-serif}</style>
    ${grid}${years}${ranges}<path d="${line}" fill="none" stroke="${C.amber}" stroke-width="1.6"/>${dots}${labels}</svg>`;
}

function pricePathPrint(pts, share, epsLong, cap) {
  const W = 940, H = 230, L = 48, R = 12, T = 14, B = 26;
  const yMax = Math.max(0.4, pts[0].hi * 1.12);
  const x = (t) => L + (t / pts[pts.length - 1].t) * (W - L - R);
  const y = (v) => T + (1 - v / yMax) * (H - T - B);
  const asym = Math.min(share / epsLong, cap);
  const grid = [0.25, 0.5, 1, 1.5, 2, 2.5].filter((v) => v < yMax).map((v) =>
    `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="${C.grid}" stroke-width="0.8"/>
     <text x="${L - 5}" y="${y(v) + 3}" text-anchor="end" class="pax">+${(v * 100).toFixed(0)}%</text>`).join('');
  const months = [0, 6, 12, 18, 24].map((m) =>
    `<text x="${x(m)}" y="${H - 7}" text-anchor="middle" class="pax">${m}mo</text>`).join('');
  const line = (k) => pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p[k]).toFixed(1)}`).join(' ');
  const band = `${line('hi')} ${[...pts].reverse().map((p) => `L${x(p.t).toFixed(1)},${y(p.lo).toFixed(1)}`).join(' ')} Z`;
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%">
    <style>.pax{fill:${C.dim};font:9px Menlo,monospace}.pann{fill:${C.cyan};font:9px -apple-system,sans-serif}</style>
    ${grid}${months}
    <path d="${band}" fill="rgba(185,122,20,0.13)"/>
    <path d="${line('hi')}" fill="none" stroke="${C.crim}" stroke-width="1.8"/>
    <path d="${line('lo')}" fill="none" stroke="${C.amber}" stroke-width="1.4"/>
    <line x1="${L}" x2="${W - R}" y1="${y(asym)}" y2="${y(asym)}" stroke="${C.cyan}" stroke-dasharray="4 4"/>
    <text x="${W - R - 4}" y="${y(asym) - 5}" text-anchor="end" class="pann">siege premium ≈ +${(asym * 100).toFixed(0)}% while barrels stay missing</text></svg>`;
}

/* ── Page builders ────────────────────────────────────────── */

function page1(sc, s, data) {
  const cfg = data.config;
  const T = cfg.figures.hormuz_throughput_mbd.value;
  const flowing = Math.max(0, T - sc.gross);
  const seg = (v) => Math.max(0.5, (v / T) * 100);
  const preset = PRESET_NAMES[s.d] ? ` — “${PRESET_NAMES[s.d]}”` : '';
  const ins = data.insurance.points[data.insurance.points.length - 1];
  const insPre = data.insurance.points.find((p) => p.label === 'Pre-crisis baseline');
  const maxExports = Math.max(...sc.exposure.map((p) => p.gulf_exports_mbd));
  const lg = lngShock(sc.d, data.lng);
  const oddsW = impliedLossOdds(ins.high); const oddsB = impliedLossOdds(ins.low);
  const siege = Math.min(sc.share / cfg.figures.eps_longrun.value, cfg.figures.shock_cap.value);

  const rows = sc.exposure.map((p) => {
    const w = (p.gulf_exports_mbd / maxExports) * 100;
    const sf = p.gulf_exports_mbd > 0 ? p.stranded / p.gulf_exports_mbd : 0;
    return `<tr><td class="name">${p.name}</td><td class="r num">${fmt(p.gulf_exports_mbd)}</td>
      <td style="width:26%"><span class="pb-xbar"><span class="e" style="width:${w * (1 - sf)}%"></span><span class="s" style="width:${w * sf}%"></span></span></td>
      <td class="r num" style="color:${C.crim}">−${fmt(p.stranded)}</td>
      <td class="r"><span class="pb-tag ${p.exposure}">${p.exposure}</span></td></tr>`;
  }).join('');

  return `
    <div class="pb-mast">
      <div class="wm">CHOKEPOINT<small>STRAIT OF HORMUZ SCENARIO BRIEF · ANALYTICA DATA SCIENCE SOLUTIONS</small></div>
      <div class="meta">data as of <b>${cfg.as_of}</b><br>chokepoint.analyticadss.com · 100% public data</div>
    </div>
    <div class="pb-body">
      <h1 class="pb-title">Hormuz disruption: <span class="pct num">${s.d}%</span>${preset}</h1>
      <p class="pb-sub">Bypass assumption: ${sc.profile.label}. Every figure carries {source, url, retrieved, status} in the published dataset.
      Five pages: exposure · markets · history &amp; structure · the 2026 ladder · method.</p>

      <div class="pb-tiles">
        <div class="pb-tile crim"><div class="v num">${fmt(sc.stranded)} <small>M b/d</small></div><div class="l">Stranded — nowhere to go</div></div>
        <div class="pb-tile"><div class="v num">${fmt(sc.gross)} <small>M b/d</small></div><div class="l">Gross disrupted — the headline number</div></div>
        <div class="pb-tile teal"><div class="v num">${fmt(sc.bypass)}<small>/${fmt(sc.profile.total_mbd)}</small></div><div class="l">Bypass absorbing, M b/d</div></div>
        <div class="pb-tile amber"><div class="v num">+${fmt(sc.shock.lo * 100, 0)}–${fmt(sc.shock.hi * 100, 0)}<small>%</small></div><div class="l">Brent shock band — illustrative${sc.shock.capped ? ' · capped' : ''}</div></div>
        <div class="pb-tile cyan"><div class="v num">${Number.isFinite(sc.sprDays) ? fmt(sc.sprDays, 0) : '∞'} <small>days</small></div><div class="l">Strategic-reserve runway</div></div>
      </div>
      <div class="pb-tiles pb-tiles2">
        <div class="pb-tile amber"><div class="v num">+${fmt(siege * 100, 0)}<small>%</small></div><div class="l">Siege premium, 12–24 mo — persistent while barrels stay missing</div></div>
        <div class="pb-tile cyan"><div class="v num">${fmt(sc.sprReal.net)} <small>M b/d</small></div><div class="l">Net gap after max SPR release — the tap binds at ${fmt(cfg.figures.max_release_mbd.value)} M b/d</div></div>
        <div class="pb-tile" style="border-top-color:${C.gold}"><div class="v num" style="color:${C.gold}">${fmt(lg.lostMtpa, 0)} <small>Mt/yr</small></div><div class="l">LNG offline, zero bypass — gas multiplier ×${fmt(lg.mult.lo)}–×${fmt(lg.mult.hi)} (illustr.)</div></div>
        <div class="pb-tile crim"><div class="v num">1-in-${fmt(oddsW.oneIn, 0)}<small>–${fmt(oddsB.oneIn, 0)}</small></div><div class="l">Implied hull-loss odds per transit, from current quotes</div></div>
      </div>

      <div class="pb-flow">
        <div class="pb-flowbar"><span class="un" style="width:${seg(flowing)}%"></span><span class="by" style="width:${seg(sc.bypass)}%"></span><span class="st" style="width:${seg(sc.stranded)}%"></span></div>
        <div class="pb-flowlab">
          <span class="pb-dot first" style="background:#C9D4DE"></span>Still transiting <b class="num">${fmt(flowing)}</b>
          <span class="pb-dot" style="background:${C.teal}"></span>Rerouted overland <b class="num">${fmt(sc.bypass)}</b>
          <span class="pb-dot" style="background:${C.crim}"></span>Stranded <b class="num">${fmt(sc.stranded)}</b>
          &nbsp;— of <b class="num">${fmt(T)}</b> M b/d pre-crisis throughput (EIA, H1 2025) · stranded = <b class="num">${fmt(sc.share * 100)}%</b> of world supply
        </div>
      </div>

      <div class="pb-cols">
        <div>
          <table class="pb-x">
            <thead><tr><th>Producer</th><th class="r">Exports</th><th>Still moving vs stranded</th><th class="r">Stranded</th><th class="r">Exposure</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
          <p class="pb-tablenote">Gulf seaborne exports, M b/d, pre-crisis baselines (EIA country briefs). Per producer:
          stranded = exports·d − min(own pipeline spare, exports·d). Only Saudi Arabia (Petroline → Yanbu), the UAE
          (ADCOP → Fujairah) and Iran (Goreh–Jask) own an overland escape.</p>
          <div class="pb-callout pb-block"><b>The number nobody states cleanly:</b> Qatar's ~77 Mt/yr of LNG — about a
          fifth of the world's LNG trade — has zero overland bypass. Petroline can save Saudi barrels; nothing can save
          Qatari cargoes.</div>
        </div>
        <div class="pb-note">
          <h3>How to read this</h3>
          <p><b>Gross vs. net is the whole argument.</b> Headlines quote gross throughput disrupted; the honest damage
          number subtracts spare overland bypass — capacity that exists <b>and isn't already full</b>. EIA's conservative
          spare figure is 2.6 M b/d; post-2025 Petroline-expansion commentary supports up to 5.5, so it ships as a
          switchable assumption, not a footnote.</p>
          <p>The price band is <b>illustrative by construction</b> — real markets price expectations, OPEC spare capacity
          and SPR releases. History's verdict from 45 years of Hormuz threats (p. 4): spikes mean-revert unless barrels
          are physically missing. This time they are.</p>
          <h3>War-risk context</h3>
          <p>Hull war-risk cover for a Gulf transit: <b class="num">${ins.low}–${ins.high}%</b> of vessel value
          (${ins.date.slice(0, 7)}) vs <b class="num">${insPre ? insPre.pct : 0.25}%</b> pre-crisis — for a $150M VLCC,
          <b>$${fmt(ins.low * 1.5, 1)}M–$${fmt(ins.high * 1.5, 1)}M per voyage</b>, when cover is offered at all.
          Full ledger and voyage arithmetic on p. 3.</p>
          <h3>Why Hormuz is different</h3>
          <p>The only major oil chokepoint with <b>no sea alternative</b>. Suez closed for eight years and the world
          rerouted around the Cape; here the ships have nowhere else to go (comparison, p. 4).</p>
        </div>
      </div>
    </div>`;
}

function page2(sc, s, data) {
  const cfg = data.config;
  const lg = lngShock(sc.d, data.lng);
  const impRows = sc.importers.map((m) => {
    const days = Number.isFinite(m.daysCover) ? (m.daysCover > 999 ? '999+' : fmt(m.daysCover, 0)) : '∞';
    const col = m.daysCover < 60 ? C.crim : m.daysCover < 180 ? C.amber : C.teal;
    return `<tr><td class="name">${m.name}${m.stocks_status === 'estimate' ? badge('estimate') : ''}</td>
      <td class="r num">${fmt(m.hormuz_mbd)}</td>
      <td class="r num" style="color:${C.crim}">−${fmt(m.loss)}</td>
      <td class="r num">${m.demandShare != null ? `${fmt(m.demandShare * 100, 0)}%` : '—'}</td>
      <td class="r num">${m.stocks_mbbl}</td>
      <td class="r num" style="color:${col};font-weight:700">${days}</td></tr>`;
  }).join('');
  const buyers = data.lng.buyers.map((b) =>
    `<tr><td class="name" style="font-weight:400">${b.name}</td><td class="r num">${fmt(b.mtpa, 0)}</td>
     <td class="r num" style="color:${C.gold}">−${fmt(b.mtpa * (s.d / 100), 0)}</td></tr>`).join('');

  return `${pageHead(2, 5, 'EXPOSURE', 'Who loses the barrels — and who doesn’t get them')}
    <div class="pb-body">
      <h2 class="pb-h2">Importer exposure — who hurts first</h2>
      <p class="pb-lede">An importer's loss = its Hormuz volume × d × (stranded/gross); bypass relief is pro-rata because
      rerouted barrels are fungible. Days of cover = strategic stocks ÷ lost supply. Sorted shortest first.</p>
      <table class="pb-x">
        <thead><tr><th>Importer</th><th class="r">Via Hormuz, M b/d</th><th class="r">Loss, M b/d</th>
        <th class="r">% of its demand</th><th class="r">Stocks, M bbl</th><th class="r">Days of cover</th></tr></thead>
        <tbody>${impRows}</tbody>
      </table>
      <p class="pb-tablenote">Volumes: EIA WOTC destinations (2024) — they sum to total throughput, so importer losses sum
      exactly to stranded barrels (build-enforced). Stocks: IEA / ISPRL / DOE; China's are state-opaque — public analyst
      estimates only. The asymmetry is the story: Asia holds weeks; the OECD holds a year.</p>

      <div class="pb-cols" style="margin-top:14px">
        <div class="pb-note">
          <h3>Reserves — the tap, not the tank ${badge('reported')}</h3>
          <p>The stock/flow runway says <b class="num">${Number.isFinite(sc.sprDays) ? fmt(sc.sprDays, 0) : '∞'} days</b> —
          but coordinated releases max out near <b class="num">${fmt(cfg.figures.max_release_mbd.value)} M b/d</b>
          (2022 precedent: 240 M bbl over ~6 months). At today's stranded rate that covers
          <b class="num">${fmt(sc.sprReal.coverShare * 100, 0)}%</b> of the gap, leaving
          <b class="num">${fmt(sc.sprReal.net)} M b/d</b> uncovered. At maximum drawdown the stocks last
          <b class="num">${Number.isFinite(sc.sprReal.daysAtRate) ? fmt(sc.sprReal.daysAtRate, 0) : '∞'} days</b> —
          the tank outlasts the crisis; the tap is the constraint.</p>
          <h3>Macro pass-through ${badge('illustrative')}</h3>
          <p>Public rules of thumb (+10% oil ≈ +0.2–0.4 pp CPI, −0.1–0.2 pp GDP over a year) applied to the shock band:
          consumer prices <b class="num" style="color:${C.amber}">+${fmt((sc.shock.lo * 100 / 10) * cfg.figures.cpi_per_10pct.value[0])}–${fmt((sc.shock.hi * 100 / 10) * cfg.figures.cpi_per_10pct.value[1])} pp</b>;
          global growth <b class="num" style="color:${C.crim}">−${fmt((sc.shock.lo * 100 / 10) * cfg.figures.gdp_per_10pct.value[0])}–${fmt((sc.shock.hi * 100 / 10) * cfg.figures.gdp_per_10pct.value[1])} pp</b>.
          A 2-pp global drag ≈ a typical recession's demand loss. Linear rules break down at extreme shocks — treat upper
          ends as directional. (IMF WEO; Fed staff ranges.)</p>
        </div>
        <div>
          <h3 class="pb-note-h">The LNG shock — no escape exists ${badge('illustrative')}</h3>
          <div class="pb-minirow">
            <div><div class="v num" style="color:${C.gold}">${fmt(lg.lostMtpa, 0)} Mt/yr</div><div class="l">LNG offline (${fmt(lg.bcfd)} Bcf/d)</div></div>
            <div><div class="v num">${fmt(lg.shareTrade * 100)}%</div><div class="l">of global LNG trade</div></div>
            <div><div class="v num" style="color:${C.amber}">×${fmt(lg.mult.lo)}–×${fmt(lg.mult.hi)}</div><div class="l">TTF/JKM multiplier band</div></div>
          </div>
          <table class="pb-x" style="margin-top:8px">
            <thead><tr><th>Buyer</th><th class="r">Mt/yr via Hormuz</th><th class="r">Lost at ${s.d}%</th></tr></thead>
            <tbody>${buyers}</tbody>
          </table>
          <p class="pb-tablenote">${data.lng.storage_note.text}</p>
          <p class="pb-tablenote">${data.lng.anchor_2022.text} ${badge('verified')}</p>
        </div>
      </div>
    </div>`;
}

function page3(sc, s, data) {
  const cfg = data.config;
  const ins = data.insurance.points[data.insurance.points.length - 1];
  const first = data.insurance.points[0];
  const oddsW = impliedLossOdds(ins.high); const oddsB = impliedLossOdds(ins.low); const oddsPre = impliedLossOdds(first.pct);
  const V = data.voyage.voyage;
  const premiums = [
    { p: 0.25, label: 'Feb 2026 “pre-crisis”' },
    { p: ins.low, label: 'Current — safer vessels' },
    { p: ins.pct, label: 'Current — mid' },
    { p: ins.high, label: 'Current — high-risk' },
  ];
  const vRows = premiums.map(({ p, label }) => {
    const ve = voyageEconomics({ hullM: V.hull_value_musd.value, cargoMbbl: V.cargo_mbbl.value, freightPerBbl: V.freight_per_bbl.value, premiumPct: p });
    const verdict = ve.share < 0.5 ? ['Clears', C.teal] : ve.share < 1 ? ['Marginal', C.amber] : ['Uneconomic', C.crim];
    return `<tr><td class="name" style="font-weight:400">${label}</td><td class="r num">${p}%</td>
      <td class="r num">$${fmt(ve.insuranceM)}M</td><td class="r num">$${fmt(ve.insPerBbl, 2)}</td>
      <td class="r num">${fmt(ve.share * 100, 0)}%</td>
      <td class="r" style="color:${verdict[1]};font-weight:700;font-size:9px;letter-spacing:.05em">${verdict[0].toUpperCase()}</td></tr>`;
  }).join('');
  const [epsLo, epsHi] = cfg.figures.eps_short_run.value;
  const pp = pricePath(sc.share, { epsLo, epsHi, epsLong: cfg.figures.eps_longrun.value, tauMonths: cfg.figures.tau_months.value, cap: cfg.figures.shock_cap.value });

  return `${pageHead(3, 5, 'MARKETS', 'What the price of fear says')}
    <div class="pb-body">
      <h2 class="pb-h2">War-risk insurance ledger — % of hull value per Gulf transit (log scale)</h2>
      ${insuranceChartPrint(data.insurance)}
      <p class="pb-tablenote">JWC listed-area circulars; Lloyd's List, S&amp;P Global and broker commentary. Points inside
      quoted ranges; bars show the public low–high. From a 0.01% plumbing fee to the number that decides whether a ship
      sails. Note the ratchet: each crisis's "normal" settles above the last one's.</p>

      <div class="pb-minirow" style="margin:10px 0 4px">
        <div><div class="v num" style="color:${C.amber}">1-in-${fmt(oddsW.oneIn, 0)} – 1-in-${fmt(oddsB.oneIn, 0)}</div><div class="l">Implied odds of hull loss per transit, current quotes</div></div>
        <div><div class="v num" style="color:${C.dim}">~1-in-${fmt(oddsPre.oneIn / 1000, 0)},000</div><div class="l">Same arithmetic, Dec 2018</div></div>
        <div><div class="l" style="margin-top:4px">premium ≈ probability × severity + loadings → upper bounds; at 50% severity, double the 1-in-N</div></div>
      </div>

      <h2 class="pb-h2" style="margin-top:12px">Voyage economics — does the transit clear?</h2>
      <table class="pb-x">
        <thead><tr><th>Premium regime</th><th class="r">% of hull</th><th class="r">Cost / transit</th>
        <th class="r">$ / bbl</th><th class="r">Share of freight</th><th class="r">Verdict</th></tr></thead>
        <tbody>${vRows}</tbody>
      </table>
      <p class="pb-tablenote">$${V.hull_value_musd.value}M VLCC, ${V.cargo_mbbl.value} M bbl cargo, $${fmt(V.freight_per_bbl.value)}/bbl freight
      (public broker commentary; crisis chartering has spiked rates 3×+). One-way transit; round trips can double the premium.
      Above ~100%, the underwriter — not the charterer — decides whether the ship sails.</p>

      <h2 class="pb-h2" style="margin-top:12px">Dynamic price path — the spike decays; the siege premium stays</h2>
      ${sc.share > 0.001 ? pricePathPrint(pp, sc.share, cfg.figures.eps_longrun.value, cfg.figures.shock_cap.value) : '<p class="pb-tablenote">No stranded barrels at this disruption level.</p>'}
      <p class="pb-tablenote">ε(t) = ε₀ + (ε∞−ε₀)(1−e<sup>−t/τ</sup>), ε∞ = ${cfg.figures.eps_longrun.value}, τ = ${cfg.figures.tau_months.value} months ${badge('illustrative')} —
      assumes the disruption persists; expectations, SPR releases and GDP feedback excluded. Substitution and demand
      destruction tame the spike, but converge to a persistent premium — not to zero — while barrels stay missing.</p>
    </div>`;
}

function page4(sc, s, data) {
  const esRows = data.brentEvents.events.map((e) => {
    const cell = (v) => (v == null ? '<td class="r num" style="color:#9AA7B2">—</td>'
      : `<td class="r num" style="color:${v >= 0 ? C.amber : C.teal}">${v >= 0 ? '+' : ''}${fmt(v)}%</td>`);
    return `<tr><td class="name" style="font-weight:400">${e.name}${badge(e.status)}</td>
      <td class="r num">${e.date}</td>${cell(e.d1)}${cell(e.d5)}${cell(e.d30)}</tr>`;
  }).join('');
  const cpRows = data.chokepointsDoc.chokepoints.map((c) => `
    <tr${c.id === 'hormuz' ? ' class="cp-hl"' : ''}><td class="name">${c.name}</td>
      <td class="r num">${fmt(c.oil_mbd)}</td>
      <td>${c.sea_alternative ? `${c.sea_alternative.label} <span class="num" style="color:${C.dim}">+${c.sea_alternative.delay_days}d</span>` : `<b style="color:${C.crim};font-size:9px;letter-spacing:.05em">NONE — NO WAY OUT BY SEA</b>`}</td>
      <td class="r num">${c.bypass_mbd > 0 ? fmt(c.bypass_mbd) : '—'}</td>
      <td style="font-size:8.6px;color:${C.dim}">${c.closure_record}</td></tr>`).join('');
  const reopRows = data.reopening.phases.map((ph) => {
    const human = ph.high_days < 60 ? `${Math.round(ph.low_days / 7)}–${Math.round(ph.high_days / 7)} weeks` : `${Math.round(ph.low_days / 30)}–${Math.round(ph.high_days / 30)} months`;
    return `<tr><td class="name">${ph.phase}</td><td class="r num" style="color:${C.amber};font-weight:700">${human}</td>
      <td style="font-size:8.8px">${ph.summary} <span style="color:${C.dim}">${ph.anchors[0].text}.</span>${badge(ph.anchors[0].status)}</td></tr>`;
  }).join('');

  return `${pageHead(4, 5, 'HISTORY & STRUCTURE', 'What 45 years of threats actually did')}
    <div class="pb-body">
      <h2 class="pb-h2">Event study — Brent after Hormuz threats (1/5/30 trading days)</h2>
      <table class="pb-x">
        <thead><tr><th>Event</th><th class="r">Date</th><th class="r">+1d</th><th class="r">+5d</th><th class="r">+30d</th></tr></thead>
        <tbody>${esRows}</tbody>
      </table>
      <p class="pb-tablenote">${data.brentEvents.source}; windows computed by the fetch pipeline (pre-1987 rows predate the
      daily series and remain estimates). The pattern: threat spikes mean-revert within weeks — even Abqaiq, the largest
      single supply disruption in oil-market history, round-tripped in a month — <b>unless barrels stay missing</b>.
      The 2026 row is the counterexample that proves the mechanism: +71% at 30 days and climbing.</p>

      <h2 class="pb-h2" style="margin-top:12px">Chokepoint anatomy — why Hormuz is different</h2>
      <table class="pb-x">
        <thead><tr><th>Chokepoint</th><th class="r">Oil, M b/d</th><th>Sea alternative</th><th class="r">Bypass, M b/d</th><th>Closure record</th></tr></thead>
        <tbody>${cpRows}</tbody>
      </table>
      <p class="pb-tablenote">EIA WOTC reference volumes. Every other chokepoint has an escape — a longer sea lane, a parallel
      pipeline, or both. Suez closed for eight years and the world rerouted. Hormuz's first real closure is a different kind of event.</p>

      <h2 class="pb-h2" style="margin-top:12px">Reopening runway — why d→0 is not day zero</h2>
      <table class="pb-x">
        <thead><tr><th>Friction</th><th class="r">Persistence</th><th>Anchor</th></tr></thead>
        <tbody>${reopRows}</tbody>
      </table>
    </div>`;
}

function page5(sc, s, data) {
  const cfg = data.config;
  const rungs = data.events
    .filter((e) => e.era === 'y2025' || e.era === 'y2026')
    .map((e) => `<tr><td class="r num" style="color:${C.gold};white-space:nowrap">${e.date}</td>
      <td><b>${e.title}</b>${badge(e.status)}<br><span style="color:${C.dim};font-size:8.8px">${e.summary}</span><br>
      <span style="font-size:8.6px">Flows: <b>${e.flows}</b> · Price: <b>${e.price}</b></span></td></tr>`).join('');

  return `${pageHead(5, 5, 'THE LADDER & THE METHOD', 'From the twelve-day war to the first real closure')}
    <div class="pb-body">
      <h2 class="pb-h2">The road to closure — 2025 → 2026</h2>
      <table class="pb-x pb-ladder"><tbody>${rungs}</tbody></table>

      <div class="pb-cols" style="margin-top:14px">
        <div class="pb-note">
          <h3>The model</h3>
          <pre>stranded(d)   = T·d − min(spare_bypass, T·d)
ΔP/P          ≈ share / ε,  ε ∈ [${cfg.figures.eps_short_run.value.join(', ')}], capped
price path    : ε(t) = ε₀ + (ε∞−ε₀)(1−e^(−t/τ))
SPR offset    = min(max_release_rate, stranded)
producer_i    : exports_i·d − min(pipeline spare_i, ·)
importer_i    : imports_i·d · stranded/gross
LNG mult      : 1 + (lng_lost/global_trade) / ε_gas
implied odds  : P(loss) ≤ premium / severity
voyage        : share = hull·p / (cargo·freight)
macro         : (ΔP%/10)·[coeffs], one-year</pre>
          <h3>Provenance legend</h3>
          <p><b>verified</b> — checked against the named public source at build time · <b>reported</b> — live-crisis public
          reporting · <b>estimate</b> — derived/approximate · <b>illustrative</b> — model assumption ·
          <b>brief-baseline</b> — pending a fresh primary-source check. If a figure is an estimate, it says so.</p>
        </div>
        <div class="pb-note">
          <h3>Sources</h3>
          <p>EIA World Oil Transit Chokepoints (retrieved ${cfg.as_of}); EIA country briefs, STEO and daily Brent · IEA oil
          security &amp; gas market reports; GIIGNL · ISPRL, DOE, KNOC/METI stock disclosures · JWC listed-area circulars;
          Lloyd's List, S&amp;P Global and broker commentary · CRS R45281; US Navy histories · 2026-crisis public reporting ·
          IMF WEO / Fed staff rules of thumb · Natural Earth. Per-figure citations with URLs and retrieval dates ship in the
          dataset and render in the site's Methodology panel.</p>
          <h3>Intended use</h3>
          <p>Decision-support for shipping, energy and policy analysis from 100% public data. No real-time vessel positions,
          no navigational data, nothing that could serve as a targeting aid. Incident positions are approximate;
          vessel-behavior content is pattern-level.</p>
          <p style="margin-top:10px">Interactive version, all scenarios: <b>chokepoint.analyticadss.com</b><br>
          Scenario deep link: <span style="font-size:7.6px">${location.href}</span><br>
          Generated ${new Date().toISOString().slice(0, 10)} · Chokepoint · Analytica Data Science Solutions · analyticadss.com</p>
        </div>
      </div>
    </div>`;
}

export function buildBrief(sc, s, data) {
  document.getElementById('print-brief').innerHTML =
    `<div class="pb-page">${page1(sc, s, data)}</div>
     <div class="pb-page">${page2(sc, s, data)}</div>
     <div class="pb-page">${page3(sc, s, data)}</div>
     <div class="pb-page">${page4(sc, s, data)}</div>
     <div class="pb-page pb-last">${page5(sc, s, data)}</div>`;
}

export function downloadBrief(sc, s, data) {
  buildBrief(sc, s, data);
  window.print();
}
