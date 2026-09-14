/**
 * Pixel-grid motion: make things move in WHOLE CELLS.
 *
 * ⭐⭐ This is the lever that a hard grid and a locked palette cannot pull.
 * Fix the grid, fix the colours, and a drifting surface still reads as "a video
 * behind a mesh" — because the content moves by a THIRD of a cell per frame, so
 * every edge cell alternates between two palette entries as the edge sweeps
 * across it. That flicker is not quantisation noise. It is sub-cell motion, and
 * hand-drawn pixel animation does not have it: things jump one whole cell and
 * then hold.
 *
 * It is the same rule as the player's frame accumulator, moved from time into
 * space. Estimate the real, continuous displacement; render at the ROUNDED one;
 * keep the remainder so the rounding steps at the right moments instead of
 * drifting.
 *
 * ── Why 1-D projections ──────────────────────────────────────────────────
 * Full 2-D block matching over a 903x542 frame is millions of operations per
 * band per frame. Drift — water, cloud, a panning layer — is translation, and
 * translation is separable: project a band of rows down to one row of column
 * means and the horizontal shift is a 1-D correlation, 903 x search instead of
 * 903 x 60 x search. Averaging over the rows also kills the noise the estimate
 * would otherwise chase.
 * The cost is honest: this finds TRANSLATION. Swaying foliage and a flickering
 * flame are not translation, and for those the residual stays high and the
 * caller falls back to plain quantisation — which is the correct answer, not a
 * failure, because there is no whole-cell motion to snap to.
 */

/** Luma projection of a horizontal band onto its x axis (and onto y). */
function project(img, y0, y1) {
  const { width: w, data } = img;
  const px = new Float64Array(w);
  const py = new Float64Array(Math.max(1, y1 - y0));
  for (let y = y0; y < y1; y++) {
    let rowSum = 0;
    for (let x = 0; x < w; x++) {
      const p = (y * w + x) * 4;
      const l = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
      px[x] += l; rowSum += l;
    }
    py[y - y0] = rowSum / w;
  }
  const n = Math.max(1, y1 - y0);
  for (let x = 0; x < w; x++) px[x] /= n;
  return { px, py };
}

/** Mean absolute difference of `a` against `b` shifted by s, over the overlap. */
function sad(a, b, s) {
  const n = a.length;
  let sum = 0, count = 0;
  const from = Math.max(0, s), to = Math.min(n, n + s);
  for (let i = from; i < to; i++) { sum += Math.abs(a[i] - b[i - s]); count++; }
  return count < n * 0.5 ? Infinity : sum / count;
}

/**
 * Best shift of `a` relative to `b`, to sub-sample precision.
 * ⚠️ The parabolic step is not decoration. An integer-only estimate rounds the
 * true displacement twice — once here and once when snapping to cells — and the
 * two roundings compound into a visible stutter at slow speeds, which is the
 * exact defect this module exists to remove.
 */
function bestShift(a, b, radius) {
  let bi = 0, bv = Infinity;
  for (let s = -radius; s <= radius; s++) {
    const v = sad(a, b, s);
    if (v < bv) { bv = v; bi = s; }
  }
  const l = sad(a, b, bi - 1), c = bv, r = sad(a, b, bi + 1);
  let sub = 0;
  if (isFinite(l) && isFinite(r)) {
    const denom = l - 2 * c + r;
    if (denom > 1e-9) sub = Math.max(-0.5, Math.min(0.5, (l - r) / (2 * denom)));
  }
  // How well the minimum stands out. A flat surface (nothing to track) or
  // non-translational motion gives a shallow basin, and the caller must not
  // snap on an estimate that means nothing.
  const flat = (sad(a, b, -radius) + sad(a, b, radius)) / 2;
  /* ⭐ `gain` is the test that matters, and it is not the same question as
     `contrast`. Contrast asks "is this minimum sharp?" — a small bright object
     moving through an otherwise flat band gives a very sharp minimum, because
     the flat part contributes nothing to the projection and the object is the
     only thing in it. Measured: a three-cell sun stepping across a still sky
     was read as the whole SKY translating 14.5px per frame, confidently.
     Gain asks the right question instead: does shifting actually explain this
     band better than not shifting? For real drift, sad(0) is far worse than
     sad(s*). For a still band with something moving inside it, the two are
     nearly equal — most of the band matches either way — and the honest answer
     is that the band is not translating. */
  const still = sad(a, b, 0);
  return {
    shift: bi + sub, cost: c,
    contrast: isFinite(flat) && c > 1e-9 ? flat / c : 1,
    gain: isFinite(still) && c > 1e-9 ? still / c : 1
  };
}

/**
 * frames: decoded images. grid: { rows, py, oy } from detection or --cells.
 * → per frame, per BAND: { dx, dy } displacement in PIXELS against frame 0,
 *   plus `confident` for whether it is worth snapping to.
 *
 * Bands are groups of cell rows, because a landscape does not move as one
 * thing: the sky holds, the far ridge creeps, the water runs. One global
 * estimate would average those into a motion that belongs to none of them.
 */
export function estimateBands(frames, grid, { bands = 6, radius = 14, minContrast = 1.12, minGain = 1.25 } = {}) {
  const rowsPerBand = Math.max(1, Math.ceil(grid.rows / bands));
  const spans = [];
  for (let b = 0; b * rowsPerBand < grid.rows; b++) {
    const r0 = b * rowsPerBand, r1 = Math.min(grid.rows, r0 + rowsPerBand);
    spans.push({
      r0, r1,
      y0: Math.max(0, Math.round(grid.oy + r0 * grid.py)),
      y1: Math.min(frames[0].height, Math.round(grid.oy + r1 * grid.py))
    });
  }

  /* ⚠️ Match each frame against the PREVIOUS one and accumulate, never against
     frame 0 with a big search window. Two reasons, and the first one was
     measured the hard way: a clip drifting a third of a cell per frame has
     moved five cells by the end, which is 118px — past any search radius small
     enough to be affordable, so the estimate silently clamps and reports a
     third of the real motion. And periodic content (waves, a tiled sky) aliases
     against a distant reference, so even a wide window locks onto the wrong
     period. Frame to frame the motion is a few pixels, a radius of 14 covers
     it, and the running total IS the accumulator this is named after. */
  let acc = spans.map(() => ({ x: 0, y: 0 }));
  let prevProj = spans.map((s) => project(frames[0], s.y0, s.y1));

  return requireRhythm(frames.map((img, t) => {
    if (t === 0) return spans.map((s) => ({ ...s, dx: 0, dy: 0, confident: true, contrast: Infinity }));
    const proj = spans.map((s) => project(img, s.y0, s.y1));
    const out = spans.map((s, i) => {
      const hx = bestShift(proj[i].px, prevProj[i].px, radius);
      const hy = bestShift(proj[i].py, prevProj[i].py, Math.min(radius, Math.max(1, Math.floor((s.y1 - s.y0) / 3))));
      /* ⚠️ min, not max, across the two axes. A vector is only as trustworthy
         as its worse component; taking the max let a garbage x ride in on a
         y that happened to look sharp — contrast 1.04 passed a 1.12 gate. */
      const confident = Math.min(hx.contrast, hy.contrast) >= minContrast
        && Math.max(hx.gain, hy.gain) >= minGain;
      // An unconfident step contributes nothing rather than a guess: a wrong
      // increment is permanent once it is in the running total.
      if (confident) { acc[i].x += hx.shift; acc[i].y += hy.shift; }
      return { ...s, dx: acc[i].x, dy: acc[i].y, contrast: Math.min(hx.contrast, hy.contrast), confident };
    });
    prevProj = proj;
    return out;
  }));
}

/**
 * Zero out bands whose motion has no rhythm.
 *
 * ⭐⭐ Real drift is ORDERED: the same sign and roughly the same magnitude,
 * frame after frame, because something is moving at a speed. Spurious motion —
 * noise, a small object crossing a still band, a codec artefact — is erratic.
 * That is the same distinction this repo already draws everywhere else between
 * a cycle and a dice roll, and it is a far better discriminator than any
 * per-frame confidence, because a single frame cannot be judged at all: the
 * evidence for "this band is translating" only exists across the clip.
 *
 * Measured: on a fixture with heavy noise and no translation, per-frame gating
 * alone still let enough spurious steps through to cost 3.7% of cells. This
 * removes them because they do not agree with each other.
 */
function requireRhythm(perFrameBands, { agree = 0.6 } = {}) {
  const nb = perFrameBands[0].length;
  for (let i = 0; i < nb; i++) {
    const steps = [];
    for (let t = 1; t < perFrameBands.length; t++) {
      const a = perFrameBands[t][i], b = perFrameBands[t - 1][i];
      steps.push({ t, dx: a.dx - b.dx, dy: a.dy - b.dy });
    }
    const mags = steps.map((s) => Math.hypot(s.dx, s.dy)).sort((a, b) => a - b);
    const med = mags[Math.floor(mags.length / 2)];
    if (med < 0.25) { // nothing is moving; leave the zeros alone
      continue;
    }
    const sx = Math.sign(steps.reduce((a, s) => a + s.dx, 0));
    const sy = Math.sign(steps.reduce((a, s) => a + s.dy, 0));
    const consistent = steps.filter((s) => {
      const m = Math.hypot(s.dx, s.dy);
      if (m < med * 0.5 || m > med * 2) return false;
      return (sx === 0 || Math.sign(s.dx) === sx || Math.abs(s.dx) < med * 0.25)
        && (sy === 0 || Math.sign(s.dy) === sy || Math.abs(s.dy) < med * 0.25);
    }).length;
    if (consistent / steps.length < agree) {
      for (const f of perFrameBands) { f[i].dx = 0; f[i].dy = 0; f[i].confident = false; f[i].arrhythmic = true; }
    }
  }
  return perFrameBands;
}

/**
 * → per frame, per cell ROW, the sub-cell correction in PIXELS to apply to the
 *   sampling window so that the content lands ON the lattice.
 *
 * ⭐ The whole algorithm is this one line of arithmetic: the content sits at
 * d cells from where it started; it will be DRAWN at round(d) cells; so shift
 * the sampling window by the remainder, (d - round(d)) cells, and the edges
 * fall exactly on cell boundaries again. Successive frames then differ by
 * round(d(t)) - round(d(t-1)) — a whole number of cells, every time, by
 * construction. Nothing downstream has to check for it.
 */
export function snapShifts(perFrameBands, grid) {
  return perFrameBands.map((bandsAtT) => {
    const shift = new Float64Array(grid.rows * 2);
    for (const b of bandsAtT) {
      const cx = b.confident ? b.dx / grid.px : 0;
      const cy = b.confident ? b.dy / grid.py : 0;
      const fx = (cx - Math.round(cx)) * grid.px;
      const fy = (cy - Math.round(cy)) * grid.py;
      for (let r = b.r0; r < b.r1; r++) { shift[r * 2] = fx; shift[r * 2 + 1] = fy; }
    }
    return shift;
  });
}

/** Human-readable trace, so a run can be judged rather than believed. */
export function describe(perFrameBands, grid) {
  const n = perFrameBands[0].length;
  const out = [];
  for (let i = 0; i < n; i++) {
    const last = perFrameBands[perFrameBands.length - 1][i];
    const cells = last.dx / grid.px;
    const conf = perFrameBands.filter((f) => f[i].confident).length;
    out.push(`  band ${i} (rows ${last.r0}-${last.r1 - 1}): `
      + `${cells >= 0 ? '+' : ''}${cells.toFixed(2)} cells over the clip, `
      + (last.arrhythmic ? 'no rhythm — treated as still' : `${conf}/${perFrameBands.length} frames confident`));
  }
  return out.join('\n');
}
