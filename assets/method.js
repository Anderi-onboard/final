/* The method page. Teaching by operation rather than description: each step's
   middle card carries the thing it explains, so the reader tries it before
   spending anything. No stepper — the page is a grid of squares and all of it
   is visible at once, which is what a reference wants and a slideshow denies. */
(function () {
  "use strict";
  var M = window.BWMarks;
  if (!M) return;

  /* ── the drawn overlay ──────────────────────────────────────────────────
     The reference lays a fine line drawing across its display type. Ours is
     the range's own contour language with the filled masses turned off, so
     the one line vocabulary on the app routes is the one used here. */
  [].slice.call(document.querySelectorAll("[data-figure]")).forEach(function (el) {
    var art = document.createElement("div");
    art.className = "mt-fig-art";
    art.innerHTML = M.svg(M.landscape(613, 300, 190, { layers: 4, fill: 0 }),
      "0 0 300 190", 'preserveAspectRatio="xMidYMid meet"');
    el.appendChild(art);
  });

  /* ── 01 · the question checks ──────────────────────────────────────────
     The same three things the product cares about, shown live. This is the
     cheapest possible way to teach the format: the reader sees which of them
     their own sentence already satisfies. */
  var q = document.getElementById("mtQ");
  if (q) {
    var checks = [].slice.call(document.querySelectorAll("#mtChecks li"));
    var WHEN = /(today|tomorrow|week|month|year|quarter|soon|deadline|by\s+\w+|next\b|before\b)/i;
    var SPLIT = /(\balso\b|\band also\b|;|\band what about\b|\?\s*\S.*\?)/i;
    q.addEventListener("input", function () {
      var v = q.value.trim();
      var ok = {
        len: v.length >= 40,
        one: v.length > 0 && !SPLIT.test(v),
        when: WHEN.test(v)
      };
      checks.forEach(function (li) {
        li.setAttribute("data-ok", ok[li.getAttribute("data-k")] ? "1" : "0");
      });
    });
  }

  /* ── 02 · what the depth actually buys ─────────────────────────────────
     Stria draws one figure; Sortis draws the primary, the moving lines and
     the transformed figure. Showing all three is the difference — describing
     it in a sentence is what the page did before. */
  var method = "stria";
  var compare = document.getElementById("mtCompare");
  var switches = [].slice.call(document.querySelectorAll(".mt-switch button"));
  switches.forEach(function (b) {
    b.addEventListener("click", function () {
      method = b.getAttribute("data-method");
      switches.forEach(function (o) { o.setAttribute("aria-checked", String(o === b)); });
      drawCompare();
    });
  });
  var PRIMARY = [1, 0, 1, 1, 0, 0], MOVING = [0, 1, 0, 0, 1, 0];
  function figSVG(lines, w) {
    w = w || 96;
    /* Six bars and five gaps at the ratios below come to .82w; rounding up to
       .83 keeps the bottom bar off the viewBox edge instead of shaving it. */
    var h = Math.round(w * .83);
    return M.svg('<g>' + M.hexagram(lines, { w: w, t: w * .085, gap: w * .062 }) + '</g>',
      "0 0 " + w + " " + h, 'preserveAspectRatio="xMidYMid meet"');
  }
  function drawCompare() {
    if (!compare) return;
    var rows = [["Primary", PRIMARY]];
    if (method === "sortis") {
      rows.push(["Transformed", PRIMARY.map(function (v, k) { return MOVING[k] ? (v ? 0 : 1) : v; })]);
    }
    compare.innerHTML = rows.map(function (r) {
      return '<div class="row"><b>' + r[0] + '</b>' + figSVG(r[1], 84) + '</div>';
    }).join("");
  }
  drawCompare();

  /* ── 03 · a real toss ──────────────────────────────────────────────────
     Three coins per line, 6+yang-faces, so a line moves with probability 1/4
     independently of the others — the same distribution the engine uses. The
     point of doing it here is that casting is a physical process and reading
     a paragraph about it teaches nothing. */
  var castBtn = document.getElementById("mtCastBtn");
  if (castBtn) {
    var fig = document.getElementById("mtFig"), read = document.getElementById("mtRead");
    var toss = function () {
      var lines = [], moving = 0;
      for (var k = 0; k < 6; k++) {
        var faces = (Math.random() < .5) + (Math.random() < .5) + (Math.random() < .5);
        var yang = faces === 1 || faces === 3;
        var changing = faces === 0 || faces === 3;
        if (changing) moving++;
        lines.push({ yang: yang ? 1 : 0, changing: changing });
      }
      var prim = lines.map(function (l) { return l.yang; });
      var trans = lines.map(function (l) { return l.changing ? (l.yang ? 0 : 1) : l.yang; });
      var html = figSVG(prim, 96);
      if (moving) html += figSVG(trans, 96);
      fig.innerHTML = html;
      read.innerHTML =
        '<dt>Moving</dt><dd>' + moving + ' of 6</dd>' +
        '<dt>Figure</dt><dd>' + prim.slice().reverse().join("") + '</dd>' +
        (moving ? '<dt>Becomes</dt><dd>' + trans.slice().reverse().join("") + '</dd>' : "");
    };
    castBtn.addEventListener("click", toss);
    toss();
  }

  /* ── 05 · the meter ────────────────────────────────────────────────────
     The published rates, applied to a length the reader chooses. Arithmetic
     the reader can check beats a claim they have to trust. */
  var len = document.getElementById("mtLen");
  if (len) {
    var cost = document.getElementById("mtCost"), note = document.getElementById("mtCostNote");
    var calc = function () {
      var words = +len.value;
      var outTok = words * 1.35, inTok = 1400;          /* prompt is near-fixed */
      var units = Math.round(inTok / 1000 * 19.5 + outTok / 1000 * 97.5);
      cost.textContent = units.toLocaleString("en-US");
      note.textContent = "units · about " + words.toLocaleString("en-US") + " words";
    };
    len.addEventListener("input", calc);
    calc();
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

  /* ── click to turn the card ─────────────────────────────────────────────
     A step card carries its name and the thing it teaches. The name is what
     you see; one click swaps to the widget in the same square, with a short
     white blink so the change reads as the card turning rather than as a
     crossfade. Nothing keeps running afterwards.

     The click is ignored when it lands on something operable, otherwise
     typing in the textarea or dragging the slider would flip the card out
     from under the reader. */
  [].slice.call(document.querySelectorAll(".mt-card--flip")).forEach(function (card) {
    var faces = [].slice.call(card.querySelectorAll(".mt-face"));
    if (faces.length < 2) return;
    var hint = card.querySelector(".mt-hint");
    var i = 0, busy = false;

    function turn() {
      if (busy) return;
      busy = true;
      var next = (i + 1) % faces.length;
      card.classList.add("is-flashing");
      setTimeout(function () {
        faces[i].classList.remove("is-on");
        faces[next].classList.add("is-on");
        i = next;
        card.setAttribute("aria-expanded", i === 1 ? "true" : "false");
        if (hint) hint.textContent = i === 1 ? "Tap to go back" : hint.dataset.rest || hint.textContent;
      }, 90);
      setTimeout(function () { card.classList.remove("is-flashing"); busy = false; }, 300);
    }

    if (hint) hint.dataset.rest = hint.textContent;
    card.addEventListener("click", function (e) {
      if (e.target.closest("input, textarea, button, select, a, label")) return;
      turn();
    });
    card.addEventListener("keydown", function (e) {
      if (e.target !== card) return;
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); turn(); }
    });
  });

}());
