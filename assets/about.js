/* The About route's card art.
   The corner marks only. The cards themselves are text panels and carry grain,
   not marks; the phenomena live in the ground between them. */
(function () {
  "use strict";
  var B = window.BWBlocks;
  if (!B) return;

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

  /* ⚠️ The cards carry NO field. They are text panels, and text panels get
     grain — one material each. Marks belong in the ground between the panels,
     where they separate one field of colour from the next instead of sitting
     under the words like a printed cloth. An earlier pass put a fine scatter on
     every card and the whole page read as calico. The ground field is declared
     on .ab-set in the markup and painted by blocks.js. */

}());
