/** Number formatting + count-up tween for the instrument-panel readouts. */

export const fmt = (v, dp = 1) => (Number.isFinite(v) ? v.toFixed(dp) : '∞');

export const reducedMotion = () =>
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Tween an element's text from its last value to `to`. Values tween over
 * ~450ms with cubic ease-out; reduced-motion and non-finite targets snap.
 */
export function countUp(el, to, { dp = 1, prefix = '', suffix = '' } = {}) {
  const from = parseFloat(el.dataset.v ?? '0') || 0;
  el.dataset.v = String(to);
  const render = (v) => { el.textContent = prefix + fmt(v, dp) + suffix; };
  if (reducedMotion() || !Number.isFinite(to) || Math.abs(to - from) < 10 ** -dp) {
    render(to);
    return;
  }
  const t0 = performance.now();
  const dur = 450;
  const ease = (t) => 1 - (1 - t) ** 3;
  const frame = (now) => {
    const p = Math.min(1, (now - t0) / dur);
    render(from + (to - from) * ease(p));
    if (p < 1) requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

/** "+12–38" style band text. */
export const bandText = (lo, hi, dp = 0) => `+${fmt(lo * 100, dp)}–${fmt(hi * 100, dp)}`;

const badgeTitles = {
  verified: 'Checked against the named public source at build time',
  reported: 'Public reporting on the live 2026 crisis',
  estimate: 'Derived or approximate — treat as indicative',
  illustrative: 'Model assumption, not a measurement',
  'brief-baseline': 'Reference value pending a fresh primary-source check',
  pending: 'Awaiting data — will be computed by the fetch pipeline',
};

export function statusBadge(status) {
  if (!status) return '';
  const title = badgeTitles[status] ?? status;
  return `<span class="status ${status}" title="${title}">${status}</span>`;
}

export function sourceLine(source, url, retrieved) {
  const link = url ? `<a href="${url}" target="_blank" rel="noopener">${source}</a>` : source;
  return `${link}${retrieved ? ` · retrieved ${retrieved}` : ''}`;
}
