#!/usr/bin/env node
/**
 * Creem product images — 16:9 (3840×2160) build.
 *
 * Renders the six BourneWise "plate" product images that Creem shows in its
 * product listing. Creem recommends a 16:9 aspect ratio, so instead of the
 * original 1:1 square composition these lay the wave-glyph mark on the left and
 * the title block on the right — an editorial split that fills the wide frame.
 *
 * Usage:  node assets/creem/build.js
 * Output: assets/creem/plate-*.png  (3840×2160, i.e. 1920×1080 @2x)
 *
 * Requires a Chromium binary. Set CHROME=/path/to/chrome, otherwise the
 * script probes the Playwright cache and a few common locations.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const HERE = __dirname;
const FONTS = path.join(HERE, '..', 'fonts');
const b64 = f => fs.readFileSync(path.join(FONTS, f)).toString('base64');
const bio800 = b64('BioRhyme-800.woff2');
const bio700 = b64('BioRhyme-700.woff2');
const spin = b64('Spinnaker-400.woff2');

// ---- smooth thick sine wave, round caps ----
function wave(cx, cy, halfW, amp, humps) {
  const steps = 120, x0 = cx - halfW, x1 = cx + halfW;
  let d = '';
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = x0 + (x1 - x0) * t;
    const y = cy + amp * Math.sin(t * Math.PI * 2 * humps + Math.PI * 0.15);
    d += (i === 0 ? 'M' : 'L') + x.toFixed(1) + ' ' + y.toFixed(1) + ' ';
  }
  return d;
}

// ---- the stacked-wave glyph: a circular silhouette used as a fill gauge ----
function glyph(bars, { ink, grey, sw }) {
  const boxW = 560, cx = 290, top = 70, stackH = 420, maxHalf = 245;
  const gap = stackH / (bars.length - 1);
  let out = `<svg viewBox="0 0 ${boxW} 560" width="560" height="560" xmlns="http://www.w3.org/2000/svg">`;
  bars.forEach((b, i) => {
    const cy = top + gap * i;
    const halfW = maxHalf * b.w;
    const amp = 15 + 6 * b.w;
    const humps = halfW > 150 ? 2.1 : 1.5;
    out += `<path d="${wave(cx, cy, halfW, amp, humps)}" fill="none" stroke="${b.filled ? ink : grey}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>`;
  });
  return out + '</svg>';
}

function frame(stroke) {
  const m = 64, L = 70, W = 1920, H = 1080;
  const c = (x, y, dx, dy) => `<path d="M ${x + dx * L} ${y} L ${x} ${y} L ${x} ${y + dy * L}" fill="none" stroke="${stroke}" stroke-width="2"/>`;
  return `<svg class="frame" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">`
    + c(m, m, 1, 1) + c(W - m, m, -1, 1) + c(m, H - m, 1, -1) + c(W - m, H - m, -1, -1) + '</svg>';
}

const CREAM = '#F5F0E3', INK = '#16130F', GREY = '#D2CDC2', DARK = '#16130F', CREAMINK = '#F3EEE1';
const W5 = [0.60, 0.86, 1.0, 0.84, 0.55];      // 5-bar circular silhouette
const W6 = [0.55, 0.80, 1.0, 0.86, 0.74, 0.48]; // 6-bar (overflow) silhouette
const bars5 = filledFromBottom => W5.map((w, i) => ({ w, filled: i >= 5 - filledFromBottom }));

// Plates track the Creem products: three one-time top-ups + two monthly plans.
const plates = [
  { file: 'plate-II-15000', roman: 'II', bg: CREAM, ink: INK, grey: GREY, title: '15,000 Units', sub: 'ONE-TIME TOP-UP', bars: bars5(2) },
  { file: 'plate-III-30000', roman: 'III', bg: CREAM, ink: INK, grey: GREY, title: '30,000 Units', sub: 'ONE-TIME TOP-UP', bars: bars5(3) },
  { file: 'plate-IV-75000', roman: 'IV', bg: CREAM, ink: INK, grey: GREY, title: '75,000 Units', sub: 'ONE-TIME TOP-UP', bars: W6.map((w, i) => ({ w, filled: i >= 1 })) },
  { file: 'plate-V-pro', roman: 'V', bg: CREAM, ink: INK, grey: GREY, title: 'Pro', sub: '22,500 UNITS · MONTHLY', bars: W5.map(w => ({ w, filled: true })) },
  { file: 'plate-VI-premium', roman: 'VI', bg: DARK, ink: CREAMINK, grey: '#3A342B', title: 'Premium', sub: '45,000 UNITS · MONTHLY', bars: W5.map(w => ({ w, filled: true })) },
];

const css = `
@font-face{font-family:'BioRhyme';font-weight:800;src:url(data:font/woff2;base64,${bio800}) format('woff2')}
@font-face{font-family:'BioRhyme';font-weight:700;src:url(data:font/woff2;base64,${bio700}) format('woff2')}
@font-face{font-family:'Spinnaker';font-weight:400;src:url(data:font/woff2;base64,${spin}) format('woff2')}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1920px;height:1080px;overflow:hidden}
.stage{position:relative;width:1920px;height:1080px}
.frame{position:absolute;inset:0;width:1920px;height:1080px}
.row{position:absolute;inset:0;display:flex;align-items:center}
.gcol{width:820px;display:flex;align-items:center;justify-content:center;padding-left:60px}
.gcol svg{width:520px;height:520px}
.tcol{flex:1;padding-right:150px;padding-left:20px}
.ey{font-family:'Spinnaker';font-size:26px;letter-spacing:.44em;text-transform:uppercase}
.ey2{font-family:'Spinnaker';font-size:22px;letter-spacing:.44em;text-transform:uppercase;margin-top:16px}
.dash{width:54px;height:3px;margin:44px 0 34px;border-radius:2px}
.title{font-family:'BioRhyme';font-weight:800;font-size:108px;line-height:1;letter-spacing:-.01em}
.sub{font-family:'Spinnaker';font-size:24px;letter-spacing:.34em;text-transform:uppercase;margin-top:34px}`;

function pageHtml(p) {
  const muted = p.bg === DARK ? '#8A8377' : '#A39B8C';
  return `<!doctype html><html><head><meta charset="utf-8"><style>${css}
  body{background:${p.bg}}.ey,.ey2,.sub{color:${muted}}.title{color:${p.ink}}.dash{background:${muted}}
  </style></head><body><div class="stage">${frame(muted)}
  <div class="row"><div class="gcol">${glyph(p.bars, { ink: p.ink, grey: p.grey, sw: 34 })}</div>
  <div class="tcol"><div class="ey">Bournewise</div><div class="ey2">Plate ${p.roman} of VI</div>
  <div class="dash"></div><div class="title">${p.title}</div><div class="sub">${p.sub}</div></div></div>
  </div></body></html>`;
}

function findChrome() {
  if (process.env.CHROME && fs.existsSync(process.env.CHROME)) return process.env.CHROME;
  const roots = ['/opt/pw-browsers', path.join(process.env.HOME || '', '.cache/ms-playwright')];
  for (const r of roots) {
    try {
      for (const d of fs.readdirSync(r)) {
        const c = path.join(r, d, 'chrome-linux', 'chrome');
        if (fs.existsSync(c)) return c;
      }
    } catch (_) {}
  }
  for (const c of ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome']) {
    if (fs.existsSync(c)) return c;
  }
  throw new Error('Chromium not found. Set CHROME=/path/to/chrome');
}

const chrome = findChrome();
for (const p of plates) {
  const htmlPath = path.join(HERE, `${p.file}.html`);
  const outPath = path.join(HERE, `${p.file}.png`);
  fs.writeFileSync(htmlPath, pageHtml(p));
  execFileSync(chrome, [
    '--headless=new', '--no-sandbox', '--hide-scrollbars',
    '--force-device-scale-factor=2', '--window-size=1920,1080',
    '--virtual-time-budget=4000', '--run-all-compositor-stages-before-draw',
    `--screenshot=${outPath}`, `file://${htmlPath}`,
  ], { stdio: 'ignore' });
  fs.unlinkSync(htmlPath);
  console.log('rendered', p.file + '.png');
}
