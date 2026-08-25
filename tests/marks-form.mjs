/* The thirty phenomena, checked against the form brief rather than against my
 * eye. The brief, in the owner's words:
 *
 *   ① 本体中无线条交叉        no stroke crosses another inside one mark
 *   ② 写意而没有特殊规则组成  freehand; not the output of a scheme
 *   ③ 不能过分对称            no mirroring, no n-fold rotation
 *   ④ 不能反复大量挪用相同的部分  a part may not be stamped repeatedly
 *   ⑤ 相似的结构可以,细节必须不同
 *   ⑥ 没有过分与标准图像和已有图案相似
 *
 * The second pass failed five of six and I did not know it until I counted:
 * 25 of 30 marks were bulk copies of one curve, 30 of 30 came out of a single
 * repeater, 5 were rotationally symmetric, 5 were icon schemas. Judging this
 * by looking is exactly what produced that, so ①③④ are measured here — they
 * are the three that reduce to geometry. ② and ⑥ do not reduce to geometry
 * and are not faked into a number; what stands in for them is the ban on `A`
 * commands, since a true circular arc is the one curve a hand cannot draw and
 * was the common thread through every mark that read as clip-art.
 *
 * Everything is measured off the flattened path, so it catches what ships and
 * not what the source claims. */
import assert from 'node:assert/strict';
import fs from 'node:fs';

const src = fs.readFileSync(new URL('../assets/marks.js', import.meta.url), 'utf8');
const scope = { window: {} };
new Function('window', src)(scope.window);
const PH = scope.window.BWMarks.phenomena;

/* ── flatten ─────────────────────────────────────────────────────────────
   M and C only, which is the whole vocabulary the phenomena are allowed. */
const FLAT = 14;                              /* samples per cubic */
function flatten(d) {
  const tok = d.match(/[MC]|-?\d*\.?\d+/g) || [];
  const subs = [];
  let cur = null, x = 0, y = 0, i = 0;
  while (i < tok.length) {
    const t = tok[i];
    if (t === 'M') {
      x = +tok[i + 1]; y = +tok[i + 2]; i += 3;
      cur = [[x, y]]; subs.push(cur);
    } else if (t === 'C') {
      const [x1, y1, x2, y2, x3, y3] = tok.slice(i + 1, i + 7).map(Number);
      for (let k = 1; k <= FLAT; k++) {
        const u = k / FLAT, v = 1 - u;
        cur.push([
          v * v * v * x + 3 * v * v * u * x1 + 3 * v * u * u * x2 + u * u * u * x3,
          v * v * v * y + 3 * v * v * u * y1 + 3 * v * u * u * y2 + u * u * u * y3
        ]);
      }
      x = x3; y = y3; i += 7;
    } else i += 1;                             /* stray number: skip */
  }
  return subs.filter((s) => s.length > 1);
}

const arclen = (p) => {
  const cum = [0];
  for (let i = 1; i < p.length; i++) cum.push(cum[i - 1] + Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]));
  return cum;
};

/* Proper crossing only: parallel or touching segments are not a crossing, and
   neither is a branch that starts on the stroke it leaves — that is a join,
   which the brief allows and a root system needs. */
function hit(a, b, c, e) {
  const r = [b[0] - a[0], b[1] - a[1]], s = [e[0] - c[0], e[1] - c[1]];
  const den = r[0] * s[1] - r[1] * s[0];
  if (Math.abs(den) < 1e-12) return null;
  const t = ((c[0] - a[0]) * s[1] - (c[1] - a[1]) * s[0]) / den;
  const u = ((c[0] - a[0]) * r[1] - (c[1] - a[1]) * r[0]) / den;
  return t > 0 && t < 1 && u > 0 && u < 1 ? [t, u] : null;
}

const END = 0.055;                             /* fraction of a stroke that counts as its end */
function crossings(subs) {
  const cum = subs.map(arclen), out = [];
  for (let A = 0; A < subs.length; A++) {
    for (let B = A; B < subs.length; B++) {
      for (let i = 0; i + 1 < subs[A].length; i++) {
        const jFrom = A === B ? i + 2 : 0;
        for (let j = jFrom; j + 1 < subs[B].length; j++) {
          const h = hit(subs[A][i], subs[A][i + 1], subs[B][j], subs[B][j + 1]);
          if (!h) continue;
          const la = cum[A][cum[A].length - 1], lb = cum[B][cum[B].length - 1];
          const sa = (cum[A][i] + h[0] * (cum[A][i + 1] - cum[A][i])) / la;
          const sb = (cum[B][j] + h[1] * (cum[B][j + 1] - cum[B][j])) / lb;
          const nearEnd = (s) => s < END || s > 1 - END;
          if (nearEnd(sa) || nearEnd(sb)) continue;
          out.push(`stroke ${A} at ${(sa * 100) | 0}% × stroke ${B} at ${(sb * 100) | 0}%`);
        }
      }
    }
  }
  return out;
}

/* ── ③ symmetry ─────────────────────────────────────────────────────────
   A mark is too symmetric when most of it lands back on itself under a
   mirror or a rotation about its own centre. Measured as the fraction of
   sampled points whose image finds a neighbour within 2.5% of the diagonal. */
function symmetry(subs) {
  const pts = [];
  for (const s of subs) for (let i = 0; i < s.length; i += 2) pts.push(s[i]);
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const diag = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  const tol = diag * 0.025, tol2 = tol * tol;
  const score = (T) => {
    let n = 0;
    for (const p of pts) {
      const q = T(p[0] - cx, p[1] - cy);
      for (const o of pts) {
        const dx = o[0] - cx - q[0], dy = o[1] - cy - q[1];
        if (dx * dx + dy * dy < tol2) { n++; break; }
      }
    }
    return n / pts.length;
  };
  const worst = { name: 'none', frac: 0 };
  const take = (name, frac) => { if (frac > worst.frac) { worst.name = name; worst.frac = frac; } };
  take('mirror-x', score((x, y) => [-x, y]));
  take('mirror-y', score((x, y) => [x, -y]));
  for (let n = 2; n <= 6; n++) {
    const a = (2 * Math.PI) / n, c = Math.cos(a), s = Math.sin(a);
    take(`rot-${n}`, score((x, y) => [x * c - y * s, x * s + y * c]));
  }
  return worst;
}

/* ── ④ / ⑤ repeated parts ───────────────────────────────────────────────
   Two strokes are the same part when, laid over each other at their own
   centres, they differ by almost nothing. Siblings are expected and welcome;
   stamps are not. Resampled by arclength so a long copy of a short stroke
   still registers as the same shape only if it really is one. */
function resample(p, n) {
  const cum = arclen(p), L = cum[cum.length - 1] || 1, out = [];
  let j = 0;
  for (let k = 0; k <= n; k++) {
    const target = (k / n) * L;
    while (j + 2 < p.length && cum[j + 1] < target) j++;
    const seg = cum[j + 1] - cum[j] || 1, t = Math.min(1, Math.max(0, (target - cum[j]) / seg));
    out.push([p[j][0] + (p[j + 1][0] - p[j][0]) * t, p[j][1] + (p[j + 1][1] - p[j][1]) * t]);
  }
  return out;
}
function clones(subs, diag) {
  const N = 10, len = subs.map((s) => arclen(s).pop());
  const norm = subs.map((s) => {
    const q = resample(s, N);
    const mx = q.reduce((a, p) => a + p[0], 0) / q.length, my = q.reduce((a, p) => a + p[1], 0) / q.length;
    return q.map((p) => [p[0] - mx, p[1] - my]);
  });
  const out = [];
  for (let a = 0; a < norm.length; a++) {
    for (let b = a + 1; b < norm.length; b++) {
      /* Too short to be a "part": below an eighth of the mark nothing has
         enough shape to be recognisably reused, and holding two 6px ticks to
         this rule would forbid drawing rather than forbid stamping. */
      if (len[a] < diag * 0.12 || len[b] < diag * 0.12) continue;
      let dev = 0;
      for (let k = 0; k <= N; k++) dev += Math.hypot(norm[a][k][0] - norm[b][k][0], norm[a][k][1] - norm[b][k][1]);
      /* Measured against the strokes' own length, not the mark's: whether two
         strokes are the same shape is a question about them. Orientation is
         NOT normalised away — a stroke and its 180° copy are caught by the
         symmetry test, and folding them together here made every pair of
         opposed arms in 星 read as a stamp, which is a false positive that
         would have pushed the redraw in exactly the wrong direction. */
      /* 1.5% is calibrated, not chosen. Scored against the second pass, whose
         stamps are known because hand() emitted one path translated: 217 of
         its 1324 stroke pairs fall under 1.5% and the 5th percentile is 0.00%
         — a real stamp scores zero. Above that the population thins out
         smoothly, which is siblings, and ⑤ asks for siblings. An earlier 5%
         flagged 98 pairs here and every one I looked at was a legitimate
         family member; a threshold that forbids two bands of haze resembling
         each other is not enforcing the brief, it is forbidding drawing. */
      const d = dev / (N + 1) / ((len[a] + len[b]) / 2);
      if (d < 0.015) out.push(`strokes ${a} and ${b} differ by ${(d * 100).toFixed(2)}% of their own length`);
    }
  }
  return out;
}

/* ── run ─────────────────────────────────────────────────────────────── */
const names = Object.keys(PH);
assert.equal(names.length, 30, `expected thirty phenomena, got ${names.length}`);

const fail = [];
let strokes = 0;
for (const name of names) {
  const d = PH[name]();
  assert.ok(!/[Aa]\s*-?\d/.test(d),
    `${name}: uses an arc command. A true circular arc is the one curve a hand cannot make`
    + ` — draw it with arcInk() so the radius wanders.`);
  assert.ok(!/NaN|undefined/.test(d), `${name}: emitted NaN/undefined`);

  const subs = flatten(d);
  /* Density, not stroke count: 涡 is deliberately one unbroken stroke, and
     counting strokes would have marked the densest mark in the set as thin. */
  const ink = subs.reduce((a, s) => a + arclen(s).pop(), 0);
  if (ink < 100) fail.push(`◦ ${name}: ${ink.toFixed(0)} units of ink — too sparse to read as drawn`);
  strokes += subs.length;

  const xs = subs.flat().map((p) => p[0]), ys = subs.flat().map((p) => p[1]);
  const diag = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  if (Math.max(...xs.map(Math.abs)) >= 40 || Math.max(...ys.map(Math.abs)) >= 40) {
    fail.push(`⬚ ${name}: leaves the ±40 field (x ${Math.min(...xs).toFixed(0)}..${Math.max(...xs).toFixed(0)},`
      + ` y ${Math.min(...ys).toFixed(0)}..${Math.max(...ys).toFixed(0)})`);
  }

  const x = crossings(subs);
  if (x.length) fail.push(`① ${name}: ${x.length} crossing(s) — ${x.slice(0, 3).join('; ')}`);

  const sym = symmetry(subs);
  if (sym.frac > 0.9) fail.push(`③ ${name}: ${(sym.frac * 100) | 0}% of it lands on itself under ${sym.name}`);

  const c = clones(subs, diag);
  if (c.length) fail.push(`④ ${name}: ${c.length} repeated part(s) — ${c.slice(0, 2).join('; ')}`);
}

assert.deepEqual(fail, [],
  'the phenomena broke the form brief:\n  ' + fail.join('\n  ')
  + '\n  Redraw the offending strokes; do not loosen the thresholds to pass.');

console.log(`marks form OK — 30 phenomena, ${strokes} strokes, no crossings, no mirrors, no stamps`);
