/** The Narrows — scroll-driven intro. Skippable; remembered via ?intro=skip (no localStorage). */

const FIG = `
<svg viewBox="0 0 640 300" aria-hidden="true">
  <style>
    .land { fill: #0B1F3A; stroke: rgba(30,58,82,0.8); stroke-width: 1; }
    .lbl { fill: #9FB3C8; font: 11px monospace; letter-spacing: 0.15em; }
    .flow { stroke: #38E1D6; stroke-width: 3; fill: none; stroke-linecap: round;
            stroke-dasharray: 6 10; animation: dashmove 1.6s linear infinite; }
    .lngflow { stroke: #D9B24A; }
    .pipe { stroke: #2FB6A3; stroke-width: 0; fill: none; stroke-linecap: round; transition: stroke-width 0.6s; }
    .pool { fill: #E4572E; opacity: 0; transition: opacity 0.6s, r 0.6s; }
    .nm21 { opacity: 0; transition: opacity 0.5s; }
    .nm21 text { fill: #F2A93B; font: 10px monospace; }
    .nm21 line { stroke: #F2A93B; stroke-width: 1; }
    @keyframes dashmove { to { stroke-dashoffset: -32; } }
    @media (prefers-reduced-motion: reduce) { .flow { animation: none; } }
    svg[data-step="0"] .nm21 { opacity: 1; }
    svg[data-step="2"] .pipe, svg[data-step="3"] .pipe { stroke-width: 4; }
    svg[data-step="3"] .pool, svg[data-step="4"] .pool { opacity: 0.55; }
    svg[data-step="3"] .flow.through, svg[data-step="4"] .flow.through { opacity: 0.15; }
  </style>
  <!-- Iran, top -->
  <path class="land" d="M0,0 H640 V64 L560,70 L500,92 L452,96 L430,112 L400,96 L340,72 L240,84 L120,70 L0,52 Z"/>
  <!-- Arabia with the Musandam spike, bottom -->
  <path class="land" d="M0,300 V150 L60,140 L150,150 L240,168 L330,192 L392,206 L410,196 L424,146 L438,150 L446,204 L520,224 L640,240 V300 Z"/>
  <text class="lbl" x="70" y="34">IRAN</text>
  <text class="lbl" x="60" y="255">SAUDI ARABIA · UAE</text>
  <text class="lbl" x="452" y="248">GULF OF OMAN →</text>
  <!-- the 21nm bracket at the narrows -->
  <g class="nm21">
    <line x1="431" y1="116" x2="431" y2="142"/>
    <text x="376" y="133">21 nm</text>
  </g>
  <!-- flows into and through the strait -->
  <path class="flow through" d="M60,120 C 200,130 330,128 430,128 S 560,180 620,210"/>
  <path class="flow lngflow through" d="M250,150 C 330,142 390,132 430,130" style="animation-delay:0.4s"/>
  <!-- bypass pipes: Petroline west, ADCOP to Fujairah -->
  <path class="pipe" d="M240,172 C 160,190 80,200 10,206"/>
  <path class="pipe" d="M370,200 C 420,214 440,210 452,206"/>
  <!-- stranded pool at the narrows -->
  <circle class="pool" cx="430" cy="128" r="26"/>
</svg>`;

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

export function showIntro(onEnter) {
  const el = document.getElementById('intro');
  el.innerHTML = `
    <button class="skip">Skip intro →</button>
    <div class="sticky-fig">${FIG}</div>
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
