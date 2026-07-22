/** Chokepoint bootstrap: data → state → shell → (intro) → map + insights + methodology. */
import { loadAll } from './data.js';
import { scenario } from './model.js';
import { store } from './state.js';
import { initShell, syncControls, renderReadouts, showDetail } from './ui.js';
import { downloadBrief, buildBrief } from './brief.js';
import { initInsights } from './insights.js';
import { renderMethodology } from './methodology.js';
import { showIntro, shouldShowIntro } from './intro.js';

const data = await loadAll();
const s0 = store.init();

initShell(data);
const updateInsights = initInsights(document.getElementById('insights-root'), data);
renderMethodology(document.getElementById('methodology-root'), data);

let mapApi = null;
let currentScenario = null;

function compute(s) {
  return scenario(s.d, data.config, data.producers, s.b, s.e / 100, data.importers);
}

function render(s) {
  syncControls(s);
  currentScenario = compute(s);
  renderReadouts(currentScenario);
  if (mapApi) {
    mapApi.updateScenario(currentScenario);
    mapApi.setYear(s.y);
    mapApi.setLayers(s.l);
    if (s.v === 'map') mapApi.resize();
  }
  if (s.v === 'insights') updateInsights(currentScenario, s);
}

// Lazy-load the heavy map after the scrollytelling intro (build brief §10)
async function bootMap() {
  if (mapApi) return;
  const { initMap } = await import('./map.js');
  mapApi = await initMap('map', data, {
    onFeature: (props, layer) => showDetail(props, layer, data),
  });
  render(store.get());
}

document.getElementById('brief-btn').addEventListener('click', () => {
  downloadBrief(currentScenario, store.get(), data);
});

document.getElementById('tour-btn').addEventListener('click', async () => {
  await bootMap(); // the tour spotlights map-rail elements
  const { startTour } = await import('./tour.js');
  startTour();
});

// Esc or the card's ✕ dismisses the detail card and the route highlight
addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !document.getElementById('tour')) {
    document.getElementById('detail-card').hidden = true;
    mapApi?.clearHighlight();
  }
});
document.getElementById('detail-card').addEventListener('click', (e) => {
  if (e.target.classList.contains('close')) mapApi?.clearHighlight();
});

store.subscribe(render);
render(s0);

// ?brief=1 pre-populates the print brief so `chrome --headless --print-to-pdf`
// (or the user hitting ⌘P on a shared link) exports it without clicking anything.
if (new URLSearchParams(location.search).has('brief')) {
  buildBrief(currentScenario, store.get(), data);
}

if (shouldShowIntro()) {
  showIntro(bootMap, data.geo.introCoast);
} else {
  bootMap();
}
