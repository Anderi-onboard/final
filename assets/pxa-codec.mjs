/**
 * PXA — a colour-cell animation format.
 *
 * THE POINT: the asset stores PALETTE INDICES, not pixels. That buys two
 * things a PNG/GIF/WebP cannot give:
 *
 *   1. It recolours. An index is resolved at paint time, so a palette entry
 *      written "@3" becomes var(--bw-palette-3) and the animation rotates with
 *      the 114 colour groups like everything else on the page. Every bitmap
 *      this repo has shipped so far has been the one thing on the page that
 *      did NOT follow the palette — paper-grain.svg, ph-drift.svg's fill="#000",
 *      the white flash. An indexed bitmap is the only kind that cannot make
 *      that mistake, because it does not carry colour at all.
 *   2. It is resolution-independent upward. A cell is a unit, not a pixel, so
 *      one asset renders crisp at 48px and at 1400px — see assets/pxa.js.
 *
 * WHY A TEXT FORMAT: this repo has no build step. A .pxa.json is a normal
 * static asset, diffable in git, and decodes in ~40 lines with no dependency.
 *
 * ── Wire format ──────────────────────────────────────────────────────────
 * {
 *   "pxa": 1,
 *   "w": 64, "h": 48,          // grid size in CELLS (never pixels)
 *   "fps": 12,
 *   "palette": ["-", "#1a1c2c", "@3", "@gem"],
 *   "frames": ["K...", "D...", ...]
 * }
 *
 * Palette entry grammar:
 *   "-"          transparent
 *   "#rgb|#rrggbb"  literal colour (use only when the colour IS the content)
 *   "@1".."@10"  var(--bw-palette-N)     — the ridge ramp, light→dark
 *   "@sky" "@water" "@gem" "@cloudbody"  — the engine's other published slots
 *   "@ink-sky" "@ink-ridge"              — the solved readable inks
 *
 * Frame strings, first char is the mode:
 *   K  keyframe   [run][idx] pairs, covering exactly w*h cells
 *   D  delta      [skip][run][idx] triples, against the previous frame
 * The encoder emits whichever is shorter per frame, so a frame that changes
 * everything does not pay delta's overhead and a frame that changes one cell
 * does not pay a full grid. Frame 0 is always K.
 *
 * Numbers are base-64 varints, 5 bits per char, bit 0x20 = "more follows".
 * 0–31 costs one char, which is the common case for both runs and indices.
 *
 * ── Integrity ────────────────────────────────────────────────────────────
 * decode() asserts every keyframe fills exactly w*h cells and every delta
 * stays in bounds. A truncated asset therefore throws instead of rendering a
 * half-drawn grid that looks like a design decision. This repo has paid for
 * "the style applied but nothing was painted" enough times.
 */

const A64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+-';
const IDX = (() => {
  const t = new Int8Array(128).fill(-1);
  for (let i = 0; i < 64; i++) t[A64.charCodeAt(i)] = i;
  return t;
})();

export const FORMAT = 1;

/* ── varint ───────────────────────────────────────────────────────────── */

function putVar(out, n) {
  if (!Number.isInteger(n) || n < 0) throw new Error(`varint takes a non-negative integer, got ${n}`);
  do {
    const chunk = n & 31;
    n = Math.floor(n / 32);
    out.push(A64[chunk | (n ? 32 : 0)]);
  } while (n);
}

function getVar(s, i) {
  let v = 0, shift = 1, c;
  do {
    if (i >= s.length) throw new Error('PXA stream ended inside a number');
    c = IDX[s.charCodeAt(i++)];
    if (c < 0) throw new Error(`PXA stream carries a character outside the alphabet at ${i - 1}`);
    v += (c & 31) * shift;
    shift *= 32;
  } while (c & 32);
  return [v, i];
}

/* ── encode ───────────────────────────────────────────────────────────── */

function encodeKey(grid) {
  const out = ['K'];
  let i = 0;
  while (i < grid.length) {
    const v = grid[i];
    let run = 1;
    while (i + run < grid.length && grid[i + run] === v) run++;
    putVar(out, run);
    putVar(out, v);
    i += run;
  }
  return out.join('');
}

function encodeDelta(grid, prev) {
  const out = ['D'];
  let i = 0, cursor = 0;
  while (i < grid.length) {
    if (grid[i] === prev[i]) { i++; continue; }
    const v = grid[i];
    let run = 1;
    while (i + run < grid.length && grid[i + run] === v && grid[i + run] !== prev[i + run]) run++;
    putVar(out, i - cursor);   // skip
    putVar(out, run);
    putVar(out, v);
    i += run;
    cursor = i;
  }
  return out.join('');
}

/**
 * grids: array of Uint8Array|Array of palette indices, each of length w*h.
 * Returns the plain object you JSON.stringify into a .pxa.json.
 */
export function encode(grids, { w, h, fps = 12, palette, meta } = {}) {
  if (!Array.isArray(grids) || !grids.length) throw new Error('encode needs at least one frame');
  if (!Number.isInteger(w) || !Number.isInteger(h) || w < 1 || h < 1) throw new Error('encode needs integer w,h ≥ 1');
  if (!Array.isArray(palette) || !palette.length) throw new Error('encode needs a palette');
  const cells = w * h;

  const frames = [];
  for (let t = 0; t < grids.length; t++) {
    const g = grids[t];
    if (g.length !== cells) throw new Error(`frame ${t} has ${g.length} cells, expected ${cells}`);
    for (let i = 0; i < cells; i++) {
      if (g[i] >= palette.length) throw new Error(`frame ${t} cell ${i} indexes palette entry ${g[i]} of ${palette.length}`);
    }
    const key = encodeKey(g);
    // Frame 0 must be a keyframe: the player restores it on every loop, and a
    // delta against nothing is not a thing.
    if (t === 0) { frames.push(key); continue; }
    const delta = encodeDelta(g, grids[t - 1]);
    frames.push(delta.length < key.length ? delta : key);
  }

  const doc = { pxa: FORMAT, w, h, fps, palette: palette.slice(), frames };
  if (meta) doc.meta = meta;
  return doc;
}

/* ── decode ───────────────────────────────────────────────────────────── */

/**
 * Returns { w, h, fps, palette, frames: Uint8Array[] } with every frame
 * materialised. Frames are small (w*h bytes) and playback then costs nothing,
 * so there is no reason to decode lazily.
 */
export function decode(doc) {
  if (!doc || doc.pxa !== FORMAT) throw new Error(`not a PXA v${FORMAT} document`);
  const { w, h, palette } = doc;
  const cells = w * h;
  if (!Number.isInteger(cells) || cells < 1) throw new Error('PXA document has no grid');
  if (!Array.isArray(palette) || !palette.length) throw new Error('PXA document has no palette');

  const frames = [];
  let prev = null;
  for (let t = 0; t < doc.frames.length; t++) {
    const s = doc.frames[t];
    const mode = s[0];
    const g = new Uint8Array(cells);
    let i = 1;

    if (mode === 'K') {
      let at = 0;
      while (i < s.length) {
        let run, v;
        [run, i] = getVar(s, i);
        [v, i] = getVar(s, i);
        if (at + run > cells) throw new Error(`frame ${t}: keyframe overruns the grid (${at + run} > ${cells})`);
        if (v >= palette.length) throw new Error(`frame ${t}: index ${v} is outside the palette`);
        g.fill(v, at, at + run);
        at += run;
      }
      // A keyframe that does not fill the grid is a truncated asset, not a
      // sparse one. Say so rather than painting a half grid.
      if (at !== cells) throw new Error(`frame ${t}: keyframe covers ${at} of ${cells} cells`);
    } else if (mode === 'D') {
      if (!prev) throw new Error(`frame ${t}: delta frame with no previous frame`);
      g.set(prev);
      let at = 0;
      while (i < s.length) {
        let skip, run, v;
        [skip, i] = getVar(s, i);
        [run, i] = getVar(s, i);
        [v, i] = getVar(s, i);
        at += skip;
        if (at + run > cells) throw new Error(`frame ${t}: delta overruns the grid (${at + run} > ${cells})`);
        if (v >= palette.length) throw new Error(`frame ${t}: index ${v} is outside the palette`);
        g.fill(v, at, at + run);
        at += run;
      }
    } else {
      throw new Error(`frame ${t}: unknown mode ${JSON.stringify(mode)}`);
    }

    frames.push(g);
    prev = g;
  }

  return { w, h, fps: doc.fps || 12, palette: palette.slice(), frames, meta: doc.meta || null };
}

/* ── palette resolution ───────────────────────────────────────────────── */

const SLOT = {
  sky: '--bw-palette-cloud',
  cloud: '--bw-palette-cloud',
  cloudbody: '--bw-palette-cloudbody',
  water: '--bw-palette-water',
  gem: '--bw-palette-gem',
  'ink-sky': '--bw-ink-on-sky',
  'ink-ridge': '--bw-ink-on-ridge'
};

/** "@3" → "--bw-palette-3". Returns null for literals and transparent. */
export function cssVarFor(entry) {
  if (typeof entry !== 'string' || entry[0] !== '@') return null;
  const key = entry.slice(1);
  if (/^([1-9]|10)$/.test(key)) return `--bw-palette-${key}`;
  return SLOT[key] || null;
}

/** Bytes per frame if this were stored raw, vs what the encoding cost. */
export function stats(doc) {
  const raw = doc.w * doc.h * doc.frames.length;
  const coded = doc.frames.reduce((n, f) => n + f.length, 0);
  const keys = doc.frames.filter((f) => f[0] === 'K').length;
  return { cells: doc.w * doc.h, frames: doc.frames.length, raw, coded, ratio: coded / raw, keyframes: keys };
}
