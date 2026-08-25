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
     Thirty things drawn the way the range and the cloud are drawn, which took
     a second pass to get right. The first set was clean line art: one outline
     per motif, straight rays and ticks, evenly spaced. It read as an icon set
     that happened to sit next to the landscape.

     Four rules were being missed, and they are what the range actually does:
       ① a form is ECHOED, three to six times, not stated once;
       ② echo offsets are IRREGULAR — a wobble and a drift on co-prime cycles,
          so spacing opens and closes along the form the way drawn hatching
          does. Even spacing is the thing that reads as machine-made;
       ③ almost nothing is straight. Even a bamboo cane bows;
       ④ ink is a fraction of the echo pitch, never a fixed number.

     Everything below is built through hand(), which is those rules in one
     place. Each motif supplies a curve as a function of (dx, dy, scale) and
     hand() repeats it. Deterministic: the same motif draws identically every
     time, for the same reason the brush and the palette order are seeded. */
  var PH = {};

  /* Co-prime cycles, exactly as LINE_WOBBLE and LINE_DRIFT do it on the range:
     7 against 5 means the pair does not repeat for 35 echoes. */
  var PH_WOB = [0, 2.4, -1.5, 1.1, -2.2, 1.8, -0.7];
  var PH_DRI = [0, -2.8, 1.9, -0.9, 3.2];

  function hand(fn, n, o) {
    o = o || {};
    var step = o.step == null ? 7 : o.step, seed = o.seed || 0,
        shrink = o.shrink || 0, spin = o.spin || 0, out = "";
    for (var k = 0; k < n; k++) {
      var dy = k * step + PH_WOB[(k + seed) % PH_WOB.length] * step * 0.2;
      var dx = PH_DRI[(k * 2 + seed) % PH_DRI.length] * step * 0.34;
      out += fn(dx + (o.dx || 0), dy + (o.dy || 0), 1 - shrink * k, k, spin * k);
    }
    return out;
  }
  /* A bow: the workhorse. Two control points pulled to opposite sides, which
     is the ridge's own S-curve reduced to one span. Nothing here uses a
     straight L where a bow will do. */
  function bow(x0, y0, x1, y1, lift, skew) {
    var mx = (x0 + x1) / 2, my = (y0 + y1) / 2, dx = x1 - x0, dy = y1 - y0;
    var len = Math.sqrt(dx * dx + dy * dy) || 1, nx = -dy / len, ny = dx / len;
    var s = skew == null ? 0.24 : skew;
    return "M" + R(x0) + " " + R(y0)
      + " C" + R(x0 + dx * (0.33 - s) + nx * lift * 1.15) + " " + R(y0 + dy * (0.33 - s) + ny * lift * 1.15)
      + " " + R(x0 + dx * (0.67 + s) + nx * lift * 0.85) + " " + R(y0 + dy * (0.67 + s) + ny * lift * 0.85)
      + " " + R(x1) + " " + R(y1) + " ";
  }
  function arcAt(cx, cy, r, a0, a1) {
    var x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0);
    var x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
    return "M" + R(x0) + " " + R(y0) + " A" + R(r) + " " + R(r) + " 0 "
      + (Math.abs(a1 - a0) > Math.PI ? 1 : 0) + " " + (a1 > a0 ? 1 : 0) + " " + R(x1) + " " + R(y1) + " ";
  }
  /* A stroke that wanders as it travels — the plume. Used for anything that
     rises or falls: smoke, water, reeds. Amplitude grows along its length so
     it loosens rather than repeating. */
  function plume(x, y0, y1, amp, waves, phase) {
    var d = "M" + R(x) + " " + R(y0), steps = waves * 2, dy = (y1 - y0) / steps;
    for (var i = 0; i < steps; i++) {
      var t = (i + 1) / steps, a = amp * (0.35 + t * 1.25) * ((i % 2) ? -1 : 1);
      d += "Q" + R(x + a * 1.7 + Math.sin(phase + i) * amp * 0.5) + " " + R(y0 + dy * (i + 0.5))
         + " " + R(x + Math.sin(phase + i * 1.7) * amp * 0.7) + " " + R(y0 + dy * (i + 1)) + " ";
    }
    return d;
  }

  /* 1 日 — a broken ring echoed outward, and the light is bowed, not spoked. */
  PH.sun = function () {
    var d = hand(function (dx, dy, s) { return arcAt(dx, dy - 3, 15 * s, -2.75 + dx * .02, 2.75 + dx * .02); },
      3, { step: 4, seed: 1, shrink: .1 });
    for (var i = 0; i < 9; i++) {
      var a = i * 2 * Math.PI / 9 + .3, r0 = 25 + (i % 3) * 2, r1 = r0 + 8 + (i % 2) * 5;
      d += bow(r0 * Math.cos(a), r0 * Math.sin(a), r1 * Math.cos(a), r1 * Math.sin(a), 1.6 * ((i % 2) ? 1 : -1));
    }
    return d;
  };
  /* 2 月 */
  PH.moon = function () {
    return hand(function (dx, dy, s) { return arcAt(dx, dy, 22 * s, -1.4, 1.4); }, 3, { step: 3, seed: 2, shrink: .07 })
         + hand(function (dx, dy, s) { return arcAt(13 + dx, dy, 20 * s, -1.18, 1.18); }, 2, { step: 3.4, seed: 5, shrink: .06 });
  };
  /* 3 瀑 */
  PH.waterfall = function () {
    var d = hand(function (dx, dy) { return plume(-16 + dx, -34 + dy * .3, 12 + dy * .2, 2.2, 3, dy); }, 5, { step: 8, seed: 3 });
    return d + hand(function (dx, dy, s) { return arcAt(dx, 20 + dy, 9 * s + 3, .28, Math.PI - .28); }, 4, { step: 5, seed: 6, shrink: -.14 });
  };
  /* 4 岚 */
  PH.haze = function () {
    return hand(function (dx, dy, s, k) {
      var w = 26 + ((k * 7) % 5) * 5;
      return bow(-w + dx, dy - 16, w * .86 + dx, dy - 16, 3.2 * ((k % 2) ? 1 : -1), .18);
    }, 6, { step: 7, seed: 4 });
  };
  /* 5 雨 */
  PH.rain = function () {
    var d = hand(function (dx, dy, s) { return arcAt(dx, -22 + dy, 15 * s, .2, Math.PI - .2); }, 3, { step: 4, seed: 2, shrink: -.1 });
    for (var i = 0; i < 8; i++) { var x = -24 + i * 6.8, y = -1 + ((i * 5) % 4) * 3;
      d += bow(x, y, x - 4, y + 15, 1.5 * ((i % 2) ? 1 : -1), .2); }
    return d;
  };
  /* 6 雪 */
  PH.snow = function () {
    var d = "";
    for (var i = 0; i < 6; i++) {
      var a = i * Math.PI / 3, cx = Math.cos(a), cy = Math.sin(a);
      d += bow(5 * cx, 5 * cy, 21 * cx, 21 * cy, 1.4 * ((i % 2) ? 1 : -1), .2);
      for (var j = 0; j < 2; j++) {
        var t = 11 + j * 5, bx = t * cx, by = t * cy, L = 5 - j * 1.2;
        d += bow(bx, by, bx + L * Math.cos(a + 1.05), by + L * Math.sin(a + 1.05), .7, .2);
        d += bow(bx, by, bx + L * Math.cos(a - 1.05), by + L * Math.sin(a - 1.05), -.7, .2);
      }
    }
    return d;
  };
  /* 7 浪 */
  PH.wave = function () {
    var d = hand(function (dx, dy, s) { return arcAt(dx, 10 + dy, 26 * s, Math.PI + .28, 2 * Math.PI - .28); }, 5, { step: 6, seed: 1, shrink: .12 });
    return d + hand(function (dx, dy, s) { return arcAt(19 + dx, -4 + dy, 12 * s, Math.PI * 1.06, Math.PI * 1.98); }, 3, { step: 4.5, seed: 4, shrink: .13 });
  };
  /* 8 涡 */
  PH.whirl = function () {
    var d = "", r = 27, a = 0;
    for (var i = 0; i < 11; i++) { d += arcAt(Math.sin(i) * 1.4, Math.cos(i) * 1.4, r, a, a + Math.PI * .68); a += Math.PI * .68; r *= .845; }
    return d;
  };
  /* 9 星 */
  PH.star = function () {
    var d = "";
    for (var i = 0; i < 5; i++) {
      var a = i * 2 * Math.PI / 5 - Math.PI / 2, L = 22 + (i % 2) * 3;
      d += bow(4 * Math.cos(a), 4 * Math.sin(a), L * Math.cos(a), L * Math.sin(a), 2.2 * ((i % 2) ? 1 : -1), .26);
      var b = a + Math.PI / 5;
      d += bow(3.4 * Math.cos(b), 3.4 * Math.sin(b), 9 * Math.cos(b), 9 * Math.sin(b), -1, .2);
    }
    return d + hand(function (dx, dy, s) { return arcAt(dx, dy, 5 * s, .4, 6.1); }, 2, { step: 2.4, seed: 3, shrink: .2 });
  };
  /* 10 电 */
  PH.lightning = function () {
    var d = hand(function (dx, dy, s) { return arcAt(dx, -20 + dy, 16 * s, .22, Math.PI - .22); }, 3, { step: 5, seed: 5, shrink: -.08 });
    d += bow(-3, -2, -10, 9, 1.6, .1) + bow(-10, 9, -3, 9, -1, .2) + bow(-3, 9, -9, 26, 2, .12);
    return d + bow(13, 0, 7, 9, 1.2, .1) + bow(7, 9, 13, 9, -.8, .2) + bow(13, 9, 8, 20, 1.4, .12);
  };
  /* 11 虹 — bands of unequal weight and reach, so it is not a set of nested
     circles. Every band starts and stops at a different angle. */
  PH.rainbow = function () {
    return hand(function (dx, dy, s, k) { return arcAt(dx, 18 + dy * .3, 15 + k * 5.4, .13 + k * .035, Math.PI - .13 - ((k % 2) ? .07 : .02)); },
      5, { step: 3, seed: 2 });
  };
  /* 12 露 */
  PH.dew = function () {
    var d = hand(function (dx, dy, s, k) { return bow(-30 + dx, dy - 10, 30 + dx, dy - 10, 4 * ((k % 2) ? 1 : -1), .2); }, 2, { step: 5, seed: 3 });
    for (var i = 0; i < 5; i++) { var x = -22 + i * 11, y = -1 + ((i * 3) % 3) * 2.4, h = 10 + (i % 2) * 3;
      d += bow(x, y, x, y + h, 3.6, .12) + bow(x, y, x, y + h, -3.6, .12); }
    return d;
  };
  /* 13 霜 */
  PH.frost = function () {
    var d = hand(function (dx, dy, s, k) { return bow(-33 + dx, 17 + dy, 33 + dx, 17 + dy, 1.8 * ((k % 2) ? 1 : -1), .2); }, 2, { step: 4, seed: 1 });
    for (var i = 0; i < 6; i++) { var x = -28 + i * 11, h = 11 + ((i * 5) % 4) * 5, dir = (i % 2) ? 1 : -1;
      d += bow(x, 17, x + dir * 2, 17 - h, 1.7 * dir, .18);
      d += bow(x + dir * 2, 17 - h, x + dir * 2 - 6, 17 - h + 6, .9, .2);
      d += bow(x + dir * 2, 17 - h, x + dir * 2 + 6, 17 - h + 6, -.9, .2); }
    return d;
  };
  /* 14 潮 */
  PH.tide = function () {
    return hand(function (dx, dy, s, k) {
      var d = "", x, seg = 5, w = 68 / seg;
      for (x = 0; x < seg; x++) d += bow(-34 + x * w + dx, dy - 14, -34 + (x + 1) * w + dx, dy - 14, 3.4 * ((x + k) % 2 ? 1 : -1), .2);
      return d;
    }, 5, { step: 7, seed: 2 });
  };
  /* 15 泉 */
  PH.spring = function () {
    var d = hand(function (dx, dy) { return plume(-7 + dx * 1.4, -24 + dy * .2, 6 + dy * .3, 2, 2, dy); }, 3, { step: 7, seed: 4 });
    return d + hand(function (dx, dy, s) { return arcAt(dx, 14 + dy, 8 * s + 2, .26, Math.PI - .26); }, 3, { step: 5, seed: 1, shrink: -.16 });
  };
  /* 16 川 */
  PH.river = function () {
    return hand(function (dx, dy) { return plume(-15 + dx * 1.5 + dy * .9, -32, 32, 3.4, 3, dy); }, 3, { step: 13, seed: 5 });
  };
  /* 17 泽 */
  PH.lake = function () {
    return hand(function (dx, dy, s, k) { return arcAt(dx, dy, 15 + k * 5, .22 + k * .05, Math.PI - .22 - k * .03); }, 3, { step: 2.5, seed: 3 })
         + hand(function (dx, dy, s, k) { return arcAt(dx, dy, 13 + k * 5.6, Math.PI + .3 - k * .04, 2 * Math.PI - .18 - k * .05); }, 3, { step: 2.5, seed: 6 });
  };
  /* 18 峰 */
  PH.peak = function () {
    return hand(function (dx, dy, s, k) {
      var w = 30 * s, h = 40 * s;
      return bow(-w + dx, 14 + dy, dx - 1, 14 - h + dy, 3.4, .3) + bow(dx - 1, 14 - h + dy, w + dx, 14 + dy, 3.8, -.3);
    }, 4, { step: 5, seed: 2, shrink: .19 });
  };
  /* 19 谷 */
  PH.valley = function () {
    return hand(function (dx, dy, s, k) {
      return bow(-32 + dx, dy - 16, dx + 1, dy + 8, 4.5, .28) + bow(dx + 1, dy + 8, 32 + dx, dy - 16, 4.2, -.28);
    }, 4, { step: 8, seed: 4 });
  };
  /* 20 崖 */
  PH.cliff = function () {
    var d = hand(function (dx, dy, s, k) { return bow(-30 + dx, -26 + dy, 6 + dx, -26 + dy, 1.6 * ((k % 2) ? 1 : -1), .2); }, 2, { step: 4, seed: 1 });
    d += hand(function (dx, dy) { return bow(8 + dx, -24, 17 + dx, 22, 3.2, .22); }, 3, { step: 4, seed: 5 });
    for (var i = 0; i < 4; i++) d += bow(-1 + i * 4, -17 + i * 9, 11 + i * 3, -13 + i * 9, 1.4, .2);
    return d + hand(function (dx, dy, s, k) { return bow(-32 + dx, 22 + dy, 30 + dx, 22 + dy, 1.4 * ((k % 2) ? 1 : -1), .2); }, 2, { step: 4, seed: 3 });
  };
  /* 21 石 */
  PH.stone = function () {
    var d = hand(function (dx, dy, s, k) { return bow(-33 + dx, 17 + dy, 33 + dx, 17 + dy, 1.5 * ((k % 2) ? 1 : -1), .2); }, 2, { step: 4, seed: 2 });
    var S = [[-17, 13, .95, 1], [4, 16, 1.2, 4], [21, 10, .78, 6]];
    for (var i = 0; i < S.length; i++) (function (cx, w, k, sd) {
      d += hand(function (dx, dy, s) {
        return bow(cx - w + dx, 17 + dy, cx + dx, 17 - 19 * k + dy, 3 * k, .3)
             + bow(cx + dx, 17 - 19 * k + dy, cx + w + dx, 17 + dy, 3.4 * k, -.3);
      }, 3, { step: 3.4, seed: sd, shrink: .16 });
    })(S[i][0], S[i][1], S[i][2], S[i][3]);
    return d;
  };
  /* 22 沙 */
  PH.dune = function () {
    return hand(function (dx, dy, s, k) {
      var w = 34 * s;
      return bow(-w + dx, dy - 6, w * .45 + dx, dy - 6 - 15 * s, 5 * s, .3) + bow(w * .45 + dx, dy - 6 - 15 * s, w + dx, dy - 6, 2.4 * s, -.34);
    }, 5, { step: 7, seed: 3, shrink: .1 });
  };
  /* 23 松 */
  PH.pine = function () {
    var d = bow(1, 27, -1, -22, 1.4, .2);
    for (var i = 0; i < 5; i++) { var y = -19 + i * 9.5, L = 6 + i * 5.2;
      d += hand(function (dx, dy) {
        return bow(dx * .3, y + dy, -L + dx, y + 9 + dy, 2.6, .28) + bow(dx * .3, y + dy, L + dx, y + 9 + dy, -2.6, .28);
      }, 2, { step: 3.2, seed: i + 1 }); }
    return d;
  };
  /* 24 竹 — even a cane bows, and the nodes are short arcs, not ticks. */
  PH.bamboo = function () {
    var d = "";
    for (var i = 0; i < 3; i++) { var x = -15 + i * 15, lean = (i - 1) * 3.2;
      d += bow(x - lean, 28, x + lean, -28, 2.4 * (i - 1 || 1), .24);
      for (var j = 0; j < 4; j++) { var t = j / 3, cx = x - lean + (2 * lean) * (1 - t), y = 28 - t * 50;
        d += arcAt(cx, y, 4.2, Math.PI * 1.12, Math.PI * 1.88); } }
    return d;
  };
  /* 25 苇 */
  PH.reed = function () {
    var d = "";
    for (var i = 0; i < 5; i++) { var x = -22 + i * 11, b = (i % 2 ? 1 : -1) * (6 + i * 1.6);
      d += bow(x, 28, x + b, -22, 3 + i * .4, .26);
      d += hand(function (dx, dy, s) { return bow(x + b + dx, -22 + dy, x + b * 1.5 + dx, -31 + dy, 2, .3); }, 2, { step: 2.6, seed: i }); }
    return d;
  };
  /* 26 叶 */
  PH.leaf = function () {
    var d = bow(0, -25, 1, 22, 15, .1) + bow(0, -25, -1, 22, -15, .1) + bow(0, -21, 0, 19, 1.2, .2);
    for (var i = 0; i < 5; i++) { var y = -15 + i * 8, L = 11 - Math.abs(i - 2) * 2;
      d += bow(0, y, L, y + 6, 1.8, .24) + bow(0, y, -L, y + 6, -1.8, .24); }
    return d;
  };
  /* 27 根 */
  PH.root = function () {
    var d = bow(0, -28, 0, -6, 1.2, .2), A = [-1.15, -0.55, .1, .72];
    for (var i = 0; i < A.length; i++) { var a = A[i] + Math.PI / 2, L = 15 + (i % 2) * 6;
      var fx = Math.cos(a) * L, fy = -6 + Math.sin(a) * L;
      d += bow(0, -6, fx, fy, 2.4 * ((i % 2) ? 1 : -1), .26);
      d += bow(fx, fy, fx * 1.42, fy + 11, 2, .24) + bow(fx, fy, fx * .78, fy + 12, -1.6, .24); }
    return d;
  };
  /* 28 烟 */
  PH.smoke = function () {
    return hand(function (dx, dy) { return plume(-8 + dx + dy * .5, -28, 26, 2.6, 3, dy); }, 3, { step: 8, seed: 6 });
  };
  /* 29 风 */
  PH.wind = function () {
    return hand(function (dx, dy, s, k) {
      var w = 28 + ((k * 5) % 3) * 7;
      return bow(-w + dx, dy - 16, w * .74 + dx, dy - 16, 3.6 * ((k % 2) ? 1 : -1), .2)
           + arcAt(w * .74 + dx, dy - 16 + 3, 3.4, -Math.PI / 2, Math.PI * .78);
    }, 4, { step: 9, seed: 2 });
  };
  /* 30 雷 */
  PH.thunder = function () {
    var d = hand(function (dx, dy, s) { return arcAt(dx, -16 + dy, 16 * s, .2, Math.PI - .2); }, 4, { step: 4.6, seed: 4, shrink: -.06 });
    d += bow(-6, 4, -13, 15, 1.7, .12) + bow(-13, 15, -5, 15, -1, .2) + bow(-5, 15, -11, 29, 2.1, .12);
    return d + bow(12, 4, 6, 13, 1.2, .12) + bow(6, 13, 13, 13, -.8, .2) + bow(13, 13, 9, 23, 1.3, .12);
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
