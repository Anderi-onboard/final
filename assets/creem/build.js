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

// ---- the BourneWise trademark: the exact five wave paths from the logomark
// (index.html · viewBox 0 0 512 416, g translate(240,1380), stroke-width 40,
// round caps). Top → bottom. These are the registered mark and are reproduced
// verbatim; only their stroke colour changes to signal a plan's fill level. ----
const MARK_PATHS = [
  'M-40.96-1327.31c30.72-20.48,61.44,20.48,92.16,0,30.72-20.48,71.68,20.48,102.4,0',
  'M-122.88-1245.39c51.2,30.72,102.4-30.72,143.36,0,40.96,30.72,102.4-30.72,153.6,0',
  'M-215.04-1163.47c81.92-61.44,163.84,40.96,235.52,0,71.68-40.96,153.6,51.2,235.52,0',
  'M-143.36-1081.55c51.2,30.72,112.64-20.48,163.84,0,51.2,20.48,112.64-30.72,153.6,0',
  'M-102.4-1009.87c30.72-10.24,61.44,20.48,92.16,0s71.68,10.24,102.4,0',
];
// A one-off "overflow" wave that sits above the mark (75,000 top-up only):
// the top path shifted up one band, kept muted so the mark itself stays whole.
const OVERFLOW_PATH = 'M-40.96-1417.31c30.72-20.48,61.44,20.48,92.16,0,30.72-20.48,71.68,20.48,102.4,0';

// bars: array of 5 colours (top→bottom). overflow: colour for the extra wave,
// or null. Width is pinned to 512 (viewBox width) so bar thickness is identical
// across every plate; only the viewBox height/offset changes.
function glyph(bars, overflow) {
  const vb = overflow ? '0 -95 512 511' : '0 0 512 416';
  let out = `<svg viewBox="${vb}" width="512" xmlns="http://www.w3.org/2000/svg" `
    + `fill="none" stroke-linecap="round"><g transform="translate(240,1380)">`;
  if (overflow) out += `<path style="stroke-width:40px" stroke="${overflow}" d="${OVERFLOW_PATH}"/>`;
  MARK_PATHS.forEach((d, i) => {
    out += `<path style="stroke-width:40px" stroke="${bars[i]}" d="${d}"/>`;
  });
  return out + '</g></svg>';
}

function frame(stroke) {
  const m = 64, L = 70, W = 1920, H = 1080;
  const c = (x, y, dx, dy) => `<path d="M ${x + dx * L} ${y} L ${x} ${y} L ${x} ${y + dy * L}" fill="none" stroke="${stroke}" stroke-width="2"/>`;
  return `<svg class="frame" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">`
    + c(m, m, 1, 1) + c(W - m, m, -1, 1) + c(m, H - m, 1, -1) + c(W - m, H - m, -1, -1) + '</svg>';
}

const CREAM = '#F5F0E3', INK = '#16130F', GREY = '#D2CDC2', DARK = '#16130F', CREAMINK = '#F3EEE1';

// Colour the five trademark bars top→bottom; the gauge fills from the bottom.
// filledFromBottom = how many of the five are inked (the rest stay muted grey).
const fill = (n, ink, grey) => [0, 1, 2, 3, 4].map(i => (i >= 5 - n ? ink : grey));

// Plates track the Creem products: three one-time top-ups + two monthly plans.
const plates = [
  { file: 'plate-II-15000', roman: 'II', bg: CREAM, ink: INK, title: '15,000 Units', sub: 'ONE-TIME TOP-UP', bars: fill(2, INK, GREY) },
  { file: 'plate-III-30000', roman: 'III', bg: CREAM, ink: INK, title: '30,000 Units', sub: 'ONE-TIME TOP-UP', bars: fill(3, INK, GREY) },
  { file: 'plate-IV-75000', roman: 'IV', bg: CREAM, ink: INK, title: '75,000 Units', sub: 'ONE-TIME TOP-UP', bars: fill(5, INK, GREY), overflow: GREY },
  { file: 'plate-V-pro', roman: 'V', bg: CREAM, ink: INK, title: 'Pro', sub: '22,500 UNITS · MONTHLY', bars: fill(5, INK, GREY) },
  { file: 'plate-VI-premium', roman: 'VI', bg: DARK, ink: CREAMINK, title: 'Premium', sub: '45,000 UNITS · MONTHLY', bars: fill(5, CREAMINK, CREAMINK) },
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
.gcol svg{width:512px;height:auto}
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
  <div class="row"><div class="gcol">${glyph(p.bars, p.overflow || null)}</div>
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
