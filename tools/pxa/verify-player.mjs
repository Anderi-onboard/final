/**
 * Drives the real player in real Chromium and measures it.
 *
 * The contract in tests/ proves the FORMAT; this proves the RENDERER, and the
 * two fail in completely different ways. A grid can round-trip perfectly and
 * still be painted at a fractional scale, on the wrong frame cadence, or in
 * black because a palette slot was not published yet — none of which a Node
 * test can see.
 *
 * Not part of `npm test`: it needs a browser, and the CI job deliberately runs
 * with no install step. Run it by hand after touching assets/pxa.js.
 *
 *   npm i -D playwright-core
 *   npx serve . -l 8765          (or: python3 -m http.server 8765)
 *   CHROME=/path/to/chrome node tools/pxa/verify-player.mjs a.pxa.json b.pxa.json
 *
 * The two arguments are a palette-mapped asset (@N entries) and a literal-hex
 * one; the checks need both, because only the first can prove recolouring and
 * only the second can prove the painted pixels equal the declared colours.
 */
import { chromium } from 'playwright-core';
import { readDoc } from './doc.mjs';

/* Same reader as the CLI — a filename typed at this tool fails the same four
   ways it fails at `pxa inspect`, so it should say the same four things. */
const doc = readDoc(process.argv[2], 'inspect');
const lit = readDoc(process.argv[3], 'inspect');
const browser = await chromium.launch({ executablePath: process.env.CHROME, args: ['--no-sandbox'] });
const out = [];
const say = (ok, msg) => { out.push((ok ? 'PASS  ' : 'FAIL  ') + msg); };

for (const dpr of [1, 2]) {
  const page = await browser.newPage({ deviceScaleFactor: dpr, viewport: { width: 1200, height: 900 } });
  page.on('console', (m) => { if (m.type() === 'error') console.log('  [console error]', m.text()); });
  page.on('pageerror', (e) => console.log('  [page error]', e.message));
  await page.goto((process.env.ORIGIN || 'http://127.0.0.1:8765') + '/tools/pxa-studio.html', { waitUntil: 'networkidle' });

  const r = await page.evaluate(async ({ doc, lit }) => {
    const res = {};
    const root = document.documentElement;
    for (let i = 1; i <= 10; i++) root.style.setProperty(`--bw-palette-${i}`, `rgb(${i * 20}, ${255 - i * 20}, ${i * 7})`);

    // ── integer scaling at a spread of box sizes
    res.scales = [];
    for (const px of [17, 32, 64, 100, 128, 279, 520, 901]) {
      const box = document.createElement('div');
      box.style.cssText = `width:${px}px;height:${Math.round(px * doc.h / doc.w)}px;display:flex`;
      document.body.appendChild(box);
      const clip = window.BWPixel.mount(box, doc, { fit: 'integer' });
      const c = box.querySelector('canvas');
      const bb = box.getBoundingClientRect(), cb = c.getBoundingClientRect();
      const exact = Math.min(bb.width * devicePixelRatio / doc.w, bb.height * devicePixelRatio / doc.h);
      res.scales.push({
        px, cw: c.width, ch: c.height, exact: +exact.toFixed(2), crisp: clip.crisp,
        // Integer scaling is only claimed when there is at least one device
        // pixel per cell. Below that the format has nothing to be crisp about,
        // and the player says so via clip.crisp rather than pretending.
        ok: exact >= 1
          ? (c.width % doc.w === 0 && c.height % doc.h === 0 && c.width / doc.w === c.height / doc.h && clip.crisp === true)
          : (clip.crisp === false && clip.down === true),
        fits: cb.width <= bb.width + 0.5 && cb.height <= bb.height + 0.5
      });
      clip.destroy(); box.remove();
    }

    // ── does it actually paint, and does it paint the palette?
    const box = document.createElement('div');
    box.style.cssText = 'width:400px;height:240px;display:flex';
    document.body.appendChild(box);
    const clip = window.BWPixel.mount(box, lit, { fit: 'integer' });
    const c = box.querySelector('canvas');
    const g = c.getContext('2d');
    const s = c.width / lit.w;
    const readCell = (cx, cy) => [...g.getImageData(Math.floor((cx + 0.5) * s), Math.floor((cy + 0.5) * s), 1, 1).data];
    const hexOf = (a) => '#' + a.slice(0, 3).map((v) => v.toString(16).padStart(2, '0')).join('');
    const frame0 = window.BWPixel.decode(lit).frames[0];
    let matched = 0, checked = 0;
    for (let cy = 0; cy < lit.h; cy += 3) for (let cx = 0; cx < lit.w; cx += 3) {
      checked++;
      if (hexOf(readCell(cx, cy)) === lit.palette[frame0[cy * lit.w + cx]]) matched++;
    }
    res.literalPaint = { checked, matched };

    // ── recolour: an @N asset must change when the ramp changes
    const box2 = document.createElement('div');
    box2.style.cssText = 'width:400px;height:240px;display:flex';
    document.body.appendChild(box2);
    const clip2 = window.BWPixel.mount(box2, doc, { fit: 'integer' });
    const c2 = box2.querySelector('canvas'), g2 = c2.getContext('2d');
    const snap = () => [...g2.getImageData(0, 0, c2.width, c2.height).data].filter((_, i) => i % 401 === 0).join(',');
    const before = snap();
    for (let i = 1; i <= 10; i++) root.style.setProperty(`--bw-palette-${i}`, `rgb(${255 - i * 20}, ${i * 11}, ${200 - i * 9})`);
    window.dispatchEvent(new CustomEvent('bw:palettechange'));
    await new Promise((r2) => requestAnimationFrame(r2));
    res.recolour = before !== snap();

    // ── the ramp asset must not paint anything black when a slot is missing
    for (let i = 1; i <= 10; i++) root.style.removeProperty(`--bw-palette-${i}`);
    window.dispatchEvent(new CustomEvent('bw:palettechange'));
    await new Promise((r2) => requestAnimationFrame(r2));
    const d = g2.getImageData(0, 0, c2.width, c2.height).data;
    let opaque = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 0) opaque++;
    res.missingSlotsTransparent = opaque === 0;

    // ── frames advance, and on a fixed cadence
    for (let i = 1; i <= 10; i++) root.style.setProperty(`--bw-palette-${i}`, `rgb(${i * 20},${255 - i * 20},${i * 7})`);
    window.dispatchEvent(new CustomEvent('bw:palettechange'));
    let advances = 0, last = clip2.frame;
    const t0 = performance.now();
    while (performance.now() - t0 < 2000) {
      await new Promise((r2) => requestAnimationFrame(r2));
      if (clip2.frame !== last) { advances++; last = clip2.frame; }
    }
    res.measuredFps = advances / ((performance.now() - t0) / 1000);
    res.fps = doc.fps;

    clip.destroy(); clip2.destroy(); box.remove(); box2.remove();
    return res;
  }, { doc, lit });

  const bad = r.scales.filter((s) => !s.ok || !s.fits);
  say(bad.length === 0, `dpr=${dpr} scale + fit at 8 box sizes — ${bad.length ? JSON.stringify(bad) : r.scales.map((s) => `${s.px}px→${s.crisp ? (s.cw / doc.w) + 'x crisp' : 'sub-cell'}`).join('  ')}`);
  say(r.literalPaint.matched === r.literalPaint.checked,
      `dpr=${dpr} painted pixels equal the palette: ${r.literalPaint.matched}/${r.literalPaint.checked} cells`);
  say(r.recolour, `dpr=${dpr} @N asset repaints when the ramp changes`);
  say(r.missingSlotsTransparent, `dpr=${dpr} unpublished palette slots stay transparent (never black)`);
  say(Math.abs(r.measuredFps - r.fps) < 0.6,
      `dpr=${dpr} cadence measured ${r.measuredFps.toFixed(2)}fps against a declared ${r.fps}fps`);
  await page.close();
}

// reduced motion must hold still
const page = await browser.newPage({ reducedMotion: 'reduce', viewport: { width: 800, height: 600 } });
await page.goto((process.env.ORIGIN || 'http://127.0.0.1:8765') + '/tools/pxa-studio.html', { waitUntil: 'networkidle' });
const held = await page.evaluate(async ({ lit }) => {
  const box = document.createElement('div'); box.style.cssText = 'width:320px;height:192px;display:flex';
  document.body.appendChild(box);
  const clip = window.BWPixel.mount(box, lit, { fit: 'integer', poster: 3 });
  const start = clip.frame;
  await new Promise((r) => setTimeout(r, 700));
  return { start, end: clip.frame, raf: clip.raf };
}, { lit });
say(held.start === 3 && held.end === 3 && !held.raf, `prefers-reduced-motion holds the poster frame (${held.start}→${held.end}) and runs no rAF`);
await page.close();

await browser.close();
console.log(out.join('\n'));
process.exit(out.some((l) => l.startsWith('FAIL')) ? 1 : 0);
