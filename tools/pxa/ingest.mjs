/**
 * Frames of upscaled/compressed video → a stable grid of palette indices.
 *
 * Three things fight you here, and none of them are "read the pixels":
 *
 *  ① Video compression destroys exactly what pixel art is made of. H.264 rings
 *    on hard edges and bands flat fills, so an 8×8 source cell can contain
 *    dozens of distinct colours. Sampling the centre pixel picks up ringing;
 *    averaging the cell invents a colour that sits between two real ones and
 *    belongs to neither. We take the MODE over a coarse bucket, then average
 *    only the pixels inside the winning bucket — that recovers the flat colour
 *    the cell was before the encoder got to it.
 *
 *  ② The pitch is usually fractional. MiniMax H3 emits 2K; a 64-cell-wide
 *    scene lands on 22.5 px per cell. A detector that searches integer pitches
 *    finds 22 or 23 and drifts half a cell by the right-hand edge — and the
 *    drift looks like "the art is a bit wobbly", not like a bug. So the search
 *    is over the CELL COUNT, with fractional boundaries at k*(span/n).
 *
 *  ③ Per-frame quantisation flickers. Quantising each frame independently puts
 *    the same patch of ground on index 5 in one frame and 6 in the next; the
 *    whole picture breathes. One palette for the whole clip, plus hysteresis
 *    (only switch when the new colour is clearly closer) and a three-frame
 *    majority vote to kill single-frame outliers.
 */

/* ── OKLab ────────────────────────────────────────────────────────────────
   Distances are taken in OKLab, not RGB. In RGB a dark blue and a dark green
   can be "closer" than two greens a person would never confuse, and the
   palette then spends entries where nobody is looking. */
export function rgbToOklab(r, g, b) {
  const f = (u) => { u /= 255; return u <= 0.04045 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4); };
  const R = f(r), G = f(g), B = f(b);
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return [
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s
  ];
}
const d2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;

/* ── grid detection ─────────────────────────────────────────────────────── */

/** Per-column (axis 0) or per-row (axis 1) edge energy. */
function edgeEnergy(img, axis) {
  const { width: w, height: h, data } = img;
  const n = axis === 0 ? w : h, m = axis === 0 ? h : w;
  const E = new Float64Array(n);
  for (let i = 1; i < n; i++) {
    let sum = 0;
    for (let j = 0; j < m; j++) {
      const a = axis === 0 ? (j * w + i) * 4 : (i * w + j) * 4;
      const b = axis === 0 ? (j * w + i - 1) * 4 : ((i - 1) * w + j) * 4;
      sum += Math.abs(data[a] - data[b]) + Math.abs(data[a + 1] - data[b + 1]) + Math.abs(data[a + 2] - data[b + 2]);
    }
    E[i] = sum / m;
  }
  return E;
}

/**
 * Score a candidate lattice: boundaries at off + k*p across `len`.
 *
 * The comparison is boundaries against MID-CELL positions — not against the
 * axis as a whole. That one choice is what makes the metric immune to the two
 * degenerate answers, and both of them were actually returned before it:
 *
 *   half the true pitch   the boundaries it keeps are all real, so any metric
 *                         that compares them to a five-hundred-column average
 *                         scores it at least as well as the truth. But the
 *                         real boundaries it SKIPS land exactly on its own
 *                         mid-cell positions — so against mid-cells it scores
 *                         ~1. Measured: a 24x16 truth read 12x8 at 3x noise.
 *   every column at once  boundaries and mid-cells become the same columns, so
 *                         it also scores ~1 instead of a perfect coverage of 1.
 *
 * Twice the true pitch is penalised too: half its boundaries are inventions and
 * drag the boundary mean down toward the mid-cell mean.
 */
function scoreLattice(E, len, p, off, tol, strong) {
  const n = E.length;
  if (p < 2) return -1;
  const mark = new Uint8Array(n);
  const peak = (x) => {
    let m = -1;
    for (let t = -tol; t <= tol; t++) { const i = Math.round(x) + t; if (i >= 1 && i < n && E[i] > m) m = E[i]; }
    return m;
  };
  let on = 0, onN = 0, mid = 0, midN = 0;
  for (let k = 0; ; k++) {
    const b = off + k * p;
    if (b >= len) break;
    if (b >= 1) {
      const v = peak(b);
      if (v >= 0) { on += v; onN++; }
      for (let t = -tol; t <= tol; t++) { const i = Math.round(b) + t; if (i >= 1 && i < n) mark[i] = 1; }
    }
    const m = off + (k + 0.5) * p;
    if (m >= 1 && m < len) { const v = peak(m); if (v >= 0) { mid += v; midN++; } }
  }
  if (onN < 4 || midN < 3) return -1;

  /* Two terms, and BOTH are needed — each one alone returns a degenerate
     answer, and both were actually returned during development:
     · contrast  boundary energy over MID-CELL energy (not over the axis mean).
                 Half the true pitch scores ~1 here, because the real
                 boundaries it skips land on its own mid-cells. Every column at
                 once also scores ~1. Alone, though, contrast picks a 1/3
                 sub-harmonic: an odd ratio puts its mid-cells on true
                 mid-cells, so it keeps only the boundaries that carry an edge
                 and skips all the flat ones — measured 11.1 against the
                 truth's 3.7, because most cell boundaries in pixel art sit
                 between two identical cells and dilute the truth's mean.
     · coverage  share of the strongest edge columns the lattice explains. A
                 sub-harmonic explains 1/n of them. Alone this prefers ever
                 finer lattices, which explain everything by marking
                 everything — measured, it ran to 162 cells on a 24-cell axis.
     The product has no degenerate maximum: contrast kills the dense end,
     coverage kills the coarse end. */
  let hit = 0;
  for (const i of strong) if (mark[i]) hit++;
  const coverage = hit / strong.length;
  const contrast = (on / onN) / (mid / midN + 1e-6);
  /* ⚠️ Coverage is SQUARED, and `strong` is the top 3% rather than the top 8%.
     Both are the same fix for the same failure: a video's 8x8 CODEC BLOCK
     BOUNDARIES are a lattice too, and a fine one. On the cleanest possible
     input — zero noise, where the block banding is the only fine structure
     left — the detector locked onto it and read a 40-cell axis as 113 cells
     (8.0 px per cell, exactly the block size). Noise actually HID the bug by
     burying the banding, so it only appeared on the best material.
     Block edges are numerous but WEAK. Narrowing `strong` to the top 3% keeps
     only the real colour steps, and squaring coverage makes "explains nearly
     all of them" beat "explains a third of them at three times the density".
     Measured across 14 configurations (two grid sizes x seven damage levels):
     14/14 with this, 13/14 before. */
  return contrast * coverage * coverage;
}

/** The columns where this picture actually changes: the top slice by energy.
 *  Everything else is noise and codec block edges, and a lattice is not
 *  obliged to explain those. */
function strongColumns(E, share = 0.03) {
  const idx = [];
  for (let i = 1; i < E.length; i++) idx.push(i);
  idx.sort((a, b) => E[b] - E[a]);
  return idx.slice(0, Math.max(8, Math.round(idx.length * share)));
}

/**
 * → { count, pitch, off, score }. `count` is the number of cells along the axis.
 * maxCells caps the search; a 2K frame of 512-cell art is not a thing anyone
 * is shipping, and the cap keeps the search linear in practice.
 */
export function detectAxis(img, axis, { maxCells = 256, minCells = 2, pitchHint = 0, pitchTol = 0.12, energy = null } = {}) {
  const len = axis === 0 ? img.width : img.height;
  const E = energy || edgeEnergy(img, axis);
  const tol = 1;

  /* Collect every candidate, then pick the FINEST lattice that still scores
     near the best — not simply the best.
     ⚠️ Sub-harmonics are why. A lattice at 1/3 the true count keeps only real
     boundaries AND, because the ratio is odd, puts its mid-cells on true
     mid-cells — so it scores as well as the truth, sometimes better. Measured:
     a 24-cell axis read as 8 cells with a score of 11.1 against the truth's
     3.7. Nothing in a boundary-vs-mid-cell ratio can separate those two; the
     thing that separates them is that a sub-harmonic is always the COARSER
     reading. Over-dense lattices cannot sneak in the same way: half or more of
     their boundaries are inventions, which drags the ratio well below the
     band (2x the true count measures ~55% of it, 3x ~40%).
     This is the same rule pitch detection has used for decades — take the
     smallest period whose correlation clears a threshold, not the largest
     correlation. */
  const strong = strongColumns(E);
  const cand = [];
  const hi0 = Math.min(maxCells, Math.floor(len / 2));
  for (let n = minCells; n <= hi0; n++) {
    const p = len / n;
    if (pitchHint && Math.abs(p / pitchHint - 1) > pitchTol) continue;
    // Try a few phases even in the coarse pass: a lattice scored only at
    // phase 0 can be the right pitch and still look wrong.
    let s = -1, bo = 0;
    for (let k = 0; k < 6; k++) {
      const off = (k * p) / 6;
      const v = scoreLattice(E, len, p, off, tol, strong);
      if (v > s) { s = v; bo = off; }
    }
    if (s > 0) cand.push({ count: n, pitch: p, off: bo, score: s });
  }
  if (!cand.length) return { count: 0, pitch: 0, off: 0, score: -1 };
  let best = cand[0];
  for (const c of cand) if (c.score > best.score) best = c;

  if (best.score < 0) return best;

  /* Refine pitch and offset locally — the coarse pass assumed the grid fills
     the frame exactly, which a slightly cropped clip does not.
     ⚠️ The count is CARRIED, not recomputed. Deriving it from the refined
     offset (floor((len - off) / p)) loses the last cell the moment `off` goes
     a fraction above zero: measured, a 24x16 truth came back 23x15, and a grid
     off by one cell round-trips its own mistake perfectly so nothing
     downstream can catch it. Refinement answers "where is this lattice
     aligned", not "how many cells are there" — the coarse search already
     answered that, and a step that quietly re-answers a question it was not
     asked is how this goes wrong. */
  let cur = best;
  for (const dp of [0, ...Array.from({ length: 8 }, (_, i) => (i + 1) * 0.0025).flatMap((d) => [d, -d])]) {
    const p = best.pitch * (1 + dp);
    for (let k = -8; k <= 8; k++) {
      const off = best.off + (k * p) / 16;
      const s = scoreLattice(E, len, p, off, tol, strong);
      if (s > cur.score) cur = { count: best.count, pitch: p, off, score: s };
    }
  }
  return cur;
}

/* ── cell sampling ──────────────────────────────────────────────────────── */

/**
 * → { cols, rows, cells: Float64Array(cols*rows*4) as r,g,b,a }
 * Core inset dodges the ringing that compression leaves on every cell edge.
 */
export function sampleCells(img, grid, { inset = 0.28, shift = null } = {}) {
  /* `shift` is a per-cell-row [dx, dy] in pixels, from tools/pxa/motion.mjs.
     It moves the SAMPLING WINDOW, not the image — the content then lands on the
     lattice instead of straddling it, and successive frames differ by a whole
     number of cells by construction. See motion.mjs for why that is the whole
     algorithm. */
  const { width: w, height: h, data } = img;
  const { cols, rows, px, py, ox, oy } = grid;
  const cells = new Float64Array(cols * rows * 4);

  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) {
      const x0 = oy === undefined ? 0 : 0; // (kept explicit below)
      const sx = ox + cx * px + (shift ? shift[cy * 2] : 0);
      const sy = oy + cy * py + (shift ? shift[cy * 2 + 1] : 0);
      let ax0 = Math.floor(sx + px * inset), ax1 = Math.ceil(sx + px * (1 - inset));
      let ay0 = Math.floor(sy + py * inset), ay1 = Math.ceil(sy + py * (1 - inset));
      if (ax1 <= ax0) { ax0 = Math.floor(sx + px / 2); ax1 = ax0 + 1; }
      if (ay1 <= ay0) { ay0 = Math.floor(sy + py / 2); ay1 = ay0 + 1; }
      ax0 = Math.max(0, Math.min(w - 1, ax0)); ay0 = Math.max(0, Math.min(h - 1, ay0));
      ax1 = Math.max(ax0 + 1, Math.min(w, ax1)); ay1 = Math.max(ay0 + 1, Math.min(h, ay1));
      /* A refined pitch can push the last cell past the edge of the frame. The
         window must still yield at least one pixel — the alternative measured
         here was a crash deep in the mode finder, which is a worse way to say
         "the grid does not fit" than simply sampling the edge. */

      // Mode over a 5-bit-per-channel bucket. Raw mode fails on compressed
      // input because no two pixels are byte-identical; a coarse bucket puts
      // the ringing back with the colour it is ringing around.
      const bins = new Map();
      let alpha = 0, an = 0;
      for (let y = ay0; y < ay1; y++) {
        for (let x = ax0; x < ax1; x++) {
          const p = (y * w + x) * 4;
          const key = ((data[p] >> 3) << 10) | ((data[p + 1] >> 3) << 5) | (data[p + 2] >> 3);
          const e = bins.get(key);
          if (e) { e[0] += data[p]; e[1] += data[p + 1]; e[2] += data[p + 2]; e[3]++; }
          else bins.set(key, [data[p], data[p + 1], data[p + 2], 1]);
          alpha += data[p + 3]; an++;
        }
      }
      let top = null;
      // Deterministic tie-break by bucket key: Map iteration order depends on
      // insertion, which depends on scan order, which is stable — but a tie
      // broken by "whichever came first" would still move if the inset changed.
      for (const [key, e] of bins) if (!top || e[3] > top[1][3] || (e[3] === top[1][3] && key < top[0])) top = [key, e];
      const o = (cy * cols + cx) * 4;
      cells[o] = top[1][0] / top[1][3];
      cells[o + 1] = top[1][1] / top[1][3];
      cells[o + 2] = top[1][2] / top[1][3];
      cells[o + 3] = an ? alpha / an : 255;
      void x0;
    }
  }
  return { cols, rows, cells };
}

/* ── palette ────────────────────────────────────────────────────────────── */

/** Median cut in OKLab, then Lloyd refinement. Deterministic: no seeds, no
 *  random restarts — the same clip must give the same palette every run, or
 *  re-encoding an asset produces a spurious diff. */
export function buildPalette(samples, n) {
  /* Weighted by plain cell count. An earlier version used count^0.5, on the
     theory that a picture is not about area — a flat sky occupying a third of
     the frame does not deserve a third of the palette. The theory is right and
     the knob was the wrong way to act on it: it guesses at a prior instead of
     fixing the symptom. The duplicate-entry reclaim below fixes the symptom
     directly, and once it existed the exponent measured WORSE (99.97% against
     100% on a noisy fixture) as well as being unguarded by any test. Removed
     rather than left in as a second, silent defence. */
  const pts = samples.map((c) => ({ lab: rgbToOklab(c[0], c[1], c[2]), rgb: c, w: c[3] || 1 }));
  let boxes = [pts];
  while (boxes.length < n) {
    let bi = -1, bspread = -1, baxis = 0;
    for (let i = 0; i < boxes.length; i++) {
      if (boxes[i].length < 2) continue;
      for (let a = 0; a < 3; a++) {
        let lo = Infinity, hi = -Infinity;
        for (const p of boxes[i]) { if (p.lab[a] < lo) lo = p.lab[a]; if (p.lab[a] > hi) hi = p.lab[a]; }
        // a and b carry less perceptual weight than L at equal numeric spread;
        // without this the palette splits hue endlessly and leaves lightness
        // — the thing that actually carries the picture — on two entries.
        const spread = (hi - lo) * (a === 0 ? 1 : 0.6);
        if (spread > bspread) { bspread = spread; bi = i; baxis = a; }
      }
    }
    if (bi < 0 || bspread <= 0) break;
    const box = boxes[bi].slice().sort((p, q) => p.lab[baxis] - q.lab[baxis]);
    const half = Math.floor(box.length / 2);
    boxes.splice(bi, 1, box.slice(0, half), box.slice(half));
  }

  let centres = boxes.map((box) => {
    let L = 0, A = 0, B = 0, W = 0;
    for (const p of box) { L += p.lab[0] * p.w; A += p.lab[1] * p.w; B += p.lab[2] * p.w; W += p.w; }
    return [L / W, A / W, B / W];
  });

  const lloyd = (rounds) => {
    for (let pass = 0; pass < rounds; pass++) {
      const acc = centres.map(() => [0, 0, 0, 0]);
      for (const p of pts) {
        let best = 0, bd = Infinity;
        for (let i = 0; i < centres.length; i++) { const d = d2(p.lab, centres[i]); if (d < bd) { bd = d; best = i; } }
        acc[best][0] += p.lab[0] * p.w; acc[best][1] += p.lab[1] * p.w; acc[best][2] += p.lab[2] * p.w; acc[best][3] += p.w;
      }
      let moved = 0;
      centres = centres.map((c, i) => {
        if (!acc[i][3]) return c;
        const nc = [acc[i][0] / acc[i][3], acc[i][1] / acc[i][3], acc[i][2] / acc[i][3]];
        moved += d2(c, nc);
        return nc;
      });
      if (moved < 1e-9) break;
    }
  };
  lloyd(8);

  /* ⚠️ Reclaim entries that duplicate another entry.
     Median cut splits by SPREAD, and compression gives a numerous feature an
     artificial spread: every instance of it sits next to different neighbours,
     so ringing scatters its sampled colour. Measured on a 40x24 fixture, the
     water glints took THREE entries within ΔOKLab .01 of each other while the
     sun's core — compact in colour, thirteen cells in size — got none, and all
     156 of its cells came back as the rim. Lowering the weight exponent does
     not fix this; the glints genuinely are numerous.
     The repair needs no threshold. Compare the cost of merging the closest
     pair of entries against the cost of the worst-served sample: if the sample
     that nothing describes is further from its entry than those two entries
     are from each other, the pair is worth one entry and the freed one belongs
     where nothing is. Repeat while that holds. */
  for (let repair = 0; repair < centres.length; repair++) {
    let pi = -1, pj = -1, pd = Infinity;
    for (let i = 0; i < centres.length; i++) {
      for (let j = i + 1; j < centres.length; j++) {
        const d = d2(centres[i], centres[j]);
        if (d < pd) { pd = d; pi = i; pj = j; }
      }
    }
    if (pi < 0) break;
    let worst = null, wd = -1;
    for (const p of pts) {
      let bd = Infinity;
      for (const c of centres) { const d = d2(p.lab, c); if (d < bd) bd = d; }
      if (bd > wd) { wd = bd; worst = p; }
    }
    if (!worst || wd <= pd) break;
    centres[pi] = [(centres[pi][0] + centres[pj][0]) / 2, (centres[pi][1] + centres[pj][1]) / 2, (centres[pi][2] + centres[pj][2]) / 2];
    centres[pj] = worst.lab.slice();
    lloyd(4);
  }

  // Report each centre as the real sampled colour nearest to it, not the
  // centroid: a centroid is an average of flat colours and is usually a colour
  // that never appeared in the clip. Pixel art has no in-between shades.
  return centres.map((c) => {
    let best = pts[0], bd = Infinity;
    for (const p of pts) { const d = d2(p.lab, c); if (d < bd) { bd = d; best = p; } }
    return [Math.round(best.rgb[0]), Math.round(best.rgb[1]), Math.round(best.rgb[2])];
  }).sort((a, b) => rgbToOklab(...a)[0] - rgbToOklab(...b)[0]);
}

/* ── assignment with temporal stability ─────────────────────────────────── */

/**
 * frames: array of { cells } from sampleCells. → array of Uint8Array indices.
 * `base` is the index offset (1 when a transparent entry occupies slot 0).
 */
export function assignFrames(frames, palette, {
  hysteresis = 0.3, vote = true, base = 0, alphaCut = 128, transparentIndex = -1,
  smooth = 0, smoothPasses = 3, cols = 0
} = {}) {
  const labs = palette.map((c) => rgbToOklab(c[0], c[1], c[2]));
  const cells = frames[0].cells.length / 4;
  const out = [];
  let prev = null;

  /* Palette spacing sets every scale in here, so nothing below is a tuned
     constant. `nn` is the median distance from a palette entry to its nearest
     neighbour — the size of one quantisation step for THIS clip. */
  let nn = 0;
  if (labs.length > 1) {
    const ds = labs.map((a, i) => {
      let d = Infinity;
      for (let k = 0; k < labs.length; k++) if (k !== i) d = Math.min(d, d2(a, labs[k]));
      return d;
    }).sort((a, b) => a - b);
    nn = ds[Math.floor(ds.length / 2)];
  }

  for (const f of frames) {
    const g = new Uint8Array(cells);
    const lab = new Float64Array(cells * 3);
    const solid = new Uint8Array(cells);

    for (let i = 0; i < cells; i++) {
      if (transparentIndex >= 0 && f.cells[i * 4 + 3] < alphaCut) { g[i] = transparentIndex; continue; }
      solid[i] = 1;
      const L = rgbToOklab(f.cells[i * 4], f.cells[i * 4 + 1], f.cells[i * 4 + 2]);
      lab[i * 3] = L[0]; lab[i * 3 + 1] = L[1]; lab[i * 3 + 2] = L[2];
      let best = 0, bd = Infinity;
      for (let k = 0; k < labs.length; k++) { const d = d2(L, labs[k]); if (d < bd) { bd = d; best = k; } }
      let idx = best + base;
      if (prev && prev[i] !== idx && prev[i] >= base && prev[i] - base < labs.length) {
        // Hysteresis: a cell sitting on the boundary between two palette
        // entries alternates every frame otherwise, and a whole surface
        // shimmers. Only switch when the new entry is clearly closer.
        const dPrev = d2(L, labs[prev[i] - base]);
        if (bd >= dPrev * (1 - hysteresis)) idx = prev[i];
      }
      g[i] = idx;
    }

    /* ── spatial regularisation ────────────────────────────────────────
       ⭐⭐ Assigning each cell to its nearest palette entry ON ITS OWN leaves
       speckle: in a flat field, a cell that lands 51% of the way toward the
       next entry takes it while all four of its neighbours took the other one.
       Nothing about that cell is different — it is quantisation noise wearing
       the shape of a detail.

       The fix is an energy, minimised by ICM: a cell pays for being far from
       its own colour, and pays again for disagreeing with a neighbour.

       ⚠️ The bond weight is the design, and it is measured rather than argued.
       Three forms, same fixture, same strength:

                          noisy render    undamaged render   cells moved
                                                              when clean
         colour distance    100.00%          100.00%              0
         label distance      99.96%          100.00%              0
         no gate at all      99.46%           99.17%             96

       ⚠️⚠️ The failure that matters is the third one. A constant weight has no
       way to tell a real boundary from a quantisation wobble, so it stirs
       material that had nothing wrong with it — 96 cells changed on a render
       with no noise in it, and the picture measurably worse. That is a blur
       with extra steps, and it is what this gate exists to not be.

       Weighting by LABEL distance is not that disaster — it also leaves
       high-contrast detail alone (every one of 235 single-cell accents
       survived all three forms). It is simply a worse question: it asks
       whether two entries are adjacent in the palette, so it merges adjacent
       labels wherever they meet, including across a genuine gradient where
       they are correct. Weighting by SAMPLED COLOUR asks whether these two
       cells LOOK the same, which is the thing actually being decided, and it
       measures best.

       The general rule is the one the temporal vote taught one module over: a
       filter must ask whether a disagreement is NOISE, not merely whether it
       exists. */
    if (smooth > 0 && cols > 1 && labs.length > 1 && nn > 0) {
      const rows = cells / cols;
      const sigma2 = nn * 0.5;
      const lambda = smooth * nn;
      const bond = (a, b) => {
        const d = (lab[a * 3] - lab[b * 3]) ** 2 + (lab[a * 3 + 1] - lab[b * 3 + 1]) ** 2
          + (lab[a * 3 + 2] - lab[b * 3 + 2]) ** 2;
        return Math.exp(-d / sigma2);
      };
      for (let pass = 0; pass < smoothPasses; pass++) {
        let moved = 0;
        for (let i = 0; i < cells; i++) {
          if (!solid[i]) continue;
          const x = i % cols, y = (i / cols) | 0;
          const nb = [];
          if (x > 0) nb.push(i - 1);
          if (x < cols - 1) nb.push(i + 1);
          if (y > 0) nb.push(i - cols);
          if (y < rows - 1) nb.push(i + cols);
          const me = [lab[i * 3], lab[i * 3 + 1], lab[i * 3 + 2]];
          let best = g[i], bestE = Infinity;
          for (let k = 0; k < labs.length; k++) {
            let e = d2(me, labs[k]);
            for (const j of nb) {
              if (!solid[j]) continue;
              if (g[j] - base !== k) e += lambda * bond(i, j);
            }
            if (e < bestE) { bestE = e; best = k + base; }
          }
          if (best !== g[i]) { g[i] = best; moved++; }
        }
        if (!moved) break;
      }
    }

    out.push(g);
    prev = g;
  }

  /* Three-frame majority, but only across a QUANTISATION boundary.
     ⚠️ The naive version — "disagrees with both neighbours while they agree"
     — erases real single-frame motion, and it does it silently. Measured on a
     40x24 fixture whose water glints move every frame: the vote removed 271 of
     them (6→3), and the encode got SMALLER, so every number said it had gone
     well. A filter that improves your compression ratio by deleting the
     animation is the worst kind of green.
     The fix is not a tuned threshold. Ask what the disagreement IS: a cell
     sitting between two adjacent palette entries flickers between them, and
     those two entries are each other's nearest neighbour. A glint jumps
     several entries. So vote only when the pair is mutually adjacent — which
     scales itself to whatever palette this clip got, with no constant. */
  if (vote && out.length >= 3) {
    const nn = labs.map((a, i) => {
      let d = Infinity;
      for (let k = 0; k < labs.length; k++) if (k !== i) d = Math.min(d, d2(a, labs[k]));
      return d;
    });
    const adjacent = (a, b) => {
      if (a < base || b < base) return false;
      const ia = a - base, ib = b - base;
      if (ia >= labs.length || ib >= labs.length) return false;
      const d = d2(labs[ia], labs[ib]);
      return d <= Math.min(nn[ia], nn[ib]) * 1.25;
    };
    const copy = out.map((g) => new Uint8Array(g));
    let voted = 0;
    for (let t = 1; t < out.length - 1; t++) {
      for (let i = 0; i < cells; i++) {
        if (copy[t - 1][i] === copy[t + 1][i] && copy[t][i] !== copy[t - 1][i]
            && adjacent(copy[t][i], copy[t - 1][i])) { out[t][i] = copy[t - 1][i]; voted++; }
      }
    }
    assignFrames.lastVoted = voted;
  }

  return out;
}

export const hex = (c) => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');

/* ── whole-grid detection ─────────────────────────────────────────────── */

/**
 * imgs: one or more decoded frames. → { cols, rows, px, py, ox, oy, scoreX, scoreY, repaired }
 *
 * Two priors do the heavy lifting, and neither is a tuned constant:
 *
 *  ① Noise is independent per frame; a cell boundary is not. Averaging the
 *    edge energy over several frames raises the lattice out of the noise for
 *    free. Measured on a fixture with 3x the chroma drift, the x axis went
 *    from reading 7 cells (a 5x harmonic of the truth) to reading 40.
 *  ② Cells are square. When one axis is confident and the other disagrees by
 *    more than a little, the disagreement is not news about the art — it is
 *    the weak axis failing. Re-run it constrained to the strong axis's pitch.
 */
export function detectGrid(imgs, { maxCells = 256, sampleFrames = 8 } = {}) {
  const use = imgs.slice(0, Math.max(1, sampleFrames));

  /* ⚠️ Average the IMAGES, then take the edge energy — not the other way round.
     Averaging per-frame edge energy looks like denoising and is not: edge
     energy is an ABSOLUTE difference, and E|noise| does not go to zero with
     more samples. Averaging it just turns spiky noise into a steady raised
     floor, which lifts the mid-cell baseline and LOWERS the contrast the
     detector runs on. Measured: at 10x drift on a 903x542 render, averaging
     energy over 8 frames failed where a single frame succeeded.
     Averaging the signed pixels first cancels noise properly (√n), and the
     lattice is the one thing in the clip that does not move, so it survives
     the average while moving content quietly fades — which is the right bias
     for finding a lattice. */
  const w = use[0].width, h = use[0].height;
  const mean = { width: w, height: h, data: new Float64Array(w * h * 4) };
  for (const img of use) for (let i = 0; i < mean.data.length; i++) mean.data[i] += img.data[i];
  for (let i = 0; i < mean.data.length; i++) mean.data[i] /= use.length;

  const acc = [edgeEnergy(mean, 0), edgeEnergy(mean, 1)];

  let ax = detectAxis(mean, 0, { maxCells, energy: acc[0] });
  let ay = detectAxis(mean, 1, { maxCells, energy: acc[1] });
  let repaired = null;

  const aspect = ax.pitch / ay.pitch;
  if (ax.score > 0 && ay.score > 0 && (aspect < 0.89 || aspect > 1.12)) {
    // Trust the stronger axis, re-detect the weaker one against its pitch.
    if (ax.score >= ay.score) {
      const fixed = detectAxis(mean, 1, { maxCells, energy: acc[1], pitchHint: ax.pitch });
      if (fixed.score > 0) { repaired = `y re-detected against x pitch ${ax.pitch.toFixed(2)}`; ay = fixed; }
    } else {
      const fixed = detectAxis(mean, 0, { maxCells, energy: acc[0], pitchHint: ay.pitch });
      if (fixed.score > 0) { repaired = `x re-detected against y pitch ${ay.pitch.toFixed(2)}`; ax = fixed; }
    }
  }

  return {
    cols: ax.count, rows: ay.count, px: ax.pitch, py: ay.pitch, ox: ax.off, oy: ay.off,
    scoreX: ax.score, scoreY: ay.score, repaired
  };
}
