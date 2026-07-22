/** Shell UI: readouts, scenario controls, layer toggles, time scrubber, detail card. */
import { countUp, fmt, bandText, statusBadge, sourceLine } from './format.js';
import { LAYER_GROUPS } from './map.js';
import { store } from './state.js';

const $ = (sel) => document.querySelector(sel);

export function initShell(data) {
  $('#asof').textContent = `DATA AS OF ${data.config.as_of}`;

  // View switching
  document.querySelectorAll('#views button').forEach((btn) => {
    btn.addEventListener('click', () => store.set({ v: btn.dataset.view }));
  });

  // Scenario slider + presets
  const slider = $('#disruption');
  slider.addEventListener('input', () => store.set({ d: parseInt(slider.value, 10) }));
  document.querySelectorAll('.presets button').forEach((btn) => {
    btn.addEventListener('click', () => store.set({ d: parseInt(btn.dataset.d, 10) }));
  });
  $('#bypass-assume').addEventListener('change', (e) => store.set({ b: e.target.value }));

  // Layer toggles
  const toggles = $('#layer-toggles');
  toggles.innerHTML = LAYER_GROUPS.map((g) => `
    <label class="layer-row">
      <input type="checkbox" data-layer="${g.id}" checked>
      <span class="swatch" style="background:${g.swatch}"></span>
      ${g.label}
    </label>`).join('');
  toggles.addEventListener('change', () => {
    const active = [...toggles.querySelectorAll('input:checked')].map((i) => i.dataset.layer);
    store.set({ l: active });
  });

  // Time scrubber
  const scrub = $('#scrub-year');
  scrub.addEventListener('input', () => store.set({ y: parseInt(scrub.value, 10) }));
  let playTimer = null;
  $('#scrub-play').addEventListener('click', () => {
    if (playTimer) {
      clearInterval(playTimer); playTimer = null;
      $('#scrub-play').textContent = '▶';
      return;
    }
    $('#scrub-play').textContent = '⏸';
    let y = store.get().y >= 2026 ? 1980 : store.get().y;
    playTimer = setInterval(() => {
      y += 1;
      store.set({ y });
      if (y >= 2026) { clearInterval(playTimer); playTimer = null; $('#scrub-play').textContent = '▶'; }
    }, 150);
  });

  // Copy deep link
  $('#share').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      $('#share').textContent = 'Copied ✓';
      setTimeout(() => { $('#share').textContent = 'Copy link'; }, 1600);
    } catch { /* clipboard unavailable (permissions) — leave the URL in the bar */ }
  });

  // Mobile layers sheet
  const leftToggle = $('#rail-left-toggle');
  const mq = matchMedia('(max-width: 860px)');
  const syncMobile = () => { leftToggle.style.display = mq.matches ? 'block' : 'none'; };
  mq.addEventListener('change', syncMobile); syncMobile();
  leftToggle.addEventListener('click', () => $('#rail-left').classList.toggle('open'));

  $('#detail-card').addEventListener('click', (e) => {
    if (e.target.classList.contains('close')) $('#detail-card').hidden = true;
  });
}

/** Reflect state into the chrome (controls, view visibility). */
export function syncControls(s) {
  document.querySelectorAll('#views button').forEach((btn) => {
    btn.setAttribute('aria-current', String(btn.dataset.view === s.v));
  });
  $('#view-map').hidden = s.v !== 'map';
  $('#view-insights').hidden = s.v !== 'insights';
  $('#view-methodology').hidden = s.v !== 'methodology';

  $('#disruption').value = s.d;
  $('#d-label').textContent = s.d;
  document.querySelectorAll('.presets button').forEach((btn) => {
    btn.classList.toggle('active', parseInt(btn.dataset.d, 10) === s.d);
  });
  $('#bypass-assume').value = s.b;
  $('#scrub-year').value = s.y;
  $('#scrub-label').textContent = s.y;
  document.querySelectorAll('#layer-toggles input').forEach((i) => {
    i.checked = s.l.includes(i.dataset.layer);
  });
}

/** Live readouts — every number tweens (count-up) on scenario change. */
export function renderReadouts(sc) {
  countUp($('#r-stranded'), sc.stranded);
  countUp($('#r-share'), sc.share * 100);
  countUp($('#r-gross'), sc.gross);
  countUp($('#r-bypass'), sc.bypass);
  $('#r-bypass-max').textContent = fmt(sc.profile.total_mbd);
  $('#r-shock').textContent = bandText(sc.shock.lo, sc.shock.hi) + (sc.shock.capped ? '⌃' : '');
  countUp($('#r-spr'), sc.sprDays, { dp: 0 });

  $('#r-exposed').innerHTML = sc.exposure
    .filter((p) => p.stranded > 0.005)
    .slice(0, 5)
    .map((p) => `<span class="chip ${p.exposure}">${p.name} −${fmt(p.stranded)}</span>`)
    .join('') || '<span class="chip">No stranded volumes at 0%</span>';
}

/** Sourced detail card for any clicked map feature. */
export function showDetail(props, layer, data) {
  const card = $('#detail-card');
  let html = '';
  const close = '<button class="close" aria-label="Close">✕</button>';

  if (layer === 'terminals') {
    const p = data.producers.find((x) => x.id === props.producer);
    html = `${close}<h3>${props.name} · ${props.country}</h3>
      <dl class="kv">
        ${props.exports_mbd > 0 ? `<dt>Gulf exports</dt><dd>${fmt(props.exports_mbd)} M b/d</dd>` : ''}
        ${props.lng_mtpa ? `<dt>LNG</dt><dd>${props.lng_mtpa} Mt/yr</dd>` : ''}
        <dt>Exposure</dt><dd><span class="tag ${props.exposure}">${props.exposure}</span></dd>
      </dl>
      <p style="font-size:13px;margin:8px 0 0">${props.detail ?? p?.note ?? ''}</p>
      <div class="src">${sourceLine(p ? 'EIA country analysis brief' : 'EIA', p?.url ?? data.producersDoc.url, data.producersDoc.as_of)} ${statusBadge(p?.status)}</div>`;
  } else if (layer === 'pipelines') {
    const cfg = Object.values(data.config.pipelines).find((x) => x.name === props.name)
      ?? data.config.pipelines[props.id];
    html = `${close}<h3>${props.name}</h3>
      <dl class="kv">
        <dt>Route</dt><dd style="font-family:var(--font-ui)">${cfg.from} → ${cfg.to}</dd>
        <dt>Nameplate</dt><dd>${fmt(cfg.nameplate_mbd)} M b/d</dd>
        <dt>In use (pre-crisis)</dt><dd>${fmt(cfg.in_use_mbd)} M b/d</dd>
        <dt>Operator</dt><dd style="font-family:var(--font-ui)">${cfg.operator}</dd>
      </dl>
      <div class="src">${sourceLine(cfg.source, cfg.url, cfg.retrieved)} ${statusBadge(cfg.status)}</div>`;
  } else if (layer === 'incidents') {
    html = `${close}<h3>${props.title}</h3>
      <p style="font-size:13px;margin:0"><span class="num" style="color:var(--accent-gold)">${props.date}</span> — ${props.summary}</p>
      <dl class="kv" style="margin-top:6px">
        <dt>Flows</dt><dd style="font-family:var(--font-ui)">${props.flows}</dd>
        <dt>Price</dt><dd style="font-family:var(--font-ui)">${props.price}</dd>
      </dl>
      <div class="src">${sourceLine(props.source, props.url)} ${statusBadge(props.status)} · position approximate</div>`;
  } else {
    // The narrows itself
    html = `${close}<h3>${props.name ?? 'The narrows'}</h3>
      <p style="font-size:13px;margin:0">${props.detail ?? ''}</p>
      <div class="src">${sourceLine(props.source ?? 'EIA', props.url)} </div>`;
  }

  card.innerHTML = `<div class="panel">${html}</div>`;
  card.hidden = false;
}

/** Build the one-page scenario brief (print.css styles it; ?brief=1 pre-populates for PDF export). */
const PRESET_NAMES = { 0: 'Open', 15: 'Harassment', 40: 'Partial closure', 70: 'Current reported', 100: 'Full closure' };

export function buildBrief(sc, s, data) {
  const cfg = data.config;
  const T = cfg.figures.hormuz_throughput_mbd.value;
  const flowing = Math.max(0, T - sc.gross);
  const seg = (v) => Math.max(0.5, (v / T) * 100);
  const preset = PRESET_NAMES[s.d] ? ` — “${PRESET_NAMES[s.d]}”` : '';
  const ins = data.insurance.points[data.insurance.points.length - 1];
  const insPre = data.insurance.points.find((p) => p.label === 'Pre-crisis baseline');
  const maxExports = Math.max(...sc.exposure.map((p) => p.gulf_exports_mbd));

  const rows = sc.exposure.map((p) => {
    const w = (p.gulf_exports_mbd / maxExports) * 100;
    const strFrac = p.gulf_exports_mbd > 0 ? p.stranded / p.gulf_exports_mbd : 0;
    return `<tr>
      <td class="name">${p.name}</td>
      <td class="r num">${fmt(p.gulf_exports_mbd)}</td>
      <td style="width:26%"><span class="pb-xbar">
        <span class="e" style="width:${w * (1 - strFrac)}%"></span>
        <span class="s" style="width:${w * strFrac}%"></span></span></td>
      <td class="r num" style="color:#C7431F">−${fmt(p.stranded)}</td>
      <td class="r"><span class="pb-tag ${p.exposure}">${p.exposure}</span></td>
    </tr>`;
  }).join('');

  document.getElementById('print-brief').innerHTML = `
    <div class="pb-mast">
      <div class="wm">CHOKEPOINT<small>STRAIT OF HORMUZ SCENARIO BRIEF · ANALYTICA DATA SCIENCE SOLUTIONS</small></div>
      <div class="meta">data as of <b>${cfg.as_of}</b><br>chokepoint.analyticadss.com · 100% public data</div>
    </div>
    <div class="pb-body">
      <h1 class="pb-title">Hormuz disruption: <span class="pct num">${s.d}%</span>${preset}</h1>
      <p class="pb-sub">Bypass assumption: ${sc.profile.label}. Every figure carries {source, url, retrieved, status} in the published dataset.</p>

      <div class="pb-tiles">
        <div class="pb-tile crim"><div class="v num">${fmt(sc.stranded)} <small>M b/d</small></div><div class="l">Stranded — nowhere to go</div></div>
        <div class="pb-tile"><div class="v num">${fmt(sc.gross)} <small>M b/d</small></div><div class="l">Gross disrupted — the headline number</div></div>
        <div class="pb-tile teal"><div class="v num">${fmt(sc.bypass)}<small>/${fmt(sc.profile.total_mbd)}</small></div><div class="l">Bypass absorbing, M b/d</div></div>
        <div class="pb-tile amber"><div class="v num">+${fmt(sc.shock.lo * 100, 0)}–${fmt(sc.shock.hi * 100, 0)}<small>%</small></div><div class="l">Brent shock band — illustrative${sc.shock.capped ? ' · capped' : ''}</div></div>
        <div class="pb-tile cyan"><div class="v num">${Number.isFinite(sc.sprDays) ? fmt(sc.sprDays, 0) : '∞'} <small>days</small></div><div class="l">Strategic-reserve runway</div></div>
      </div>

      <div class="pb-flow">
        <div class="pb-flowbar">
          <span class="un" style="width:${seg(flowing)}%"></span><span class="by" style="width:${seg(sc.bypass)}%"></span><span class="st" style="width:${seg(sc.stranded)}%"></span>
        </div>
        <div class="pb-flowlab">
          <span class="pb-dot first" style="background:#C9D4DE"></span>Still transiting <b class="num">${fmt(flowing)}</b>
          <span class="pb-dot" style="background:#1E8C7C"></span>Rerouted overland <b class="num">${fmt(sc.bypass)}</b>
          <span class="pb-dot" style="background:#C7431F"></span>Stranded <b class="num">${fmt(sc.stranded)}</b>
          &nbsp;— of <b class="num">${fmt(T)}</b> M b/d pre-crisis Hormuz throughput (EIA, H1 2025) · stranded = <b class="num">${fmt(sc.share * 100)}%</b> of world supply
        </div>
      </div>

      <div class="pb-cols">
        <div>
          <table class="pb-x">
            <thead><tr><th>Producer</th><th class="r">Exports</th><th>Still moving vs stranded</th><th class="r">Stranded</th><th class="r">Exposure</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
          <p class="pb-tablenote">Gulf seaborne exports, M b/d, pre-crisis baselines (EIA country analysis briefs).
          Per producer: stranded = exports·d − min(own pipeline spare, exports·d). Only Saudi Arabia (Petroline → Yanbu),
          the UAE (ADCOP → Fujairah) and Iran (Goreh–Jask) own an overland escape.</p>
          <div class="pb-callout pb-block"><b>The number nobody states cleanly:</b> Qatar's ~77 Mt/yr of LNG —
          about a fifth of the world's LNG trade — has zero overland bypass. Petroline can save Saudi barrels;
          nothing can save Qatari cargoes.</div>
        </div>
        <div class="pb-note">
          <h3>How to read this</h3>
          <p><b>Gross vs. net is the whole argument.</b> Headlines quote gross throughput disrupted; the honest
          damage number subtracts spare overland bypass — capacity that exists <b>and isn't already full</b>.
          EIA's conservative spare figure is 2.6 M b/d; post-2025 Petroline-expansion commentary supports up to
          5.5, so it ships as a switchable assumption, not a footnote.</p>
          <pre>stranded(d) = T·d − min(spare, T·d)
ΔP/P ≈ share ÷ ε,  ε ∈ [0.08, 0.15], capped
SPR_days = reserves ÷ stranded(d)</pre>
          <p>The price band is <b>illustrative by construction</b> — real markets price expectations, OPEC spare
          capacity and SPR releases. History's verdict from 45 years of Hormuz threats: spikes mean-revert
          unless barrels are physically missing.</p>
          <h3>War-risk context</h3>
          <p>Hull war-risk cover for a Gulf transit: <b class="num">${ins.low}–${ins.high}%</b> of vessel value
          (${ins.date.slice(0, 7)}) vs <b class="num">${insPre ? insPre.pct : 0.25}%</b> pre-crisis — for a $150M
          VLCC, <b>$${fmt(ins.low * 1.5, 1)}M–$${fmt(ins.high * 1.5, 1)}M per voyage</b>, when cover is offered
          at all. (JWC circulars; Lloyd's List / S&amp;P Global commentary.)</p>
        </div>
      </div>
    </div>
    <div class="pb-foot">
      <b>Sources &amp; provenance.</b> EIA World Oil Transit Chokepoints (retrieved ${cfg.as_of}) · EIA country
      analysis briefs · IEA oil security · JWC listed-area circulars, Lloyd's List and S&amp;P Global commentary ·
      2026-crisis public reporting. Statuses (verified / reported / estimate / illustrative) are carried per figure
      and surfaced at <b>chokepoint.analyticadss.com</b> — full equations and coverage gaps under Methodology.
      Decision-support from 100% public data; not navigational or targeting information.
      Scenario deep link: ${location.href} · generated ${new Date().toISOString().slice(0, 10)}.
    </div>`;
}

export function downloadBrief(sc, s, data) {
  buildBrief(sc, s, data);
  window.print();
}
