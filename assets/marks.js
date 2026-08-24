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
     Thirty things that behave like the cloud does: drawn with the same
     single-weight round-capped line, built from arcs and sampled curves, no
     fill, deterministic, taking colour through currentColor.

     Two rules carried over from the range, because both were learned the hard
     way there. ⚠️ Ink is a fraction of the motif's own pitch, never a fixed
     number — a stroke that is right at one spacing fuses into lumps at
     another. ⚠️ A stroke ends where it was drawn to end: nothing here relies
     on a clip to finish a line, because a clip can only cut squarely. Where a
     line should stop short, it is drawn short.

     Every function returns path data for one motif drawn in a 100x100 box
     centred on the origin, so they compose and scale alike. */
  var PH = {};
  function arcAt(cx, cy, r, a0, a1) {
    var x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0);
    var x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
    var large = Math.abs(a1 - a0) > Math.PI ? 1 : 0;
    var sweep = a1 > a0 ? 1 : 0;
    return "M" + R(x0) + " " + R(y0) + " A" + R(r) + " " + R(r) + " 0 " + large + " " + sweep + " " + R(x1) + " " + R(y1) + " ";
  }
  /* Nested arcs sharing a centre — the cloud's own construction, generalised.
     `trim` pulls both ends in, which is how an arc finishes cleanly instead of
     running into whatever is beside it. */
  function arcNest(cx, cy, r0, step, n, a0, a1, trim) {
    var d = "";
    for (var i = 0; i < n; i++) {
      var t = (trim || 0) * i;
      d += arcAt(cx, cy, r0 + i * step, a0 + t, a1 - t);
    }
    return d;
  }
  function strand(x, y0, y1, amp, period, phase) {
    var d = "M" + R(x + amp * Math.sin(phase || 0)) + " " + R(y0), y = y0, k = 0;
    while (y < y1) {
      var ny = Math.min(y1, y + period / 2);
      var dir = (k % 2) ? -1 : 1;
      d += "Q" + R(x + dir * amp * 2) + " " + R((y + ny) / 2) + " " + R(x + amp * Math.sin(phase + (k + 1) * Math.PI)) + " " + R(ny) + " ";
      y = ny; k++;
    }
    return d;
  }

  /* 1 日 — a disc that is never closed, with the light coming off it in the
     same layered arcs the cloud uses rather than as spokes. */
  PH.sun = function (o) { o = o || {}; var r = o.r || 20, n = o.rays || 12, d = arcNest(0, 0, r, 0, 1, -2.9, 2.9, 0), i;
    for (i = 0; i < n; i++) { var a = i * 2 * Math.PI / n + .2, i0 = r * 1.32, i1 = r * (1.55 + (i % 3) * .16);
      d += "M" + R(i0 * Math.cos(a)) + " " + R(i0 * Math.sin(a)) + " L" + R(i1 * Math.cos(a)) + " " + R(i1 * Math.sin(a)) + " "; }
    return d; };
  /* 2 月 — one arc for the limb, one for the terminator; the gap between them
     is the moon, so nothing is filled. */
  PH.moon = function (o) { o = o || {}; var r = o.r || 22;
    return arcAt(0, 0, r, -1.35, 1.35) + arcAt(r * .62, 0, r * .92, -1.15, 1.15); };
  /* 3 瀑 — strands falling at one pitch, ending in the basin's spread arcs. */
  PH.waterfall = function (o) { o = o || {}; var w = o.w || 44, n = o.n || 6, top = -34, foot = 16, d = "", i;
    for (i = 0; i < n; i++) { var x = -w / 2 + i * w / (n - 1);
      d += strand(x, top + (i % 3) * 4, foot - (i % 2) * 5, 1.6, 26, i * 1.1); }
    return d + arcNest(0, foot + 6, 10, 7, 3, .25, Math.PI - .25, .06); };
  /* 4 岚 — mist reads as broken horizontals: each band is an arc that stops
     before the next begins, which is what keeps it from becoming a rule. */
  PH.haze = function (o) { o = o || {}; var n = o.n || 5, w = o.w || 54, d = "", i;
    for (i = 0; i < n; i++) { var y = -18 + i * 9, span = w * (.5 + ((i * 7) % 5) / 9), x0 = -span / 2 + ((i % 2) ? 7 : -7);
      d += "M" + R(x0) + " " + R(y) + " Q" + R(x0 + span * .5) + " " + R(y - 3.4) + " " + R(x0 + span) + " " + R(y) + " "; }
    return d; };
  /* 5 雨 */
  PH.rain = function (o) { o = o || {}; var n = o.n || 9, d = arcNest(0, -20, 15, 5, 2, .15, Math.PI - .15, .05), i;
    for (i = 0; i < n; i++) { var x = -26 + i * 6.5, y = -2 + ((i * 5) % 4) * 3;
      d += "M" + R(x) + " " + R(y) + " L" + R(x - 3) + " " + R(y + 13) + " "; }
    return d; };
  /* 6 雪 — six arms, each a short arc so it never reads as a snowflake icon. */
  /* ⚠️ The arms used to start at 0 and each carried an arc of .3r centred on
     it, so six of them overlapped in the middle and fused into a disc — the
     florette's failure, repeated. The arms are held off the centre and the
     barbs are short straight ticks, which is what a flake reads as anyway. */
  PH.snow = function (o) { o = o || {}; var r = o.r || 20, hole = r * .22, d = "", i;
    for (i = 0; i < 6; i++) { var a = i * Math.PI / 3, cx = Math.cos(a), cy = Math.sin(a);
      d += "M" + R(hole * cx) + " " + R(hole * cy) + " L" + R(r * cx) + " " + R(r * cy) + " ";
      var bx = r * .66 * cx, by = r * .66 * cy, t = r * .26;
      d += "M" + R(bx) + " " + R(by) + " L" + R(bx + t * Math.cos(a + 1)) + " " + R(by + t * Math.sin(a + 1)) + " ";
      d += "M" + R(bx) + " " + R(by) + " L" + R(bx + t * Math.cos(a - 1)) + " " + R(by + t * Math.sin(a - 1)) + " "; }
    return d; };
  /* 7 浪 */
  PH.wave = function (o) { o = o || {}; var n = o.n || 4, d = "", i;
    for (i = 0; i < n; i++) d += arcNest(0, 8 + i * 7, 26 - i * 4, 0, 1, Math.PI + .3, 2 * Math.PI - .3, 0);
    return d + arcAt(18, -2, 12, Math.PI * 1.1, Math.PI * 1.95); };
  /* 8 涡 — a spiral built from quarter arcs of shrinking radius. */
  PH.whirl = function (o) { o = o || {}; var r = o.r || 26, k = o.decay || .82, d = "", a = 0, i;
    for (i = 0; i < 9; i++) { d += arcAt(0, 0, r, a, a + Math.PI * .72); a += Math.PI * .72; r *= k; }
    return d; };
  /* 9 星 */
  PH.star = function (o) { o = o || {}; var r = o.r || 20, d = "", i;
    for (i = 0; i < 4; i++) { var a = i * Math.PI / 4, l = (i % 2) ? r * .52 : r;
      d += "M" + R(-l * Math.cos(a)) + " " + R(-l * Math.sin(a)) + " L" + R(l * Math.cos(a)) + " " + R(l * Math.sin(a)) + " "; }
    return d + arcNest(0, 0, r * .3, 0, 1, 0, 6.2, 0); };
  /* 10 电 */
  PH.lightning = function (o) { o = o || {}; var d = arcNest(0, -20, 17, 6, 2, .2, Math.PI - .2, .05);
    return d + "M-4 -4 L-11 9 L-3 9 L-9 24 " + "M12 -2 L6 8 L12 8 L7 18 "; };
  /* 11 虹 */
  PH.rainbow = function (o) { o = o || {}; return arcNest(0, 16, 16, 6, 4, .12, Math.PI - .12, .04); };
  /* 12 露 */
  PH.dew = function (o) { o = o || {}; var n = o.n || 5, d = "M-30 -6 Q0 -14 30 -6 ", i;
    for (i = 0; i < n; i++) { var x = -24 + i * 12, y = -2 + ((i * 3) % 3) * 2;
      d += "M" + R(x) + " " + R(y) + " Q" + R(x + 3.4) + " " + R(y + 7) + " " + R(x) + " " + R(y + 11)
         + " Q" + R(x - 3.4) + " " + R(y + 7) + " " + R(x) + " " + R(y) + " "; }
    return d; };
  /* 13 霜 */
  PH.frost = function (o) { o = o || {}; var n = o.n || 7, d = "", i;
    for (i = 0; i < n; i++) { var x = -30 + i * 10, h = 9 + ((i * 5) % 4) * 4;
      d += "M" + R(x) + " 16 L" + R(x) + " " + R(16 - h) + " M" + R(x - 4) + " " + R(20 - h) + " L" + R(x) + " " + R(16 - h)
         + " L" + R(x + 4) + " " + R(20 - h) + " "; }
    return d + "M-34 16 L34 16 "; };
  /* 14 潮 */
  PH.tide = function (o) { o = o || {}; var n = o.n || 5, d = "", i;
    for (i = 0; i < n; i++) d += sineV_h(-34, 34, -12 + i * 7, 3.2 - i * .3, 30 + i * 4);
    return d; };
  /* 15 泉 */
  PH.spring = function (o) { o = o || {}; var d = arcNest(0, 12, 9, 6, 3, .2, Math.PI - .2, .06), i;
    for (i = 0; i < 3; i++) d += strand(-8 + i * 8, -22 + i * 3, 4, 1.5, 18, i * 1.7);
    return d; };
  /* 16 川 */
  PH.river = function (o) { o = o || {}; var d = "", i;
    for (i = 0; i < 3; i++) d += strand(-14 + i * 14, -30, 30, 3.6 - i * .5, 34, i * 1.3);
    return d; };
  /* 17 泽 */
  PH.lake = function (o) { o = o || {}; var d = arcNest(0, 0, 14, 6, 3, .2, Math.PI - .2, .05);
    return d + arcNest(0, 0, 14, 6, 3, Math.PI + .2, 2 * Math.PI - .2, .05); };
  /* 18 峰 */
  PH.peak = function (o) { o = o || {}; var d = "", i;
    for (i = 0; i < 3; i++) { var s = 1 - i * .22, y = 14 + i * 5;
      d += "M" + R(-30 * s) + " " + R(y) + " Q" + R(-11 * s) + " " + R(y - 34 * s) + " 0 " + R(y - 40 * s)
         + " Q" + R(13 * s) + " " + R(y - 32 * s) + " " + R(30 * s) + " " + R(y) + " "; }
    return d; };
  /* 19 谷 */
  PH.valley = function (o) { o = o || {}; var d = "", i;
    for (i = 0; i < 4; i++) { var y = -14 + i * 8;
      d += "M-32 " + R(y) + " Q-8 " + R(y + 22 - i * 3) + " 0 " + R(y + 24 - i * 3) + " Q9 " + R(y + 21 - i * 3) + " 32 " + R(y) + " "; }
    return d; };
  /* 20 崖 */
  PH.cliff = function (o) { o = o || {}; var d = "M-30 -26 L4 -26 Q14 -26 15 -16 L18 22 ", i;
    for (i = 0; i < 4; i++) d += "M" + R(-2 + i * 5) + " " + R(-18 + i * 9) + " L" + R(10 + i * 3) + " " + R(-14 + i * 9) + " ";
    return d + "M-32 22 L30 22 "; };
  /* 21 石 */
  /* Three stones sitting together, each an open arc resting on the ground line
     rather than one closed outline — closed was the only shape in the set that
     stopped reading as a drawn line. */
  PH.stone = function (o) { o = o || {}; var d = "M-32 16 L32 16 ", i;
    var S = [[-16, 13, .95], [4, 16, 1.25], [20, 10, .8]];
    for (i = 0; i < S.length; i++) { var cx = S[i][0], w = S[i][1], k = S[i][2];
      d += "M" + R(cx - w) + " 16 Q" + R(cx - w * .85) + " " + R(16 - 17 * k) + " " + R(cx) + " " + R(16 - 19 * k)
         + " Q" + R(cx + w * .9) + " " + R(16 - 16 * k) + " " + R(cx + w) + " 16 ";
      d += "M" + R(cx - w * .5) + " " + R(16 - 9 * k) + " Q" + R(cx) + " " + R(16 - 12 * k) + " " + R(cx + w * .55) + " " + R(16 - 8 * k) + " "; }
    return d; };
  /* 22 沙 */
  PH.dune = function (o) { o = o || {}; var d = "", i;
    for (i = 0; i < 5; i++) { var y = -6 + i * 7, s = 1 - i * .12;
      d += "M" + R(-34 * s) + " " + R(y) + " Q" + R(-6 * s) + " " + R(y - 17 * s) + " " + R(16 * s) + " " + R(y - 5 * s)
         + " Q" + R(26 * s) + " " + R(y + 1) + " " + R(34 * s) + " " + R(y) + " "; }
    return d; };
  /* 23 松 */
  PH.pine = function (o) { o = o || {}; var d = "M0 26 L0 -22 ", i;
    for (i = 0; i < 5; i++) { var y = -18 + i * 9, s = 6 + i * 5;
      d += "M0 " + R(y) + " Q" + R(-s * .6) + " " + R(y + 2) + " " + R(-s) + " " + R(y + 8)
         + " M0 " + R(y) + " Q" + R(s * .6) + " " + R(y + 2) + " " + R(s) + " " + R(y + 8) + " "; }
    return d; };
  /* 24 竹 */
  PH.bamboo = function (o) { o = o || {}; var d = "", i, j;
    for (i = 0; i < 3; i++) { var x = -14 + i * 14, lean = (i - 1) * 2.5;
      d += "M" + R(x - lean) + " 28 L" + R(x + lean) + " -28 ";
      for (j = 0; j < 4; j++) { var y = -20 + j * 13;
        d += "M" + R(x + lean * .5 - 3) + " " + R(y) + " L" + R(x + lean * .5 + 3) + " " + R(y) + " "; } }
    return d; };
  /* 25 苇 */
  PH.reed = function (o) { o = o || {}; var d = "", i;
    for (i = 0; i < 5; i++) { var x = -22 + i * 11, b = (i % 2 ? 1 : -1) * (5 + i);
      d += "M" + R(x) + " 28 Q" + R(x + b * .4) + " 2 " + R(x + b) + " -22 "
         + "M" + R(x + b) + " -22 Q" + R(x + b * 1.5) + " -27 " + R(x + b * 1.1) + " -30 "; }
    return d; };
  /* 26 叶 */
  PH.leaf = function (o) { o = o || {}; var d = "M0 -24 Q18 -8 0 22 Q-18 -8 0 -24 Z M0 -20 L0 18 ", i;
    for (i = 0; i < 4; i++) { var y = -12 + i * 8;
      d += "M0 " + R(y) + " Q" + R(7) + " " + R(y + 1) + " " + R(11 - i) + " " + R(y + 6)
         + " M0 " + R(y) + " Q" + R(-7) + " " + R(y + 1) + " " + R(-11 + i) + " " + R(y + 6) + " "; }
    return d; };
  /* 27 根 */
  /* Roots fork; a fan of equal strokes from one point reads as a broom. Each
     main runs to a fork, and only then splits. */
  PH.root = function (o) { o = o || {}; var d = "M0 -28 L0 -6 ", i;
    var A = [-1.05, -0.5, 0.15, 0.75];
    for (i = 0; i < A.length; i++) { var a = A[i] + Math.PI / 2, L = 15 + (i % 2) * 6;
      var fx = Math.cos(a) * L, fy = -6 + Math.sin(a) * L;
      d += "M0 -6 Q" + R(fx * .45) + " " + R(-6 + (fy + 6) * .7) + " " + R(fx) + " " + R(fy) + " ";
      d += "M" + R(fx) + " " + R(fy) + " Q" + R(fx * 1.3) + " " + R(fy + 5) + " " + R(fx * 1.45) + " " + R(fy + 11) + " ";
      d += "M" + R(fx) + " " + R(fy) + " Q" + R(fx * .95) + " " + R(fy + 6) + " " + R(fx * .8) + " " + R(fy + 12) + " "; }
    return d; };
  /* 28 烟 */
  /* ⚠️ strand() walks downward — `while (y < y1)`. Handing it y0 > y1 runs the
     loop zero times and returns a bare moveto, which draws nothing at all and
     is exactly what the first pass shipped: an empty cell. Smoke rises, so it
     is drawn downward and the widening is inverted instead. */
  PH.smoke = function (o) { o = o || {}; var d = "", i;
    for (i = 0; i < 3; i++) d += strand(-8 + i * 8, -26, 26, 1.6 + i * 1.6, 20 + i * 7, i * 2.1);
    return d; };
  /* 29 风 */
  PH.wind = function (o) { o = o || {}; var d = "", i;
    for (i = 0; i < 4; i++) { var y = -15 + i * 10, w = 26 + ((i * 5) % 3) * 8;
      d += "M" + R(-w) + " " + R(y) + " Q" + R(w * .3) + " " + R(y - 4) + " " + R(w * .78) + " " + R(y)
         + " Q" + R(w * 1.05) + " " + R(y + 4.5) + " " + R(w * .72) + " " + R(y + 6) + " "; }
    return d; };
  /* 30 雷 */
  PH.thunder = function (o) { o = o || {}; var d = arcNest(0, -14, 15, 6, 3, .18, Math.PI - .18, .05);
    return d + "M-8 4 L-1 4 L-6 14 L3 14 L-4 28 " + "M11 4 L16 4 L12 13 "; };
  function sineV_h(x0, x1, y, amp, period) {
    var d = "M" + R(x0) + " " + R(y), x = x0, k = 0;
    while (x < x1) { var nx = Math.min(x1, x + period / 2);
      d += "Q" + R((x + nx) / 2) + " " + R(y + ((k % 2) ? amp : -amp) * 2) + " " + R(nx) + " " + R(y) + " "; x = nx; k++; }
    return d + " ";
  }

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
