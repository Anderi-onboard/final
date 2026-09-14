/**
 * .pxa → spritesheet (one PNG, frames laid out in a grid).
 *
 * ⭐ This is the export that has to survive being read by something that is not
 * us — a game engine's texture importer, a CSS `steps()` animation, an artist's
 * editor. So the layout is stated rather than implied: frames run left to right
 * then top to bottom, every cell is exactly `w*scale × h*scale`, and the last
 * row is padded with transparency rather than shortened. A sheet whose last row
 * is a different height cannot be indexed by arithmetic, which is the only
 * reason anyone wants a sheet.
 *
 * ⚠️ Scaling is whole-pixel replication, never interpolation. A pixel format
 * that resamples its own export has thrown away the thing it exists to
 * preserve — and it fails quietly, because a bilinear upscale of pixel art
 * still looks like pixel art in a thumbnail.
 */

/** Frames per row, and how many rows that needs. Square-ish unless told. */
export function sheetGrid(count, cols) {
  const c = Math.max(1, cols || Math.min(count, Math.ceil(Math.sqrt(count))));
  return { cols: c, rows: Math.ceil(count / c) };
}

/**
 * frames: array of Uint8Array palette indices, w*h each.
 * rgb: [r,g,b] per palette entry, or null for transparent.
 * → { px (RGBA), W, H, cols, rows, cellW, cellH }
 */
export function composeSheet(frames, w, h, rgb, { scale = 1, cols = 0 } = {}) {
  const grid = sheetGrid(frames.length, cols);
  const cellW = w * scale, cellH = h * scale;
  const W = grid.cols * cellW, H = grid.rows * cellH;
  // Zero-filled means fully transparent, which is what the padding cells of an
  // incomplete last row must be.
  const px = new Uint8Array(W * H * 4);

  frames.forEach((g, t) => {
    const ox = (t % grid.cols) * cellW, oy = ((t / grid.cols) | 0) * cellH;
    for (let y = 0; y < cellH; y++) {
      const sy = (y / scale) | 0;
      for (let x = 0; x < cellW; x++) {
        const c = rgb[g[sy * w + ((x / scale) | 0)]];
        if (!c) continue;                       // transparent slot: leave alpha 0
        const p = ((oy + y) * W + ox + x) * 4;
        px[p] = c[0]; px[p + 1] = c[1]; px[p + 2] = c[2]; px[p + 3] = 255;
      }
    }
  });

  return { px, W, H, cols: grid.cols, rows: grid.rows, cellW, cellH };
}
