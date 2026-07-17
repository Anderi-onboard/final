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
    foot.querySelector("i").textContent = a.signedIn ? (A.planName(a.plan) + " plan") : "Sign in to begin";
    var menu = $("acctMenu");
    menu.querySelector(".who b").textContent = a.name;
    menu.querySelector(".who span").textContent = a.signedIn ? a.email : "Sign in to keep your ledger";
    $("miPlans").querySelector("b").textContent = A.planName(a.plan).toUpperCase();
    // the sign-in coach-mark only nudges signed-out guests, and stays gone once
    // dismissed
    var coach = $("signinCoach");
    if (coach) {
      var dismissed = false;
      try { dismissed = localStorage.getItem("bw:coachDismissed") === "1"; } catch (e) {}
      coach.hidden = a.signedIn || dismissed;
    }
  }

  function renderMethod() {
    var m = method();
    $("methodChip").textContent = m.name;
    $("methodNote").textContent = "Perspectives, not certainty · " + m.name + " — " +
      m.cost.toLocaleString("en-US") + " units per casting · follow-ups metered, at most half";
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
        '<span class="mm-cost" style="font-family:\'BioRhyme\',serif">' + m.cost.toLocaleString("en-US") + '<small>units</small></span>';
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
      b.title = c.title;
      b.addEventListener("click", function () { S.activeId = c.id; save(); renderAll(); });
      var del = document.createElement("button");
      del.className = "casting-del";
      del.innerHTML = "&times;";
      del.title = "Delete this inquiry";
      del.addEventListener("click", function (e) {
        e.stopPropagation();
        S.convs = S.convs.filter(function (x) { return x.id !== c.id; });
        if (S.activeId === c.id) S.activeId = S.convs.length ? S.convs[0].id : null;
        save(); A.deleteCastingRemote(c.id); renderAll();
        toast("Inquiry burned.");
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
    var n = 0;
    return esc(t).replace(/\|([^|]+)\|/g, function (_, term) {
      n++;
      return '<span class="gild' + (n % 2 === 0 ? ' alt' : '') + '">' + term + '</span>';
    });
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

  /* Render the reading's markdown into clean HTML — the WHOLE reading, not just
     the first two lines. The model writes # headings, ** bold **, --- rules and
     - lists; the old renderer dumped only paras[0]+paras[1] as raw text, so a
     full reading collapsed to two lines of literal "#"/"**" (the bug the user
     saw). Inline: **bold**, *italic*, and |gilded| key terms. */
  function mdInline(s) {
    var h = esc(s);
    h = h.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    h = h.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>");
    var n = 0;
    h = h.replace(/\|([^|]+)\|/g, function (_, t) { n++; return '<span class="gild' + (n % 2 === 0 ? " alt" : "") + '">' + t + "</span>"; });
    return h;
  }
  function mdReading(text) {
    var lines = String(text || "").replace(/\r/g, "").split("\n");
    // drop a leading heading that only echoes the question ("# 你问：…", "# You asked…")
    while (lines.length && !lines[0].trim()) lines.shift();
    if (lines.length && /^#{1,6}\s*(你问|问[:：]|You asked|Your question|Q[:：])/i.test(lines[0].trim())) lines.shift();
    var out = "", para = [], inList = false;
    function flushP() { if (para.length) { out += '<p class="rd-para">' + mdInline(para.join(" ")) + "</p>"; para = []; } }
    function closeL() { if (inList) { out += "</ul>"; inList = false; } }
    for (var i = 0; i < lines.length; i++) {
      var t = lines[i].trim();
      if (!t) { flushP(); closeL(); continue; }
      if (/^(---+|\*\*\*+|___+)$/.test(t)) { flushP(); closeL(); out += '<hr class="rd-hr">'; continue; }
      var hm = t.match(/^(#{1,6})\s+(.*)$/);
      if (hm) {
        flushP(); closeL();
        var lvl = hm[1].length;
        var cls = lvl <= 1 ? "rd-title" : (lvl === 2 ? "rd-h2" : "rd-h3");
        out += '<div class="' + cls + '">' + mdInline(hm[2]) + "</div>";
        continue;
      }
      var lm = t.match(/^[-*+]\s+(.*)$/) || t.match(/^\d+[.)]\s+(.*)$/);
      if (lm) { flushP(); if (!inList) { out += '<ul class="rd-list">'; inList = true; } out += "<li>" + mdInline(lm[1]) + "</li>"; continue; }
      para.push(t);
    }
    flushP(); closeL();
    return out;
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

    // Routed/prose readings (the real path) — render the FULL markdown reading.
    if (!r || !r.reading) {
      var prose = mdReading(msg.text);
      return '<div class="reading-body">' + (prose || '<p class="rd-para"></p>') + '</div>';
    }

    // Structured (legacy interpret) — full prose + key-line and timing sections.
    var badge = '<span class="rd-badge ' + r.verdict + '">' + (V_LABEL[r.verdict] || "Reading") + '</span>';
    var title = V_TITLE[r.verdict] || "The reading";
    var keys = (r.keyLines || []).map(function (k) {
      return '<li><span class="rd-kl-n">Line ' + k.line + '</span><span class="rd-kl-note">' + esc(k.note || "") + '</span></li>';
    }).join("");
    var keysSec = keys ? '<div class="rd-sec"><h4 class="rd-h">What decides it</h4><ul class="rd-keys">' + keys + '</ul></div>' : "";
    var timeSec = r.timing ? '<div class="rd-sec"><h4 class="rd-h">Timing</h4><p class="rd-timing">' + esc(r.timing) + '</p></div>' : "";
    return '<div class="reading-body">' +
      '<div class="rd-head"><h3 class="rd-title">' + esc(title) + '</h3>' + badge + '</div>' +
      mdReading(r.reading) + keysSec + timeSec + '</div>';
  }
  /* static, fully-painted reading (used on reload / conversation switch) */
  function readingHTML(msg) {
    return figureHTML(msg) + verdictHTML(msg);
  }

  function renderThread() {
    var c = activeConv();
    var titleText = c ? c.title : "New inquiry";
    $("convTitle").textContent = titleText;
    $("convTitle").title = titleText;
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
        // optical centering for reloaded boards (same as during a live cast)
        if (window.BWFigure && window.BWFigure.opticalCenter) {
          (function (art) {
            requestAnimationFrame(function () { window.BWFigure.opticalCenter(art.querySelector(".reading-fig")); });
          })(a);
        }
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

  /* ── oracle text ──
     Minimal real reading used only when the routed pipeline module isn't
     loaded. The old canned-quote fallback is gone: a paid cast must produce a
     real reading or fail loudly (send() refunds + explains). Returns null on
     failure so the caller can surface it. */
  function askOracle(question, m) {
    if (!(window.claude && typeof window.claude.complete === "function")) {
      return Promise.resolve(null);
    }
    var guard = new Promise(function (res) { setTimeout(function () { res(null); }, 30000); });
    var zh = /[一-鿿]/.test(question);
    var deep = m.id === "sortis"
      ? " This is a Sortis 6 deep casting: the figure has moving lines crossing into a second figure, so weigh how the situation is changing, not just where it stands."
      : "";
    var prompt = "You are BourneWise, a blunt I-Ching-style oracle. Question: \"" + question +
      "\". Reply with ONE honest judgment, 1-3 sentences, plain modern language, no hedging, no mysticism dump." +
      deep + " Wrap exactly ONE key word or short phrase in pipes like |this| for emphasis." +
      (zh ? " Reply in Chinese." : "") + " Reply with the judgment only.";
    var run = window.claude.complete({
      product: m.id === "sortis" ? "sortis" : "stria",
      messages: [{ role: "user", content: prompt }]
    }).then(function (r) {
      var s = String(r || "").trim(); return s || null;
    }).catch(function () { return null; });
    return Promise.race([run, guard]);
  }

  /* Prior turns as { role, content } pairs, oldest first, so a follow-up
     ("what did line 2 mean?") actually has something to refer back to —
     previously EVERY send() sent only the current question with zero
     context, so the model had no way to answer a follow-up about its own
     last reading. Capped to the last few exchanges to bound token growth;
     the model is never asked to recast (§MOVE in meta_rules already covers
     that), it just now gets to see what was said. */
  function buildHistory(conv, maxTurns) {
    if (!conv || !conv.msgs || conv.msgs.length < 2) return [];
    var prior = conv.msgs.slice(0, -1); // exclude the question just pushed for this send
    var out = [];
    for (var i = 0; i < prior.length; i++) {
      var m = prior[i];
      if (m.role === "user") out.push({ role: "user", content: m.text });
      else if (m.role === "oracle") out.push({ role: "assistant", content: String(m.text || "").slice(0, 2000) });
    }
    var maxMsgs = (maxTurns || 3) * 2;
    return out.length > maxMsgs ? out.slice(out.length - maxMsgs) : out;
  }

  /* Sortis 6 → full professional casting board + AI reading (the deep-tier experience).
     Stria stays the light per-line reading; the gap between the two IS the rigor.

     When BWPromptRouter is loaded, both Sortis and Stria use the modular prompt
     pipeline: Gate → Route → Focused Prompt → QC Pass. This sends only the
     relevant rule subset (~2000-3000 tokens) instead of the full 15k+ monolith,
     improving rule adherence without increasing token cost. */
  function routedReading(question, spec, board, methodId, history, onDelta, mode) {
    if (!window.BWPromptRouter) return null; // router module missing → caller's own fallback
    var product = methodId === "stria" ? "stria" : "sortis";
    // STALL watchdog, not a flat deadline. The pipeline (route → stream → QC)
    // legitimately runs well past 45s for a deep Opus reading, so we DON'T cap
    // total time — the old flat 45s killed real casts that were still streaming
    // ("解读超时" on a paid reading). Instead fail only if it goes silent: no
    // first token, or the stream stops advancing, for STALL ms. Every streamed
    // token resets the clock, so a slow-but-alive reading survives.
    var STALL = 60000, timer = null, fireTimeout = null;
    var guard = new Promise(function (res) {
      fireTimeout = function () { res({ __timeout: true }); };
      timer = setTimeout(fireTimeout, STALL);
    });
    function bump() { if (timer) clearTimeout(timer); timer = setTimeout(fireTimeout, STALL); }
    var wrappedDelta = function (t, full) { bump(); if (onDelta) onDelta(t, full); };
    var run = BWPromptRouter.interpret({
      question: question,
      product: product,
      board: board,
      method: methodId,
      category: "general",
      // no lang override — BWPromptRouter detects it from the question text
      history: history || [],
      onDelta: wrappedDelta,
      mode: mode || null // "followup" → metered billing, no recast
    });
    // Errors propagate (with their HTTP status) instead of collapsing to null —
    // downstream used to "heal" that with canned/mock prose, so the user paid
    // units and got a placeholder. send()'s failure handler refunds + explains.
    return Promise.race([run, guard]).then(function (result) {
      if (timer) clearTimeout(timer);
      if (result && result.__timeout) return result;
      if (!result || !result.reading) return { __error: { message: "empty reading from pipeline" } };
      return {
        text: result.reading,
        board: board,
        reading: null, // routed readings return prose directly
        _route: result.route,
        _qc: result.qcResult
      };
    }).catch(function (err) { if (timer) clearTimeout(timer); return { __error: err || { message: "pipeline failed" } }; });
  }

  function sortisReading(question, spec, board, history, onDelta) {
    if (!board) board = (window.BWLiuYao && spec && spec.lines && spec.lines.length === 6)
      ? window.BWLiuYao.computeBoard({
          lines: spec.lines, changeIdx: spec.changeIdx || [],
          method: "sortis", name: spec.name, transformedName: spec.transformedName
        })
      : null;

    // Routed pipeline (modular prompts + QC) is the real path; legacy only
    // covers the freak case where prompt-router.js failed to load. Errors flow
    // through to send()'s failure handler — no mock rescue.
    var routed = routedReading(question, spec, board, "sortis", history, onDelta);
    if (routed) return routed;
    return sortisLegacy(question, spec, board);
  }

  function sortisLegacy(question, spec, board) {
    // No mock fallback: mock output is placeholder prose, and showing it for a
    // paid cast (while units drained) is worse than an honest failure.
    if (!board || !window.BWLiuYaoAI) {
      return Promise.resolve({ __error: { message: "casting engine unavailable" } });
    }
    var lang = /[一-鿿]/.test(question) ? "zh" : "en";
    function pack(reading) { return { text: (reading && reading.reading) || "", board: board, reading: reading }; }
    var guard = new Promise(function (res) { setTimeout(function () { res({ __timeout: true }); }, 90000); });
    var run;
    try {
      run = BWLiuYaoAI.interpret({ board: board, question: question, category: "general", lang: lang });
    } catch (e) { run = Promise.resolve(null); }
    return Promise.race([run, guard]).then(function (reading) {
      if (reading && reading.__timeout) return reading;
      if (reading) return pack(reading);
      return { __error: { message: "reading call failed" } };
    }).catch(function (err) { return { __error: err || { message: "reading call failed" } }; });
  }

  /* ── send flow ── */
  function send(text) {
    text = (text || "").trim();
    if (!text || busy) return;
    var m = method();
    // Sign-in required: units only exist on a real account, so a signed-out
    // guest can't cast — send them to the login page. This is the "先登录才发
    // 点数" rule: no free units before an account exists.
    if (!S.account.signedIn) {
      var zhq = /[一-鿿]/.test(text);
      toast(zhq ? "请先登录或注册——注册即送 500 点。" : "Sign in or create an account to cast — new accounts get 500 units.");
      setTimeout(function () { location.href = "./login.html"; }, 1300);
      return;
    }
    // No silent downgrade: if the plan can't use this method, say so and open
    // the plans view. The old code swapped Sortis→Stria without telling the
    // user, so they paid for a shallower reading (Sonnet, no board) than they
    // asked for — which is exactly why Opus never showed up for a "Sortis" cast.
    if (!A.entitled(m.id)) { openPlans(); toast(m.name + " requires the Pro or Premium plan."); return; }

    /* Follow-up detection: this conversation already holds a casting by the
       same method → the new question rides ON that casting (metered billing,
       at most half a cast, NO new hexagram) instead of recasting. So "what
       did line 2 mean?" keeps its board and its context; a fresh hexagram
       needs a fresh "New inquiry". */
    var lastCast = null, convNow = activeConv();
    if (convNow && window.BWPromptRouter) {
      for (var li = convNow.msgs.length - 1; li >= 0; li--) {
        var lmsg = convNow.msgs[li];
        if (lmsg.role === "oracle" && lmsg.spec) { lastCast = lmsg; break; }
      }
    }
    var isFollowup = !!(lastCast && lastCast.methodId === m.id);
    var needed = isFollowup ? A.followCost(m.id) : m.cost;
    if (S.units < needed) { openPlans(); toast("Your unit balance is depleted — " + needed.toLocaleString("en-US") + " units required."); return; }

    if (!activeConv()) {
      var conv = { id: Date.now().toString(36), title: text, msgs: [] };
      S.convs.unshift(conv);
      S.activeId = conv.id;
    }
    var c = activeConv();
    c.msgs.push({ role: "user", text: text });
    save();                                 // persist the question first
    /* optimistic local deduction — the server's atomic reserve/settle is the
       authority; bw_meta reconciles the real balance back afterwards. A
       follow-up reserves followCost and typically settles LOWER. */
    A.deductUnits(needed, (isFollowup ? "follow:" : "cast:") + m.id);
    S.units = A.state().units;              // reconcile local balance only
    renderAll();
    if (S.units < m.cost && S.account.plan === "free") {
      toast("Low balance — upgrade to keep casting.");
    }

    if (isFollowup) { followupFlow(c, text, m, lastCast, needed); return; }

    busy = true;
    $("sendBtn").disabled = true;

    /* the casting animation — for Sortis it draws the full 排盘 line by line */
    var spec = window.BWFigure ? window.BWFigure.random(m.id)
      : { method: m.id, name: FIGURES[0], lines: [], transformedLines: null };
    // Compute the casting board for BOTH tiers so the reading is always grounded
    // in the hexagram actually cast. Stria is the "primary hexagram framework",
    // so it needs a board too — without one the routed prompt (which tells the
    // model all hexagram data comes from the backend) got nothing and the model
    // answered "I didn't receive your casting data".
    var castBoard = (window.BWLiuYao && spec.lines && spec.lines.length === 6)
      ? (function () { try {
          return window.BWLiuYao.computeBoard({ lines: spec.lines, changeIdx: spec.changeIdx || [],
            method: m.id, name: spec.name, transformedName: spec.transformedName });
        } catch (e) { return null; } })()
      : null;
    // The full annotated board VISUAL stays a Sortis-only treatment.
    var sortisBoard = m.id === "sortis" ? castBoard : null;
    var live = document.createElement("article");
    live.className = "reading casting-live";
    live.setAttribute("aria-live", "polite");
    var castBox = document.createElement("div");
    castBox.className = "reading-fig" + (sortisBoard ? " is-full" : "");
    live.appendChild(castBox);
    /* real network text as it streams in, shown while the cast animation is
       still drawing — this is what actually cuts perceived latency (first
       real tokens in ~1-2s instead of waiting out the whole pipeline in
       silence). Swapped out for the fully-structured verdictHTML() once the
       complete reading is in; see finish() below. */
    var streamPreview = document.createElement("div");
    streamPreview.className = "reading-body reading-streaming";
    live.appendChild(streamPreview);
    threadInner.appendChild(live);
    // Render the reading's real structure + font AS IT STREAMS — markdown →
    // formatted HTML on every tick — instead of showing raw text and only
    // reflowing once the whole reading has landed. Throttled (~90ms) so a long
    // reading doesn't re-parse + repaint on every single token.
    var streamLast = 0, streamPending = "", streamTimer = null;
    function paintStream() {
      streamTimer = null; streamLast = Date.now();
      streamPreview.innerHTML = mdReading(streamPending);
    }
    function onStreamDelta(chunk, fullSoFar) {
      streamPending = fullSoFar;
      var dt = Date.now() - streamLast;
      if (dt >= 90) paintStream();
      else if (!streamTimer) streamTimer = setTimeout(paintStream, 90 - dt);
    }

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

    try { window.__bwReadingIncomplete = false; } catch (e) {}
    var history = buildHistory(c, 3);
    var answerP;
    if (m.id === "sortis") {
      answerP = sortisReading(text, spec, sortisBoard, history, onStreamDelta);
    } else {
      // Stria: routed pipeline with the computed board so the reading is
      // grounded in the primary hexagram, but the board is nulled out of the
      // stored message so the thread keeps Stria's light figure (full board is
      // Sortis-only). Failures propagate to the failure handler; askOracle only
      // covers the freak case of the router module not loading.
      var striaRouted = routedReading(text, spec, castBoard, "stria", history, onStreamDelta);
      if (striaRouted) {
        answerP = striaRouted.then(function (result) {
          if (result && result.text) { result.board = null; }
          return result;
        });
      } else {
        answerP = askOracle(text, m).then(function (t) {
          return t ? { text: t, board: null, reading: null } : { __error: { message: "oracle call failed" } };
        });
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
      if (streamTimer) { clearTimeout(streamTimer); streamTimer = null; }
      if (streamPreview && streamPreview.parentNode) streamPreview.parentNode.removeChild(streamPreview);
      renderUnits(); renderList();
      // the backend settled an interrupted reading by ACTUAL output (metered)
      // and refunded the unused reserve — tell the user they can continue on
      // this same casting instead of recasting (balance reconciled via bw_meta)
      if (window.__bwReadingIncomplete) {
        window.__bwReadingIncomplete = false;
        S.units = A.state().units; renderUnits();
        var zhi = /[一-鿿]/.test(text);
        toast(zhi ? "解读中断——只收取了已生成部分的点数,其余已退回。直接发送“继续”可在同一卦上接着解读。"
                  : "The reading was cut short — you were only charged for what arrived. Send “continue” to pick it up on this same casting.");
      }
      revealReading(live, oracleMsg, c.id, c.msgs.length - 1).then(release, release);
    }
    function release() {
      busy = false;
      var sb = $("sendBtn"); if (sb) sb.disabled = false;
      var ci = $("composerInput"); if (ci) ci.focus();
    }

    /* A failed cast refunds the optimistic local deduction (the server already
       refunded its own atomic one) and says plainly what happened, in the
       question's language, instead of dressing a failure up as a reading. */
    function castFail(err) {
      err = err || {};
      var e = err.__error || err;
      var status = e && e.status;
      A.refundLocal(m.cost);
      S.units = A.state().units;
      var zh = /[一-鿿]/.test(text);
      var msg;
      if (status === 401) msg = zh ? "登录状态已失效——请重新登录后再起卦。本次点数已退回。" : "Your session has expired — sign in again to cast. These units were refunded.";
      else if (status === 403) msg = zh ? "Sortis 6 需要 Pro 或 Premium 方案。本次点数已退回。" : "Sortis 6 needs the Pro or Premium plan. These units were refunded.";
      else if (status === 402) msg = zh ? "服务端点数不足——请充值后再试。本次点数已退回。" : "Not enough units on the server — add units and try again. These units were refunded.";
      else if (err.__timeout) msg = zh ? "解读超时——请再试一次。本次点数已退回。" : "The reading timed out — please try again. These units were refunded.";
      else msg = zh ? "解读未能完成——请稍后再试。本次点数已退回。" : "The reading could not be completed — please try again shortly. These units were refunded.";
      if (spacer && spacer.parentNode) spacer.parentNode.removeChild(spacer);
      if (streamTimer) { clearTimeout(streamTimer); streamTimer = null; }
      if (streamPreview && streamPreview.parentNode) streamPreview.parentNode.removeChild(streamPreview);
      live.classList.remove("casting-live");
      var p = document.createElement("p");
      p.className = "reading-error";
      p.textContent = msg;
      live.appendChild(p);
      renderUnits();
      release();
    }

    Promise.all([answerP, castDone]).then(function (r) {
      var ans = r[0];
      if (!ans || ans.__error || ans.__timeout || !ans.text) castFail(ans);
      else finish(ans);
    }, function (e) {
      castFail({ __error: e });
    });
  }

  /* ── follow-up flow: a further question ON the existing casting. No new
     hexagram, no casting animation — the SAME board grounds the answer and
     prior turns ride along as history. Billing is metered: the client
     reserves followCost optimistically, the server settles to actual token
     usage and refunds the difference (bw_meta carries the real balance +
     the actual charge). An interrupted CAST plus a "continue" follow-up is
     the recovery path that used to require paying for a whole recast. ── */
  function followupFlow(c, text, m, lastCast, reserved) {
    busy = true;
    $("sendBtn").disabled = true;

    // ground the follow-up in the SAME board that was cast: sortis stores it
    // on the message; stria stores only the spec — recompute from its lines.
    var board = lastCast.board || null;
    if (!board && window.BWLiuYao && lastCast.spec && lastCast.spec.lines && lastCast.spec.lines.length === 6) {
      try {
        board = window.BWLiuYao.computeBoard({
          lines: lastCast.spec.lines, changeIdx: lastCast.spec.changeIdx || [],
          method: m.id, name: lastCast.spec.name, transformedName: lastCast.spec.transformedName
        });
      } catch (e) { board = null; }
    }

    var live = document.createElement("article");
    live.className = "reading casting-live";
    live.setAttribute("aria-live", "polite");
    var streamPreview = document.createElement("div");
    streamPreview.className = "reading-body reading-streaming";
    live.appendChild(streamPreview);
    threadInner.appendChild(live);
    var streamLast = 0, streamPending = "", streamTimer = null;
    function paintStream() { streamTimer = null; streamLast = Date.now(); streamPreview.innerHTML = mdReading(streamPending); }
    function onDelta(chunk, full) {
      streamPending = full;
      var dt = Date.now() - streamLast;
      if (dt >= 90) paintStream();
      else if (!streamTimer) streamTimer = setTimeout(paintStream, 90 - dt);
    }
    var thread = $("thread");
    thread.scrollTop = thread.scrollHeight;

    try { window.__bwReadingIncomplete = false; window.__bwLastCharged = null; } catch (e) {}
    var history = buildHistory(c, 3);
    var run = routedReading(text, lastCast.spec, board, m.id, history, onDelta, "followup");

    function release() {
      busy = false;
      var sb = $("sendBtn"); if (sb) sb.disabled = false;
      var ci = $("composerInput"); if (ci) ci.focus();
    }
    function fail(err) {
      err = err || {};
      var e = err.__error || err;
      var status = e && e.status;
      A.refundLocal(reserved);
      S.units = A.state().units;
      var zh = /[一-鿿]/.test(text);
      var msg;
      if (status === 401) msg = zh ? "登录状态已失效——请重新登录。本次点数已退回。" : "Your session has expired — sign in again. These units were refunded.";
      else if (status === 402) msg = zh ? "服务端点数不足——请充值后再试。本次点数已退回。" : "Not enough units on the server — add units and try again. These units were refunded.";
      else if (err.__timeout) msg = zh ? "回答超时——请再试一次。本次点数已退回。" : "The answer timed out — try again. These units were refunded.";
      else msg = zh ? "回答未能完成——请稍后再试。本次点数已退回。" : "The answer could not be completed — try again shortly. These units were refunded.";
      if (streamTimer) { clearTimeout(streamTimer); streamTimer = null; }
      if (streamPreview.parentNode) streamPreview.parentNode.removeChild(streamPreview);
      live.classList.remove("casting-live");
      var p = document.createElement("p");
      p.className = "reading-error";
      p.textContent = msg;
      live.appendChild(p);
      renderUnits();
      release();
    }
    function finish(ans) {
      // bw_meta reported the ACTUAL metered charge; fall back to the reserve.
      var charged = (typeof window.__bwLastCharged === "number") ? window.__bwLastCharged : reserved;
      try { window.__bwLastCharged = null; } catch (e) {}
      var msg = {
        role: "oracle", text: ans.text, method: m.name, methodId: m.id,
        followup: true, figure: lastCast.figure, spec: null, board: null, reading: null,
        ts: Date.now(), cost: charged
      };
      c.msgs.push(msg);
      save();
      A.syncCasting(c);
      if (streamTimer) { clearTimeout(streamTimer); streamTimer = null; }
      if (streamPreview.parentNode) streamPreview.parentNode.removeChild(streamPreview);
      S.units = A.state().units;      // bw_meta already reconciled the real balance
      renderUnits(); renderList();
      if (window.__bwReadingIncomplete) {
        window.__bwReadingIncomplete = false;
        var zhi = /[一-鿿]/.test(text);
        toast(zhi ? "回答中断——只收取了已生成部分的点数。发送“继续”可接着写。"
                  : "The answer was cut short — you were only charged for what arrived. Send “continue” to pick it up.");
      }
      revealReading(live, msg, c.id, c.msgs.length - 1).then(release, release);
    }
    run.then(function (ans) {
      if (!ans || ans.__error || ans.__timeout || !ans.text) fail(ans);
      else finish(ans);
    }, function (e) { fail({ __error: e }); });
  }

  /* ── reveal an answer naturally: crossfade the cast into the reading, then
     stream the verdict word-by-word and fade the line-by-line analysis in ── */
  function revealReading(node, msg, convId, idx) {
    var reduced = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    return new Promise(function (resolve) {
      /* the casting animation already drew the annotated figure IN PLACE (cast());
         leave it exactly where it is and append the structured verdict below it.
         NO auto-scroll here — the old scroll-down-to-the-verdict jerked the view
         back after the send had lifted the question up (the "上下回滚" complaint);
         the reader keeps full control of the viewport. */
      node.classList.remove("casting-live");
      var frag = document.createElement("div");
      frag.innerHTML = verdictHTML(msg);
      while (frag.firstChild) node.appendChild(frag.firstChild);
      var bodyEl = node.querySelector(".reading-body");
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
    /* rolling will-change window: promote only the next few words to compositor
       layers (blur/clip/transform transitions then run off the main thread),
       and release each word shortly after it lands — hundreds of simultaneous
       layers would jank the compositor, a window of ~8 never does. */
    var AHEAD = 8, TRAIL = 10, promoted = 0;
    var k = 0;
    (function tick() {
      if (k >= words.length) {
        words.forEach(function (w) { w.style.willChange = "auto"; });
        revealSecs(); return;
      }
      while (promoted < Math.min(k + AHEAD, words.length)) {
        words[promoted].style.willChange = "opacity, transform, filter, clip-path";
        promoted++;
      }
      /* one word at a time, slowly, so the five reveal styles visibly take turns */
      words[k].classList.add("on");
      if (k - TRAIL >= 0) words[k - TRAIL].style.willChange = "auto";
      k++;
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

  /* ── sidebar rail (desktop) / drawer (≤880px) ── */
  if (localStorage.getItem(RAIL) === "1") document.body.classList.add("rail");
  var mqNarrow = window.matchMedia ? window.matchMedia("(max-width:880px)") : { matches: false };
  $("sideToggle").addEventListener("click", function () {
    // in drawer mode this button closes the drawer; rail collapse is desktop-only
    if (mqNarrow.matches) { document.body.classList.remove("side-open"); return; }
    var r = document.body.classList.toggle("rail");
    try { localStorage.setItem(RAIL, r ? "1" : "0"); } catch (e) {}
  });
  var sideOpenBtn = $("sideOpenBtn");
  if (sideOpenBtn) sideOpenBtn.addEventListener("click", function () { document.body.classList.add("side-open"); });
  var sideScrim = $("sideScrim");
  if (sideScrim) sideScrim.addEventListener("click", function () { document.body.classList.remove("side-open"); });
  // choosing a conversation / starting a new one / opening the account menu from
  // inside the drawer closes it
  var sideEl = document.querySelector(".sidebar");
  if (sideEl) sideEl.addEventListener("click", function (e) {
    if (!mqNarrow.matches) return;
    if (e.target.closest && e.target.closest(".casting,.new-cast,.brand-btn")) {
      document.body.classList.remove("side-open");
    }
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") document.body.classList.remove("side-open"); });

  /* ── account menu ── */
  var acctMenu = $("acctMenu"), acctBtn = $("acctBtn");
  function closeMenu() { acctMenu.classList.remove("open"); acctBtn.setAttribute("aria-expanded", "false"); }
  acctBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    // A guest has no account menu to show — the footer IS the "login option".
    // Login is only ever reached by an explicit click here (or by trying to
    // send), never automatically on load. Signed-in users get the menu.
    if (!S.account.signedIn) { location.href = "./login.html"; return; }
    var open = acctMenu.classList.toggle("open");
    acctBtn.setAttribute("aria-expanded", open ? "true" : "false");
  });
  document.addEventListener("click", function (e) { if (!acctMenu.contains(e.target)) closeMenu(); });

  /* ── sign-in coach-mark: the whole callout is a shortcut to login; the ×
     dismisses it for good. It points at the Guest footer just below it. ── */
  var coachEl = $("signinCoach");
  if (coachEl) {
    coachEl.addEventListener("click", function () { location.href = "./login.html"; });
    coachEl.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); location.href = "./login.html"; }
    });
    var coachX = $("coachClose");
    if (coachX) coachX.addEventListener("click", function (e) {
      e.stopPropagation();
      try { localStorage.setItem("bw:coachDismissed", "1"); } catch (er) {}
      coachEl.hidden = true;
    });
  }
  $("miPlans").addEventListener("click", function () { closeMenu(); openPlans(); });
  $("miSettings").addEventListener("click", function () { location.href = "./settings.html"; });
  $("miSignout").addEventListener("click", function () {
    closeMenu();
    A.signOut();
    S = A.state();
    renderAll();
    toast("Signed out — your history and balance remain secure.");
  });

  /* ── plans live on the pricing page (no in-app modal) ── */
  function openPlans() { location.href = "./pricing.html"; }
  var openBtn = $("openPlans");
  if (openBtn) openBtn.addEventListener("click", openPlans);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") { closeMenu(); closeMethod(); } });

  /* ── entry: ?q= from landing, #plans deep link ── */
  var params = new URLSearchParams(location.search);
  var q = (params.get("q") || "").trim();
  if (q) history.replaceState(null, "", location.pathname);

  /* ── boot: hydrate from the server (if signed in), then paint ── */
  renderAll();                       // instant paint from local store
  A.hydrate(function () {
    S = A.state(); renderAll();
    // Fire the landing hand-off ONLY after hydrate resolves, so serverOn and
    // the signed-in account are known before the cast is created — otherwise
    // the casting could be produced (and its history written) before the
    // session is established and never reach the server.
    if (q) send(q);
  });
  window.addEventListener("bw:account-synced", function () {
    S.units = A.state().units; renderUnits();
  });

  if (location.hash === "#plans") openPlans();
})();
