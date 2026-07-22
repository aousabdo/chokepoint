/* Chokepoint service worker — full offline after first visit.
 *
 * Strategy: stale-while-revalidate for same-origin GETs (the first visit loads
 * every surface's assets anyway, so coverage is complete in practice), plus a
 * range-aware handler for the PMTiles basemap: the archive is cached whole
 * once, then 206 slices are served from the cached copy — the map works with
 * the network fully gone. Bump VERSION to invalidate after deploys with
 * breaking asset changes (normal deploys self-heal via revalidation).
 */
const VERSION = 'chokepoint-v1';
const PMTILES = 'vendor/basemap.pmtiles';

const CORE = [
  './', 'index.html', 'favicon.svg', 'manifest.webmanifest',
  'css/tokens.css', 'css/base.css', 'css/layout.css', 'css/components.css', 'css/print.css',
  'src/main.js', 'src/data.js', 'src/model.js', 'src/format.js', 'src/state.js',
  'src/ui.js', 'src/map.js', 'src/insights.js', 'src/methodology.js', 'src/intro.js',
  'src/tour.js', 'src/brief.js',
  'vendor/maplibre-gl.js', 'vendor/maplibre-gl.css', 'vendor/pmtiles.js', 'vendor/basemap-style.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('chokepoint-') && k !== VERSION && k !== `${VERSION}-pmtiles`).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function serveRange(request) {
  const cache = await caches.open(`${VERSION}-pmtiles`);
  let full = await cache.match(PMTILES);
  if (!full) {
    const resp = await fetch(PMTILES); // plain GET → 200, whole archive, once
    if (!resp.ok || resp.status !== 200) return fetch(request);
    await cache.put(PMTILES, resp.clone());
    full = resp;
  }
  const blob = await full.blob();
  const m = /bytes=(\d+)-(\d*)/.exec(request.headers.get('range') ?? '');
  if (!m) return new Response(blob);
  const start = Number(m[1]);
  const end = m[2] ? Math.min(Number(m[2]), blob.size - 1) : blob.size - 1;
  const slice = blob.slice(start, end + 1); // Blob slicing is lazy — no 33MB copies
  return new Response(slice, {
    status: 206,
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Range': `bytes ${start}-${end}/${blob.size}`,
      'Content-Length': String(slice.size),
    },
  });
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(VERSION);
  const cached = await cache.match(request, { ignoreSearch: request.mode === 'navigate' });
  const refresh = fetch(request)
    .then((resp) => {
      if (resp.ok && resp.status === 200) cache.put(request, resp.clone());
      return resp;
    })
    .catch(() => null);
  if (cached) { refresh.catch(() => {}); return cached; }
  const fresh = await refresh;
  if (fresh) return fresh;
  if (request.mode === 'navigate') {
    const shell = await cache.match('index.html');
    if (shell) return shell;
  }
  return Response.error();
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.endsWith('basemap.pmtiles')) {
    event.respondWith(serveRange(event.request));
    return;
  }
  event.respondWith(staleWhileRevalidate(event.request));
});
