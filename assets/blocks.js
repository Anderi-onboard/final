/* Fills every pattern, landscape and mark cell on a block-composition route.
   The markup only declares intent (data-pattern="wave"); the geometry is
   generated here from assets/marks.js, so a cell can be resized freely and the
   field re-renders at the right density instead of stretching. */
(function () {
  "use strict";
  var M = window.BWMarks;

  /* ── module state ─────────────────────────────────────────────────────────
     ⚠️ Declared HERE, above the render pass, and not beside the functions that
     use them. The render runs while this file is still executing, so a `var`
     initialised further down is hoisted-but-undefined when the first field asks
     for it. Three separate values have been caught by that in this file — a
     name cache, a radius cache, and the deal cursor, the last of which silently
     dealt every mark as deck[NaN] and emptied both fields on the method page.
     Guarding each one lazily was treating the symptom; they live at the top
     now. */
  var PH_R = {};       /* motif name → drawn radius, measured once            */
  var DEAL = 0;        /* one cursor across every field on the page (see below) */

  if (!M) return;

  var PATTERN = {
    /* Each entry returns [pathData, strokeWidth] or ["#fill", markup]. Pitches
       are chosen so roughly the same number of repeats lands in a cell at any
       width — density is the thing that has to stay constant, not size. */
    vesica: function (w, h) {
      /* Cap the lens ratio. Left to follow the cell, a tall narrow block turns
         the motif into a spike — and the ratio is the motif: 1:3.4 is a leaf,
         1:8 is a needle. Height yields to width, never the other way. */
      var vw = Math.max(14, Math.min(w / 7, 30));
      var vh = Math.min(h * .78, vw * 2.6);
      return { fill: M.vesicaRow(w, h, { pitch: vw * 1.75, vw: vw, vh: vh }) };
    },
    /* Line weight is a fraction of the motif's own pitch, never a loose number.
       Tied to pitch, a field keeps the same ink-to-ground ratio at any cell
       size, and the weights stay in step with each other when one changes.
       Below about a quarter of the pitch the stroke stops reading as drawn
       and starts reading as a faint ruling — which is what these were. */
    tally: function (w, h) {
      var pitch = 15;
      return { stroke: M.tally(w, h, { pitch: pitch, lean: 4.5 }), width: pitch * .38 };
    },
    wave: function (w, h) {
      var pitch = 26;
      return { stroke: M.waveField(w, h, { pitch: pitch, amp: .26 }), width: pitch * .36 };
    },
    scallop: function (w, h) {
      var pitch = Math.max(34, w / 12);
      return { stroke: M.scallop(w, h, { pitch: pitch }), width: pitch * .28 };
    },
    /* The logomark as a field. Four abstract motifs was a thin vocabulary for a
       site with its own symbol sitting unused in seven page headers — this is
       the brand itself, at field scale, in the same ridge language as the
       background it sits in front of. */
    brand: function (w, h) {
      return { raw: M.brandField(w, h, { pitch: Math.max(110, Math.min(w / 2.6, 190)) }) };
    },
    /* Solid and broken bars — the product's own alphabet, drawn with the same
       brush as the reading figure rather than as a lookalike. */
    yao: function (w, h) {
      var bw = Math.max(46, Math.min(w / 3.4, 96));
      return { raw: '<g opacity=".92">' + M.yaoField(w, h, { bw: bw, t: bw * .12, gap: bw * .11 }) + '</g>' };
    },
    /* The connected-coin motif. It has been defined in marks.js all along and
       never used anywhere — stroked, never filled, because filling unions the
       discs into a clover and the square holes vanish. */
    coin: function (w, h) {
      var pitch = Math.max(30, Math.min(w / 7, 54));
      /* M.coin draws ONE cluster of five overlapping discs, not a field, so the
         cluster is tiled here. Rows step by 2*pitch because each cluster is two
         pitches tall, and alternate rows offset by one pitch so the chain
         interlocks instead of stacking into columns. */
      var d = "", row = 0, step = pitch * 2;
      for (var y = 0; y < h + step; y += step, row++) {
        for (var x = (row % 2 ? -pitch : 0); x < w + step; x += step) {
          d += '<g transform="translate(' + Math.round(x) + ' ' + Math.round(y) + ')">'
             + M.coin({ pitch: pitch }) + '</g>';
        }
      }
      return { raw: '<g fill="none" stroke="currentColor" stroke-width="' + (pitch * .10).toFixed(2)
        + '" stroke-linejoin="round" opacity=".9">' + d + '</g>' };
    }
  };
  var MARK = {
    hexagram: function () {
      /* ䷂ 3 · Sprouting — solid, broken, broken, broken, solid, broken. A real
         figure rather than a decorative arrangement of bars. */
      return '<g fill="currentColor">' + M.hexagram([1, 0, 0, 0, 1, 0], { w: 120, t: 9, gap: 7 }) + '</g>';
    },
    florette: function () {
      /* hole + h must stay ≤ 56 so the rosette clears the 120 viewBox below;
         26 × 48 is the leaf ratio the pattern fields use, kept the same here
         so the mark and the fields are recognisably one motif at two sizes. */
      return '<g fill="currentColor" transform="translate(60 60)">'
        + M.florette({ w: 26, h: 48, hole: 8 }) + '</g>';
    },
    /* The header wears the real logomark. It used to wear a dot ring — a
       generic ornament standing in for a brand that was inlined in seven HTML
       files and reachable from none of the generated marks. */
    ring: function () { return M.brandMark({ size: 512 }); },
    brand: function () { return M.brandMark({ size: 512 }); }
  };

  /* ── the thirty phenomena, as fields ────────────────────────────────────
     assets/marks.js has carried thirty motifs since they were drawn and
     nothing on the site drew a single one of them. They are the site's own
     vocabulary — one weight of rounded ribbon, placed rather than grown — so
     they are the right thing for a texture field, and better than the four
     abstract fills that were standing in for them.

     Placement follows the same law as everything else here: deterministic and
     cyclic, never random. Rows stagger, and the offset and scale step through
     co-prime cycles of 3 and 5 so no two neighbouring instances share a pair
     and the field has a beat without repeating for fifteen. A random jitter
     would reshuffle on every navigation and read as a fault. */
  var PH_OFF = [0, 1, -0.6];
  var PH_SCL = [1, 0.86, 1.12, 0.94, 1.06];
  function phenomenonField(name, w, h) {
    var d = M.phenomena[name]();
    /* Pitch follows the cell so density stays constant at any size, which is
       the rule the other fields already keep. The motifs are drawn at roughly
       ±16 units, so the scale is the pitch over their span. */
    var pitch = Math.max(46, Math.min(w / 5, 104));
    var base = pitch / 46;
    var cols = Math.ceil(w / pitch) + 1, rows = Math.ceil(h / pitch) + 1;
    var out = "", r, c, i, x, y, sc;
    for (r = 0; r < rows; r++) {
      for (c = 0; c < cols; c++) {
        i = r * cols + c;
        x = c * pitch + (r % 2 ? pitch * .5 : 0) + PH_OFF[i % 3] * pitch * .07;
        y = r * pitch + PH_OFF[(i + 1) % 3] * pitch * .06;
        sc = base * PH_SCL[i % 5];
        out += '<g transform="translate(' + x.toFixed(1) + ' ' + y.toFixed(1)
          + ') scale(' + sc.toFixed(3) + ')"><path d="' + d + '"/></g>';
      }
    }
    return { raw: '<g fill="currentColor" opacity=".82">' + out + '</g>' };
  }


  /* ── arranged by density, not by tiling ─────────────────────────────────
     The reference field is a dither: the marks cluster, thin out, and go solid
     in a couple of places. That gradient is the whole reason it reads as an
     image rather than as wallpaper, and it is the rule the method cards
     borrow — an even pitch with a little jitter is exactly what it is not.

     The field is three sines at co-prime periods summed together. Continuous,
     so the density has a direction instead of being a per-cell coin flip; and
     deterministic, so a block draws the same way on every visit — the same
     law the strokes and the palette order already follow. A cell draws when
     the field clears a threshold, and its SCALE follows how far it cleared
     by, which is what softens the edge of a cluster instead of ending it on a
     line. */
  function ditherField(name, w, h, opt) {
    opt = opt || {};
    var d = M.phenomena[name] && M.phenomena[name]();
    if (!d) return "";
    var pitch = opt.pitch || Math.max(20, Math.min(w / 8, 44));
    var cols = Math.max(1, Math.ceil(w / pitch)), rows = Math.max(1, Math.ceil(h / pitch));
    var ax = opt.ax || 0.9, ay = opt.ay || 1.3, phase = opt.phase || 0;
    var cut = opt.cut == null ? 0.46 : opt.cut;
    var out = "", r, c, u, v, f, k, sc;
    for (r = 0; r < rows; r++) {
      for (c = 0; c < cols; c++) {
        u = (c + 0.5) / cols; v = (r + 0.5) / rows;
        f = 0.5
          + 0.42 * Math.sin(6.2831853 * (u * ax + 0.13 + phase))
          + 0.31 * Math.sin(6.2831853 * (v * ay - 0.21 + phase))
          + 0.19 * Math.sin(6.2831853 * (u * 2.6 + v * 1.7));
        f /= 1.46;
        if (f < cut) continue;
        k = Math.min(1, (f - cut) / 0.42);
        sc = (pitch / 46) * (0.42 + 0.78 * k);
        out += '<g transform="translate(' + ((c + 0.5) * pitch).toFixed(1) + ' '
          + ((r + 0.5) * pitch).toFixed(1) + ') scale(' + sc.toFixed(3) + ')"><path d="' + d + '"/></g>';
      }
    }
    return '<g fill="currentColor">' + out + '</g>';
  }

  /* Every phenomenon is available as a field and as a single centred mark, so
     the markup keeps declaring intent by name and nothing here has to be
     duplicated per motif. */
  Object.keys(M.phenomena).forEach(function (name) {
    PATTERN[name] = function (w, h) { return phenomenonField(name, w, h); };
    MARK[name] = function () {
      return '<g fill="currentColor" transform="translate(60 60) scale(3.1)"><path d="'
        + M.phenomena[name]() + '"/></g>';
    };
  });

  function render(el) {
    var w = Math.max(1, Math.round(el.clientWidth)), h = Math.max(1, Math.round(el.clientHeight));
    var scat = el.getAttribute("data-scatter");
    var pat = el.getAttribute("data-pattern"),
        land = el.getAttribute("data-land"),
        mk = el.getAttribute("data-mark");
    var body = "", vb = "0 0 " + w + " " + h, extra = 'preserveAspectRatio="none"';

    if (scat != null) {
      /* A carrier that is nothing but ground gets the whole catalogue rather
         than one motif repeated — the same placement law as the about cards,
         a different seed so it is a different field. */
      /* Dense enough that the whole catalogue actually gets dealt: at a pitch
         of a fifth of the cell only about thirteen marks fit, so ten of the
         thirty never appeared. */
      body = blendField(w, h, { seed: 20260829 + parseInt(scat, 10) * 4093,
                                lead: el.getAttribute("data-lead") || null,
                                leadAt: parseInt(scat, 10) === 1 ? 0.34 : 0.62 });
    } else if (pat && PATTERN[pat]) {
      var p = PATTERN[pat](w, h);
      /* Three shapes a pattern can take: filled markup, a stroked path, or raw
         markup that carries its own paint (the logomark is stroked, the yao
         bars are filled — one wrapper cannot describe both). */
      body = p.raw
        ? p.raw
        : p.fill
          ? '<g fill="currentColor" opacity=".9">' + p.fill + '</g>'
          : '<path d="' + p.stroke + '" fill="none" stroke="currentColor" stroke-width="' + p.width
            + '" stroke-linecap="round" opacity=".9"/>';
    } else if (land != null) {
      /* The landscape blocks stand in for photographs. They are drawn from the
         same rounded-contour construction as the animated range, so a still
         image on this route is recognisably the same country as the moving one
         on the app routes — and unlike a raster it is sharp at every DPI. */
      body = M.landscape(parseInt(land, 10) * 131 + 7, w, h,
        { layers: 4, fill: h / w < .22 ? .42 : 1 });
    } else if (mk && MARK[mk]) {
      body = MARK[mk]();
      vb = (mk === "ring" || mk === "brand") ? "0 0 512 416" : "0 0 120 120";
      extra = 'preserveAspectRatio="xMidYMid meet"';
    } else return;

    el.innerHTML = M.svg(body, vb, extra);
  }

  /* ── woven weight ───────────────────────────────────────────────────────
     One typeface, weight alternating word by word — the same face at two
     weights rather than two faces. Split here rather than in the markup so
     the copy stays plain text and stays editable.

     Deterministic by word index, exactly as the brush is by bar index: a
     random assignment would reshuffle on every navigation and read as a
     rendering fault rather than as a decision. */
  /* The woven weight moved to assets/weave.js — every route uses it now,
     not only the block ones, so it cannot live in a block-route file. */


  var cells = [].slice.call(document.querySelectorAll("[data-pattern],[data-land],[data-mark],[data-scatter]"));
  /* Skip anything with no box yet. On the method route the fields live inside
     steps that are display:none until shown, so measuring them at load gives
     zero and draws nothing — which is why those bands came up empty. Callers
     re-run this when a step becomes visible. */
  function all() { cells.forEach(function (c) { if (c.clientWidth > 0) render(c); }); }
  all();

  /* ── the group crossfade gate ─────────────────────────────────────────────
     The block routes recolour with the palette, and the transition that makes
     that a crossfade must NOT run on the first application: the stylesheet's
     fallback colours paint first, so an ungated transition fades the page from
     the fallback into the group on every single load — a visible wash of the
     wrong colour before the right one, once per navigation. The class goes on
     after the first group has landed, so load is instant and every change
     after it is a crossfade. */
  (function () {
    var root = document.documentElement;
    function arm() {
      window.removeEventListener("bw:palettechange", arm);
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { root.classList.add("bw-cross"); });
      });
    }
    if (root.dataset.bwPalette) arm();
    else window.addEventListener("bw:palettechange", arm);
  }());


  /* ── all thirty, scattered ────────────────────────────────────────────────
     The arrangement is multi-class blue noise (Wei, SIGGRAPH 2010). The
     problem it names is exactly this one: N classes of object where each class
     on its own AND the union of all of them have to read as evenly spread with
     no visible structure. Thirty motifs dropped by plain random gives clumps
     and holes; thirty motifs on a grid gives a table. Blue noise is the third
     thing — no two samples closer than a radius, which is what "evenly spread
     without structure" means formally.

     ⭐ The whole method is in the conflict matrix, and for us it collapses to
     two numbers:
        within a class  R_SAME — large. A motif must never recur near itself.
        across classes  R_ANY  — small. Different motifs may sit close.
     That single asymmetry is what makes the field dense and still legible as
     thirty different things: locally you always see neighbours that differ,
     and you have to travel to meet the same motif twice. It is also the
     construction-level answer to the repeat fault this repo has hit before —
     "structural repetition cannot be fixed by jittering parameters", so it is
     ruled out by the placement law instead of watched for.

     ⭐ Figure-ground (Gestalt): type is the figure, this is the ground, and a
     ground is separated from its figure by carrying LESS DETAIL — not by
     getting out of the way. So marks are allowed to cross a text box, but
     their scale and their weight fall off as they approach one. Overlap
     without interference, which is what was asked for, and it is also what the
     legibility literature prescribes: reduce the ground's detail where the
     figure sits.

     Deterministic, like every other generated thing here: one seed per field,
     so a field is identical on every visit. A field that reshuffles on
     navigation reads as a rendering fault, not as a decision. */
  /* ⚠️ Resolved on first use, not at this line. The render pass runs while
     this file is still executing, so a module-level assignment down here is
     still undefined when the first field asks for it. */

  /* ── how big a motif actually is ──────────────────────────────────────────
     Measured from the path's own coordinates, cached per motif. The thirty
     have very different native extents, so a single spacing number cannot keep
     them apart: a wide one and a narrow one at the same centre distance are
     not equally clear of each other.

     ⭐ This is what makes the field read as ONE layer. Marks that cross each
     other read as two things stacked no matter how the placement is tuned, so
     overlap is not discouraged here, it is impossible: a candidate is rejected
     unless the gap between its own drawn radius and its neighbour's is clear.
     Nothing is ever laid over anything else. */
  function motifRadius(name) {
    if (PH_R[name] != null) return PH_R[name];
    var d = M.phenomena[name] && M.phenomena[name]();
    var r = 20;
    if (d) {
      var nums = d.match(/-?\d*\.?\d+(?:e-?\d+)?/g) || [];
      var m = 0;
      for (var i = 0; i < nums.length; i++) {
        var v = Math.abs(parseFloat(nums[i]));
        if (v > m && v < 1e4) m = v;
      }
      if (m > 0) r = m;
    }
    PH_R[name] = r;
    return r;
  }

  var PH_NAMES = null;
  /* ⭐ One cursor for the whole page, not an offset per field. Fields do not
     know how many marks the previous one managed to place, so any fixed offset
     is a guess: 15 made two fields overlap by a slot and lost a motif, 17
     skipped one and lost three. A shared cursor deals the catalogue out exactly
     once before anything repeats, whatever each field ends up fitting.
     ⚠️ DEAL is declared at the top of the file, not here — a second `var DEAL =
     0` at this point would re-zero the cursor after the first render pass. */

  function scatterField(w, h, opt) {
    opt = opt || {};
    var rand = M.rng(opt.seed || 20260829);
    var pitch = opt.pitch || Math.max(20, Math.min(w, h) / 11);
    var rSame = pitch * (opt.same || 3.4);      /* a motif vs itself   */
    var rAny  = pitch * (opt.any  || 0.60);     /* a motif vs any other */
    var avoid = opt.avoid || [];                /* text boxes, page coords */
    var soft  = opt.soft == null ? pitch * 1.4 : opt.soft;
    var bands = opt.bands || 3;
    var target = opt.count || Math.round((w * h) / (pitch * pitch) * 0.62);

    /* ⭐ Rows, not free scatter. Pure blue noise has no rhythm — it reads as
       confetti, which is the "too unstructured" half of the note. The wave
       field that was pointed at as the good example is stacked: courses of
       marks running across, which is what gives it order. So y is quantised to
       a course with a small jitter (±22% of the spacing) while x stays free
       and conflict-checked. Courses give the stacking; the free x and the
       conflict matrix keep it off a grid. */
    var baseScale = (pitch / 150) * (opt.scale || 1);
    /* ⚠️ 1.14 left one grazing pair in 223. The radius here is a bounding
       CIRCLE taken from the path's coordinates, but what reads as overlap is
       the bounding box, and two elongated marks can clear the circles while
       their boxes cross. The margin covers the difference. */
    var gap = opt.gap || 1.32;

    var lane = pitch * 1.06;
    var lanes = Math.max(1, Math.round(h / lane));
    lane = h / lanes;

    var placed = [], tries = 0, cap = target * 60;

    /* ⭐ A block of material needs a subject. An even field has no centre and
       the eye has nowhere to land — it reads as wallpaper however well spaced
       it is. One motif is drawn large and at full weight, the rest sit back.
       ⚠️ It is placed FIRST, at its own scale, so every later candidate is
       tested against its real radius. Enlarging a mark after placement would
       reopen the overlap the clearance test exists to prevent. */
    if (opt.lead) {
      var leadScale = baseScale * (opt.leadScale || 2.3);
      var lr = motifRadius(opt.lead) * leadScale;
      placed.push({
        x: w * (opt.leadAt || 0.38), y: h * 0.5,
        name: opt.lead, k: 1, drawn: lr, sc: leadScale, lead: true, band: 0
      });
    }
    /* Cycle the class rather than drawing it at random: every motif is dealt
       before any is dealt twice, which is how all thirty actually get used
       instead of the common ones crowding out the rest. The offset walks by a
       number coprime with the count so successive passes do not repeat the
       same order. */
    /* ⚠️ One deck for the whole site, shuffled from a CONSTANT seed, and dealt
       through a cursor shared by every field on the page. Shuffling per field
       looked tidier and quietly cost coverage — two sparse fields drawing
       independently overlap, and the method page dealt only 17 of the 30.
       Per-field offsets were no better, because a field cannot know how many
       marks the one before it actually fitted: 15 overlapped by a slot, 17
       skipped one. Positions still come from each field's own seed, so nothing
       reads as repeated. */
    var deck = Object.keys(M.phenomena);
    var dealer = M.rng(20260829);
    for (var s = deck.length - 1; s > 0; s--) {
      var j = Math.floor(dealer() * (s + 1)), t = deck[s]; deck[s] = deck[j]; deck[j] = t;
    }

    while (placed.length < target && tries < cap) {
      tries++;
      var name = deck[DEAL % deck.length];
      var x = rand() * w;
      var y = (Math.floor(rand() * lanes) + 0.5 + (rand() - 0.5) * 0.44) * lane;
      var ok = true;
      var drawn = motifRadius(name) * baseScale;
      for (var i = 0; i < placed.length; i++) {
        var p = placed[i];
        var dx = p.x - x, dy = p.y - y, d2 = dx * dx + dy * dy;
        /* two clearances, and the larger wins: the two marks must not touch,
           AND a motif must stay well away from another copy of itself */
        var touch = (drawn + p.drawn) * gap;
        var r = (p.name === name) ? Math.max(rSame, touch) : Math.max(rAny, touch);
        if (d2 < r * r) { ok = false; break; }
      }
      if (!ok) continue;
      /* figure-ground falloff: 0 inside a text box, 1 well clear of one */
      var near = 1;
      for (var a = 0; a < avoid.length; a++) {
        var b = avoid[a];
        var ox = Math.max(b.x - x, 0, x - (b.x + b.w));
        var oy = Math.max(b.y - y, 0, y - (b.y + b.h));
        var dist = Math.hypot(ox, oy);
        near = Math.min(near, Math.min(1, dist / soft));
      }
      /* Marks are allowed to cross type — the art layer sits behind it — they
         just arrive there quiet and small. Excluding them outright leaves a
         visible hole in the shape of the text box, which reads as a mistake;
         the ground is supposed to pass under the figure, only with less
         detail. `near` floors rather than rejects. */
      placed.push({ x: x, y: y, name: name, k: near, drawn: drawn,
                    sc: baseScale, band: placed.length % bands });
      DEAL++;
    }

    /* Grouped into a few drift bands rather than animated one mark at a time:
       a handful of composited layers instead of hundreds. */
    var out = [], g;
    for (g = 0; g < bands; g++) out[g] = "";
    placed.forEach(function (p) {
      var d = M.phenomena[p.name] && M.phenomena[p.name]();
      if (!d) return;
      /* ⭐ Size is very nearly constant; only weight varies. Marks at mixed
         sizes read as marks at mixed DISTANCES — that is the "too
         three-dimensional" half of the note, and it is size that causes it,
         not density. So the figure-ground falloff is carried by opacity alone
         and every mark sits on the same plane. No rotation anywhere either:
         the catalogue already mixes upright and lying motifs, and tilting them
         on top of that is what turns a field into a jumble. */
      /* one plane: size does not vary with the falloff, or a mark near type
         would be smaller than the clearance it was placed with. The lead is the
         one deliberate exception, and it is placed FIRST at its own size so the
         clearance test sees it correctly. */
      var sc = p.sc;
      out[p.band] += '<g data-ph="' + p.name + '" transform="translate(' + p.x.toFixed(1) + ' ' + p.y.toFixed(1)
        + ') scale(' + sc.toFixed(4) + ')" opacity="'
        + (p.lead ? 1 : (0.26 + 0.58 * p.k)).toFixed(3)
        + '"><path d="' + d + '"/></g>';
    });
    var svg = "";
    for (g = 0; g < bands; g++) {
      svg += '<g class="ph-drift ph-drift-' + g + '" fill="currentColor">' + out[g] + '</g>';
    }
    return { markup: svg, count: placed.length,
             used: placed.reduce(function (m, p) { m[p.name] = 1; return m; }, {}) };
  }


  /* ── a field behind a carrier that already has content ────────────────────
     [data-scatter] replaces a cell's contents; this puts a field BEHIND one
     that already has some. The text boxes are measured at runtime and handed
     to the placement as avoid regions, so the ground thins toward the type
     wherever the type happens to be — which on these cards is a different
     corner every time. */
  function backdrops() {
    [].slice.call(document.querySelectorAll("[data-scatter-bg]")).forEach(function (host, i) {
      var w = Math.round(host.clientWidth), h = Math.round(host.clientHeight);
      if (w < 40 || h < 40) return;
      var slot = host.querySelector(":scope > .bk-art");
      if (!slot) {
        slot = document.createElement("div");
        slot.className = "bk-art";
        slot.setAttribute("aria-hidden", "true");
        host.insertBefore(slot, host.firstChild);
      }
      var base = host.getBoundingClientRect();
      var avoid = [];
      [].slice.call(host.querySelectorAll("h1,h2,h3,p,li,button,textarea,input,select,label,a,.mt-hint,.mt-meta"))
        .forEach(function (el) {
          var r = el.getBoundingClientRect();
          if (r.width < 2 || r.height < 2) return;
          avoid.push({ x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height });
        });
      var strength = parseFloat(host.getAttribute("data-scatter-bg")) || 1;
      slot.innerHTML = M.svg(
        blendField(w, h, {
          seed: 20260829 + i * 6317,
          /* ⚠️ Capped. A backdrop host can be the whole page column, and a
             pitch derived from its short side then draws marks several times
             the size of the ones on the cards. */
          pitch: Math.max(56, Math.min(130, Math.min(w, h) / 4.6)),
          avoid: avoid
        }), "0 0 " + w + " " + h, 'preserveAspectRatio="none"');
      slot.style.opacity = strength;
    });
  }


  /* ── a texture block ──────────────────────────────────────────────────────
     One layer. Nothing under it, nothing over it.

     ⚠️ This used to draw a contour field and then lay phenomena on top of it,
     and that was the fault: two textures in one carrier read as two textures in
     one carrier, however quiet the lower one is. A carrier gets contour lines
     OR marks, never both. The pages already have contour cells of their own —
     those stay exactly as they are, and they are one layer too.

     ⭐ Sparse and large, which is the other half. Small marks at even spacing
     across a surface stop reading as objects and start reading as printed
     cloth; that comes from size and density, not from the placement law. Few
     enough to look at one at a time, big enough to recognise, and — since the
     clearance test above uses each motif's real drawn radius — never touching. */
  function blendField(w, h, opt) {
    opt = opt || {};
    return scatterField(w, h, {
      seed: opt.seed || 20260829,
      lead: opt.lead || null,
      leadAt: opt.leadAt,
      leadScale: opt.leadScale,
      pitch: opt.pitch || Math.max(32, Math.min(w, h) / 6.4),
      same: opt.same || 3.2,
      any: opt.any || 1.15,
      avoid: opt.avoid || [],
      scale: opt.scale || 2.05,
      bands: opt.bands || 3
    }).markup;
  }

  window.BWBlocks = { render: all, dither: ditherField, scatter: scatterField,
                      blend: blendField, backdrops: backdrops, svg: M.svg };

  /* Re-render on resize so the pattern keeps its density rather than being
     stretched — a scaled vesica row is a different motif from a denser one. */
  var t = 0;
  addEventListener("resize", function () {
    clearTimeout(t);
    t = setTimeout(function () { all(); backdrops(); }, 140);
  });
  /* After layout, not during it: the avoid boxes are measured from the live
     text, so this has to run once the cards have their real size. */
  if (document.readyState === "complete") backdrops();
  else addEventListener("load", backdrops);
}());
