/* BourneWise — Liu Yao AI protocol (用神取用 + 综合断卦)
   ────────────────────────────────────────────────────────────────────────
   The DETERMINISTIC board (liuyao-engine.js) carries every fixed-rule fact.
   This layer adds the two INTERPRETIVE pieces a human diviner supplies:
     1. 用神取用 — which 六亲 represents the matter (depends on the QUESTION)
     2. 综合断卦 — the verdict / timing / narrative reading

   Once the 用神 六亲 is chosen, 原神/忌神/仇神 follow by FIXED RULE and are
   derived here (deriveRoles) — the AI never computes those.

   ┌─ CONTRACT ──────────────────────────────────────────────────────────┐
   │ BWLiuYaoAI.deriveRoles(board, yongshenKey) → roleMap  (deterministic) │
   │ BWLiuYaoAI.interpret({board, question, category, gender?, lang?})     │
   │     → Promise<Reading>   (calls window.claude.complete, mock fallback) │
   └──────────────────────────────────────────────────────────────────────┘
   See LIUYAO-AI-PROTOCOL.md for the exact JSON the AI must return. */
(function () {
  "use strict";

  /* ═══════════ 1. 用神 keys & question-category priors ═══════════
     yongshenKey ∈ parent|peer|output|wealth|officer|self
     "self" = the 世爻 itself (used for 决策/出行/综合 where you ARE the subject). */
  var YONGSHEN_INFO = {
    parent:  { cn:"父母", en:"Resource", covers:"elders, home, property, documents, vehicles, study, contracts, news" },
    peer:    { cn:"兄弟", en:"Peer",     covers:"siblings, friends, peers, rivals, partners, shared cost" },
    output:  { cn:"子孙", en:"Output",   covers:"children, juniors, pets, the cure/remedy, ease, joy, what relieves pressure" },
    wealth:  { cn:"妻财", en:"Wealth",   covers:"money, income, assets, a man's wife/lover, what you acquire" },
    officer: { cn:"官鬼", en:"Pressure", covers:"career/post, authority, a woman's husband/lover, illness, threat, lawsuit" },
    self:    { cn:"世爻", en:"Self",     covers:"you, your own standing — for decisions, travel, general outlook" }
  };

  // category → default 用神 key. AI may override per question wording; this is the prior + mock pick.
  var CATEGORY_YONGSHEN = {
    wealth:    "wealth",   money:"wealth", investment:"wealth", business:"wealth",
    career:    "officer",  job:"officer",  promotion:"officer", exam:"parent",   study:"parent",
    marriage:  "officer",  love:"officer", relationship:"officer",
    children:  "output",   pregnancy:"output", health:"officer", illness:"officer",
    family:    "parent",   property:"parent", home:"parent", document:"parent", lawsuit:"officer",
    partner:   "peer",     competition:"peer", cooperation:"peer",
    decision:  "self",     travel:"self",  general:"self", outlook:"self"
  };

  /* ═══════════ 2. deriveRoles — 原神/忌神/仇神 by fixed rule ═══════════ */
  // generating order Wood0 Fire1 Earth2 Metal3 Water4
  function elementOfRelative(selfEl, key){
    // find the single element whose 六亲 (vs selfEl) == key
    for (var e=0;e<5;e++){
      var k;
      if (e===selfEl) k="peer";
      else if ((e+1)%5===selfEl) k="parent";
      else if ((selfEl+1)%5===e) k="output";
      else if ((selfEl+2)%5===e) k="wealth";
      else k="officer";
      if (k===key) return e;
    }
    return selfEl;
  }

  function deriveRoles(board, yongshenKey){
    var selfEl = board.ben.palace.element.gi;
    var worldLi = board.ben.worldLi;
    var yongEl;
    if (yongshenKey === "self") yongEl = board.lines[worldLi].element.gi;
    else yongEl = elementOfRelative(selfEl, yongshenKey);

    var yuanEl = (yongEl+4)%5;   // 原神 生用神
    var jishenEl = (yongEl+3)%5; // 忌神 克用神
    var chouEl = (yongEl+2)%5;   // 仇神 生忌神/克原神
    var drainEl = (yongEl+1)%5;  // 泄神 用神所生 (drains 用神)

    function role(el){
      if (el===yongEl) return "yong";
      if (el===yuanEl) return "yuan";
      if (el===jishenEl) return "ji";
      if (el===chouEl) return "chou";
      return "drain";
    }
    var ROLE_INFO = {
      yong:  { cn:"用神", en:"Subject",  desc:"the matter itself" },
      yuan:  { cn:"原神", en:"Support",  desc:"feeds the subject" },
      ji:    { cn:"忌神", en:"Adversary",desc:"attacks the subject" },
      chou:  { cn:"仇神", en:"Spoiler",  desc:"feeds the adversary" },
      drain: { cn:"泄神", en:"Drain",    desc:"saps the subject" },
      peer:  { cn:"比和", en:"Peer",     desc:"reinforces the subject" }
    };

    var perLine = board.lines.map(function(l){
      var r = role(l.element.gi);
      var isYong = (yongshenKey==="self") ? (l.idx===worldLi) : (r==="yong");
      // self-mode: a same-element line that ISN'T the world line is a 比和 peer, not the subject
      var disp = isYong ? "yong" : (r==="yong" ? "peer" : r);
      return { idx:l.idx, role: disp, roleCn: ROLE_INFO[disp].cn, roleEn: ROLE_INFO[disp].en,
               primaryYong: isYong };
    });

    // 用神 on the board? else point to 伏神
    var yongLines = perLine.filter(function(p){return p.primaryYong;}).map(function(p){return p.idx;});
    var yongHidden = null;
    if (!yongLines.length){
      var h = board.hidden.filter(function(x){
        return (yongshenKey!=="self") && x.relative.key === yongshenKey;
      })[0];
      if (h) yongHidden = h;
    }

    return {
      yongshenKey: yongshenKey,
      yongElement: { gi:yongEl, cn:["木","火","土","金","水"][yongEl], en:["Wood","Fire","Earth","Metal","Water"][yongEl] },
      elements: { yong:yongEl, yuan:yuanEl, ji:jishenEl, chou:chouEl, drain:drainEl },
      info: ROLE_INFO,
      perLine: perLine,
      yongLines: yongLines,
      yongHidden: yongHidden,        // set when 用神 not on the board (伏神)
      worldLi: worldLi
    };
  }

  /* ═══════════ 3. AI prompt assembly ═══════════
     compact, de-noised board the model actually needs to read. */
  function distill(board, roles){
    var perLine = (roles && roles.perLine) || {};
    var L = board.lines.map(function(l){
      var r = perLine[l.idx] || { roleEn: "" };
      var flags = [];
      if (l.moving) flags.push("MOVING→"+(l.transform?(l.transform.element.en+" "+l.transform.branch.animal+" ("+l.transform.relative.en+")"):""));
      if (l.marker) flags.push(l.marker==="self"?"World":"Response");
      if (l.void) flags.push("void");
      if (l.dayClash) flags.push("day-clash");
      if (l.dayCombine) flags.push("day-bind");
      if (l.monthClash) flags.push("month-break");
      if (l.dayTomb) flags.push("enters-day-tomb");
      if (l.transform&&l.transform.jinTui) flags.push(l.transform.jinTui.en);
      if (l.transform&&l.transform.clashBen) flags.push("transform-clashes-back");
      if (l.transform&&l.transform.feedsBen) flags.push("transform-feeds-back");
      if (l.transform&&l.transform.controlsBen) flags.push("transform-controls-back");
      if (l.fanyin) flags.push("reversal");
      if (l.fuyin) flags.push("locked");
      return {
        line: l.idx+1,
        relative: l.relative.en,
        najia: l.element.en+" "+l.branch.animal,
        spirit: l.spirit.en,
        strength: l.wangShuai.en,
        role: r.roleEn,
        flags: flags.join(" ") || "—"
      };
    });
    // When the yongshen is off the board it lies hidden (伏神) under a flying
    // line (飞神). Surface the flying/hidden facts the model needs to rule on
    // whether it can come out (出伏) — otherwise it names 伏神 and stalls.
    var yh = roles.yongHidden, yongStr = roles.yongshenKey + " — " + roles.yongElement.en;
    if (yh) {
      var fh = [];
      if (yh.flyGeneratesHidden) fh.push("flying line feeds it (helps it surface)");
      if (yh.hiddenControlsFly)  fh.push("it controls the flying line (can surface)");
      if (yh.flyControlsHidden)  fh.push("flying line controls it (suppressed)");
      yongStr += " — HIDDEN under line " + (yh.position + 1) +
        ", as " + yh.hiddenBranch.el.en + " " + yh.hiddenBranch.animal +
        "; flying line: " + yh.flyingRelative.en + " " + yh.flyingBranch.el.en + " " + yh.flyingBranch.animal +
        (fh.length ? "; " + fh.join(", ") : "; no direct fly/hidden feed or control") +
        " — must resolve can-surface(出伏) vs stays-trapped(伏而不出), weighing month/day too";
    }
    // 三合局 — elemental blocs formed by three (or two-plus-peak) line branches
    var sanhe = (board.sanhe || []).map(function (s) {
      return s.type + " " + s.element.en + " bloc on lines " + s.lines.join("/") +
        " (" + s.branches.map(function (b) { return b.animal; }).join("+") +
        (s.type === "half" && s.missing ? ", completes when " + s.missing.animal + " arrives" : "") + ")" +
        (s.hasMoving ? " [contains a moving line — active]" : "");
    }).join("; ") || "none";

    // 月卦身 — the body/subject of the matter
    var gs = board.guashen;
    var guashen = gs
      ? (gs.branch.el.en + " " + gs.branch.animal + (gs.onBoard ? (" — on line " + gs.lines.join("/") + " (卦身上卦)") : " — NOT on the board (卦身不上卦: no clear subject/anchor yet)"))
      : "n/a";

    return {
      date: board.meta.date + (board.meta.dateAuthoritative?"":" (approx)"),
      sanhe: sanhe,
      guashen: guashen,
      dayBranch: board.meta.dayPillar.branch.animal+" ("+board.meta.dayPillar.el.en+")",
      monthElement: board.meta.monthBranch.el.en,
      voidBranches: board.meta.xunkong.map(function(b){return b.animal;}).join(", "),
      primary: (board.ben.name||"")+" — "+board.ben.upper.en+" over "+board.ben.lower.en+" · "+board.ben.palace.en+" "+board.ben.series.en+(board.ben.clash?" · Clashing":board.ben.combine?" · Combining":""),
      transformed: board.bian ? (board.bian.name||"")+" — "+board.bian.upper.en+" over "+board.bian.lower.en+(board.bian.clash?" · Clashing":board.bian.combine?" · Combining":"") : "none (still figure)",
      worldElement: board.lines[board.ben.worldLi].element.en,
      yongshen: yongStr,
      lines: L
    };
  }

  // The user drops THEIR reading prompt into USER_PROMPT below. The protocol
  // appends the board + a strict JSON-output contract so parsing never breaks.
  var USER_PROMPT = ""; // ← user's master prompt goes here (or pass opts.systemPrompt)

  /* ── TIMING REFERENCE — deterministic Gregorian translation of branch time ──
     A Western reader cannot use "the Yin month" alone, and branch cycles
     REPEAT (a branch month is a yearly solar window; a branch day recurs
     every 12 days) — so timing must land as concrete, multiple possibilities.
     Computed in JS from the casting date; the model quotes, never calculates. */
  var BR_MONTH_WINDOW = [ // bi → approximate solar-term window [startM,startD,endM,endD]
    [12,7,1,5],[1,6,2,3],[2,4,3,5],[3,6,4,4],[4,5,5,5],[5,6,6,5],
    [6,6,7,6],[7,7,8,7],[8,8,9,7],[9,8,10,7],[10,8,11,6],[11,7,12,6]
  ];
  var BR_REF_PY = ["Zi","Chou","Yin","Mao","Chen","Si","Wu","Wei","Shen","You","Xu","Hai"];
  var BR_REF_AN = ["Rat","Ox","Tiger","Rabbit","Dragon","Snake","Horse","Goat","Monkey","Rooster","Dog","Pig"];
  function brRefName(bi){ return BR_REF_PY[bi] + "(" + BR_REF_AN[bi] + ")"; }
  function timingReference(board){
    var m = board && board.meta; if (!m) return "";
    var base = new Date((m.date || "") + "T12:00:00Z");
    if (isNaN(+base)) base = new Date();
    function fmt(d){ return ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][d.getUTCMonth()] + " " + d.getUTCDate(); }
    var months = [];
    for (var bi = 0; bi < 12; bi++){
      var w = BR_MONTH_WINDOW[bi], y = base.getUTCFullYear();
      var start = new Date(Date.UTC(y, w[0]-1, w[1]));
      var end = new Date(Date.UTC(w[2] < w[0] ? y+1 : y, w[2]-1, w[3]));
      if (end < base){ start = new Date(Date.UTC(y+1, w[0]-1, w[1])); end = new Date(Date.UTC(w[2] < w[0] ? y+2 : y+1, w[2]-1, w[3])); }
      months.push(brRefName(bi) + " ≈ " + fmt(start) + "–" + fmt(end) + " " + end.getUTCFullYear());
    }
    var days = [];
    var dayBi = m.dayPillar && m.dayPillar.branch ? m.dayPillar.branch.bi : null;
    if (dayBi != null){
      for (var b = 0; b < 12; b++){
        var delta = (b - dayBi + 12) % 12; if (delta === 0) delta = 12; // "next", never today
        var d1 = new Date(+base + delta * 86400000);
        var d2 = new Date(+d1 + 12 * 86400000);
        days.push(brRefName(b) + "=" + fmt(d1) + " then " + fmt(d2));
      }
    }
    return [
      "TIMING REFERENCE (Gregorian, computed from the casting date " + (m.date || "") + " — quote these, never recalculate):",
      "Branch-month windows (solar, next from casting): " + months.join(" · "),
      (days.length ? "Branch DAYS repeat every 12 days; next occurrences: " + days.join(" · ") : ""),
      "RULE: whenever timing rests on a branch (X month / X day), attach the Gregorian dates from this table and, because cycles repeat, name the 2–3 nearest concrete possibilities — e.g. “the next Shen days: Aug 8, then Aug 20; failing those, the Shen month, Aug 8–Sep 7”. A bare branch name as timing is a defect."
    ].filter(Boolean).join("\n");
  }

  function buildMessages(board, roles, question, category, gender, lang){
    var schema = [
      "Return ONLY valid minified JSON, no prose, with EXACTLY these keys:",
      '{',
      '"yongshenKey": one of parent|peer|output|wealth|officer|self,',
      '"yongshenReason": "<=20 words, why this 用神 fits the question",',
      '"strength": "strong"|"weak"|"mixed",',
      '"keyLines": [{"line":1-6,"note":"<=16 words"}],  // the 2-3 lines that decide it',
      '"verdict": "favorable"|"unfavorable"|"mixed"|"unclear",',
      '"timing": "<=18 words 应期 WITH Gregorian dates from TIMING REFERENCE, e.g. next Shen days Aug 8 / Aug 20, else Shen month Aug 8-Sep 7; or empty",',
      '"reading": "2-4 sentence answer in '+(lang==="zh"?"Chinese":"English")+', plain, second-person, no jargon dump"',
      '}',
      '',
      (lang==="zh" ? "All values in Chinese." : "Use ONLY English — do NOT put any Chinese characters anywhere in the JSON (no 用神, no branch/element glyphs; use the English names given in the board).")
    ].join("\n");

    var sys = (USER_PROMPT || [
      "You are the BourneWise diviner. You read a fully-computed Liu Yao (六爻) board.",
      "The board's facts (najia, six-relatives, world/response, six-spirits, void, strength,",
      "moving-line transforms, hidden spirits) are ALREADY CORRECT — never recompute them.",
      "Your job: (1) pick the 用神 (subject line) that matches the QUESTION; (2) judge whether",
      "the subject is supported or attacked using strength + the moving lines + day/month;",
      "(3) give a clear, grounded answer. Favor the moving line, the day branch, and the month",
      "as the decisive forces. A void/broken/tomb-bound subject is weak; a thriving subject fed",
      "by its 原神 or by a moving line is strong."
    ].join(" "));

    var user = [
      "QUESTION: "+question,
      "CATEGORY: "+(category||"general")+(gender?(" · asker gender: "+gender):""),
      "Default 用神 prior for this category: "+(CATEGORY_YONGSHEN[category]||"self")+" (override if the wording calls for another).",
      "",
      "BOARD (authoritative facts):",
      JSON.stringify(distill(board, roles)),
      "",
      timingReference(board),
      "",
      schema
    ].join("\n");

    return { system:sys, messages:[{role:"user", content:user}] };
  }

  /* ═══════════ 4. interpret — call Claude, parse, fallback to mock ═══════════ */
  function parseJSON(text){
    if (!text) return null;
    var m = text.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try { return JSON.parse(m[0]); } catch(e){ return null; }
  }

  function interpret(opts){
    opts = opts || {};
    var board = opts.board, question = opts.question||"", category = opts.category||"general";
    var gender = opts.gender||"", lang = opts.lang||"en";
    // provisional 用神 from category, so the board can paint roles immediately
    var priorKey = CATEGORY_YONGSHEN[category] || "self";
    var roles = deriveRoles(board, priorKey);

    var hasClaude = (typeof window!=="undefined" && window.claude && typeof window.claude.complete==="function");
    if (!hasClaude || opts.mock){
      return Promise.resolve(mockReading(board, roles, question, category, lang));
    }

    var built = buildMessages(board, roles, question, category, gender, lang);
    if (opts.systemPrompt) built.system = opts.systemPrompt;

    return window.claude.complete({ product:"sortis", system:built.system, messages:built.messages })
      .then(function(text){
        var out = parseJSON(text);
        if (!out || !out.yongshenKey) return mockReading(board, roles, question, category, lang);
        // re-derive roles from the AI's actual 用神 choice (still deterministic)
        var finalRoles = deriveRoles(board, out.yongshenKey);
        return packReading(board, finalRoles, out, false);
      })
      .catch(function(){ return mockReading(board, roles, question, category, lang); });
  }

  function packReading(board, roles, ai, isMock){
    return {
      source: isMock ? "mock" : "ai",
      yongshenKey: roles.yongshenKey,
      yongshenInfo: YONGSHEN_INFO[roles.yongshenKey],
      roles: roles,                       // role overlay for the board renderer
      yongshenReason: ai.yongshenReason||"",
      strength: ai.strength||"mixed",
      keyLines: ai.keyLines||[],
      verdict: ai.verdict||"unclear",
      timing: ai.timing||"",
      reading: ai.reading||""
    };
  }

  /* deterministic fallback so the experience works with no AI wired ─────────── */
  function mockReading(board, roles, question, category, lang){
    var yongLines = roles.yongLines.length ? roles.yongLines
                  : (roles.yongHidden ? [roles.yongHidden.position] : [roles.worldLi]);
    // crude strength read of the (first) 用神 line
    var li = yongLines[0];
    var L = board.lines[li];
    var rank = L.wangShuai.rank;
    var hits = 0;
    if (L.void) hits--; if (L.monthClash) hits--; if (L.dayClash) hits--;
    if (L.dayGenerates) hits++; if (L.monthGenerates) hits++;
    if (L.dayControls) hits--; if (L.monthControls) hits--;
    if (roles.yongHidden) hits--;
    var score = rank + hits;
    var strength = score>=4 ? "strong" : (score<=1 ? "weak" : "mixed");
    var verdict = strength==="strong" ? "favorable" : strength==="weak" ? "unfavorable" : "mixed";
    var yi = YONGSHEN_INFO[roles.yongshenKey];
    var reading = (lang==="zh")
      ? ("用神取"+yi.cn+"，"+(roles.yongHidden?"伏而不现，":"")+"当前"+L.wangShuai.cn+"，整体"+(verdict==="favorable"?"得力可成":verdict==="unfavorable"?"无力难成":"喜忌交杂、需待时")+"。（占位断语 — 接入 AI 后由模型生成）")
      : ("Subject taken as "+yi.en+" ("+yi.cn+")"+(roles.yongHidden?", hidden beneath its flying line":"")+", currently "+L.wangShuai.en.toLowerCase()+". Overall "+(verdict==="favorable"?"supported — it can come through":verdict==="unfavorable"?"under pressure — forcing it spends you":"mixed — it turns on timing")+". (Placeholder verdict — the AI writes the real reading.)");
    return packReading(board, roles, {
      yongshenReason: (lang==="zh"?"按问题类别取用":"by question category"),
      strength: strength, verdict: verdict,
      keyLines: yongLines.map(function(x){return {line:x+1, note:(lang==="zh"?"用神爻":"subject line")};}),
      timing: "", reading: reading
    }, true);
  }

  window.BWLiuYaoAI = {
    deriveRoles: deriveRoles,
    interpret: interpret,
    buildMessages: buildMessages,   // exposed so the user can inspect/replace the prompt
    CATEGORY_YONGSHEN: CATEGORY_YONGSHEN,
    YONGSHEN_INFO: YONGSHEN_INFO,
    setUserPrompt: function(p){ USER_PROMPT = p||""; }
  };
})();
