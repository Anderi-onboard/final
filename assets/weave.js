/* Woven weight — the display-type device, in one place for the whole site.
   Splits a heading into words and alternates BioRhyme's weight between them.

   ONE font, weight changing between words — not a second font. BioRhyme is a
   variable face (wght 200–800) in a single woff2, so this costs no extra bytes
   and the three-font rule still holds.

   The alternation is DETERMINISTIC — word index i % 2, even 300 / odd 700 —
   for the same reason the brush steps by index mod 3 and LINE_DRIFT uses
   coprime periods: per-visit randomness reshuffles on every navigation and
   reads as a rendering fault rather than as design.

   It lived in blocks.js, which only the block routes load, so the glass routes'
   display headings stayed single-weight. The device is TYPE, not material, and
   the two material systems share their type — so it belongs here.

   The glow does NOT come with it. That is a white two-layer text-shadow built
   for headlines sitting on saturated colour fields; over the near-white paper
   of the glass routes it either vanishes or muddies the letterforms. It stays
   scoped to .blocks-route in blocks.css. Same device, different ground.

   Markup stays plain text and stays editable: the split happens here at
   runtime, not in the HTML. */
(function () {
  "use strict";

  function weave(el) {
    if (el.dataset.woven) return;
    var words = el.textContent.trim().split(/\s+/);
    /* Alternation needs two words to read as alternation. On a single word
       ("Settings", "404") it is not a pattern, it just assigns that word an
       arbitrary weight — and since index 0 is even, it would quietly render
       every one-word heading on the site at 300. Leave those alone. */
    if (words.length < 2) { el.dataset.woven = "skip"; return; }
    el.textContent = "";
    words.forEach(function (w, i) {
      var span = document.createElement("span");
      span.setAttribute("data-w", String(i % 2));
      span.textContent = w;
      el.appendChild(span);
      if (i < words.length - 1) el.appendChild(document.createTextNode(" "));
    });
    el.dataset.woven = "1";
  }

  function run(root) {
    [].slice.call((root || document).querySelectorAll("[data-weave]")).forEach(weave);
  }

  run();
  window.BWWeave = { run: run, weave: weave };
}());
