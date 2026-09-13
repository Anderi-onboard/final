/**
 * Minimal PNG read/write. Node's zlib does the hard part; this is chunk
 * plumbing and the scanline filters.
 *
 * Zero dependency is not purity for its own sake — this repo ships static files
 * with no build step, and a toolchain that needs `npm i sharp` is a toolchain
 * that stops working the first time someone clones on a machine without a
 * compiler. Everything here is node: built-ins.
 *
 * Reads colour types 0/2/3/4/6 at bit depth 8 and 16 (16 is taken down to the
 * high byte — these are pixel-art sources, the low byte is compression noise).
 * Rejects interlaced files: ffmpeg does not produce them and supporting Adam7
 * would double this file to handle input nobody has.
 */
import { inflateSync, deflateSync } from 'node:zlib';

const SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function crc32(buf) {
  let c, table = crc32.t;
  if (!table) {
    table = crc32.t = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  c = -1;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function paeth(a, b, c) {
  const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

/** → { width, height, data: Uint8Array RGBA } */
export function readPNG(buf) {
  if (!buf.subarray(0, 8).equals(SIG)) throw new Error('not a PNG');
  let i = 8, ihdr = null, idat = [], plte = null, trns = null;
  while (i < buf.length) {
    const len = buf.readUInt32BE(i);
    const type = buf.toString('ascii', i + 4, i + 8);
    const body = buf.subarray(i + 8, i + 8 + len);
    if (type === 'IHDR') {
      ihdr = {
        width: body.readUInt32BE(0), height: body.readUInt32BE(4),
        depth: body[8], colour: body[9], interlace: body[12]
      };
    } else if (type === 'PLTE') plte = Buffer.from(body);
    else if (type === 'tRNS') trns = Buffer.from(body);
    else if (type === 'IDAT') idat.push(Buffer.from(body));
    else if (type === 'IEND') break;
    i += 12 + len;
  }
  if (!ihdr) throw new Error('PNG has no IHDR');
  if (ihdr.interlace) throw new Error('interlaced PNG is not supported — re-export progressive');
  const { width, height, depth, colour } = ihdr;
  if (depth !== 8 && depth !== 16) throw new Error(`PNG bit depth ${depth} is not supported (need 8 or 16)`);

  const chans = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colour];
  if (!chans) throw new Error(`PNG colour type ${colour} is not supported`);
  const bpp = chans * (depth / 8);
  const stride = width * bpp;

  const raw = inflateSync(Buffer.concat(idat));
  const out = Buffer.alloc(height * stride);
  let pos = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[pos++];
    const line = raw.subarray(pos, pos + stride); pos += stride;
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const up = y ? out.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0;
      const b = up ? up[x] : 0;
      const c = up && x >= bpp ? up[x - bpp] : 0;
      let v = line[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) v += paeth(a, b, c);
      else if (filter !== 0) throw new Error(`unknown PNG filter ${filter} on row ${y}`);
      cur[x] = v & 0xff;
    }
  }

  // Normalise everything to RGBA8. Callers should never have to branch on
  // colour type; that is how a pipeline grows a second list to keep in step.
  const rgba = new Uint8Array(width * height * 4);
  const step = depth === 16 ? 2 : 1;
  for (let p = 0; p < width * height; p++) {
    const s = p * bpp;
    let r, g, b, a = 255;
    if (colour === 0) { r = g = b = out[s]; }
    else if (colour === 4) { r = g = b = out[s]; a = out[s + step]; }
    else if (colour === 2) { r = out[s]; g = out[s + step]; b = out[s + 2 * step]; }
    else if (colour === 6) { r = out[s]; g = out[s + step]; b = out[s + 2 * step]; a = out[s + 3 * step]; }
    else { // indexed
      const k = out[s];
      if (!plte) throw new Error('indexed PNG without PLTE');
      r = plte[k * 3]; g = plte[k * 3 + 1]; b = plte[k * 3 + 2];
      if (trns && k < trns.length) a = trns[k];
    }
    rgba[p * 4] = r; rgba[p * 4 + 1] = g; rgba[p * 4 + 2] = b; rgba[p * 4 + 3] = a;
  }
  return { width, height, data: rgba };
}

function chunk(type, body) {
  const len = Buffer.alloc(4); len.writeUInt32BE(body.length);
  const head = Buffer.concat([Buffer.from(type, 'ascii'), body]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(head));
  return Buffer.concat([len, head, crc]);
}

/** RGBA8 → PNG buffer. Filter 0 only; these are flat-colour images and deflate
 *  already eats the runs, so per-line filter search would buy almost nothing. */
export function writePNG(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([SIG, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
