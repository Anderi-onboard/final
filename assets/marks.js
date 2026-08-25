/* BourneWise · generated 2D marks.
   One place that draws every geometric asset on the editorial routes, in the
   same language as the animated range: rounded contour ridges, single-weight
   line, no fill. Everything is parametric, so it is sharp at any size and any
   DPI and takes colour through currentColor.

   Nothing here is traced and nothing is a raster. That matters twice over:
   the marks stay crisp where a 112px webp went soft, and they follow the
   rotating palette instead of baking one colour into a file. */
(function () {
  "use strict";
  var root = (typeof window !== "undefined") ? window : globalThis;
  var R = function (n) { return Math.round(n * 10) / 10; };

  /* Deterministic noise. Every mark takes a seed so a given block of the site
     draws the same shape on every visit — a landscape that reshuffles on each
     navigation reads as a glitch, not as artwork. */
  function rng(seed) {
    var s = seed >>> 0 || 1;
    return function () { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; };
  }

  /* ── smooth periodic curves ─────────────────────────────────────────────
     A sine sampled every N pixels and joined with L commands is a polyline,
     and at any stroke weight above a hairline the facets read as a wobble —
     that is what made the first pattern pass look coarse. One quadratic per
     half period is exact enough that no facet exists at any zoom: a quadratic
     reaches half its control offset at the midpoint, so a control at 2A puts
     the peak at exactly A. */
  function sineV(x, y0, y1, amp, period) {
    var d = "M" + R(x) + " " + R(y0), half = period / 2, dir = 1;
    for (var y = y0; y < y1; y += half) {
      var yn = Math.min(y + half, y1);
      d += " Q" + R(x + dir * amp * 2) + " " + R((y + yn) / 2) + " " + R(x) + " " + R(yn);
      dir = -dir;
    }
    return d;
  }

  /* ── the range's own vocabulary ─────────────────────────────────────────
     A ridge is a run of cubic segments with rounded shoulders — the same
     construction the background uses, so a still block cut from it belongs to
     the same drawing as the moving one behind it. */
  function ridgePath(seed, w, h, opts) {
    opts = opts || {};
    var r = rng(seed), steps = opts.steps || 7, amp = opts.amp == null ? .5 : opts.amp;
    var base = h * (opts.base == null ? .62 : opts.base);
    var d = "M0 " + R(base), x = 0, prev = base;
    for (var i = 0; i < steps; i++) {
      var nx = w * ((i + 1) / steps);
      var ny = base - h * amp * (.25 + r() * .75);
      var c1 = x + (nx - x) * .42, c2 = x + (nx - x) * .58;
      d += " C" + R(c1) + " " + R(prev) + " " + R(c2) + " " + R(ny) + " " + R(nx) + " " + R(ny);
      x = nx; prev = ny;
    }
    return d;
  }

  /* A landscape block: several ridges at decreasing height with their own
     contour lines, closed to the floor. This is what stands in for a
     photograph on the editorial routes — a drawing of the same country the
     background is drawing, rather than a grey rectangle or a stock image. */
  function landscape(seed, w, h, opts) {
    opts = opts || {};
    /* `fill` scales only the filled masses, never the contours. In a short wide
       band every layer's fill reaches the bottom edge, so the masses stack over
       almost the whole cell and the ground colour stops showing — the plate
       goes pale and loses the duotone. Thinning the masses there leaves the
       contours, which are what carries the band at that height anyway. */
    var layers = opts.layers || 4, fo = opts.fill == null ? 1 : opts.fill,
        out = "", uid = "lsc" + seed;
    out += '<clipPath id="' + uid + '"><rect width="' + w + '" height="' + h + '"/></clipPath>';
    out += '<g clip-path="url(#' + uid + ')">';
    for (var i = 0; i < layers; i++) {
      var t = i / (layers - 1 || 1);
      var top = ridgePath(seed + i * 977, w, h, { steps: 5 + i, amp: .34 - t * .16, base: .40 + t * .30 });
      /* Read as a duotone plate: light ink on a coloured ground, the same way
         round as every pattern field. The old values (7–14% fill, ink on
         cream) put the range at the bottom of the tonal range on the lightest
         block on the page — technically an image, visually a smudge. */
      out += '<path d="' + top + ' L' + w + ' ' + h + ' L0 ' + h + ' Z" fill="currentColor" opacity="'
        + ((0.11 + t * 0.10) * fo).toFixed(3) + '"/>';
      out += '<path d="' + top + '" fill="none" stroke="currentColor" stroke-width="'
        + (3.7 - t * 0.65).toFixed(2) + '" opacity="'
        + (0.7 - t * 0.12).toFixed(2) + '" stroke-linecap="round"/>';
      /* contour lines below each crest, thinning with distance — the range's
         own device for reading depth without shading */
      for (var k = 1; k <= 2 + i; k++) {
        out += '<path d="' + top + '" fill="none" stroke="currentColor" stroke-width="'
          + (2.5 - t * 0.55).toFixed(2) + '" opacity="' + (0.3 - t * 0.06).toFixed(2)
          + '" transform="translate(0 ' + R(k * (7 + i * 2)) + ')"/>';
      }
    }
    out += '</g>';
    return out;
  }

  /* ── the BourneWise brush ───────────────────────────────────────────────
     Extracted from barPath() in casting-figure.js, which is where the hand
     drawn quality on the Sortis figure actually comes from. The rule is not
     "add noise" — it is five specific things, and the fourth is the one that
     matters most:

       1. A bar is not a rectangle. Its two long edges are single cubic S
          curves: the control points pull one way at 1/3 and the other way at
          2/3, so each edge rises then dips once. One inflection, not many.
       2. The two edges are not mirror images. The far edge runs at 0.78 of
          the near edge's amplitude, so the shape is never symmetrical and
          never reads as a machined slab.
       3. Amplitude is about 12–17% of the short dimension. Below that it
          looks like a printing error; above it, like a banana.
       4. The variation is DETERMINISTIC AND CYCLIC, not random — the source
          steps amplitude on (index mod 3), so neighbours never match but the
          same element always draws identically. Random jitter per instance
          would flicker on every re-render and reshuffle on every navigation,
          which reads as a fault rather than as a hand.
       5. The shape is filled AND stroked in its own colour at ~4% of the
          short dimension, with round joins and caps. That last part is what
          turns a vector outline into something that looks laid down with ink:
          the stroke swells the form slightly and rounds every corner.

     Everything drawn on the site should be able to take this brush, so it
     lives here rather than staying inside the casting figure. */
  function brushRect(x, y, w, h, i) {
    var a = 1.45 + (Math.abs(i || 0) % 3) * .28;   /* the 3-cycle, see (4) */
    a = a * (h / 12);                               /* amplitude scales with weight */
    var b = a * .78, t = w / 3, x2 = x + w, y2 = y + h;
    return "M " + R(x) + " " + R(y)
      + " C " + R(x + t) + " " + R(y - a) + " " + R(x + 2 * t) + " " + R(y + a) + " " + R(x2) + " " + R(y)
      + " L " + R(x2) + " " + R(y2)
      + " C " + R(x + 2 * t) + " " + R(y2 + b) + " " + R(x + t) + " " + R(y2 - a) + " " + R(x) + " " + R(y2) + " Z";
  }
  /* The attributes that go with the brush. Kept beside the geometry so a
     caller cannot take the shape and forget the stroke that makes it ink. */
  function brushAttrs(h) {
    return 'fill="currentColor" stroke="currentColor" stroke-width="' + R(Math.max(.35, h * .042))
      + '" stroke-linejoin="round" stroke-linecap="round"';
  }

  /* ── flat-field patterns ────────────────────────────────────────────────
     Each is one motif on a strict pitch. Ratios, not absolute sizes, carry
     the character, so every function takes its proportions as parameters. */
  /* w is the leaf's actual width. A quadratic only reaches HALF its control
     offset at the midpoint, so the control has to sit at w, not w/2 — putting
     it at w/2 drew every leaf at half its nominal width, which is why the
     1:3.4 ratio cap in blocks.js was really producing 1:6.8 needles. The ratio
     is the motif; halving one side of it changes what the motif is. */
  var vesica = function (w, h) {
    return "M0 " + R(-h / 2) + " Q" + R(w) + " 0 0 " + R(h / 2) + " Q" + R(-w) + " 0 0 " + R(-h / 2) + " Z";
  };

  function vesicaRow(w, h, o) {
    o = o || {}; var pitch = o.pitch || 46, vw = o.vw || 26, vh = o.vh || 90, s = "";
    for (var x = pitch / 2; x < w + pitch; x += pitch)
      s += '<path d="' + vesica(vw, vh) + '" transform="translate(' + R(x) + ' ' + R(h / 2) + ')"/>';
    return s;
  }

  function splitDisc(r, gapFrac) {
    var g = r * 2 * (gapFrac == null ? .06 : gapFrac) / 2;
    return "M" + R(-g) + " " + R(-r) + " A" + r + " " + r + " 0 0 0 " + R(-g) + " " + R(r) + " Z"
         + " M" + R(g) + " " + R(-r) + " A" + r + " " + r + " 0 0 1 " + R(g) + " " + R(r) + " Z";
  }

  function scallop(w, h, o) {
    o = o || {}; var pitch = o.pitch || 40, d = "", row = 0;
    for (var y = 0; y <= h + pitch; y += pitch * .6, row++) {
      var off = row % 2 ? pitch / 2 : 0;
      for (var x = -pitch; x <= w + pitch; x += pitch)
        d += "M" + R(x + off) + " " + R(y) + " A" + pitch / 2 + " " + pitch / 2 + " 0 0 1 " + R(x + off + pitch) + " " + R(y) + " ";
    }
    return d;
  }

  function waveField(w, h, o) {
    o = o || {}; var pitch = o.pitch || 24, amp = (o.amp == null ? .22 : o.amp) * pitch, d = "";
    for (var x = pitch / 2; x < w + pitch; x += pitch) d += sineV(x, -pitch, h + pitch, amp, pitch * 3.2) + " ";
    return d;
  }

  function tally(w, h, o) {
    o = o || {}; var pitch = o.pitch || 14, lean = o.lean || 4, d = "", row = 0;
    for (var y = 0; y < h + pitch; y += pitch * 1.1, row++) {
      var off = row % 2 ? pitch / 2 : 0;
      for (var x = off - pitch; x < w + pitch; x += pitch)
        d += "M" + R(x) + " " + R(y) + " L" + R(x + lean) + " " + R(y + pitch * .7) + " ";
    }
    return d;
  }

  /* Petals are pushed out along their own axis by `hole` rather than all
     meeting at the centre. Meeting at the centre is what turns a rosette into
     a starburst: the overlapping inner thirds fuse into a solid disc, and the
     only thing left reading as shape is the eight points sticking out of it.
     Holding the tips off the centre leaves the eye a ring to read instead. */
  function florette(o) {
    o = o || {}; var n = o.n || 8, w = o.w || 26, h = o.h || 48,
        hole = o.hole == null ? 8 : o.hole, s = "";
    for (var i = 0; i < n; i++)
      s += '<path d="' + vesica(w, h) + '" transform="rotate(' + R(i * 360 / n)
         + ') translate(0 ' + R(-(hole + h / 2)) + ')"/>';
    return s;
  }

  /* ── the logomark ───────────────────────────────────────────────────────
     Five stacked wave strokes — the same ridge language as the animated range,
     which is why the background and the brand read as one thing. Copied here
     from the page headers so there is ONE definition: it was inlined in seven
     HTML files and absent from every generated mark, so the block routes were
     wearing a generic dot ring instead of the brand.

     Native box is 512x416 with a 40-unit stroke; scaling the whole group keeps
     the logo's own weight-to-size ratio at any tile size, which is the same
     rule the pattern fields follow — weight is a fraction of the motif, never
     a loose number. */
  var BRAND_D = [
    "M-40.96-1327.31c30.72-20.48,61.44,20.48,92.16,0,30.72-20.48,71.68,20.48,102.4,0",
    "M-122.88-1245.39c51.2,30.72,102.4-30.72,143.36,0,40.96,30.72,102.4-30.72,153.6,0",
    "M-215.04-1163.47c81.92-61.44,163.84,40.96,235.52,0,71.68-40.96,153.6,51.2,235.52,0",
    "M-143.36-1081.55c51.2,30.72,112.64-20.48,163.84,0,51.2,20.48,112.64-30.72,153.6,0",
    "M-102.4-1009.87c30.72-10.24,61.44,20.48,92.16,0s71.68,10.24,102.4,0"
  ];
  function brandMark(o) {
    o = o || {};
    var k = (o.size || 512) / 512;
    return '<g transform="scale(' + R(k) + ') translate(240 1380)" fill="none" '
      + 'stroke="currentColor" stroke-width="40" stroke-linecap="round">'
      + BRAND_D.map(function (d) { return '<path d="' + d + '"/>'; }).join("") + '</g>';
  }
  /* The logomark as a repeating field. Rows offset by half a pitch so the
     stack reads as a weave rather than as a column of copies. */
  function brandField(w, h, o) {
    o = o || {}; var pitch = o.pitch || 150, k = pitch / 512, s = "", row = 0;
    var step = 416 * k * (o.rowGap == null ? .92 : o.rowGap);
    for (var y = -step; y < h + step; y += step, row++) {
      var off = row % 2 ? pitch / 2 : 0;
      for (var x = -pitch + off; x < w + pitch; x += pitch) {
        s += '<g transform="translate(' + R(x) + ' ' + R(y) + ')">' + brandMark({ size: pitch }) + '</g>';
      }
    }
    return s;
  }

  /* The yao rows themselves as a field: solid and broken bars on a strict
     grid, drawn with the brush so they are the same object as the figure on
     the reading page rather than a lookalike. */
  function yaoField(w, h, o) {
    o = o || {}; var bw = o.bw || 74, t = o.t || 9, gap = o.gap || 8, s = "", row = 0;
    var stepY = t + gap, stepX = bw + gap * 2;
    var at = brushAttrs(t);
    for (var y = 0; y < h + stepY; y += stepY, row++) {
      for (var x = (row % 2 ? -stepX / 2 : 0); x < w + stepX; x += stepX) {
        /* deterministic: the pattern of solid and broken repeats on a cycle of
           5 against a row cycle of 2, so it does not visibly tile */
        if ((row * 3 + Math.round(x / stepX)) % 5 < 3) {
          s += '<path ' + at + ' d="' + brushRect(x, y, bw, t, row) + '"/>';
        } else {
          var seg = (bw - bw * .26) / 2;
          s += '<path ' + at + ' d="' + brushRect(x, y, seg, t, row) + '"/>';
          s += '<path ' + at + ' d="' + brushRect(x + bw - seg, y, seg, t, row + 1) + '"/>';
        }
      }
    }
    return s;
  }

  function dotRing(o) {
    o = o || {}; var n = o.n || 12, r = o.r || 9, dot = o.dot || .16, s = "";
    for (var i = 0; i < n; i++) {
      var a = (i / n) * Math.PI * 2 - Math.PI / 2;
      s += '<circle cx="' + R(Math.cos(a) * r) + '" cy="' + R(Math.sin(a) * r) + '" r="' + R(r * dot) + '"/>';
    }
    return s;
  }

  /* The connected-coin motif, kept here so the site has one definition.
     This one is drawn, not filled: the coins overlap by design, so filling
     them unions the discs into a clover and the square holes disappear under
     the neighbour drawn after them. Stroke it. */
  function coin(o) {
    o = o || {}; var pitch = o.pitch || 30, r = pitch * .86, hole = pitch * .2, s = "";
    var c = [[0, 0], [-pitch, 0], [pitch, 0], [0, -pitch], [0, pitch]];
    c.forEach(function (p) {
      s += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="' + R(r) + '"/>';
      s += '<path d="M' + p[0] + ' ' + R(p[1] - hole) + 'L' + R(p[0] + hole) + ' ' + p[1]
         + 'L' + p[0] + ' ' + R(p[1] + hole) + 'L' + R(p[0] - hole) + ' ' + p[1] + 'Z"/>';
    });
    return s;
  }

  /* A hexagram: six lines, yin broken, yang solid — the product's own mark,
     drawn at the same weight as everything else here. */
  /* Six lines, drawn with the brush above rather than as rectangles — this is
     the same figure the casting animation draws, so the mark on a marketing
     page and the mark in the product are one drawing. */
  function hexagram(lines, o) {
    o = o || {}; var w = o.w || 96, gap = o.gap || 5, t = o.t || 7, s = "";
    var at = brushAttrs(t);
    for (var i = 0; i < 6; i++) {
      var y = (5 - i) * (t + gap);
      if (lines[i]) s += '<path ' + at + ' d="' + brushRect(0, y, w, t, i) + '"/>';
      else {
        var seg = (w - w * .22) / 2;
        s += '<path ' + at + ' d="' + brushRect(0, y, seg, t, i) + '"/>';
        s += '<path ' + at + ' d="' + brushRect(w - seg, y, seg, t, i + 1) + '"/>';
      }
    }
    return s;
  }

  function svg(body, vb, attrs) {
    return '<svg viewBox="' + vb + '" ' + (attrs || "") + ' xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' + body + '</svg>';
  }


  /* ── PHENOMENA ──────────────────────────────────────────────────────────
     Thirty things from the same weather as the range, drawn with the same
     brush as the 爻. Fourth pass, and the first three are worth keeping
     because each failed in its own direction:

       v1  clean line art — even spacing, straight rays. An icon set.
       v2  hand() repeated one curve three to six times. Denser, and now all
           thirty came out of one scheme built from copies of one part.
       v3  every stroke drew its own numbers from a seeded stream. That fixed
           the copying and broke something else: 太细,太没有规则 — hairlines
           with no beat to them. **写意 is not randomness.** A hand has a
           rhythm; noise does not. Per-stroke random draws are the one thing
           that cannot produce one.

     So variation here is CYCLIC and deterministic, which is the law already
     written twice in this codebase: the 爻 steps its bow on `index mod 3`, and
     the range runs LINE_WOBBLE (7) against LINE_DRIFT (5) so the pair does not
     come round for 35. Three co-prime cycles carry every stroke — weight on 3,
     bow on 5, reach on 7 — so no two strokes in a mark share a combination
     (105 before it repeats) while each channel keeps a beat the eye can
     follow. Order without repetition. That is the whole answer to 没有规则.

     And every stroke is INK, not a line: a ribbon whose two long edges each
     undulate once, the far edge at 0.78 of the near edge's amplitude so the
     two are never mirrors, amplitude 12–17% of the ribbon's own width on the
     3-cycle, both ends genuinely round. That is barPath() lifted off the
     horizontal — see §笔触 — and it is why nothing below has a corner.

     ⚠️ Geometry lives in PLAN as centrelines plus widths; PH renders it. The
     checker reads the centrelines, because once these are ribbons an outline
     cannot tell a branch joining a trunk from a stroke crossing one.

     tests/marks-form.mjs holds: no crossings, no mirror or rotation, no
     stamped parts, no bend tighter than a stroke's own width, and no two
     strokes closer than their two half-widths — ink that touches is a blot. */

  var TAU = Math.PI * 2, PI = Math.PI;

  /* Weight · bow · reach. Co-prime, so the combination does not come round
     inside any mark; each on its own is a beat. */
  var W_CYC = [1, 0.82, 1.16];
  var B_CYC = [1, -0.58, 0.76, -1.12, 0.42];
  var R_CYC = [1, 0.84, 1.18, 0.9, 1.28, 0.76, 1.08];

  function pt(p) { return R(p[0]) + " " + R(p[1]); }

  /* Catmull–Rom as cubics. A centreline given as points is carried THROUGH
     them, which is how a summit or a bend arrives without a corner — the
     third pass met two straights at the apex and got exactly the 棱角 this
     rules out. */
  function crSegs(p) {
    var segs = [], i;
    for (i = 0; i < p.length - 1; i++) {
      var a = p[i === 0 ? 0 : i - 1], b = p[i], c = p[i + 1], e = p[i + 2] || c;
      segs.push([b,
        [b[0] + (c[0] - a[0]) / 6, b[1] + (c[1] - a[1]) / 6],
        [c[0] - (e[0] - b[0]) / 6, c[1] - (e[1] - b[1]) / 6],
        c]);
    }
    return segs;
  }

  /* One brush stroke. `k` steps the 3-cycle; the two edges take different
     amplitudes AND different phase, so the ribbon is never symmetric about its
     own centreline. Ends are half-round in the geometry rather than left to
     stroke-linecap: at these widths a 4% stroke rounds nothing. */
  function brush(pts, w, k) {
    var segs = crSegs(pts), m = segs.length, i, j;
    var a = w * (0.121 + (Math.abs(k || 0) % 3) * 0.0233), b = a * 0.78, half = w / 2;
    var dN = [], dF = [];
    for (i = 0; i <= m; i++) {
      var t = m ? i / m : 0;
      dN.push(half + a * Math.sin(TAU * t));
      dF.push(half + b * Math.sin(TAU * t + 2.4));
    }
    function nrm(s, end) {
      var p0 = end ? s[2] : s[0], p1 = end ? s[3] : s[1];
      var dx = p1[0] - p0[0], dy = p1[1] - p0[1], L = Math.sqrt(dx * dx + dy * dy) || 1;
      return [-dy / L, dx / L];
    }
    function off(p, n, d) { return [p[0] + n[0] * d, p[1] + n[1] * d]; }

    var near = [], far = [];
    for (i = 0; i < m; i++) {
      var s = segs[i], n0 = nrm(s, 0), n1 = nrm(s, 1);
      near.push([off(s[0], n0, dN[i]), off(s[1], n0, dN[i]), off(s[2], n1, dN[i + 1]), off(s[3], n1, dN[i + 1])]);
      far.push([off(s[0], n0, -dF[i]), off(s[1], n0, -dF[i]), off(s[2], n1, -dF[i + 1]), off(s[3], n1, -dF[i + 1])]);
    }
    /* the two caps, each a half-round pushed out along the stroke's own axis */
    var t0 = nrm(segs[0], 0), t1 = nrm(segs[m - 1], 1);
    var u0 = [t0[1], -t0[0]], u1 = [-t1[1], t1[0]], cap = w * 0.67;

    var d = "M" + pt(near[0][0]);
    for (i = 0; i < m; i++) d += " C" + pt(near[i][1]) + " " + pt(near[i][2]) + " " + pt(near[i][3]);
    d += " C" + pt(off(near[m - 1][3], u1, cap)) + " " + pt(off(far[m - 1][3], u1, cap)) + " " + pt(far[m - 1][3]);
    for (j = m - 1; j >= 0; j--) d += " C" + pt(far[j][2]) + " " + pt(far[j][1]) + " " + pt(far[j][0]);
    return d + " C" + pt(off(far[0][0], u0, cap)) + " " + pt(off(near[0][0], u0, cap)) + " " + pt(near[0][0]) + " Z ";
  }

  /* An arc that swells at its middle — round, never circular, and without a
     random number anywhere. `swell` is the rule that replaces the wobble. */
  function arcPts(cx, cy, rad, a0, a1, n, swell, squash) {
    var out = [], i, q = squash == null ? 1 : squash;
    for (i = 0; i <= n; i++) {
      var t = i / n, ang = a0 + (a1 - a0) * t, rr = rad * (1 + (swell || 0) * Math.sin(PI * t));
      out.push([cx + rr * Math.cos(ang), cy + rr * q * Math.sin(ang)]);
    }
    return out;
  }

  /* Two points and a belly, carried on a sine through five stations rather
     than bent at a middle one. Three points put every degree of the turn at
     the apex, and a bend tighter than the stroke is wide is exactly the 棱角
     the brief rules out — the checker caught it on nine marks at once. The bow
     is a stated quantity, never an accident. */
  function bowPts(x0, y0, x1, y1, bow, n) {
    var dx = x1 - x0, dy = y1 - y0, L = Math.sqrt(dx * dx + dy * dy) || 1;
    var nx = -dy / L, ny = dx / L, out = [], i;
    n = n || 4;
    for (i = 0; i <= n; i++) {
      var t = i / n, s = Math.sin(PI * t) * bow;
      out.push([x0 + dx * t + nx * s, y0 + dy * t + ny * s]);
    }
    return out;
  }

  /* A belly stated as a fraction of the run, capped at 8%: a sine bow of
     fraction f turns at radius L/(pi^2 * f), so 8% keeps every stroke's radius
     above 1.2 of its own length and no bow can ever be tighter than the ink is
     wide. An absolute bow cannot promise that — on 星's shortest arms the same
     number that read as a gentle belly on a long stroke folded a short one. */
  function bw(x0, y0, x1, y1, frac, n) {
    var L = Math.sqrt((x1 - x0) * (x1 - x0) + (y1 - y0) * (y1 - y0));
    return bowPts(x0, y0, x1, y1, Math.max(-0.08, Math.min(0.08, frac)) * L, n);
  }

  /* A ray leaving a hub. The hole is the larger of a share of the radius and a
     multiple of the ink, so arms on a small flake open far enough apart not to
     merge — what converges at a centre fuses into a disc, which is the
     florette's lesson and was 雪's smallest flake. */
  function ray(cx, cy, ang, r0, reach, frac, w) {
    var hole = Math.max(r0, (w || 0) * 1.4), tip = hole + reach;
    return bw(cx + Math.cos(ang) * hole, cy + Math.sin(ang) * hole,
      cx + Math.cos(ang) * tip, cy + Math.sin(ang) * tip, frac);
  }

  function S(p, w, k) { return { p: p, w: w, k: k }; }

  var PLAN = {};

  /* 1 日 — a broken body, and light that leans rather than radiating. The
     opening in the ring is at the lower left and every answer is on the other
     flank, which is what keeps a sun off the compass rose. */
  PLAN.sun = function () {
    return [
      S(arcPts(0, 0, 17.5, -2.35, 2.55, 8, 0.07), 5, 0),
      S(arcPts(0.5, -0.5, 24, -0.98, 0.16, 4, 0.05), 3.6, 1),
      S(arcPts(1, -1, 29.5, -0.54, 0.76, 4, 0.05), 2.8, 2),
      S(arcPts(-2, 1, 31, 2.34, 3.36, 4, 0.06), 4, 1)
    ];
  };

  /* 2 月 — the shadow runs the length of the disc as one gesture and stops
     inside it. Meeting the rim at the horns makes a point, and a point is the
     ⑦ the brief rules out; a crescent that keeps its shadow inside stays round
     everywhere. The outer answers sit on one flank only. */
  PLAN.moon = function () {
    return [
      S(arcPts(0, 0, 19.5, -1.5, 1.55, 8, 0.05), 5, 0),
      S(bowPts(5.5, -16.5, 4.5, 17, -8), 3.8, 1),
      S(arcPts(0.5, 0, 26, -1, 0.42, 4, 0.05), 3.2, 2),
      S(arcPts(1, -1, 31, -0.62, 0.86, 5, 0.04), 2.6, 0)
    ];
  };

  /* 3 瀑 — four falls of graded reach; none of them arrives, which is what
     puts the drop out of sight. The basin is two shallows seen flat. */
  PLAN.waterfall = function () {
    var x = [-15, -7, 1, 9], top = [-32, -29, -33, -27], bot = [4, 10, 6, 1], i, out = [];
    for (i = 0; i < 4; i++) {
      out.push(S(bowPts(x[i], top[i], x[i] + B_CYC[i] * 2.4, bot[i], B_CYC[i] * 2.6, 4 + i),
        4.4 * W_CYC[i % 3], i));
    }
    out.push(S(arcPts(-3, 15, 12, 0.3, PI - 0.42, 4, 0.09, 0.62), 3.4, 1));
    out.push(S(arcPts(-1, 17, 19.5, 0.24, PI - 0.22, 5, 0.06, 0.55), 2.8, 2));
    return out;
  };

  /* 4 岚 — mountain vapour. Bands that begin and end where they begin and end:
     reach on the 7-cycle, belly on the 5-cycle, so the stack opens and closes
     down its height without any two bands ever agreeing. */
  PLAN.haze = function () {
    var x0 = [-30, -22, -31, -18, -26], x1 = [6, 20, -2, 26, 14], i, out = [];
    for (i = 0; i < 5; i++) {
      out.push(S(bowPts(x0[i], -22 + i * 10, x1[i], -22 + i * 10 + B_CYC[i] * 1.6, B_CYC[i] * 2.4, 4 + (i % 3)),
        4.6 * W_CYC[i % 3], i));
    }
    return out;
  };

  /* 5 雨 — one shallow sky well off centre, and rain of unequal length raked
     one way. Identical ticks under a symmetric cloud is the pictogram. */
  PLAN.rain = function () {
    var out = [S(arcPts(-5, -24, 21, 0.42, PI - 0.72, 5, 0.06, 0.6), 4.6, 0)], i;
    var y0 = [0, -3, 1, -2, 2, -1], len = [22, 15, 26, 18, 24, 13];
    for (i = 0; i < 6; i++) {
      out.push(S(bowPts(-26 + i * 8, y0[i], -31 + i * 8, y0[i] + len[i], B_CYC[i % 5] * 1.4, 3 + (i % 3)),
        3.9 * W_CYC[i % 3], i));
    }
    return out;
  };

  /* 6 雪 — a drift, not a crystal. Five flakes at five sizes, three arms each
     on bearings off the 7-cycle, around a hole so the arms never meet: what
     converges at a centre fuses into a disc, which is the florette's lesson.
     Six-fold anything is ruled out twice, by ③ and by ⑥. */
  PLAN.snow = function () {
    var F = [[-19, -18, 10, 0.3], [9, -25, 7.5, 2.1], [20, -5, 10.5, 4.4], [-7, 3, 8.5, 1.2], [-26, 8, 6, 3.3]];
    var out = [], i, j;
    for (i = 0; i < F.length; i++) {
      var cx = F[i][0], cy = F[i][1], rad = F[i][2], a = F[i][3];
      for (j = 0; j < 3; j++) {
        var w = Math.max(1.9, rad * 0.36 * W_CYC[j]);
        out.push(S(ray(cx, cy, a, rad * 0.3, rad * 0.86, B_CYC[(i + j) % 5] * 0.06, w), w, i + j));
        a += 1.78 + R_CYC[(i * 3 + j) % 7] * 0.45;
      }
    }
    out.push(S(bw(-32, 22, 33, 19, 0.05), 4.6, 1));
    out.push(S(bw(-22, 33, 30, 31, -0.03), 3.2, 2));
    return out;
  };

  /* 7 浪 — three shallows under a crest that belongs to another swell
     entirely, smaller and away to the right. A wave answered by its mirror is
     a decal. */
  PLAN.wave = function () {
    return [
      S(arcPts(-3, 15, 26, PI + 0.3, TAU - 0.2, 6, 0.05), 5, 0),
      S(arcPts(-2, 17, 19.5, PI + 0.5, TAU - 0.48, 5, 0.07), 3.6, 1),
      S(arcPts(-1, 19, 13, PI + 0.78, TAU - 0.92, 4, 0.1), 2.8, 2),
      S(arcPts(25, -9, 8, PI * 1.1, PI * 1.9, 4, 0.09), 3.2, 1),
      S(bowPts(-31, 24, 30, 26, -4), 3.6, 0)
    ];
  };

  /* 8 涡 — one stroke inward, never lifting. The turn is even and the shrink
     is not, so no two revolutions sit the same distance apart, and the squash
     keeps it off the compass. */
  PLAN.whirl = function () {
    var pts = [], a = 0.4, rad = 28, i;
    for (i = 0; i < 21; i++) {
      pts.push([Math.cos(a) * rad, Math.sin(a) * rad * 0.9]);
      a += 0.6;
      rad *= 0.942 - R_CYC[i % 7] * 0.006;
    }
    return [S(pts, 4, 0)];
  };

  /* 9 星 — four lights at four sizes, not one five-pointed star. Bearings come
     off the 7-cycle so no cluster repeats another's angles, and none of them
     is drawn thin enough to become a hairline. */
  PLAN.star = function () {
    var out = [], j;
    var a = 0.55, reach = [23, 10, 17, 8, 20, 12];
    for (j = 0; j < 6; j++) {
      var w = 4.8 * W_CYC[j % 3];
      out.push(S(ray(-3, -1, a, 6, reach[j], B_CYC[j % 5] * 0.05, w), w, j));
      a += 0.86 + R_CYC[(j * 3) % 7] * 0.2;
    }
    var P = [[24, 21, 0.44], [-25, 20, 0.36]];
    for (var i = 0; i < 2; i++) {
      var b = 1.4 + i * 2.2;
      for (j = 0; j < 3; j++) {
        var ws = Math.max(2, 4.8 * P[i][2] * W_CYC[j]);
        out.push(S(ray(P[i][0], P[i][1], b, 2.4, 13 * P[i][2] * R_CYC[(i + j) % 7], B_CYC[(i + j) % 5] * 0.05, ws), ws, i + j));
        b += 1.85 + R_CYC[(i * 2 + j) % 7] * 0.4;
      }
    }
    return out;
  };

  /* 10 电 — one fall that turns and never comes back, plus two spurs that
     leave it. A bolt folded into a flat Z is both the icon and the 棱角; here
     the excursions are long enough that the turn radius never drops under the
     stroke's own width. */
  PLAN.lightning = function () {
    return [
      S([[9, -33], [1, -22], [-4, -10], [2, 2], [9, 14], [3, 25], [-3, 33]], 4.4, 0),
      S(bw(2, 2, -18, 11, 0.06), 3.2, 1),
      S(bw(9, 14, 27, 20, -0.055), 2.8, 2),
      S(bw(-4, -10, -21, -16, 0.05), 2.4, 1)
    ];
  };

  /* 11 虹 — bands share a centre so they cannot cross, and share nothing else:
     four spans, four weights, four gaps, none of them equal. */
  PLAN.rainbow = function () {
    var rad = [12, 17.5, 23.5, 30], sp = [[0.3, 2.7], [0.08, 3.02], [0.46, 2.3], [0.16, 2.84]];
    var out = [], i;
    for (i = 0; i < 4; i++) {
      out.push(S(arcPts(-1 + i * 0.5, 21, rad[i], PI + sp[i][0], PI + sp[i][1], 4 + (i % 3), 0.045),
        4.8 * W_CYC[i % 3], i));
    }
    return out;
  };

  /* 12 露 — a drop is one loaded stroke, not an outline. Four of them, no two
     the same length or the same weight, hanging off one long edge. */
  PLAN.dew = function () {
    var x = [-20, -6, 8, 22], top = [8, 12, 6, 11], len = [15, 10, 18, 12];
    var out = [S(bowPts(-32, -14, 32, -6, 6), 4.6, 0)], i;
    for (i = 0; i < 4; i++) {
      out.push(S(bowPts(x[i], top[i], x[i] + B_CYC[i] * 1.2, top[i] + len[i], B_CYC[i] * 0.8),
        6.4 * W_CYC[i % 3], i));
    }
    return out;
  };

  /* 13 霜 — frost climbs a stem and feathers to one side only. Everything
     leaves into the open sector above, so nothing crosses and nothing meets. */
  PLAN.frost = function () {
    var stem = [[-30, 23], [-19, 15], [-8, 6], [4, -4], [16, -14], [27, -22]];
    var out = [S(stem, 4.6, 0)], i;
    var at = [[-24, 19], [-13.5, 10.5], [-2, 1], [10, -9], [21.5, -18]];
    var ang = [-2.02, -2.28, -1.92, -2.34, -1.86], len = [16, 10, 18, 9, 13];
    for (i = 0; i < 5; i++) {
      out.push(S(bowPts(at[i][0], at[i][1],
        at[i][0] + Math.cos(ang[i]) * len[i], at[i][1] + Math.sin(ang[i]) * len[i],
        B_CYC[i] * 1.2), 3.4 * W_CYC[i % 3], i));
    }
    return out;
  };

  /* 14 潮 — long water read by its rhythm. Each swell crosses the frame at its
     own two points and rests on its own number of stations, which is what
     stops four swells being one swell drawn four times. */
  PLAN.tide = function () {
    return [
      S([[-32, -19], [-8, -21], [16, -18], [30, -20]], 4.8, 0),
      S([[-24, -6], [-10, -9], [4, -5], [16, -9], [26, -5]], 3.4, 1),
      S([[-33, 7], [-6, 4], [20, 9], [33, 6]], 4.2, 2),
      S([[-16, 21], [12, 17], [31, 22]], 2.8, 0)
    ];
  };

  /* 15 泉 — a spring throws highest at the middle, and the ripples it lands in
     are nested but not concentric: the centres drift and the spans do not
     match. Seen flat, so the basin stays inside the frame. */
  PLAN.spring = function () {
    return [
      S([[-8, 10], [-11, -6], [-13, -21]], 3.2, 0),
      S([[-3, 11], [-4, -9], [-3, -27]], 4.6, 1),
      S([[2, 11], [4, -4], [7, -19]], 3.6, 2),
      S([[7, 10], [11, -2], [14, -13]], 2.8, 0),
      S(arcPts(0, 15, 11, 0.34, PI - 0.5, 4, 0.11, 0.7), 3.4, 1),
      S(arcPts(0, 16.5, 20, 0.26, PI - 0.32, 5, 0.08, 0.52), 2.8, 2),
      S(arcPts(1, 19, 30, 0.3, PI - 0.2, 5, 0.06, 0.44), 2.4, 0)
    ];
  };

  /* 16 川 — two banks and three currents. Five strokes on one structure would
     be one stroke five times, so each takes a different number of stations and
     crosses the frame on its own phase. */
  PLAN.river = function () {
    return [
      S([[-33, -28], [-29, 2], [-32, 33]], 4.4, 0),
      S([[-19, -31], [-14, -13], [-20, 5], [-13, 20], [-18, 33]], 3.8, 1),
      S([[-4, -30], [3, -2], [-3, 33]], 3.2, 2),
      S([[13, -32], [18, -15], [12, 3], [17, 31]], 3.6, 0),
      S([[27, -31], [33, -1], [28, 17], [33, 33]], 4.2, 1)
    ];
  };

  /* 17 泽 — a shore drawn as eight soundings at eight bearings and eight
     reaches, left open on one side. Reaches that alternate long-short make the
     outline two-fold symmetric — the checker caught that — so they run in no
     order at all. The opening is what makes it water seen from above. */
  PLAN.lake = function () {
    var A = [3.45, 3.95, 4.75, 5.35, 0.15, 1.05, 1.55, 2.4], pts = [], i;
    for (i = 0; i < A.length; i++) {
      var rd = 27 + (R_CYC[(i * 3) % 7] - 1) * 12;
      pts.push([Math.cos(A[i]) * rd, Math.sin(A[i]) * rd * 0.82]);
    }
    return [S(pts, 4.8, 0), S(bw(-13, -5, 9, -8, 0.055), 3.4, 1), S(bw(-9, 7, 14, 4, -0.05), 2.8, 2)];
  };

  /* 18 峰 — three ranges, each ONE stroke carried over its summit. Two flanks
     meeting at the top is the 棱角, and it is what the third pass drew; enough
     stations across the crown and the turn never tightens past the stroke's
     own width. Every summit sits somewhere else along its span. */
  PLAN.peak = function () {
    return [
      S([[-33, 7], [-22, -3], [-13, -13], [-4, -22], [5, -26], [15, -19], [24, -7], [32, 8]], 5, 0),
      S([[-33, 22], [-19, 15], [-8, 5], [1, -5], [11, -1], [21, 8], [32, 22]], 3.6, 1),
      S([[-32, 34], [-16, 28], [-2, 19], [10, 15], [22, 22], [33, 34]], 2.8, 2)
    ];
  };

  /* 19 谷 — the same idea read the other way up, which is what ⑤ allows:
     shared structure, no shared measurement. Three floors, three station
     counts, and each one walks right as it deepens. */
  PLAN.valley = function () {
    return [
      S([[-34, -30], [-21, -18], [-8, -7], [3, -2], [15, -10], [26, -20], [34, -28]], 4.8, 0),
      S([[-34, -10], [-18, -2], [-2, 6], [12, 13], [23, 10], [34, 2]], 3.4, 1),
      S([[-34, 8], [-25, 16], [-14, 24], [-2, 30], [12, 28], [24, 22], [34, 15]], 2.6, 2)
    ];
  };

  /* 20 崖 — strata to the left, the face to the right, and the two never meet.
     That gap is the cliff. */
  PLAN.cliff = function () {
    var end = [-8, -14, -5, -11], out = [], i;
    for (i = 0; i < 4; i++) {
      out.push(S(bw(-33, -24 + i * 11, end[i], -22 + i * 11, B_CYC[i] * 0.05, 3 + (i % 3)),
        4.2 * W_CYC[i % 3], i));
    }
    out.push(S([[4, -30], [8, -12], [3, 6], [10, 26]], 4.4, 1));
    out.push(S([[14, -25], [17, -2], [21, 31]], 3.6, 2));
    out.push(S([[23, -31], [26, -9], [31, 12], [28, 31]], 4.8, 0));
    return out;
  };

  /* 21 石 — three stones, each carried over on its own number of soundings.
     None is an ellipse and none is another one scaled. */
  PLAN.stone = function () {
    return [
      S(bw(-33, 25, 33, 22, 0.06), 4.4, 0),
      S([[-33, 17], [-29, 10], [-23, 6], [-17, 7], [-13, 12], [-11, 18]], 4, 1),
      S([[-8, 19], [-4, 10], [2, 4], [9, 4], [15, 10], [18, 19]], 5, 2),
      S([[19, 17], [24, 12], [30, 11], [34, 14]], 3.2, 0)
    ];
  };

  /* 22 沙 — each ridge carries one crest and the crest walks along the span
     from row to row. Stacked identical humps are a fabric swatch. */
  PLAN.dune = function () {
    return [
      S([[-34, -15], [-24, -19], [-13, -21], [-1, -17], [14, -20], [26, -17], [34, -14]], 4.8, 0),
      S([[-34, -2], [-20, -7], [-6, -3], [8, -8], [22, -4], [34, -1]], 3.2, 1),
      S([[-34, 13], [-19, 6], [0, 12], [18, 5], [34, 11]], 4, 2),
      S([[-34, 27], [-8, 20], [12, 26], [34, 21]], 2.6, 0)
    ];
  };

  /* 23 松 — boughs alternate sides until they don't. One break in the
     alternation is what stops a tree reading as a fir pictogram; each leaves
     the trunk at its own angle, its own reach, its own rise. */
  PLAN.pine = function () {
    var trunk = [[3, 31], [1, 10], [-1, -10], [-3, -27]];
    var out = [S(trunk, 5, 0)], i;
    var y = [22, 14, 6, -2, -10, -18], side = [1, -1, 1, -1, -1, 1];
    var reach = [21, 18, 17, 14, 12, 9], rise = [7, 6, 6, 5, 4, 4];
    for (i = 0; i < 6; i++) {
      var tx = 3 - 6 * (31 - y[i]) / 58;
      out.push(S(bw(tx, y[i], tx + side[i] * reach[i], y[i] - rise[i], side[i] * B_CYC[i % 5] * 0.07),
        3.9 * W_CYC[i % 3], i));
    }
    return out;
  };

  /* 24 竹 — the node is a GAP, not a bar across the cane. A crossbar breaks ①
     on every cane; leaving the internodes apart says the same thing in this
     hand. The spur beside each gap takes its own side. */
  PLAN.bamboo = function () {
    var C = [[-19, 32, -14, -29, 4, 4.8], [0, 31, 4, -31, 5, 4.2], [17, 33, 24, -25, 3, 3.4]];
    var out = [], i, j;
    for (i = 0; i < C.length; i++) {
      var x0 = C[i][0], y0 = C[i][1], x1 = C[i][2], y1 = C[i][3], n = C[i][4], w = C[i][5];
      for (j = 0; j < n; j++) {
        var a = j / n + (j ? 0.04 : 0), b = (j + 1) / n - (j === n - 1 ? 0 : 0.04);
        out.push(S(bw(x0 + (x1 - x0) * a, y0 + (y1 - y0) * a, x0 + (x1 - x0) * b, y0 + (y1 - y0) * b,
          B_CYC[(i * 2 + j) % 5] * 0.05, 3 + ((i + j) % 3)), w * W_CYC[j % 3], i + j));
        if (j < n - 1) {
          var nx = x0 + (x1 - x0) * ((j + 1) / n), ny = y0 + (y1 - y0) * ((j + 1) / n);
          var sd = (i + j) % 2 ? 1 : -1;
          out.push(S(bw(nx + sd * 4.5, ny + 0.6, nx + sd * 11, ny - 3.4, sd * 0.06), 2.4, j));
        }
      }
    }
    return out;
  };

  /* 25 苇 — the lean shortens rank by rank, so the stalks fan without ever
     converging. Each head CONTINUES the stalk rather than forking off it: two
     strokes leaving one tip at forty degrees is a barb, and a barb is a 棱角.
     The second stroke leaves further down, where it reads as a leaf. */
  PLAN.reed = function () {
    var x = [-25, -10, 6, 21], top = [-16, -25, -6, -21], lean = [9, 7, 5, 4], w = [4.2, 3.6, 4.6, 3];
    var out = [], i;
    for (i = 0; i < 4; i++) {
      var tx = x[i] + lean[i];
      out.push(S(bw(x[i], 31, tx, top[i], B_CYC[i] * 0.055, 5), w[i], i));
      out.push(S(bw(tx, top[i], tx + 3 + R_CYC[i * 2] * 4, top[i] - 4 - R_CYC[i + 2] * 5, B_CYC[i + 1] * 0.07),
        2.8 * W_CYC[i % 3], i + 1));
    }
    return out;
  };

  /* 26 叶 — two flanks with different bellies, so the blade is a leaf and not
     a lens. Veins stand clear of the edge and are counted out of a rhythm,
     never paired. */
  PLAN.leaf = function () {
    return [
      S([[1, -24], [9, -14], [13, -2], [11, 13], [4, 22]], 4.4, 0),
      S([[-2, -24], [-8, -13], [-11, -1], [-8, 13], [1, 22]], 3.4, 1),
      S([[0, -18], [2, 0], [3, 17]], 2.8, 2),
      S(bw(2, -11, 8, -4, 0.09), 2.2, 0),
      S(bw(2.4, 2, 9, 7, 0.05), 2.4, 1),
      S(bw(3, 12, 6.5, 17, 0.1), 1.9, 2),
      S(bw(1.4, -4, -5, 2, -0.07), 2.1, 0)
    ];
  };

  /* 27 根 — four roots off one crown at bearings that do not divide evenly,
     each splitting once and each split opening gently. Nothing rejoins: a root
     system that closes a loop is a diagram of one. */
  PLAN.root = function () {
    var trunk = [[-1, -31], [0, -22], [1, -13], [2, -4], [1, 6]];
    var out = [S(trunk, 4.8, 0)], i;
    var from = [[1, -13], [1.6, -6], [0.6, -18], [1.6, 2]];
    var ang = [2.62, 2.05, 0.9, 0.42], len = [22, 27, 24, 19], w = [3.8, 4.2, 3.2, 2.8];
    for (i = 0; i < 4; i++) {
      var fx = from[i][0] + Math.cos(ang[i]) * len[i], fy = from[i][1] + Math.sin(ang[i]) * len[i];
      out.push(S(bw(from[i][0], from[i][1], fx, fy, B_CYC[i] * 0.06, 5), w[i], i));
      var b = ang[i] + (i % 2 ? 0.3 : -0.28), L = 12 - (i % 3) * 1.6;
      out.push(S(bw(fx, fy, fx + Math.cos(b) * L, fy + Math.sin(b) * L, B_CYC[(i + 2) % 5] * 0.05),
        2.5 * W_CYC[i % 3], i + 1));
    }
    return out;
  };

  /* 28 烟 — three columns that lean apart as they rise, each loosening as it
     goes: the sway is a function of height, so the bottom is a thread and the
     top is a wander. */
  PLAN.smoke = function () {
    return [
      S([[-10, 29], [-14, 14], [-9, -2], [-16, -18], [-11, -31]], 3.6, 0),
      S([[-1, 30], [3, 17], [-2, 2], [4, -12], [-1, -24], [2, -32]], 4.6, 1),
      S([[11, 28], [16, 10], [10, -8], [15, -30]], 3, 2)
    ];
  };

  /* 29 风 — streaks of unequal reach, and only two of them curl at the end.
     A row of identical hooks is the weather glyph; the ones without a hook are
     what make the ones with it read as motion. */
  PLAN.wind = function () {
    return [
      S([[-33, -21], [-14, -24], [2, -21], [14, -25], [23, -32]], 4.6, 0),
      S([[-22, -8], [-4, -12], [12, -8], [25, -10]], 3.2, 1),
      S([[-33, 6], [-11, 2], [8, 7], [21, 2], [30, -6]], 4, 2),
      S([[-17, 21], [4, 16], [30, 22]], 2.8, 0)
    ];
  };

  /* 30 雷 — the mass is the subject and the bolt is the aside, which is the
     whole difference from 电. The underside is left open so the strokes inside
     it read as weight, not as a face. */
  PLAN.thunder = function () {
    var A = [3.3, 3.85, 4.5, 5.2, 5.9, 6.45], pts = [], i;
    for (i = 0; i < A.length; i++) {
      var rd = 27 + (R_CYC[(i * 3) % 7] - 1) * 10;
      pts.push([2 + Math.cos(A[i]) * rd, -13 + Math.sin(A[i]) * rd * 0.66]);
    }
    return [
      S(pts, 5, 0),
      S(bw(-12, -15, 4, -18, 0.05), 3.6, 1),
      S(bw(9, -12, 21, -15, -0.045), 3, 2),
      S([[1, -4], [-5, 7], [3, 19], [-2, 31]], 3.6, 0)
    ];
  };

  var PH = {};
  Object.keys(PLAN).forEach(function (name) {
    PH[name] = function () {
      var strokes = PLAN[name](), d = "", i;
      for (i = 0; i < strokes.length; i++) d += brush(strokes[i].p, strokes[i].w, strokes[i].k);
      return d;
    };
  });

  root.BWMarks = {
    rng: rng, svg: svg, sineV: sineV,
    ridgePath: ridgePath, landscape: landscape,
    brushRect: brushRect, brushAttrs: brushAttrs,
    vesica: vesica, vesicaRow: vesicaRow, splitDisc: splitDisc,
    scallop: scallop, waveField: waveField, tally: tally,
    florette: florette, dotRing: dotRing, coin: coin, hexagram: hexagram,
    brandMark: brandMark, brandField: brandField, yaoField: yaoField,
    phenomena: PH, phenomenaPlan: PLAN
  };
}());
