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
    var layers = opts.layers || 4, out = "", uid = "lsc" + seed;
    out += '<clipPath id="' + uid + '"><rect width="' + w + '" height="' + h + '"/></clipPath>';
    out += '<g clip-path="url(#' + uid + ')">';
    for (var i = 0; i < layers; i++) {
      var t = i / (layers - 1 || 1);
      var top = ridgePath(seed + i * 977, w, h, { steps: 5 + i, amp: .34 - t * .16, base: .40 + t * .30 });
      out += '<path d="' + top + ' L' + w + ' ' + h + ' L0 ' + h + ' Z" fill="currentColor" opacity="'
        + (0.07 + t * 0.07).toFixed(3) + '"/>';
      out += '<path d="' + top + '" fill="none" stroke="currentColor" stroke-width="1.1" opacity="'
        + (0.5 - t * 0.1).toFixed(2) + '" stroke-linecap="round"/>';
      /* contour lines below each crest, thinning with distance — the range's
         own device for reading depth without shading */
      for (var k = 1; k <= 2 + i; k++) {
        out += '<path d="' + top + '" fill="none" stroke="currentColor" stroke-width="'
          + (0.75 - t * 0.2).toFixed(2) + '" opacity="' + (0.2 - t * 0.04).toFixed(2)
          + '" transform="translate(0 ' + R(k * (7 + i * 2)) + ')"/>';
      }
    }
    out += '</g>';
    return out;
  }

  /* ── flat-field patterns ────────────────────────────────────────────────
     Each is one motif on a strict pitch. Ratios, not absolute sizes, carry
     the character, so every function takes its proportions as parameters. */
  var vesica = function (w, h) {
    return "M0 " + R(-h / 2) + " Q" + R(w / 2) + " 0 0 " + R(h / 2) + " Q" + R(-w / 2) + " 0 0 " + R(-h / 2) + " Z";
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

  function florette(o) {
    o = o || {}; var n = o.n || 8, w = o.w || 30, h = o.h || 54, s = "";
    for (var i = 0; i < n; i++) s += '<path d="' + vesica(w, h) + '" transform="rotate(' + R(i * 360 / n) + ')"/>';
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
  function hexagram(lines, o) {
    o = o || {}; var w = o.w || 96, gap = o.gap || 5, t = o.t || 7, s = "";
    for (var i = 0; i < 6; i++) {
      var y = (5 - i) * (t + gap);
      if (lines[i]) s += '<rect x="0" y="' + y + '" width="' + w + '" height="' + t + '" rx="1"/>';
      else {
        var seg = (w - w * .22) / 2;
        s += '<rect x="0" y="' + y + '" width="' + R(seg) + '" height="' + t + '" rx="1"/>';
        s += '<rect x="' + R(w - seg) + '" y="' + y + '" width="' + R(seg) + '" height="' + t + '" rx="1"/>';
      }
    }
    return s;
  }

  function svg(body, vb, attrs) {
    return '<svg viewBox="' + vb + '" ' + (attrs || "") + ' xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' + body + '</svg>';
  }

  root.BWMarks = {
    rng: rng, svg: svg, sineV: sineV,
    ridgePath: ridgePath, landscape: landscape,
    vesica: vesica, vesicaRow: vesicaRow, splitDisc: splitDisc,
    scallop: scallop, waveField: waveField, tally: tally,
    florette: florette, dotRing: dotRing, coin: coin, hexagram: hexagram
  };
}());
