/* BourneWise paper chat — working app logic (vanilla JS).
   All state, plans, methods, and entitlements come from BWAccount (account.js).
   This file owns UI rendering and the casting flow — nothing else. */
(function () {
  "use strict";

  var A = window.BWAccount;
  var RAIL = "bw-paper-rail";

  var METHODS = A.METHODS;
  var ORDER = A.METHOD_ORDER;

  var FIGURES = window.BWFigure ? window.BWFigure.NAMES : ["The Well", "The Crossing"];
  var CANNED = [
    { text: "The primary hexagram indicates a structural phase of |restraint|, not forced progression. The environment is not yet aligned. Wait for the cycle to turn." },
    { text: "The framework is unambiguous: the current environment is structurally closed to your intent. Your life trajectory requires a |new vector|, not repeated friction." },
    { text: "Momentum favors adaptation over force, necessitating |incremental progression|. Initiate a singular shift, not a comprehensive disruption. Execute within the current cycle." },
    { text: "What appears as stagnation is identified by the framework as |latency|. Vital variables are aligning beneath the surface of your situation. Delay your execution." },
    { text: "The structural map is clear: the required variable is already known to you. The environment is primed. The framework indicates a readiness for |execution|." },
    { text: "Traversing this life transition is supported, but not in isolation. Identify the |primary ally| this dynamic relies upon and integrate them into your trajectory." }
  ];

  var S = A.state();
  function save() { A.save(S); }

  function activeConv() {
    for (var i = 0; i < S.convs.length; i++) if (S.convs[i].id === S.activeId) return S.convs[i];
    return null;
  }
  function method() { return METHODS[S.method] || METHODS.stria; }

  /* ── els ── */
  var $ = function (id) { return document.getElementById(id); };
  var threadInner = $("threadInner"), castList = $("castList"), toastEl = $("toast");
  var heroEmpty = document.getElementById("heroEmpty");
  var busy = false;
  var esc = A.esc;

  /* ── render: ledger + account ── */
  function renderUnits() {
    var u = S.units.toLocaleString("en-US");
    $("unitsSide").textContent = u;
    $("unitsTop").textContent = u + " units";
    var grant = A.planGrant(S.account.plan);
    var pct = Math.max(4, Math.min(100, Math.round(S.units / grant * 100)));
    var bar = $("unitsBar"); if (bar) bar.style.width = pct + "%";
    var planEl = $("ledgerPlan"); if (planEl) planEl.textContent = A.planName(S.account.plan);
    var cap = $("unitsCap"); if (cap) cap.textContent = A.planName(S.account.plan) + " \u00b7 " + grant.toLocaleString("en-US") + " / mo";
  }
  function renderAccount() {
    var a = S.account;
    var foot = $("acctBtn");
    foot.querySelector(".avatar").textContent = a.signedIn ? (a.avatar || "EV") : "G";
    foot.querySelector("b").textContent = a.name;
    foot.querySelector("i").textContent = a.signedIn ? (A.planName(a.plan) + " plan") : "Not signed in";
    var menu = $("acctMenu");
    menu.querySelector(".who b").textContent = a.name;
    menu.querySelector(".who span").textContent = a.signedIn ? a.email : "Sign in to keep your ledger";
    $("miPlans").querySelector("b").textContent = A.planName(a.plan).toUpperCase();
  }

  function renderMethod() {
    var m = method();
    $("methodChip").textContent = m.name;
    $("methodNote").textContent = "Perspectives, not certainty · " + m.name + " — " +
      m.cost.toLocaleString("en-US") + " units per inquiry";
    renderMethodMenu();
  }
  function renderMethodMenu() {
    var menu = $("methodMenu");
    if (!menu) return;
    menu.innerHTML = '<div class="mm-head lbl">Select analysis depth</div>';
    ORDER.forEach(function (id) {
      var m = METHODS[id];
      var ok = A.entitled(id);
      var active = id === S.method;
      var row = document.createElement("button");
      row.className = "mm-row" + (active ? " active" : "") + (ok ? "" : " locked");
      row.innerHTML =
        '<span class="mm-dot" aria-hidden="true"></span>' +
        '<span class="mm-main">' +
          '<span class="mm-name">' + m.name +
            (ok ? "" : '<em class="mm-lock">Pro</em>') + '</span>' +
          '<span class="mm-tag">' + m.tag + " · " + m.depth + "</span>" +
          '<span class="mm-blurb">' + m.blurb + "</span>" +
        "</span>" +
        '<span class="mm-cost" style="font-family:\'Fugaz One\',serif">' + m.cost.toLocaleString("en-US") + '<small>units</small></span>';
      row.addEventListener("click", function () {
        if (!ok) { closeMethod(); openPlans(); toast("Sortis 6 synthesis is unlocked on the Pro tier."); return; }
        S.method = id; save(); renderMethod(); closeMethod();
      });
      menu.appendChild(row);
    });
  }

  function renderList() {
    castList.innerHTML = '<div class="lbl">Recent inquiries</div>';
    S.convs.forEach(function (c) {
      var wrap = document.createElement("div");
      wrap.className = "casting-row" + (c.id === S.activeId ? " active" : "");
      var b = document.createElement("button");
      b.className = "casting" + (c.id === S.activeId ? " active" : "");
      b.textContent = c.title;
      b.addEventListener("click", function () { S.activeId = c.id; save(); renderAll(); });
      var del = document.createElement("button");
      del.className = "casting-del";
      del.innerHTML = "&times;";
      del.title = "Delete this casting";
      del.addEventListener("click", function (e) {
        e.stopPropagation();
        S.convs = S.convs.filter(function (x) { return x.id !== c.id; });
        if (S.activeId === c.id) S.activeId = S.convs.length ? S.convs[0].id : null;
        save(); A.deleteCastingRemote(c.id); renderAll();
        toast("Casting burned.");
      });
      wrap.appendChild(b);
      wrap.appendChild(del);
      castList.appendChild(wrap);
    });
  }

  /* element flavour + role gloss banks for the woven line-by-line analysis */
  var ELG = {
    Wood: "growing, pushing outward", Fire: "bright, quick to show itself",
    Earth: "steady, slow to move", Metal: "hard-edged and decisive",
    Water: "deep, finding the low road"
  };
  var ROLE = {
    Resource: "the part of the field that <em>feeds</em> you \u2014 backing, knowledge, what replenishes where you stand",
    Peer:     "an equal on your own footing \u2014 allies and rivals working the same ground you are",
    Output:   "what you put <em>out</em> \u2014 your effort and expression, what you spend yourself on",
    Wealth:   "what answers to you \u2014 resources and gains you can take in hand",
    Pressure: "what bears <em>down</em> on you \u2014 duty, authority, the price you\u2019re held to"
  };
  /* terse role tags for the scannable line list (the long ROLE gloss above is the legend voice) */
  var ROLE_SHORT = {
    Resource: "feeds your position",
    Peer:     "an equal beside you",
    Output:   "what you put out",
    Wealth:   "what answers to you",
    Pressure: "what bears down on you"
  };
  function elChip(d) {
    return '<span class="el" style="color:' + d.elColor + '"><i style="background:' + d.elColor + '"></i>' + d.el + '</span>';
  }
  function elMk(d) {
    if (d.marker === "Self")     return ' <span class="mk self">Self</span>';
    if (d.marker === "Response") return ' <span class="mk resp">Response</span>';
    return "";
  }
  /* the second figure — only drawn for Sortis, where lines are in motion */
  function transformSectionHTML(spec, f) {
    if (!spec.transformedLines) return "";
    var moves = (spec.changeIdx || []).slice();
    var parts = moves.map(function (li) {
      var pos = (f.lines[li] && f.lines[li].pos) || (li + 1) + "th";
      var was = spec.lines[li].yang ? "solid" : "broken";
      var now = spec.transformedLines[li].yang ? "solid" : "broken";
      return 'the <b>' + pos + ' line</b> turns ' + was + ' \u2192 ' + now;
    });
    var lead = parts.length > 1
      ? "Two lines are in motion \u2014 " + parts.join(", and ") + "."
      : (parts[0] ? parts[0].charAt(0).toUpperCase() + parts[0].slice(1) + "." : "");
    return '<div class="ix-transform">' +
      '<div class="ix-t-head"><span class="ix-t-k">It is turning into</span>' +
        '<span class="ix-t-arrow">\u2192</span><span class="ix-t-name">' + esc(spec.transformedName) + '</span></div>' +
      '<p>' + lead + ' As it moves, <b>' + esc(spec.name) + '</b> crosses into <b>' + esc(spec.transformedName) +
        '</b> \u2014 not where you stand now, but where this is heading.</p>' +
    '</div>';
  }

  /* a method-aware legend: Stria shows only the still markers; Sortis adds motion */
  function legendInline(sortis) {
    var items = [
      '<span><i class="d-self"></i>Self \u2014 where you stand</span>',
      '<span><i class="d-resp"></i>Response \u2014 the other side</span>'
    ];
    if (sortis) {
      items.push('<span><i class="d-move"></i>Moving line \u2014 what is turning</span>');
      items.push('<span><i class="d-gen"></i>feeds \u00b7 generating</span>');
      items.push('<span><i class="d-ctrl"></i>checks \u00b7 controlling</span>');
    }
    return '<div class="legend-inline">' + items.join("") + '</div>';
  }

  /* the figure read line by line. The difference between the two methods lives in
     the FIGURE itself: Stria draws it as it stands (still — no flow arrow, no
     moving pulse, one figure); Sortis adds the moving line, the sheng-ke current,
     and the second figure it crosses into. lineFigure already omits the arrow when
     nothing moves, so a Stria figure paints static on its own. */
  function insightProseHTML(spec, opts) {
    if (!spec || !window.BWFigure || !BWFigure.lineFigure) return "";
    var f = BWFigure.lineFigure(spec);
    if (!f) return "";
    var sortis = spec.method === "sortis";
    var svg = (opts && opts.settled) ? f.svg.replace('class="bw-zg-svg"', 'class="bw-zg-svg settled"') : f.svg;
    var cap = sortis
      ? "Coloured by element · the arrow shows how the turning line acts on you"
      : "Coloured by element · the figure as it stands";

    /* — the figure, read as a scannable list (top line first, matching the drawing) — */
    var html = '<div class="ix-sec" style="--sd:.06s">' +
      '<div class="fig-float">' + svg + '<div class="cap">' + cap + '</div></div>' +
      '<h4 class="ix-h">Reading the figure</h4>' +
      '<p class="ix-intro">Top to bottom — each line’s element and how it stands to ' +
        '<span class="mk self">Self</span>, where you stand' +
        (sortis ? ', with one line in motion.' : '. Nothing here is moving.') + '</p>' +
      '<ul class="ix-lines">';
    for (var i = 5; i >= 0; i--) {
      var d = f.lines[i];
      var chips = "";
      if (d.marker === "Self") chips += '<span class="mk self">Self</span>';
      else if (d.marker === "Response") chips += '<span class="mk resp">Response</span>';
      if (sortis && d.moving) chips += '<span class="mk move">Moving</span>';
      html += '<li class="ix-line' + (d.marker === "Self" ? " is-self" : "") + '">' +
        '<span class="ix-line-pos">' + d.pos.replace(/\s*\(.*\)/, "") + '</span>' +
        elChip(d) +
        '<span class="ix-line-meta"><b>' + d.role + '</b> · ' + (ROLE_SHORT[d.role] || "") + '</span>' +
        '<span class="ix-line-mk">' + chips + '</span>' +
      '</li>';
    }
    html += '</ul></div>';

    if (sortis) {
      html += '<div class="ix-sec" style="--sd:.2s">' +
        '<h4 class="ix-h">What’s turning</h4>' +
        '<p class="turning">' + f.note + '</p></div>';
      var tx = transformSectionHTML(spec, f);
      if (tx) html += '<div class="ix-sec" style="--sd:.3s">' +
        '<h4 class="ix-h">Where it’s heading</h4>' + tx + '</div>';
    }
    html += legendInline(sortis);
    return html;
  }

  /* the casting figure (the per-line reading hangs ON it, not in the prose) */
  function figureHTML(msg) {
    return (msg.spec && window.BWFigure && window.BWFigure.annotatedFigureHTML)
      ? '<div class="reading-fig' + (msg.board ? ' is-full' : '') + '">' +
          window.BWFigure.annotatedFigureHTML(msg.spec, { board: msg.board }) + '</div>'
      : "";
  }
  function gildText(t) {
    return esc(t).replace(/\|([^|]+)\|/g, '<span class="gild">$1</span>');
  }
  /* split the answer prose into a lede sentence + a follow-on paragraph */
  function splitParas(text) {
    text = String(text || "").trim();
    if (!text) return [];
    if (text.indexOf("\n") >= 0) return text.split(/\n+/).map(function (s) { return s.trim(); }).filter(Boolean);
    var sent = text.match(/[^.!?]+[.!?]+(?:["')\]]*)?|\S[^.!?]*$/g) || [text];
    sent = sent.map(function (s) { return s.trim(); }).filter(Boolean);
    if (sent.length <= 1) return sent;
    return [sent[0], sent.slice(1).join(" ")];
  }
  var V_LABEL = { favorable: "Favorable", unfavorable: "Unfavorable", mixed: "Mixed", unclear: "Unclear" };
  var V_TITLE = {
    favorable: "The figure supports it", unfavorable: "The figure resists it",
    mixed: "The figure is divided", unclear: "The figure stays unclear"
  };
  /* the verdict, structured like a written answer: eyebrow · title · lede ·
     supporting paragraph · what-decides-it · timing. Streams in word by word. */
  function verdictHTML(msg) {
    var r = msg.reading || null;

    if (!r || !r.reading) {
      var paras = splitParas(msg.text);
      var body = paras.length
        ? '<p class="rd-lede stream-target">' + gildText(paras[0]) + '</p>' +
          (paras[1] ? '<p class="rd-para stream-target">' + gildText(paras[1]) + '</p>' : "")
        : "";
      return '<div class="reading-body">' +
        '<div class="rd-head"><h3 class="rd-title">The reading</h3></div>' + body + '</div>';
    }

    var badge = '<span class="rd-badge ' + r.verdict + '">' + (V_LABEL[r.verdict] || "Reading") + '</span>';
    var title = V_TITLE[r.verdict] || "The reading";
    var paras2 = splitParas(r.reading);
    var bodyP = (paras2[0] ? '<p class="rd-lede stream-target">' + gildText(paras2[0]) + '</p>' : "") +
                (paras2[1] ? '<p class="rd-para stream-target">' + gildText(paras2[1]) + '</p>' : "");
    var keys = (r.keyLines || []).map(function (k) {
      return '<li><span class="rd-kl-n">Line ' + k.line + '</span><span class="rd-kl-note">' + esc(k.note || "") + '</span></li>';
    }).join("");
    var keysSec = keys ? '<div class="rd-sec"><h4 class="rd-h">What decides it</h4><ul class="rd-keys">' + keys + '</ul></div>' : "";
    var timeSec = r.timing ? '<div class="rd-sec"><h4 class="rd-h">Timing</h4><p class="rd-timing">' + esc(r.timing) + '</p></div>' : "";
    return '<div class="reading-body">' +
      '<div class="rd-head"><h3 class="rd-title">' + esc(title) + '</h3>' + badge + '</div>' +
      bodyP + keysSec + timeSec + '</div>';
  }
  /* static, fully-painted reading (used on reload / conversation switch) */
  function readingHTML(msg) {
    return figureHTML(msg) + verdictHTML(msg);
  }

  function renderThread() {
    var c = activeConv();
    $("convTitle").textContent = c ? c.title : "New inquiry";
    threadInner.innerHTML = "";
    if (!c || !c.msgs.length) {
      document.body.classList.add("is-empty");
      if (heroEmpty) { threadInner.appendChild(heroEmpty); return; }
      threadInner.innerHTML =
        '<div class="empty">' +
          '<div class="eyebrow"><b>\u25C6</b>&nbsp; The oracle is listening</div>' +
          "<h2>What weighs<br>on you?</h2>" +
          '<svg class="flourish" width="186" height="14" viewBox="0 0 186 14" aria-hidden="true">' +
            '<path d="M4 10 C32 2 60 2 84 8 C110 14 146 12 182 4" stroke="#2A2016" stroke-width="1.5" fill="none" stroke-linecap="round"></path>' +
            '<path d="M10 13 C52 8 106 12 176 7" stroke="#2A2016" stroke-width="1" fill="none" stroke-linecap="round"></path>' +
          "</svg>" +
          "<p>Ask plainly. The oracle answers once, and honestly.</p>" +
        "</div>";
      return;
    }
    document.body.classList.remove("is-empty");
    c.msgs.forEach(function (m, i) {
      if (m.role === "user") {
        var u = document.createElement("div");
        u.className = "msg-user";
        u.textContent = m.text;
        threadInner.appendChild(u);
      } else {
        var a = document.createElement("article");
        a.className = "reading";
        a.innerHTML = readingHTML(m, c.id, i);
        threadInner.appendChild(a);
        if (window.BWLiuYaoChart) window.BWLiuYaoChart.wire(a);
      }
    });
    var t = $("thread");
    t.scrollTop = t.scrollHeight;
  }

  function renderAll() { renderUnits(); renderAccount(); renderMethod(); renderList(); renderThread(); }

  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("on");
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { toastEl.classList.remove("on"); }, 2600);
  }

  /* ── oracle text ── */
  function fallbackReading() {
    return Promise.resolve(CANNED[Math.floor(Math.random() * CANNED.length)].text);
  }
  function askOracle(question, m) {
    var guard = new Promise(function (res) { setTimeout(function () { res(null); }, 14000); });
    var run;
    if (window.claude && typeof window.claude.complete === "function") {
      var deep = m.id === "sortis"
        ? " This is a Sortis 6 deep casting: the figure has moving lines crossing into a second figure, so weigh how the situation is changing, not just where it stands."
        : "";
      var prompt = "You are BourneWise, a blunt I-Ching-style oracle. Question: \"" + question +
        "\". Reply with ONE honest judgment, 1-3 sentences, plain modern language, no hedging, no mysticism dump." +
        deep + " Wrap exactly ONE key word or short phrase in pipes like |this| for emphasis. Reply with the judgment only.";
      run = window.claude.complete({
        product: m.id === "sortis" ? "sortis" : "stria",
        messages: [{ role: "user", content: prompt }]
      }).then(function (r) {
        var s = String(r || "").trim(); return s || null;
      }).catch(function () { return null; });
    } else {
      run = fallbackReading();
    }
    /* never hang: first to settle wins, and a null result becomes a canned reading */
    return Promise.race([run, guard]).then(function (r) {
      return (r && String(r).trim()) ? r : fallbackReading();
    });
  }

  /* Sortis 6 → full professional casting board + AI reading (the deep-tier experience).
     Stria stays the light per-line reading; the gap between the two IS the rigor.

     When BWPromptRouter is loaded, both Sortis and Stria use the modular prompt
     pipeline: Gate → Route → Focused Prompt → QC Pass. This sends only the
     relevant rule subset (~2000-3000 tokens) instead of the full 15k+ monolith,
     improving rule adherence without increasing token cost. */
  function routedReading(question, spec, board, methodId) {
    if (!window.BWPromptRouter) return null; // fallback to legacy
    var product = methodId === "stria" ? "stria" : "sortis";
    var guard = new Promise(function (res) { setTimeout(function () { res(null); }, 20000); });
    var run = BWPromptRouter.interpret({
      question: question,
      product: product,
      board: board,
      method: methodId,
      category: "general",
      lang: "en"
    });
    return Promise.race([run, guard]).then(function (result) {
      if (!result || !result.reading) return null;
      return {
        text: result.reading,
        board: board,
        reading: null, // routed readings return prose directly
        _route: result.route,
        _qc: result.qcResult
      };
    }).catch(function () { return null; });
  }

  function sortisReading(question, spec, board) {
    if (!board) board = (window.BWLiuYao && spec && spec.lines && spec.lines.length === 6)
      ? window.BWLiuYao.computeBoard({
          lines: spec.lines, changeIdx: spec.changeIdx || [],
          method: "sortis", name: spec.name, transformedName: spec.transformedName
        })
      : null;

    // Try routed pipeline first (modular prompts + QC)
    var routed = routedReading(question, spec, board, "sortis");
    if (routed) {
      return routed.then(function (result) {
        if (result) return result;
        return sortisLegacy(question, spec, board);
      });
    }
    return sortisLegacy(question, spec, board);
  }

  function sortisLegacy(question, spec, board) {
    if (!board || !window.BWLiuYaoAI) {
      return askOracle(question, METHODS.sortis).then(function (t) { return { text: t, board: board, reading: null }; });
    }
    function pack(reading) { return { text: (reading && reading.reading) || "", board: board, reading: reading }; }
    var guard = new Promise(function (res) { setTimeout(function () { res(null); }, 12000); });
    var run;
    try {
      run = BWLiuYaoAI.interpret({ board: board, question: question, category: "general", lang: "en" });
    } catch (e) { run = Promise.resolve(null); }
    return Promise.race([run, guard]).then(function (reading) {
      if (reading) return pack(reading);
      return BWLiuYaoAI.interpret({ board: board, question: question, category: "general", lang: "en", mock: true }).then(pack);
    }).catch(function () {
      try { return BWLiuYaoAI.interpret({ board: board, question: question, category: "general", lang: "en", mock: true }).then(pack); }
      catch (e) { return pack(null); }
    });
  }

  /* ── send flow ── */
  function send(text) {
    text = (text || "").trim();
    if (!text || busy) return;
    var m = method();
    if (!A.entitled(m.id)) { S.method = "stria"; save(); m = method(); }
    if (S.units < m.cost) { openPlans(); toast("Your unit balance is depleted — " + m.cost.toLocaleString("en-US") + " units required."); return; }

    if (!activeConv()) {
      var conv = { id: Date.now().toString(36), title: text.length > 42 ? text.slice(0, 42) + "…" : text, msgs: [] };
      S.convs.unshift(conv);
      S.activeId = conv.id;
    }
    var c = activeConv();
    c.msgs.push({ role: "user", text: text });
    save();                                 // persist the question first
    A.deductUnits(m.cost, "cast:" + m.id);  // spend on the store (+ server mirror)
    S.units = A.state().units;              // reconcile local balance only
    renderAll();
    if (S.units < m.cost && S.account.plan === "free") {
      toast("Low balance — upgrade to keep casting.");
    }

    busy = true;
    $("sendBtn").disabled = true;

    /* the casting animation — for Sortis it draws the full 排盘 line by line */
    var spec = window.BWFigure ? window.BWFigure.random(m.id)
      : { method: m.id, name: FIGURES[0], lines: [], transformedLines: null };
    var sortisBoard = (m.id === "sortis" && window.BWLiuYao && spec.lines && spec.lines.length === 6)
      ? (function () { try {
          return window.BWLiuYao.computeBoard({ lines: spec.lines, changeIdx: spec.changeIdx || [],
            method: "sortis", name: spec.name, transformedName: spec.transformedName });
        } catch (e) { return null; } })()
      : null;
    var live = document.createElement("article");
    live.className = "reading casting-live";
    live.setAttribute("aria-live", "polite");
    var castBox = document.createElement("div");
    castBox.className = "reading-fig" + (sortisBoard ? " is-full" : "");
    live.appendChild(castBox);
    threadInner.appendChild(live);

    /* Claude-style: lift the question to the top of the thread and reveal the full
       casting animation below it. A spacer guarantees there's room to scroll. */
    var thread = $("thread");
    var spacer = document.createElement("div");
    spacer.className = "cast-spacer";
    spacer.setAttribute("aria-hidden", "true");
    spacer.style.flex = "none";
    threadInner.appendChild(spacer);
    requestAnimationFrame(function () {
      var users = threadInner.querySelectorAll(".msg-user");
      var lastUser = users[users.length - 1];
      spacer.style.height = thread.clientHeight + "px";
      if (lastUser) {
        var tr = thread.getBoundingClientRect(), ur = lastUser.getBoundingClientRect();
        thread.scrollTo({ top: thread.scrollTop + (ur.top - tr.top) - 24, behavior: "smooth" });
      }
    });

    /* the casting animation IS the annotated figure, drawn in place — so the board
       never jumps position when the reading settles. Sortis gets the full board. */
    var castDone = window.BWFigure
      ? window.BWFigure.cast(castBox, spec, { board: sortisBoard })
      : new Promise(function (r) { setTimeout(r, 1600); });

    var answerP;
    if (m.id === "sortis") {
      answerP = sortisReading(text, spec, sortisBoard);
    } else {
      // Stria: try routed pipeline first, fallback to simple oracle
      var striaRouted = routedReading(text, spec, null, "stria");
      if (striaRouted) {
        answerP = striaRouted.then(function (result) {
          if (result) return result;
          return askOracle(text, m).then(function (t) { return { text: t, board: null, reading: null }; });
        });
      } else {
        answerP = askOracle(text, m).then(function (t) { return { text: t, board: null, reading: null }; });
      }
    }

    function finish(ans) {
      ans = ans || { text: "", board: null, reading: null };
      var oracleMsg = {
        role: "oracle", text: ans.text, method: m.name, methodId: m.id,
        figure: spec.name, spec: spec, board: ans.board || null, reading: ans.reading || null,
        ts: Date.now(), cost: m.cost
      };
      c.msgs.push(oracleMsg);
      c.method = m.id;
      save();
      A.syncCasting(c);   // persist this casting to the server (if signed in)
      /* update only the chrome (balance + history) — leave the thread alone so the
         casting figure isn't wiped; the verdict then streams in naturally below it */
      if (spacer && spacer.parentNode) spacer.parentNode.removeChild(spacer);
      renderUnits(); renderList();
      revealReading(live, oracleMsg, c.id, c.msgs.length - 1).then(release, release);
    }
    function release() {
      busy = false;
      var sb = $("sendBtn"); if (sb) sb.disabled = false;
      var ci = $("composerInput"); if (ci) ci.focus();
    }

    Promise.all([answerP, castDone]).then(function (r) { finish(r[0]); }, function () {
      /* nothing may reject (answerP self-heals to mock, castDone is timeout-bounded),
         but never leave the composer locked if it somehow does */
      finish(null);
    });
  }

  /* ── reveal an answer naturally: crossfade the cast into the reading, then
     stream the verdict word-by-word and fade the line-by-line analysis in ── */
  function revealReading(node, msg, convId, idx) {
    var reduced = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    function keepTop() {
      var thread = $("thread");
      var users = thread.querySelectorAll(".msg-user");
      var lastUser = users[users.length - 1];
      if (lastUser) {
        var tr = thread.getBoundingClientRect(), ur = lastUser.getBoundingClientRect();
        thread.scrollTo({ top: thread.scrollTop + (ur.top - tr.top) - 24, behavior: "smooth" });
      }
    }
    return new Promise(function (resolve) {
      /* the casting animation already drew the annotated figure IN PLACE (cast());
         leave it exactly where it is and append the structured verdict below it. */
      node.classList.remove("casting-live");
      var frag = document.createElement("div");
      frag.innerHTML = verdictHTML(msg);
      while (frag.firstChild) node.appendChild(frag.firstChild);
      var bodyEl = node.querySelector(".reading-body");
      /* bring the verdict into view so its word-stream is actually seen (the figure
         keeps looping above it; the user can scroll back up to watch the board) */
      var thread = $("thread");
      if (bodyEl && thread) {
        var br = bodyEl.getBoundingClientRect(), tr = thread.getBoundingClientRect();
        thread.scrollTo({ top: thread.scrollTop + (br.top - tr.top) - 96, behavior: "smooth" });
      }
      if (reduced || !bodyEl) { resolve(); return; }
      streamReading(bodyEl, function () {
        bodyEl.classList.add("bw-streamed");
        resolve();
      });
    });
  }

  /* stream the verdict like a written answer: each word does a smooth blur-reveal,
     in reading order across the lede + paragraphs, then the supporting sections rise in */
  function wrapWords(p, out) {
    var texts = [], stack = [p], n, c, i;
    while (stack.length) {
      n = stack.pop();
      for (i = 0; i < n.childNodes.length; i++) {
        c = n.childNodes[i];
        if (c.nodeType === 3) { if (c.textContent.trim()) texts.push(c); }
        else if (c.nodeType === 1) stack.push(c);
      }
    }
    texts.forEach(function (tn) {
      var parts = tn.textContent.split(/(\s+)/), frag = document.createDocumentFragment();
      parts.forEach(function (w) {
        if (!w) return;
        if (/^\s+$/.test(w)) { frag.appendChild(document.createTextNode(w)); return; }
        var s = document.createElement("span"); s.className = "bw-rw rw-s" + (out.length % 5); s.textContent = w;
        out.push(s); frag.appendChild(s);
      });
      tn.parentNode.replaceChild(frag, tn);
    });
  }
  function streamReading(bodyEl, done) {
    var words = [];
    [].slice.call(bodyEl.querySelectorAll(".stream-target")).forEach(function (p) { wrapWords(p, words); });
    var secs = [].slice.call(bodyEl.querySelectorAll(".rd-sec"));
    secs.forEach(function (s) { s.classList.add("rd-pending"); });
    function revealSecs() {
      secs.forEach(function (s, si) { setTimeout(function () { s.classList.add("rd-in"); }, si * 170); });
      setTimeout(function () { done && done(); }, secs.length * 170 + 220);
    }
    if (!words.length) { revealSecs(); return; }
    var k = 0;
    (function tick() {
      if (k >= words.length) { revealSecs(); return; }
      /* one word at a time, slowly, so the five reveal styles visibly take turns */
      words[k].classList.add("on"); k++;
      setTimeout(tick, 105);
    })();
  }

  $("composerForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var inp = $("composerInput");
    /* on the landing, an example is cycling in the placeholder → empty submit sends it */
    var ex = document.body.classList.contains("is-empty") ? (inp.dataset.example || "") : "";
    send(inp.value.trim() || ex);
    inp.value = "";
  });

  /* ── method picker popover ── */
  var methodMenu = $("methodMenu"), methodChip = $("methodChip");
  function openMethod() { methodMenu.classList.add("open"); methodChip.setAttribute("aria-expanded", "true"); }
  function closeMethod() { methodMenu.classList.remove("open"); methodChip.setAttribute("aria-expanded", "false"); }
  methodChip.addEventListener("click", function (e) {
    e.stopPropagation();
    if (methodMenu.classList.contains("open")) closeMethod(); else openMethod();
  });
  document.addEventListener("click", function (e) {
    if (!methodMenu.contains(e.target) && e.target !== methodChip) closeMethod();
  });

  $("newCast").addEventListener("click", function () {
    busy = false;
    $("sendBtn").disabled = false;
    S.activeId = null;
    save(); renderAll();
    $("composerInput").focus();
  });

  /* ── sidebar rail ── */
  if (localStorage.getItem(RAIL) === "1") document.body.classList.add("rail");
  $("sideToggle").addEventListener("click", function () {
    var r = document.body.classList.toggle("rail");
    try { localStorage.setItem(RAIL, r ? "1" : "0"); } catch (e) {}
  });

  /* ── account menu ── */
  var acctMenu = $("acctMenu"), acctBtn = $("acctBtn");
  function closeMenu() { acctMenu.classList.remove("open"); acctBtn.setAttribute("aria-expanded", "false"); }
  acctBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    var open = acctMenu.classList.toggle("open");
    acctBtn.setAttribute("aria-expanded", open ? "true" : "false");
  });
  document.addEventListener("click", function (e) { if (!acctMenu.contains(e.target)) closeMenu(); });
  $("miPlans").addEventListener("click", function () { closeMenu(); openPlans(); });
  $("miSettings").addEventListener("click", function () { location.href = "./settings.html"; });
  $("miSignout").addEventListener("click", function () {
    closeMenu();
    A.signOut();
    S = A.state();
    renderAll();
    toast("Signed out — your history and balance remain secure.");
  });

  /* ── plans modal ── */
  var overlay = $("plansOverlay");
  function openPlans() { overlay.classList.add("open"); }
  function closePlans() { overlay.classList.remove("open"); }
  $("openPlans").addEventListener("click", openPlans);
  $("closePlans").addEventListener("click", closePlans);
  overlay.addEventListener("click", function (e) { if (e.target === overlay) closePlans(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") { closePlans(); closeMenu(); closeMethod(); } });
  overlay.querySelectorAll(".plan button").forEach(function (b) {
    b.addEventListener("click", function () {
      var plan = b.getAttribute("data-plan");
      var add = parseInt(b.getAttribute("data-units"), 10) || 0;
      function apply() {
        if (plan) { A.setPlan(plan); }   // setPlan applies the plan's grant
        else if (add) { A.addUnits(add, "topup"); }
        S = A.state(); renderAll(); closePlans();
        toast(plan ? (A.planName(plan) + " is active.") : ("+" + add.toLocaleString("en-US") + " units added."));
      }
      if (plan && !S.account.signedIn) {
        A.signInRemote("elias@iname.com", "Elias Vance", "email", function () { S = A.state(); apply(); });
      } else {
        apply();
      }
    });
  });

  /* ── boot: hydrate from the server (if signed in), then paint ── */
  renderAll();                       // instant paint from local store
  A.hydrate(function () { S = A.state(); renderAll(); });
  window.addEventListener("bw:account-synced", function () {
    S.units = A.state().units; renderUnits();
  });

  /* ── entry: ?q= from landing, #plans deep link ── */
  var params = new URLSearchParams(location.search);
  var q = (params.get("q") || "").trim();
  if (q) { history.replaceState(null, "", location.pathname); send(q); }
  if (location.hash === "#plans") openPlans();
})();
