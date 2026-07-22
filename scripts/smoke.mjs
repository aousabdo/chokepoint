#!/usr/bin/env node
/**
 * E2E smoke test — boots the real site in headless Chrome and asserts the
 * rendered DOM: model readouts computed, all surfaces populated, verified
 * event-study data present, offline stack wired. Run before any demo/deploy.
 *
 *   npm run smoke          (starts its own dev server on :5391)
 */
import { spawn, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const PORT = 5391;
const CHROME = process.env.CHROME
  ?? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium']
    .find((p) => existsSync(p));

if (!CHROME) {
  console.error('smoke: no Chrome/Chromium found (set CHROME=/path/to/chrome)');
  process.exit(1);
}

const server = spawn('python3', ['scripts/dev.py'], {
  env: { ...process.env, PORT: String(PORT) },
  stdio: 'ignore',
});

const up = async () => {
  for (let i = 0; i < 40; i += 1) {
    try {
      const r = await fetch(`http://localhost:${PORT}/index.html`);
      if (r.ok) return true;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
};

let failures = 0;
try {
  if (!(await up())) throw new Error('dev server did not start');

  const url = `http://localhost:${PORT}/?intro=skip#v=map&d=70&b=eia&y=2026&e=11&l=flows.pipelines.strait.terminals.incidents`;
  // Reduced motion: count-up tweens snap instantly (rAF is starved under
  // headless virtual time), and this exercises the a11y motion path.
  const dom = execFileSync(CHROME, [
    '--headless=new', '--disable-gpu', '--force-prefers-reduced-motion',
    '--virtual-time-budget=9000', '--dump-dom', url,
  ], { maxBuffer: 64 * 1024 * 1024 }).toString();

  const checks = [
    ['stranded readout computed (12.0 @ 70%)', /id="r-stranded"[^>]*data-v="12\.0[0-9]*">12\.0</],
    ['share vs verified denominator (11.6%)', /id="r-share"[^>]*>11\.6</],
    ['exposure chips ranked (Saudi −2.3)', 'Saudi Arabia −2.3'],
    ['importer board rendered', 'Importer exposure — who hurts first'],
    ['LNG shock panel rendered', 'The empirical anchor'],
    ['insurance ledger annotated', 'Mined corridor'],
    ['event study verified counterexample', '+70.9%'],
    ['chokepoint anatomy thesis row', 'NONE — no way out by sea'],
    ['reopening runway rendered', 'why the slider doesn\'t snap back'],
    ['2026 ladder current', 'Persian Gulf Strait Authority'],
    ['methodology sources complete', 'Max coordinated release rate'],
    ['offline stack wired', 'vendor/pmtiles.js'],
    ['brand link present', 'https://analyticadss.com'],
  ];

  for (const [name, probe] of checks) {
    const ok = probe instanceof RegExp ? probe.test(dom) : dom.includes(probe);
    console.log(`  ${ok ? '✓' : '✗'} ${name}`);
    if (!ok) failures += 1;
  }
} catch (e) {
  console.error(`smoke: ${e.message}`);
  failures += 1;
} finally {
  server.kill();
}

if (failures) {
  console.error(`\nSMOKE FAIL — ${failures} check(s) failed. Do not demo/deploy this build.`);
  process.exit(1);
}
console.log('\nSmoke clean — the rendered site matches the model.');
