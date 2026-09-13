/**
 * PXA FORMAT CONTRACT
 *
 * The colour-cell animation format (assets/pxa-codec.mjs) and the pipeline
 * that fills it (tools/pxa/ingest.mjs). Four of the five things asserted here
 * were WRONG in the first working version, and every one of them was wrong in
 * the way this repo keeps paying for: the numbers looked healthy.
 *
 *   · the temporal vote deleted real motion, and the encode got SMALLER as a
 *     result — so every metric said it had gone well. Measured: 271 of the
 *     water glints on a 40x24 fixture, gone, with a better compression ratio
 *     to show for it.
 *   · the palette was weighted by cell count, so a flat sky took two entries
 *     and the twelve-cell sun rim — the subject — took none.
 *   · lattice detection on a noisy axis locked onto a 5x harmonic (7 cells
 *     where there were 40) while the other axis was right.
 *   · a truncated stream painted a half grid instead of throwing.
 *
 * The fixture is built here rather than checked in: a damaged render of a
 * known grid, with ground truth in hand. That is the only way to assert
 * RECOVERY rather than self-consistency — an encoder that mis-detects the grid
 * round-trips its own mistake perfectly.
 *
 * Run: node tests/pxa-format.mjs
 */
import assert from 'node:assert/strict';
import { encode, decode, stats, cssVarFor } from '../assets/pxa-codec.mjs';
import { detectGrid, sampleCells, buildPalette, assignFrames, rgbToOklab, hex } from '../tools/pxa/ingest.mjs';

let checks = 0;
const ok = (cond, msg) => { checks++; assert.ok(cond, msg); };

import { N, PAL, BIG, SMALL, damagedFrame, truthOf } from './fixtures/pxa-scene.mjs';

const truth = truthOf(BIG);
const { W, H } = BIG;

function runPipeline(strength, opts = {}) {
  const F = opts.fixture || BIG;
  const frames = opts.fixture ? truthOf(F) : truth;
  const imgs = frames.map((g, t) => damagedFrame(g, 1000 + t, strength, F));
  const grid = opts.grid || detectGrid(imgs, opts.detect);
  const sampled = imgs.map((im) => sampleCells(im, grid));
  const counts = new Map();
  for (const f of sampled) for (let i = 0; i < f.cells.length; i += 4) {
    const k = (Math.round(f.cells[i] / 4) << 12) | (Math.round(f.cells[i + 1] / 4) << 6) | Math.round(f.cells[i + 2] / 4);
    const e = counts.get(k);
    if (e) { e[0] += f.cells[i]; e[1] += f.cells[i + 1]; e[2] += f.cells[i + 2]; e[3]++; }
    else counts.set(k, [f.cells[i], f.cells[i + 1], f.cells[i + 2], 1]);
  }
  const samples = [...counts.values()].map((e) => [e[0] / e[3], e[1] / e[3], e[2] / e[3], e[3]]);
  const pal = buildPalette(samples, opts.colors || 8);
  const grids = assignFrames(sampled, pal, { vote: opts.vote !== false });
  return { grid, pal, grids, samples, F, frames };
}

/** Grid only — no sampling, no palette. Cheap enough to assert on several
 *  damage levels without making the contract slow. */
function detectOnly(strength, F, opts) {
  const frames = truthOf(F);
  return detectGrid(frames.map((g, t) => damagedFrame(g, 1000 + t, strength, F)), opts);
}

/** Map each produced palette entry back to the truth colour it stands for. */
function mapToTruth(pal) {
  const tl = PAL.map((c) => rgbToOklab(...c));
  return pal.map((c) => {
    const l = rgbToOklab(...c);
    let b = 0, bd = Infinity;
    tl.forEach((t, i) => { const d = (l[0] - t[0]) ** 2 + (l[1] - t[1]) ** 2 + (l[2] - t[2]) ** 2; if (d < bd) { bd = d; b = i; } });
    return b;
  });
}

function accuracy(grids, pal, F = BIG, frames = truth) {
  const m = mapToTruth(pal);
  let wrong = 0, total = 0;
  for (let t = 0; t < N; t++) for (let i = 0; i < F.W * F.H; i++) { total++; if (m[grids[t][i]] !== frames[t][i]) wrong++; }
  return { wrong, total, pct: 1 - wrong / total };
}

/* ── 1. the grid is recovered, at a fractional pitch ────────────────────── */

const run = runPipeline(6, { colors: 8 });
ok(run.grid.cols === W && run.grid.rows === H,
  `lattice detection read ${run.grid.cols}x${run.grid.rows}, truth is ${W}x${H} — a grid off by one cell `
  + `round-trips its own mistake perfectly, so nothing downstream can catch this`);
const px = BIG.OW / BIG.W, py = BIG.OH / BIG.H;
ok(Math.abs(run.grid.px - px) < 0.25 && Math.abs(run.grid.py - py) < 0.25,
  `pitch read ${run.grid.px.toFixed(3)}x${run.grid.py.toFixed(3)}, truth ${px.toFixed(3)}x${py.toFixed(3)} — `
  + `the search must allow FRACTIONAL pitch; a 2K render of a small scene never lands on a whole number`);

/* ── 2. every cell comes back ───────────────────────────────────────────── */

const acc = accuracy(run.grids, run.pal);
if (acc.pct !== 1) {
  const m = mapToTruth(run.pal), conf = {};
  for (let t = 0; t < N; t++) for (let i = 0; i < W * H; i++) {
    const want = truth[t][i], got = m[run.grids[t][i]];
    if (want !== got) conf[`${want}→${got}`] = (conf[`${want}→${got}`] || 0) + 1;
  }
  console.error('  confusions:', Object.entries(conf).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}×${v}`).join(' '));
  console.error('  palette:', run.pal.map(hex).join(' '), '→ truth', m.join(','));
}
ok(acc.pct === 1, `recovered ${(acc.pct * 100).toFixed(2)}% of cells (${acc.wrong} wrong of ${acc.total}) from a damaged render`);

/* ── 3. the palette spends entries on salience, not on area ─────────────── */

const hit = new Set(mapToTruth(run.pal));
const used = new Set(truth.flatMap((g) => [...g]));
ok([...used].every((v) => hit.has(v)),
  `the palette dropped truth colours ${[...used].filter((v) => !hit.has(v)).join(',')}. `
  + `buildPalette must weight by count^0.5, not count: linear weighting spends entries on AREA, and the `
  + `sun rim here is twelve cells — small, and the subject. A flat field does not need two entries.`);

/* ── 4. the temporal vote may not delete motion ─────────────────────────── */

const voted = runPipeline(6, { vote: true, colors: 8 });
const unvoted = runPipeline(6, { vote: false, colors: 8 });
const mv = mapToTruth(voted.pal), mu = mapToTruth(unvoted.pal);
let glintsVoted = 0, glintsUnvoted = 0, glintsTruth = 0;
for (let t = 1; t < N - 1; t++) for (let i = 0; i < W * H; i++) {
  if (truth[t][i] === 6) { glintsTruth++; if (mv[voted.grids[t][i]] === 6) glintsVoted++; if (mu[unvoted.grids[t][i]] === 6) glintsUnvoted++; }
}
ok(glintsTruth > 40, `fixture must actually contain single-frame accents to test against — found ${glintsTruth}`);
ok(glintsVoted === glintsUnvoted,
  `the three-frame vote removed ${glintsUnvoted - glintsVoted} of ${glintsTruth} single-frame accents. `
  + `It must fire ONLY across a quantisation boundary — between two palette entries that are each other's `
  + `nearest neighbour. A cell flickering between two near-identical greens is noise; a glint jumps several `
  + `entries and is the animation. The ungated version deletes the second and IMPROVES the compression `
  + `ratio doing it, which is why this is a test and not a comment.`);

/* ── 5. the lattice survives both ends of the damage range ─────────────── */

/* ⭐ The UNDAMAGED render is one of the two hard cases, which is the opposite
   of what anyone expects. A video's 8x8 codec block boundaries form a lattice
   of their own, and noise is what buries it — so on the cleanest possible
   material the detector has the block grid competing at full strength with
   nothing drowning it out. Both fixtures are checked at zero damage for
   exactly this reason; measured, the two rules that hold here (coverage
   squared, and square-cell repair) fail ONLY here and at the far end. */
for (const F of [BIG, SMALL]) {
  const clean = detectOnly(0, F);
  ok(clean.cols === F.W && clean.rows === F.H,
    `on an UNDAMAGED ${F.OW}x${F.OH} render the lattice read ${clean.cols}x${clean.rows} instead of `
    + `${F.W}x${F.H}. Clean material is a hard case, not an easy one: the 8x8 codec block grid is a `
    + `lattice too, and with no noise to bury it the detector can lock onto it (measured: a 40-cell axis `
    + `read as 113 cells, exactly 8.0 px per cell). Two things keep it off — scoring only the top 3% of `
    + `edge columns, since block edges are many and weak while colour steps are few and strong, and `
    + `SQUARING coverage so "explains nearly all of them" beats "explains a third at three times the `
    + `density". Square-cell repair is the backstop when one axis still slips.`);
}

/* ── 5b. and at the far end, where the frame average is what saves it ───── */

const noisy = detectOnly(200, SMALL);
ok(noisy.cols === SMALL.W && noisy.rows === SMALL.H,
  `at 33x the drift of the main run the lattice read ${noisy.cols}x${noisy.rows} instead of `
  + `${SMALL.W}x${SMALL.H}. Detection must run on the MEAN OF THE FRAMES, and the mean must be taken `
  + `over the signed pixels rather than over each frame's edge energy. Averaging energy looks like `
  + `denoising and is not — edge energy is an absolute difference, so E|noise| does not fall with more `
  + `samples; it just turns spiky noise into a steady raised floor that lowers the very contrast the `
  + `detector runs on. Averaging the pixels cancels noise properly, and the lattice is the one thing in `
  + `the clip that does not move, so it survives the average while moving content fades.`);

/* ── 6. the wire format round-trips, and refuses to half-render ─────────── */

const doc = encode(run.grids, { w: W, h: H, fps: 12, palette: run.pal.map(hex) });
const back = decode(doc);
let exact = true;
for (let t = 0; t < N; t++) for (let i = 0; i < W * H; i++) if (back.frames[t][i] !== run.grids[t][i]) exact = false;
ok(exact, 'encode → decode is not lossless');
ok(doc.frames[0][0] === 'K', 'frame 0 must be a keyframe — the player restores it on every loop');
ok(doc.frames.some((f) => f[0] === 'D'), 'no delta frames were produced; the encoder is not choosing the shorter encoding');

for (const [why, bad] of [
  ['a keyframe that does not fill the grid', { pxa: 1, w: 4, h: 4, fps: 12, palette: ['#fff'], frames: ['KCA'] }],
  ['an index past the end of the palette', { pxa: 1, w: 2, h: 2, fps: 12, palette: ['#fff'], frames: ['KEB'] }],
  ['a delta frame with nothing before it', { pxa: 1, w: 2, h: 2, fps: 12, palette: ['#fff'], frames: ['DAEA'] }],
  ['an unknown frame mode', { pxa: 1, w: 2, h: 2, fps: 12, palette: ['#fff'], frames: ['XEA'] }],
  ['a document from another format version', { pxa: 99, w: 2, h: 2, fps: 12, palette: ['#fff'], frames: ['KEA'] }]
]) {
  let threw = false;
  try { decode(bad); } catch { threw = true; }
  ok(threw, `decode() accepted ${why} — a truncated asset must throw, not paint a half grid that reads as a design decision`);
}

/* ── 7. rotating palette slots resolve to the engine's variables ────────── */

ok(cssVarFor('@3') === '--bw-palette-3', '@N must resolve to the ridge ramp');
ok(cssVarFor('@gem') === '--bw-palette-gem', '@gem must resolve to the published gem slot');
ok(cssVarFor('#ff0000') === null && cssVarFor('-') === null, 'literals and transparent are not variables');
ok(cssVarFor('@11') === null && cssVarFor('@nonsense') === null,
  'an unknown slot must resolve to null so the player holds the cell transparent, rather than to a var() '
  + 'name that does not exist and paints as nothing-in-particular');

/* ── anti-vacuity ───────────────────────────────────────────────────────── */

const s = stats(doc);
assert.ok(checks >= 20, `only ${checks} assertions ran — this contract is not exercising the pipeline`);
assert.ok(s.cells === W * H && s.frames === N, 'stats() disagrees with the document it was given');

console.log(
  `pxa format OK — ${checks} assertions; ${W}x${H}x${N} recovered at ${(acc.pct * 100).toFixed(2)}% from a `
  + `${BIG.OW}x${BIG.OH} damaged render (pitch ${px.toFixed(3)}px), and ${SMALL.W}x${SMALL.H} `
  + `${SMALL.OW}x${SMALL.OH} detected at 0x and 33x damage; ${s.coded}B coded vs ${s.raw}B raw`);
