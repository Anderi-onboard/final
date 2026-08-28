/* The About route's card art.
   Each card gets one phenomenon arranged as a density field — clustering and
   thinning across the card rather than tiling it, which is the difference
   between an illustration and wallpaper. Drawn once a card has a box to
   measure, and redrawn on resize so the density stays constant instead of the
   marks stretching. */
(function () {
  "use strict";
  var B = window.BWBlocks;
  if (!B || !B.dither) return;

  var cards = [].slice.call(document.querySelectorAll(".ab-card[data-ph]"));
  if (!cards.length) return;

  /* ── the corner marks ─────────────────────────────────────────────────────
     ⚠️ Not data-mark. blocks.js draws a mark at translate(60,60) scale(3.1)
     into a viewBox sized to the element, which is right for the ~120px cells
     on the block routes and wrong here: at 12cqw the box is about 50 units, so
     the art sits outside it and every mark came out cropped to fragments.
     Measuring the path's own bounds and fitting the viewBox to them makes each
     mark render whole AND gives all four the same optical size, which naming
     them alone never would — the thirty phenomena have very different native
     extents. */
  var M = window.BWMarks;
  (function paintMarks() {
    if (!M || !M.phenomena) return;
    var probe = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    probe.setAttribute("style", "position:absolute;width:0;height:0;overflow:hidden");
    var path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    probe.appendChild(path);
    document.body.appendChild(probe);

    [].forEach.call(document.querySelectorAll(".ab-mark[data-ph]"), function (el) {
      var name = el.getAttribute("data-ph");
      var fn = M.phenomena[name];
      if (!fn) return;
      var d = fn();
      path.setAttribute("d", d);
      var bb = path.getBBox();
      if (!bb.width || !bb.height) return;
      /* Square the box around the art so a wide mark and a tall one read as the
         same weight in their corner, then breathe a little so the stroke caps
         are not flush with the edge. */
      var side = Math.max(bb.width, bb.height) * 1.12;
      var x = bb.x + bb.width / 2 - side / 2, y = bb.y + bb.height / 2 - side / 2;
      el.innerHTML = '<svg viewBox="' + [x, y, side, side].join(" ") + '" aria-hidden="true">'
        + '<path d="' + d + '" fill="currentColor"/></svg>';
    });

    probe.remove();
  }());

  function paint() {
    cards.forEach(function (card, i) {
      var slot = card.querySelector(".ab-art");
      if (!slot) return;
      var w = Math.round(slot.clientWidth), h = Math.round(slot.clientHeight);
      if (w < 8 || h < 8) return;
      /* The four fields lean different ways so no two cards read as the same
         picture in a different colour. Deterministic per position — the same
         law the strokes follow, for the same reason: a field that reshuffles
         on navigation reads as a rendering fault, not as a decision. */
      var lean = [
        { ax: 0.7, ay: 1.4, phase: 0.00, cut: 0.42 },
        { ax: 1.5, ay: 0.6, phase: 0.31, cut: 0.46 },
        { ax: 1.1, ay: 1.1, phase: 0.62, cut: 0.44 },
        { ax: 0.5, ay: 1.8, phase: 0.17, cut: 0.40 }
      ][i % 4];
      slot.innerHTML = B.svg(
        B.dither(card.getAttribute("data-ph"), w, h, {
          pitch: Math.max(26, w / 7),
          ax: lean.ax, ay: lean.ay, phase: lean.phase, cut: lean.cut
        }),
        "0 0 " + w + " " + h, 'preserveAspectRatio="none"');
    });
  }

  paint();
  var t;
  addEventListener("resize", function () { clearTimeout(t); t = setTimeout(paint, 160); });
}());
