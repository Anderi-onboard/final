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
    /* `base0`/`baseSpan` say where the horizon sits in the box. The default is
       the one every existing caller was drawn against; a silhouette wants the
       range pushed down so the sky it stands against has somewhere to be. */
    var layers = opts.layers || 4, fo = opts.fill == null ? 1 : opts.fill,
        base0 = opts.base0 == null ? .40 : opts.base0,
        baseSpan = opts.baseSpan == null ? .30 : opts.baseSpan,
        ampFar = opts.amp == null ? .34 : opts.amp,
        ampNear = opts.ampNear == null ? .18 : opts.ampNear,
        out = "", uid = "lsc" + seed;
    out += '<clipPath id="' + uid + '"><rect width="' + w + '" height="' + h + '"/></clipPath>';
    out += '<g clip-path="url(#' + uid + ')">';
    for (var i = 0; i < layers; i++) {
      var t = i / (layers - 1 || 1);
      var top = ridgePath(seed + i * 977, w, h,
        { steps: 5 + i, amp: ampFar - t * (ampFar - ampNear), base: base0 + t * baseSpan });
      /* Read as a duotone plate: light ink on a coloured ground, the same way
         round as every pattern field. The old values (7–14% fill, ink on
         cream) put the range at the bottom of the tonal range on the lightest
         block on the page — technically an image, visually a smudge. */
      /* ⭐ Two readings of the same range. The plate mode keeps the masses very
         light and lets the contour lines carry it — that is the duotone the
         pattern cells want. The silhouette mode does the opposite: masses
         nearly solid and increasing toward the front, no contours at all, so
         the nearest ridge cuts hard against the sky. A landscape at 11% fill
         is line work; a place needs something standing in front of the light. */
      if (opts.silhouette) {
        /* ⚠️ Opaque, and each ridge its own tone — not one colour at rising
           opacity. A translucent range lets whatever is behind it read THROUGH
           the mountains, so a hard-edged sky band cuts a horizontal line across
           a ridge and the picture reads as a mistake rather than as a place.
           Layered flat colour is also what the references do: cut paper, one
           tone stopping where the next begins. */
        /* `scene` is the same masses under a different set of class names, so a
           quiet painted ground and a picture-contrast skyline can be toned
           independently by the sheets that own them. */
        var cls = opts.scene ? 'sc-land sc-l' : 'hz-land hz-l';
        out += '<path class="' + cls + (i + 1) + '" d="' + top + ' L' + w + ' ' + h + ' L0 ' + h
          + ' Z" fill="currentColor" opacity="' + (0.24 + t * 0.64).toFixed(3) + '"/>';
        continue;
      }
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
     Thirty things drawn in the range's own hand. Fifth pass. Each of the four
     before it failed in its own direction and every one is worth keeping:

       v1  clean line art, even spacing, straight rays. An icon set.
       v2  hand() repeated one curve three to six times: denser, and now all
           thirty were one scheme built from copies of one part.
       v3  every stroke drew its own numbers from a stream. The copying went
           and the hand went with it — 太细,太没有规则. 写意 is not randomness.
       v4  ribbons on co-prime cycles. Right idea, wrong grammar: I built the
           marks by GROWING branches off trunks, and let the weight run from
           1.9 to 7.4 across 56 different widths. Measured, not guessed: seven
           motifs had thirty places where one stroke sprouted from another.

     ⭐ The house grammar is not assembly, it is PLACEMENT. Look at what the
     range actually does: rounded lines of ONE weight, side by side, never
     touching, never sprouting, turning so slowly that no bend ever reads as a
     corner. A form is given by how a family of such lines is laid down —
     nested, stacked, fanned — not by joining parts into a picture. Everything
     below is built that way, which is why it finally looks like the site.

     Three rules, and all three are enforced by construction rather than by
     care, because care is what failed four times:

       W      one width for all 183 strokes. No per-stroke variation at all;
              the 爻's edge undulation stays (12–17% of W on the 3-cycle) so
              the ink is alive, but the ink is one weight.
       RMIN   nothing turns tighter than 15 units in a ±34 field — about four
              and a half times the width. bw() derives its own bow cap from
              this, so a bow tight enough to read as a corner cannot be
              expressed; arcs are floored at the same radius.
       CLEAR  no two strokes come within W + 1.5 of each other ANYWHERE,
              ends included. There are no joins, no forks and no branches, so
              there is nothing for a sharp meeting to happen at.

     Variation stays cyclic — weight is gone as a channel, so it is bow on 5
     against reach on 7, co-prime, the range's own LINE_WOBBLE/LINE_DRIFT law.
     Deterministic: a mark draws identically on every visit.

     ⚠️ Geometry lives in PLAN as centrelines; PH renders. The checker reads
     centrelines, because a ribbon's outline cannot tell placement from growth. */

  var TAU = Math.PI * 2, PI = Math.PI;

  var W = 3.3;        /* the one width */
  var RMIN = 15;      /* the gentlest turn the hand allows */
  /* Bow on five against reach on seven, co-prime: the pair does not come round
     for thirty-five, so no two strokes in a mark share a combination while each
     channel keeps a beat. Read through wrapping accessors — a cycle indexed
     past its own length is not a cycle, and 岚's sixth band silently became
     NaN the one time I indexed the array directly. */
  var B_CYC = [1, -0.58, 0.76, -1.12, 0.42];
  var R_CYC = [1, 0.84, 1.18, 0.9, 1.28, 0.76, 1.08];
  function Bc(i) { return B_CYC[((i % 5) + 5) % 5]; }
  function Rc(i) { return R_CYC[((i % 7) + 7) % 7]; }

  function pt(p) { return R(p[0]) + " " + R(p[1]); }

  /* ⚠️ The end condition matters. Duplicating the first and last point (the
     usual shortcut) shortens the tangent there to a sixth of the span, which
     bends the curve hard in its first and last tenth — the checker read r8 on
     arcs whose true radius was 15, and it was right: that is what was being
     drawn. Reflecting a virtual point instead gives the ends the same tangent
     length as the middle, so a curve enters and leaves as gently as it runs. */
  /* The virtual point beyond each end continues the curve's OWN turn rather
     than its straight line. Reflecting the position instead aims the end
     tangent along the chord, which is half a step off the true tangent, and
     the curve then bends hard in its first and last tenth to recover: the
     checker read r8 on arcs whose radius was 15, and it was reading what was
     actually drawn. For a circular arc this returns the previous point on the
     circle exactly, so the arc simply continues. */
  function extend(p0, p1, p2) {
    var v1x = p1[0] - p0[0], v1y = p1[1] - p0[1];
    var a1 = Math.atan2(v1y, v1x), a2 = Math.atan2(p2[1] - p1[1], p2[0] - p1[0]);
    var d = a2 - a1;
    while (d > PI) d -= TAU;
    while (d < -PI) d += TAU;
    var a0 = a1 - d, L = Math.sqrt(v1x * v1x + v1y * v1y);
    return [p0[0] - Math.cos(a0) * L, p0[1] - Math.sin(a0) * L];
  }

  function crSegs(p) {
    var segs = [], n = p.length, i;
    for (i = 0; i < n - 1; i++) {
      var a = i === 0 ? (n > 2 ? extend(p[0], p[1], p[2]) : [2 * p[0][0] - p[1][0], 2 * p[0][1] - p[1][1]]) : p[i - 1];
      var b = p[i], c = p[i + 1];
      var e = i + 2 < n ? p[i + 2]
        : (n > 2 ? extend(p[n - 1], p[n - 2], p[n - 3]) : [2 * p[n - 1][0] - p[n - 2][0], 2 * p[n - 1][1] - p[n - 2][1]]);
      segs.push([b,
        [b[0] + (c[0] - a[0]) / 6, b[1] + (c[1] - a[1]) / 6],
        [c[0] - (e[0] - b[0]) / 6, c[1] - (e[1] - b[1]) / 6],
        c]);
    }
    return segs;
  }

  /* One stroke of ink. The two long edges each undulate ONCE, the far edge at
     0.78 of the near edge's amplitude and on a different phase so the ribbon is
     never symmetric about its own centreline — barPath() lifted off the
     horizontal. Both undulations are zeroed at the two ends, which is what
     lets the caps be true half-rounds: v4 left them offset there and the cap
     cubic came to a beak, which is where the 尖锐部 came from. */
  function brush(pts, k) {
    var segs = crSegs(pts), m = segs.length, i, j;
    var a = W * (0.121 + (Math.abs(k || 0) % 3) * 0.0233), b = a * 0.78;
    var ph = Math.sin(2.4), dN = [], dF = [];
    /* ⚠️ Zeroing the far edge at both ends (which is what lets the caps be
       clean half-rounds) also biases its mean inward by b·sin(phase), so every
       ribbon painted about 15% thin — measured, not noticed: the plan carries
       no width, so nothing else in the test could have seen it. Carry that
       back into the half-width and the mean lands on W. */
    var half = (W + b * ph) / 2;
    for (i = 0; i <= m; i++) {
      var t = m ? i / m : 0;
      dN.push(half + a * Math.sin(TAU * t));
      dF.push(half + b * (Math.sin(TAU * t + 2.4) - ph));
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
    /* a true half-round, two quarter-circle cubics, centred on the centreline's
       own endpoint — not a single cubic stretched between two offset edges */
    var K = half * 0.5523;
    function capAt(P, n, u) {
      var A = off(P, n, half), Bp = off(P, n, -half), Tp = off(P, u, half);
      return " C" + pt(off(A, u, K)) + " " + pt(off(Tp, n, K)) + " " + pt(Tp)
        + " C" + pt(off(Tp, n, -K)) + " " + pt(off(Bp, u, K)) + " " + pt(Bp);
    }
    var n0 = nrm(segs[0], 0), n1 = nrm(segs[m - 1], 1);
    var head = segs[0][0], tail = segs[m - 1][3];

    var d = "M" + pt(off(head, n0, half));
    for (i = 0; i < m; i++) d += " C" + pt(near[i][1]) + " " + pt(near[i][2]) + " " + pt(near[i][3]);
    /* ⚠️ The outward direction at each end, not the inward one. Both caps were
       bulging BACK into the ribbon — it cost a sixth of the ink and cut a notch
       at every end, which is the second place the 尖锐部 were coming from. The
       bounding box gave it away: 18.5 tall for a stroke that should have
       measured 21.3 with its two half-rounds on. */
    d += capAt(tail, n1, [n1[1], -n1[0]]);
    for (j = m - 1; j >= 0; j--) d += " C" + pt(far[j][2]) + " " + pt(far[j][1]) + " " + pt(far[j][0]);
    return d + capAt(head, [-n0[0], -n0[1]], [-n0[1], n0[0]]) + " Z ";
  }

  /* A gently bowed run — the workhorse, and the only way a bend is expressed.
     The belly is shrunk until what will be DRAWN turns no tighter than RMIN,
     measured on the curve rather than estimated from the sine: the closed form
     L²/(π²b) is right for a sine and the stations are carried by Catmull–Rom,
     which is close but not equal, and "close" showed up as r13.7 where the
     formula promised 15. Four passes of promising to be careful about corners
     is what this replaces — a turn sharp enough to read as one cannot now be
     written at all. */
  function bw(x0, y0, x1, y1, frac) {
    var dx = x1 - x0, dy = y1 - y0, L = Math.sqrt(dx * dx + dy * dy) || 1;
    var nx = -dy / L, ny = dx / L, bow = frac * L, guard = 0;
    function build(b) {
      var out = [], i;
      for (i = 0; i <= 6; i++) {
        var t = i / 6, s = Math.sin(PI * t) * b;
        out.push([x0 + dx * t + nx * s, y0 + dy * t + ny * s]);
      }
      return out;
    }
    while (guard++ < 60 && minRadius(build(bow)) < RMIN) bow *= 0.92;
    return build(bow);
  }

  /* The radius a set of stations will actually be drawn at, measured on the
     curve crSegs will lay down rather than estimated from a formula. */
  function minRadius(p) {
    var segs = crSegs(p), worst = Infinity, i, j, prev = null, prev2 = null;
    for (i = 0; i < segs.length; i++) {
      for (j = 1; j <= 12; j++) {
        var t = j / 12, u = 1 - t, sg = segs[i];
        var q = [u * u * u * sg[0][0] + 3 * u * u * t * sg[1][0] + 3 * u * t * t * sg[2][0] + t * t * t * sg[3][0],
                 u * u * u * sg[0][1] + 3 * u * u * t * sg[1][1] + 3 * u * t * t * sg[2][1] + t * t * t * sg[3][1]];
        if (prev2) {
          var A = Math.sqrt(Math.pow(prev[0] - prev2[0], 2) + Math.pow(prev[1] - prev2[1], 2));
          var B = Math.sqrt(Math.pow(q[0] - prev[0], 2) + Math.pow(q[1] - prev[1], 2));
          var C = Math.sqrt(Math.pow(q[0] - prev2[0], 2) + Math.pow(q[1] - prev2[1], 2));
          var ar = Math.abs((prev[0] - prev2[0]) * (q[1] - prev2[1]) - (q[0] - prev2[0]) * (prev[1] - prev2[1])) / 2;
          if (ar > 1e-9) worst = Math.min(worst, A * B * C / (4 * ar));
        }
        prev2 = prev; prev = q;
      }
    }
    return worst;
  }

  /* Same run with its crest moved off the middle, which is how a dune ridge
     differs from a swell. ⚠️ The skew piles the turn onto one side, so bw()'s
     flat cap does not hold here — 谷 and 沙 came out at r10 under a formula
     that promised 15. So it MEASURES: shrink the belly until what will be drawn
     is gentle enough. An estimate that is right for the symmetric case and
     quietly wrong for the skewed one is the shape of every bug in this file. */
  function swell(x0, y0, x1, y1, frac, at) {
    var dx = x1 - x0, dy = y1 - y0, L = Math.sqrt(dx * dx + dy * dy) || 1;
    var nx = -dy / L, ny = dx / L, k = Math.log(0.5) / Math.log(at);
    var bow = frac * L, guard = 0;
    function build(b) {
      var out = [], j;
      for (j = 0; j <= 8; j++) {
        var t = j / 8, s = Math.sin(PI * Math.pow(t, k)) * b;
        out.push([x0 + dx * t + nx * s, y0 + dy * t + ny * s]);
      }
      return out;
    }
    while (guard++ < 60 && minRadius(build(bow)) < RMIN) bow *= 0.92;
    return build(bow);
  }

  /* A circular arc, floored at RMIN so it can never be a tight ring, sampled
     as points rather than written as an `A` command: a true arc drawn in one
     stroke is the one curve a hand cannot make. */
  function arc(cx, cy, rad, a0, a1, n) {
    var out = [], i, r0 = Math.max(RMIN + 1.5, rad);   /* the floor with the CR approximation's margin on it */
    n = Math.max(n, Math.ceil(Math.abs(a1 - a0) / 0.3));
    for (i = 0; i <= n; i++) {
      var t = i / n, ang = a0 + (a1 - a0) * t;
      out.push([cx + r0 * Math.cos(ang), cy + r0 * Math.sin(ang)]);
    }
    return out;
  }

  function fam(n, f) { var out = [], i; for (i = 0; i < n; i++) out.push(f(i)); return out; }

  var PLAN = {};

  /* ⭐ Every family below staggers its members' EXTENT, not just their
     position. Four rows of the same run at four heights is a mirror and a
     stamp at the same time — the checker reported both on 潮, 川, 浪 and 月 the
     moment they were laid out that way. Different reaches break both at once,
     which is why the length lists are written out rather than derived. */

  /* 1 日 — four broken rings, each opening somewhere else. Light read as
     nested contour rather than as spokes. */
  PLAN.sun = function () {
    return fam(4, function (i) {
      var a0 = -2.55 + Bc(i) * 0.3;
      return arc(0, 0, 16 + i * 5.5, a0, a0 + 4.3 * Rc(i), 9);
    });
  };

  /* 2 月 — the same nesting with the centre off to one side: four C's opening
     the same way, each cut at a different angle top and bottom so the crescent
     is not its own mirror. */
  PLAN.moon = function () {
    return fam(4, function (i) {
      return arc(3, 0, 16 + i * 5.6, -2.3 + i * 0.18, 1.35 + i * 0.22, 8);
    });
  };

  /* 3 瀑 — five falls of graded reach, two long shallows well below them.
     Nothing arrives, which is what puts the drop out of sight. */
  PLAN.waterfall = function () {
    var top = [-33, -27, -31, -24, -29], bot = [12, 0, 7, -6, 4];
    var out = fam(5, function (i) {
      var x = -16 + i * 8;
      return bw(x, top[i], x + Bc(i) * 2, bot[i], Bc(i) * 0.04);
    });
    out.push(bw(-24, 19, 18, 20, 0.11));
    out.push(bw(-11, 30, 29, 29, 0.07));
    return out;
  };

  /* 4 岚 — mountain vapour: bands that begin and end where they begin and end. */
  PLAN.haze = function () {
    var len = [52, 30, 44, 22, 60, 36];
    return fam(6, function (i) {
      var x0 = -31 + Bc(i) * 4, y = -22 + i * 8.8;
      return bw(x0, y, x0 + len[i], y + Bc(i) * 1.4, Bc(i) * 0.03);
    });
  };

  /* 5 雨 — one long sag of sky, and rain of unequal reach raked one way. */
  PLAN.rain = function () {
    var len = [30, 14, 24, 36, 18, 28, 21];
    var out = [bw(-30, -29, 28, -27, 0.07)];
    return out.concat(fam(7, function (i) {
      var x = -28 + i * 8.8, y = -12 + Bc(i) * 2;
      return bw(x, y, x - 4, y + len[i], Bc(i) * 0.04);
    }));
  };

  /* 6 雪 — a drift, not a crystal: two banks and nine falls on one bearing.
     Six-fold anything is out twice over, by ③ and by ⑥. */
  PLAN.snow = function () {
    var out = [bw(-30, 17, 30, 15, 0.11), bw(-26, 27, 28, 26, 0.07)];
    var P = [[-26, -30], [-9, -32], [8, -29], [24, -31], [-22, -18],
             [-4, -20], [14, -16], [28, -19], [-14, -6]];
    var len = [12, 8, 14, 9, 11, 13, 7, 10, 12];
    return out.concat(fam(9, function (i) {
      return bw(P[i][0], P[i][1], P[i][0] - len[i] * 0.42, P[i][1] + len[i] * 0.91, Bc(i) * 0.05);
    }));
  };

  /* 7 浪 — five swells stacked, each shallower and each crossing the frame on
     its own two points. */
  PLAN.wave = function () {
    var x0 = [-29, -33, -31, -32, -30], x1 = [33, 29, 32, 30, 33];
    return fam(5, function (i) {
      return bw(x0[i], -6 + i * 9.5, x1[i], -3 + i * 9.5, -(0.31 - i * 0.062));
    });
  };

  /* 8 涡 — one stroke inward, never lifting, shrinking slowly enough that the
     coils stay a clearance apart and the curve never turns under RMIN. */
  PLAN.whirl = function () {
    var pts = [], i;
    for (i = 0; i <= 24; i++) {
      var a = 0.4 + i * 0.52, rad = 33 - i * 0.56;
      pts.push([Math.cos(a) * rad, Math.sin(a) * rad]);
    }
    return [pts];
  };

  /* 9 星 — six rays off a hole wide enough that they never meet, answered by
     two smaller lights out where no ray points. */
  PLAN.star = function () {
    var ang = [], a = 0.55, i;
    for (i = 0; i < 6; i++) { ang.push(a); a += 0.88 + Rc(i * 3) * 0.22; }
    var out = fam(6, function (j) {
      var r2 = 22 + Rc(j) * 9;
      return bw(Math.cos(ang[j]) * 7, Math.sin(ang[j]) * 7,
        Math.cos(ang[j]) * r2, Math.sin(ang[j]) * r2, Bc(j) * 0.03);
    });
    [0, 1].forEach(function (j) {
      var mid = (ang[j] + ang[j + 1]) / 2, cx = Math.cos(mid) * 26, cy = Math.sin(mid) * 26;
      var b = 0.4 + j * 1.7, i;
      for (i = 0; i < 3; i++) {
        out.push(bw(cx + Math.cos(b) * 3, cy + Math.sin(b) * 3,
          cx + Math.cos(b) * 8.4, cy + Math.sin(b) * 8.4, 0.03));
        b += 1.9 + Rc(i + j * 2) * 0.3;
      }
    });
    return out;
  };

  /* 10 电 — four falls leaning one way at wildly unequal reach, tight together
     under one edge of sky. The folded Z is both the icon and the 棱角; a strike
     read as a rake of light is neither. */
  PLAN.lightning = function () {
    var len = [46, 18, 32, 12];
    var out = fam(4, function (i) {
      var x = -13 + i * 9, y = -14 + Bc(i) * 3;
      return bw(x, y, x - 5, y + len[i], Bc(i) * 0.035);
    });
    out.push(bw(-26, -30, 24, -28, 0.08));
    return out;
  };

  /* 11 虹 — four bands on one centre, so they cannot cross, sharing nothing
     else: four spans, four openings, four gaps. */
  PLAN.rainbow = function () {
    return fam(4, function (i) {
      var a0 = PI + 0.2 + Bc(i) * 0.14;
      return arc(0, 26, 16 + i * 5.8, a0, a0 + 2.6 * Rc(i), 8);
    });
  };

  /* 12 露 — one long edge and six drops of unequal length beneath it. */
  PLAN.dew = function () {
    var len = [17, 9, 20, 12, 15, 8, 18];
    var out = [bw(-31, -15, 31, -9, 0.08)];
    return out.concat(fam(7, function (i) {
      var x = -27 + i * 9, t = 3 + Bc(i) * 3;
      return bw(x, t, x + Bc(i) * 1.5, t + len[i], Bc(i) * 0.03);
    }));
  };

  /* 13 霜 — a fan of spikes off one base, none of them touching it and none
     touching each other. Frost as placement, not as a branching crystal. */
  PLAN.frost = function () {
    var len = [22, 11, 18, 25, 13, 20, 15];
    var out = [bw(-31, 25, 31, 22, 0.07)];
    return out.concat(fam(7, function (i) {
      var x = -27 + i * 9;
      return bw(x, 17, x + 2 + Bc(i), 17 - len[i], Bc(i) * 0.035);
    }));
  };

  /* 14 潮 — long water, five swells all leaning the same way at an even pitch.
     Where 岚 staggers its bellies, 潮 keeps time and staggers its reach. */
  PLAN.tide = function () {
    var x0 = [-32, -25, -31, -18, -28], x1 = [22, 32, 15, 31, 29], tilt = [2, -3, 1, -2, 3];
    return fam(5, function (i) {
      var y = -20 + i * 10;
      return bw(x0[i], y, x1[i], y + tilt[i], 0.024 + i * 0.016);
    });
  };

  /* 15 泉 — four jets opening upward and two shallows widening below. */
  PLAN.spring = function () {
    var len = [26, 18, 30, 21];
    var out = fam(4, function (i) {
      var x = -9 + i * 6;
      return bw(x, 6, x + (i - 1.5) * 4, 6 - len[i], Bc(i) * 0.04);
    });
    out.push(bw(-20, 16, 18, 17, 0.12));
    out.push(bw(-29, 25, 27, 24, 0.085));
    return out;
  };

  /* 16 川 — four currents down the frame at an uneven pitch, bellies
     alternating so the water reads as moving rather than as four rules. */
  PLAN.river = function () {
    var x = [-20, -7, 5, 19], top = [-33, -28, -32, -26], bot = [29, 33, 26, 32];
    return fam(4, function (i) {
      return bw(x[i] + Bc(i) * 3, top[i], x[i] - Bc(i) * 3, bot[i], Bc(i) * 0.045);
    });
  };

  /* 17 泽 — two shores on one centre, open on the same side and cut to
     different spans, with two soundings inside them. */
  PLAN.lake = function () {
    var out = fam(2, function (i) {
      return arc(0, 0, 24 + i * 7, 0.35 + i * 0.55, 0.35 + i * 0.55 + 4.6 - i * 0.55, 14);
    });
    out.push(bw(-13, -4, 9, -7, 0.08));
    out.push(bw(-9, 8, 14, 5, -0.07));
    return out;
  };

  /* 18 峰 — four ranges nested, each shallower and each crowned further along
     its span than the one in front. This is the range's own drawing. */
  PLAN.peak = function () {
    return fam(4, function (i) {
      return swell(-32, 8 + i * 7, 32, 6 + i * 7, -(0.3 - i * 0.045), 0.4 + i * 0.07);
    });
  };

  /* 19 谷 — the same read the other way up, which is what ⑤ allows: shared
     structure, no shared measurement. */
  PLAN.valley = function () {
    var x0 = [-24, -28, -31, -33], x1 = [22, 27, 31, 33];
    return fam(4, function (i) {
      return swell(x0[i], -26 + i * 10, x1[i], -28 + i * 10, 0.32 - i * 0.05, 0.38 + i * 0.06);
    });
  };

  /* 20 崖 — strata to the left, the face to the right, and a wide gap between
     them. That gap is the cliff. */
  PLAN.cliff = function () {
    var end = [-8, -15, -4, -12];
    var out = fam(4, function (i) {
      return bw(-32, -22 + i * 10, end[i], -20 + i * 10, Bc(i) * 0.045);
    });
    return out.concat(fam(3, function (i) {
      var x = 7 + i * 10;
      return bw(x, -30 + i * 3, x + 4 + Bc(i) * 2, 28 - i * 4, Bc(i) * 0.04);
    }));
  };

  /* 21 石 — low swells, not domes. At this gentleness a small tall stone is
     not expressible, and that is the constraint doing its job: what comes out
     is a boulder half-buried, which is what a stone in a landscape is. */
  PLAN.stone = function () {
    return [
      bw(-33, 27, 33, 25, 0.045),
      bw(-33, 17, -7, 19, -0.12),
      bw(-27, 6, -7, 8, -0.16),
      bw(2, 20, 30, 18, -0.1),
      bw(9, 9, 25, 10, -0.17),
      bw(-4, -3, 18, -1, -0.09)
    ];
  };

  /* 22 沙 — four ridges, each with its crest at a different place along the
     span. Stacked identical humps are a fabric swatch. */
  PLAN.dune = function () {
    return fam(4, function (i) {
      return swell(-32, -14 + i * 11, 32, -16 + i * 11, -(0.1 + i * 0.02), 0.28 + i * 0.16);
    });
  };

  /* 23 松 — a trunk and six boughs that do not touch it. In this grammar a
     bough is PLACED beside the trunk, not grown out of it, and the tree reads
     the same while the mark stays a family of separate lines. */
  PLAN.pine = function () {
    var out = [bw(2, 32, -2, -28, 0.04)];
    var side = [1, -1, 1, -1, -1, 1], reach = [21, 19, 17, 14, 11, 8];
    return out.concat(fam(6, function (i) {
      var y = 21 - i * 7.4, tx = 2 - 4 * (32 - y) / 60, s = side[i];
      return bw(tx + s * 7.5, y, tx + s * (7.5 + reach[i]), y - 5, s * Bc(i) * 0.05);
    }));
  };

  /* 24 竹 — the node is a GAP. A bar across the cane would be a crossing on
     every cane; leaving the internodes apart says the same thing in this hand. */
  PLAN.bamboo = function () {
    var C = [[-18, 32, -14, -28, [0.28, 0.63], -1, 0.55],
             [2, 31, 5, -30, [0.24, 0.55], 1, 0.3],
             [20, 33, 24, -24, [0.44], -1, 0.6]];
    var out = [], i, j;
    for (i = 0; i < C.length; i++) {
      var x0 = C[i][0], y0 = C[i][1], x1 = C[i][2], y1 = C[i][3];
      var marks = [0].concat(C[i][4], [1]);
      for (j = 0; j + 1 < marks.length; j++) {
        var a = marks[j] + (j ? 0.05 : 0), b = marks[j + 1] - (j + 2 === marks.length ? 0 : 0.05);
        out.push(bw(x0 + (x1 - x0) * a, y0 + (y1 - y0) * a,
          x0 + (x1 - x0) * b, y0 + (y1 - y0) * b, Bc(i * 3 + j) * 0.05));
      }
      var sd = C[i][5], f = C[i][6];
      var my = y0 + (y1 - y0) * f, mx = x0 + (x1 - x0) * f;
      out.push(bw(mx + sd * 7.5, my + 2, mx + sd * 12, my - 4, sd * 0.05));
    }
    return out;
  };

  /* 25 苇 — the lean shortens rank by rank, so the bed fans without ever
     converging. */
  PLAN.reed = function () {
    var top = [-8, -24, -13, -30, -18];
    return fam(5, function (i) {
      var x = -24 + i * 12;
      return bw(x, 30, x + 9 - i * 1.6, top[i], Bc(i) * 0.045);
    });
  };

  /* 26 叶 — two flanks that approach and stop short, and three soundings
     between them. Two strokes meeting at a tip make a point. */
  PLAN.leaf = function () {
    return [
      bw(-2, -30, 0, 28, 0.22),
      bw(3, -27, 5, 31, -0.3),
      bw(-4, -13, 5, -15, 0.06),
      bw(-8, 1, 13, -2, 0.04),
      bw(-2, 15, 8, 12, 0.08)
    ];
  };

  /* 27 根 — a taproot and five laterals that leave from beside it at five
     bearings. Nothing rejoins and nothing sprouts; a root system that closes a
     loop is a diagram of one. */
  PLAN.root = function () {
    var out = [bw(-1, -32, 1, -8, 0.04)];
    var from = [[-7, -23], [-8, -13], [-7, -2], [9, -19], [10, 5]];
    var ang = [2.62, 2.24, 1.9, 0.62, 0.15], len = [21, 27, 24, 29, 22];
    return out.concat(fam(5, function (i) {
      return bw(from[i][0], from[i][1],
        from[i][0] + Math.cos(ang[i]) * len[i], from[i][1] + Math.sin(ang[i]) * len[i], Bc(i) * 0.04);
    }));
  };

  /* 28 烟 — three columns leaning apart as they rise, bellies alternating. */
  PLAN.smoke = function () {
    var top = [[-17, -30], [2, -33], [16, -27]];
    return fam(3, function (i) {
      return bw(-8 + i * 8, 30, top[i][0], top[i][1], Bc(i) * 0.05);
    });
  };

  /* 29 风 — four gusts of very unequal reach at an uneven pitch. */
  PLAN.wind = function () {
    var len = [56, 30, 46, 24], x0 = [-32, -24, -30, -18];
    return fam(4, function (i) {
      var y = -20 + i * 13;
      return bw(x0[i], y, x0[i] + len[i], y + Bc(i) * 2, 0.05);
    });
  };

  /* 30 雷 — the mass is the subject and the strike is the aside, which is the
     whole difference from 电. */
  PLAN.thunder = function () {
    var len = [24, 14, 19];
    var out = fam(3, function (i) {
      var a0 = PI + 0.35 + Bc(i) * 0.14;
      return arc(0, -6, 17 + i * 6, a0, a0 + 2.35 * Rc(i), 8);
    });
    return out.concat(fam(3, function (i) {
      var x = -12 + i * 12;
      return bw(x, 6, x - 5, 6 + len[i], Bc(i) * 0.035);
    }));
  };

  /* ── twelve more ─────────────────────────────────────────────────────────
     ⭐ The vocabulary grows by adding STRUCTURES, not by adding subjects. The
     first thirty already hold four band motifs; a fifth set of bands under a
     new name is one more word for a thing the sheet can already say. Each of
     these is a shape the catalogue did not have: a spine with ribs beside it, a
     stem with grains in two columns, a meander, a cluster of very short marks,
     nested chevrons, rings about an off-centre point.

     ⚠️ Same grammar, no exceptions. One width, nothing turning tighter than
     RMIN, and no two centrelines closer than W + 1.5 anywhere INCLUDING their
     ends — which is why a fern's ribs are placed beside its spine and never
     joined to it, exactly as the pine's boughs are. Every measurement is
     written out rather than derived from a loop variable, because a family
     generated by one expression is a family the sameness checker will reject:
     that is what "structural repetition cannot be fixed by tuning" means. */

  /* 31 霞 — afterglow: a fan, not a stack. The bands share a general direction
     and no two share an angle, a length or a starting edge. */
  PLAN.glow = function () {
    var x0 = [-33, -27, -32, -21, -29], y0 = [-26, -14, -2, 11, 24];
    var x1 = [12, 31, 23, 33, 17],      y1 = [-31, -21, -8, 5, 18];
    var bow = [0.06, -0.03, 0.09, -0.05, 0.12];
    return fam(5, function (i) {
      return bw(x0[i], y0[i], x1[i], y1[i], bow[i]);
    });
  };

  /* 32 雾 — fog lies in broken lengths at an uneven pitch, and the breaks do
     not line up. Written out as segments: a loop would put the gap in the same
     place on every row, which is a fabric, not weather. */
  PLAN.fog = function () {
    var seg = [[-31, -27, -9, -25], [6, -31, 31, -29], [-25, -14, 13, -17],
               [19, -6, 33, -4], [-33, 3, -5, 7], [9, 12, 32, 9],
               [-28, 21, 4, 25], [12, 31, 33, 28]];
    var bow = [0.05, -0.09, 0.03, -0.12, 0.07, -0.04, 0.10, -0.06];
    return seg.map(function (t, i) { return bw(t[0], t[1], t[2], t[3], bow[i]); });
  };

  /* 33 冰 — nested chevrons: the crest of each sits at a different place along
     its span, so the set cannot be read as one shape at four scales. */
  PLAN.ice = function () {
    var at = [0.34, 0.60, 0.44, 0.68];
    var x0 = [-30, -33, -25, -32], x1 = [27, 33, 21, 30];
    var bow = [-0.13, -0.09, -0.15, -0.07];
    return fam(4, function (i) {
      return swell(x0[i], 24 - i * 16, x1[i], 21 - i * 16, bow[i], at[i]);
    });
  };

  /* 34 苔 — moss is many very short marks at uneven density, the one motif in
     the set whose subject IS its density. Nothing here is long enough to read
     as a line, which is what keeps it from becoming a field of tally marks. */
  PLAN.moss = function () {
    var m = [[-27, -22, -18, -25], [-8, -27, 1, -24], [14, -21, 24, -23],
             [-30, -9, -22, -12], [-13, -12, -3, -14], [7, -8, 17, -11], [25, -13, 33, -10],
             [-26, 5, -16, 3], [-5, 2, 6, 4], [16, 6, 27, 3],
             [-29, 19, -20, 17], [-11, 22, 0, 20], [10, 17, 21, 19], [26, 24, 33, 22],
             [-19, 31, -8, 30], [4, 32, 15, 30]];
    return m.map(function (t, i) { return bw(t[0], t[1], t[2], t[3], Bc(i) * 0.09); });
  };

  /* 35 藤 — one long meander with three short shoots set beside it. The shoots
     are PLACED, never joined: a vine that grows out of its own stem would be a
     junction, and this grammar has none. */
  PLAN.vine = function () {
    return [
      swell(-24, 33, -15, -8, 0.26, 0.38),
      swell(-2, 2, 8, -33, -0.21, 0.56),
      bw(12, 27, 31, 19, 0.10),
      bw(-33, 2, -24, 17, -0.13),
      bw(15, -3, 32, -10, 0.08),
      bw(-30, -20, -15, -27, -0.11)
    ];
  };

  /* 36 蕨 — a curved spine with ribs alongside it, the ribs shortening towards
     the tip and alternating sides at an uneven pitch. */
  PLAN.fern = function () {
    var out = [swell(-4, 33, 4, -31, 0.12, 0.44)];
    var y = [23, 13, 2, -8, -17, -25];
    var reach = [16, 18, 14, 12, 9, 7];
    var side = [-1, 1, -1, 1, -1, 1];
    for (var i = 0; i < 6; i++) {
      out.push(bw(side[i] * 16, y[i], side[i] * (16 + reach[i]), y[i] - 7 - Bc(i) * 2,
                  side[i] * 0.09));
    }
    return out;
  };

  /* 37 穗 — a stem with the grain in two staggered columns, the columns set at
     different heights so the ear is not its own mirror. */
  PLAN.grain = function () {
    var out = [swell(2, 33, -2, -27, 0.06, 0.52)];
    var L = [[-13, -21, -25, -27], [-14, -8, -27, -13], [-15, 5, -28, 1], [-14, 19, -26, 16]];
    var Rr = [[13, -26, 25, -32], [14, -14, 28, -19], [15, 0, 29, -4], [14, 13, 26, 10], [12, 25, 23, 23]];
    L.forEach(function (t, i) { out.push(bw(t[0], t[1], t[2], t[3], -0.10 - Bc(i) * 0.02)); });
    Rr.forEach(function (t, i) { out.push(bw(t[0], t[1], t[2], t[3], 0.09 + Bc(i) * 0.02)); });
    return out;
  };

  /* 38 芽 — a sprout is two leaves of different reach beside a short stem, and
     nothing else. The smallest motif in the set on purpose: the catalogue was
     all full-field subjects, and a page of those has no quiet mark in it. */
  PLAN.sprout = function () {
    return [
      swell(1, 33, -3, -12, 0.09, 0.46),
      swell(-9, -6, -30, -28, 0.20, 0.40),
      swell(9, -12, 29, -32, -0.18, 0.56),
      bw(-14, 16, -31, 9, -0.10),
      bw(11, 20, 30, 13, 0.09),
      bw(-31, 26, -14, 32, 0.06)
    ];
  };

  /* 39 溪 — a brook is narrow: three lines that keep company down the field and
     bend at different places, which is what makes it a channel rather than the
     four separate runs of 川. */
  PLAN.brook = function () {
    return [
      swell(-19, -33, -12, 32, 0.11, 0.34),
      swell(-1, -32, 5, 33, 0.11, 0.62),
      swell(17, -30, 23, 31, 0.15, 0.46)
    ];
  };

  /* 40 潭 — rings about an off-centre point, each opening on a different side.
     Distinct from 泽, whose two shores open the same way and hold soundings. */
  PLAN.pool = function () {
    var rad = [16.5, 22.2, 27.6, 33];
    return fam(4, function (i) {
      var a0 = -1.1 + i * 1.7 + Bc(i) * 0.25;
      return arc(0, 0, rad[i], a0, a0 + 3.9 + Rc(i) * 0.8, 12);
    });
  };

  /* 41 屿 — one island with two lesser ones and the water going past. The
     mounds are of three different reaches; equal mounds would be a chart. */
  PLAN.isle = function () {
    return [
      swell(-30, -6, 6, -4, -0.34, 0.46),
      swell(11, 1, 31, 2, -0.26, 0.38),
      swell(-27, 10, -11, 11, -0.22, 0.58),
      bw(-33, 20, 19, 22, 0.05),
      bw(-13, 32, 33, 30, -0.04)
    ];
  };

  /* 42 坡 — a slope read as four falls of graded length across the field, none
     of them parallel and none of them starting at the same edge. */
  PLAN.slope = function () {
    /* four falls on one bearing, offset across it. The bearing is shared —
       that is what makes it a slope — so the LENGTHS and the bows are what keep
       the four from being one stroke drawn four times. */
    var a = [[-7, -33, 31, 5], [-16, -25, 24, 15], [-24, -16, 16, 24], [-33, -8, 5, 30]];
    var bow = [0.05, -0.075, 0.11, 0.17];
    var trim = [0, 0.09, 0.20, 0.22];
    return fam(4, function (i) {
      var t = a[i], k = trim[i];
      return bw(t[0] + (t[2] - t[0]) * k, t[1] + (t[3] - t[1]) * k, t[2], t[3], bow[i]);
    });
  };

  var PH = {};
  Object.keys(PLAN).forEach(function (name) {
    PH[name] = function () {
      var strokes = PLAN[name](), d = "", i;
      for (i = 0; i < strokes.length; i++) d += brush(strokes[i], i);
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
