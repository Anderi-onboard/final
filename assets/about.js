/* The About route's card art.
   Each card carries a scatter of ALL thirty phenomena, arranged as multi-class
   blue noise so that every motif is spread evenly and no motif recurs near
   itself — the difference between a picture and wallpaper. Drawn once a card
   has a box to measure, and redrawn on resize so the density stays constant
   rather than the marks stretching. */
(function () {
  "use strict";
  var B = window.BWBlocks;
  if (!B || !B.scatter) return;

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

      /* Figure-ground: hand the field the boxes the type actually occupies, in
         the field's own coordinates, so the ground thins as it approaches the
         figure instead of either stopping at it or running straight through
         it. Measured rather than assumed — the arrangements put the title,
         caption and mark in a different corner on every card, so no fixed
         exclusion zone could be right for all four. */
      var base = slot.getBoundingClientRect();
      var avoid = [].map.call(card.querySelectorAll(".ab-name, .ab-note, .ab-mark"),
        function (el) {
          var r = el.getBoundingClientRect();
          return { x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height };
        });

      var field = B.scatter(w, h, {
        /* one seed per card, so each card is a different field and every card
           is the same field on every visit */
        seed: 20260829 + i * 7919,
        pitch: Math.max(19, w / 11),
        avoid: avoid
      });
      slot.innerHTML = B.svg(field.markup, "0 0 " + w + " " + h, 'preserveAspectRatio="none"');
      card.dataset.phCount = field.count;
    });
  }

  paint();
  var t;
  addEventListener("resize", function () { clearTimeout(t); t = setTimeout(paint, 160); });
}());
