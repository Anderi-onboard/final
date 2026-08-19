/* Fills every pattern, landscape and mark cell on a block-composition route.
   The markup only declares intent (data-pattern="wave"); the geometry is
   generated here from assets/marks.js, so a cell can be resized freely and the
   field re-renders at the right density instead of stretching. */
(function () {
  "use strict";
  var M = window.BWMarks;
  if (!M) return;

  var PATTERN = {
    /* Each entry returns [pathData, strokeWidth] or ["#fill", markup]. Pitches
       are chosen so roughly the same number of repeats lands in a cell at any
       width — density is the thing that has to stay constant, not size. */
    vesica: function (w, h) {
      /* Cap the lens ratio. Left to follow the cell, a tall narrow block turns
         the motif into a spike — and the ratio is the motif: 1:3.4 is a leaf,
         1:8 is a needle. Height yields to width, never the other way. */
      var vw = Math.max(14, Math.min(w / 7, 30));
      var vh = Math.min(h * .78, vw * 2.6);
      return { fill: M.vesicaRow(w, h, { pitch: vw * 1.75, vw: vw, vh: vh }) };
    },
    /* Line weight is a fraction of the motif's own pitch, never a loose number.
       Tied to pitch, a field keeps the same ink-to-ground ratio at any cell
       size, and the weights stay in step with each other when one changes.
       Below about a quarter of the pitch the stroke stops reading as drawn
       and starts reading as a faint ruling — which is what these were. */
    tally: function (w, h) {
      var pitch = 15;
      return { stroke: M.tally(w, h, { pitch: pitch, lean: 4.5 }), width: pitch * .38 };
    },
    wave: function (w, h) {
      var pitch = 26;
      return { stroke: M.waveField(w, h, { pitch: pitch, amp: .26 }), width: pitch * .36 };
    },
    scallop: function (w, h) {
      var pitch = Math.max(34, w / 12);
      return { stroke: M.scallop(w, h, { pitch: pitch }), width: pitch * .28 };
    },
    /* The logomark as a field. Four abstract motifs was a thin vocabulary for a
       site with its own symbol sitting unused in seven page headers — this is
       the brand itself, at field scale, in the same ridge language as the
       background it sits in front of. */
    brand: function (w, h) {
      return { raw: M.brandField(w, h, { pitch: Math.max(110, Math.min(w / 2.6, 190)) }) };
    },
    /* Solid and broken bars — the product's own alphabet, drawn with the same
       brush as the reading figure rather than as a lookalike. */
    yao: function (w, h) {
      var bw = Math.max(46, Math.min(w / 3.4, 96));
      return { raw: '<g opacity=".92">' + M.yaoField(w, h, { bw: bw, t: bw * .12, gap: bw * .11 }) + '</g>' };
    },
    /* The connected-coin motif. It has been defined in marks.js all along and
       never used anywhere — stroked, never filled, because filling unions the
       discs into a clover and the square holes vanish. */
    coin: function (w, h) {
      var pitch = Math.max(30, Math.min(w / 7, 54));
      /* M.coin draws ONE cluster of five overlapping discs, not a field, so the
         cluster is tiled here. Rows step by 2*pitch because each cluster is two
         pitches tall, and alternate rows offset by one pitch so the chain
         interlocks instead of stacking into columns. */
      var d = "", row = 0, step = pitch * 2;
      for (var y = 0; y < h + step; y += step, row++) {
        for (var x = (row % 2 ? -pitch : 0); x < w + step; x += step) {
          d += '<g transform="translate(' + Math.round(x) + ' ' + Math.round(y) + ')">'
             + M.coin({ pitch: pitch }) + '</g>';
        }
      }
      return { raw: '<g fill="none" stroke="currentColor" stroke-width="' + (pitch * .10).toFixed(2)
        + '" stroke-linejoin="round" opacity=".9">' + d + '</g>' };
    }
  };
  var MARK = {
    hexagram: function () {
      /* ䷂ 3 · Sprouting — solid, broken, broken, broken, solid, broken. A real
         figure rather than a decorative arrangement of bars. */
      return '<g fill="currentColor">' + M.hexagram([1, 0, 0, 0, 1, 0], { w: 120, t: 9, gap: 7 }) + '</g>';
    },
    florette: function () {
      /* hole + h must stay ≤ 56 so the rosette clears the 120 viewBox below;
         26 × 48 is the leaf ratio the pattern fields use, kept the same here
         so the mark and the fields are recognisably one motif at two sizes. */
      return '<g fill="currentColor" transform="translate(60 60)">'
        + M.florette({ w: 26, h: 48, hole: 8 }) + '</g>';
    },
    /* The header wears the real logomark. It used to wear a dot ring — a
       generic ornament standing in for a brand that was inlined in seven HTML
       files and reachable from none of the generated marks. */
    ring: function () { return M.brandMark({ size: 512 }); },
    brand: function () { return M.brandMark({ size: 512 }); }
  };

  function render(el) {
    var w = Math.max(1, Math.round(el.clientWidth)), h = Math.max(1, Math.round(el.clientHeight));
    var pat = el.getAttribute("data-pattern"),
        land = el.getAttribute("data-land"),
        mk = el.getAttribute("data-mark");
    var body = "", vb = "0 0 " + w + " " + h, extra = 'preserveAspectRatio="none"';

    if (pat && PATTERN[pat]) {
      var p = PATTERN[pat](w, h);
      /* Three shapes a pattern can take: filled markup, a stroked path, or raw
         markup that carries its own paint (the logomark is stroked, the yao
         bars are filled — one wrapper cannot describe both). */
      body = p.raw
        ? p.raw
        : p.fill
          ? '<g fill="currentColor" opacity=".9">' + p.fill + '</g>'
          : '<path d="' + p.stroke + '" fill="none" stroke="currentColor" stroke-width="' + p.width
            + '" stroke-linecap="round" opacity=".9"/>';
    } else if (land != null) {
      /* The landscape blocks stand in for photographs. They are drawn from the
         same rounded-contour construction as the animated range, so a still
         image on this route is recognisably the same country as the moving one
         on the app routes — and unlike a raster it is sharp at every DPI. */
      body = M.landscape(parseInt(land, 10) * 131 + 7, w, h,
        { layers: 4, fill: h / w < .22 ? .42 : 1 });
    } else if (mk && MARK[mk]) {
      body = MARK[mk]();
      vb = (mk === "ring" || mk === "brand") ? "0 0 512 416" : "0 0 120 120";
      extra = 'preserveAspectRatio="xMidYMid meet"';
    } else return;

    el.innerHTML = M.svg(body, vb, extra);
  }

  /* ── woven weight ───────────────────────────────────────────────────────
     One typeface, weight alternating word by word — the same face at two
     weights rather than two faces. Split here rather than in the markup so
     the copy stays plain text and stays editable.

     Deterministic by word index, exactly as the brush is by bar index: a
     random assignment would reshuffle on every navigation and read as a
     rendering fault rather than as a decision. */
  [].slice.call(document.querySelectorAll("[data-weave]")).forEach(function (el) {
    if (el.dataset.woven) return;
    var words = el.textContent.trim().split(/\s+/);
    el.textContent = "";
    words.forEach(function (w, i) {
      var span = document.createElement("span");
      span.setAttribute("data-w", String(i % 2));
      span.textContent = w;
      el.appendChild(span);
      if (i < words.length - 1) el.appendChild(document.createTextNode(" "));
    });
    el.dataset.woven = "1";
  });

  var cells = [].slice.call(document.querySelectorAll("[data-pattern],[data-land],[data-mark]"));
  /* Skip anything with no box yet. On the method route the fields live inside
     steps that are display:none until shown, so measuring them at load gives
     zero and draws nothing — which is why those bands came up empty. Callers
     re-run this when a step becomes visible. */
  function all() { cells.forEach(function (c) { if (c.clientWidth > 0) render(c); }); }
  all();
  window.BWBlocks = { render: all };

  /* Re-render on resize so the pattern keeps its density rather than being
     stretched — a scaled vesica row is a different motif from a denser one. */
  var t = 0;
  addEventListener("resize", function () { clearTimeout(t); t = setTimeout(all, 140); });
}());
