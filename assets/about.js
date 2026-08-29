/* The About route's card art.
   The corner marks only. The cards themselves are text panels and carry grain,
   not marks; the phenomena live in the ground between them. */
(function () {
  "use strict";
  var B = window.BWBlocks;
  if (!B) return;

  var cards = [].slice.call(document.querySelectorAll(".ab-card[data-ph]"));
  if (!cards.length) return;

  /* ── the figure in each panel ─────────────────────────────────────────────
     ⭐ ONE LAYER. The artwork is a block in the flow between the headline and
     the caption — not a field behind them. That distinction is the whole note:
     a texture under type is a second layer however faint it is, because the
     panel then floats and something else runs on underneath it. Here nothing
     is behind anything; the drawing is a sibling of the words, the way the
     reference sets its illustration between its heading and its body copy.

     A small cluster, drawn large. The motifs are dealt from the site's shared
     deck so the four panels between them still show a good spread of the
     catalogue, and they are laid out on a shallow arc rather than scattered —
     a scatter inside a panel would be the calico again, at panel scale. */
  var M = window.BWMarks;
  var DECK = null;

  function deck() {
    if (DECK) return DECK;
    var names = Object.keys(M.phenomena);
    var rand = M.rng(20260829);
    for (var i = names.length - 1; i > 0; i--) {
      var j = Math.floor(rand() * (i + 1)), t = names[i]; names[i] = names[j]; names[j] = t;
    }
    DECK = names;
    return DECK;
  }

  /* Path bounds, measured once — the thirty have very different native extents,
     so a shared scale would draw some of them as specks and others off the
     edge. Each is normalised to its own box and then sized deliberately. */
  var probe = null, probePath = null;
  function bounds(d) {
    if (!probe) {
      probe = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      probe.setAttribute("style", "position:absolute;width:0;height:0;overflow:hidden");
      probePath = document.createElementNS("http://www.w3.org/2000/svg", "path");
      probe.appendChild(probePath);
      document.body.appendChild(probe);
    }
    probePath.setAttribute("d", d);
    return probePath.getBBox();
  }

  function paintFigures() {
    if (!M || !M.phenomena) return;
    var names = deck();
    [].forEach.call(document.querySelectorAll(".ab-figure[data-fig]"), function (host) {
      var n = parseInt(host.getAttribute("data-fig"), 10) || 1;
      var rand = M.rng(20260829 + n * 7919);
      /* eight per panel, so the four panels deal the whole catalogue between
         them and no motif is left out of the page */
      var count = 8;
      var W = 100, H = 40, pad = 3, gap = 2.4;

      /* Measure everything first, then lay it out by width. ⚠️ Spacing the row
         by even fractions of the width overlapped eleven pairs: the thirty have
         very different proportions, so equal centres are not equal clearances.
         Walking a cursor by each mark's own half-width plus a gap makes
         non-overlap arithmetic rather than something to check for. */
      var items = [], i, total = 0;
      for (i = 0; i < count; i++) {
        var name = names[((n - 1) * count + i) % names.length];
        var fn = M.phenomena[name];
        if (!fn) continue;
        var d = fn();
        var bb = bounds(d);
        if (!bb.width || !bb.height) continue;
        var target = H * (0.52 + rand() * 0.20);
        var sc = target / Math.max(bb.width, bb.height);
        var w = bb.width * sc;
        items.push({ name: name, d: d, bb: bb, sc: sc, w: w });
        total += w;
      }
      if (!items.length) return;
      total += gap * (items.length - 1);

      /* fit the row to the block rather than letting it run off the edge */
      var fit = Math.min(1, (W - pad * 2) / total);
      var x = (W - total * fit) / 2;
      var body = "";
      items.forEach(function (it, k) {
        var sc = it.sc * fit, w = it.w * fit;
        var t = items.length === 1 ? 0.5 : k / (items.length - 1);
        /* a shallow arc — ordered, so it reads as an arrangement rather than a
           scatter; a scatter inside a panel is the calico again at panel scale */
        var cy = H / 2 - Math.sin(t * Math.PI) * H * 0.13;
        var cx = x + w / 2;
        x += w + gap * fit;
        body += '<g data-ph="' + it.name + '" transform="translate(' + cx.toFixed(2) + ' ' + cy.toFixed(2)
          + ') scale(' + sc.toFixed(4) + ') translate(' + (-(it.bb.x + it.bb.width / 2)).toFixed(2)
          + ' ' + (-(it.bb.y + it.bb.height / 2)).toFixed(2) + ')"><path d="' + it.d + '"/></g>';
      });
      host.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet" '
        + 'fill="currentColor" aria-hidden="true">' + body + '</svg>';
    });
  }

  paintFigures();
}());
