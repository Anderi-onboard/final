/**
 * COLOUR ASSIGNMENT CONTRACT — spatial regularisation
 *
 * Nearest-entry-per-cell, decided independently, leaves SPECKLE: in a flat
 * field a cell that lands 51% of the way toward the next palette entry takes
 * it while all four neighbours took the other one. Nothing about that cell is
 * different from its neighbours — it is quantisation noise wearing the shape
 * of a detail, and it is the visual difference between "quantised video" and
 * "pixel art".
 *
 * The fix is an energy minimised by ICM: a cell pays for being far from its own
 * colour, and pays again for disagreeing with a neighbour.
 *
 * ⚠️ The bond weight is the design. Measured on one fixture at one strength:
 * weighting by sampled-colour distance scores 100.00% on a noisy render,
 * weighting by label distance 99.96%, and an ungated constant weight 99.46% —
 * and that last one also stirs 96 cells on a render with NO noise in it,
 * taking clean material from 100% to 99.17%. Only the third is a real failure:
 * a filter with no way to tell a boundary from a wobble is a blur with extra
 * steps. The colour weight wins on the merits, not because the alternatives
 * are disasters — all three leave high-contrast detail alone.
 *
 * The general rule is the one the temporal vote taught one module over: a
 * filter must ask whether a disagreement is NOISE, not merely whether it
 * exists.
 *
 * Run: node tests/pxa-colour.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BIG, PAL, N, truthOf, damagedFrame } from './fixtures/pxa-scene.mjs';
import { sampleCells, buildPalette, assignFrames, rgbToOklab } from '../tools/pxa/ingest.mjs';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
let checks = 0;
const ok = (cond, msg) => { checks++; assert.ok(cond, msg); };

const F = BIG, truth = truthOf(F);
const grid = { cols: F.W, rows: F.H, px: F.OW / F.W, py: F.OH / F.H, ox: 0, oy: 0 };

function pipeline(strength, smooth, colours = PAL.length + 1) {
  const imgs = truth.map((g, t) => damagedFrame(g, 1000 + t, strength, F));
  const sampled = imgs.map((im) => sampleCells(im, grid));
  const counts = new Map();
  for (const f of sampled) for (let i = 0; i < f.cells.length; i += 4) {
    const k = (Math.round(f.cells[i] / 4) << 12) | (Math.round(f.cells[i + 1] / 4) << 6) | Math.round(f.cells[i + 2] / 4);
    const e = counts.get(k);
    if (e) { e[0] += f.cells[i]; e[1] += f.cells[i + 1]; e[2] += f.cells[i + 2]; e[3]++; }
    else counts.set(k, [f.cells[i], f.cells[i + 1], f.cells[i + 2], 1]);
  }
  const samples = [...counts.values()].map((e) => [e[0] / e[3], e[1] / e[3], e[2] / e[3], e[3]]);
  const pal = buildPalette(samples, colours);
  return { pal, grids: assignFrames(sampled, pal, { cols: F.W, smooth }) };
}

/** A cell that disagrees with three or more of its four neighbours. */
function speckle(grids) {
  let n = 0;
  for (const g of grids) {
    for (let i = 0; i < g.length; i++) {
      const x = i % F.W, y = (i / F.W) | 0;
      let seen = 0, diff = 0;
      for (const j of [x > 0 ? i - 1 : -1, x < F.W - 1 ? i + 1 : -1, y > 0 ? i - F.W : -1, y < F.H - 1 ? i + F.W : -1]) {
        if (j < 0) continue;
        seen++;
        if (g[j] !== g[i]) diff++;
      }
      if (seen >= 3 && diff >= 3) n++;
    }
  }
  return n;
}

/** The single-cell moving accents in the truth, and how many survived. */
function accents(grids, pal) {
  const tl = PAL.map((c) => rgbToOklab(...c));
  const map = pal.map((c) => {
    const l = rgbToOklab(...c);
    let b = 0, bd = Infinity;
    tl.forEach((t, i) => { const d = (l[0]-t[0])**2 + (l[1]-t[1])**2 + (l[2]-t[2])**2; if (d < bd) { bd = d; b = i; } });
    return b;
  });
  let want = 0, got = 0;
  for (let t = 0; t < N; t++) for (let i = 0; i < F.W * F.H; i++) {
    if (truth[t][i] === 6) { want++; if (map[grids[t][i]] === 6) got++; }
  }
  return { want, got };
}

/* ── 1. it removes speckle where speckle exists ─────────────────────────── */

const rawNoisy = pipeline(30, 0);
const smoothNoisy = pipeline(30, 0.6);
const sRaw = speckle(rawNoisy.grids), sSmooth = speckle(smoothNoisy.grids);

ok(sRaw > 400,
  `the noisy fixture produced only ${sRaw} speckled cells, so it is not posing the problem this contract `
  + `exists for — there is nothing for the regulariser to remove and every assertion below passes for free`);
ok(sSmooth < sRaw * 0.7,
  `spatial regularisation left ${sSmooth} speckled cells against ${sRaw} raw — it is barely doing anything. `
  + `A cell whose four neighbours all disagree with it, in a field where all five look the same, is `
  + `quantisation noise, and the energy must be strong enough to fold it in.`);

/* ── 2. and it does NOT eat single-cell detail ──────────────────────────── */

const aRaw = accents(rawNoisy.grids, rawNoisy.pal);
const aSmooth = accents(smoothNoisy.grids, smoothNoisy.pal);
ok(aRaw.want > 200, `fixture must contain single-cell accents to protect — found ${aRaw.want}`);
ok(aSmooth.got >= aRaw.got,
  `${aRaw.got - aSmooth.got} of ${aRaw.want} single-cell accents were smoothed away. An accent differs from `
  + `its neighbours by several palette steps, so a bond that falls off with colour distance collapses to `
  + `nothing across that boundary and exerts no pressure at all. This is the assertion that a speckle metric `
  + `cannot make on its own: removing detail improves it.`);

/* ── 3a. with an exact palette on clean material it is EXACTLY inert ────── */

const exactRaw = pipeline(0, 0, PAL.length), exactSmooth = pipeline(0, 0.6, PAL.length);
let exactMoved = 0;
for (let t = 0; t < N; t++) for (let i = 0; i < F.W * F.H; i++) {
  if (exactRaw.grids[t][i] !== exactSmooth.grids[t][i]) exactMoved++;
}
ok(exactMoved === 0,
  `regularisation changed ${exactMoved} cells on an undamaged render quantised to exactly the ${PAL.length} `
  + `colours the scene contains. With nothing to merge and no noise to fold in, the per-cell assignment is `
  + `already the energy minimum and ICM must move nothing. A pass that stirs clean material is a blur.`);

/* ── 3b. with a redundant entry it MERGES, and merging is not blurring ──── */

const cleanRaw = pipeline(0, 0), cleanSmooth = pipeline(0, 0.6);
let moved = 0, cells = 0;
for (let t = 0; t < N; t++) for (let i = 0; i < F.W * F.H; i++) {
  cells++;
  if (cleanRaw.grids[t][i] !== cleanSmooth.grids[t][i]) moved++;
}
const cleanAcc = (r) => {
  const tl = PAL.map((c) => rgbToOklab(...c));
  const map = r.pal.map((c) => {
    const l = rgbToOklab(...c); let b = 0, bd = Infinity;
    tl.forEach((t, i) => { const d = (l[0]-t[0])**2 + (l[1]-t[1])**2 + (l[2]-t[2])**2; if (d < bd) { bd = d; b = i; } });
    return b;
  });
  let wrong = 0, total = 0;
  for (let t = 0; t < N; t++) for (let i = 0; i < F.W * F.H; i++) { total++; if (map[r.grids[t][i]] !== truth[t][i]) wrong++; }
  return 1 - wrong / total;
};
/* ⭐ Given one more palette entry than the scene has colours, the extra one is
   a near-duplicate and the block banding picks between the two at random. The
   regulariser folds them together — measured 1852 cells at 8 entries against 0
   at 7. That is a MERGE, not a blur, and the difference is visible in the only
   place it matters: what the picture says. Accuracy must not move. */
ok(moved > 0, `the redundant-entry case moved ${moved} cells — the fixture is not posing it`);
ok(cleanAcc(cleanSmooth) >= cleanAcc(cleanRaw),
  `merging a redundant palette entry cost accuracy (${(100*cleanAcc(cleanRaw)).toFixed(2)}% -> `
  + `${(100*cleanAcc(cleanSmooth)).toFixed(2)}%). Folding two near-identical entries together must not `
  + `change what the picture says; if it does, the bond is reaching across a boundary that carries meaning.`);
const aClean = accents(cleanSmooth.grids, cleanSmooth.pal), aCleanRaw = accents(cleanRaw.grids, cleanRaw.pal);
ok(aClean.got >= aCleanRaw.got,
  `the merge pass also removed ${aCleanRaw.got - aClean.got} single-cell accents`);

/* ── 4. strength must not be able to eat the picture ────────────────────── */

const hard = pipeline(30, 2.0);
const aHard = accents(hard.grids, hard.pal);
ok(aHard.got >= aRaw.got,
  `at --smooth 2.0 the accents dropped to ${aHard.got} from ${aRaw.got}. The bilateral weight means even a `
  + `large lambda cannot cross a real colour edge — if turning the strength up destroys detail, the weight `
  + `is not measuring what it should.`);

/* ── 5. the design, pinned in the source ────────────────────────────────── */

const src = readFileSync(`${ROOT}/tools/pxa/ingest.mjs`, 'utf8');
ok(/const bond = \(a, b\) => \{[\s\S]{0,220}lab\[a \* 3\]/.test(src),
  'the bond weight no longer reads the sampled colours (lab[]). Measured, weighting by label distance '
  + 'instead costs 100.00% -> 99.96% on a noisy render: it asks whether two entries are adjacent in the '
  + 'palette rather than whether these two cells look the same, so it merges adjacent labels wherever they '
  + 'meet, including across a gradient where they are correct.');
ok(/Math\.exp\(-d \/ sigma2\)/.test(src),
  'the bond is no longer a falling function of colour distance; it must collapse to ~0 across an edge');
ok(/sigma2 = nn \* /.test(src) && /lambda = smooth \* nn/.test(src),
  'sigma and lambda are no longer derived from `nn`, the palette\'s own median nearest-neighbour spacing. '
  + 'Both are distances in OKLab and both must scale with how finely THIS clip was quantised; absolute '
  + 'constants would over-smooth a fine palette and do nothing to a coarse one.');

const cli = readFileSync(`${ROOT}/tools/pxa/cli.mjs`, 'utf8');
ok(/num\('smooth', 0\.6\)/.test(cli),
  'the CLI no longer applies regularisation by default. Unlike --snap this one is safe by construction: the '
  + 'bilateral weight cannot cross a real colour edge, so there is no material on which it can do harm. '
  + 'Measured: exactly inert on an undamaged render at the scene\'s own palette size, accuracy 99.83% -> '
  + '100% on a noisy one, and a quarter off the file. It ships on, with --smooth 0 to disable.');

assert.ok(checks >= 9, `only ${checks} assertions ran — this contract is not exercising the assignment`);
console.log(`pxa colour OK — ${checks} assertions; speckle ${sRaw} -> ${sSmooth}, accents ${aRaw.got}/${aRaw.want} kept `
  + `(${aHard.got} at 2.0x strength); clean render: ${exactMoved} cells moved at an exact palette, `
  + `${moved} merged when given a redundant entry, accuracy unchanged`);
