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
      var vh = Math.min(h * .78, vw * 3.4);
      return { fill: M.vesicaRow(w, h, { pitch: vw * 1.75, vw: vw, vh: vh }) };
    },
    tally: function (w, h) {
      return { stroke: M.tally(w, h, { pitch: 15, lean: 4.5 }), width: 3 };
    },
    wave: function (w, h) {
      return { stroke: M.waveField(w, h, { pitch: 26, amp: .26 }), width: 4.5 };
    },
    scallop: function (w, h) {
      return { stroke: M.scallop(w, h, { pitch: Math.max(34, w / 12) }), width: 5 };
    }
  };
  var MARK = {
    hexagram: function () {
      /* ䷂ 3 · Sprouting — solid, broken, broken, broken, solid, broken. A real
         figure rather than a decorative arrangement of bars. */
      return '<g fill="currentColor">' + M.hexagram([1, 0, 0, 0, 1, 0], { w: 120, t: 9, gap: 7 }) + '</g>';
    },
    florette: function () {
      return '<g fill="currentColor" transform="translate(60 60)">'
        + M.florette({ w: 34, h: 62 }) + '<circle r="9" fill="currentColor" opacity="0"/></g>';
    },
    ring: function () { return '<g fill="currentColor" transform="translate(11 11)">' + M.dotRing({ r: 8, dot: .17 }) + '</g>'; }
  };

  function render(el) {
    var w = Math.max(1, Math.round(el.clientWidth)), h = Math.max(1, Math.round(el.clientHeight));
    var pat = el.getAttribute("data-pattern"),
        land = el.getAttribute("data-land"),
        mk = el.getAttribute("data-mark");
    var body = "", vb = "0 0 " + w + " " + h, extra = 'preserveAspectRatio="none"';

    if (pat && PATTERN[pat]) {
      var p = PATTERN[pat](w, h);
      body = p.fill
        ? '<g fill="currentColor" opacity=".9">' + p.fill + '</g>'
        : '<path d="' + p.stroke + '" fill="none" stroke="currentColor" stroke-width="' + p.width
          + '" stroke-linecap="round" opacity=".9"/>';
    } else if (land != null) {
      /* The landscape blocks stand in for photographs. They are drawn from the
         same rounded-contour construction as the animated range, so a still
         image on this route is recognisably the same country as the moving one
         on the app routes — and unlike a raster it is sharp at every DPI. */
      body = M.landscape(parseInt(land, 10) * 131 + 7, w, h, { layers: 4 });
    } else if (mk && MARK[mk]) {
      body = MARK[mk]();
      vb = mk === "ring" ? "0 0 22 22" : "0 0 120 120";
      extra = 'preserveAspectRatio="xMidYMid meet"';
    } else return;

    el.innerHTML = M.svg(body, vb, extra);
  }

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
