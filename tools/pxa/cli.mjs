#!/usr/bin/env node
/**
 * pxa — build and inspect colour-cell animations.
 *
 *   node tools/pxa/cli.mjs encode  <frames-dir> -o out.pxa.json [options]
 *   node tools/pxa/cli.mjs inspect <file.pxa.json>
 *   node tools/pxa/cli.mjs preview <file.pxa.json> -o <dir> [--scale 8]
 *
 * `preview` writes the decoded frames back out as PNGs. That is the only
 * honest way to sign off an encode: the numbers in `inspect` will happily look
 * healthy for a grid that was detected one cell off. Look at the pictures.
 *
 * Getting frames out of a clip (ffmpeg is a prerequisite for video, nothing
 * else here needs it):
 *
 *   ffmpeg -i clip.mp4 -vf fps=12 frames/%04d.png
 *
 * H3 renders at 24fps, so 12 and 8 and 6 are exact decimations of it — pick
 * one of those and no frame is ever resampled from two source frames.
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readPNG, writePNG } from './png.mjs';
import { detectGrid, sampleCells, buildPalette, assignFrames, hex, rgbToOklab } from './ingest.mjs';
import { estimateBands, snapShifts, describe } from './motion.mjs';
import { cmdTui } from './tui.mjs';
import { encode, decode, stats, cssVarFor } from '../../assets/pxa-codec.mjs';

export const USAGE = `pxa — build and inspect colour-cell animations.

  pxa encode  <frames-dir> -o out.pxa.json [options]
  pxa inspect <file.pxa.json>
  pxa preview <file.pxa.json> -o <dir> [--scale 8]
  pxa tui     <file.pxa.json>

encode options
  -o, --out <file>   where to write (required)
  --cells WxH        set the grid by hand instead of detecting it
  --colors N         palette size (default 16)
  --fps N            declared frame rate (default 12)
  --every N          keep every Nth frame
  --map ramp|keep    "ramp" maps the palette onto --bw-palette-1..10 so the
                     animation rotates with the site's colour groups (max 10)
  --alpha            treat near-transparent cells as transparent
  --hysteresis F     0..1, how much closer a new colour must be to switch (.3)
  --smooth F         0..1, spatial regularisation of the palette assignment
                     (default 0.6; --smooth 0 disables).
                     A cell pays for being far from its own colour AND for
                     disagreeing with a neighbour — but the bond weight follows
                     how similar the two cells LOOK, so a real colour edge feels
                     no pressure and only flat-field speckle merges. Measured:
                     on an undamaged render quantised to the scene's own palette
                     size it moves ZERO cells; given a redundant near-duplicate
                     entry it folds the two together without changing what the
                     picture says; on a noisy render it takes accuracy from
                     99.83% to 100% and a quarter off the file.
  --no-vote          disable the three-frame outlier vote
  --snap [all|rows]  force whole-cell motion on drifting bands. Without it,
                     content that drifts sub-cell makes edge cells alternate
                     between two palette entries every frame. The drift estimate
                     is always printed; "--snap 12-23" applies it to those cell
                     rows only, because a still band with a small moving object
                     inside it is not a translating band.
  --bands N          how many independently-moving horizontal bands (default 6)

\`tui\` plays it in the terminal — a pixel grid and a terminal grid are the same
object, so one cell carries two pixels with the upper half block and nothing is
scaled or approximated. It is the fastest way to answer "did this encode right".

\`preview\` writes the decoded frames back out as PNGs. That is the only honest
way to sign off an encode: the numbers in \`inspect\` will happily look healthy
for a grid that was detected one cell off. Look at the pictures.

Getting frames out of a clip (ffmpeg is a prerequisite for video on the command
line; the studio decodes video in the browser and needs nothing):

  ffmpeg -i clip.mp4 -vf fps=12 frames/%04d.png

H3 renders at 24fps, so 12 and 8 and 6 are exact decimations of it — pick one
of those and no frame is ever resampled from two source frames.`;

let argv = process.argv.slice(2);
let cmd = argv[0];
const flag = (name, dflt) => {
  // Accept both `-o out` and `--out out`; a tool whose own usage line does not
  // parse is a bad first impression for every later claim it makes.
  let i = argv.indexOf(`--${name}`);
  if (i < 0 && name.length === 1) i = argv.indexOf(`-${name}`);
  if (i < 0) return dflt;
  const next = argv[i + 1];
  return next === undefined || next.startsWith('--') ? true : next;
};
const has = (name) => argv.includes(`--${name}`);
const num = (name, dflt) => { const v = flag(name, null); return v === null || v === true ? dflt : Number(v); };

function die(msg) { console.error(`pxa: ${msg}`); process.exit(1); }

function framePaths(dir) {
  if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) die(`${dir} is not a directory of PNG frames`);
  const files = readdirSync(dir).filter((f) => /\.png$/i.test(f))
    .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
  if (!files.length) die(`${dir} holds no PNG frames — did ffmpeg write somewhere else?`);
  return files.map((f) => join(dir, f));
}

/* ── encode ─────────────────────────────────────────────────────────────── */

function cmdEncode() {
  const dir = argv[1];
  const out = flag('o', flag('out', null));
  if (!dir || !out || out === true) die('usage: encode <frames-dir> -o <out.pxa.json> [--cells WxH] [--colors N] [--fps N] [--map ramp] [--alpha] [--every N]');

  const colors = num('colors', 16);
  const fps = num('fps', 12);
  const every = Math.max(1, num('every', 1));
  const hysteresis = num('hysteresis', 0.3);
  const vote = !has('no-vote');
  const wantAlpha = has('alpha');
  const map = flag('map', 'keep');
  const forced = flag('cells', null);

  let paths = framePaths(resolve(dir));
  if (every > 1) paths = paths.filter((_, i) => i % every === 0);
  process.stderr.write(`pxa: ${paths.length} frames\n`);

  // Detect the lattice on the first frame only. It cannot change mid-clip —
  // and re-detecting per frame would let a low-contrast frame move the grid,
  // which reads as the whole picture shifting by a cell.
  const first = readPNG(readFileSync(paths[0]));
  let grid;
  if (forced && forced !== true) {
    const m = /^(\d+)x(\d+)$/.exec(String(forced));
    if (!m) die(`--cells wants WxH, got ${forced}`);
    const cols = +m[1], rows = +m[2];
    grid = { cols, rows, px: first.width / cols, py: first.height / rows, ox: 0, oy: 0, forced: true };
    process.stderr.write(`pxa: grid forced to ${cols}x${rows} (${grid.px.toFixed(2)}x${grid.py.toFixed(2)} px per cell)\n`);
  } else {
    // Detect on several frames, not one. Noise averages out; boundaries do not.
    const probe = paths.slice(0, 8).map((p) => readPNG(readFileSync(p)));
    const g = detectGrid(probe);
    grid = { cols: g.cols, rows: g.rows, px: g.px, py: g.py, ox: g.ox, oy: g.oy };
    const aspect = g.px / g.py;
    process.stderr.write(
      `pxa: grid ${g.cols}x${g.rows}  pitch ${g.px.toFixed(2)}x${g.py.toFixed(2)}px  `
      + `score ${g.scoreX.toFixed(2)}/${g.scoreY.toFixed(2)}  cell aspect ${aspect.toFixed(3)}\n`);
    if (g.repaired) process.stderr.write(`pxa: square-cell repair — ${g.repaired}\n`);
    // 1.25 is measured, not chosen. A source with NO lattice — smooth
    // gradients and soft blobs — scores exactly 1.00 on both axes, because
    // boundary energy and mid-cell energy are then the same population. Real
    // upscaled pixel art measured 1.44 at its worst across 14 configurations
    // (two grid sizes x seven damage levels) and 11.18 at its best. The gap
    // between 1.00 and 1.44 is where the line goes.
    if (g.scoreX < 1.25 || g.scoreY < 1.25) {
      process.stderr.write(
        `pxa: WARNING weak lattice (x ${g.scoreX.toFixed(2)}, y ${g.scoreY.toFixed(2)}). `
        + `The source may not be upscaled pixel art. Pass --cells WxH to set the grid yourself.\n`);
    }
    if (aspect < 0.9 || aspect > 1.11) {
      process.stderr.write(
        `pxa: WARNING cells are not square (aspect ${aspect.toFixed(3)}) even after repair; `
        + `check the preview before shipping.\n`);
    }
  }

  const images = [];
  for (const p of paths) {
    const img = readPNG(readFileSync(p));
    if (img.width !== first.width || img.height !== first.height) die(`${p} is ${img.width}x${img.height}, first frame is ${first.width}x${first.height}`);
    images.push(img);
  }

  /* Pixel-grid motion. Without it a surface drifting a third of a cell per
     frame makes every edge cell alternate between two palette entries — which
     reads as a video behind a mesh, not as pixel art. With it the content is
     resampled onto the lattice and the frame-to-frame change is a whole number
     of cells. */
  /* ⭐ OFF by default, and reported anyway.
     The algorithm is right for what it is — whole-band translation — and it
     cannot reliably tell when it applies. Its failure mode is a small object
     moving inside a still band: a three-cell sun stepping across a sky is real,
     rhythmic motion, and snapping the whole sky to it damages everything else
     in that band. Three rounds of gates (sharpness, explanation gain, rhythm)
     each cut the false positives and none of them closed it.
     So this follows the same rule as the grid itself: DO NOT DETECT WHAT YOU
     CAN BE TOLD. The estimate is always printed, because you cannot decide
     without it; applying it is your call, per band. */
  let shifts = null;
  const snapArg = flag('snap', null);
  if (images.length > 1) {
    const bands = estimateBands(images, grid, { bands: num('bands', 6) });
    process.stderr.write(`pxa: whole-band drift, estimated over ${num('bands', 6)} bands\n${describe(bands, grid)}\n`);

    if (snapArg) {
      let pick = null;
      if (snapArg !== true && String(snapArg) !== 'all') {
        pick = new Set();
        for (const part of String(snapArg).split(',')) {
          const m = /^(\d+)(?:-(\d+))?$/.exec(part.trim());
          if (!m) die(`--snap takes "all" or cell-row ranges like 12-23, got ${part}`);
          for (let r = +m[1]; r <= (m[2] === undefined ? +m[1] : +m[2]); r++) pick.add(r);
        }
      }
      for (const frame of bands) {
        for (const b of frame) {
          const inside = !pick || [...Array(b.r1 - b.r0)].some((_, k) => pick.has(b.r0 + k));
          if (!inside) { b.dx = 0; b.dy = 0; b.confident = false; }
        }
      }
      shifts = snapShifts(bands, grid);
      process.stderr.write(`pxa: motion snapped to whole cells${pick ? ` on rows ${snapArg}` : ''} — `
        + `content is resampled onto the lattice, so frames differ by a whole number of cells\n`);
    } else if (bands[bands.length - 1].some((b) => Math.abs(b.dx / grid.px) > 0.75)) {
      process.stderr.write('pxa: a band drifts more than a cell over this clip. Without --snap it will move '
        + 'SUB-CELL, and edge cells will alternate between two palette entries every frame — a video behind a '
        + 'mesh rather than pixel art. Pass --snap (or --snap <rows>) to force whole-cell motion.\n');
    }
  }

  const sampled = images.map((img, t) => sampleCells(img, grid, { shift: shifts ? shifts[t] : null }));

  // One palette for the whole clip. Weight each distinct cell colour by how
  // often it occurs so a large flat sky does not get the same say as a
  // three-cell highlight — and so the palette is not dominated by ringing.
  const counts = new Map();
  let anyTransparent = false;
  for (const f of sampled) {
    for (let i = 0; i < f.cells.length; i += 4) {
      if (wantAlpha && f.cells[i + 3] < 128) { anyTransparent = true; continue; }
      const k = (Math.round(f.cells[i] / 4) << 12) | (Math.round(f.cells[i + 1] / 4) << 6) | Math.round(f.cells[i + 2] / 4);
      const e = counts.get(k);
      if (e) { e[0] += f.cells[i]; e[1] += f.cells[i + 1]; e[2] += f.cells[i + 2]; e[3]++; }
      else counts.set(k, [f.cells[i], f.cells[i + 1], f.cells[i + 2], 1]);
    }
  }
  const samples = [...counts.values()].map((e) => [e[0] / e[3], e[1] / e[3], e[2] / e[3], e[3]]);
  const pal = buildPalette(samples, Math.min(colors, samples.length));
  process.stderr.write(`pxa: ${samples.length} distinct cell colours → ${pal.length} palette entries\n`);

  const transparent = anyTransparent;
  const base = transparent ? 1 : 0;
  const grids = assignFrames(sampled, pal, {
    hysteresis, vote, base, transparentIndex: transparent ? 0 : -1,
    smooth: num('smooth', 0.6), cols: grid.cols
  });

  let entries = pal.map(hex);
  if (map === 'ramp') {
    // The site's ridge ramp is --bw-palette-1..10, light to dark, and
    // buildPalette already returns entries sorted by lightness. A 1:1 mapping
    // is therefore the whole job — but only if there are at most ten. Spreading
    // twelve colours over ten slots would collapse two distinct art colours
    // into one, which is a silent change to the picture.
    if (entries.length > 10) die(`--map ramp needs at most 10 colours, this encode has ${entries.length}. Re-run with --colors 10.`);
    entries = entries.map((_, i) => `@${i + 1}`);
    process.stderr.write(`pxa: palette mapped onto the rotating ridge ramp @1..@${entries.length}\n`);
  } else if (map !== 'keep') {
    die(`--map takes "keep" or "ramp", got ${map}`);
  }
  if (transparent) entries = ['-', ...entries];

  const doc = encode(grids, {
    w: grid.cols, h: grid.rows, fps, palette: entries,
    meta: { source: dir, frames: paths.length, pitch: [+grid.px.toFixed(3), +grid.py.toFixed(3)] }
  });

  // Never ship an asset that cannot be read back. This is cheap and it has
  // caught truncation in every codec anyone has ever written.
  const check = decode(doc);
  for (let t = 0; t < grids.length; t++) {
    for (let i = 0; i < grids[t].length; i++) {
      if (check.frames[t][i] !== grids[t][i]) die(`round-trip failed at frame ${t} cell ${i} — refusing to write`);
    }
  }

  const json = JSON.stringify(doc);
  writeFileSync(out, json + '\n');
  const s = stats(doc);
  process.stderr.write(
    `pxa: wrote ${out} — ${doc.w}x${doc.h}x${doc.frames.length} @${fps}fps, `
    + `${entries.length} colours, ${(json.length / 1024).toFixed(1)}KB `
    + `(${(s.ratio * 100).toFixed(0)}% of raw indices, ${s.frames - s.keyframes} delta frames)\n`);
}

/* ── inspect ────────────────────────────────────────────────────────────── */

function cmdInspect() {
  const doc = JSON.parse(readFileSync(argv[1], 'utf8'));
  const d = decode(doc);
  const s = stats(doc);
  console.log(`${argv[1]}`);
  console.log(`  grid      ${d.w} x ${d.h} cells  (${s.cells} cells)`);
  console.log(`  frames    ${s.frames} @ ${d.fps}fps = ${(s.frames / d.fps).toFixed(2)}s   ${s.keyframes} key / ${s.frames - s.keyframes} delta`);
  console.log(`  coded     ${s.coded}B vs ${s.raw}B raw indices (${(s.ratio * 100).toFixed(1)}%)`);
  console.log(`  palette   ${d.palette.length} entries`);
  for (let i = 0; i < d.palette.length; i++) {
    const v = cssVarFor(d.palette[i]);
    console.log(`     ${String(i).padStart(2)}  ${d.palette[i].padEnd(10)}${v ? `→ var(${v})` : ''}`);
  }
  let churn = 0;
  for (let t = 1; t < d.frames.length; t++) {
    let n = 0;
    for (let i = 0; i < s.cells; i++) if (d.frames[t][i] !== d.frames[t - 1][i]) n++;
    churn += n;
  }
  console.log(`  motion    ${(100 * churn / (s.cells * Math.max(1, d.frames.length - 1))).toFixed(1)}% of cells change per frame`);
}

/* ── preview ────────────────────────────────────────────────────────────── */

function cmdPreview() {
  const doc = JSON.parse(readFileSync(argv[1], 'utf8'));
  const out = flag('o', flag('out', null));
  if (!out || out === true) die('usage: preview <file.pxa.json> -o <dir> [--scale 8]');
  const scale = Math.max(1, num('scale', 8));
  const d = decode(doc);
  mkdirSync(out, { recursive: true });

  const rgb = d.palette.map((e) => {
    if (e === '-') return null;
    if (e[0] === '@') return [128, 128, 128]; // a rotating slot has no fixed colour outside a page
    const h = e.slice(1);
    const n = h.length === 3 ? h.split('').map((c) => parseInt(c + c, 16)) : [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
    return n;
  });
  if (d.palette.some((e) => e[0] === '@')) {
    process.stderr.write('pxa: this asset uses rotating palette slots; preview paints them grey. Open it in the studio page to see real colour.\n');
  }

  for (let t = 0; t < d.frames.length; t++) {
    const W = d.w * scale, H = d.h * scale;
    const px = new Uint8Array(W * H * 4);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const c = rgb[d.frames[t][Math.floor(y / scale) * d.w + Math.floor(x / scale)]];
        const p = (y * W + x) * 4;
        if (!c) { px[p + 3] = 0; continue; }
        px[p] = c[0]; px[p + 1] = c[1]; px[p + 2] = c[2]; px[p + 3] = 255;
      }
    }
    writeFileSync(join(out, `${String(t).padStart(4, '0')}.png`), writePNG(W, H, px));
  }
  process.stderr.write(`pxa: wrote ${d.frames.length} preview frames to ${out} at ${scale}x\n`);
}

void rgbToOklab;

/** Returns true when the command was recognised. Exported so the packaged app
 *  (tools/pxa/app.mjs) dispatches through the SAME code as the CLI — a second
 *  copy of the argument handling is a second list to keep in step. */
export function main(args) {
  argv = args;
  cmd = argv[0];
  if (cmd === 'encode') { cmdEncode(); return true; }
  if (cmd === 'inspect') { cmdInspect(); return true; }
  if (cmd === 'preview') { cmdPreview(); return true; }
  if (cmd === 'tui') { cmdTui(argv[1]); return true; }
  return false;
}

/* Run only when invoked directly, so `import` does not execute a command.
   ⚠️ The url comparison alone is not enough. Inside a compiled single-file
   binary the bundler rewrites import.meta.url, and it compared EQUAL to the
   executable's own path — so importing this module from app.mjs ran a command
   at import time, printed the usage text and exited before the app had
   dispatched anything. The folder-drop path was dead in the packaged build and
   perfectly fine under node, which is the only reason it was caught: the
   binary was actually run. The basename check is what pins it to this file. */
const invokedDirectly = process.argv[1]
  && /[\\/]cli\.mjs$/.test(process.argv[1])
  && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  if (!main(process.argv.slice(2))) { console.error(USAGE); process.exit(1); }
}
