/** The Narrows — scroll-driven intro on REAL geography (Natural Earth 1:50m,
 *  projected to SVG at build time by scripts/make-intro-geo.mjs). Skippable;
 *  remembered via ?intro=skip (no localStorage). */

/** Build the figure from the bundled coastline + true-coordinate overlays. */
function fig(coast) {
  const { lng0, lat1, k, s } = coast.proj;
  const X = (lng) => +((lng - lng0) * k).toFixed(1);
  const Y = (lat) => +((lat1 - lat) * s).toFixed(1);
  const P = (lng, lat) => `${X(lng)},${Y(lat)}`;

  // Real anchors
  const pinch = P(56.47, 26.5);                    // the narrows
  const [px, py] = pinch.split(',').map(Number);

  return `
<svg viewBox="${coast.viewBox}" aria-hidden="true">
  <style>
    .water { fill: #071626; }
    .land { fill: #0B1F3A; stroke: rgba(30,58,82,0.9); stroke-width: 0.7; }
    .lbl { fill: #9FB3C8; font: 11px ui-monospace, monospace; letter-spacing: 0.15em; }
    .lbl.sm { font-size: 8px; letter-spacing: 0.12em; opacity: 0.8; }
    .tdot { fill: #9FB3C8; opacity: 0.55; }
    .tdot.gold { fill: #D9B24A; opacity: 0.9; }
    .tdot.teal { fill: #2FB6A3; opacity: 0.9; }
    .flow { stroke: #38E1D6; stroke-width: 2.6; fill: none; stroke-linecap: round;
            stroke-dasharray: 5 9; animation: dashmove 1.6s linear infinite; }
    .flow.west { stroke-width: 2; opacity: 0.85; }
    .lngflow { stroke: #D9B24A; stroke-width: 2; }
    .pipe { stroke: #2FB6A3; stroke-width: 0; fill: none; stroke-linecap: round; transition: stroke-width 0.6s; }
    .pool { fill: #E4572E; opacity: 0; transition: opacity 0.6s; }
    .nm21 { opacity: 0; transition: opacity 0.5s; }
    .nm21 text { fill: #F2A93B; font: 10px ui-monospace, monospace; }
    .nm21 line { stroke: #F2A93B; stroke-width: 1.2; }
    @keyframes dashmove { to { stroke-dashoffset: -28; } }
    @media (prefers-reduced-motion: reduce) { .flow { animation: none; } }
    svg[data-step="0"] .nm21 { opacity: 1; }
    svg[data-step="2"] .pipe, svg[data-step="3"] .pipe, svg[data-step="4"] .pipe { stroke-width: 4; }
    svg[data-step="3"] .pool, svg[data-step="4"] .pool { opacity: 0.5; }
    svg[data-step="3"] .flow.through, svg[data-step="4"] .flow.through { opacity: 0.14; }
  </style>

  <rect class="water" x="0" y="0" width="100%" height="100%"/>
  <path class="land" d="${coast.land}"/>

  <text class="lbl" x="${X(51.5)}" y="${Y(29.6)}">IRAN</text>
  <text class="lbl" x="${X(46.6)}" y="${Y(24.4)}">SAUDI ARABIA</text>
  <text class="lbl sm" x="${X(50.6)}" y="${Y(25.0)}">QATAR</text>
  <text class="lbl sm" x="${X(53.6)}" y="${Y(23.5)}">UAE</text>
  <text class="lbl sm" x="${X(57.4)}" y="${Y(23.3)}">OMAN</text>
  <text class="lbl sm" x="${X(57.35)}" y="${Y(24.35)}">GULF OF OMAN →</text>

  <!-- export terminals & bypass outlets, true positions -->
  <circle class="tdot" cx="${X(48.8)}" cy="${Y(29.68)}" r="2.4"/>
  <circle class="tdot" cx="${X(50.32)}" cy="${Y(29.23)}" r="2.4"/>
  <circle class="tdot" cx="${X(50.16)}" cy="${Y(26.64)}" r="2.4"/>
  <circle class="tdot gold" cx="${X(51.58)}" cy="${Y(25.91)}" r="2.6"/>
  <circle class="tdot teal" cx="${X(56.35)}" cy="${Y(25.17)}" r="2.6"/>
  <circle class="tdot teal" cx="${X(57.77)}" cy="${Y(25.64)}" r="2.6"/>

  <!-- flows into and through the strait (real waypoints) -->
  <path class="flow through" d="M${P(48.7, 29.5)} C${P(50.0, 28.2)} ${P(51.6, 27.4)} ${P(53.2, 26.9)} C${P(54.8, 26.5)} ${P(55.8, 26.45)} ${pinch} C${P(57.2, 25.9)} ${P(58.5, 25.1)} ${P(60.2, 24.2)}"/>
  <path class="flow through west" d="M${P(50.16, 26.6)} C${P(52.0, 26.4)} ${P(54.5, 26.3)} ${pinch}" style="animation-delay:0.3s"/>
  <path class="flow through lngflow" d="M${P(51.58, 25.91)} C${P(53.2, 25.7)} ${P(55.2, 26.0)} ${pinch}" style="animation-delay:0.6s"/>

  <!-- bypass pipelines: Petroline west to the Red Sea, ADCOP to Fujairah, Goreh–Jask -->
  <path class="pipe" d="M${P(49.67, 25.94)} C${P(48.0, 25.3)} ${P(46.5, 24.8)} 0,${Y(24.3)}"/>
  <path class="pipe" d="M${P(53.61, 23.75)} C${P(54.8, 24.5)} ${P(55.8, 24.9)} ${P(56.35, 25.17)}"/>
  <path class="pipe" style="stroke-width:0" d="M${P(50.53, 29.58)} C${P(53.0, 28.3)} ${P(56.0, 26.9)} ${P(57.77, 25.64)}"/>

  <!-- stranded pool at the narrows -->
  <circle class="pool" cx="${px}" cy="${py}" r="30"/>

  <!-- the 21-nautical-mile bracket across the actual narrows -->
  <g class="nm21">
    <line x1="${px}" y1="${py - 13}" x2="${px}" y2="${py + 13}"/>
    <text x="${px + 10}" y="${py - 14}">21 nm</text>
  </g>
</svg>`;
}

const STEPS = [
  {
    h: 'Twenty-one nautical miles of water.',
    p: 'At its narrowest, the Strait of Hormuz squeezes the entire seaborne output of the Persian Gulf into two shipping lanes, each two miles wide. There is no other way out by sea.',
  },
  {
    big: '20.9 <small>M barrels/day</small>', cls: 'cyan',
    p: 'The number the headlines quote: a fifth of the world’s oil, plus a fifth of its LNG, through one chokepoint. (EIA, H1 2025.)',
  },
  {
    big: '−2.6 <small>can escape</small>', cls: 'teal',
    p: 'What the headlines skip: two pipelines — Petroline to the Red Sea, Habshan–Fujairah to the Gulf of Oman — can carry some barrels around the strait. Spare bypass, not nameplate, is the honest number.',
  },
  {
    big: '18.3 <small>M b/d stranded</small>', cls: 'crim',
    p: 'At full closure, that’s what has nowhere to go — 18% of world supply. And the burden is uneven: Kuwait and Qatar strand everything. A fifth of the world’s LNG has no escape at all.',
  },
  {
    h: 'History says threat spikes mean-revert. This time, barrels are actually missing.',
    p: 'Drag the disruption slider. Watch the bypass absorb what it can, the exposure board re-rank, and the price band move. Every figure links to its public source.',
    enter: true,
  },
];

export function showIntro(onEnter, coast) {
  const el = document.getElementById('intro');
  el.innerHTML = `
    <button class="skip">Skip intro →</button>
    <div class="sticky-fig">${fig(coast)}</div>
    ${STEPS.map((s, i) => `
      <section class="narrows-step" data-step="${i}">
        ${s.big ? `<div class="big ${s.cls}">${s.big.replace('<small>', '<small style="font-size:0.35em;color:var(--ink-dim)">')}</div>` : ''}
        ${s.h ? `<h2>${s.h}</h2>` : ''}
        <p>${s.p}</p>
        ${s.enter ? '<button class="enter">Enter the model →</button>' : ''}
      </section>`).join('')}
    <div style="height:12vh"></div>`;
  el.hidden = false;

  const svg = el.querySelector('svg');
  const steps = [...el.querySelectorAll('.narrows-step')];
  svg.dataset.step = '0';
  steps[0].classList.add('active');
  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        steps.forEach((s) => s.classList.toggle('active', s === entry.target));
        svg.dataset.step = entry.target.dataset.step;
      }
    }
  }, { root: el, threshold: 0.55 });
  steps.forEach((s) => io.observe(s));

  const dismiss = () => {
    io.disconnect();
    el.hidden = true;
    el.innerHTML = '';
    // Remember the skip in the URL, not localStorage
    history.replaceState(null, '', `${location.pathname}?intro=skip${location.hash}`);
    onEnter();
  };
  el.querySelector('.skip').addEventListener('click', dismiss);
  el.querySelector('.enter').addEventListener('click', dismiss);
}

export const shouldShowIntro = () =>
  !new URLSearchParams(location.search).has('intro') && location.hash.length <= 1;
