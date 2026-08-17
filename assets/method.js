/* The method page. Teaching by operation rather than description: each step
   carries the thing it is explaining, so the reader tries it before spending
   anything. Deep-linkable, keyboard-navigable, and every step reachable from
   every other — a reference, not a slideshow. */
(function () {
  "use strict";
  var M = window.BWMarks;
  var steps = [].slice.call(document.querySelectorAll(".mt-step"));
  var rail = [].slice.call(document.querySelectorAll("#mtRail button"));
  var backBtn = document.getElementById("mtBack");
  var nextBtn = document.getElementById("mtNext");
  var count = document.getElementById("mtCount");
  if (!steps.length) return;
  var i = 0;

  /* Which steps the reader has already seen, so the rail can show progress
     rather than only position. Kept local; it is a reading aid, not account
     state, and it must never block someone who arrives with none of it. */
  var seen = {};
  try { seen = JSON.parse(localStorage.getItem("bw:methodSeen") || "{}") || {}; } catch (e) {}
  function markSeen(n) {
    seen[n] = 1;
    try { localStorage.setItem("bw:methodSeen", JSON.stringify(seen)); } catch (e) {}
    rail.forEach(function (b, k) { b.setAttribute("data-seen", seen[k] ? "1" : "0"); });
  }

  function show(n, push) {
    i = Math.max(0, Math.min(steps.length - 1, n));
    steps.forEach(function (s, k) { s.classList.toggle("is-on", k === i); });
    rail.forEach(function (b, k) {
      if (k === i) b.setAttribute("aria-current", "step");
      else b.removeAttribute("aria-current");
    });
    count.textContent = "Step " + (i + 1) + " of " + steps.length;
    backBtn.disabled = i === 0;
    nextBtn.textContent = i === steps.length - 1 ? "Start a casting →" : "Continue →";
    markSeen(i);
    /* Deep links: a step is a place, so it gets an address and a history
       entry. Landing on #step-3 from outside must open step 3, not step 1. */
    if (push !== false && location.hash !== "#step-" + (i + 1)) {
      history.pushState(null, "", "#step-" + (i + 1));
    }
    steps[i].focus({ preventScroll: true });
    /* The step was display:none a moment ago, so its pattern band had no box
       to measure. Now that it does, draw it. */
    if (window.BWBlocks) window.BWBlocks.render();
    if (i === 1) drawCompare();
  }

  rail.forEach(function (b) {
    b.addEventListener("click", function () { show(+b.getAttribute("data-go")); });
  });
  backBtn.addEventListener("click", function () { show(i - 1); });
  nextBtn.addEventListener("click", function () {
    if (i === steps.length - 1) location.href = "./index.html";
    else show(i + 1);
  });
  addEventListener("keydown", function (e) {
    if (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
    if (e.key === "ArrowRight") { e.preventDefault(); show(i + 1); }
    if (e.key === "ArrowLeft") { e.preventDefault(); show(i - 1); }
  });
  addEventListener("popstate", function () { show(fromHash(), false); });
  function fromHash() {
    var m = /^#step-(\d+)$/.exec(location.hash);
    return m ? (+m[1] - 1) : 0;
  }

  /* ── step 1 · the question checks ──────────────────────────────────────
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

  /* ── step 2 · what the depth actually buys ─────────────────────────────
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
  var PRIMARY = [1, 0, 1, 1, 0, 0], MOVING = [0, 2, 0, 0, 1, 0];
  function figSVG(lines, w) {
    return M.svg('<g>' + M.hexagram(lines, { w: w || 96, t: 8, gap: 6 }) + '</g>',
      "0 0 " + (w || 96) + " 78", 'width="' + (w || 96) + '" height="78"');
  }
  function drawCompare() {
    if (!compare || !M) return;
    var rows = [["Primary", PRIMARY]];
    if (method === "sortis") {
      rows.push(["Moving", PRIMARY.map(function (v, k) { return MOVING[k] ? v : v; })]);
      rows.push(["Transformed", PRIMARY.map(function (v, k) { return MOVING[k] ? (v ? 0 : 1) : v; })]);
    }
    compare.innerHTML = rows.map(function (r) {
      return '<div class="row"><b>' + r[0] + '</b>' + figSVG(r[1], 84) + '</div>';
    }).join("");
  }

  /* ── step 3 · a real toss ──────────────────────────────────────────────
     Three coins per line, 6+yang-faces, so a line moves with probability 1/4
     independently of the others — the same distribution the engine uses. The
     point of doing it here is that casting is a physical process and reading
     a paragraph about it teaches nothing. */
  var castBtn = document.getElementById("mtCastBtn");
  if (castBtn && M) {
    var fig = document.getElementById("mtFig"), read = document.getElementById("mtRead");
    function toss() {
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
    }
    castBtn.addEventListener("click", toss);
    toss();
  }

  /* ── step 5 · the meter ────────────────────────────────────────────────
     The published rates, applied to a length the reader chooses. Arithmetic
     the reader can check beats a claim they have to trust. */
  var len = document.getElementById("mtLen");
  if (len) {
    var cost = document.getElementById("mtCost"), note = document.getElementById("mtCostNote");
    function calc() {
      var words = +len.value;
      var outTok = words * 1.35, inTok = 1400;          /* prompt is near-fixed */
      var units = Math.round(inTok / 1000 * 19.5 + outTok / 1000 * 97.5);
      cost.textContent = units.toLocaleString("en-US");
      note.textContent = "units · about " + words.toLocaleString("en-US") + " words";
    }
    len.addEventListener("input", calc);
    calc();
  }

  show(fromHash(), false);
}());
