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

/** One-page printable brief for the current scenario. */
export function downloadBrief(sc, s, data) {
  const cfg = data.config;
  const top = sc.exposure.filter((p) => p.stranded > 0.005).slice(0, 6);
  $('#print-brief').innerHTML = `
    <header>
      <div class="pb-mark">CHOKEPOINT</div>
      <div class="pb-meta">Analytica Data Science Solutions · chokepoint.analyticadss.com · data as of ${cfg.as_of}</div>
    </header>
    <h1>Strait of Hormuz scenario brief — ${s.d}% disruption</h1>
    <p>Bypass assumption: ${sc.profile.label}. All figures from public sources; model equations and per-figure citations at chokepoint.analyticadss.com (Methodology).</p>
    <div class="pb-grid">
      <div class="pb-stat"><div class="v">${fmt(sc.stranded)}</div><div class="l">Stranded, M b/d</div></div>
      <div class="pb-stat"><div class="v">${fmt(sc.share * 100)}%</div><div class="l">Of global supply</div></div>
      <div class="pb-stat"><div class="v">+${fmt(sc.shock.lo * 100, 0)}–${fmt(sc.shock.hi * 100, 0)}%</div><div class="l">Brent shock (illustrative)</div></div>
      <div class="pb-stat"><div class="v">${Number.isFinite(sc.sprDays) ? fmt(sc.sprDays, 0) : '∞'}</div><div class="l">SPR runway, days</div></div>
    </div>
    <p><b>Gross vs. net:</b> headlines quote ${fmt(sc.gross)} M b/d disrupted; overland bypass
    (Petroline, Habshan–Fujairah, Goreh–Jask) can absorb ${fmt(sc.bypass)} M b/d, leaving
    ${fmt(sc.stranded)} M b/d actually stranded.</p>
    <table>
      <thead><tr><th>Producer</th><th>Gulf exports (M b/d)</th><th>Stranded (M b/d)</th><th>Exposure</th></tr></thead>
      <tbody>${top.map((p) => `<tr><td>${p.name}</td><td>${fmt(p.gulf_exports_mbd)}</td><td>${fmt(p.stranded)}</td><td>${p.exposure}</td></tr>`).join('')}</tbody>
    </table>
    <p style="font-size:11px">Price shock is illustrative: ΔP/P ≈ stranded share ÷ ε, ε ∈ [0.08, 0.15], capped.
    Real markets price expectations, OPEC spare capacity and SPR releases. Baselines: Hormuz throughput
    ${cfg.figures.hormuz_throughput_mbd.value} M b/d (EIA, H1 2025); spare bypass ${sc.profile.total_mbd} M b/d (${sc.profile.status}).</p>
    <div class="pb-foot">Decision-support analysis from 100% public data — not navigational or targeting information.
    Generated ${new Date().toISOString().slice(0, 10)} · deep link: ${location.href}</div>`;
  window.print();
}
