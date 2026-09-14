/**
 * GIF export checked against a REAL browser decoder.
 *
 * ⭐ `tests/pxa-export.mjs` carries its own GIF decoder so `npm test` needs no
 * browser — but my decoder and my encoder can agree on the same
 * misunderstanding, and they did: both used the encoder's code-width rule, so
 * the pair round-tripped perfectly while the file was malformed. Chromium's
 * decoder shares none of my assumptions, which is the whole point of running
 * this one too.
 *
 * ⚠️ Verified to be non-vacuous: planting `disposal = 1` back into gif.mjs
 * makes this report 114/120 — the six transparent cells — rather than passing.
 *
 * Run: node tools/pxa/verify-gif.mjs   (needs playwright-core + a Chromium)
 */
import { chromium } from 'playwright-core';
import { createServer } from 'node:http';

/* ⚠️ ImageDecoder is gated on a secure context, and about:blank is not one.
   http://127.0.0.1 is, so the page is served rather than set. */
const server = createServer((_, res) => {
  res.writeHead(200, { 'content-type': 'text/html' });
  res.end('<!doctype html><title>gif check</title>');
}).listen(0, '127.0.0.1');
await new Promise((r) => server.once('listening', r));
const origin = `http://127.0.0.1:${server.address().port}/`;
import { encodeGIF } from './gif.mjs';

const TW = 6, TH = 4;
const rgb = [null, [231, 200, 106], [61, 107, 82]];
const holes = [
  [1,1,1,1,1,1, 1,1,1,1,1,1, 1,1,1,1,1,1, 1,1,1,1,1,1],
  [1,1,1,1,1,1, 1,0,0,1,1,1, 1,1,1,1,1,1, 1,1,1,1,1,1],
  [1,1,1,1,1,1, 1,1,1,0,0,1, 1,1,1,1,1,1, 1,1,1,1,1,1],
  [1,1,1,1,1,1, 1,1,1,1,1,1, 1,1,1,1,1,1, 1,1,1,1,1,1],
  [2,2,2,2,2,2, 2,2,0,0,2,2, 2,2,2,2,2,2, 2,2,2,2,2,2]
].map((a) => Uint8Array.from(a));

// A bigger, ordinary clip too — the delta path with no transparency change.
const W = 24, H = 16, N = 8;
const grids = Array.from({ length: N }, (_, t) => {
  const g = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) g[y * W + x] = y < 6 ? 1 : 2;
  for (let k = 0; k < 3; k++) g[(4 + k) * W + (3 + t)] = 1 + ((t + k) % 2);
  return g;
});

const cases = [
  { name: 'transparency opens and closes', frames: holes, w: TW, h: TH, rgb },
  { name: 'ordinary delta clip', frames: grids, w: W, h: H, rgb }
];

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage();
await page.goto(origin);
if (!(await page.evaluate(() => window.isSecureContext && typeof ImageDecoder === 'function')))
  throw new Error('ImageDecoder unavailable — this check needs a browser that has it');
let bad = 0;
for (const c of cases) {
  const { buffer } = encodeGIF(c.frames, c.w, c.h, c.rgb, 10, { scale: 1 });
  const got = await page.evaluate(async ({ bytes, w, h }) => {
    // ImageDecoder gives raw frames; compositing is ours to do, so instead draw
    // each frame to a canvas the way a page would and read it back.
    const dec = new ImageDecoder({ data: new Uint8Array(bytes), type: 'image/gif' });
    await dec.tracks.ready;
    await dec.completed;
    const n = dec.tracks.selectedTrack.frameCount;
    const cv = new OffscreenCanvas(w, h);
    const cx = cv.getContext('2d', { willReadFrequently: true });
    const out = [];
    for (let i = 0; i < n; i++) {
      const { image } = await dec.decode({ frameIndex: i });
      // ImageDecoder hands back FULL composited frames for animated GIFs.
      cx.clearRect(0, 0, w, h);
      cx.drawImage(image, 0, 0);
      out.push(Array.from(cx.getImageData(0, 0, w, h).data));
    }
    return out;
  }, { bytes: Array.from(buffer), w: c.w, h: c.h });

  let wrong = 0, total = 0;
  got.forEach((data, t) => {
    for (let i = 0; i < c.w * c.h; i++) {
      total++;
      const want = c.rgb[c.frames[t][i]];
      const a = data[i * 4 + 3];
      if (!want) { if (a > 8) wrong++; continue; }
      if (a < 248 || Math.abs(data[i*4] - want[0]) > 1 || Math.abs(data[i*4+1] - want[1]) > 1
        || Math.abs(data[i*4+2] - want[2]) > 1) wrong++;
    }
  });
  console.log(`${c.name}: ${got.length} frames, ${total - wrong}/${total} pixels match Chromium's decoder`
    + (wrong ? `  ✗ ${wrong} WRONG` : '  ✓'));
  if (wrong) bad++;
}
await browser.close();
server.close();
process.exit(bad ? 1 : 0);
