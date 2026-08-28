/* The method page — a deck of one-idea cards.
   Teaching by operation rather than description: each card carries the thing
   it explains, so the reader tries it before spending anything.

   The deck exists because the mosaic it replaces could not keep its own
   order: twelve cards in one DOM sequence reflowed into three, two and one
   column, and at two the five steps read 01-right, 02-right, 03-left,
   04-left, 05-right. One card on screen has no reflow to get wrong.

   Handing over is the same gesture as turning: when a card's interaction is
   finished, it blinks once and the next card is there. The blink is the only
   animation on the page and nothing keeps running after it — the casting
   figure's rule, applied here. */
(function () {
  "use strict";
  var M = window.BWMarks;
  var B = window.BWBlocks;
  if (!M) return;

  var stage = document.getElementById("mtStage");
  if (!stage) return;
  var pages = [].slice.call(stage.querySelectorAll(".mt-page"));
  var rail = [].slice.call(document.querySelectorAll("#mtRail b"));
  var prevBtn = document.getElementById("mtPrev");
  var nextBtn = document.getElementById("mtNext");
  var countEl = document.getElementById("mtCount");
  var at = 0, moving = false;

  /* ── the fields ─────────────────────────────────────────────────────────
     One phenomenon per card, arranged by density rather than tiled — see
     ditherField in blocks.js for why an even pitch is the one thing the
     reference field is not. Drawn once the card has a box to measure; a
     resize redraws so the density stays constant instead of stretching. */
  function paintFields() {
    if (!B || !B.dither) return;
    pages.forEach(function (p) {
      var field = p.querySelector(".mt-field");
      var slot = p.querySelector(".mt-dither");
      if (!field || !slot) return;
      var w = Math.round(slot.clientWidth), h = Math.round(slot.clientHeight);
      if (w < 4 || h < 4) return;
      var name = field.getAttribute("data-ph") || "haze";
      var wide = field.hasAttribute("data-wide");
      slot.innerHTML = B.svg(
        B.dither(name, w, h, {
          pitch: wide ? Math.max(30, w / 9) : Math.max(18, w / 3.2),
          ax: wide ? 1.1 : 0.5, ay: wide ? 0.9 : 1.9,
          cut: wide ? 0.5 : 0.44
        }),
        "0 0 " + w + " " + h, 'preserveAspectRatio="none"');
    });
  }

  /* ── moving between cards ───────────────────────────────────────────── */
  function paintChrome() {
    rail.forEach(function (b, i) {
      b.classList.toggle("is-here", i === at);
      b.classList.toggle("is-done", i < at);
    });
    if (countEl) countEl.textContent = (at + 1) + " / " + pages.length;
    if (prevBtn) prevBtn.disabled = at === 0;
    if (nextBtn) nextBtn.disabled = at === pages.length - 1;
  }

  function go(i) {
    i = Math.max(0, Math.min(pages.length - 1, i));
    if (i === at || moving) return;
    moving = true;
    var from = pages[at], to = pages[i];
    var card = from.querySelector(".mt-card");
    if (card) card.classList.add("is-flashing");
    /* The swap happens inside the blink, at its brightest, so the reader never
       sees the two cards at once. */
    setTimeout(function () {
      from.classList.remove("is-on");
      to.classList.add("is-on");
      at = i;
      paintChrome();
      paintFields();
      var lead = to.querySelector(".mt-card");
      if (lead) {
        lead.classList.add("is-flashing");
        if (lead.hasAttribute("tabindex")) lead.focus({ preventScroll: true });
      }
      setTimeout(function () {
        if (card) card.classList.remove("is-flashing");
        if (lead) lead.classList.remove("is-flashing");
        moving = false;
      }, 280);
    }, 100);
  }

  if (prevBtn) prevBtn.addEventListener("click", function () { go(at - 1); });
  if (nextBtn) nextBtn.addEventListener("click", function () { go(at + 1); });
  document.addEventListener("keydown", function (e) {
    if (e.target.closest("input, textarea, select")) return;
    if (e.key === "ArrowRight") { e.preventDefault(); go(at + 1); }
    if (e.key === "ArrowLeft") { e.preventDefault(); go(at - 1); }
  });
  rail.forEach(function (b, i) {
    b.setAttribute("role", "button");
    b.setAttribute("tabindex", "0");
    b.addEventListener("click", function () { go(i); });
    b.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(i); }
    });
  });

  /* A card reports itself finished once. The hand-over waits long enough for
     the reader to see what they just did land — advancing the instant the
     last check turns on would delete the answer they were looking at. */
  var done = {};
  function finish(card) {
    var key = card.getAttribute("data-step");
    if (done[key]) return;
    done[key] = true;
    card.classList.add("is-done");
    setTimeout(function () {
      if (pages[at].contains(card)) go(at + 1);
    }, 1100);
  }

  /* ── 01 · the question checks ──────────────────────────────────────────
     The same things the product cares about, checked live. The cheapest way
     to teach the format: the reader sees which ones their own sentence
     already satisfies, in their own words. */
  var q = document.getElementById("mtQ");
  if (q) {
    var checks = [].slice.call(document.querySelectorAll("#mtChecks li"));
    var WHEN = /(today|tomorrow|week|month|year|quarter|soon|deadline|by\s+\w+|next\b|before\b)/i;
    var WHO = /\b(i|we|my|our|me|us|he|she|they|him|her|them|his|their)\b/i;
    var SPLIT = /(\balso\b|;|\band what about\b|\?\s*\S.*\?)/i;
    q.addEventListener("input", function () {
      var v = q.value.trim();
      var ok = {
        len: v.length >= 40,
        one: v.length > 0 && !SPLIT.test(v),
        who: WHO.test(v),
        when: WHEN.test(v)
      };
      var all = true;
      checks.forEach(function (li) {
        var good = !!ok[li.getAttribute("data-check")];
        li.classList.toggle("ok", good);
        if (!good) all = false;
      });
      if (all) finish(q.closest(".mt-card"));
    });
  }

  /* ── 02 · what the depth actually buys ─────────────────────────────────
     Stria draws one figure; Sortis also draws what it turns into. Showing
     both is the difference — describing it in a sentence is what this page
     used to do. */
  var method = "stria";
  var compare = document.getElementById("mtCompare");
  var switches = [].slice.call(document.querySelectorAll(".mt-switch button"));
  var PRIMARY = [1, 0, 1, 1, 0, 0], MOVING = [0, 1, 0, 0, 1, 0];
  function figSVG(lines, w) {
    w = w || 96;
    /* Six bars and five gaps at these ratios come to .82w; .83 keeps the
       bottom bar off the viewBox edge instead of shaving it. */
    var h = Math.round(w * .83);
    return M.svg("<g>" + M.hexagram(lines, { w: w, t: w * .085, gap: w * .062 }) + "</g>",
      "0 0 " + w + " " + h, 'preserveAspectRatio="xMidYMid meet"');
  }
  function drawCompare() {
    if (!compare) return;
    var rows = [["Primary", PRIMARY]];
    if (method === "sortis") {
      rows.push(["Becomes", PRIMARY.map(function (v, k) { return MOVING[k] ? (v ? 0 : 1) : v; })]);
    }
    compare.innerHTML = rows.map(function (r) {
      return '<div class="row"><b class="mt-meta">' + r[0] + "</b>" + figSVG(r[1], 84) + "</div>";
    }).join("");
  }
  switches.forEach(function (b) {
    b.addEventListener("click", function () {
      method = b.getAttribute("data-m");
      switches.forEach(function (o) { o.setAttribute("aria-checked", String(o === b)); });
      drawCompare();
      if (method === "sortis") finish(b.closest(".mt-card"));
    });
  });
  drawCompare();

  /* ── 03 · a real toss ──────────────────────────────────────────────────
     Three coins a line, so a line moves with probability 1/4 independently of
     the others — the distribution the engine uses. Casting is a physical
     process and a paragraph about it teaches nothing. */
  var castBtn = document.getElementById("mtCastBtn");
  if (castBtn) {
    var fig = document.getElementById("mtFig"), read = document.getElementById("mtRead");
    castBtn.addEventListener("click", function () {
      var lines = [], moved = 0, k;
      for (k = 0; k < 6; k++) {
        var faces = (Math.random() < .5) + (Math.random() < .5) + (Math.random() < .5);
        var yang = faces === 1 || faces === 3;
        var changing = faces === 0 || faces === 3;
        if (changing) moved++;
        lines.push({ yang: yang ? 1 : 0, changing: changing });
      }
      var prim = lines.map(function (l) { return l.yang; });
      var trans = lines.map(function (l) { return l.changing ? (l.yang ? 0 : 1) : l.yang; });
      fig.innerHTML = figSVG(prim, 96) + (moved ? figSVG(trans, 96) : "");
      read.innerHTML =
        "<dt>Moving</dt><dd>" + moved + " of 6</dd>" +
        "<dt>Figure</dt><dd>" + prim.slice().reverse().join("") + "</dd>" +
        (moved ? "<dt>Becomes</dt><dd>" + trans.slice().reverse().join("") + "</dd>" : "");
      finish(castBtn.closest(".mt-card"));
    });
  }

  /* ── 05 · the meter ────────────────────────────────────────────────────
     The published rates against a length the reader picks. Arithmetic they
     can check beats a claim they have to trust. */
  var len = document.getElementById("mtLen");
  if (len) {
    var cost = document.getElementById("mtCost"), note = document.getElementById("mtCostNote");
    var moved = false;
    var calc = function () {
      var words = +len.value;
      var outTok = words * 1.35, inTok = 1400;          /* the prompt is near-fixed */
      var units = Math.round(inTok / 1000 * 19.5 + outTok / 1000 * 97.5);
      cost.textContent = units.toLocaleString("en-US");
      note.textContent = "units · about " + words.toLocaleString("en-US") + " words";
    };
    len.addEventListener("input", function () {
      calc();
      if (!moved) { moved = true; finish(len.closest(".mt-card")); }
    });
    calc();
  }

  /* ── 04 · nothing to operate, so reading it is the interaction ─────────
     Opening the card is what finishes this one; there is no widget to
     complete and inventing one to keep the pattern would be a control that
     exists for the pattern's sake. */

  /* ── turning a card ─────────────────────────────────────────────────────
     The name is what you see; one click swaps to the thing it teaches, in the
     same card, with a short white blink so the change reads as the card
     turning rather than as a crossfade. The click is ignored when it lands on
     something operable, otherwise typing or dragging would turn the card out
     from under the reader. */
  [].slice.call(document.querySelectorAll(".mt-card--flip")).forEach(function (card) {
    var faces = [].slice.call(card.querySelectorAll(".mt-face"));
    if (faces.length < 2) return;
    var cue = card.querySelector(".mt-cue");
    if (cue) cue.dataset.rest = cue.lastChild.textContent;
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
        card.classList.toggle("is-open", i === 1);
        card.setAttribute("aria-expanded", i === 1 ? "true" : "false");
        var focusable = faces[next].querySelector("textarea, input, button");
        if (i === 1 && focusable) focusable.focus({ preventScroll: true });
        /* The cue is an instruction, so it has to say the instruction that
           applies now — it read "Open it and write one" while open. */
        if (cue) cue.lastChild.textContent = i === 1 ? "Tap the card to close it" : cue.dataset.rest;
      }, 90);
      setTimeout(function () { card.classList.remove("is-flashing"); busy = false; }, 300);
    }

    card.addEventListener("click", function (e) {
      if (e.target.closest("input, textarea, button, select, a, label")) return;
      turn();
    });
    card.addEventListener("keydown", function (e) {
      if (e.target !== card) return;
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); turn(); }
    });
  });

  paintChrome();
  paintFields();
  var rt;
  addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(paintFields, 160); });
}());
