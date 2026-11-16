import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const outDir = process.env.SHOT_DIR || 'screenshots';
mkdirSync(outDir, { recursive: true });

const SHOTS = [
  { file: '1-yard-firefight.jpg', shot: 'firefight', radio: 'PYRE-2  ·  contact west yard — one down' },
  { file: '2-requisitions.jpg',   shot: 'buy',       buy: true, radio: 'COMMAND  ·  buy phase open — 12s to contact' },
  { file: '3-charge-planted.jpg', shot: 'charge',    radio: 'PYRE-BRAND  ·  charge is down, watch the lane' },
  { file: '4-squad-push.jpg',     shot: 'push',      radio: 'PYRE-1  ·  pushing A slag basin, covering' },
];

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome', headless: true,
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-gpu-sandbox'],
});

let bad = 0;
for (const s of SHOTS.filter((x) => !process.env.ONLY || x.shot === process.env.ONLY)) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const problems = [];
  page.on('response', (r) => { if (r.status() >= 400) problems.push(`${r.status()} ${r.url()}`); });
  page.on('pageerror', (e) => problems.push('JSERR ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') problems.push('CONSOLE ' + m.text()); });

  await page.goto(`http://127.0.0.1:8768/?shot=${s.shot}&seed=1`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ashgate && window.__ashgate.frames > 25 && window.game, null, { timeout: 150000 });
  const info = await page.evaluate((cfg) => {
    const g = window.game;
    document.getElementById('hud').removeAttribute('hidden');
    if (cfg.radio) g.state.radio = { text: cfg.radio, tone: 'n', time: g.state.elapsed };
    if (cfg.buy) g.state.buyOpen = true;
    g.viewmodel.setAds(cfg.shot === 'firefight');
    if (g.viewmodel.fire) g.viewmodel.fire();
    g.hud.render();
    const bm = document.getElementById('buy-menu');
    return {
      radio: (document.getElementById('radio') || {}).textContent,
      buyShown: getComputedStyle(bm).display !== 'none',
      phase: g.state.phase,
    };
  }, { ...s });
  await page.waitForTimeout(400);
  const buf = await page.screenshot({ type: 'jpeg', quality: +(process.env.Q || 97) });
  writeFileSync(join(outDir, s.file), buf);
  if (problems.length) bad++;
  console.log(`${s.file.padEnd(24)} ${(buf.length/1024).toFixed(0).padStart(4)}KiB  buy=${info.buyShown?'ON ':'off'} phase=${info.phase.padEnd(5)} radio="${info.radio}"`);
  if (problems.length) problems.forEach((p) => console.log('    ! ' + p));
  await page.close();
}
console.log(bad ? `\n${bad}/${SHOTS.length} halaman punya masalah` : '\nSMOKE OK: 0 error, 0 request 4xx/5xx');
await browser.close();
