/** Guided tour — spotlight walkthrough of the operator console. Manual start, Esc to exit. */
import { store } from './state.js';

const STEPS = [
  {
    sel: '#disruption',
    title: 'The scenario slider',
    body: 'The product in one control. Drag 0→100% Hormuz disruption — every readout, the exposure board and the map recompute live. Presets mark the canonical scenarios, including the reported current state.',
  },
  {
    sel: '#rail-right',
    view: 'map',
    title: 'The honest arithmetic',
    body: 'Gross disrupted is the headline number; stranded is what matters — what overland bypass cannot absorb. The Brent band is deliberately labeled illustrative, and the reserve runway is a stock-to-flow ratio, not a plan.',
  },
  {
    sel: '#bypass-assume',
    title: 'The load-bearing assumption',
    body: 'EIA\'s conservative 2.6 M b/d of spare bypass vs. the post-2025 Petroline-expansion upper bound of 5.5. The gap between those two numbers is most of the argument — so it\'s a switch, not a footnote.',
  },
  {
    sel: '#layer-toggles',
    view: 'map',
    title: 'Layers',
    body: 'Flows, bypass pipelines, the strait\'s lane geometry, terminals, the incident record and pattern-level shadow-fleet zones. Everything clickable opens a sourced card with retrieval date and provenance status.',
  },
  {
    sel: '#scrub-play',
    view: 'map',
    title: 'Time sweep',
    body: 'Sweep 1980→today. Four decades of Hormuz threats on the map — the Tanker War, 2019, the twelve-day war, the 2026 crisis. History is the model\'s empirical anchor.',
  },
  {
    sel: '#imp-board',
    panel: true,
    view: 'insights',
    title: 'Who hurts first',
    body: 'The flip side of the producer board: who buys what Hormuz carries, and how many days their strategic stocks cover the loss. Sorted shortest first — Asia holds weeks, the OECD holds a year. China\'s reserves are state-opaque and badged accordingly.',
  },
  {
    sel: '#lng-buyers',
    panel: true,
    view: 'insights',
    title: 'The cargo with no escape',
    body: 'Oil has Petroline; gas has nothing. A fifth of the world\'s LNG exits through Hormuz with zero bypass and no strategic reserve behind it. The multiplier band is anchored to the 2021–22 European gas crisis.',
  },
  {
    sel: '.cp-table',
    panel: true,
    view: 'insights',
    title: 'Why Hormuz is different',
    body: 'Every other major chokepoint has an escape — another sea lane, a parallel pipeline, or both. Suez closed for eight years and the world rerouted. Hormuz alone has no way out by sea — a fact the build enforces as a data invariant.',
  },
  {
    sel: '#brief-btn',
    title: 'Take it with you',
    body: 'Download brief generates a five-page analyst report at your exact scenario — every figure sourced, every model equation stated. Methodology documents all of it, and Copy link shares this precise view.',
  },
];

let active = -1;
let overlay = null;

function stepEls() {
  return {
    hl: overlay.querySelector('.tour-hl'),
    tip: overlay.querySelector('.tour-tip'),
  };
}

function place(i) {
  const step = STEPS[i];
  if (step.view) store.set({ v: step.view });
  const el = document.querySelector(step.sel);
  const target = step.panel ? (el?.closest('.panel') ?? el) : el;
  target?.scrollIntoView({ block: 'center', behavior: 'instant' });
  const { hl, tip } = stepEls();
  const pad = 8;
  const r = target?.getBoundingClientRect();
  const hidden = !r || (r.width === 0 && r.height === 0);

  if (hidden) {
    hl.style.cssText = 'display:none';
  } else {
    hl.style.cssText = `display:block;left:${r.left - pad}px;top:${r.top - pad}px;` +
      `width:${r.width + pad * 2}px;height:${r.height + pad * 2}px`;
  }

  tip.querySelector('h3').textContent = step.title;
  tip.querySelector('p').textContent = step.body;
  tip.querySelector('.tour-n').textContent = `${i + 1} / ${STEPS.length}`;
  tip.querySelector('[data-t="back"]').disabled = i === 0;
  tip.querySelector('[data-t="next"]').textContent = i === STEPS.length - 1 ? 'Done ✓' : 'Next →';

  // Tooltip below the target when there's room, above otherwise; centered fallback.
  tip.style.cssText = '';
  const th = tip.offsetHeight, tw = tip.offsetWidth;
  if (hidden) {
    tip.style.cssText = `left:${(innerWidth - tw) / 2}px;top:${(innerHeight - th) / 2}px`;
  } else {
    const below = r.bottom + 14 + th < innerHeight;
    const top = below ? r.bottom + 14 : Math.max(10, r.top - th - 14);
    const left = Math.max(10, Math.min(innerWidth - tw - 10, r.left + r.width / 2 - tw / 2));
    tip.style.cssText = `left:${left}px;top:${top}px`;
  }
}

function onKey(e) {
  if (e.key === 'Escape') endTour();
  else if (e.key === 'ArrowRight') move(1);
  else if (e.key === 'ArrowLeft') move(-1);
}

function move(delta) {
  const next = active + delta;
  if (next >= STEPS.length) { endTour(); return; }
  if (next < 0) return;
  active = next;
  place(active);
}

export function endTour() {
  if (!overlay) return;
  overlay.remove();
  overlay = null;
  active = -1;
  removeEventListener('keydown', onKey, true);
  removeEventListener('resize', onResize);
}

function onResize() { if (active >= 0) place(active); }

export function startTour() {
  endTour();
  overlay = document.createElement('div');
  overlay.id = 'tour';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-label', 'Guided tour');
  overlay.innerHTML = `
    <div class="tour-hl"></div>
    <div class="tour-tip panel">
      <h3></h3><p></p>
      <div class="tour-row">
        <span class="tour-n num"></span>
        <span style="flex:1"></span>
        <button data-t="back">← Back</button>
        <button data-t="next">Next →</button>
        <button data-t="end" aria-label="End tour">✕</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) { if (e.target === overlay) endTour(); return; }
    if (b.dataset.t === 'next') move(1);
    else if (b.dataset.t === 'back') move(-1);
    else if (b.dataset.t === 'end') endTour();
  });
  addEventListener('keydown', onKey, true);
  addEventListener('resize', onResize);
  active = 0;
  place(0);
  overlay.querySelector('[data-t="next"]').focus();
}
