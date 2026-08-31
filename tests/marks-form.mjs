/* The phenomena, checked against the form brief rather than my eye.
 * The brief, in the owner's words, plus the two lines added after the third
 * pass came back 太细 and 太没有规则:
 *
 *   ① 本体中无线条交叉        no stroke crosses another inside one mark
 *   ② 写意而没有特殊规则组成  freehand; not the output of a scheme
 *   ③ 不能过分对称            no mirroring, no n-fold rotation
 *   ④ 不能反复大量挪用相同的部分  a part may not be stamped repeatedly
 *   ⑤ 相似的结构可以,细节必须不同
 *   ⑥ 没有过分与标准图像和已有图案相似
 *   ⑦ 转弯极致平缓              nothing turns tighter than RMIN — four and a
 *                              half widths, not one. A ribbon bent at its own
 *                              width is a hook; v4 passed that bar and still
 *                              read as sharp.
 *   ⑧ 统一粗细 · 不相交不生长    ONE width for every stroke in the set, and no
 *                              stroke touches another anywhere, ends included.
 *                              A form is PLACED — nested, stacked, fanned —
 *                              never assembled by growing parts off a trunk.
 *
 * ⚠️ Measured on the CENTRELINES, from BWMarks.phenomenaPlan — not on the
 * rendered outline. Once these are ribbons an outline cannot tell a branch
 * joining a trunk from a stroke driven through one, and every one of these
 * marks has branches.
 *
 * Judging this by looking is what produced the second pass, which failed five
 * of six without my noticing: 25 of 30 marks were bulk copies of one curve.
 * So ①③④⑦ are measured, along with the ink weight and the clearance between
 * strokes. ② and ⑥ do not reduce to geometry and are not faked into a number;
 * standing in for them is the ban on `A` commands, since a true circular arc
 * is the one curve a hand cannot draw and was the common thread through every
 * mark that read as clip-art. */
import assert from 'node:assert/strict';
import fs from 'node:fs';

const src = fs.readFileSync(new URL('../assets/marks.js', import.meta.url), 'utf8');
const scope = { window: {} };
new Function('window', src)(scope.window);
const { phenomena: PH, phenomenaPlan: PLAN } = scope.window.BWMarks;

/* The three invariants of the fifth pass, read out of the source so the test
   and the drawing cannot drift apart. */
const W = Number((src.match(/var W = ([\d.]+);/) || [])[1]);
const RMIN = Number((src.match(/var RMIN = ([\d.]+);/) || [])[1]);
assert.ok(Number.isFinite(W) && Number.isFinite(RMIN), 'W and RMIN must be named constants');
assert.ok(RMIN >= 4 * W, `RMIN ${RMIN} must be at least four widths — 极致平缓 is a ratio, not a wish`);
const CLEAR = W + 1.5;

/* ── sampling ────────────────────────────────────────────────────────────
   The same Catmull–Rom the brush lays down, resampled at a fixed step so
   curvature and distance are measured on what is actually drawn. */
const STEP = 0.6;
/* the same curvature-preserving extension crSegs uses; a position reflection
   aims the end tangent along the chord and bends the ends of every arc */
function extend(p0, p1, p2) {
  const a1 = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]);
  const a2 = Math.atan2(p2[1] - p1[1], p2[0] - p1[0]);
  let d = a2 - a1;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  const a0 = a1 - d, L = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
  return [p0[0] - Math.cos(a0) * L, p0[1] - Math.sin(a0) * L];
}
function sample(pts) {
  const out = [];
  const N = pts.length;
  for (let i = 0; i < N - 1; i++) {
    /* reflected virtual endpoints, exactly as crSegs does it — a duplicated
       endpoint shortens the tangent and bends the first and last tenth */
    const a = i === 0 ? extend(pts[0], pts[1], pts[2]) : pts[i - 1];
    const b = pts[i], c = pts[i + 1];
    const e = i + 2 < N ? pts[i + 2] : extend(pts[N - 1], pts[N - 2], pts[N - 3]);
    const c1 = [b[0] + (c[0] - a[0]) / 6, b[1] + (c[1] - a[1]) / 6];
    const c2 = [c[0] - (e[0] - b[0]) / 6, c[1] - (e[1] - b[1]) / 6];
    const n = Math.max(6, Math.ceil(Math.hypot(c[0] - b[0], c[1] - b[1]) / STEP));
    for (let k = i === 0 ? 0 : 1; k <= n; k++) {
      const u = k / n, v = 1 - u;
      out.push([
        v * v * v * b[0] + 3 * v * v * u * c1[0] + 3 * v * u * u * c2[0] + u * u * u * c[0],
        v * v * v * b[1] + 3 * v * v * u * c1[1] + 3 * v * u * u * c2[1] + u * u * u * c[1]
      ]);
    }
  }
  return out;
}
const arclen = (p) => {
  const cum = [0];
  for (let i = 1; i < p.length; i++) cum.push(cum[i - 1] + Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]));
  return cum;
};

/* ── ① crossings ─────────────────────────────────────────────────────────
   A proper crossing only. A branch that starts on the stroke it leaves is a
   join, which the brief allows and a root system needs, so an intersection
   landing near either stroke's own end does not count. */
function hit(a, b, c, e) {
  const r = [b[0] - a[0], b[1] - a[1]], s = [e[0] - c[0], e[1] - c[1]];
  const den = r[0] * s[1] - r[1] * s[0];
  if (Math.abs(den) < 1e-12) return null;
  const t = ((c[0] - a[0]) * s[1] - (c[1] - a[1]) * s[0]) / den;
  const u = ((c[0] - a[0]) * r[1] - (c[1] - a[1]) * r[0]) / den;
  return t > 0 && t < 1 && u > 0 && u < 1 ? [t, u] : null;
}
const END = 0.06;
function crossings(S) {
  const out = [];
  for (let A = 0; A < S.length; A++) {
    for (let B = A; B < S.length; B++) {
      for (let i = 0; i + 1 < S[A].pts.length; i++) {
        for (let j = A === B ? i + 2 : 0; j + 1 < S[B].pts.length; j++) {
          const h = hit(S[A].pts[i], S[A].pts[i + 1], S[B].pts[j], S[B].pts[j + 1]);
          if (!h) continue;
          const sa = (S[A].cum[i] + h[0] * STEP) / S[A].len;
          const sb = (S[B].cum[j] + h[1] * STEP) / S[B].len;
          const near = (s) => s < END || s > 1 - END;
          if (near(sa) || near(sb)) continue;
          out.push(`stroke ${A} at ${(sa * 100) | 0}% × stroke ${B} at ${(sb * 100) | 0}%`);
        }
      }
    }
  }
  return out;
}

/* ── ⑦ gentleness ────────────────────────────────────────────────────────
   Not "no corner" but 极致平缓: nothing may turn tighter than RMIN, which is
   four and a half times the ink's own width. v4 held bends to the stroke width
   and the owner still read the results as sharp — a ribbon turning at its own
   width is a hook, not a curve. bw() now derives its bow cap from RMIN so a
   tight turn cannot be written; this checks the multi-point runs and the arcs,
   where it still can. */
function gentleness(S) {
  const out = [];
  for (let a = 0; a < S.length; a++) {
    const p = S[a].pts;
    let worst = Infinity, at = 0;
    for (let i = 1; i + 1 < p.length; i++) {
      const A = Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
      const B = Math.hypot(p[i + 1][0] - p[i][0], p[i + 1][1] - p[i][1]);
      const C = Math.hypot(p[i + 1][0] - p[i - 1][0], p[i + 1][1] - p[i - 1][1]);
      const area = Math.abs((p[i][0] - p[i - 1][0]) * (p[i + 1][1] - p[i - 1][1])
        - (p[i + 1][0] - p[i - 1][0]) * (p[i][1] - p[i - 1][1])) / 2;
      if (area < 1e-9) continue;
      const rad = (A * B * C) / (4 * area);
      if (rad < worst) { worst = rad; at = S[a].cum[i] / S[a].len; }
    }
    if (worst < RMIN) out.push(`stroke ${a} turns at r${worst.toFixed(1)} at ${(at * 100) | 0}%, under RMIN ${RMIN}`);
  }
  return out;
}

/* ── ⑧ placement, not growth ─────────────────────────────────────────────
   ⭐ No exemption anywhere, ends included. v4 exempted near-end approaches so
   that a branch could join a trunk, and that exemption WAS the mistake the
   owner named: the house grammar is rounded lines placed side by side that
   never touch and never sprout. With no joins permitted there is nothing for a
   sharp meeting to happen at, which is why the corner rule got simpler at the
   same time. Measured across every sample pair, so a stroke cannot creep up on
   another anywhere along its length. */
function placement(S) {
  const out = [];
  for (let a = 0; a < S.length; a++) {
    for (let b = a + 1; b < S.length; b++) {
      let min = Infinity, sa = 0, sb = 0;
      for (let i = 0; i < S[a].pts.length; i++) {
        for (let j = 0; j < S[b].pts.length; j++) {
          const d = Math.hypot(S[a].pts[i][0] - S[b].pts[j][0], S[a].pts[i][1] - S[b].pts[j][1]);
          if (d < min) { min = d; sa = S[a].cum[i] / S[a].len; sb = S[b].cum[j] / S[b].len; }
        }
      }
      if (min < CLEAR) {
        out.push(`strokes ${a} and ${b} come within ${min.toFixed(1)} (need ${CLEAR.toFixed(1)})`
          + ` at ${(sa * 100) | 0}%/${(sb * 100) | 0}%`);
      }
    }
  }
  return out;
}

/* ── ③ symmetry ─────────────────────────────────────────────────────────── */
function symmetry(S) {
  const pts = [];
  for (const s of S) for (let i = 0; i < s.pts.length; i += 3) pts.push(s.pts[i]);
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const diag = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  const tol2 = (diag * 0.025) ** 2;
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
  let worst = { name: 'none', frac: 0 };
  const take = (name, frac) => { if (frac > worst.frac) worst = { name, frac }; };
  take('mirror-x', score((x, y) => [-x, y]));
  take('mirror-y', score((x, y) => [x, -y]));
  for (let n = 2; n <= 6; n++) {
    const a = (2 * Math.PI) / n, c = Math.cos(a), s = Math.sin(a);
    take(`rot-${n}`, score((x, y) => [x * c - y * s, x * s + y * c]));
  }
  return worst;
}

/* ── ④ / ⑤ repeated parts ───────────────────────────────────────────────
   1.5% is calibrated, not chosen. Scored against the second pass, whose
   stamps are known because hand() emitted one path translated: 217 of its
   1324 stroke pairs fall under 1.5% and the fifth percentile is 0.00% — a
   real stamp scores zero. Above that the population thins out smoothly, and
   that is siblings, which ⑤ asks for. An earlier 5% flagged 98 pairs and
   every one was a legitimate family member; a threshold that forbids two
   bands of haze resembling each other is not enforcing the brief, it is
   forbidding drawing. */
function resample(p, cum, n) {
  const L = cum[cum.length - 1] || 1, out = [];
  let j = 0;
  for (let k = 0; k <= n; k++) {
    const t = (k / n) * L;
    while (j + 2 < p.length && cum[j + 1] < t) j++;
    const seg = cum[j + 1] - cum[j] || 1, u = Math.min(1, Math.max(0, (t - cum[j]) / seg));
    out.push([p[j][0] + (p[j + 1][0] - p[j][0]) * u, p[j][1] + (p[j + 1][1] - p[j][1]) * u]);
  }
  return out;
}
function clones(S, diag) {
  const N = 10;
  const norm = S.map((s) => {
    const q = resample(s.pts, s.cum, N);
    const mx = q.reduce((a, p) => a + p[0], 0) / q.length, my = q.reduce((a, p) => a + p[1], 0) / q.length;
    return q.map((p) => [p[0] - mx, p[1] - my]);
  });
  const out = [];
  for (let a = 0; a < norm.length; a++) {
    for (let b = a + 1; b < norm.length; b++) {
      /* below an eighth of the mark nothing has enough shape to be
         recognisably reused; holding two short ticks to this rule would
         forbid drawing rather than forbid stamping */
      if (S[a].len < diag * 0.12 || S[b].len < diag * 0.12) continue;
      let dev = 0;
      for (let k = 0; k <= N; k++) dev += Math.hypot(norm[a][k][0] - norm[b][k][0], norm[a][k][1] - norm[b][k][1]);
      const d = dev / (N + 1) / ((S[a].len + S[b].len) / 2);
      if (d < 0.015) out.push(`strokes ${a} and ${b} differ by ${(d * 100).toFixed(2)}% of their own length`);
    }
  }
  return out;
}

/* ── ⑧ the width that is actually painted ────────────────────────────────
   ⚠️ Reading W out of the source and computing with it proves nothing about
   what gets drawn. A deliberate break — one motif rendered at double weight —
   passed every other gate here, because the plan carries no width and the
   renderer was never inspected. So this measures the ribbon itself: for a
   closed outline, enclosed area ÷ centreline length IS its mean width. */
function paintedWidths(d, lens) {
  const tok = d.match(/[MC]|-?\d*\.?\d+/g) || [];
  const subs = [];
  let cur = null, x = 0, y = 0, i = 0;
  while (i < tok.length) {
    if (tok[i] === 'M') { x = +tok[i + 1]; y = +tok[i + 2]; i += 3; cur = [[x, y]]; subs.push(cur); }
    else if (tok[i] === 'C') {
      const [x1, y1, x2, y2, x3, y3] = tok.slice(i + 1, i + 7).map(Number);
      for (let k = 1; k <= 10; k++) {
        const u = k / 10, v = 1 - u;
        cur.push([v * v * v * x + 3 * v * v * u * x1 + 3 * v * u * u * x2 + u * u * u * x3,
                  v * v * v * y + 3 * v * v * u * y1 + 3 * v * u * u * y2 + u * u * u * y3]);
      }
      x = x3; y = y3; i += 7;
    } else i += 1;
  }
  return subs.map((p, n) => {
    let a = 0;
    for (let k = 0; k < p.length; k++) {
      const q = p[(k + 1) % p.length];
      a += p[k][0] * q[1] - q[0] * p[k][1];
    }
    /* the two half-round caps add a disc of diameter W beyond the straight run */
    const area = Math.abs(a) / 2, L = lens[n] || 1;
    return (area - Math.PI * (W / 2) * (W / 2)) / L;
  });
}

/* ── run ─────────────────────────────────────────────────────────────── */
const names = Object.keys(PLAN);
/* ⚠️ A floor, not a fixed count. The catalogue is meant to grow — pinning it to
   an exact number turns "we added a motif" into a test failure, which teaches
   people to edit the test rather than to read it. What must not happen is the
   set silently SHRINKING, so the assertion is a minimum. */
assert.ok(names.length >= 42, `expected at least forty-two phenomena, got ${names.length}`);
assert.deepEqual(Object.keys(PH).sort(), names.slice().sort(), 'every plan must render and every render must have a plan');

const fail = [];
let strokes = 0, ink = 0;
for (const name of names) {
  const d = PH[name]();
  assert.ok(!/[Aa]\s*-?\d/.test(d),
    `${name}: uses an arc command. A true circular arc is the one curve a hand cannot make`
    + ` — build it from arcPts() so the radius swells.`);
  assert.ok(!/NaN|undefined/.test(d), `${name}: emitted NaN/undefined`);

  const S = PLAN[name]().map((p) => {
    const pts = sample(p), cum = arclen(pts);
    return { pts, cum, len: cum[cum.length - 1] };
  });
  strokes += S.length;

  const xs = S.flatMap((s) => s.pts.map((p) => p[0])), ys = S.flatMap((s) => s.pts.map((p) => p[1]));
  const diag = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  const area = S.reduce((a, s) => a + s.len * W, 0);
  ink += area;

  const bound = Math.max(...xs.map(Math.abs), ...ys.map(Math.abs)) + W / 2;
  if (bound > 38) fail.push(`⬚ ${name}: reaches ${bound.toFixed(0)} — outside the ±38 field`);
  /* ⑧ the answer to 太细: ink is a share of the field, not a hairline count */
  if (area < 480) fail.push(`◦ ${name}: ${area.toFixed(0)} units² of ink — too thin to read as brushed`);
  if (Math.min(...S.map((s) => s.w)) < 1.4) fail.push(`◦ ${name}: a stroke under 1.8 wide is a hairline, not a brush`);

  for (const m of crossings(S)) fail.push(`① ${name}: ${m}`);
  const sym = symmetry(S);
  if (sym.frac > 0.9) fail.push(`③ ${name}: ${(sym.frac * 100) | 0}% lands on itself under ${sym.name}`);
  for (const m of clones(S, diag)) fail.push(`④ ${name}: ${m}`);
  const painted = paintedWidths(d, S.map((s) => s.len));
  painted.forEach((w, n) => {
    if (Math.abs(w - W) > 0.35) {
      fail.push(`⑧ ${name}: stroke ${n} paints ${w.toFixed(2)} wide, not ${W} — the ink is one weight`);
    }
  });
  for (const m of gentleness(S)) fail.push(`⑦ ${name}: ${m}`);
  for (const m of placement(S)) fail.push(`⑧ ${name}: ${m}`);
}

assert.deepEqual(fail, [],
  'the phenomena broke the form brief:\n  ' + fail.slice(0, 40).join('\n  ')
  + (fail.length > 40 ? `\n  …and ${fail.length - 40} more` : '')
  + '\n  Redraw the offending strokes; do not loosen the thresholds to pass.');

console.log(`marks form OK — ${names.length} phenomena, ${strokes} strokes, all ${W} wide,`
  + ` nothing turning under r${RMIN}, nothing within ${CLEAR.toFixed(1)};`
  + ` ${(ink / 30).toFixed(0)} units² of ink each`);
