/**
 * Operator map — MapLibre GL over Carto dark_matter (keyless, static-friendly).
 * All scenario visuals are driven by setPaintProperty from the model output:
 * flows thin out as disruption rises, bypass pipelines thicken as they absorb
 * diverted barrels, and stranded volume pools red at the narrows.
 */
import { reducedMotion } from './format.js';

const STYLE_URL = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

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

export function initMap(container, data, { onFeature } = {}) {
  const map = new maplibregl.Map({
    container,
    style: STYLE_URL,
    center: [53.6, 26.0],
    zoom: 5.1,
    minZoom: 3.5,
    maxZoom: 10,
    attributionControl: { compact: true },
  });
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');

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

  map.on('load', () => {
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
        'text-font': ['Montserrat Regular'],
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
        'text-font': ['Montserrat Regular'],
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
        'text-font': ['Montserrat Regular'],
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

    // Everything clickable reveals a sourced detail card
    for (const layer of ['terminals', 'pipelines', 'incidents', 'pinch-core', 'pinch-pool', 'shadow-zones']) {
      map.on('click', layer, (e) => {
        if (onFeature && e.features?.[0]) onFeature(e.features[0].properties, layer);
      });
      map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = ''; });
    }

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
  });

  const api = {
    map,
    ready: false,
    _pending: null,
    _pendingYear: null,
    _pendingLayers: null,

    /** Reroute the picture: sc is the model's scenario() output. */
    updateScenario(sc) {
      if (!this.ready) { this._pending = sc; return; }
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
