/**
 * PIXEL-GRID MOTION CONTRACT
 *
 * Hand-drawn pixel animation moves in WHOLE CELLS: a thing holds, jumps one
 * cell, holds again. A video model gives continuous motion, so content sits
 * BETWEEN cells and every edge cell alternates between two palette entries as
 * the edge sweeps across it. That flicker is not quantisation noise and no
 * amount of palette locking removes it — it is sub-cell motion, and the only
 * fix is to resample the content onto the lattice.
 *
 * Three things are pinned here, and every one of them was wrong first:
 *
 *  · motion is estimated against the PREVIOUS frame and accumulated, not
 *    against frame 0. A clip drifting a third of a cell per frame has moved
 *    five cells by the end — past any affordable search window — so a distant
 *    reference silently clamps and reports a third of the real motion.
 *  · a band's confidence is the MIN of its two axes, not the max. Taking the
 *    max let a garbage horizontal estimate ride in on a vertical one that
 *    happened to look sharp: contrast 1.04 passed a 1.12 gate.
 *  · snapping is OPT-IN. It cannot reliably detect when it applies — a small
 *    object crossing a still band is real, rhythmic motion, and snapping the
 *    whole band to it damages everything else in it. Three rounds of gates each
 *    cut the false positives and none closed it, so the tool reports the
 *    estimate and the caller decides. Same rule as the grid: do not detect what
 *    you can be told.
 *
 * Run: node tests/pxa-motion.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BIG, PAL, truthFrame, driftFrame } from './fixtures/pxa-scene.mjs';
import { sampleCells, buildPalette, assignFrames } from '../tools/pxa/ingest.mjs';
import { estimateBands, snapShifts } from '../tools/pxa/motion.mjs';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
let checks = 0;
const ok = (cond, msg) => { checks++; assert.ok(cond, msg); };

const F = BIG, N = 14, DRIFT = 0.35;
const art = truthFrame(0, F.W, F.H);
const frames = Array.from({ length: N }, (_, t) => driftFrame(art, t, F, DRIFT));
const grid = { cols: F.W, rows: F.H, px: F.OW / F.W, py: F.OH / F.H, ox: 0, oy: 0 };

/* ── 1. the estimate tracks the real drift ─────────────────────────────── */

const bands = estimateBands(frames, grid);
const last = bands[N - 1];
const measured = last.map((b) => b.dx / grid.px);
const expected = DRIFT * (N - 1);
const worst = Math.max(...measured.map((m) => Math.abs(m - expected)));
ok(worst < 0.35,
  `drift measured ${measured.map((m) => m.toFixed(2)).join(', ')} cells against a true ${expected.toFixed(2)}. `
  + `The estimate must chain frame-to-frame and accumulate: matching every frame against frame 0 needs a `
  + `search window wider than the total motion, so it clamps and under-reports — measured 1.77 cells where `
  + `the truth was 5.25.`);

/* ── 2. snapped frames differ by whole cells, or not at all ────────────── */

function encode(shifts) {
  const sampled = frames.map((img, t) => sampleCells(img, grid, { shift: shifts ? shifts[t] : null }));
  const counts = new Map();
  for (const f of sampled) for (let i = 0; i < f.cells.length; i += 4) {
    const k = (Math.round(f.cells[i] / 4) << 12) | (Math.round(f.cells[i + 1] / 4) << 6) | Math.round(f.cells[i + 2] / 4);
    const e = counts.get(k);
    if (e) { e[0] += f.cells[i]; e[1] += f.cells[i + 1]; e[2] += f.cells[i + 2]; e[3]++; }
    else counts.set(k, [f.cells[i], f.cells[i + 1], f.cells[i + 2], 1]);
  }
  const samples = [...counts.values()].map((e) => [e[0] / e[3], e[1] / e[3], e[2] / e[3], e[3]]);
  return assignFrames(sampled, buildPalette(samples, PAL.length), { vote: true });
}

/** Frames where a cell changed while its own previous change went the other
 *  way — a cell rocking between two entries, which is the defect itself. */
function rocking(grids) {
  let n = 0;
  for (let t = 2; t < grids.length; t++) {
    for (let i = 0; i < grids[t].length; i++) {
      if (grids[t][i] !== grids[t - 1][i] && grids[t][i] === grids[t - 2][i]) n++;
    }
  }
  return n;
}
const churn = (grids) => grids.slice(1).map((g, t) => {
  let n = 0;
  for (let i = 0; i < g.length; i++) if (g[i] !== grids[t][i]) n++;
  return n;
});

const loose = encode(null);
const snapped = encode(snapShifts(bands, grid));

ok(rocking(loose) > 0,
  `the fixture produced no rocking cells without snapping, so it is not provoking the defect this contract `
  + `exists for. The drift must be rendered with SMOOTH edges — a nearest-neighbour render puts hard edges at `
  + `sub-cell positions and the mode sampler eats them, which measured zero flicker and made the problem look `
  + `solved when it had not been posed.`);
ok(rocking(snapped) === 0,
  `${rocking(snapped)} cells still rock between two palette entries after snapping — the content is not `
  + `landing on the lattice`);

const cs = churn(snapped);
const held = cs.filter((c) => c === 0).length;
ok(held >= 4,
  `only ${held} of ${cs.length} frames hold completely still. Whole-cell motion at ${DRIFT} cells per frame `
  + `must HOLD for most frames and jump on the rest; a snapped clip where every frame changes is still `
  + `crawling. Churn was: ${cs.join(' ')}`);
const moved = cs.filter((c) => c > 0);
ok(moved.length > 0 && Math.min(...moved) > grid.cols,
  `a moving frame changed only ${Math.min(...moved)} cells. A whole-cell shift of the content moves far more `
  + `than one row; a small change means sub-cell crawl survived. Churn was: ${cs.join(' ')}`);

/* ── 3. snapping is opt-in, and the tool says what it found ────────────── */

const cli = readFileSync(`${ROOT}/tools/pxa/cli.mjs`, 'utf8');
ok(/flag\('snap',\s*null\)/.test(cli),
  'the CLI no longer reads --snap as an opt-in flag. Snapping must NOT be the default: it cannot detect when '
  + 'it applies, and on material with no whole-band translation it only costs accuracy (measured 100% -> 96.26% '
  + 'on a noisy fixture when it ran by default).');
ok(/if \(snapArg\)/.test(cli), 'the CLI applies snapping unconditionally rather than behind the flag');
ok(/estimateBands\(images/.test(cli) && /describe\(bands/.test(cli),
  'the CLI must print the drift estimate even when not snapping — you cannot decide whether to pass --snap '
  + 'without seeing what the clip actually does');

const motion = readFileSync(`${ROOT}/tools/pxa/motion.mjs`, 'utf8');
ok(/Math\.min\(hx\.contrast, hy\.contrast\) >= minContrast/.test(motion),
  'band confidence is no longer the MIN across the two axes. A vector is only as good as its worse component; '
  + 'taking the max let a contrast of 1.04 through a 1.12 gate.');
/* Assert the gain is USED, not merely computed. The first version of this
   checked for the expression that calculates it, and a planted violation that
   computed it and then dropped it from the condition passed cleanly. */
ok(/still \/ c/.test(motion) && /Math\.max\(hx\.gain, hy\.gain\) >= minGain/.test(motion),
  'the explanation-gain test is gone from the confidence condition. Sharpness alone is the wrong question: a small bright object moving '
  + 'through a flat band gives a very sharp minimum, because the flat part contributes nothing to the '
  + 'projection. Gain asks whether shifting explains the band better than not shifting.');

assert.ok(checks >= 9, `only ${checks} assertions ran — this contract is not exercising the motion path`);
console.log(`pxa motion OK — ${checks} assertions; ${DRIFT} cells/frame drift measured to `
  + `${worst.toFixed(3)} cells over ${N} frames; rocking ${rocking(loose)} -> ${rocking(snapped)}; `
  + `snapped churn ${churn(snapped).join(' ')}`);
