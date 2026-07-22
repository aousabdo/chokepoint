/** Chokepoint bootstrap: data → state → shell → (intro) → map + insights + methodology. */
import { loadAll } from './data.js';
import { scenario } from './model.js';
import { store } from './state.js';
import { initShell, syncControls, renderReadouts, showDetail, downloadBrief } from './ui.js';
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
  return scenario(s.d, data.config, data.producers, s.b, s.e / 100);
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
  mapApi = initMap('map', data, {
    onFeature: (props, layer) => showDetail(props, layer, data),
  });
  render(store.get());
}

document.getElementById('brief-btn').addEventListener('click', () => {
  downloadBrief(currentScenario, store.get(), data);
});

store.subscribe(render);
render(s0);

if (shouldShowIntro()) {
  showIntro(bootMap);
} else {
  bootMap();
}
