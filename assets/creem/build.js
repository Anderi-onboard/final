#!/usr/bin/env node
/**
 * Creem storefront art — product plates, store logo, store banner.
 *
 * Sizes follow what Creem asks for:
 *   product plates  16:9   → 3840×2160  (1920×1080 @2x)
 *   store logo      52×52  → exact, plus a 512×512 master
 *   store banner    1920×400 → 3840×800 @2x
 *
 * Every mark is the BourneWise trademark: the same five wave paths, never more
 * and never fewer. Only their colour changes, to read as a fill gauge.
 *
 * Usage:  node assets/creem/build.js
 * Requires a Chromium binary (CHROME=/path/to/chrome to override).
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
// round caps). Top → bottom. Reproduced verbatim. ----
const MARK_PATHS = [
  'M-40.96-1327.31c30.72-20.48,61.44,20.48,92.16,0,30.72-20.48,71.68,20.48,102.4,0',
  'M-122.88-1245.39c51.2,30.72,102.4-30.72,143.36,0,40.96,30.72,102.4-30.72,153.6,0',
  'M-215.04-1163.47c81.92-61.44,163.84,40.96,235.52,0,71.68-40.96,153.6,51.2,235.52,0',
  'M-143.36-1081.55c51.2,30.72,112.64-20.48,163.84,0,51.2,20.48,112.64-30.72,153.6,0',
  'M-102.4-1009.87c30.72-10.24,61.44,20.48,92.16,0s71.68,10.24,102.4,0',
];

// bars: exactly 5 colours, top→bottom. viewBox defaults to the mark's own box;
// pass a padded square for the avatar lockup.
function glyph(bars, viewBox = '0 0 512 416') {
  let out = `<svg viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg" `
    + `fill="none" stroke-linecap="round"><g transform="translate(240,1380)">`;
  MARK_PATHS.forEach((d, i) => {
    out += `<path style="stroke-width:40px" stroke="${bars[i]}" d="${d}"/>`;
  });
  return out + '</g></svg>';
}

const CREAM = '#F5F0E3', INK = '#16130F', GREY = '#D2CDC2', CREAMINK = '#F3EEE1';
const MUTED_LIGHT = '#A39B8C', MUTED_DARK = '#8A8377';

// Colour the five bars top→bottom; the gauge fills from the bottom.
const fill = (n, ink, grey) => [0, 1, 2, 3, 4].map(i => (i >= 5 - n ? ink : grey));

// The eight Creem products. Unit counts and intervals track the Creem brief.
// Gauge ladder: packs 1→4 of 5, plans full.
const plates = [
  { file: 'plate-I-7500', roman: 'I', title: '7,500 Units', sub: 'ONE-TIME TOP-UP', level: 1 },
  { file: 'plate-II-15000', roman: 'II', title: '15,000 Units', sub: 'ONE-TIME TOP-UP', level: 2 },
  { file: 'plate-III-30000', roman: 'III', title: '30,000 Units', sub: 'ONE-TIME TOP-UP', level: 3 },
  { file: 'plate-IV-75000', roman: 'IV', title: '75,000 Units', sub: 'ONE-TIME TOP-UP', level: 4 },
  { file: 'plate-V-pro-monthly', roman: 'V', title: 'Pro', sub: '28,500 UNITS · MONTHLY', level: 5 },
  { file: 'plate-VI-pro-annual', roman: 'VI', title: 'Pro', sub: '342,000 UNITS · ANNUAL', level: 5 },
  { file: 'plate-VII-premium-monthly', roman: 'VII', title: 'Premium', sub: '43,500 UNITS · MONTHLY', level: 5, dark: true },
  { file: 'plate-VIII-premium-annual', roman: 'VIII', title: 'Premium', sub: '522,000 UNITS · ANNUAL', level: 5, dark: true },
];

const FACES = `
@font-face{font-family:'BioRhyme';font-weight:800;src:url(data:font/woff2;base64,${bio800}) format('woff2')}
@font-face{font-family:'BioRhyme';font-weight:700;src:url(data:font/woff2;base64,${bio700}) format('woff2')}
@font-face{font-family:'Spinnaker';font-weight:400;src:url(data:font/woff2;base64,${spin}) format('woff2')}
*{margin:0;padding:0;box-sizing:border-box}`;

// corner brackets, sized to the frame
function frame(stroke, W, H, m, L) {
  const c = (x, y, dx, dy) => `<path d="M ${x + dx * L} ${y} L ${x} ${y} L ${x} ${y + dy * L}" fill="none" stroke="${stroke}" stroke-width="2"/>`;
  return `<svg class="frame" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">`
    + c(m, m, 1, 1) + c(W - m, m, -1, 1) + c(m, H - m, 1, -1) + c(W - m, H - m, -1, -1) + '</svg>';
}

// ---------- 16:9 product plate ----------
function plateHtml(p) {
  const bg = p.dark ? INK : CREAM;
  const ink = p.dark ? CREAMINK : INK;
  const grey = p.dark ? '#3A342B' : GREY;
  const muted = p.dark ? MUTED_DARK : MUTED_LIGHT;
  return `<!doctype html><html><head><meta charset="utf-8"><style>${FACES}
  html,body{width:1920px;height:1080px;overflow:hidden;background:${bg}}
  .stage{position:relative;width:1920px;height:1080px}
  .frame{position:absolute;inset:0;width:1920px;height:1080px}
  .row{position:absolute;inset:0;display:flex;align-items:center}
  .gcol{width:820px;display:flex;align-items:center;justify-content:center;padding-left:60px}
  .gcol svg{width:512px;height:auto}
  .tcol{flex:1;padding-right:150px;padding-left:20px}
  .ey{font-family:'Spinnaker';font-size:26px;letter-spacing:.44em;text-transform:uppercase;color:${muted}}
  .ey2{font-family:'Spinnaker';font-size:22px;letter-spacing:.44em;text-transform:uppercase;margin-top:16px;color:${muted}}
  .dash{width:54px;height:3px;margin:44px 0 34px;border-radius:2px;background:${muted}}
  .title{font-family:'BioRhyme';font-weight:800;font-size:108px;line-height:1;letter-spacing:-.01em;color:${ink}}
  .sub{font-family:'Spinnaker';font-size:24px;letter-spacing:.34em;text-transform:uppercase;margin-top:34px;color:${muted}}
  </style></head><body><div class="stage">${frame(muted, 1920, 1080, 64, 70)}
  <div class="row"><div class="gcol">${glyph(fill(p.level, ink, grey))}</div>
  <div class="tcol"><div class="ey">Bournewise</div><div class="ey2">Plate ${p.roman} of VIII</div>
  <div class="dash"></div><div class="title">${p.title}</div><div class="sub">${p.sub}</div></div></div>
  </div></body></html>`;
}

// ---------- square store logo (52×52 in Creem) ----------
// Padded square viewBox so the mark sits at ~80% width, optically centred.
function logoHtml(size, transparent) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${FACES}
  html,body{width:${size}px;height:${size}px;overflow:hidden;background:${transparent ? 'transparent' : CREAM}}
  svg{display:block;width:${size}px;height:${size}px}
  </style></head><body>${glyph(fill(5, INK, INK), '-64 -112 640 640')}</body></html>`;
}

// ---------- 1920×400 store banner ----------
function bannerHtml() {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${FACES}
  html,body{width:1920px;height:400px;overflow:hidden;background:${CREAM}}
  .stage{position:relative;width:1920px;height:400px;display:flex;align-items:center;justify-content:center}
  .frame{position:absolute;inset:0;width:1920px;height:400px}
  .mk{flex:none;width:300px;height:auto;position:relative}
  .rule{flex:none;width:2px;height:176px;background:${MUTED_LIGHT};opacity:.55;margin:0 68px;position:relative}
  .tx{position:relative}
  .nm{font-family:'BioRhyme';font-weight:700;font-size:62px;line-height:1;letter-spacing:.12em;color:${INK}}
  .tag{font-family:'Spinnaker';font-size:23px;letter-spacing:.2em;color:${MUTED_LIGHT};margin-top:26px}
  </style></head><body><div class="stage">${frame(MUTED_LIGHT, 1920, 400, 44, 52)}
  <div class="mk">${glyph(fill(5, INK, INK))}</div><div class="rule"></div>
  <div class="tx"><div class="nm">BOURNEWISE</div>
  <div class="tag">Bring the question you keep circling.</div></div>
  </div></body></html>`;
}

// ---------- render ----------
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
function shoot(html, name, w, h, scale, transparent) {
  const htmlPath = path.join(HERE, `.${name}.html`);
  const outPath = path.join(HERE, `${name}.png`);
  fs.writeFileSync(htmlPath, html);
  const args = [
    '--headless=new', '--no-sandbox', '--hide-scrollbars',
    `--force-device-scale-factor=${scale}`, `--window-size=${w},${h}`,
    '--virtual-time-budget=4000', '--run-all-compositor-stages-before-draw',
  ];
  if (transparent) args.push('--default-background-color=00000000');
  args.push(`--screenshot=${outPath}`, `file://${htmlPath}`);
  execFileSync(chrome, args, { stdio: 'ignore' });
  fs.unlinkSync(htmlPath);
  const buf = fs.readFileSync(outPath);
  console.log(`  ${name}.png  ${buf.readUInt32BE(16)}×${buf.readUInt32BE(20)}`);
}

console.log('product plates (16:9)');
plates.forEach(p => shoot(plateHtml(p), p.file, 1920, 1080, 2, false));
console.log('store logo');
shoot(logoHtml(52, false), 'store-logo-52', 52, 52, 1, false);
shoot(logoHtml(52, true), 'store-logo-52-transparent', 52, 52, 1, true);
shoot(logoHtml(512, false), 'store-logo-512', 512, 512, 1, false);
console.log('store banner');
shoot(bannerHtml(), 'store-banner-1920x400', 1920, 400, 2, false);
