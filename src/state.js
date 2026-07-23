/**
 * URL-hash state — every view is shareable (Skywatch's #w=...&l=... pattern).
 *   #v=map&d=70&b=eia&y=2026&l=flows.pipelines.terminals.incidents&e=11
 * No localStorage anywhere; ?intro=skip in the query string suppresses the intro.
 */

const DEFAULTS = {
  v: 'map',            // view: map | insights | methodology
  d: 90,               // disruption %, defaults to the reported current ~90% transit drop
  b: 'eia',            // bypass profile: eia | expanded
  y: 2026,             // time-scrubber year
  e: 11,               // ε ×100 for the point estimate
  l: ['flows', 'pipelines', 'strait', 'terminals', 'incidents'],
};

const listeners = new Set();
let state = { ...DEFAULTS };

function parseHash() {
  const out = { ...DEFAULTS, l: [...DEFAULTS.l] };
  const h = new URLSearchParams(location.hash.replace(/^#/, ''));
  if (h.has('v') && ['map', 'insights', 'methodology'].includes(h.get('v'))) out.v = h.get('v');
  if (h.has('d')) out.d = Math.min(100, Math.max(0, parseInt(h.get('d'), 10) || 0));
  if (h.has('b') && ['eia', 'expanded'].includes(h.get('b'))) out.b = h.get('b');
  if (h.has('y')) out.y = Math.min(2026, Math.max(1980, parseInt(h.get('y'), 10) || 2026));
  if (h.has('e')) out.e = Math.min(20, Math.max(6, parseInt(h.get('e'), 10) || 11));
  if (h.has('l')) out.l = h.get('l').split('.').filter(Boolean);
  return out;
}

function writeHash() {
  const h = new URLSearchParams();
  h.set('v', state.v);
  h.set('d', String(state.d));
  h.set('b', state.b);
  h.set('y', String(state.y));
  h.set('e', String(state.e));
  h.set('l', state.l.join('.'));
  history.replaceState(null, '', `#${h.toString()}`);
}

export const store = {
  get: () => state,
  hasDeepLink: () => location.hash.length > 1,
  init() {
    state = parseHash();
    addEventListener('hashchange', () => {
      state = parseHash();
      listeners.forEach((fn) => fn(state));
    });
    return state;
  },
  set(patch) {
    state = { ...state, ...patch };
    writeHash();
    listeners.forEach((fn) => fn(state));
  },
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};
