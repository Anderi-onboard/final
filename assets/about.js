/* The About route's card art.
   One figure per panel, in the flow between the headline and the caption. */
(function () {
  "use strict";
  var B = window.BWBlocks;
  if (!B) return;

  /* ── the figure in each panel ─────────────────────────────────────────────
     ⭐ ONE LAYER. The artwork is a block in the flow between the headline and
     the caption — not a field behind them. That distinction is the whole note:
     a texture under type is a second layer however faint it is, because the
     panel then floats and something else runs on underneath it. Here nothing
     is behind anything; the drawing is a sibling of the words, the way the
     reference sets its illustration between its heading and its body copy.

     A small cluster, drawn large, with a subject at its centre. Ordered along
     a shallow arc rather than scattered — a scatter inside a panel would be
     the calico again, at panel scale. */
  var M = window.BWMarks;
  var DECK = null;

  /* The four narrative centres are named in the markup, so the supporting deck
     leaves them out — otherwise a centre would also turn up as a bystander in
     someone else's panel, and the four panels between them would not deal the
     rest of the catalogue. */
  function centres() {
    return [].map.call(document.querySelectorAll(".ab-figure[data-centre]"),
      function (el) { return el.getAttribute("data-centre"); });
  }

  function deck() {
    if (DECK) return DECK;
    var skip = centres();
    var names = Object.keys(M.phenomena).filter(function (n) { return skip.indexOf(n) < 0; });
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
      var centre = host.getAttribute("data-centre");
      var rand = M.rng(20260829 + n * 7919);
      var supporting = 7, W = 100, H = 40, pad = 3, gap = 2.4;

      /* ⭐ The panel's figure has a CENTRE, and it is chosen for what the panel
         says rather than for how it looks: cliff for the reading that is
         already settled, stone for the one you can go and check, tide for the
         one that shows without deciding, valley for depth. A row of evenly
         sized marks is a frieze — it has no subject, and the eye has nowhere to
         land. One motif carries the idea, drawn large; the rest fall away from
         it and read as its company.

         ⚠️ Placed at index 3 of 8, not dead centre. Exact symmetry would make
         the arrangement read as a diagram, and this file already bans symmetry
         in the motifs themselves for the same reason. */
      var order = [], k, at = 3;
      for (k = 0; k < supporting + 1; k++) {
        order.push(k === at ? centre
          : names[((n - 1) * supporting + (k < at ? k : k - 1)) % names.length]);
      }

      var items = [], total = 0;
      order.forEach(function (name, idx) {
        var fn = M.phenomena[name];
        if (!fn) return;
        var d = fn();
        var bb = bounds(d);
        if (!bb.width || !bb.height) return;
        /* falls away from the centre, floored so the ends are still legible
           marks rather than specks */
        var rank = Math.abs(idx - at);
        var weight = Math.max(0.36, Math.pow(0.74, rank));
        var target = H * (idx === at ? 0.92 : 0.5 * weight + rand() * 0.05);
        var sc = target / Math.max(bb.width, bb.height);
        var w = bb.width * sc;
        items.push({ name: name, d: d, bb: bb, sc: sc, w: w, lead: idx === at });
        total += w;
      });
      if (!items.length) return;
      total += gap * (items.length - 1);

      var fit = Math.min(1, (W - pad * 2) / total);
      var x = (W - total * fit) / 2, body = "", cxLead = W / 2;
      /* ⚠️ Walk a cursor by measured widths. Even fractions of the row are not
         even clearances — the thirty have very different proportions, and
         dividing by i/(count-1) overlapped eleven pairs. */
      items.forEach(function (it) {
        var sc = it.sc * fit, w = it.w * fit;
        var cx = x + w / 2;
        if (it.lead) cxLead = cx;
        x += w + gap * fit;
        it.cx = cx; it.scaled = sc;
      });
      items.forEach(function (it) {
        /* the arc peaks on the lead, so the composition's high point and its
           subject are the same place */
        var d = Math.abs(it.cx - cxLead) / W;
        var cy = H / 2 - Math.cos(Math.min(1, d * 2.2) * Math.PI / 2) * H * 0.14;
        body += '<g data-ph="' + it.name + '" transform="translate(' + it.cx.toFixed(2) + ' ' + cy.toFixed(2)
          + ') scale(' + it.scaled.toFixed(4) + ') translate(' + (-(it.bb.x + it.bb.width / 2)).toFixed(2)
          + ' ' + (-(it.bb.y + it.bb.height / 2)).toFixed(2) + ')"'
          + (it.lead ? '' : ' opacity=".72"') + '><path d="' + it.d + '"/></g>';
      });
      host.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet" '
        + 'fill="currentColor" aria-hidden="true">' + body + '</svg>';
    });
  }

  paintFigures();
}());
