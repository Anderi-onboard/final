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

  /* Is this text Chinese? NOT "does it contain a CJK character" — an ENGLISH
     reading is required to keep the Liu Yao vocabulary untranslated, so that
     test calls every English reading Chinese. Proportion separates them
     cleanly: Chinese prose runs well over half CJK, English prose carrying a
     dozen terms stays in the low single digits. */
  function isZh(text) {
    var s = String(text || "");
    if (!s) return false;
    return (s.match(/[㐀-䶿一-鿿豈-﫿]/g) || []).length / s.length > 0.15;
  }

  function activeConv() {
    for (var i = 0; i < S.convs.length; i++) if (S.convs[i].id === S.activeId) return S.convs[i];
    return null;
  }
  // A reading can settle after the reader has already moved to another thread,
  // so late work looks the conversation up by id rather than asking what is open.
  function convById(id) {
    for (var i = 0; i < S.convs.length; i++) if (S.convs[i].id === id) return S.convs[i];
    return null;
  }
  function method() { return METHODS[S.method] || METHODS.stria; }

  /* ── els ── */
  var $ = function (id) { return document.getElementById(id); };
  var threadInner = $("threadInner"), castList = $("castList"), toastEl = $("toast");
  var heroEmpty = document.getElementById("heroEmpty");
  var busy = false;
  var esc = A.esc;
  var C = window.BWCopy;   // every reader-facing sentence lives in copy.js

  /* ── render: ledger + account ── */
  function renderUnits() {
    var u = S.units.toLocaleString("en-US");
    $("unitsSide").textContent = u;
    $("unitsTop").textContent = u + " units";
    // the meter measures against this account's real allowance, not a fixed 4,500
    var allowance = ((A.PLANS && A.PLANS[S.account.plan] || {}).grant) || 500;
    var pct = Math.max(4, Math.min(100, Math.round(S.units / allowance * 100)));
    var bar = $("unitsBar"); if (bar) bar.style.width = pct + "%";
    var planEl = $("ledgerPlan"); if (planEl) planEl.textContent = A.planName(S.account.plan);
    var cap = $("unitsCap"); if (cap) cap.textContent = S.account.plan === "free" ? C.ledger.capFree : C.ledger.capPaid;
  }
  function renderAccount() {
    var a = S.account;
    var foot = $("acctBtn");
    foot.querySelector(".avatar").textContent = a.signedIn ? (a.avatar || "EV") : "G";
    foot.querySelector("b").textContent = a.name;
    foot.querySelector("i").textContent = a.signedIn ? (A.planName(a.plan) + " plan") : "Sign in to start a reading";
    var menu = $("acctMenu");
    menu.querySelector(".who b").textContent = a.name;
    menu.querySelector(".who span").textContent = a.signedIn ? a.email : "Sign in to sync your balance and readings";
    $("miPlans").querySelector("b").textContent = a.signedIn ? A.planName(a.plan) : "Plans";
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
    $("methodNote").textContent = C.composer.methodNote(m.name, m.cost);
    renderMethodMenu();
  }
  function renderMethodMenu() {
    var menu = $("methodMenu");
    if (!menu) return;
    menu.innerHTML = '<div class="mm-head lbl">Choose an analysis depth</div>';
    ORDER.forEach(function (id) {
      var m = METHODS[id];
      var active = id === S.method;
      var row = document.createElement("button");
      row.className = "mm-row" + (active ? " active" : "");
      row.innerHTML =
        '<span class="mm-dot" aria-hidden="true"></span>' +
        '<span class="mm-main">' +
          '<span class="mm-name">' + m.name + '</span>' +
          '<span class="mm-tag">' + m.tag + " · " + m.depth + "</span>" +
          '<span class="mm-blurb">' + m.blurb + "</span>" +
        "</span>" +
        '<span class="mm-cost" style="font-family:\'BioRhyme\',serif">' + C.composer.methodCost(m.cost) + '<small>units</small></span>';
      row.addEventListener("click", function () {
        S.method = id; save(); renderMethod(); closeMethod();
      });
      menu.appendChild(row);
    });
  }

  function renderList() {
    castList.innerHTML = '<div class="lbl">Reading history</div>';
    S.convs.forEach(function (c) {
      var wrap = document.createElement("div");
      wrap.className = "casting-row" + (c.id === S.activeId ? " active" : "");
      var b = document.createElement("button");
      b.className = "casting" + (c.id === S.activeId ? " active" : "");
      var lastReading = null;
      for (var ri = c.msgs.length - 1; ri >= 0; ri--) {
        if (c.msgs[ri].role === "oracle") { lastReading = c.msgs[ri]; break; }
      }
      var metaMethod = lastReading && lastReading.method ? lastReading.method : "Reading";
      var metaDate = lastReading && lastReading.ts
        ? new Date(lastReading.ts).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";
      b.innerHTML = '<span class="casting-title">' + esc(c.title) + '</span>' +
        '<span class="casting-meta">' + esc(metaMethod + (metaDate ? " · " + metaDate : "")) + '</span>';
      b.title = c.title;
      b.addEventListener("click", function () {
        S.activeId = c.id;
        /* Returning to a reading should restore its method too. Otherwise a
           Sortis thread could reopen with a Stria composer and the next send
           would silently become a fresh cast instead of a continuation. */
        if (lastReading && METHODS[lastReading.methodId]) S.method = lastReading.methodId;
        save(); renderAll(); restoreDraft();
      });
      var del = document.createElement("button");
      del.className = "casting-del";
      del.innerHTML = "&times;";
      del.title = "Delete this reading";
      del.addEventListener("click", function (e) {
        e.stopPropagation();
        S.convs = S.convs.filter(function (x) { return x.id !== c.id; });
        if (S.activeId === c.id) S.activeId = S.convs.length ? S.convs[0].id : null;
        save(); A.deleteCastingRemote(c.id); renderAll();
        toast(C.account.readingDeleted);
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
      return '<div class="reading-body">' + (prose || '<p class="rd-para"></p>') +
        readingFootnote(msg.text) + '</div>' + readingDepth(msg) + readingActions();
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
      mdReading(r.reading) + keysSec + timeSec + readingFootnote(r.reading) + '</div>' +
      readingDepth(msg) + readingActions();
  }

  /* The caution under every finished reading. Rendered by the app rather than
     asked of the model: a notice that matters on every reading cannot depend on
     the model remembering to write it, and one written INSIDE the prose either
     blunts the verdict or gets skimmed with the rest of the paragraph.
     Language follows the reading itself — the reader is looking at that text,
     so a footnote in another language is decoration. */
  function readingFootnote(text) {
    var zh = isZh(text);
    var body = (C.readingFooter && (zh ? C.readingFooter.zh : C.readingFooter.en)) || "";
    if (!body) return "";
    return '<p class="rd-footnote" lang="' + (zh ? 'zh' : 'en') + '">' + esc(body) + '</p>';
  }

  /* Write the follow-up prompts from the reading that just landed, then swap
     them into the panel already on screen.

     Unbilled utility call, fired after the reading settles so it costs the
     reader nothing in waiting. The panel is painted with the static set first,
     so there is never a gap and never a spinner; if this returns something
     better it replaces that section IN PLACE. Deliberately not a re-render of
     the thread — repainting the whole conversation is what used to snap the
     viewport back after a send, and the reader is mid-reading here. */
  function suggestFollowUps(node, msg, conv) {
    var PE = window.BWPromptEngine;
    var R = PE && PE.FOLLOWUP_SUGGEST;
    var text = msg && (msg.text || (msg.reading && msg.reading.reading));
    if (!R || !text || !(window.claude && typeof window.claude.complete === "function")) return;
    if (msg.prompts) return;

    var asked = "";
    if (conv && conv.msgs) {
      for (var i = conv.msgs.length - 1; i >= 0; i--) {
        if (conv.msgs[i] && conv.msgs[i].role === "user") { asked = conv.msgs[i].text || ""; break; }
      }
    }
    var methodLabel = (msg.methodId === "sortis" || msg.method === "Sortis 6") ? "Sortis 6" : "Stria 64";
    var guard = new Promise(function (res) { setTimeout(function () { res(null); }, R.timeoutMs); });
    var run = window.claude.complete({
      role: "utility", model: R.model, max_tokens: R.maxTokens,
      messages: [{ role: "user", content: R.build(asked, text, methodLabel) }]
    }).then(function (r) { return R.read(r); }).catch(function () { return null; });

    Promise.race([run, guard]).then(function (made) {
      if (!made || !made.length) return;          // keep the static set, say nothing
      msg.prompts = made;
      try { save(); } catch (e) {}
      var old = node && node.querySelector(".rd-depth");
      if (!old) return;
      var frag = document.createElement("div");
      frag.innerHTML = readingDepth(msg);
      var fresh = frag.firstChild;
      if (fresh) old.parentNode.replaceChild(fresh, old);
    });
  }

  /* A reading should open the next useful layer, not end as a block of prose.
     These lenses compose a follow-up without sending it: the reader can edit,
     reconsider, and only spend units when they deliberately submit. */
  function readingDepth(msg) {
    var continued = !!(msg && msg.followup);
    var sortis = !!(msg && (msg.methodId === "sortis" || msg.method === "Sortis 6"));
    var methodLabel = sortis ? "Sortis 6" : "Stria 64";
    // Written from the reading when suggestFollowUps() managed it. The static
    // set below is the floor, not the intent: it asks nothing this particular
    // reading raised, so it is what a reader sees only when generation failed.
    var made = msg && Array.isArray(msg.prompts) && msg.prompts.length >= 3 ? msg.prompts : null;
    var prompts = made || (continued ? [
      ["Challenge", "What assumption in this reading is weakest?"],
      ["Concrete", "How would this show up in practice?"],
      ["Alternative", "What is the strongest alternative reading?"],
      ["Boundary", "What is outside my control here?"],
      ["Signal", "What sign would show the situation has changed?"],
      ["Action", "What is the smallest responsible next move?"]
    ] : (sortis ? [
      ["Moving line", "Which moving line carries the decision?"],
      ["Causal chain", "What is actually driving this change?"],
      ["Transition", "Where is the transition most fragile?"],
      ["Timing", "What should happen before I act?"],
      ["Leverage", "Where can a small move change the outcome?"],
      ["Decision test", "What would make this choice unwise?"]
    ] : [
      ["Core pattern", "What is the central pattern in this figure?"],
      ["My position", "Where do I have real leverage here?"],
      ["Response", "What is the situation asking back from me?"],
      ["Blind spot", "What am I not seeing yet in this situation?"],
      ["Near term", "What is most likely to change first?"],
      ["Next move", "What is mine to do now?"]
    ]));
    // The panel speaks whatever the prompts on it speak.
    var zhPanel = isZh(prompts.map(function (p) { return p[1]; }).join(""));
    var L = (C.followUp.panel && (zhPanel ? C.followUp.panel.zh : C.followUp.panel.en)) || C.followUp.panel.en;
    return '<section class="rd-depth" lang="' + (zhPanel ? 'zh' : 'en') + '" aria-label="' + esc(L.aria(methodLabel)) + '">' +
      '<div class="rd-depth-copy"><span class="rd-depth-kicker">' + esc(L.kicker(methodLabel)) + '</span>' +
      '<h4>' + esc(continued ? L.headContinued : (sortis ? L.headSortis : L.headStria)) + '</h4>' +
      '<p>' + esc(L.hint) + '</p></div>' +
      '<div class="rd-prompts">' + prompts.map(function (p) {
        return '<button type="button" class="rd-prompt pressable" data-prompt="' + esc(p[1]) + '">' +
          '<span>' + esc(p[0]) + '</span><b>' + esc(p[1]) + '</b>' +
          '<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M3 8h9M9 4.5 12.5 8 9 11.5"></path></svg>' +
        '</button>';
      }).join("") + '</div>' +
      '<p class="rd-depth-note">' + esc(L.note(A.followCost(sortis ? 'sortis' : 'stria'))) + '</p>' +
    '</section>';
  }

  /* Actions expected on a finished AI response: preserve the artifact, continue
     in context, or deliberately begin a separate casting. */
  function readingActions() {
    return '<div class="rd-actions" aria-hidden="false">' +
      '<button type="button" class="rd-action rd-copy pressable" title="Copy this reading">' +
      '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="5" y="5" width="8" height="9" rx="1.5"></rect><path d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2h-6A1.5 1.5 0 0 0 2 3.5v6A1.5 1.5 0 0 0 3.5 11H5"></path></svg>' +
      '<span class="rd-copy-lbl">Copy</span></button>' +
      '<button type="button" class="rd-action rd-follow pressable" title="Ask about this casting">' +
      '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M2.5 3.5h11v7h-6l-3.5 3v-3H2.5z"></path></svg>' +
      '<span>Follow up</span></button>' +
      '<button type="button" class="rd-action rd-new pressable" title="Start a separate casting">' +
      '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M8 3v10M3 8h10"></path></svg>' +
      '<span>New casting</span></button></div>';
  }
  /* static, fully-painted reading (used on reload / conversation switch) */
  function readingHTML(msg) {
    return figureHTML(msg) + verdictHTML(msg);
  }

  function renderThread() {
    var c = activeConv();
    var titleText = c ? c.title : "New casting";
    $("convTitle").textContent = titleText;
    $("convTitle").title = titleText;
    threadInner.innerHTML = "";
    if (!c || !c.msgs.length) {
      document.body.classList.add("is-empty");
      if (heroEmpty) { threadInner.appendChild(heroEmpty); return; }
      threadInner.innerHTML =
        '<div class="empty">' +
          '<div class="eyebrow"><b>\u25C6</b>&nbsp; New reading</div>' +
          "<h2>Describe the situation.<br>Ask one question.</h2>" +
          '<svg class="flourish" width="186" height="14" viewBox="0 0 186 14" aria-hidden="true">' +
            '<path d="M4 10 C32 2 60 2 84 8 C110 14 146 12 182 4" stroke="#2A2016" stroke-width="1.5" fill="none" stroke-linecap="round"></path>' +
            '<path d="M10 13 C52 8 106 12 176 7" stroke="#2A2016" stroke-width="1" fill="none" stroke-linecap="round"></path>' +
          "</svg>" +
          "<p>The casting engine creates a fixed hexagram. Claude Opus 5 interprets it against the context you provide.</p>" +
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
    var deep = m.id === "sortis"
      ? " This is a Sortis 6 deep casting: the figure has moving lines crossing into a second figure, so weigh how the situation is changing, not just where it stands."
      : "";
    var prompt = "You are BourneWise, a blunt I-Ching-style oracle. Question: \"" + question +
      "\". Reply with ONE honest judgment, 1-3 sentences, plain modern language, no hedging, no mysticism dump." +
      deep + " Wrap exactly ONE key word or short phrase in pipes like |this| for emphasis." +
      " Reply in English with the judgment only.";
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

  /* ── follow-up vs new-question detection (Sonnet 5) ──
     Same thread + same method no longer means "always follow-up": a small
     Sonnet 5 classification decides whether the new message rides ON the
     previous casting (FOLLOWUP → metered, ≤ half price) or raises a different
     matter that deserves a fresh hexagram (NEW → full cast, in THIS thread,
     history preserved). Unbilled utility call; 4s timeout or any failure
     defaults to FOLLOWUP — the cheaper, least-surprising outcome. */
  function detectIntent(question, lastQuestion, lastReading) {
    var PE = window.BWPromptEngine;
    var R = PE && PE.INTENT_ROUTER;
    // No engine, or no proxy to ask — treat it as a follow-up, the cheaper and
    // least surprising outcome.
    if (!R || !(window.claude && typeof window.claude.complete === "function")) {
      return Promise.resolve((R && R.fallback) || "followup");
    }
    var guard = new Promise(function (res) {
      setTimeout(function () { res(R.fallback); }, R.timeoutMs);
    });
    var run = window.claude.complete({
      role: "utility", model: R.model, max_tokens: R.maxTokens,
      messages: [{ role: "user", content: R.build(question, lastQuestion, lastReading) }]
    }).then(function (r) { return R.read(r); })
      .catch(function () { return R.fallback; });
    return Promise.race([run, guard]);
  }

  /* ── stream renderer ──
     Paint the latest server buffer at a modest cadence. Artificially chasing
     every character made Chromium parse and replace the entire markdown tree
     many times per second, then the old reveal pass animated it all again. */
  function makeTypewriter(el) {
    var target = "", timer = null, cancelled = false;
    function paint() {
      timer = null;
      if (cancelled) return;
      el.innerHTML = mdReading(target) || '<p class="rd-para"></p>';
    }
    function schedule() {
      if (!timer) timer = setTimeout(paint, 96);
    }
    return {
      delta: function (full) {
        target = String(full || "");
        schedule();
      },
      finish: function (cb) {
        if (timer) { clearTimeout(timer); timer = null; }
        paint();
        if (cb) cb();
      },
      cancel: function () { cancelled = true; if (timer) { clearTimeout(timer); timer = null; } }
    };
  }

  /* Sortis 6 → full professional casting board + AI reading (the deep-tier experience).
     Stria stays the light per-line reading; the gap between the two IS the rigor.

     When BWPromptRouter is loaded, both Sortis and Stria use the modular prompt
     pipeline: Gate → Route → Focused Prompt → QC Pass. This sends only the
     relevant rule subset (~2000-3000 tokens) instead of the full 15k+ monolith,
     improving rule adherence without increasing token cost. */
  function routedReading(question, spec, board, methodId, history, onDelta, mode, temperature, rootQuestion) {
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
      rootQuestion: rootQuestion || question,
      product: product,
      board: board,
      method: methodId,
      category: "general",
      // no lang override — BWPromptRouter detects it from the question text
      history: history || [],
      onDelta: wrappedDelta,
      mode: mode || null, // "followup" → metered billing, no recast
      temperature: (typeof temperature === "number") ? temperature : null // recast → run hot
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

  function sortisReading(question, spec, board, history, onDelta, temperature) {
    if (!board) board = (window.BWLiuYao && spec && spec.lines && spec.lines.length === 6)
      ? window.BWLiuYao.computeBoard({
          lines: spec.lines, changeIdx: spec.changeIdx || [],
          method: "sortis", name: spec.name, transformedName: spec.transformedName
        })
      : null;

    // Routed pipeline (modular prompts + QC) is the real path; legacy only
    // covers the freak case where prompt-router.js failed to load. Errors flow
    // through to send()'s failure handler — no mock rescue.
    var routed = routedReading(question, spec, board, "sortis", history, onDelta, null, temperature);
    if (routed) return routed;
    return sortisLegacy(question, spec, board);
  }

  function sortisLegacy(question, spec, board) {
    // No mock fallback: mock output is placeholder prose, and showing it for a
    // paid cast (while units drained) is worse than an honest failure.
    if (!board || !window.BWLiuYaoAI) {
      return Promise.resolve({ __error: { message: "casting engine unavailable" } });
    }
    var lang = "en";
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

  /* ── stale-tab guard ──
     A chat tab left open across a deploy keeps the OLD prompt engine in
     memory — casts from it silently use outdated reading rules (bit us in
     production: banned sections reappeared). Before each cast, compare the
     build stamp this page loaded with the one currently served; on mismatch,
     block the cast and ask for one reload. Fail-open on network errors so
     the check can never break casting. */
  var staleCheckAt = 0, staleKnown = false;
  function checkBuildFresh() {
    if (staleKnown) return Promise.resolve(false);
    var now = Date.now();
    if (!window.BW_BUILD || (now - staleCheckAt) < 60000) return Promise.resolve(true);
    staleCheckAt = now;
    var ctrl = ("AbortController" in window) ? new AbortController() : null;
    var timer = ctrl && setTimeout(function () { ctrl.abort(); }, 1500);
    return fetch("./version.json?cb=" + now, ctrl ? { signal: ctrl.signal } : {})
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (timer) clearTimeout(timer);
        if (j && j.v && j.v !== window.BW_BUILD) { staleKnown = true; return false; }
        return true;
      })
      .catch(function () { if (timer) clearTimeout(timer); return true; });
  }

  /* ── composer drafts — the question you're composing survives conversation
     switches, refreshes, and blocked casts (stale build, shortfall). Keyed per
     conversation; cleared only when the cast actually commits. ── */
  function draftKey() { var c = activeConv(); return "bw:draft:" + (c ? c.id : "new"); }
  function saveDraft() {
    try {
      var v = $("composerInput").value;
      if (v) localStorage.setItem(draftKey(), v); else localStorage.removeItem(draftKey());
    } catch (e) {}
  }
  function restoreDraft() {
    try { $("composerInput").value = localStorage.getItem(draftKey()) || ""; } catch (e) {}
    sizeComposer();
  }
  function clearDraft() {
    try { localStorage.removeItem(draftKey()); } catch (e) {}
    var ci = $("composerInput"); if (ci) ci.value = "";
    sizeComposer();
  }
  function sizeComposer() {
    var ci = $("composerInput");
    if (!ci || ci.tagName !== "TEXTAREA") return;
    ci.style.height = "auto";
    var contentHeight = ci.scrollHeight;
    ci.style.height = Math.min(contentHeight, 120) + "px";
    ci.style.overflowY = contentHeight > 120 ? "auto" : "hidden";
  }
  $("composerInput").addEventListener("input", function () { saveDraft(); sizeComposer(); });

  /* ── shortfall pulse — say "not enough units" where the number lives:
     units chip, sidebar count and Add-units button flash terracotta. ── */
  function pulseLedger() {
    [$("unitsTop"), $("openPlans")].concat(
      $("unitsSide") ? [$("unitsSide").closest(".ledger-bal")] : []
    ).forEach(function (el) {
      if (!el) return;
      el.classList.remove("shortfall");
      void el.offsetWidth;                 // restart the animation
      el.classList.add("shortfall");
      setTimeout(function () { el.classList.remove("shortfall"); }, 1100);
    });
  }

  /* ── bare-recast detector ──
     "再起一卦" / "重新起一卦" / "cast again" with NO subject of its own. The
     user wants a FRESH hexagram, still about the matter already under
     discussion — so we must inherit the previous question's subject, or the
     cast falls through to a default self-reading of the literal instruction
     ("应该再起一卦" → general → world line → an analysis of the asker). Returns
     true only when, after stripping the recast directive + filler, almost
     nothing meaningful is left (i.e. the message carries no new subject). */
  var RECAST_RE = /(再|重新?|又)\s*(起|算|卜|摇|来|测)\s*一?\s*卦|再来一(卦|次)|重新起卦|重起一?卦|换一卦|重卜|再卜|cast\s+again|re-?cast|another\s+(cast|reading|hexagram)|throw\s+(it\s+)?again|start\s+(a\s+)?(new\s+)?cast/i;
  function hasRecast(t) { return RECAST_RE.test(t || ""); }
  function bareRecast(t) {
    t = (t || "").trim();
    var recast = RECAST_RE;
    if (!recast.test(t)) return false;
    var stripped = t.replace(recast, "")
      .replace(/\b(let|lets|let's|me|please|just|ok|okay|now|again|a|an|the|it|i|we|should|maybe|can|you|to|do|another|one|more|new|fresh)\b/gi, "")
      .replace(/[应該该觉得我你想要不如可以吧啊呢嘛的了看試试试一下这這那此就请請帮幫再重新为為它他她这件事此事这事那事，。、,.!！?？:：;；\s\-—]/g, "");
    return stripped.length <= 3;   // no subject of its own → carry the prior one
  }

  /* ── send flow ── */
  var preflight = false;
  var autoContinuedOnce = false;   // one automatic continuation per truncated reading
  function send(text, decided) {
    text = (text || "").trim();
    if (!text || busy || preflight) return;
    preflight = true;
    checkBuildFresh().then(function (fresh) {
      preflight = false;
      if (!fresh) {
        toast(C.errors.staleBuild);
        return;
      }
      sendNow(text, decided);
    });
  }

  function sendNow(text, decided) {
    var m = method();
    // Sign-in required: units only exist on a real account, so a signed-out
    // guest can't cast — send them to the login page. This is the "先登录才发
    // 点数" rule: no free units before an account exists.
    if (!S.account.signedIn) {
      toast(C.account.signInToCast);
      setTimeout(function () { location.href = "./login.html"; }, 1300);
      return;
    }
    // No silent downgrade: if the plan can't use this method, say so and open
    // the plans view. The old code swapped Sortis→Stria without telling the
    // user, so they paid for a shallower reading (Sonnet, no board) than they
    // asked for — which is exactly why Opus never showed up for a "Sortis" cast.
      if (!A.entitled(m.id)) return;

    /* Follow-up detection: this conversation already holds a casting by the
       same method → the new question rides ON that casting (metered billing,
       at most half a cast, NO new hexagram) instead of recasting. So "what
       did line 2 mean?" keeps its board and its context; a fresh hexagram
       needs a fresh "New casting". */
    var lastCast = null, lastQuestion = "", convNow = activeConv();
    if (convNow && window.BWPromptRouter) {
      for (var li = convNow.msgs.length - 1; li >= 0; li--) {
        var lmsg = convNow.msgs[li];
        if (lmsg.role === "oracle" && lmsg.spec) {
          lastCast = lmsg;
          for (var lj = li - 1; lj >= 0; lj--) {
            if (convNow.msgs[lj].role === "user") { lastQuestion = convNow.msgs[lj].text; break; }
          }
          break;
        }
      }
    }
    var candidate = !!(lastCast && lastCast.methodId === m.id);
    /* A bare "cast again" inside a live thread: the user wants a FRESH hexagram
       on the SAME matter. Force NEW (a new figure) and carry the previous
       question forward as the cast's subject — never run the classifier on a
       subject-less instruction, and never let it default to a self-reading. */
    /* An explicit "cast again" ALWAYS means a fresh figure — never let the
       classifier downgrade it to a same-board follow-up. A BARE recast (no
       subject of its own) also inherits the prior question as its subject. */
    var recastReq = !!(lastCast && hasRecast(text));
    var carriedRecast = !!(recastReq && bareRecast(text) && (lastQuestion || (convNow && convNow.title)));
    var castQ = carriedRecast ? (lastQuestion || convNow.title) : text;
    /* Sonnet 5 decides follow-up vs new question (see detectIntent). Runs once
       per send; the recursive re-entry carries the decision in `decided`.
       Skipped for any recast request — that's already a fresh cast by intent. */
    if (candidate && !decided && !recastReq) {
      busy = true;
      var sb0 = $("sendBtn"); if (sb0) sb0.disabled = true;
      detectIntent(text, lastQuestion || (convNow && convNow.title), lastCast.text).then(function (intent) {
        busy = false;
        if (sb0) sb0.disabled = false;
        send(text, intent === "new" ? "new" : "followup");
      });
      return;
    }
    if (recastReq && !decided) decided = "new";
    var isFollowup = candidate && decided !== "new";
    var needed = isFollowup ? A.followCost(m.id) : m.cost;
    /* Any balance at all admits a reading, and the reading you start always
       finishes — it is billed for what it used when it is done, even if that
       empties the balance. You are stopped at the next question, not part-way
       through this one. */
    if (S.units <= 0) {
      pulseLedger();
      toast(C.errors.outOfUnits);
      return;
    }

    if (!activeConv()) {
      var conv = { id: Date.now().toString(36), title: text, msgs: [] };
      S.convs.unshift(conv);
      S.activeId = conv.id;
    }
    var c = activeConv();
    c.msgs.push({ role: "user", text: text });
    save();                                 // persist the question first
    clearDraft();                           // the composed question is now spent
    /* Nothing is deducted here. The server bills the finished reading for the
       tokens it actually used and returns the new balance, so the figure moves
       once, downward, by the real amount. */
    renderAll();

    if (isFollowup) { followupFlow(c, text, m, lastCast, needed); return; }

    busy = true;
    $("sendBtn").disabled = true;

    /* the classifier ruled this a NEW question inside an ongoing thread —
       cast fresh (context still inherited via history) and surface the
       pricing rule at the exact moment it applies */
    if (decided === "new" && lastCast) {
      var note = document.createElement("div");
      note.className = "recast-note";
      if (carriedRecast) {
        // a bare "cast again" that inherited the prior subject \u2014 name the matter
        // the fresh figure is about, so the carry-over is transparent.
        var subj = String(castQ || "").replace(/\s+/g, " ").trim();
        if (subj.length > 40) subj = subj.slice(0, 40) + "\u2026";
        note.textContent = C.casting.recastCarried(subj, m.cost);
      } else if (hasRecast(text)) {
        // the message carries its own argument AND asks to recast \u2014 a fresh
        // figure on the SAME ongoing matter. Don't call it a "new question";
        // just note the fresh cast. Continuity is handled in the reading itself.
        note.textContent = C.casting.recastSameThread(m.cost);
      } else {
        note.textContent = C.casting.routedToNew(m.cost);
      }
      threadInner.appendChild(note);
    }

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
    // Typewriter reveal: the reading types itself out character-by-character
    // (structure + real font as it streams), chasing the live buffer instead
    // of repainting whole network bursts — see makeTypewriter above.
    var tw = makeTypewriter(streamPreview);
    var streamedAny = false;
    var castVisualDone = false;
    var pendingStreamText = "";
    function onStreamDelta(chunk, fullSoFar) {
      streamedAny = true;
      pendingStreamText = fullSoFar;
      /* Keep the interpretation behind the casting ritual. The request still
         runs in parallel, but its prose opens only after the figure is fully
         established and the five visible preparation steps have completed. */
      if (castVisualDone) tw.delta(fullSoFar);
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
    castDone = Promise.resolve(castDone).then(function () {
      castVisualDone = true;
      if (pendingStreamText) tw.delta(pendingStreamText);
    });

    try { window.__bwReadingIncomplete = false; } catch (e) {}
    var history = buildHistory(c, 3);
    // a recast runs the model HOT (temperature ≈ 1) so "再起卦" genuinely gives
    // a fresh draw, not a near-copy of the last reading.
    var castTemp = recastReq ? 1 : null;
    var answerP;
    if (m.id === "sortis") {
      answerP = sortisReading(castQ, spec, sortisBoard, history, onStreamDelta, castTemp);
    } else {
      // Stria: routed pipeline with the computed board so the reading is
      // grounded in the primary hexagram, but the board is nulled out of the
      // stored message so the thread keeps Stria's light figure (full board is
      // Sortis-only). Failures propagate to the failure handler; askOracle only
      // covers the freak case of the router module not loading.
      var striaRouted = routedReading(castQ, spec, castBoard, "stria", history, onStreamDelta, null, castTemp);
      if (striaRouted) {
        answerP = striaRouted.then(function (result) {
          if (result && result.text) { result.board = null; }
          return result;
        });
      } else {
        answerP = askOracle(castQ, m).then(function (t) {
          return t ? { text: t, board: null, reading: null } : { __error: { message: "oracle call failed" } };
        });
      }
    }

    function finish(ans) {
      ans = ans || { text: "", board: null, reading: null };
      var charged = (typeof window.__bwLastCharged === "number") ? window.__bwLastCharged : m.cost;
      try { window.__bwLastCharged = null; } catch (e) {}
      var oracleMsg = {
        role: "oracle", text: ans.text, method: m.name, methodId: m.id,
        figure: spec.name, spec: spec, board: ans.board || null, reading: ans.reading || null,
        ts: Date.now(), cost: charged
      };
      c.msgs.push(oracleMsg);
      c.method = m.id;
      save();
      A.syncCasting(c);   // persist this casting to the server (if signed in)
      /* update only the chrome (balance + history) — leave the thread alone so the
         casting figure isn't wiped; the verdict then streams in naturally below it */
      if (spacer && spacer.parentNode) spacer.parentNode.removeChild(spacer);
      tw.cancel();
      if (streamPreview && streamPreview.parentNode) streamPreview.parentNode.removeChild(streamPreview);
      renderUnits(); renderList();
      // the backend settled an interrupted reading by ACTUAL output (metered)
      // and refunded the unused reserve. Recasting would throw the figure away
      // — so continue AUTOMATICALLY on this same casting (a metered follow-up),
      // once per incident; if the continuation also cuts short, fall back to
      // telling the user instead of looping.
      if (window.__bwReadingIncomplete) {
        window.__bwReadingIncomplete = false;
        S.units = A.state().units; renderUnits();
        if (!autoContinuedOnce) {
          autoContinuedOnce = true;
          toast(C.followUp.continuing);
          setTimeout(function () {
            send("Continue", "followup");
          }, 700);
        } else {
          toast(C.followUp.cutAgain);
        }
      } else {
        autoContinuedOnce = false;
      }
      // typed live already → paint the structured verdict instantly instead of
      // re-animating the whole reading a second time
      revealReading(live, oracleMsg, c.id, c.msgs.length - 1, streamedAny).then(release, release);
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
      // nothing was deducted up front, so there is nothing to give back
      S.units = A.state().units;
      var msg;
      if (status === 401) msg = C.errors.sessionExpired;
      else if (status === 402) { msg = C.errors.serverShort; pulseLedger(); }
      else if (err.__timeout) msg = C.errors.timedOut;
      else msg = "The reading didn\u2019t make it through — your units are back where they were. Try again in a moment.";
      if (spacer && spacer.parentNode) spacer.parentNode.removeChild(spacer);
      tw.cancel();
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
      if (!ans || ans.__error || ans.__timeout || !ans.text) { tw.cancel(); castFail(ans); }
      // let the typewriter flush its tail before the structured verdict swaps in
      else tw.finish(function () { finish(ans); });
    }, function (e) {
      tw.cancel();
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
    var tw = makeTypewriter(streamPreview);
    var streamedAny = false;
    function onDelta(chunk, full) { streamedAny = true; tw.delta(full); }
    var thread = $("thread");
    thread.scrollTop = thread.scrollHeight;

    try { window.__bwReadingIncomplete = false; window.__bwLastCharged = null; } catch (e) {}
    var history = buildHistory(c, 3);
    var run = routedReading(text, lastCast.spec, board, m.id, history, onDelta, "followup", null, c.title || text);

    function release() {
      busy = false;
      var sb = $("sendBtn"); if (sb) sb.disabled = false;
      var ci = $("composerInput"); if (ci) ci.focus();
    }
    function fail(err) {
      err = err || {};
      var e = err.__error || err;
      var status = e && e.status;
      S.units = A.state().units;
      var msg;
      if (status === 401) msg = C.errors.sessionExpired;
      else if (status === 402) { msg = C.errors.serverShort; pulseLedger(); }
      else if (err.__timeout) msg = C.errors.answerTimedOut;
      else msg = "The answer didn\u2019t make it through — your units are back where they were. Try again in a moment.";
      tw.cancel();
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
      tw.cancel();
      if (streamPreview.parentNode) streamPreview.parentNode.removeChild(streamPreview);
      S.units = A.state().units;      // bw_meta already reconciled the real balance
      renderUnits(); renderList();
      if (window.__bwReadingIncomplete) {
        window.__bwReadingIncomplete = false;
        toast(C.followUp.answerCut);
      }
      revealReading(live, msg, c.id, c.msgs.length - 1, streamedAny).then(release, release);
    }
    run.then(function (ans) {
      if (!ans || ans.__error || ans.__timeout || !ans.text) { tw.cancel(); fail(ans); }
      else tw.finish(function () { finish(ans); });
    }, function (e) { tw.cancel(); fail({ __error: e }); });
  }

  /* ── settle the final answer once. Live server text may already have streamed;
     replacing it with the structured version is the only final paint. ── */
  function revealReading(node, msg, convId, idx, streamedAny) {
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
      if (bodyEl) bodyEl.classList.add("bw-streamed");
      resolve();
      // after the reader has the reading — never gating it
      try { suggestFollowUps(node, msg, convById(convId)); } catch (e) {}
    });
  }

  $("composerForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var inp = $("composerInput");
    /* on the landing, an example is cycling in the placeholder → empty submit sends it */
    var ex = document.body.classList.contains("is-empty") ? (inp.dataset.example || "") : "";
    send(inp.value.trim() || ex);
  });
  $("composerInput").addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      if (typeof $("composerForm").requestSubmit === "function") $("composerForm").requestSubmit();
      else $("sendBtn").click();
    }
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
    restoreDraft();
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

  /* ── guide coach-mark: comic callout under the "The method" link, first
     visit only. Clicking it (or the link itself) marks the guide as visited;
     the × dismisses it for good. ── */
  var gCoach = $("guideCoach");
  if (gCoach) {
    var gSeen = false, gGone = false;
    try {
      gSeen = localStorage.getItem("bw:guideVisited") === "1";
      gGone = localStorage.getItem("bw:guideCoachDismissed") === "1";
    } catch (e) {}
    gCoach.hidden = gSeen || gGone;
    function goGuide() {
      try { localStorage.setItem("bw:guideVisited", "1"); } catch (e) {}
      location.href = "./guide.html";
    }
    gCoach.addEventListener("click", goGuide);
    gCoach.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); goGuide(); }
    });
    var gx = $("guideCoachClose");
    if (gx) gx.addEventListener("click", function (e) {
      e.stopPropagation();
      try { localStorage.setItem("bw:guideCoachDismissed", "1"); } catch (er) {}
      gCoach.hidden = true;
    });
    var hiw = $("howItWorksLink");
    if (hiw) hiw.addEventListener("click", function () {
      try { localStorage.setItem("bw:guideVisited", "1"); } catch (e) {}
    });
  }

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
    toast(C.account.signedOut);
  });

  /* ── plans live on the pricing page (no in-app modal) ── */
  function openPlans() { location.href = "./pricing.html"; }
  var openBtn = $("openPlans");
  if (openBtn) openBtn.addEventListener("click", openPlans);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") { closeMenu(); closeMethod(); } });

  /* ── keyboard, first-class: "/" focuses the composer, "n" starts a new
     casting — both ignored while typing in any field. (Esc handled above.) ── */
  document.addEventListener("keydown", function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var t = e.target;
    if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return;
    if (e.key === "/") { e.preventDefault(); var ci = $("composerInput"); if (ci) ci.focus(); }
    else if (e.key === "n" || e.key === "N") { e.preventDefault(); var nc = $("newCast"); if (nc) nc.click(); }
  });

  /* ── copy a reading — delegated; grabs the reading body's text and drops it
     on the clipboard, with a brief "Copied" confirmation on the button ── */
  document.addEventListener("click", function (e) {
    var prompt = e.target && e.target.closest && e.target.closest(".rd-prompt");
    if (prompt) {
      var promptInput = $("composerInput");
      if (promptInput) {
        promptInput.value = prompt.getAttribute("data-prompt") || "";
        promptInput.placeholder = "Ask what this casting means for your situation…";
        saveDraft();
        sizeComposer();
        promptInput.focus();
        try { promptInput.setSelectionRange(promptInput.value.length, promptInput.value.length); } catch (err) {}
      }
      return;
    }
    var follow = e.target && e.target.closest && e.target.closest(".rd-follow");
    if (follow) {
      var followInput = $("composerInput");
      if (followInput) {
        followInput.placeholder = "Ask what this casting means for your situation\u2026";
        followInput.focus();
      }
      return;
    }
    var fresh = e.target && e.target.closest && e.target.closest(".rd-new");
    if (fresh) {
      var newBtn = $("newCast");
      if (newBtn) newBtn.click();
      return;
    }
    var btn = e.target && e.target.closest && e.target.closest(".rd-copy");
    if (!btn) return;
    var art = btn.closest(".reading");
    var body = art && art.querySelector(".reading-body");
    if (!body) return;
    var text = (body.innerText || body.textContent || "").trim();
    var lbl = btn.querySelector(".rd-copy-lbl");
    function ok() {
      btn.classList.add("done");
      if (lbl) { var was = lbl.textContent; lbl.textContent = "Copied"; setTimeout(function () { lbl.textContent = was; btn.classList.remove("done"); }, 1600); }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(ok, function () { fallbackCopy(text, ok); });
    } else { fallbackCopy(text, ok); }
  });
  function fallbackCopy(text, cb) {
    try {
      var ta = document.createElement("textarea");
      ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      document.execCommand("copy"); document.body.removeChild(ta); cb();
    } catch (e) {}
  }

  /* ── reading progress — hairline across the top of the column, tracking how
     far through the thread you've scrolled; hidden unless it overflows ── */
  (function () {
    var bar = $("readProgress"), fill = $("readProgressFill"), th = $("thread");
    if (!bar || !fill || !th) return;
    var raf = null;
    function paint() {
      raf = null;
      var max = th.scrollHeight - th.clientHeight;
      if (max < 240) { bar.classList.remove("on"); return; }
      bar.classList.add("on");
      fill.style.width = Math.min(100, (th.scrollTop / max) * 100) + "%";
    }
    function onScroll() { if (!raf) raf = requestAnimationFrame(paint); }
    th.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    new MutationObserver(onScroll).observe(th, { childList: true, subtree: true });
    paint();
  })();

  /* ── entry: ?q= from landing, #plans deep link ── */
  var params = new URLSearchParams(location.search);
  var q = (params.get("q") || "").trim();
  if (q) history.replaceState(null, "", location.pathname);

  /* ── boot: hydrate from the server (if signed in), then paint ── */
  renderAll();                       // instant paint from local store
  restoreDraft();                    // an unfinished question survives the refresh

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
