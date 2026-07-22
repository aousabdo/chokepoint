/** Insights dashboard: exposure board, price-shock backtest + model, insurance ledger, escalation ladder. */
import { fmt, statusBadge, sourceLine } from './format.js';
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
      <h2>War-risk insurance ledger — the single most honest number in the crisis</h2>
      <p class="chart-note" style="margin:0 0 8px">Premium per Gulf transit as % of hull value (log scale).
      From 0.01% plumbing fee to the number that decides whether a ship sails: for a $150M VLCC,
      the 2026 range means <b style="color:var(--ink)">$1.5M–$11M per voyage</b> — when cover is offered at all.</p>
      <div id="insurance-chart"></div>
      <p class="chart-note">${sourceLine('JWC listed-area circulars; Lloyd’s List, S&P Global and broker commentary', 'https://www.lloydslist.com/', data.insurance.as_of)} —
      points inside quoted ranges; range bars show the public low–high. Estimates marked in tooltips.</p>
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

  /** Dynamic parts, called on every scenario change while visible. */
  return function update(sc, s) {
    document.getElementById('board-d').textContent = s.d;
    document.getElementById('board-profile').textContent = sc.profile.label;
    document.getElementById('board').innerHTML = exposureBoard(sc);
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
      </div>`;
  };
}
