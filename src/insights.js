/** Insights dashboard: exposure boards (producer + importer), price-shock backtest + model,
 *  insurance ledger with implied odds, reopening runway, escalation ladder. */
import { fmt, statusBadge, sourceLine } from './format.js';
import { impliedLossOdds, lngShock, voyageEconomics, floatingStorage } from './model.js';
import { store } from './state.js';

function exposureBoard(sc) {
  const maxExports = Math.max(...sc.exposure.map((p) => p.gulf_exports_mbd));
  return sc.exposure.map((p) => {
    const total = (p.gulf_exports_mbd / maxExports) * 100;
    const strFrac = p.gulf_exports_mbd > 0 ? p.stranded / p.gulf_exports_mbd : 0;
    return `<div class="board-row">
      <span class="name">${p.name}</span>
      <span class="bar" title="${fmt(p.gulf_exports_mbd)} M b/d Gulf exports — ${fmt(p.stranded)} stranded, ${fmt(p.gulf_exports_mbd - p.stranded)} still moving">
        <span style="width:${total * (1 - strFrac)}%" class="esc"></span>
        <span style="width:${total * strFrac}%" class="str"></span>
      </span>
      <span class="figure num">−${fmt(p.stranded)} M b/d</span>
      <span class="tag ${p.exposure}">${p.exposure}</span>
    </div>`;
  }).join('');
}

function importerBoard(sc) {
  const maxImp = Math.max(...sc.importers.map((m) => m.hormuz_mbd));
  return sc.importers.map((m) => {
    const w = (m.hormuz_mbd / maxImp) * 100;
    const lossFrac = m.hormuz_mbd > 0 ? m.loss / m.hormuz_mbd : 0;
    const d = m.daysCover;
    const cls = d < 60 ? 'cover-low' : d < 180 ? 'cover-mid' : 'cover-ok';
    const daysTxt = Number.isFinite(d) ? (d > 999 ? '999+' : fmt(d, 0)) : '∞';
    return `<div class="board-row">
      <span class="name">${m.name} ${m.stocks_status === 'estimate' ? statusBadge('estimate') : ''}</span>
      <span class="bar" title="${fmt(m.hormuz_mbd)} M b/d via Hormuz — losing ${fmt(m.loss)} M b/d${m.demandShare != null ? ` (${fmt(m.demandShare * 100, 0)}% of its total oil demand)` : ''}. Stocks ${m.stocks_mbbl} M bbl — ${m.stocks_source}.">
        <span class="esc" style="width:${w * (1 - lossFrac)}%"></span>
        <span class="str" style="width:${w * lossFrac}%"></span>
      </span>
      <span class="figure num">−${fmt(m.loss)} M b/d</span>
      <span class="cover ${cls} num" title="Strategic stocks ÷ lost supply rate">${daysTxt}d</span>
    </div>`;
  }).join('');
}

function insuranceImplied(insurance) {
  const pts = insurance.points;
  const last = pts[pts.length - 1];
  const first = pts[0];
  const best = impliedLossOdds(last.low);
  const worst = impliedLossOdds(last.high);
  const pre = impliedLossOdds(first.pct);
  return `<div class="implied-grid">
      <div class="readout amber">
        <div class="label">Implied odds of hull loss, per transit</div>
        <div class="value num" style="font-size:22px">1-in-${fmt(worst.oneIn, 0)} – 1-in-${fmt(best.oneIn, 0)}</div>
        <div class="sub">from the ${last.date.slice(0, 7)} quote range (${last.low}–${last.high}% of hull)</div>
      </div>
      <div class="readout dim">
        <div class="label">Same arithmetic, Dec 2018</div>
        <div class="value num">~1-in-${fmt(pre.oneIn / 1000, 0)},000</div>
        <div class="sub">the strait as priced plumbing</div>
      </div>
      <div class="readout cyan">
        <div class="label">How to read it</div>
        <div class="sub" style="margin-top:4px">premium ≈ probability × severity + loadings, so these are <b>upper bounds</b>
        on what underwriters believe. At 50% average severity, double the 1-in-N.</div>
      </div>
    </div>`;
}

function reopeningPanel(reopening) {
  const MAX = 560;
  const pos = (days) => Math.sqrt(days / MAX) * 100;
  const human = (lo, hi) => (hi < 60 ? `${Math.round(lo / 7)}–${Math.round(hi / 7)} weeks` : `${Math.round(lo / 30)}–${Math.round(hi / 30)} months`);
  return reopening.phases.map((ph) => `
    <div class="reop-row">
      <div class="reop-head"><b>${ph.phase}</b><span class="num">${human(ph.low_days, ph.high_days)}</span></div>
      <div class="reop-track"><span class="reop-band" style="left:${pos(ph.low_days)}%;width:${Math.max(2, pos(ph.high_days) - pos(ph.low_days))}%"></span></div>
      <p>${ph.summary}</p>
      <ul class="reop-anchors">${ph.anchors.map((a) =>
        `<li>${a.text} — ${sourceLine(a.source, a.url)} ${statusBadge(a.status)}</li>`).join('')}</ul>
    </div>`).join('') +
    `<div class="reop-scale"><span>ceasefire</span><span>1 month</span><span>6 months</span><span>18 months →</span></div>`;
}

function eventStudy(brentEvents) {
  const scale = (v) => Math.min(48, Math.abs(v) / 16 * 48); // ±16% fills the half-track
  const bar = (v, label) => {
    if (v == null) {
      return `<div class="es-track"><span class="es-zero"></span><span class="es-lab dimlab">${label} — pending fetch</span></div>`;
    }
    const w = scale(v);
    const side = v >= 0 ? `left:50%;width:${w}%` : `left:${50 - w}%;width:${w}%`;
    return `<div class="es-track"><span class="es-zero"></span>
      <span class="es-bar ${v >= 0 ? 'pos' : 'neg'}" style="${side}"></span>
      <span class="es-lab">${label} ${v >= 0 ? '+' : ''}${fmt(v)}%</span></div>`;
  };
  return brentEvents.events.map((e) => `
    <div class="evt-row">
      <span class="nm">${e.name} ${statusBadge(e.status)}<span class="dt">${e.date}</span></span>
      <span>${bar(e.d1, '+1d')}${bar(e.d5, '+5d')}${bar(e.d30, '+30d')}</span>
    </div>`).join('');
}

function insuranceChart(insurance) {
  const W = 940, H = 290, L = 50, R = 14, T = 16, B = 30;
  const pts = insurance.points.map((p) => ({ ...p, t: new Date(p.date).getTime() }));
  const t0 = new Date('2018-06-01').getTime();
  const t1 = new Date('2026-10-01').getTime();
  const x = (t) => L + ((t - t0) / (t1 - t0)) * (W - L - R);
  const lgMin = Math.log10(0.004), lgMax = Math.log10(12);
  const y = (v) => T + (1 - (Math.log10(v) - lgMin) / (lgMax - lgMin)) * (H - T - B);

  const grid = [0.01, 0.1, 1, 10].map((v) =>
    `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)" stroke-width="1"/>
     <text x="${L - 6}" y="${y(v) + 3}" text-anchor="end" class="ax">${v}%</text>`).join('');
  const years = [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026].map((yr) => {
    const tx = x(new Date(`${yr}-01-01`).getTime());
    return `<text x="${tx}" y="${H - 8}" text-anchor="middle" class="ax">${yr}</text>`;
  }).join('');

  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.pct).toFixed(1)}`).join(' ');
  const ranges = pts.map((p) =>
    `<line x1="${x(p.t)}" x2="${x(p.t)}" y1="${y(p.low)}" y2="${y(p.high)}"
       stroke="var(--exposed-amber)" stroke-width="3" stroke-linecap="round" opacity="0.35"/>`).join('');
  const dots = pts.map((p) =>
    `<circle cx="${x(p.t)}" cy="${y(p.pct)}" r="3.5" fill="var(--exposed-amber)"
       stroke="var(--bg-abyss)" stroke-width="1"><title>${p.date} — ${p.label}: ~${p.pct}% of hull (${p.low}–${p.high}%). ${p.note}</title></circle>`).join('');
  const labels = pts.map((p, i) =>
    `<text x="${x(p.t)}" y="${y(p.pct) + (i % 2 ? 16 : -10)}" text-anchor="middle" class="ann">${p.label}</text>`).join('');

  return `<div class="chart-wrap"><svg viewBox="0 0 ${W} ${H}" role="img" style="min-width:680px;width:100%"
    aria-label="War-risk premium as percent of hull value per Gulf transit, 2018 to 2026, log scale — from a rounding error to the deciding factor">
    <style>.ax{fill:var(--ink-dim);font:10px var(--font-mono)}.ann{fill:var(--ink);font:10px var(--font-ui)}</style>
    ${grid}${years}${ranges}
    <path d="${line}" fill="none" stroke="var(--exposed-amber)" stroke-width="1.8"/>
    ${dots}${labels}
  </svg></div>`;
}

function ladder(events, eras, era) {
  const rows = events
    .filter((e) => era === 'all' || e.era === era)
    .slice()
    .reverse();
  return rows.map((e) => `
    <div class="ladder-row">
      <span class="dt">${e.date}</span>
      <div>
        <h3>${e.title} ${statusBadge(e.status)}</h3>
        <p>${e.summary}</p>
        <div class="impacts">
          <span>Flows: <b>${e.flows}</b></span>
          <span>Price: <b>${e.price}</b></span>
        </div>
        <div class="srcline">${sourceLine(e.source, e.url)}
          ${e.lat != null ? ` · <a href="#" data-locate="${e.date}">locate on map</a>` : ''}</div>
      </div>
    </div>`).join('');
}

export function initInsights(root, data) {
  root.innerHTML = `
    <h1>Insights</h1>
    <p class="lede">The planner's view: who owns the stranded barrels, what the honest cost curve looks like,
    and what four decades of Hormuz threats actually did to price.</p>

    <div class="panel">
      <h2>Producer exposure board — at <span id="board-d" class="num" style="color:var(--data-cyan)">0</span>% disruption
        (<span id="board-profile"></span>)</h2>
      <div id="board"></div>
      <div class="callout"><strong>The number nobody states cleanly:</strong> Qatar's ~77 Mt/yr of LNG —
        about <strong>a fifth of the world's LNG trade</strong> — has <strong>zero overland bypass</strong>.
        Petroline can save Saudi barrels; nothing can save Qatari cargoes. Every molecule is hostage to the strait.
        <div class="chart-note">${sourceLine('EIA Qatar country brief; IEA Hormuz oil-security note', 'https://www.iea.org/about/oil-security-and-emergency-response/strait-of-hormuz', data.config.as_of)}</div>
      </div>
    </div>

    <div class="panel">
      <h2>Importer exposure — who hurts first (at <span id="imp-d" class="num" style="color:var(--data-cyan)">0</span>% disruption)</h2>
      <p class="chart-note" style="margin:0 0 8px">The flip side of the producer board: who <b style="color:var(--ink)">buys</b> what
      Hormuz carries, and how many days their strategic stocks cover the loss. Bypass relief is shared pro-rata —
      rerouted barrels are fungible, so a Petroline cargo landing at Yanbu still reaches its buyer.
      Sorted by days of cover: shortest first.</p>
      <div id="imp-board"></div>
      <p class="chart-note">${sourceLine('EIA WOTC — Hormuz flows by destination (2024)', 'https://www.eia.gov/international/analysis/special-topics/World_Oil_Transit_Chokepoints', '2026-07-22')} ·
      stocks per row from IEA / ISPRL / DOE / public analyst estimates — China's reserves are state-opaque and marked
      <span class="status estimate">estimate</span>. Hover any bar for the sourcing.</p>
    </div>

    <div class="grid-2">
      <div class="panel">
        <h2>Event study — Brent after Hormuz threats</h2>
        <p class="chart-note" style="margin:0 0 8px">Move in the 1/5/30 trading days after each event.
        History's verdict: <b style="color:var(--ink)">threat spikes mean-revert; only missing barrels persist</b>
        (Abqaiq took 5.7 M b/d offline — and even it round-tripped in a month).</p>
        <div id="event-study"></div>
        <p class="chart-note">${sourceLine(data.brentEvents.source, data.brentEvents.url, data.brentEvents.as_of)} ·
        bars marked <span class="status estimate">estimate</span> pending exact recomputation by <code>scripts/fetch.mjs</code>.</p>
      </div>

      <div class="panel">
        <h2>Stylized shock model <span class="status illustrative">illustrative</span></h2>
        <div id="shock-panel"></div>
        <label class="assumption" style="margin-top:10px">Short-run elasticity ε
          <input type="range" id="eps" min="6" max="20" step="1" style="width:130px">
          <span class="num" id="eps-label" style="color:var(--data-cyan)"></span>
        </label>
        <p class="chart-note">ΔP/P ≈ stranded share ÷ ε, banded over ε ∈ [0.08, 0.15] and capped at +300%.
        Illustrative — real markets price expectations, OPEC spare capacity and SPR releases, not just today's barrels.</p>
      </div>
    </div>

    <div class="panel">
      <h2>LNG shock — the cargo with no escape (at <span id="lng-d" class="num" style="color:var(--accent-gold)">0</span>% disruption)</h2>
      <p class="chart-note" style="margin:0 0 10px">Oil has Petroline; gas has nothing. A fifth of the world's LNG exits
      through Hormuz with <b style="color:var(--ink)">zero overland bypass and no strategic reserve behind it</b>.
      ${data.lng.storage_note.text} ${statusBadge(data.lng.storage_note.status)}</p>
      <div class="implied-grid" style="border-top:none;padding-top:0">
        <div class="readout gold">
          <div class="label">LNG offline</div>
          <div class="value num" id="lng-lost">0 Mt/yr</div>
          <div class="sub"><span id="lng-bcfd" class="num">0.0</span> Bcf/d of gas supply withdrawn</div>
        </div>
        <div class="readout amber">
          <div class="label">Share of global LNG trade</div>
          <div class="value num" id="lng-share">0%</div>
          <div class="sub">of ~${data.lng.figures.global_lng_trade_mtpa.value} Mt/yr traded worldwide</div>
        </div>
        <div class="readout amber">
          <div class="label">TTF/JKM multiplier band <span class="status illustrative">illustrative</span></div>
          <div class="value num" id="lng-mult">×1.0–×1.0</div>
          <div class="sub">1 + share ÷ ε_gas, ε ∈ [${data.lng.figures.eps_gas.value.join(', ')}], capped ×${data.lng.figures.mult_cap.value}</div>
        </div>
      </div>
      <div id="lng-buyers" style="margin-top:4px"></div>
      <p class="chart-note">${data.lng.anchor_2022.text} ${sourceLine(data.lng.anchor_2022.source, data.lng.anchor_2022.url)}
      ${statusBadge(data.lng.anchor_2022.status)} · Hormuz LNG volume: ${sourceLine(data.lng.figures.hormuz_lng_mtpa.source, data.lng.figures.hormuz_lng_mtpa.url, data.lng.as_of)}
      · buyer split: ${sourceLine(data.lng.buyers_source, data.lng.buyers_url)} ${statusBadge('estimate')}</p>
    </div>

    <div class="panel">
      <h2>War-risk insurance ledger — the single most honest number in the crisis</h2>
      <p class="chart-note" style="margin:0 0 8px">Premium per Gulf transit as % of hull value (log scale).
      From 0.01% plumbing fee to the number that decides whether a ship sails: for a $150M VLCC,
      the 2026 range means <b style="color:var(--ink)">$1.5M–$11M per voyage</b> — when cover is offered at all.</p>
      <div id="insurance-chart"></div>
      <p class="chart-note">${sourceLine('JWC listed-area circulars; Lloyd’s List, S&P Global and broker commentary', 'https://www.lloydslist.com/', data.insurance.as_of)} —
      points inside quoted ranges; range bars show the public low–high. Estimates marked in tooltips.</p>
      <div id="insurance-implied"></div>
    </div>

    <div class="grid-2">
      <div class="panel">
        <h2>Voyage economics — does the transit clear?</h2>
        <p class="chart-note" style="margin:0 0 6px">The premium became the voyage decision. Set the terms; the
        arithmetic answers. Cargo fixed at ${data.voyage.voyage.cargo_mbbl.value} M bbl (a laden VLCC).</p>
        <div class="calc">
          <label>Hull value<input type="range" id="v-hull" min="${data.voyage.voyage.hull_value_musd.range[0]}" max="${data.voyage.voyage.hull_value_musd.range[1]}" step="5"><span class="val num" id="v-hull-v"></span></label>
          <label>Freight rate<input type="range" id="v-freight" min="${data.voyage.voyage.freight_per_bbl.range[0]}" max="${data.voyage.voyage.freight_per_bbl.range[1]}" step="0.5"><span class="val num" id="v-freight-v"></span></label>
          <label>War-risk premium<input type="range" id="v-prem" min="0" max="10" step="0.25"><span class="val num" id="v-prem-v"></span></label>
        </div>
        <div id="v-out"></div>
        <p class="chart-note">Defaults: hull ${sourceLine(data.voyage.voyage.hull_value_musd.source, data.voyage.voyage.hull_value_musd.url)} ${statusBadge(data.voyage.voyage.hull_value_musd.status)};
        freight ${sourceLine(data.voyage.voyage.freight_per_bbl.source, data.voyage.voyage.freight_per_bbl.url)} ${statusBadge(data.voyage.voyage.freight_per_bbl.status)};
        premium from the ledger's latest point. One-way transit — round trips can double the premium; crew war bonuses and P&amp;I surcharges excluded.</p>
      </div>
      <div>
        <div class="panel">
          <h2>Floating storage — the queue afloat</h2>
          <div class="calc">
            <label>Ships holding<input type="range" id="f-ships" min="0" max="${data.voyage.floating.ships.range[1]}" step="10"><span class="val num" id="f-ships-v"></span></label>
            <label>Average cargo<input type="range" id="f-cargo" min="${data.voyage.floating.avg_cargo_mbbl.range[0]}" max="${data.voyage.floating.avg_cargo_mbbl.range[1]}" step="0.1"><span class="val num" id="f-cargo-v"></span></label>
          </div>
          <div id="f-out"></div>
          <p class="chart-note">${sourceLine(data.voyage.floating.ships.source, data.voyage.floating.ships.url, data.voyage.as_of)}
          ${statusBadge(data.voyage.floating.ships.status)} · fleet mix ${statusBadge(data.voyage.floating.avg_cargo_mbbl.status)}</p>
        </div>
        <div class="panel">
          <h2>The spare-capacity fallacy</h2>
          <div class="callout" style="margin:0">
            <strong>~${data.config.figures.opec_spare_mbd.value} M b/d of OPEC+ spare capacity cannot save you.</strong>
            About 90% of it is Saudi and Emirati — physically inside the Gulf. Spare barrels that must transit the
            strait they're meant to offset count for nothing during a closure. The only spare that clears is
            bypass-connected: the same ${data.config.bypass_profiles.eia.total_mbd} M b/d escape valve already in this model.
            <div class="chart-note">${sourceLine(data.config.figures.opec_spare_mbd.source, data.config.figures.opec_spare_mbd.url, data.config.figures.opec_spare_mbd.retrieved)}
            ${statusBadge(data.config.figures.opec_spare_mbd.status)}</div>
          </div>
        </div>
      </div>
    </div>

    <div class="panel">
      <h2>Reopening runway — why the slider doesn't snap back</h2>
      <p class="chart-note" style="margin:0 0 10px">Setting disruption to 0% models flows, not frictions.
      Three things outlast every de-escalation, each anchored to the historical record:</p>
      <div id="reopening"></div>
    </div>

    <div class="panel">
      <h2>Escalation ladder — 1980 → today</h2>
      <div class="era-filter" id="era-filter">
        <button data-era="all" class="active">All</button>
        ${data.eras.map((e) => `<button data-era="${e.id}">${e.label}</button>`).join('')}
      </div>
      <div id="ladder"></div>
    </div>`;

  document.getElementById('event-study').innerHTML = eventStudy(data.brentEvents);
  document.getElementById('insurance-chart').innerHTML = insuranceChart(data.insurance);
  document.getElementById('insurance-implied').innerHTML = insuranceImplied(data.insurance);
  document.getElementById('reopening').innerHTML = reopeningPanel(data.reopening);

  let era = 'all';
  const ladderEl = document.getElementById('ladder');
  const renderLadder = () => { ladderEl.innerHTML = ladder(data.events, data.eras, era); };
  renderLadder();

  document.getElementById('era-filter').addEventListener('click', (e) => {
    const btn = e.target.closest('button'); if (!btn) return;
    era = btn.dataset.era;
    document.querySelectorAll('#era-filter button').forEach((b) => b.classList.toggle('active', b === btn));
    renderLadder();
  });
  ladderEl.addEventListener('click', (e) => {
    const a = e.target.closest('[data-locate]'); if (!a) return;
    e.preventDefault();
    const ev = data.events.find((x) => x.date === a.dataset.locate);
    store.set({ v: 'map', y: Math.min(2026, parseInt(ev.date.slice(0, 4), 10)) });
  });

  const eps = document.getElementById('eps');
  eps.addEventListener('input', () => store.set({ e: parseInt(eps.value, 10) }));

  // ── Voyage economics calculator (self-contained; premium defaults to the ledger's latest point) ──
  const byId = (id) => document.getElementById(id);
  const vHull = byId('v-hull'); const vFreight = byId('v-freight'); const vPrem = byId('v-prem');
  vHull.value = data.voyage.voyage.hull_value_musd.value;
  vFreight.value = data.voyage.voyage.freight_per_bbl.value;
  vPrem.value = data.insurance.points[data.insurance.points.length - 1].pct;
  const renderVoyage = () => {
    const hullM = +vHull.value; const freightPerBbl = +vFreight.value; const premiumPct = +vPrem.value;
    byId('v-hull-v').textContent = `$${hullM}M`;
    byId('v-freight-v').textContent = `$${fmt(freightPerBbl)}/bbl`;
    byId('v-prem-v').textContent = `${fmt(premiumPct, 2)}% of hull`;
    const ve = voyageEconomics({ hullM, cargoMbbl: data.voyage.voyage.cargo_mbbl.value, freightPerBbl, premiumPct });
    const verdict = ve.share < 0.5
      ? ['ok', 'Clears — the premium is a cost, not a veto.']
      : ve.share < 1
        ? ['mid', 'Marginal — the underwriter, not the charterer, decides whether this ship sails.']
        : ['bad', 'Uneconomic — freight cannot carry the premium. No sailing without premium rates or state cover.'];
    byId('v-out').innerHTML = `
      <div class="implied-grid" style="border-top:none;padding-top:0;margin-top:4px">
        <div class="readout amber"><div class="label">War-risk cost, this transit</div>
          <div class="value num">$${fmt(ve.insuranceM)}M</div><div class="sub num">$${fmt(ve.insPerBbl, 2)}/bbl added</div></div>
        <div class="readout cyan"><div class="label">Freight revenue</div>
          <div class="value num">$${fmt(ve.freightM)}M</div><div class="sub">${data.voyage.voyage.cargo_mbbl.value} M bbl × rate</div></div>
        <div class="readout ${ve.share < 0.5 ? 'safe' : ve.share < 1 ? 'amber' : 'crit'}"><div class="label">Premium consumes</div>
          <div class="value num">${fmt(ve.share * 100, 0)}%</div><div class="sub">of freight revenue</div></div>
      </div>
      <div class="verdict ${verdict[0]}">${verdict[1]}</div>`;
  };
  [vHull, vFreight, vPrem].forEach((el) => el.addEventListener('input', renderVoyage));
  renderVoyage();

  // ── Floating storage estimator ──
  const fShips = byId('f-ships'); const fCargo = byId('f-cargo');
  fShips.value = data.voyage.floating.ships.value;
  fCargo.value = data.voyage.floating.avg_cargo_mbbl.value;
  const usSpr = data.importers.find((m) => m.id === 'usa')?.stocks_mbbl ?? 400;
  const renderFloating = () => {
    const ships = +fShips.value; const cargo = +fCargo.value;
    byId('f-ships-v').textContent = String(ships);
    byId('f-cargo-v').textContent = `${fmt(cargo)} M bbl`;
    const fs = floatingStorage(ships, cargo, data.config.figures.global_liquids_mbd.value);
    byId('f-out').innerHTML = `
      <div class="readout gold" style="margin-top:4px">
        <div class="label">Oil waiting afloat</div>
        <div class="value num">${fmt(fs.mbbl, 0)} <span style="font-size:13px">M bbl</span></div>
        <div class="sub">${fmt(fs.daysGlobal, 1)} days of world demand · ≈${fmt((fs.mbbl / usSpr) * 100, 0)}% of the US SPR,
        anchored in a war-risk zone</div>
      </div>`;
  };
  [fShips, fCargo].forEach((el) => el.addEventListener('input', renderFloating));
  renderFloating();

  /** Dynamic parts, called on every scenario change while visible. */
  return function update(sc, s) {
    document.getElementById('board-d').textContent = s.d;
    document.getElementById('board-profile').textContent = sc.profile.label;
    document.getElementById('board').innerHTML = exposureBoard(sc);
    document.getElementById('imp-d').textContent = s.d;
    document.getElementById('imp-board').innerHTML = importerBoard(sc);

    // LNG shock recomputes with the same slider — gas gets no bypass
    const g = lngShock(sc.d, data.lng);
    document.getElementById('lng-d').textContent = s.d;
    document.getElementById('lng-lost').textContent = `${fmt(g.lostMtpa, 0)} Mt/yr`;
    document.getElementById('lng-bcfd').textContent = fmt(g.bcfd);
    document.getElementById('lng-share').textContent = `${fmt(g.shareTrade * 100)}%`;
    document.getElementById('lng-mult').textContent = `×${fmt(g.mult.lo)}–×${fmt(g.mult.hi)}${g.capped ? '⌃' : ''}`;
    document.getElementById('lng-buyers').innerHTML = data.lng.buyers.map((b) => {
      const lost = b.mtpa * (s.d / 100);
      const maxB = Math.max(...data.lng.buyers.map((x) => x.mtpa));
      const w = (b.mtpa / maxB) * 100;
      return `<div class="board-row lng-row">
        <span class="name" style="font-weight:400">${b.name}</span>
        <span class="bar"><span class="esc" style="width:${w * (1 - s.d / 100)}%"></span><span class="str" style="width:${w * (s.d / 100)}%;background:var(--accent-gold)"></span></span>
        <span class="figure num" style="color:var(--accent-gold)">−${fmt(lost, 0)} Mt/yr</span>
      </div>`;
    }).join('');
    eps.value = s.e;
    document.getElementById('eps-label').textContent = (s.e / 100).toFixed(2);

    const cap = 3.0;
    const px = (v) => Math.min(100, (v / cap) * 100);
    document.getElementById('shock-panel').innerHTML = `
      <div class="readout amber" style="margin-bottom:6px">
        <div class="label">Modeled Brent shock at ${s.d}% disruption</div>
        <div class="value num">+${fmt(sc.shock.lo * 100, 0)}–${fmt(sc.shock.hi * 100, 0)}%${sc.shock.capped ? ' ⌃capped' : ''}</div>
        <div class="sub">point estimate at ε=${(s.e / 100).toFixed(2)}: <b class="num" style="color:var(--data-cyan)">+${fmt((sc.shock.point ?? 0) * 100, 0)}%</b></div>
      </div>
      <div class="shock-gauge"><span class="band" style="left:${px(sc.shock.lo)}%;width:${Math.max(1, px(sc.shock.hi) - px(sc.shock.lo))}%"></span>
        <span class="pt" style="left:${px(sc.shock.point ?? 0)}%"></span></div>
      <div class="readout cyan" style="margin-top:10px">
        <div class="label">Strategic-reserve runway</div>
        <div class="value num">${Number.isFinite(sc.sprDays) ? fmt(sc.sprDays, 0) : '∞'} <span style="font-size:13px">days</span></div>
        <div class="sub">${data.config.figures.spr_releasable_mbbl.value} M bbl IEA-member public stocks ÷ ${fmt(sc.stranded)} M b/d stranded
        <span class="status estimate">estimate</span></div>
      </div>
      <div class="spr-real">
        <div class="label" style="font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--ink-dim)">
          Release-rate reality check <span class="status reported">reported</span></div>
        ${sc.stranded > 0.05
          ? `Coordinated releases max out near <b>${fmt(data.config.figures.max_release_mbd.value)}</b> M b/d (2022 precedent) —
             covering <b>${fmt(sc.sprReal.coverShare * 100, 0)}%</b> of the stranded rate. Net gap after a maximum release:
             <b>${fmt(sc.sprReal.net)}</b> M b/d. At that rate stocks last <b>${fmt(sc.sprReal.daysAtRate, 0)}</b> days —
             the tank outlasts the crisis; <b>the tap is the constraint</b>.`
          : 'No stranded barrels to offset at this disruption level.'}
      </div>`;
  };
}
