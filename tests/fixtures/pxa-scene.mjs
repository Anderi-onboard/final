/**
 * The fixture the PXA contract measures against: a known pixel grid, rendered
 * at a FRACTIONAL pitch and then damaged the way a codec damages things —
 * ringing at every colour boundary, 8x8 block banding, per-frame chroma drift,
 * and noise.
 *
 * It lives in its own module so the contract and any throwaway probe measure
 * the SAME picture. A probe that re-implements the fixture is a second list to
 * keep in step, and this repo has paid for that more than once: a probe built
 * from a copy said the detector handled 13x noise, the contract said it did
 * not, and both were right about their own scene.
 */
export const N = 12;
export const PAL = [[26, 28, 44], [51, 60, 87], [87, 114, 119], [126, 161, 109], [210, 168, 96], [232, 111, 81], [240, 232, 207]];
export const mulberry32 = (a) => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

export function truthFrame(t, W, H) {
  /* The same picture at both sizes: every band is a fraction of the grid, not
     a cell count. A fixture whose composition changes with its resolution is
     two different tests wearing one name — and the first version of this was
     exactly that, with a horizon written for 24 rows landing three rows from
     the bottom of a 16-row grid. */
  const g = new Uint8Array(W * H);
  const sky = Math.round(H * 0.54), far = Math.max(2, Math.round(H * 0.17)), ridge = Math.max(1, Math.round(H * 0.125));
  const sunX = Math.round(W * 0.15) + ((t / 4) | 0), sunY = Math.max(2, Math.round(H * 0.21));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const horizon = sky + Math.round(H * 0.083 * Math.sin((x / W) * Math.PI * 2 + 0.6));
    let v = y < horizon - far ? 0 : y < horizon ? 1 : y < horizon + ridge ? 2 : 3;
    // A one-cell accent that MOVES EVERY FRAME. This is the thing the naive
    // temporal vote destroyed, and it is deliberately both small and salient.
    if (y > horizon + ridge + 1 && (x * 3 + y * 5 + t * 7) % 37 < 3) v = 6;
    /* The sun is three cells across, not one. A single-cell core adjacent to a
       high-contrast rim loses its own palette entry below ~12 colours — that is
       the method's resolution limit, not a decision anyone made, and a contract
       that pins a limit gets "fixed" by loosening the number. The limit is
       written up in tools/pxa/README.md instead. */
    const d = Math.abs(x - sunX) + Math.abs(y - sunY);
    if (d < 3) v = 4; else if (d === 3) v = 5;
    g[y * W + x] = v;
  }
  return g;
}

/* Pitches are deliberately fractional (903/40 = 22.575, 543/24 = 22.625): a 2K
   render of a small scene never lands on a whole number, and a detector that
   only considers integer pitches drifts half a cell by the far edge.

   TWO sizes, because the rules do not all bite at one size. Measured:
     · the palette allocator only misallocates when a flat field outweighs the
       smallest feature by roughly 25:1 — true at 40x24, not at 24x16 (10:1).
     · multi-frame energy averaging only becomes load-bearing on the smaller
       render, where a single frame carries less lattice signal to begin with.
   A contract that ran everything at one size would report both rules as
   guarded while guarding neither — which is what the first version did. */
export const BIG = { W: 40, H: 24, OW: 903, OH: 542 };
export const SMALL = { W: 24, H: 16, OW: 543, OH: 362 };

export function damagedFrame(g, seed, strength, F) {
  const { W, H, OW, OH } = F;
  const px = OW / W, py = OH / H;
  const r = mulberry32(seed);
  const data = new Uint8Array(OW * OH * 4);
  const drift = [(r() - 0.5) * strength, (r() - 0.5) * strength, (r() - 0.5) * strength];
  for (let y = 0; y < OH; y++) for (let x = 0; x < OW; x++) {
    const cx = Math.min(W - 1, Math.floor(x / px)), cy = Math.min(H - 1, Math.floor(y / py));
    const c = PAL[g[cy * W + cx]];
    const fx = x / px - cx, fy = y / py - cy;
    let ring = 0;
    for (const [dx, dy, f] of [[-1, 0, fx], [1, 0, 1 - fx], [0, -1, fy], [0, 1, 1 - fy]]) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const nc = PAL[g[ny * W + nx]];
      const diff = (nc[0] - c[0]) + (nc[1] - c[1]) + (nc[2] - c[2]);
      if (f < 0.12 && Math.abs(diff) > 40) ring += -Math.sign(diff) * 26 * (1 - f / 0.12);
    }
    const band = ((x >> 3) + (y >> 3)) % 2 ? 3 : -3;
    const p = (y * OW + x) * 4;
    for (let k = 0; k < 3; k++) {
      data[p + k] = Math.max(0, Math.min(255, c[k] + drift[k] + ring + band + (r() - 0.5) * strength));
    }
    data[p + 3] = 255;
  }
  return { width: OW, height: OH, data };
}


export const truthOf = (F) => Array.from({ length: N }, (_, t) => truthFrame(t, F.W, F.H));
