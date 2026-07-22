/**
 * Operator map — MapLibre GL over Carto dark_matter (keyless, static-friendly).
 * All scenario visuals are driven by setPaintProperty from the model output:
 * flows thin out as disruption rises, bypass pipelines thicken as they absorb
 * diverted barrels, and stranded volume pools red at the narrows.
 */
import { reducedMotion } from './format.js';

// Basemap resolution, fully offline first: a Protomaps PMTiles extract of the
// Gulf plus a vendored style/fonts/sprites (OSM data, open license) — the whole
// map runs from this repo with zero external requests. Fallbacks: vendored
// Carto style (remote tiles), then Carto's remote style. Styles MUST be passed
// to MapLibre as URLs, not parsed objects: style objects load via a
// requestAnimationFrame-deferred path, and rAF never fires in a backgrounded
// tab — the style would sit unparsed until foregrounded. URL styles parse in
// the network callback instead. (Same root cause as the layer-setup rule
// below: never gate on rAF-driven readiness signals like the 'load' event.)
const STYLE_OFFLINE = 'vendor/basemap-style.json';
const PMTILES_FILE = 'vendor/basemap.pmtiles';
const STYLE_CARTO_LOCAL = 'vendor/carto-dark-matter.style.json';
const STYLE_CARTO_REMOTE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

const COLORS = {
  cyan: '#38E1D6',
  teal: '#2FB6A3',
  crim: '#E4572E',
  amber: '#F2A93B',
  gold: '#D9B24A',
  dim: '#9FB3C8',
};

const EXPOSURE_COLOR = ['match', ['get', 'exposure'],
  'total', COLORS.crim,
  'high', COLORS.amber,
  'partial', COLORS.teal,
  COLORS.dim];

/** Layer-toggle groups exposed to the left rail. */
export const LAYER_GROUPS = [
  { id: 'flows', label: 'Oil & LNG flows', swatch: COLORS.cyan, layers: ['flows', 'flow-exit'] },
  { id: 'pipelines', label: 'Bypass pipelines', swatch: COLORS.teal, layers: ['pipelines', 'pipeline-labels'] },
  { id: 'strait', label: 'Strait lanes & stranded pool', swatch: COLORS.crim, layers: ['strait-lanes', 'pinch-pool', 'pinch-core'] },
  { id: 'terminals', label: 'Export terminals', swatch: COLORS.amber, layers: ['terminals', 'terminal-labels'] },
  { id: 'incidents', label: 'Incidents (historical)', swatch: COLORS.gold, layers: ['incidents'] },
  { id: 'shadow', label: 'Shadow-fleet patterns', swatch: COLORS.amber, layers: ['shadow-zones', 'shadow-outline', 'shadow-labels'] },
];

export async function initMap(container, data, { onFeature } = {}) {
  let style = STYLE_CARTO_REMOTE;
  let offline = false;
  try {
    if (typeof pmtiles !== 'undefined') {
      const res = await fetch(PMTILES_FILE, { method: 'HEAD' });
      if (res.ok) {
        maplibregl.addProtocol('pmtiles', new pmtiles.Protocol().tile);
        style = STYLE_OFFLINE;
        offline = true;
      }
    }
    if (!offline) {
      const res = await fetch(STYLE_CARTO_LOCAL, { method: 'HEAD' });
      if (res.ok) style = STYLE_CARTO_LOCAL;
    }
  } catch { /* fall through to the remote style URL */ }
  // Overlay labels must use a font the active glyph endpoint can serve.
  const overlayFont = offline ? 'Noto Sans Medium' : 'Montserrat Regular';

  // On phones the bottom sheet covers the lower map — bias the fit upward.
  const mobile = matchMedia('(max-width: 860px)').matches;
  const map = new maplibregl.Map({
    container,
    style,
    bounds: [[45.5, 22.0], [61.5, 30.5]],
    fitBoundsOptions: {
      padding: mobile
        ? { top: 16, left: 16, right: 16, bottom: Math.round(innerHeight * 0.38) }
        : 30,
    },
    minZoom: 3.5,
    maxZoom: 10,
    attributionControl: { compact: true },
  });
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
  if (typeof window !== 'undefined') window.__chokepointMap = map; // dev console access

  // Incidents come from the escalation ladder — only entries with coordinates.
  const incidents = {
    type: 'FeatureCollection',
    features: data.events
      .filter((e) => e.lat != null)
      .map((e) => ({
        type: 'Feature',
        properties: { ...e, year: parseInt(e.date.slice(0, 4), 10), kindTag: 'incident' },
        geometry: { type: 'Point', coordinates: [e.lng, e.lat] },
      })),
  };

  let dashTimer = null;

  // Don't gate on the 'load' event: it only fires after render frames, and a
  // backgrounded tab gets no requestAnimationFrame ticks — users who open the
  // site in a background tab would get a basemap with every overlay missing.
  // Layers only need the parsed style; 'styledata' fires from the style's
  // network callback, so set up there and retry until the style accepts layers.
  const setupLayers = () => {
    map.addSource('flows', { type: 'geojson', data: data.geo.flows });
    map.addSource('pipelines', { type: 'geojson', data: data.geo.pipelines });
    map.addSource('strait', { type: 'geojson', data: data.geo.strait });
    map.addSource('terminals', { type: 'geojson', data: data.geo.terminals });
    map.addSource('incidents', { type: 'geojson', data: incidents });
    map.addSource('shadow', { type: 'geojson', data: data.geo.shadow });

    // Shadow-fleet pattern zones (off by default; pattern-level, never vessel-specific)
    map.addLayer({
      id: 'shadow-zones', type: 'fill', source: 'shadow',
      paint: { 'fill-color': COLORS.amber, 'fill-opacity': 0.07 },
    });
    map.addLayer({
      id: 'shadow-outline', type: 'line', source: 'shadow',
      paint: { 'line-color': COLORS.amber, 'line-width': 1, 'line-dasharray': [3, 3], 'line-opacity': 0.5 },
    });
    map.addLayer({
      id: 'shadow-labels', type: 'symbol', source: 'shadow',
      layout: {
        'text-field': ['get', 'pattern'],
        'text-font': [overlayFont],
        'text-size': 9.5,
      },
      paint: { 'text-color': COLORS.amber, 'text-halo-color': '#06121F', 'text-halo-width': 1.2, 'text-opacity': 0.85 },
    });

    // Flow trunks into the strait
    map.addLayer({
      id: 'flows', type: 'line', source: 'flows',
      filter: ['!=', ['get', 'id'], 'trunk-exit'],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': ['match', ['get', 'kind'], 'lng', COLORS.gold, COLORS.cyan],
        'line-width': ['interpolate', ['linear'], ['get', 'volume_mbd'], 1, 1.6, 10, 4.5],
        'line-opacity': 0.75,
        'line-dasharray': [0, 2.2, 1.8],
      },
    });
    // What escapes through the strait
    map.addLayer({
      id: 'flow-exit', type: 'line', source: 'flows',
      filter: ['==', ['get', 'id'], 'trunk-exit'],
      layout: { 'line-cap': 'round' },
      paint: {
        'line-color': COLORS.cyan,
        'line-width': 5,
        'line-opacity': 0.8,
        'line-dasharray': [0, 2.2, 1.8],
      },
    });

    // Bypass pipelines — the escape routes
    map.addLayer({
      id: 'pipelines', type: 'line', source: 'pipelines',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': COLORS.teal, 'line-width': 2, 'line-opacity': 0.55 },
    });
    map.addLayer({
      id: 'pipeline-labels', type: 'symbol', source: 'pipelines',
      layout: {
        'symbol-placement': 'line-center',
        'text-field': ['get', 'name'],
        'text-font': [overlayFont],
        'text-size': 10,
        'text-offset': [0, 1],
      },
      paint: { 'text-color': COLORS.teal, 'text-halo-color': '#06121F', 'text-halo-width': 1.4 },
    });

    // Strait TSS lanes + the stranded pool at the narrows
    map.addLayer({
      id: 'strait-lanes', type: 'line', source: 'strait',
      filter: ['==', ['get', 'kind'], 'lane'],
      paint: { 'line-color': COLORS.dim, 'line-width': 1.1, 'line-opacity': 0.6, 'line-dasharray': [2, 2] },
    });
    map.addLayer({
      id: 'pinch-pool', type: 'circle', source: 'strait',
      filter: ['==', ['get', 'kind'], 'pinch'],
      paint: {
        'circle-color': COLORS.crim, 'circle-radius': 6, 'circle-opacity': 0.16,
        'circle-blur': 0.55,
      },
    });
    map.addLayer({
      id: 'pinch-core', type: 'circle', source: 'strait',
      filter: ['==', ['get', 'kind'], 'pinch'],
      paint: { 'circle-color': COLORS.crim, 'circle-radius': 3, 'circle-opacity': 0.9 },
    });

    // Terminals sized by exports, coloured by exposure; bypass outlets ringed white
    map.addLayer({
      id: 'terminals', type: 'circle', source: 'terminals',
      paint: {
        'circle-color': EXPOSURE_COLOR,
        'circle-radius': ['+', 3.5, ['*', 1.6, ['sqrt', ['get', 'exports_mbd']]]],
        'circle-opacity': 0.85,
        'circle-stroke-color': ['match', ['get', 'kind'], 'bypass-outlet', '#E6EEF6', 'rgba(6,18,31,0.9)'],
        'circle-stroke-width': ['match', ['get', 'kind'], 'bypass-outlet', 1.6, 1],
      },
    });
    map.addLayer({
      id: 'terminal-labels', type: 'symbol', source: 'terminals',
      minzoom: 5.2,
      layout: {
        'text-field': ['get', 'name'],
        'text-font': [overlayFont],
        'text-size': 10.5,
        'text-offset': [0, 1.1],
        'text-anchor': 'top',
      },
      paint: { 'text-color': COLORS.dim, 'text-halo-color': '#06121F', 'text-halo-width': 1.4 },
    });

    // Historical / reported incidents, filtered by the time scrubber
    map.addLayer({
      id: 'incidents', type: 'circle', source: 'incidents',
      paint: {
        'circle-color': 'rgba(228,87,46,0.55)',
        'circle-radius': 5,
        'circle-stroke-color': COLORS.amber,
        'circle-stroke-width': 1.4,
      },
    });

    // Everything clickable reveals a sourced detail card. One handler with an
    // explicit priority so overlapping features (incidents inside the stranded
    // pool) resolve to the most specific card, not the last-registered one.
    const CLICK_PRIORITY = ['incidents', 'terminals', 'pipelines', 'pinch-core', 'pinch-pool', 'shadow-zones'];
    map.on('click', (e) => {
      const feats = map.queryRenderedFeatures(e.point, { layers: CLICK_PRIORITY.filter((l) => map.getLayer(l)) });
      if (!feats.length) { api.clearHighlight(); return; } // open water clears the route highlight
      if (!onFeature) return;
      feats.sort((a, b) => CLICK_PRIORITY.indexOf(a.layer.id) - CLICK_PRIORITY.indexOf(b.layer.id));
      const hit = feats[0];
      const props = hit.properties;
      // Origin-on-demand: a terminal lights the trunk it rides (bypass outlets
      // light their pipeline) instead of spending permanent palette on origins.
      if (hit.layer.id === 'terminals') {
        if (props.trunk) api.setHighlight({ kind: 'trunk', id: props.trunk });
        else if (props.pipeline) api.setHighlight({ kind: 'pipeline', id: props.pipeline });
      } else if (hit.layer.id === 'pipelines') {
        api.setHighlight({ kind: 'pipeline', id: props.id });
      }
      // Incident/pinch/shadow clicks leave any route highlight in place —
      // only open water, Esc or the card's ✕ clears it.
      onFeature(props, hit.layer.id === 'pinch-core' ? 'pinch-pool' : hit.layer.id);
    });
    map.on('mousemove', (e) => {
      const feats = map.queryRenderedFeatures(e.point, { layers: CLICK_PRIORITY.filter((l) => map.getLayer(l)) });
      map.getCanvas().style.cursor = feats.length ? 'pointer' : '';
    });

    // Animate flow dashes — thin moving pulses along the routes
    if (!reducedMotion()) {
      const seq = [
        [0, 2.2, 1.8], [0.4, 2.2, 1.4], [0.8, 2.2, 1.0], [1.2, 2.2, 0.6],
        [1.6, 2.2, 0.2], [1.8, 0.2, 2.2], [1.4, 0.6, 2.2], [1.0, 1.0, 2.2], [0.5, 1.6, 2.2],
      ];
      let step = 0;
      dashTimer = setInterval(() => {
        step = (step + 1) % seq.length;
        if (map.getLayer('flows')) {
          map.setPaintProperty('flows', 'line-dasharray', seq[step]);
          map.setPaintProperty('flow-exit', 'line-dasharray', seq[step]);
        }
      }, 120);
    }

    api.ready = true;
    if (api._pending) { api.updateScenario(api._pending); api._pending = null; }
    if (api._pendingYear != null) { api.setYear(api._pendingYear); api._pendingYear = null; }
    if (api._pendingLayers) { api.setLayers(api._pendingLayers); api._pendingLayers = null; }
  };

  const trySetup = () => {
    if (api.ready) return;
    try { setupLayers(); } catch { map.once('styledata', trySetup); }
  };
  map.once('styledata', trySetup);
  map.on('load', trySetup);

  const api = {
    map,
    ready: false,
    _pending: null,
    _pendingYear: null,
    _pendingLayers: null,

    /** Reroute the picture: sc is the model's scenario() output. */
    updateScenario(sc) {
      if (!this.ready) { this._pending = sc; return; }
      this._lastSc = sc;
      const d = sc.d;
      // Through-flows fade with disruption
      map.setPaintProperty('flows', 'line-opacity', Math.max(0.12, 0.78 * (1 - d)));
      map.setPaintProperty('flow-exit', 'line-opacity', Math.max(0.1, 0.85 * (1 - d)));
      map.setPaintProperty('flow-exit', 'line-width', Math.max(1, 5 * (1 - d) + 0.5));
      // Bypass pipelines visibly thicken as they absorb diverted flow
      const w = (id) => {
        const u = sc.pipelines[id];
        const frac = u && u.spare > 0 ? u.used / u.spare : 0;
        return 1.6 + 5.5 * frac;
      };
      map.setPaintProperty('pipelines', 'line-width',
        ['match', ['get', 'id'], 'petroline', w('petroline'), 'adcop', w('adcop'), 'jask', w('jask'), 2]);
      map.setPaintProperty('pipelines', 'line-opacity', 0.45 + 0.5 * Math.min(1, d * 1.6));
      // Stranded volume pools red at the narrows
      map.setPaintProperty('pinch-pool', 'circle-radius', 6 + sc.stranded * 3.2);
      map.setPaintProperty('pinch-pool', 'circle-opacity', Math.min(0.55, 0.12 + sc.share * 2.2));
      this._applyHighlight();
    },

    /** Route highlight: dim everything but the selected trunk/pipeline. Opacity-only
     *  for pipelines — their width encodes utilisation and must not be distorted. */
    _highlight: null,
    _lastSc: null,
    _applyHighlight() {
      if (!this.ready || !this._highlight) return;
      const { kind, id } = this._highlight;
      if (kind === 'trunk') {
        map.setPaintProperty('flows', 'line-opacity', ['case', ['==', ['get', 'id'], id], 0.95, 0.06]);
        map.setPaintProperty('flows', 'line-width', ['case', ['==', ['get', 'id'], id], 5.5,
          ['interpolate', ['linear'], ['get', 'volume_mbd'], 1, 1.6, 10, 4.5]]);
      } else {
        map.setPaintProperty('pipelines', 'line-opacity', ['case', ['==', ['get', 'id'], id], 1, 0.12]);
      }
    },
    setHighlight(h) {
      this._highlight = h;
      if (this._lastSc) this.updateScenario(this._lastSc);
      else this._applyHighlight();
    },
    clearHighlight() {
      if (!this._highlight) return;
      this._highlight = null;
      if (this._lastSc) this.updateScenario(this._lastSc);
    },

    setYear(y) {
      if (!this.ready) { this._pendingYear = y; return; }
      map.setFilter('incidents', ['<=', ['get', 'year'], y]);
    },

    setLayers(active) {
      if (!this.ready) { this._pendingLayers = active; return; }
      for (const g of LAYER_GROUPS) {
        const vis = active.includes(g.id) ? 'visible' : 'none';
        for (const id of g.layers) {
          if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', vis);
        }
      }
    },

    resize() { map.resize(); },
    destroy() { if (dashTimer) clearInterval(dashTimer); map.remove(); },
  };

  return api;
}
