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
     Thirty things from the same weather as the range, on the third pass. The
     brief, in the owner's words, and what each line rejects:

       ① 本体中无线条交叉 — inside one mark, no stroke crosses another.
       ② 写意而没有特殊规则组成 — freehand. Not the output of a scheme.
       ③ 不能过分对称 — no n-fold rotation, no mirroring.
       ④ 不能反复大量挪用相同的部分 — a shape may not be stamped repeatedly.
       ⑤ 可以有相似的结构但每个结构中的细节都不同 — siblings, never clones.
       ⑥ 没有过分与标准图像和已有图案相似 — no icon schemas.

     The second pass failed five of these, and why is worth keeping. hand() was
     added to cure the FIRST pass, which was too plain: it repeated one curve
     three to six times on a 7-against-5 offset cycle. That made the marks
     denser — and made all thirty of them the output of one scheme (②) built
     from bulk copies of a single part (④), 25 of 30 through the same call.
     **Making something more complicated is not the same as making it freer.**

     So there is no shared repeater here. Every stroke pulls its own numbers
     from a seeded stream — endpoints, bow, skew, pull, weight. Two strokes
     doing the same job are siblings, not the same path moved. Deterministic
     still: one seed per motif, so a mark draws identically on every visit,
     for the same reason the brush and the palette order are seeded.

     There is also no `A` command anywhere below. A true circular arc is the
     one curve a hand cannot make, and five of the old thirty read as icons
     largely because of it; arcInk() lays an arc down as cubics whose radius
     wanders, so it is round without being a circle.

     ⚠️ Crossings are checked, not hoped for: tests/marks-form.mjs flattens
     every subpath and rejects a motif whose strokes intersect away from their
     endpoints, along with mirror/rotational symmetry and duplicated parts. */
  var PH = {};

  function inkStream(seed) {
    var s = (seed >>> 0) || 7;
    return function () { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; };
  }

  /* One freehand stroke. Every control offset arrives from the caller's own
     draw, so two strokes never share a curve even where they share a job. */
  function ln(x0, y0, x1, y1, lift, skew, pull) {
    var dx = x1 - x0, dy = y1 - y0, L = Math.sqrt(dx * dx + dy * dy) || 1;
    var nx = -dy / L, ny = dx / L, a = 0.33 - skew, b = 0.67 + skew;
    return "M" + R(x0) + " " + R(y0)
      + " C" + R(x0 + dx * a + nx * lift) + " " + R(y0 + dy * a + ny * lift)
      + " " + R(x0 + dx * b + nx * lift * pull) + " " + R(y0 + dy * b + ny * lift * pull)
      + " " + R(x1) + " " + R(y1) + " ";
  }

  /* A run of points carried through as one continuous stroke (Catmull–Rom in
     Bézier clothing). The wandering forms — water, smoke, a shoreline — are
     built by choosing where the stroke has been, not by bending a straight. */
  function smooth(p) {
    var d = "M" + R(p[0][0]) + " " + R(p[0][1]), i;
    for (i = 0; i < p.length - 1; i++) {
      var a = p[i === 0 ? 0 : i - 1], b = p[i], c = p[i + 1], e = p[i + 2] || c;
      d += " C" + R(b[0] + (c[0] - a[0]) / 6) + " " + R(b[1] + (c[1] - a[1]) / 6)
         + " " + R(c[0] - (e[0] - b[0]) / 6) + " " + R(c[1] - (e[1] - b[1]) / 6)
         + " " + R(c[0]) + " " + R(c[1]);
    }
    return d + " ";
  }

  /* A stroke travelling from one place to another without holding its line.
     Sway opens along the length: a thread that wobbles evenly end to end is a
     wave, and a wave is a rule. Only the start is pinned. */
  function thread(r, x0, y0, x1, y1, sway, n) {
    var dx = x1 - x0, dy = y1 - y0, L = Math.sqrt(dx * dx + dy * dy) || 1;
    var nx = -dy / L, ny = dx / L, pts = [], i;
    for (i = 0; i <= n; i++) {
      var t = i / n, off = i === 0 ? 0 : (r() - 0.5) * 2 * sway * (0.3 + t);
      pts.push([x0 + dx * t + nx * off, y0 + dy * t + ny * off]);
    }
    return smooth(pts);
  }

  /* Round, not circular: each vertex takes its own radius from the stream, so
     the curvature breathes across the span the way a drawn arc does. Always
     open — a closed ring is a symbol, and ③ and ⑥ both rule it out. */
  function arcInk(r, cx, cy, rad, a0, a1, o) {
    o = o || {};
    var wob = o.wob == null ? 0.05 : o.wob;
    var segs = o.segs || Math.max(2, Math.round(Math.abs(a1 - a0) / 0.9));
    var step = (a1 - a0) / segs, k = 4 / 3 * Math.tan(step / 4), rr = [], i;
    for (i = 0; i <= segs; i++) rr.push(rad * (1 + (r() - 0.5) * 2 * wob));
    var d = "M" + R(cx + rr[0] * Math.cos(a0)) + " " + R(cy + rr[0] * Math.sin(a0));
    for (i = 0; i < segs; i++) {
      var A = a0 + step * i, B = A + step, ra = rr[i], rb = rr[i + 1];
      var xb = cx + rb * Math.cos(B), yb = cy + rb * Math.sin(B);
      d += " C" + R(cx + ra * Math.cos(A) - k * ra * Math.sin(A)) + " " + R(cy + ra * Math.sin(A) + k * ra * Math.cos(A))
         + " " + R(xb + k * rb * Math.sin(B)) + " " + R(yb - k * rb * Math.cos(B))
         + " " + R(xb) + " " + R(yb);
    }
    return d + " ";
  }

  /* A path that turns hard and does not come back. Given corners, it bows each
     run by its own amount — the corners stay sharp, the runs do not stay
     straight. Both users pass different corners; the helper is shared, the
     shape is not. */
  function kink(r, P, amp) {
    var d = "M" + R(P[0][0]) + " " + R(P[0][1]), i;
    for (i = 1; i < P.length; i++) {
      var a = P[i - 1], b = P[i], dx = b[0] - a[0], dy = b[1] - a[1];
      var L = Math.sqrt(dx * dx + dy * dy) || 1, nx = -dy / L, ny = dx / L;
      var lf = (r() - 0.5) * 2 * amp;
      d += " C" + R(a[0] + dx * 0.34 + nx * lf) + " " + R(a[1] + dy * 0.34 + ny * lf)
         + " " + R(a[0] + dx * 0.68 + nx * lf * 0.7) + " " + R(a[1] + dy * 0.68 + ny * lf * 0.7)
         + " " + R(b[0]) + " " + R(b[1]);
    }
    return d + " ";
  }

  var TAU = Math.PI * 2, PI = Math.PI;

  /* 1 日 — light leans; it does not radiate evenly out of a disc. The body is
     one arc broken at the lower left, the light is three unequal streaks all
     raked the same way, and a far arc answers from the other side. Even
     spokes are what made the old one a compass rose. */
  PH.sun = function () {
    var r = inkStream(0x51a1), d = arcInk(r, -2, -3, 17, -2.55, 2.15, { wob: 0.075, segs: 6 }), i;
    for (i = 0; i < 3; i++) {
      var a = -0.92 + i * 0.62 + r() * 0.22, r0 = 22 + i * 2.6, r1 = r0 + 6 + r() * 6;
      d += ln(Math.cos(a) * r0 - 2, Math.sin(a) * r0 - 3, Math.cos(a) * r1 - 2, Math.sin(a) * r1 - 3,
        (r() - 0.5) * 4, (r() - 0.5) * 0.3, 0.6 + r() * 0.5);
    }
    return d + arcInk(r, -5, 2, 26, 2.55, 3.5, { wob: 0.11, segs: 3 });
  };

  /* 2 月 — a crescent is one arc chasing another of a different radius, and
     they meet only at the horns. The outer answers sit on one flank; lit from
     both sides it stops being a moon and becomes a lens. */
  PH.moon = function () {
    var r = inkStream(0x2b71);
    var d = arcInk(r, 0, 0, 23, -1.42, 1.46, { wob: 0.05, segs: 6 })
          + ln(3.5, -22.7, 2.5, 22.9, -11, 0.06, 0.85);
    var rad = [26, 31, 36], sp = [[-1.02, 0.38], [-0.66, 0.86], [-0.24, 0.42]], i;
    for (i = 0; i < 3; i++) {
      d += arcInk(r, i * 0.5, i - 1, rad[i], sp[i][0], sp[i][1], { wob: 0.04 + i * 0.01, segs: 2 + i * 2 });
    }
    return d;
  };

  /* 3 瀑 — the fall is six threads of unequal length and none of them reaches
     the pool; what lands is out of sight. The basin is three nested shallows,
     not a bowl. */
  PH.waterfall = function () {
    var r = inkStream(0x3f22), d = "", x = -19, i;
    for (i = 0; i < 6; i++) {
      d += thread(r, x, -34 + r() * 13, x + (r() - 0.5) * 3.2, -2 + r() * 15, 1.1 + r() * 1.5, 3 + (i % 4));
      x += 6.5 + r() * 3.2;
    }
    return d + arcInk(r, -6, 18, 5.5, 0.4, PI - 0.6, { wob: 0.16, segs: 2 })
      + arcInk(r, -3, 19, 10, 0.34, PI - 0.42, { wob: 0.12, segs: 3 })
      + arcInk(r, -1, 20, 16.5, 0.26, PI - 0.2, { wob: 0.09, segs: 4 });
  };

  /* 4 岚 — mountain vapour. Bands that start where they start: staggered left
     edges, wildly unequal reach, and a lift that swaps sign so the stack opens
     and closes down its height. Centred bands read as a logo. */
  PH.haze = function () {
    var r = inkStream(0x4a3e), d = "", y = -21, i;
    for (i = 0; i < 6; i++) {
      var x0 = -33 + r() * 15;
      d += ln(x0, y, x0 + 17 + i * 3.5 + r() * 22, y + (r() - 0.5) * 2.4,
        (0.9 + i * 0.5 + r() * 0.5) * (i % 2 ? 1 : -1), (r() - 0.5) * 0.6, 0.4 + r() * 1.3);
      y += 9 + r() * 4;
    }
    return d;
  };

  /* 5 雨 — the sky is a single shallow sweep well off centre; the rain slants
     one way with unequal length and unequal start. Rain drawn as identical
     ticks under a symmetric cloud is the pictogram. */
  PH.rain = function () {
    var r = inkStream(0x5c08), d = arcInk(r, -6, -26, 19, 0.45, PI - 0.75, { wob: 0.1, segs: 4 });
    var x = -28, i;
    for (i = 0; i < 8; i++) {
      var y0 = -2 + r() * 6;
      d += thread(r, x, y0, x - 4 - r() * 2, y0 + 9 + i * 1.9 + r() * 11, 0.55 + i * 0.14 + r() * 0.5, 2 + (i % 3));
      x += 6.8 + r() * 2;
    }
    return d;
  };

  /* 6 雪 — a drift, not a crystal. Five flakes at five sizes, each three arms
     on unequal bearings with a hole at the middle so they never meet — the
     florette's lesson: arms that converge fuse into a disc. Six-fold anything
     is ruled out twice over, by ③ and by ⑥. */
  PH.snow = function () {
    var r = inkStream(0x6d15), d = "", i, j;
    var F = [[-19, -18, 9], [7, -25, 6], [19, -6, 11], [-6, -1, 7], [-25, 7, 5]];
    for (i = 0; i < F.length; i++) {
      var cx = F[i][0], cy = F[i][1], rad = F[i][2], a = r() * TAU;
      for (j = 0; j < 3; j++) {
        var hole = rad * (0.3 + r() * 0.16), reach = rad * (0.75 + r() * 0.45);
        d += ln(cx + Math.cos(a) * hole, cy + Math.sin(a) * hole,
          cx + Math.cos(a) * reach, cy + Math.sin(a) * reach,
          (r() - 0.5) * rad * 0.28, (r() - 0.5) * 0.3, 0.6 + r() * 0.5);
        a += 1.5 + r() * 0.9;
      }
    }
    return d + ln(-33, 24, 34, 21, 5.5, 0.1, 0.8);
  };

  /* 7 浪 — three shallows under one crest that belongs to a different swell
     entirely, off to the right and much smaller. A wave answered by its own
     mirror is a decal. */
  PH.wave = function () {
    var r = inkStream(0x7e44);
    return arcInk(r, -4, 14, 27, PI + 0.34, TAU - 0.22, { wob: 0.06, segs: 5 })
      + arcInk(r, -3, 17, 21, PI + 0.52, TAU - 0.5, { wob: 0.09, segs: 4 })
      + arcInk(r, -1, 19, 14, PI + 0.8, TAU - 0.95, { wob: 0.13, segs: 3 })
      + arcInk(r, 26, -10, 8, PI * 1.1, PI * 1.92, { wob: 0.11, segs: 3 })
      + ln(-32, 22, 30, 24, -4.5, -0.2, 0.7);
  };

  /* 8 涡 — one stroke inward, never lifting. Both the turn and the shrink are
     drawn per step, so no two revolutions are the same distance apart, and the
     ellipse keeps it off the compass. */
  PH.whirl = function () {
    var r = inkStream(0x8c9a), pts = [], a = r() * TAU, rad = 29, i;
    for (i = 0; i < 26; i++) {
      pts.push([Math.cos(a) * rad + (r() - 0.5) * 1.2, Math.sin(a) * rad * 0.86 + (r() - 0.5) * 1.2]);
      a += 0.52 + r() * 0.16;
      rad *= 0.895 - r() * 0.03;
    }
    return smooth(pts);
  };

  /* 9 星 — five points of light at five sizes, not one five-pointed star. Each
     is three or four strokes on bearings drawn from unequal weights, so no
     cluster repeats another's angles. */
  PH.star = function () {
    var r = inkStream(0x9a03), d = "", i, j;
    var P = [[-4, -4, 1], [19, -23, 0.55], [-24, 10, 0.46], [26, 15, 0.38], [-17, -24, 0.3]];
    for (i = 0; i < P.length; i++) {
      var cx = P[i][0], cy = P[i][1], s = P[i][2], n = i ? 3 : 4;
      var raw = [], sum = 0, a = r() * TAU;
      for (j = 0; j < n; j++) { var w = 0.75 + r() * 1.25; raw.push(w); sum += w; }
      for (j = 0; j < n; j++) {
        a += raw[j] / sum * 5.9;
        var h = 2.6 * s * (0.85 + r() * 0.5), L = 15 * s * (0.62 + r() * 0.85);
        d += ln(cx + Math.cos(a) * h, cy + Math.sin(a) * h, cx + Math.cos(a) * L, cy + Math.sin(a) * L,
          (r() - 0.5) * 2.2 * s, (r() - 0.5) * 0.3, 0.6 + r() * 0.5);
      }
    }
    return d;
  };

  /* 10 电 — one continuous fall with corners that do not repeat, and two spurs
     that leave and never return. The flat symmetric Z is the icon; this keeps
     its descent monotonic so it cannot cross itself. */
  PH.lightning = function () {
    var r = inkStream(0xa17c);
    return kink(r, [[6, -33], [-4, -17], [7, -12], [-6, 4], [4, 9], [-9, 30]], 1.3)
      + ln(-6, 4, -21, 15, 2.2, 0.16, 0.7)
      + ln(7, -12, 20, -9, -1.8, -0.2, 0.8);
  };

  /* 11 虹 — bands share a centre so they cannot cross, and share nothing else:
     each span starts and stops on its own angle and the gaps between them are
     drawn, never stepped. Six even nested arcs is the clip-art. */
  PH.rainbow = function () {
    var r = inkStream(0xb2e9), d = "", rad = 11, i;
    var sp = [[0.26, 2.72], [0.1, 3.02], [0.42, 2.35], [0.05, 2.88], [0.68, 1.94], [0.2, 2.6]];
    for (i = 0; i < sp.length; i++) {
      d += arcInk(r, -2 + i * 0.4, 22, rad, PI + sp[i][0], PI + sp[i][1], { wob: 0.04 + (i % 3) * 0.03, segs: 2 + (i % 4) });
      rad += 2.6 + r() * 2.2;
    }
    return d;
  };

  /* 12 露 — a drop is two strokes between the same two points with different
     bellies, which is why it never reads as a symmetric teardrop. Five of
     them, no two the same height, hanging off one long edge. */
  PH.dew = function () {
    var r = inkStream(0xc330), d = ln(-33, -12, 33, -4, 6.5, 0.18, 0.8), i;
    var D = [[-23, 9], [-9, 12.5], [4, 7], [15, 13], [26, 8]];
    for (i = 0; i < D.length; i++) {
      var x = D[i][0], top = D[i][1], h = 7 + r() * 13, w = 2.2 + r() * 3.2;
      var bx = x + (r() - 0.5) * 2, by = top + h;
      d += ln(x, top, bx, by, w, (r() - 0.5) * 0.2, 0.9 + r() * 0.4);
      d += ln(x, top, bx, by, -w * (0.6 + r() * 0.5), (r() - 0.5) * 0.2, 0.9 + r() * 0.4);
    }
    return d;
  };

  /* 13 霜 — frost climbs a stem and feathers to one side only. Everything
     leaves into the open sector above the stem, so nothing crosses it and
     nothing crosses a neighbour; the count per node alternates. */
  PH.frost = function () {
    var r = inkStream(0xd407), pts = [], x = -30, y = 22, i, j;
    for (i = 0; i <= 7; i++) { pts.push([x, y]); x += 8.6 + r() * 1.6; y -= 5.4 + r() * 2.4; }
    var d = smooth(pts);
    for (i = 1; i < 7; i++) {
      var b = pts[i], n = i % 3 === 0 ? 1 : 2;
      for (j = 0; j < n; j++) {
        var a = -1.78 - r() * 0.5 - j * 0.42, L = 4 + r() * 9;
        d += ln(b[0], b[1], b[0] + Math.cos(a) * L, b[1] + Math.sin(a) * L,
          (r() - 0.5) * 1.4, (r() - 0.5) * 0.3, 0.7 + r() * 0.4);
      }
    }
    return d;
  };

  /* 14 潮 — long water, read by its rhythm rather than its shape. Each swell
     is carried through a different number of stations at different spacing, so
     the stack never lines up into a moiré. */
  PH.tide = function () {
    var r = inkStream(0xe58b), d = "", y = -18, i, j;
    for (i = 0; i < 5; i++) {
      var x = -34 + r() * 13, pts = [[x, y]], n = 2 + (i * 3 % 4), amp = 1.3 + i * 0.85 + r() * 1.5;
      var span = 50 + r() * (34 - x);
      for (j = 0; j < n; j++) {
        x += span / n * (0.66 + r() * 0.68);
        pts.push([Math.min(34, x), y + (r() - 0.5) * amp]);
      }
      d += smooth(pts);
      y += 10 + r() * 4;
    }
    return d;
  };

  /* 15 泉 — a spring throws highest at the middle and shortest at the edges,
     and the ripples it lands in are nested, not concentric: the centres drift
     and the spans do not match. */
  PH.spring = function () {
    var r = inkStream(0xf6d2), d = "", i;
    for (i = 0; i < 5; i++) {
      var x = -12 + i * 6;
      d += thread(r, x + (i - 2) * 1.4, -28 + Math.abs(i - 2) * 7 + r() * 5,
        x + (i - 2) * 3.6, 8 + r() * 7, 0.6 + r() * 1.2, 3 + (i % 3));
    }
    return d + arcInk(r, -1, 16, 9, 0.3, PI - 0.45, { wob: 0.13, segs: 3 })
      + arcInk(r, 0, 17, 15, 0.22, PI - 0.3, { wob: 0.1, segs: 4 })
      + arcInk(r, 1, 18, 22, 0.34, PI - 0.18, { wob: 0.08, segs: 4 });
  };

  /* 16 川 — three currents between two banks, each with its own sway and its
     own crossing of the frame. The banks bow inward but never touch what runs
     between them. */
  PH.river = function () {
    var r = inkStream(0x1187), d = "", i;
    var X = [-17, -6, 5], S = [2.4, 1.4, 3], T = [-33, -28, -31], B = [30, 33, 27], N = [4, 7, 5];
    for (i = 0; i < 3; i++) {
      d += thread(r, X[i] + (r() - 0.5) * 2, T[i], X[i] + 8 + (r() - 0.5) * 3, B[i], S[i], N[i]);
    }
    return d + ln(-34, -24, -26, 33, -4.6, 0.3, 1.3) + ln(26, -31, 34, 24, 3.8, -0.26, 0.5);
  };

  /* 17 泽 — a shore drawn as eight soundings at eight unequal bearings and
     eight unequal reaches, left open on one side. A closed oval would be a
     lozenge; the opening is what makes it water seen from above. */
  PH.lake = function () {
    var r = inkStream(0x2298), pts = [], i;
    var A = [3.5, 4.2, 5, 5.8, 0.4, 1.15, 1.9, 2.55];
    for (i = 0; i < A.length; i++) {
      var rad = 24 + r() * 7;
      pts.push([Math.cos(A[i]) * rad, Math.sin(A[i]) * rad * 0.72]);
    }
    return smooth(pts) + arcInk(r, -4, 3, 10, 0.35, 2.1, { wob: 0.15, segs: 3 })
      + ln(-12, -6, 8, -8, 2, 0.2, 0.8);
  };

  /* 18 峰 — four ranges, each with its summit somewhere else along the span
     and each falling at a different rate on either side. A peak whose two
     flanks match is a tent. */
  PH.peak = function () {
    var r = inkStream(0x33a5), d = "", i;
    for (i = 0; i < 4; i++) {
      var ax = -8 + i * 5.5 + (r() - 0.5) * 5, ay = -30 + i * 9 + r() * 5;
      d += ln(-32 + i * 3 + (r() - 0.5) * 8, 12 + i * 6.5, ax, ay,
        1 + i * 1.15 + r(), 0.14 + r() * 0.3, 0.55 + r() * 0.8);
      d += ln(ax, ay, 30 - i * 2 + (r() - 0.5) * 5, 14 + i * 7,
        -(0.9 + i * 0.85 + r() * 0.9), -0.14 - r() * 0.3, 0.55 + r() * 0.8);
    }
    return d;
  };

  /* 19 谷 — the same structure as 峰 read the other way up, which is what ⑤
     allows: shared idea, no shared measurement. Four floors that are NOT a
     step apart — the first draft stepped every valley by one constant vector,
     which is a repeat however much jitter is thrown at it, and the checker
     said so twice before I stopped tuning and redrew. Each arm now has its own
     run, its own fall and its own belly position. */
  PH.valley = function () {
    var r = inkStream(0x449b), d = "", i;
    var LY = [-28, -15, -4, 8], BX = [6, -2, 3, -10], BY = [2, 13, 21, 29], RY = [-22, -12, -1, 10];
    for (i = 0; i < 4; i++) {
      d += ln(-34, LY[i], BX[i], BY[i], 0.9 + i * 1 + r() * 0.6, 0.3 - i * 0.18 + r() * 0.1, 0.5 + r() * 0.8);
      d += ln(BX[i], BY[i], 34, RY[i], -(0.8 + i * 0.9 + r() * 0.6), -0.32 + i * 0.2 - r() * 0.1, 0.5 + r() * 0.8);
    }
    return d;
  };

  /* 20 崖 — strata to the left, the face to the right, and the two never meet:
     the beds stop short of the break. That gap is the cliff. */
  PH.cliff = function () {
    var r = inkStream(0x55c2), d = "", y = -26, i;
    for (i = 0; i < 5; i++) {
      d += ln(-34, y + (r() - 0.5) * 2, -6 - i * 3 - r() * 9, y + 1 + r() * 5,
        (i % 2 ? 1 : -1) * (0.7 + i * 0.65 + r() * 1.1), (r() - 0.5) * 0.5, 0.55 + r() * 0.8);
      y += 8 + r() * 3.5;
    }
    for (i = 0; i < 3; i++) {
      d += ln(2 + i * 7.5 + (r() - 0.5) * 3, -30 + i * 5 + r() * 7, 9 + i * 8 + (r() - 0.5) * 3, 26 - i * 4 + r() * 8,
        1 + i * 1.2 + r(), 0.14 + r() * 0.24, 0.6 + r() * 0.7);
    }
    return d;
  };

  /* 21 石 — three stones, each a dome walked over a different number of
     stations with its radius redrawn at every one. None of them is an ellipse
     and none of them is another one scaled. */
  PH.stone = function () {
    var r = inkStream(0x66d9), d = ln(-34, 19, 34, 16, 4, 0.15, 0.8), i, j;
    var S = [[-23, 15, 9, 12, 4], [2, 18, 13, 20, 6], [25, 13, 7, 10, 3]];
    for (i = 0; i < S.length; i++) {
      var cx = S[i][0], base = S[i][1], w = S[i][2], h = S[i][3], n = S[i][4], pts = [];
      for (j = 0; j <= n; j++) {
        var a = PI - j / n * PI;
        pts.push([cx + Math.cos(a) * w * (0.8 + r() * 0.35), base - Math.sin(a) * h * (0.7 + r() * 0.45)]);
      }
      d += smooth(pts);
    }
    return d;
  };

  /* 22 沙 — each ridge carries one crest, and the crest walks along the span
     from row to row. Stacked identical humps are a fabric swatch. */
  PH.dune = function () {
    var r = inkStream(0x77e4), d = "", y = -16, i, j;
    for (i = 0; i < 5; i++) {
      var cx = -18 + i * 9 + (r() - 0.5) * 8, h = 1.8 + i * 0.9 + r() * 1.8, n = 2 + (i * 3 % 4);
      var x0 = -34 + r() * 9, x1 = 34 - r() * 9, pts = [[x0, y + (r() - 0.5) * 2]];
      for (j = 1; j <= n; j++) {
        var px = x0 + (x1 - x0) * (j / n);
        pts.push([px, y - Math.exp(-Math.pow((px - cx) / (11 + r() * 12), 2)) * h + (r() - 0.5) * 2.6]);
      }
      d += smooth(pts);
      y += 11 + r() * 3.5;
    }
    return d;
  };

  /* 23 松 — boughs alternate sides until they don't; one break in the
     alternation is what stops a tree reading as a fir pictogram. Each leaves
     the trunk at its own angle, its own length, its own rise. */
  PH.pine = function () {
    var r = inkStream(0x8802), d = thread(r, 2, 30, -3, -26, 1.2, 5), y = 22, i;
    for (i = 0; i < 7; i++) {
      var side = (i % 2 ? 1 : -1) * (i === 4 ? -1 : 1), tx = 2 - 5 * (30 - y) / 56;
      d += ln(tx + side * 2.6, y, tx + side * (19 - i * 2 + r() * 8), y - 3 - r() * (8 - i),
        side * (1.1 + i * 0.35 + r() * 1.2), 0.16 + r() * 0.26, 0.6 + r() * 0.7);
      y -= 6 + r() * 2;
    }
    return d;
  };

  /* 24 竹 — the node is a GAP, not a tick across the cane. Drawing it as a
     crossbar would break ① on every cane; leaving the internodes apart says
     the same thing and says it in this hand. The spur beside each gap picks
     its own side. */
  PH.bamboo = function () {
    var r = inkStream(0x99f3), d = "", i, j;
    var C = [[-17, 32, -12, -30, 4], [1, 30, 5, -32, 5], [17, 33, 25, -24, 3]];
    for (i = 0; i < C.length; i++) {
      var x0 = C[i][0], y0 = C[i][1], x1 = C[i][2], y1 = C[i][3], n = C[i][4], prev = 0;
      for (j = 0; j < n; j++) {
        var b = (j + 1) / n - (0.03 + r() * 0.09);
        d += ln(x0 + (x1 - x0) * prev, y0 + (y1 - y0) * prev, x0 + (x1 - x0) * b, y0 + (y1 - y0) * b,
          ((i + j) % 2 ? 1 : -1) * (0.7 + j * 0.75 + r() * 1.2), (r() - 0.5) * 0.5, 0.5 + r() * 0.9);
        prev = (j + 1) / n;
        if (j < n - 1) {
          var nx = x0 + (x1 - x0) * prev, ny = y0 + (y1 - y0) * prev, side = r() < 0.5 ? 1 : -1;
          d += ln(nx + side * 2.6, ny + 1, nx + side * 6, ny - 1 - r() * 3, side * 1.2, 0.2, 0.8);
        }
      }
    }
    return d;
  };

  /* 25 苇 — the lean shortens rank by rank so the stalks fan without ever
     converging, and each head throws two or three strokes downwind from the
     tip. A reed bed drawn as parallel strokes is a barcode. */
  PH.reed = function () {
    var r = inkStream(0xaa16), d = "", x = -28, i, j;
    for (i = 0; i < 5; i++) {
      var lean = 10 - i * 1.6 + r() * 2, top = -6 - r() * 18, tx = x + lean;
      d += thread(r, x, 31, tx, top, 0.7 + r() * 1.1, 3 + (i % 3));
      var n = 2 + (i % 2);
      for (j = 0; j < n; j++) {
        var a = -0.55 + (r() - 0.5) * 0.2 - j * 0.62, L = 4 + r() * 3.5;
        d += ln(tx, top, tx + Math.cos(a) * L, top + Math.sin(a) * L,
          (r() - 0.5) * 1.2, 0.2, 0.8);
      }
      x += 12;
    }
    return d;
  };

  /* 26 叶 — the two flanks have different bellies and different skews, so the
     blade is a leaf and not a lens. Veins stand clear of both the midrib and
     the edge, and they are counted out of a rhythm, not paired. */
  PH.leaf = function () {
    var r = inkStream(0xbb2d);
    var d = ln(-2, -27, 4, 24, 13.5, 0.1, 0.75) + ln(-2, -27, 4, 24, -10.5, -0.14, 1.2);
    d += thread(r, -1, -23, 3.4, 20, 1.1, 4);
    var y = -17, i = 0;
    while (y < 15) {
      var side = i % 3 === 2 ? -1 : 1, mid = -1 + (y + 23) * 0.102;
      var hw = (side > 0 ? 8.6 : 6.2) * Math.sin(PI * (y + 27) / 51), L = hw * (0.24 + r() * 0.34);
      d += ln(mid + side * 2.6, y, mid + side * (2.6 + L), y + 2.4 + r() * 3.4,
        side * (0.6 + r() * 1.1), 0.14 + r() * 0.2, 0.6 + r() * 0.6);
      y += 5.5 + r() * 3;
      i++;
    }
    return d;
  };

  /* 27 根 — four roots off one crown at bearings that do not divide evenly,
     each splitting once or twice. Nothing rejoins: a root system that closes a
     loop is a diagram of one. */
  PH.root = function () {
    var r = inkStream(0xcc41), d = thread(r, -2, -30, 3, -4, 1.4, 3), i, j;
    var A = [2.88, 2.26, 1.3, 0.35];
    for (i = 0; i < A.length; i++) {
      var a = A[i] + (r() - 0.5) * 0.14, L = 13 + r() * 11;
      var fx = 3 + Math.cos(a) * L, fy = -4 + Math.sin(a) * L;
      d += ln(3, -4, fx, fy, (r() - 0.5) * 3.4, (r() - 0.5) * 0.3, 0.8);
      for (j = 0; j < (i % 2 ? 1 : 2); j++) {
        var b = a + (j ? 0.3 : -0.28) + (r() - 0.5) * 0.14, L2 = 5 + r() * 5;
        d += ln(fx, fy, fx + Math.cos(b) * L2, fy + Math.sin(b) * L2, (r() - 0.5) * 1.8, 0.2, 0.8);
      }
    }
    return d;
  };

  /* 28 烟 — three columns that lean apart as they rise, and each loosens as it
     goes: the sway is a function of height, so the bottom is a thread and the
     top is a wander. */
  PH.smoke = function () {
    var r = inkStream(0xdd58), d = "", i, j;
    var X = [-9, -2, 6];
    for (i = 0; i < 3; i++) {
      var pts = [], sw = 1.6 + i * 1.5, n = 4 + i * 2;
      for (j = 0; j <= n; j++) {
        var t = j / n;
        pts.push([X[i] + (i - 1) * t * 9 + (r() - 0.5) * 2 * sw * (0.2 + t * 1.5), 28 - t * 58]);
      }
      d += smooth(pts);
    }
    return d;
  };

  /* 29 风 — streaks of unequal reach, and only some of them curl at the end.
     A row of identical hooks is the weather-app glyph; the ones without a
     hook are what make the ones with it read as motion. */
  PH.wind = function () {
    var r = inkStream(0xee6f), d = "", y = -21, i;
    for (i = 0; i < 5; i++) {
      var x0 = -34 + r() * 12, x1 = Math.min(34, x0 + 18 + i * 5 + r() * 20);
      d += ln(x0, y, x1, y + (r() - 0.5) * 2.4, (0.8 + i * 0.55 + r() * 0.9) * (i % 2 ? 1 : -1),
        (r() - 0.5) * 0.6, 0.4 + r() * 1.3);
      if (r() < 0.55) d += arcInk(r, x1 + 3, y - 4, 3, 1.5, -1.2, { wob: 0.17, segs: 2 });
      y += 10 + r() * 4;
    }
    return d;
  };

  /* 30 雷 — the mass is the subject and the bolt is the aside, which is the
     whole difference from 电. The underside is drawn open so the two strokes
     inside it read as weight, not as a face. */
  PH.thunder = function () {
    var r = inkStream(0xff84), pts = [], i;
    var A = [3.35, 3.9, 4.6, 5.3, 5.95, 6.5];
    for (i = 0; i < A.length; i++) {
      var rad = 21 + r() * 9;
      pts.push([2 + Math.cos(A[i]) * rad, -12 + Math.sin(A[i]) * rad * 0.62]);
    }
    return smooth(pts)
      + ln(-11, -22, 5, -25, 2.2, 0.2, 0.8)
      + ln(10, -19, 21, -22, -1.8, -0.2, 0.8)
      + kink(r, [[-1, -3], [-10, 8], [0, 12], [-8, 30]], 1.1);
  };

  root.BWMarks = {
    rng: rng, svg: svg, sineV: sineV,
    ridgePath: ridgePath, landscape: landscape,
    brushRect: brushRect, brushAttrs: brushAttrs,
    vesica: vesica, vesicaRow: vesicaRow, splitDisc: splitDisc,
    scallop: scallop, waveField: waveField, tally: tally,
    florette: florette, dotRing: dotRing, coin: coin, hexagram: hexagram,
    brandMark: brandMark, brandField: brandField, yaoField: yaoField,
    phenomena: PH
  };
}());
