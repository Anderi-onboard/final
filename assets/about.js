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
