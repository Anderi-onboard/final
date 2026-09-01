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
  function nextMotif() {
    var deck = Object.keys(M.phenomena);
    return deck[DEAL++ % deck.length];
  }

  function scatterField(w, h, opt) {
    opt = opt || {};
    var deck = Object.keys(M.phenomena);
    var dealer = M.rng(20260829);
    for (var s0 = deck.length - 1; s0 > 0; s0--) {
      var j0 = Math.floor(dealer() * (s0 + 1)), t0 = deck[s0]; deck[s0] = deck[j0]; deck[j0] = t0;
    }

    /* ── courses, not a scatter ───────────────────────────────────────────
       ⭐⭐ Positions are REGULAR. Blue-noise placement spreads evenly and reads
       as disorder anyway, because every mark sits at an arbitrary point; adding
       lanes and a subject helped the rhythm but not that. The stacked wave
       field that keeps being pointed at as the good one is regular — courses
       running across, even spacing along each, offset row to row. That is what
       makes it read as a made thing rather than as spillage.

       ⭐ The variety comes from the MOTIFS, not from the coordinates. Thirty
       different things on a regular lattice is not a table; the same thing
       thirty times on a regular lattice is. The lattice supplies the order and
       the catalogue supplies the difference — each does one job.

       ⚠️ Offsets run on a 3-cycle rather than alternating. Brickwork on a
       half-offset shows a hard vertical seam every other course; three phases
       take nine rows to repeat, which is more than any block here is tall.
       Same reasoning as the strokes and the contours: an ordered cycle, never
       randomness, because randomness is the one thing that cannot make a
       rhythm. */
    var pitch = opt.pitch || Math.max(30, Math.sqrt(w * h) / 7.4);
    var cols = Math.max(2, Math.round(w / pitch));
    var rows = Math.max(2, Math.round(h / pitch));
    var cw = w / cols, ch = h / rows;
    var OFFSETS = [0, 1 / 3, 2 / 3];
    var avoid = opt.avoid || [];
    var soft = opt.soft == null ? pitch * 1.4 : pitch * 1.4;
    var bands = opt.bands || 3;

    /* the subject takes a 2x2 of the lattice, so it can be drawn large without
       ever reaching its neighbours — the clearance stays a property of the
       grid rather than something to re-check */
    var leadR = opt.lead ? Math.floor(rows * 0.45) : -1;
    var leadC = opt.lead ? Math.floor(cols * (opt.leadAt || 0.34)) : -1;
    function isLead(r, c) { return r >= leadR && r <= leadR + 1 && c >= leadC && c <= leadC + 1; }
    function idxOf(r, c) { return r * cols + c; }

    /* ── the centre, and the branches off it ─────────────────────────────────
       ⭐⭐ A field of equal marks is a border, not a composition — there is no
       place for the eye to land. So each field has ONE subject on a 2x2 of the
       lattice, the ring of cells touching it are branches at an intermediate
       size, and everything beyond is the field.

       ⚠️ Three sizes, and they are decided by POSITION, not by a cycle. This
       file's own rule is that marks are near enough one size, because marks of
       different sizes read as marks at different DISTANCES and the field goes
       three-dimensional. That rule is about size varying arbitrarily across a
       field; a subject with its branches around it is a local hierarchy, which
       reads as composition instead. Size scattered = depth; size organised
       around a centre = a centre. */
    var TIER_BRANCH = 1.34, TIER_FIELD = 1;
    function tierOf(r, c) {
      if (leadR < 0) return TIER_FIELD;
      var dr = Math.max(leadR - r, 0, r - (leadR + 1));
      var dc = Math.max(leadC - c, 0, c - (leadC + 1));
      return (dr <= 1 && dc <= 1) ? TIER_BRANCH : TIER_FIELD;
    }

    var placed = [], r, c, i;
    for (r = 0; r < rows; r++) {
      for (c = 0; c < cols; c++) {
        if (leadR >= 0 && isLead(r, c)) {
          if (r === leadR && c === leadC) {
            placed.push({ x: (c + 1) * cw, y: (r + 1) * ch, name: opt.lead,
                          k: 1, cell: Math.min(cw, ch) * 2, lead: true, band: 0, tier: 1 });
          }
          continue;
        }
        /* ⚠️ A small, CYCLIC offset off the lattice point — the courses stay
           legible as courses, but the field stops reading as ruled paper. The
           two periods are coprime (5 against 7, and both against the 3-phase
           row offset), so 105 cells pass before a cell repeats its own
           displacement: ordered, and never a visible second grid. Random
           jitter would re-deal on every navigation and read as a fault, the
           same reason the brush steps its wobble by index and does not roll
           for it. The amplitude is a fraction of the clearance the lattice
           already guarantees, so nothing can be jittered into a neighbour. */
        var jx = ((idxOf(r, c) % 5) - 2) / 2 * cw * 0.11;
        var jy = ((idxOf(r, c) % 7) - 3) / 3 * ch * 0.10;
        var x = (c + 0.5 + OFFSETS[r % 3]) * cw + jx;
        if (x > w - cw * 0.2) continue;          /* the row's overhang */
        var y = (r + 0.5) * ch + jy;

        /* figure-ground: the ground thins toward the type, it does not stop */
        var near = 1;
        for (i = 0; i < avoid.length; i++) {
          var b = avoid[i];
          var ox = Math.max(b.x - x, 0, x - (b.x + b.w));
          var oy = Math.max(b.y - y, 0, y - (b.y + b.h));
          near = Math.min(near, Math.min(1, Math.hypot(ox, oy) / soft));
        }

        /* next motif that is not already in this cell's neighbourhood — the
           one thing kept from the blue-noise rule, and the only one that
           mattered: a motif must not turn up next to itself */
        var name = null;
        for (i = 0; i < deck.length; i++) {
          var cand = deck[DEAL % deck.length];
          var clash = placed.some(function (p) {
            return p.name === cand && Math.abs(p.x - x) < cw * 2.5 && Math.abs(p.y - y) < ch * 2.5;
          });
          DEAL++;
          if (!clash) { name = cand; break; }
        }
        if (!name) continue;
        placed.push({ x: x, y: y, name: name, k: near, tier: tierOf(r, c),
                      cell: Math.min(cw, ch), band: placed.length % bands });
      }
    }

    var out = [], g;
    for (g = 0; g < bands; g++) out[g] = "";
    placed.forEach(function (p, idx) {
      var d = M.phenomena[p.name] && M.phenomena[p.name]();
      if (!d) return;
      /* sized to its cell, so nothing can reach a neighbour: the lattice is
         the clearance */
      var sc = (p.cell * (opt.fill || 0.52) * (p.tier || 1)) / (motifRadius(p.name) * 2);
      /* ⭐⭐ A mark is not a bare stroke on a flat field — it has a BACKGROUND
         of its own: two haloes hugging its own silhouette, in two other
         colours, then the ink on top. Dilating the same path with a thick
         round-joined stroke is what produces a backing that follows the shape
         exactly, the way a cut-paper flower stacks one colour inside another.
         Three concentric zones is the whole difference between a motif and a
         doodle, and it is where the colour layering lives.

         ⭐⭐ FOUR plates, not one. Every mark's two rings are printed in two of
         them, and every nth mark has its ink pulled onto a plate as well, so a
         field is a four-colour press rather than a key plus one spot. The
         groups have the colour for it: measured over the catalogue, steps that
         are FAR APART carry genuinely different hues (3↔6 is 128°, 4↔7 116°),
         while adjacent steps are the same hue wearing different lightnesses
         (3↔4 is 6°, 6↔7 is 6°). CSS names which steps; this only says which
         plate each mark is on.

         ⚠️ The cycle is deterministic and its length is coprime with the
         lattice's 3-phase offsets — 4 against 3 means twelve marks before a
         plate lands on the same phase again, so the colour never falls into
         vertical stripes. Per-instance random would re-deal on every
         navigation, which reads as a rendering fault; this is the same rule as
         the brush's `index mod 3` and the contour drift. */
      var accent = opt.accentEvery && (idx % opt.accentEvery === opt.accentEvery - 1);
      var plate = idx % 4;
      out[p.band] += '<g data-ph="' + p.name + '" data-plate="' + plate
        + '" transform="translate(' + p.x.toFixed(1) + ' ' + p.y.toFixed(1)
        + ') scale(' + sc.toFixed(4) + ')" opacity="'
        + (p.lead ? 1 : (0.42 + 0.5 * p.k)).toFixed(3) + '"'
        + '><g class="ph-m">'
        + '<path class="ph-back" d="' + d + '"/>'
        + '<path class="ph-mid" d="' + d + '"/>'
        + '<path class="ph-ink' + (accent ? ' is-accent' : '') + '" d="' + d + '"/>'
        + '</g></g>';
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
  /* ── colonies ─────────────────────────────────────────────────────────────
     A patch of the lattice filling the part of a text block the type does not
     use. Same generator, same order, same clearance — it is the field, cropped
     to a region, not a different kind of thing. */
  /* ⭐ The patch is a RECTANGLE, and a slightly different one on every block.
     A colony that exactly fills its cell squares the block off — which was the
     point when the job was to make a 2:1 block read as a square — but thirteen
     blocks each squared off the same way is a table again. Insetting the patch
     by a small, per-block, asymmetric amount turns each into its own rectangle,
     offset inside its cell. The insets are a cyclic table, not a roll: the
     patch must be the same shape on every visit.

     ⚠️ Insets on ONE axis at a time plus a small nudge on the other. Inset both
     equally and the patch is a smaller square in the middle of the cell — the
     shape has not changed, only the scale, and the eye reads it as the same
     thing again. */
  var COLONY_BOX = [
    [.00, .00, 1.00, .86],  [.06, .00, .94, 1.00], [.00, .09, 1.00, .91],
    [.00, .00, .88, 1.00],  [.04, .05, .96, .89],  [.00, .04, .93, .96]
  ];

  /* ── the artwork crosses the seam ─────────────────────────────────────────
     ⭐⭐ In the reference sheets the picture is not in a box beside the words —
     the cat's tail runs THROUGH the text column and the wash behind the
     sentence comes off the same brush as the fruit. Text and image share one
     field. Here they were strictly separate tiles, which is the opposite read,
     and filling the text blocks with marks instead was the wallpaper that made
     the page unreadable.

     ⭐ So a text block that TOUCHES a picture block gets a few marks hugging
     that shared edge, deliberately cropped by it, so they read as continuing
     out of the neighbour rather than as decoration of their own. Three marks,
     large, and nowhere near the type — the point is a seam that leaks, not a
     field that fills.

     ⚠️ Large and few, never small and many. Small marks spread over a block is
     the calico this page has already been rescued from twice; the reference's
     interaction works because ONE big shape crosses the join. */
  /* ⚠️ Spaced so they cannot touch. The first version put three marks at .06 /
     .42 / .78 of the height at up to 1.34 scale — the checker found 11
     overlapping pairs, because a spill was being placed by eye while every
     other mark on this route gets its clearance from the lattice by
     construction. Widest radius here is .22 x min(w,h) / 2 x 1.25, and the
     closest centres are .42 of the height apart, so the gap holds on any block
     this route produces. */
  var SPILL = [
    { at: .08, s: 1.00, o: .30 },
    { at: .50, s: 1.25, o: .22 },
    { at: .92, s: 0.85, o: .26 }
  ];
  /* ⭐ The corner run is LONGER and a touch stronger than an edge run. An edge
     spill is a shape carrying on into the neighbour, so three marks read as the
     part of it you can see; a corner is a decorated corner, and three small
     faint marks there read as leftovers rather than as an intention. Seven,
     with the weight rising as it walks back out of the corner. */
  var CORNER = [
    { s: 1.00, o: .34 }, { s: 1.22, o: .28 }, { s: 0.88, o: .32 },
    { s: 1.10, o: .26 }, { s: 0.94, o: .30 }, { s: 1.18, o: .22 },
    { s: 0.86, o: .26 }
  ];

  /* ── a painted ground ─────────────────────────────────────────────────────
     ⭐⭐ The reference sheets do not put type on a flat panel — the whole band
     IS a picture, softly painted, and the words lie on it. Five cards on the
     method page carried no art whatsoever, including all three of the big
     959x480 step cards, so they were a flat colour field with one line in the
     middle. That is the emptiness.

     ⭐ This is the range's own landscape, drawn very quietly: four masses, no
     contour lines, in tones a few hundredths of lightness from the card's own
     fill. Loud enough to be a place, quiet enough that it never competes with
     the sentence in front of it — which is what "blends in naturally" means. A
     picture at picture contrast here would be the wallpaper problem again.

     ⚠️ Still. The ridges do not drift, for the reason measured on the home page
     and on the skylines: a ridge spans its whole canvas, so moving one
     re-rasters everything above it. A step card wants to be calm anyway.

     ⚠️ One carrier, one texture. Only cards with no other art get a scene —
     the rule this route has held since the contour/mark split. */
  function scenes() {
    [].slice.call(document.querySelectorAll("[data-scene]")).forEach(function (host, i) {
      var w = Math.round(host.clientWidth), h = Math.round(host.clientHeight);
      if (w < 60 || h < 60) return;
      var slot = host.querySelector(":scope > .bk-scene");
      if (!slot) {
        slot = document.createElement("div");
        /* ⚠️ .bk-art too — `… > :not(.bk-art)` at (0,3,1) forces
           position:relative on anything else, which turns an art layer into a
           grid item. Already paid for once with the spill layer. */
        slot.className = "bk-art bk-scene";
        slot.setAttribute("aria-hidden", "true");
        host.insertBefore(slot, host.firstChild);
      }
      var seed = 20260831 + (parseInt(host.getAttribute("data-scene"), 10) || 1) * 6421;
      slot.innerHTML = M.svg(
        M.landscape(seed, w, h, { layers: 4, silhouette: true, scene: true,
                                  base0: .58, baseSpan: .26, amp: .22, ampNear: .11 }),
        "0 0 " + w + " " + h, 'preserveAspectRatio="none"');
    });
  }

  function spills() {
    [].slice.call(document.querySelectorAll("[data-spill]")).forEach(function (host, i) {
      var w = Math.round(host.clientWidth), h = Math.round(host.clientHeight);
      if (w < 120 || h < 120) return;
      var side = host.getAttribute("data-spill");           /* which edge it shares */
      var slot = host.querySelector(":scope > .bk-spill");
      if (!slot) {
        slot = document.createElement("div");
        /* ⚠️ .bk-art as well as .bk-spill. `body.blocks-route :is(…, .ab-block) >
           :not(.bk-art)` is (0,3,1) and forces position:relative on anything
           that is not .bk-art — so a differently-named absolute layer becomes a
           grid ITEM and adds a row. It grew the page by 635px. This route
           already has a name for "the art layer that is not in the flow"; use
           it rather than inventing a second one the rules do not know. */
        slot.className = "bk-art bk-spill";
        slot.setAttribute("aria-hidden", "true");
        host.insertBefore(slot, host.firstChild);
      }
      /* ⚠️⚠️ A CURSOR walking the edge by measured radii, not three fractions of
         the height. Placing by eye put 11 overlapping pairs on the page, and
         nudging the fractions still left 4 — the lesson this route already
         wrote down for the in-flow figures: even fractions are not even
         clearances, because the motifs have very different aspect ratios. Each
         mark advances the cursor by its own radius plus the gap plus the next
         one's radius, so not overlapping is arithmetic rather than a check. */
      /* ⭐ A corner is a THIRD edge, walked the same way. The owner asked for the
         top-right decorated the way the left edge already is, and the answer is
         not a new placement law — it is the same cursor started at the corner
         and walked inward along the top. Two edges meeting is what makes a
         corner read as a corner; one row of marks along the top would just be a
         second border. */
      var corner = side === "top-right" || side === "top-left";
      var unit = Math.min(w, h) * (corner ? 0.17 : 0.22), out = "";
      var gap = unit * 0.30, cursor = corner ? w * 0.04 : h * 0.06;
      var span = corner ? w : h;
      var table = corner ? CORNER : SPILL;
      for (var k = 0; k < table.length; k++) {
        var c = table[k], name = nextMotif();
        var d = M.phenomena[name] && M.phenomena[name]();
        if (!d) continue;
        var sc = (unit * c.s) / (motifRadius(name) * 2);
        var rad = motifRadius(name) * sc;              /* the radius as drawn */
        if (cursor + rad > span * (corner ? 0.62 : 1)) break;   /* no room: stop */
        /* sat ON the edge, so the block's own overflow does the cropping */
        var x, y;
        if (corner) {
          /* walk in from the corner along the top; the marks straddle the edge
             so the block's own overflow crops them, same as the side spills */
          var along = cursor + rad;
          x = side === "top-right" ? w - along : along;
          y = k % 2 ? rad * 0.10 : rad * 0.52;
        } else {
          x = side === "left" ? 0 : w;
          y = cursor + rad;
        }
        cursor = (corner ? along : y) + rad + gap;
        out += '<g data-ph="' + name + '" data-plate="' + (k % 2) + '" opacity="' + c.o + '"'
          + ' transform="translate(' + x.toFixed(1) + ' ' + y.toFixed(1)
          + ') scale(' + sc.toFixed(4) + ')"><g class="ph-m">'
          + '<path class="ph-back" d="' + d + '"/>'
          + '<path class="ph-mid" d="' + d + '"/>'
          + '<path class="ph-ink" d="' + d + '"/></g></g>';
      }
      slot.innerHTML = M.svg(out, "0 0 " + w + " " + h, 'preserveAspectRatio="none"');
    });
  }

  /* ⭐⭐⭐ A GROVE: one motif, stood up many times.

     "It would be better to see a bamboo grove — open your thinking." The
     catalogue already answers this and the page was not using the answer: this
     route's own rule is that variety comes from the MOTIF and order comes from
     the placement, and thirty different marks scattered in a corner is a sample
     book. Thirty of the SAME mark, stood in a row at different heights, is a
     bamboo grove — a thing, not an assortment.

     So a grove is one motif repeated along a baseline: stems leaning by a
     degree or two either side, heights walking a cycle so no two neighbours
     match, and the tallest deliberately off centre. It is cropped by the
     block's own edge like every other art layer here, which is what makes it a
     stand carrying on past the corner rather than a picture of some plants.

     ⚠️ Deterministic, like everything else drawn on these routes: heights and
     leans come from short coprime cycles, never from a roll. A grove that
     re-arranges itself on every navigation reads as a rendering fault.

     ⚠️ It goes in a CORNER and it is allowed to coexist with an edge spill —
     hence its own attribute. A block can be a shape carrying on into its
     neighbour AND have a stand of bamboo in its top corner; those are two
     different statements and one attribute cannot hold both. */
  var GROVE_H = [1.00, 0.58, 0.86, 0.45, 0.94, 0.63, 0.78, 0.50, 0.90];   /* 9 */
  var GROVE_LEAN = [-1.8, 0.9, 2.1, -0.7, 1.4, -2.2, 0.4];                /* 7 */

  function groves() {
    [].slice.call(document.querySelectorAll("[data-grove]")).forEach(function (host) {
      var w = Math.round(host.clientWidth), h = Math.round(host.clientHeight);
      if (w < 160 || h < 120) return;
      var name = host.getAttribute("data-grove");
      var d = M.phenomena[name] && M.phenomena[name]();
      if (!d) return;
      var slot = host.querySelector(":scope > .bk-grove");
      if (!slot) {
        slot = document.createElement("div");
        /* .bk-art for the same reason the spill layer carries it: the route's
           own rule forces position:relative on anything that is not .bk-art,
           which would make this a grid item and add a row. */
        slot.className = "bk-art bk-grove";
        slot.setAttribute("aria-hidden", "true");
        host.insertBefore(slot, host.firstChild);
      }
      /* the stand fills the top-right corner: as tall as a third of the block,
         as wide as it needs for its stems */
      /* ⭐⭐ A STALK IS THE MOTIF STACKED, not the motif enlarged.

         The catalogue's bamboo is one culm with its nodes, and a culm has a
         fixed proportion — scaling it up to grove height also makes it grove
         WIDTH, so a row of them reads as a line of chunky blobs rather than as
         a stand. Bamboo is tall because it is segmented: joint above joint. So
         a stalk here is the same culm repeated end to end, two to four times,
         which is the route's own principle applied one level down — the variety
         is in how many, not in a second drawing. */
      /* ⚠️⚠️ THE ORDER IS IN THE ROW, THE VARIETY IS IN THE STALK — and the
         first version had it exactly backwards. Every stalk was the same joint
         stamped N times (too regular), while the row wandered because each
         stalk had its own scale and lean (not regular enough). Read together
         that is the worst of both: repetitive up close, untidy from across the
         room.

         So: one width for every stalk and an even step between them, which is
         the row a planted stand actually has — and inside a stalk, each joint
         is nudged and turned by its own small amount, because a bamboo's
         segments are not identical either. Same rule as the ink itself: one
         weight, varied by hand. */
      var seg = motifRadius(name) * 2;
      var unit = (h * 0.28) / seg;              /* ONE width for every stalk */
      var step = seg * unit * 1.42;             /* an even planting distance */
      var stems = Math.max(4, Math.floor((w * 0.42) / step));
      var out = "";
      for (var k = 0; k < stems; k++) {
        var joints = 2 + (k % 4);                       /* 2–5 segments tall */
        var x = w - (w * 0.035) - k * step;
        var col = '';
        for (var j = 0; j < joints; j++) {
          /* per-joint variation, from coprime cycles so a stalk never reads as
             a repeated stamp and never re-arranges itself between visits */
          var jx = GROVE_LEAN[(k + j) % GROVE_LEAN.length] * 0.16;
          var jr = GROVE_LEAN[(k * 2 + j) % GROVE_LEAN.length] * 0.55;
          var jh = 0.93 + GROVE_H[(k + j * 2) % GROVE_H.length] * 0.12;
          col += '<g transform="translate(' + jx.toFixed(2) + ' '
            + (j * seg * 0.84).toFixed(1) + ') rotate(' + jr.toFixed(2) + ')'
            + ' scale(1 ' + jh.toFixed(3) + ')">'
            + '<path class="ph-back" d="' + d + '"/>'
            + '<path class="ph-mid" d="' + d + '"/>'
            + '<path class="ph-ink" d="' + d + '"/></g>';
        }
        /* every stalk starts on the same line above the top edge, so the row is
           level and the crop is a clean one — the raggedness is in how far each
           one comes DOWN, which is what a stand of different ages looks like */
        var y = -seg * unit * 0.52;
        out += '<g data-ph="' + name + '" data-plate="' + (k % 2) + '"'
          + ' opacity="' + (0.42 - (k % 3) * 0.05).toFixed(2) + '"'
          + ' transform="translate(' + x.toFixed(1) + ' ' + y.toFixed(1)
          + ') rotate(' + (GROVE_LEAN[k % GROVE_LEAN.length] * 0.5).toFixed(2)
          + ') scale(' + unit.toFixed(4) + ')">'
          + '<g class="ph-m">' + col + '</g></g>';
      }
      slot.innerHTML = M.svg(out, "0 0 " + w + " " + h, 'preserveAspectRatio="none"');
    });
  }

  function colonies() {
    /* ⚠️ Not the ones that are horizons. The call-to-action's picture carries
       both .ab-colony (for its grid area) and data-horizon (for what it draws),
       so this pass was claiming it too. */
    [].slice.call(document.querySelectorAll(".ab-colony:not([data-horizon])")).forEach(function (host, i) {
      var W = Math.round(host.clientWidth), H = Math.round(host.clientHeight);
      if (W < 40 || H < 40) { host.innerHTML = ""; return; }
      var box = COLONY_BOX[i % COLONY_BOX.length];
      var ox = Math.round(box[0] * W), oy = Math.round(box[1] * H);
      var w = Math.max(30, Math.round((box[2] - box[0]) * W));
      var h = Math.max(30, Math.round((box[3] - box[1]) * H));
      var field = scatterField(w, h, {
        seed: 20260830 + i * 5209,
        accentEvery: 7,
        /* ⭐ A colony has a subject like any other field. Without one it is a
           patch of even marks — a border, with nowhere for the eye to land,
           which is what "there is no centre" was pointing at. The motif is the
           block's own declared centre where it has one, so the choice stays a
           decision rather than whatever the deal turned up. */
        lead: host.getAttribute("data-centre") || nextMotif(),
        leadAt: [.30, .58, .38, .66][i % 4],
        /* denser than a whole texture block, because a colony is small and a
           handful of marks in it would read as three stray dots rather than as
           a patch of ground */
        /* ⚠️ 5.2 -> 4.4. Every motif now animates, and About was carrying 265
           marks: measured 40fps against 61 with the marks held still. The cost
           is per-mark re-raster, so the lever is how many marks there are, not
           which ones move — freezing some would have left visibly dead patches,
           which is the thing being fixed. Fewer, and all of them alive. */
        pitch: Math.max(26, Math.sqrt(w * h) / 4.4),
        fill: 0.48
      });
      host.innerHTML = M.svg('<g transform="translate(' + ox + ' ' + oy + ')">' + field.markup + '</g>',
        "0 0 " + W + " " + H, 'preserveAspectRatio="none"');
    });
  }

  /* ── a horizon: day and night ─────────────────────────────────────────────
     ⭐⭐ Not stripes. The banded sky was a sunset drawn as four flat bars, and
     four bars of colour is a swatch card standing behind a mountain. What a sky
     actually gives a page is a TIME OF DAY: the sun comes up in the east, goes
     down in the west, the moon takes its place, and the light changes with it.
     So the sky is one flat field with one body in it, and the two horizon
     blocks are opposite halves of the same day — one lit, one dark — trading
     places every time the colour group turns.

     ⭐ The body walks its arc across successive turns, not within one. The
     engine publishes the raw slot count, so the sun is a little further west
     each time the palette changes and the whole thing reads as one day passing
     rather than as two pictures being swapped. Nothing animates per frame: this
     is the same hold-then-change the range itself uses.

     ⚠️ Day/night comes from the SLOT, not from the group's index. Keying it to
     which card is up would let a visitor arriving mid-schedule sit in the same
     half of the day for a long run; the slot always alternates.

     ⚠️ Sun and moon are the catalogue's own motifs, not new circles. Every
     other drawn thing on these routes is in the range's hand, and a plain
     geometric disc here would be the one element that is not.

     ⚠️ Every painted piece carries a CSS class and takes its colour from a
     token — no fill="" attributes. A presentation attribute cannot resolve
     var(), so a colour written there is frozen out of the 114-group rotation.

     ⚠️ A horizon and a colony are alternatives, never both — one carrier, one
     figure. A block with marks AND a skyline is two pictures in one box. */
  var ARC_STOPS = 7;   /* turns to cross the sky; coprime with the 2-slot day */

  function horizonScene(host, i, slot) {
    var w = Math.round(host.clientWidth), h = Math.round(host.clientHeight);
    /* ⚠️ Return without clearing. Blanking on a small measurement meant a
       block that had not been laid out yet lost its picture permanently — the
       phone's call to action came up empty because this ran before its
       min-height applied. */
    if (w < 40 || h < 40) return;
    var seed = 20260830 + (parseInt(host.getAttribute("data-horizon"), 10) || 1) * 8171;

    /* ⭐⭐⭐ ALWAYS NIGHT, and nothing in the sky.

       This used to be half of a day: two blocks, one lit and one dark, trading
       places every time the palette turned, each carrying a sun or a moon on an
       arc, three clouds and a scatter of stars. Owner, looking at both: still
       terrible — except the night one, which is worth keeping. So night is what
       is left, and every prop comes out.

       ⭐ What made the night half work is exactly what the props were competing
       with: a deep flat sky with layered silhouettes stepping back into it. One
       idea, held. The daylight version had the same geometry over a pale sky,
       which put the ridges within a few shades of each other and left the sun as
       the only thing to look at — an ornament holding up a composition instead
       of sitting in one.

       ⚠️ The props were not bad drawings. The sun and moon were the catalogue's
       own motifs wearing their own colour rings, and the clouds were the home
       page's actual cloud path. They came out because five things in a 16:7
       band is four things too many, not because any one of them was wrong. */
    host.setAttribute("data-phase", "night");

    /* The whole picture: one flat sky and five silhouettes. */
    host.innerHTML = M.svg(
      '<rect class="hz-sky" x="0" y="0" width="' + w + '" height="' + h + '"/>'
        + M.landscape(seed, w, h,
            { layers: 5, silhouette: true, base0: .56, baseSpan: .30, amp: .26, ampNear: .13 }),
      "0 0 " + w + " " + h, 'preserveAspectRatio="none"');
  }

  function horizons() {
    var slot = parseInt(document.documentElement.dataset.bwPaletteSlot, 10) || 0;
    [].slice.call(document.querySelectorAll("[data-horizon]")).forEach(function (host, i) {
      horizonScene(host, i, slot);
    });
  }

  /* ⚠️⚠️ NOT redrawn on every turn of the palette clock any more.

     It used to be: the sun stepped one position west and the two blocks traded
     day for night each time the colour changed, which is what made the pair
     read as one day passing. Rebuilding them is the expensive way to say that —
     two full landscapes, five layers each, plus clouds and stars, regenerated
     as markup and re-parsed — and it landed in the same frame as the palette
     crossfade. Measured at 6x CPU throttle over twenty seconds, that pairing
     was most of 6 seconds of long tasks.

     The colours still rotate: --hz-sky, --hz-orb and the five land tones are
     CSS relative colours off the group's hues, so the picture recolours without
     JavaScript touching it. What stops is the redraw, which is also what the
     owner asked for — these two blocks are still. */

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
      /* ⚠️ From the geometric mean, not the short side. A wide, shallow block
         has a small short side, so min(w,h) drives the pitch down and the marks
         come out small and dense — the calico again, arrived at through the
         block's proportions rather than through the setting. */
      pitch: opt.pitch || Math.max(30, Math.sqrt(w * h) / 7.4),
      same: opt.same || 3.2,
      any: opt.any || 1.15,
      avoid: opt.avoid || [],
      scale: opt.scale || 2.05,
      bands: opt.bands || 3
    }).markup;
  }

  window.BWBlocks = { render: all, dither: ditherField, scatter: scatterField,
                      blend: blendField, backdrops: backdrops,
                      colonies: colonies, horizons: horizons, svg: M.svg };

  /* Re-render on resize so the pattern keeps its density rather than being
     stretched — a scaled vesica row is a different motif from a denser one. */
  var t = 0;
  addEventListener("resize", function () {
    clearTimeout(t);
    t = setTimeout(function () { all(); backdrops(); colonies(); horizons(); spills(); groves(); scenes(); }, 140);
  });
  /* After layout, not during it: the avoid boxes are measured from the live
     text, so this has to run once the cards have their real size. */
  function afterLayout() { backdrops(); colonies(); horizons(); spills(); groves(); scenes(); }
  if (document.readyState === "complete") afterLayout();
  else addEventListener("load", afterLayout);
}());
