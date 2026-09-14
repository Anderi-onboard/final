/**
 * .pxa → animated GIF, with no quantisation step at all.
 *
 * ⭐ The two formats store the same thing: a global colour table and frames of
 * indices into it. Converting a VIDEO to GIF is lossy because the video has to
 * be quantised down to 256 colours first; converting a .pxa is a transfer. The
 * indices go across unchanged and the palette becomes the colour table.
 *
 * ⭐ The delta information is not thrown away either. GIF frames carry their own
 * position and size, so each frame after the first is emitted as just the
 * bounding box of what changed, over a canvas that is not disposed. A clip
 * where one corner moves ships one corner per frame.
 *
 * ⚠️ GIF measures delay in HUNDREDTHS of a second, so only frame rates that
 * divide 100 are expressible: 50, 25, 20, 10, 5, 4, 2, 1. Twelve is not —
 * 100/12 is 8.33, and every writer silently rounds it. `encodeGIF` reports the
 * rate it can actually deliver so the caller can say so out loud rather than
 * ship an animation that runs 4% fast and blame the browser.
 *
 * ⚠️ Browsers also clamp very short delays: a delay under 2 centiseconds is
 * widely treated as 10, which turns a 50fps clip into a 10fps one. Rates above
 * 50 are refused rather than quietly mangled.
 */
import { deflateSync } from 'node:zlib';

/* ── LZW, as GIF specifies it ─────────────────────────────────────────────
   Not the same as any general-purpose LZW: codes are variable width, growing
   from minCodeSize+1, the dictionary is reset with an explicit clear code when
   it reaches 4096, and the bits are packed least-significant-first into bytes
   that are then cut into sub-blocks of at most 255. Each of those four details
   has its own way of producing a file that opens as a grey rectangle. */
function lzwEncode(indices, minCodeSize) {
  const clear = 1 << minCodeSize;
  const eoi = clear + 1;
  let codeSize = minCodeSize + 1;
  let next = eoi + 1;
  let dict = new Map();

  const out = [];
  let cur = 0, curBits = 0;
  const emit = (code) => {
    cur |= code << curBits;
    curBits += codeSize;
    while (curBits >= 8) { out.push(cur & 0xff); cur >>= 8; curBits -= 8; }
  };

  emit(clear);
  let prefix = indices[0];
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i];
    const key = prefix * 4096 + k;
    const found = dict.get(key);
    if (found !== undefined) { prefix = found; continue; }
    emit(prefix);
    if (next < 4096) {
      dict.set(key, next++);
      // The width grows AFTER the code that filled the old width is emitted.
      if (next > (1 << codeSize) && codeSize < 12) codeSize++;
    } else {
      emit(clear);
      dict = new Map();
      next = eoi + 1;
      codeSize = minCodeSize + 1;
    }
    prefix = k;
  }
  emit(prefix);
  emit(eoi);
  if (curBits > 0) out.push(cur & 0xff);

  // Sub-blocks: one length byte, then up to 255 bytes, repeated, then a zero.
  const blocks = [];
  for (let i = 0; i < out.length; i += 255) {
    const chunk = out.slice(i, i + 255);
    blocks.push(chunk.length, ...chunk);
  }
  blocks.push(0);
  return Buffer.from(blocks);
}

/** The bounding box of cells that differ between two frames, or null. */
function changedBox(a, b, w, h) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (a[y * w + x] !== b[y * w + x]) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

const u16 = (n) => Buffer.from([n & 0xff, (n >> 8) & 0xff]);

/**
 * frames: Uint8Array of palette indices, w*h each.
 * rgb: [r,g,b] per palette entry, or null for transparent.
 * → { buffer, fps, delayCs, exact } — `fps` is what the file will ACTUALLY play
 *   at, which is not always what was asked for.
 */
export function encodeGIF(frames, w, h, rgb, fps, { scale = 1 } = {}) {
  if (fps > 50) throw new Error(`GIF cannot carry ${fps}fps: delay is in centiseconds and browsers clamp `
    + `anything under 2. The highest honest rate is 50.`);
  const delayCs = Math.max(2, Math.round(100 / fps));
  const actual = 100 / delayCs;

  // Colour table size is the next power of two, minimum 2 entries.
  let bits = 1;
  while ((1 << bits) < rgb.length) bits++;
  const tableSize = 1 << bits;
  const transparent = rgb.findIndex((c) => c === null);

  const gct = Buffer.alloc(tableSize * 3);
  rgb.forEach((c, i) => {
    // A transparent slot still occupies a table entry; its colour is never
    // painted, so anything is correct — black keeps the file boring.
    const v = c || [0, 0, 0];
    gct[i * 3] = v[0]; gct[i * 3 + 1] = v[1]; gct[i * 3 + 2] = v[2];
  });

  const W = w * scale, H = h * scale;
  const parts = [
    Buffer.from('GIF89a', 'ascii'),
    u16(W), u16(H),
    Buffer.from([0x80 | ((bits - 1) & 7), 0, 0]),   // GCT present, colour depth, size
    gct,
    // Netscape looping extension. Without it the animation plays once, which
    // is not what anyone converting a loop wants.
    Buffer.from([0x21, 0xff, 0x0b]), Buffer.from('NETSCAPE2.0', 'ascii'),
    Buffer.from([0x03, 0x01, 0x00, 0x00, 0x00])
  ];

  /* ⚠️ Disposal 1 cannot take paint back. A viewer SKIPS the transparent index
     rather than writing it, so a cell that is painted in one frame and
     transparent in the next keeps its old colour forever — the clip quietly
     loses every hole that opens after the first frame, and it still plays.
     Frames that un-paint something therefore have to be handled: the frame
     BEFORE one is disposed with 2 (restore to background, i.e. cleared) and
     both are sent whole, so the hole is drawn onto an empty canvas.
     This needs one frame of lookahead, so it is decided up front. A clip whose
     transparency never changes — the usual case — takes none of this and keeps
     full delta rectangles. */
  const unpaints = frames.map((g, t) => {
    if (t === 0 || transparent < 0) return false;
    const p = frames[t - 1];
    for (let i = 0; i < g.length; i++) if (g[i] === transparent && p[i] !== transparent) return true;
    return false;
  });

  let prev = null;
  frames.forEach((g, t) => {
    // First frame is whole; the rest are the box of what changed, over a canvas
    // left in place (disposal 1). A frame that changes nothing still needs to
    // exist so the delay elapses — a 1x1 box costs a handful of bytes.
    const whole = t === 0 || unpaints[t] || unpaints[t + 1];
    const box = whole ? { x: 0, y: 0, w, h }
      : (changedBox(prev, g, w, h) || { x: 0, y: 0, w: 1, h: 1 });

    // Dispose to background only when the NEXT frame opens a hole; otherwise
    // leave the canvas in place, which is what makes delta rectangles legal.
    const disposal = unpaints[t + 1] ? 2 : 1;
    const flags = (disposal << 2) | (transparent >= 0 ? 1 : 0);
    parts.push(Buffer.from([0x21, 0xf9, 0x04, flags]), u16(delayCs),
      Buffer.from([transparent >= 0 ? transparent : 0, 0x00]));

    parts.push(Buffer.from([0x2c]),
      u16(box.x * scale), u16(box.y * scale), u16(box.w * scale), u16(box.h * scale),
      Buffer.from([0x00]));                                 // no local table, not interlaced

    const px = new Uint8Array(box.w * scale * box.h * scale);
    for (let y = 0; y < box.h * scale; y++) {
      const sy = box.y + ((y / scale) | 0);
      for (let x = 0; x < box.w * scale; x++) {
        px[y * box.w * scale + x] = g[sy * w + box.x + ((x / scale) | 0)];
      }
    }
    const min = Math.max(2, bits);
    parts.push(Buffer.from([min]), lzwEncode(px, min));
    prev = g;
  });

  parts.push(Buffer.from([0x3b]));
  return { buffer: Buffer.concat(parts), fps: actual, delayCs, exact: Math.abs(actual - fps) < 1e-9 };
}

/** Frame rates a GIF can hold exactly, for an error message that helps. */
export const EXACT_RATES = [50, 25, 20, 10, 5, 4, 2, 1];

void deflateSync;
