/**
 * EXPORT CONTRACT — GIF and spritesheet
 *
 * ⭐ A .pxa and a GIF store the same thing: a global colour table and frames of
 * indices into it. Converting a VIDEO to GIF is lossy because the video must be
 * quantised to 256 colours first; converting a .pxa is a transfer, and the
 * contract is that it stays one — every pixel identical, not merely similar.
 *
 * The delta information is not thrown away either: GIF frames carry their own
 * rectangle, so each frame after the first is the bounding box of what changed,
 * over a canvas that is not disposed.
 *
 * ⚠️ This file carries its own GIF DECODER. Checking that `file` recognises the
 * header, or that the bytes start with GIF89a, proves nothing about LZW — the
 * four details that break it (variable code width, the clear code, when the
 * width grows, least-significant-bit packing) all produce a file that opens as
 * a grey rectangle rather than one that fails to open. Decoding it back is the
 * only assertion worth making. The encoder was separately checked against
 * Chromium's decoder, pixel for pixel across every frame; this is the
 * regression guard that needs no browser.
 *
 * Run: node tests/pxa-export.mjs
 */
import assert from 'node:assert/strict';
import { encode } from '../assets/pxa-codec.mjs';
import { encodeGIF, EXACT_RATES } from '../tools/pxa/gif.mjs';
import { composeSheet, sheetGrid } from '../tools/pxa/sheet.mjs';
import { readPNG, writePNG } from '../tools/pxa/png.mjs';

let checks = 0;
const ok = (cond, msg) => { checks++; assert.ok(cond, msg); };

/* ── a minimal GIF reader ───────────────────────────────────────────────── */

function lzwDecode(data, minCodeSize) {
  const clear = 1 << minCodeSize, eoi = clear + 1;
  let dict = [], codeSize = minCodeSize + 1, next = eoi + 1;
  const reset = () => {
    dict = [];
    for (let i = 0; i < clear; i++) dict[i] = [i];
    dict[clear] = []; dict[eoi] = [];
    next = eoi + 1; codeSize = minCodeSize + 1;
  };
  reset();
  const out = [];
  let bit = 0, prev = null, first = null;
  const read = () => {
    let v = 0;
    for (let i = 0; i < codeSize; i++) {
      const byte = data[bit >> 3];
      if (byte === undefined) return -1;
      v |= ((byte >> (bit & 7)) & 1) << i;
      bit++;
    }
    return v;
  };
  for (;;) {
    const code = read();
    if (first === null) first = code;
    if (code < 0 || code === eoi) break;
    if (code === clear) { reset(); prev = null; continue; }
    let entry;
    if (code < next && dict[code] && dict[code].length) entry = dict[code];
    else if (code === next && prev) entry = [...prev, prev[0]];
    else break;
    out.push(...entry);
    if (prev && next < 4096) {
      dict[next++] = [...prev, entry[0]];
      // ⚠️ NOT the encoder's rule. The encoder emits a code and THEN adds the
      // entry it just learned; the decoder only learns that entry when it reads
      // the NEXT code, so its dictionary is permanently one entry behind. It
      // therefore has to widen one step earlier — on `next === 1<<codeSize`,
      // where the encoder widens on `next > 1<<codeSize`. Using the encoder's
      // condition here reads every code after the first widening at the wrong
      // width, which does not throw: it returns a plausible pixel array that is
      // simply the wrong picture.
      if (next === (1 << codeSize) && codeSize < 12) codeSize++;
    }
    prev = entry;
  }
  // ⚠️ `leadClear` is reported rather than tolerated. THIS decoder initialises
  // its dictionary before reading anything, so a stream missing its opening
  // clear code decodes perfectly here — and that is exactly the trap: a decoder
  // that starts from a stale dictionary (any second image in the same file, and
  // several real implementations) produces garbage from the first code on. The
  // spec requires the clear code; a tolerant reader must still check for it.
  return { out, leadClear: first === clear };
}

/** → { width, height, gct, frames: [{x,y,w,h,delay,transparent,pixels}] } */
function readGIF(buf) {
  assert.equal(buf.subarray(0, 6).toString('ascii'), 'GIF89a', 'not a GIF89a stream');
  const width = buf.readUInt16LE(6), height = buf.readUInt16LE(8);
  const packed = buf[10];
  const gctSize = 1 << ((packed & 7) + 1);
  let i = 13;
  const gct = [];
  for (let k = 0; k < gctSize; k++) { gct.push([buf[i], buf[i + 1], buf[i + 2]]); i += 3; }

  const frames = [];
  let delay = 0, transparent = -1, loops = null, disposal = 0;
  const subBlocks = () => {
    const parts = [];
    for (;;) { const n = buf[i++]; if (!n) break; parts.push(buf.subarray(i, i + n)); i += n; }
    return Buffer.concat(parts);
  };
  for (;;) {
    const b = buf[i++];
    if (b === 0x3b) break;
    if (b === 0x21) {
      const label = buf[i++];
      if (label === 0xf9) {
        const n = buf[i++];
        const flags = buf[i];
        delay = buf.readUInt16LE(i + 1);
        disposal = (flags >> 2) & 7;
        transparent = flags & 1 ? buf[i + 3] : -1;
        i += n; i++;                                    // block + terminator
      } else if (label === 0xff) {
        const n = buf[i++];
        const name = buf.subarray(i, i + n).toString('ascii'); i += n;
        const body = subBlocks();
        if (name === 'NETSCAPE2.0') loops = body.readUInt16LE(1);
      } else { i++; subBlocks(); }
    } else if (b === 0x2c) {
      const x = buf.readUInt16LE(i), y = buf.readUInt16LE(i + 2);
      const w = buf.readUInt16LE(i + 4), h = buf.readUInt16LE(i + 6);
      const lflags = buf[i + 8]; i += 9;
      assert.ok(!(lflags & 0x80), 'local colour tables are not expected');
      const min = buf[i++];
      const { out: pixels, leadClear } = lzwDecode(subBlocks(), min);
      frames.push({ x, y, w, h, delay, transparent, disposal, pixels, leadClear });
    } else assert.fail(`unknown GIF block 0x${b.toString(16)} at ${i - 1}`);
  }
  return { width, height, gct, frames, loops };
}

/* ── fixture ────────────────────────────────────────────────────────────── */

const W = 24, H = 16, N = 8;
const grids = Array.from({ length: N }, (_, t) => {
  const g = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) g[y * W + x] = y < 6 ? 1 : 2;
  // one small moving mark: the whole point of per-frame rectangles
  for (let k = 0; k < 3; k++) g[(4 + k) * W + (3 + t)] = 3;
  return g;
});
const palette = ['-', '#101520', '#3d6b52', '#e7c86a'];
const rgb = palette.map((e) => (e === '-' ? null : [0, 2, 4].map((i) => parseInt(e.slice(1 + i, 3 + i), 16))));
const doc = encode(grids, { w: W, h: H, fps: 10, palette });

/* ── 1. every pixel of every frame survives ─────────────────────────────── */

const g10 = encodeGIF(grids, W, H, rgb, 10, { scale: 1 });
const read = readGIF(g10.buffer);

ok(read.width === W && read.height === H, `GIF is ${read.width}x${read.height}, expected ${W}x${H}`);
ok(read.frames.length === N, `GIF carries ${read.frames.length} frames, expected ${N}`);
ok(read.loops === 0, 'the NETSCAPE looping block is missing or not set to loop forever — a converted loop '
  + 'that plays once is not a loop');

// Composite the frames the way a viewer does: each rectangle painted over the
// canvas left by the one before (disposal 1), transparent index skipped.
const canvas = new Uint8Array(W * H).fill(255);
let wrong = 0, compared = 0;
for (let t = 0; t < N; t++) {
  const f = read.frames[t];
  for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) {
    const v = f.pixels[y * f.w + x];
    if (v === f.transparent) continue;
    canvas[(f.y + y) * W + f.x + x] = v;
  }
  for (let i = 0; i < W * H; i++) { compared++; if (canvas[i] !== grids[t][i]) wrong++; }
}
ok(wrong === 0,
  `${wrong} of ${compared} pixels differ after decoding the GIF back. A .pxa and a GIF store the same thing `
  + `— a colour table and indices — so this conversion is a transfer and must be exact. LZW fails silently: `
  + `a wrong code width or a missed clear code gives a file that opens and shows the wrong picture.`);

/* ── 2. the delta rectangles are actually used ──────────────────────────── */

const areas = read.frames.slice(1).map((f) => f.w * f.h);
ok(Math.max(...areas) < W * H,
  `every frame after the first still covers the whole ${W}x${H} canvas (largest ${Math.max(...areas)} px). `
  + `GIF frames carry their own rectangle and the encoder already knows what changed — a clip where one `
  + `mark moves should ship one mark per frame.`);
ok(read.frames[0].w === W && read.frames[0].h === H, 'the first frame must cover the whole canvas');

/* ── 3. the colour table is the palette, unquantised ────────────────────── */

for (let i = 0; i < palette.length; i++) {
  if (!rgb[i]) continue;
  assert.deepEqual(read.gct[i], rgb[i],
    `colour table entry ${i} is ${read.gct[i]}, expected ${rgb[i]} — the palette must go across unchanged, `
    + `with no quantisation step between`);
  checks++;
}
ok(read.frames.every((f) => f.leadClear),
  'an image stream does not begin with the clear code. A decoder that has just finished the previous frame '
  + 'still holds that frame\'s dictionary, so without the reset it reads the first codes against the wrong '
  + 'table — and LZW does not fail, it returns the wrong picture.');
ok(read.frames[0].transparent === 0,
  'the transparent palette slot is not declared, so a cell meant to show through is painted its table colour');

/* ── 4. the frame rate is told the truth about ──────────────────────────── */

for (const fps of EXACT_RATES) {
  const g = encodeGIF(grids, W, H, rgb, fps, { scale: 1 });
  ok(g.exact && Math.abs(g.fps - fps) < 1e-9,
    `${fps}fps should be expressible exactly (delay ${g.delayCs}cs gives ${g.fps})`);
}
const g12 = encodeGIF(grids, W, H, rgb, 12, { scale: 1 });
ok(!g12.exact,
  '12fps is reported as exact. GIF delay is in whole centiseconds and 100/12 is 8.33, so a 12fps clip '
  + 'plays at 12.5 — every writer that rounds this in silence ships an animation running 4% fast and lets '
  + 'the viewer blame their browser. The caller has to be able to say so.');
ok(Math.abs(g12.fps - 12.5) < 1e-9, `12fps should land on 12.5, got ${g12.fps}`);

let refused = false;
try { encodeGIF(grids, W, H, rgb, 60, { scale: 1 }); } catch { refused = true; }
ok(refused,
  '60fps was accepted. A delay under 2 centiseconds is widely clamped to 10 by browsers, turning the clip '
  + 'into a tenth of its rate — refusing is honest, silently producing a 10fps file is not.');

/* ── 5. scale is whole-pixel ────────────────────────────────────────────── */

const S = 3;
const s3 = readGIF(encodeGIF(grids, W, H, rgb, 10, { scale: S }).buffer);
ok(s3.width === W * S && s3.height === H * S, `scale ${S} gave ${s3.width}x${s3.height}`);

// ⚠️ Sampling one corner proves nothing: the corner of this fixture is a flat
// field, so a sampler that stretches instead of replicating lands on the same
// index anyway and the check passes. Composite the whole scaled animation and
// compare it to the true nearest-neighbour upscale, where every column and row
// of every frame has to be in the right place.
const big = new Uint8Array(W * S * H * S).fill(255);
let sWrong = 0, sCompared = 0;
for (let t = 0; t < N; t++) {
  const f = s3.frames[t];
  for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) {
    const v = f.pixels[y * f.w + x];
    if (v === f.transparent) continue;
    big[(f.y + y) * W * S + f.x + x] = v;
  }
  for (let y = 0; y < H * S; y++) for (let x = 0; x < W * S; x++) {
    sCompared++;
    if (big[y * W * S + x] !== grids[t][((y / S) | 0) * W + ((x / S) | 0)]) sWrong++;
  }
}
ok(sWrong === 0,
  `${sWrong} of ${sCompared} pixels are wrong at scale ${S}. A scaled pixel must be a solid square of the `
  + `same index in the same place — integer scaling is the one thing a pixel format must never get `
  + `approximately right.`);

/* ── 6. the spritesheet is indexable by arithmetic ──────────────────────── */

const SS = 2;
const sheet = composeSheet(grids, W, H, rgb, { scale: SS, cols: 3 });
ok(sheet.cols === 3 && sheet.rows === 3, `8 frames at 3 columns should be 3x3, got ${sheet.cols}x${sheet.rows}`);
ok(sheet.W === 3 * W * SS && sheet.H === 3 * H * SS, `sheet is ${sheet.W}x${sheet.H}`);

// Through a real PNG, because that is what ships. An in-memory buffer that is
// right proves nothing about the file an importer opens.
const png = readPNG(writePNG(sheet.W, sheet.H, sheet.px));
ok(png.width === sheet.W && png.height === sheet.H, `PNG is ${png.width}x${png.height}`);

let shWrong = 0, shCompared = 0, padOpaque = 0;
for (let y = 0; y < sheet.H; y++) for (let x = 0; x < sheet.W; x++) {
  const p = (y * sheet.W + x) * 4;
  const t = ((y / (H * SS)) | 0) * sheet.cols + ((x / (W * SS)) | 0);
  if (t >= N) { if (png.data[p + 3] !== 0) padOpaque++; continue; }
  const idx = grids[t][(((y % (H * SS)) / SS) | 0) * W + (((x % (W * SS)) / SS) | 0)];
  const want = rgb[idx];
  shCompared++;
  if (!want) { if (png.data[p + 3] !== 0) shWrong++; continue; }
  if (png.data[p] !== want[0] || png.data[p + 1] !== want[1]
    || png.data[p + 2] !== want[2] || png.data[p + 3] !== 255) shWrong++;
}
ok(shWrong === 0,
  `${shWrong} of ${shCompared} sheet pixels are wrong. Frames must sit at exact multiples of the cell size, `
  + `left to right then top to bottom, scaled by whole-pixel replication — a sheet that is off by a row or `
  + `resampled cannot be indexed by arithmetic, which is the only reason to want a sheet.`);
ok(padOpaque === 0,
  `${padOpaque} pixels of the unused last-row cells are opaque. The padding of an incomplete row has to be `
  + `transparent, or an importer slicing by cell size picks up a stray frame.`);

// A short last row must be padded, never shortened: 8 frames in 3 columns is
// 3 rows, and the 9th cell exists and is empty.
ok(sheetGrid(8, 3).rows === 3 && sheetGrid(7, 4).rows === 2 && sheetGrid(1, 0).cols === 1,
  'sheetGrid is not padding short rows — cell count must be cols*rows, not the frame count');

/* ── 7. transparency that GOES AWAY ─────────────────────────────────────── */

/* ⚠️ The fixture above never uses the transparent slot, so it says nothing
   about it. This one opens and closes a hole, which is the case GIF gets wrong
   by default: a viewer SKIPS the transparent index instead of writing it, and
   under disposal 1 the canvas is left in place — so a cell that is painted in
   one frame and transparent in the next keeps its old colour forever. The clip
   still plays, and still looks like an animation, which is why this needs a
   test rather than an eye. */
const TW = 6, TH = 4;
const holes = [
  [1, 1, 1, 1, 1, 1,  1, 1, 1, 1, 1, 1,  1, 1, 1, 1, 1, 1,  1, 1, 1, 1, 1, 1],  // solid
  [1, 1, 1, 1, 1, 1,  1, 0, 0, 1, 1, 1,  1, 1, 1, 1, 1, 1,  1, 1, 1, 1, 1, 1],  // hole opens
  [1, 1, 1, 1, 1, 1,  1, 1, 1, 0, 0, 1,  1, 1, 1, 1, 1, 1,  1, 1, 1, 1, 1, 1],  // hole moves
  [1, 1, 1, 1, 1, 1,  1, 1, 1, 1, 1, 1,  1, 1, 1, 1, 1, 1,  1, 1, 1, 1, 1, 1],  // hole closes
  [2, 2, 2, 2, 2, 2,  2, 2, 0, 0, 2, 2,  2, 2, 2, 2, 2, 2,  2, 2, 2, 2, 2, 2]   // and again
].map((a) => Uint8Array.from(a));

const tr = readGIF(encodeGIF(holes, TW, TH, rgb, 10, { scale: 1 }).buffer);
ok(tr.frames.length === holes.length, `transparency clip lost frames: ${tr.frames.length}`);

// Composite like a viewer: honour disposal 2 by clearing the disposed frame's
// own rectangle back to "nothing" before drawing the next one.
const CLEAR = 255;
const tc = new Uint8Array(TW * TH).fill(CLEAR);
let tWrong = 0, tHoles = 0;
for (let t = 0; t < holes.length; t++) {
  const f = tr.frames[t];
  if (t > 0 && tr.frames[t - 1].disposal === 2) {
    const p = tr.frames[t - 1];
    for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) tc[(p.y + y) * TW + p.x + x] = CLEAR;
  }
  for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) {
    const v = f.pixels[y * f.w + x];
    if (v === f.transparent) continue;
    tc[(f.y + y) * TW + f.x + x] = v;
  }
  for (let i = 0; i < TW * TH; i++) {
    const want = holes[t][i] === 0 ? CLEAR : holes[t][i];   // 0 is the transparent slot
    if (holes[t][i] === 0) tHoles++;
    if (tc[i] !== want) tWrong++;
  }
}
ok(tHoles > 0, 'the transparency fixture contains no transparent cells — it would pass without testing anything');
ok(tWrong === 0,
  `${tWrong} cells are wrong once transparency changes over time. Disposal 1 cannot take paint back: a cell `
  + `that is painted and then transparent keeps its old colour, so a hole that opens after frame 0 never `
  + `appears. The frame before one that un-paints has to be disposed to background.`);

assert.ok(checks >= 20, `only ${checks} assertions ran — this contract is not exercising the exporter`);
console.log(`pxa export OK — ${checks} assertions; ${N} frames round-tripped through GIF at ${compared} `
  + `pixels with 0 differences (${sCompared} more at scale ${S}), delta rectangles down to `
  + `${Math.min(...areas)} px, ${EXACT_RATES.length} exact rates, 12fps correctly reported as 12.5, `
  + `and a ${sheet.cols}x${sheet.rows} sheet exact over ${shCompared} pixels through a real PNG; `
  + `${tHoles} transparent cells survive opening and closing over ${holes.length} frames`);
