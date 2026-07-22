#!/usr/bin/env node
/**
 * Build the intro's real coastline from Natural Earth 1:50m admin-0 countries
 * (public domain). Projects the Gulf region to SVG coordinates, decimates to
 * ~1px fidelity, and writes data/geo/intro-coast.json (a few KB) so The
 * Narrows opens on real geography without shipping a map engine.
 *
 *   node scripts/make-intro-geo.mjs
 */
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const NE_URL = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson';
const COUNTRIES = new Set(['Iran', 'Iraq', 'Kuwait', 'Saudi Arabia', 'Bahrain', 'Qatar', 'United Arab Emirates', 'Oman']);

// Frame: Persian Gulf centered, strait at the right third, Gulf of Oman exit visible.
const BBOX = { lng0: 45.0, lng1: 61.0, lat0: 23.0, lat1: 31.0 };
const WIDTH = 640;
const midLat = (BBOX.lat0 + BBOX.lat1) / 2;
const k = WIDTH / (BBOX.lng1 - BBOX.lng0);                 // px per degree lng
const s = k / Math.cos((midLat * Math.PI) / 180);          // px per degree lat (equirect aspect)
const HEIGHT = Math.round((BBOX.lat1 - BBOX.lat0) * s);

const X = (lng) => (lng - BBOX.lng0) * k;
const Y = (lat) => (BBOX.lat1 - lat) * s;

const res = await fetch(NE_URL);
if (!res.ok) { console.error(`Natural Earth fetch failed: ${res.status}`); process.exit(1); }
const world = await res.json();

const PAD = 1.0;
const inFrame = (ring) => ring.some(([lng, lat]) =>
  lng > BBOX.lng0 - PAD && lng < BBOX.lng1 + PAD && lat > BBOX.lat0 - PAD && lat < BBOX.lat1 + PAD);

/** Radial-distance decimation at ~1.1px so Musandam and Qeshm keep their shape. */
function decimate(pts) {
  const out = [pts[0]];
  for (const p of pts) {
    const q = out[out.length - 1];
    if (Math.hypot(p[0] - q[0], p[1] - q[1]) >= 1.1) out.push(p);
  }
  if (out.length > 2) out.push(pts[pts.length - 1]);
  return out;
}

let path = '';
let rings = 0;
for (const f of world.features) {
  const name = f.properties.ADMIN ?? f.properties.NAME;
  if (!COUNTRIES.has(name)) continue;
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  for (const poly of polys) {
    const outer = poly[0];
    if (!inFrame(outer)) continue;
    const projected = decimate(outer.map(([lng, lat]) => [X(lng), Y(lat)]));
    if (projected.length < 4) continue;
    path += `M${projected.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join('L')}Z`;
    rings += 1;
  }
}

const out = {
  note: 'Real coastline for The Narrows intro — Natural Earth 1:50m admin-0, public domain, equirectangular projection clipped to the Gulf frame. Regenerate with scripts/make-intro-geo.mjs.',
  source: 'Natural Earth 1:50m admin-0 countries',
  url: 'https://www.naturalearthdata.com/',
  retrieved: new Date().toISOString().slice(0, 10),
  viewBox: `0 0 ${WIDTH} ${HEIGHT}`,
  proj: { lng0: BBOX.lng0, lat1: BBOX.lat1, k: +k.toFixed(4), s: +s.toFixed(4) },
  land: path,
};
writeFileSync(join(ROOT, 'data/geo/intro-coast.json'), `${JSON.stringify(out)}\n`);
console.log(`intro-coast.json: ${rings} coastline rings, ${(path.length / 1024).toFixed(1)} KB of path data, viewBox 0 0 ${WIDTH} ${HEIGHT}`);
