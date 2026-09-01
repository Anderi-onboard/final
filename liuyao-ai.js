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

  /* ═══════════ 1b. subjectKey — 问题 → 用神 (deterministic) ═══════════

     WHY THIS EXISTS. CATEGORY_YONGSHEN is a lookup keyed by a category string,
     and chat-app.js passed the literal "general" for every reading — so
     CATEGORY_YONGSHEN["general"] = "self" resolved, every time, to 世爻. Every
     reading this product has produced read the World line as its 用神, whatever
     was asked, and 原神/忌神/仇神 were derived from that anchor. The reading is
     then told 「用神 = 世爻」 as an authoritative fact and does what it is told.
     Measured on a live reading 2026-08-27: 「我明天考科目一能过吗」 came out
     anchored on 世, never named a 用神, and read 父母 — the exam's own line —
     as background. It said 「能过」. The asker did not pass.

     Twenty-five of CATEGORY_YONGSHEN's twenty-eight keys were unreachable,
     including exam:"parent", which is the correct answer for that question.

     WHAT THIS IS. 增删卜易's own 用神 table, executable: the subject of the
     question picks the line, not the route. Routes choose which prose loads;
     they are a different taxonomy and a coarser one (nine entries against the
     book's dozens), and using one for the other is what produced the silent
     fallback.

     Some 事类 take TWO 用神 and fail if either is weak — 考试 is the one that
     bit us: 官鬼 is the placement, 父母 is the paper, and 子孙 is 剥官之神. The
     role network is derived from `key`; `second` and `note` ride along so the
     reading sees the other half.

     The fallback is still 世爻 — that is correct for 自占 — but it is now
     REPORTED (`matched:false`) instead of silent. A default that cannot be
     told apart from a decision is how this went unnoticed for the life of the
     product. */
  var SUBJECT_RULES = [
    { key:"parent",  second:"officer", why:"考试:官鬼为名次录取,父母为成绩卷子;子孙为剥官之神",
      re:/考试|考试|应试|科目[一二三四]|科一|科二|科三|科四|笔试|面试|复试|初试|统考|高考|中考|考研|考公|考编|考证|驾照|科举|功名|录取|上岸|过不过|能不能过|exam|test|admission|entrance/i },
    { key:"officer", second:null, why:"功名工作升迁:官鬼为职位、上头、竞争的那一头",
      re:/工作|求职|职位|升迁|升职|offer|跳槽|辞职|离职|裸辞|调岗|官司|诉讼|打官司|案子|仕途|career|promotion|lawsuit|resign|job/i },
    { key:"wealth",  second:null, why:"求财生意:妻财为财本",
      re:/求财|赚钱|挣钱|生意|买卖|投资|股票|收入|工资|财运|开店|囤货|放债|借钱|business|money|invest|profit/i },
    { key:"officer", second:null, why:"疾病:官鬼为忧神,子孙为解忧之神(近病久病断法相反)",
      re:/病|生病|疾病|得了|治疗|手术|住院|大夫|医生|吃药|illness|sick|disease|surgery/i },
    { key:"wealth",  second:null, why:"男占婚恋:妻财为对方",
      re:/我女朋友|我老婆|我妻子|追女|娶|女方/i },
    { key:"officer", second:null, why:"女占婚恋:官鬼为对方",
      re:/我男朋友|我老公|我丈夫|嫁|男方|他会不会|他是不是/i },
    { key:"output",  second:null, why:"子女、宠物、解厄:子孙",
      re:/孩子|小孩|儿子|女儿|怀孕|怀上|备孕|生育|胎|宠物|猫|狗|children|pregnan|baby/i },
    { key:"parent",  second:null, why:"房屋车船文书合同长辈:父母",
      re:/房|买房|租房|房产|搬家|买车|合同|签约|文书|证书|执照|学业|上学|留学|父母|长辈|house|contract|document|lease/i },
    { key:"peer",    second:null, why:"同行、合伙、竞争、分我之利者:兄弟",
      re:/合伙|合作|同事|同行|竞争|对手|分成|拆伙|partner|competitor/i }
  ];

  /* Returns { key, second, why, matched }. `matched:false` means nothing in the
     wording named a subject, so 世爻 stands in — a real answer for 自占, and a
     flag everywhere else. */
  function subjectKey(question){
    var q = String(question || "");
    for (var i=0;i<SUBJECT_RULES.length;i++){
      var r = SUBJECT_RULES[i];
      if (r.re.test(q)) return { key:r.key, second:r.second, why:r.why, matched:true };
    }
    return { key:"self", second:null, why:"问题没有点出别的主体,按自占取世爻", matched:false };
  }

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
      /* ORDER MATTERS. Every flag here describes THIS line, except the ones
         about the transform — so the transform goes LAST, after which anything
         may be read as belonging to it. "MOVING→Fire Snake (Output)" used to be
         pushed FIRST and the line's own "void" second, producing the string
         "MOVING→Fire Snake (Output) void" — which reads, correctly and wrongly,
         as "the Fire Snake is void". A live reading took it that way and built
         a section and a timing claim on a Snake that was never void; the void
         belonged to the Rat it transformed FROM. The engine already knows the
         difference (transform.backToVoid), so state it rather than leave the
         reader to infer it from word order. */
      var flags = [];
      if (l.marker) flags.push(l.marker==="self"?"World":"Response");
      if (l.void) flags.push("void");
      if (l.dayClash) flags.push("day-clash");
      /* "day-bind" sat next to "month-break" and got read as its twin: two live
         readings of this board in a row summarised 日合 + 月破 as "日破月破,
         双破", then explained 亥合寅 correctly a paragraph later. A bind is the
         opposite of a break — it holds a line still rather than wrecking it —
         so the token says which it is instead of relying on the reader to know
         that "bind" is not a kind of breaking. */
      if (l.dayCombine) flags.push("day-combine(held-not-broken)");
      if (l.monthClash) flags.push("month-break");
      if (l.dayTomb) flags.push("enters-day-tomb");
      /* THE TWO CLOCKS GENERATE AND CONTROL, and that was not being sent.
         月建 and 日辰 are the first two of 增删卜易's 四处生克源头 — the book
         judges every 旺衰 verdict from them — and the engine computes all four
         booleans per line. distill() carried the clash and the combine and
         dropped the generate/control silently. Measured on the 2026-08-27
         board: the fifth line's flags came out as the EMPTY STRING while the
         engine had it generated by the month, and four of six lines lost a
         clock relation. The reading then had to infer 旺衰 from the branch
         names, which is the identification-error class this whole layer exists
         to remove. */
      if (l.monthGenerates) flags.push("month-feeds");
      if (l.monthControls) flags.push("month-controls");
      if (l.dayGenerates) flags.push("day-feeds");
      if (l.dayControls) flags.push("day-controls");
      if (l.fanyin) flags.push("reversal");
      if (l.fuyin) flags.push("locked");
      if (l.moving) {
        flags.push("MOVING→"+(l.transform?(l.transform.element.en+" "+l.transform.branch.animal+" ("+l.transform.relative.en+" "+l.transform.relative.cn+")"):""));
        if (l.transform) {
          // said explicitly, because "void" after a transform is ambiguous
          flags.push(l.transform.backToVoid ? "transform-is-void" : "transform-not-void");
          if (l.transform.jinTui) flags.push(l.transform.jinTui.en);
          if (l.transform.clashBen) flags.push("transform-clashes-back");
          if (l.transform.feedsBen) flags.push("transform-feeds-back");
          if (l.transform.controlsBen) flags.push("transform-controls-back");
          if (l.transform.backToTomb) flags.push("transform-entombs-back");
        }
      }
      /* The 六亲 goes out with its Chinese name attached. The English names are
         glosses, not translations — "Pressure" is 官鬼 and "Peer" is 兄弟 — and
         a reading written in Chinese has to get back to the glyph before it can
         use the term. A live reading made exactly that trip and landed wrong,
         calling the hidden 官鬼酉金 "兄弟酉金": plausible, because for a wealth
         question the drainer and the wealth-divider both take from the subject,
         and irrecoverable, because 官鬼 and 兄弟 mean different things to the
         person reading. Ship both names and there is no trip to make. */
      return {
        line: l.idx+1,
        relative: l.relative.en+" ("+l.relative.cn+")",
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
    /* ── 伏神 roster ────────────────────────────────────────────────────────
       Every 六亲 missing from the six lines lies hidden under a flying line,
       and the block above reports that ONLY when the missing one happens to be
       the 用神. That is too narrow by exactly the case that decides most
       boards: when the 原神 is the one off the board, the subject has no
       visible source at all, and whether it can surface IS the answer.

       Measured on a live reading. Wealth question, 用神 妻财 present on two
       lines, so nothing here fired — while 子孙 (its only generator; the board
       held no Fire whatsoever) sat hidden under the single moving line, and
       官鬼 sat hidden under the other 妻财. The model was handed a subject with
       no source and never told the source existed. It reconstructed 子孙 from
       the transform target alone and missed that the same branch was also the
       hidden one underneath — which is the whole 出伏 story.

       So: report them all, each with the role it plays for THIS question, and
       with the facts that decide 出伏 — including two the per-line flags cannot
       carry, because they are relations between a line and something not on it:
       a void or moving flying line loosens its grip, and a moving line that
       transforms into the very branch hidden beneath it is that branch coming
       out. Judgement stays with the model; these are its inputs. */
    var elRole = function (gi) {
      var e = roles.elements || {};
      var k = gi===e.yong?"yong":gi===e.yuan?"yuan":gi===e.ji?"ji":gi===e.chou?"chou":"drain";
      return (roles.info && roles.info[k]) ? roles.info[k].en + " — " + roles.info[k].desc : k;
    };
    var hiddenAll = (board.hidden || []).map(function (h) {
      var fly = board.lines[h.position];
      var notes = [];
      if (h.flyGeneratesHidden) notes.push("flying line feeds it (helps it surface)");
      if (h.hiddenControlsFly) notes.push("it controls the flying line (can surface)");
      if (h.flyControlsHidden) notes.push("flying line controls it (suppressed)");
      if (fly && fly.void) notes.push("flying line is VOID — a void flying line lets the hidden one surface");
      if (fly && fly.moving) notes.push("flying line is MOVING");
      if (fly && fly.moving && fly.transform && fly.transform.branch.bi === h.hiddenBranch.bi) {
        /* Name the branch rather than pointing at it. "THIS VERY BRANCH" was
           an abstract term with no ready Chinese equivalent, and a live Chinese
           reading carried the bare word across: "还正好变成这个branch". A
           concrete name has an obvious translation and nothing to borrow. */
        notes.push("the flying line transforms into " + h.hiddenBranch.el.en + " " + h.hiddenBranch.animal
          + " (" + h.hiddenBranch.cn + ") — the same one hidden beneath it, so the line that covers it "
          + "is itself bringing it out");
      }
      return h.relative.en + " (" + h.relative.cn + ") " + h.hiddenBranch.el.en + " " + h.hiddenBranch.animal +
        " hidden under line " + (h.position + 1) +
        " [role here: " + elRole(h.hiddenBranch.el.gi) + "]" +
        "; flying line: " + h.flyingRelative.en + " (" + h.flyingRelative.cn + ") " + h.flyingBranch.el.en + " " + h.flyingBranch.animal +
        (notes.length ? "; " + notes.join("; ") : "; no direct fly/hidden feed or control") +
        " — rule on can-surface(出伏) vs stays-trapped(伏而不出), weighing month/day";
    });
    var hiddenStr = hiddenAll.length
      ? hiddenAll.join("  ||  ")
      : "none — all six relatives appear among the lines";

    // 三合局 — elemental blocs formed by three (or two-plus-peak) line branches
    var sanhe = (board.sanhe || []).map(function (s) {
      return s.type + " " + s.element.en + " bloc on lines " + s.lines.join("/") +
        " (" + s.branches.map(function (b) { return b.animal; }).join("+") +
        (s.type === "half" && s.missing ? ", completes when " + s.missing.animal + " arrives" : "") + ")" +
        (s.hasMoving ? " [contains a moving line — active]" : "");
    }).join("; ") || "none";

    // 月卦身 — a pointer at a line, not a proposition about the matter.
    // This used to ship the folk gloss "no clear subject/anchor yet" attached to
    // 卦身不上卦, so every reading inherited a conclusion the board cannot carry:
    // 卦身 is absent in 33 of the 64 hexagrams, and whether it lands is fully
    // determined by the figure the model was already given, so its absence adds
    // nothing to what the figure already said. Ship the fact, never the gloss.
    var gs = board.guashen;
    var guashen = gs
      ? (gs.branch.el.en + " " + gs.branch.animal + (gs.onBoard
          ? (" — on line " + gs.lines.join("/") + " (卦身上卦: it annotates that line; if that is the yongshen, say so)")
          : " — not among the six line branches (卦身不上卦). Structural, and true of half the 64 hexagrams: it licenses no conclusion about the matter or the asker. Do not mention it."))
      : "n/a";

    return {
      date: board.meta.date + (board.meta.dateAuthoritative?"":" (approx)"),
      sanhe: sanhe,
      guashen: guashen,
      dayBranch: board.meta.dayPillar.branch.animal+" ("+board.meta.dayPillar.el.en+")",
      monthElement: board.meta.monthBranch.el.en,
      voidBranches: board.meta.xunkong.map(function(b){return b.animal;}).join(", "),
      /* Trigram, palace and series ship with their glyphs, for the same reason
         the 六亲 do: the English is a gloss, and a Chinese reading that has to
         translate one back can translate it wrong. "Wind Palace" came out as
         「风宫」 in a live reading — 风 is the image, 巽 is the palace, and 风宫
         is not a thing. The glyph removes the guess. */
      primary: (board.ben.name||"")+" — "+board.ben.upper.en+"("+board.ben.upper.cn+") over "+board.ben.lower.en+"("+board.ben.lower.cn+") · "+board.ben.palace.en+"("+board.ben.palace.cn+") "+board.ben.series.en+"("+board.ben.series.cn+")"+(board.ben.clash?" · Clashing":board.ben.combine?" · Combining":""),
      transformed: board.bian ? (board.bian.name||"")+" — "+board.bian.upper.en+"("+board.bian.upper.cn+") over "+board.bian.lower.en+"("+board.bian.lower.cn+")"+(board.bian.clash?" · Clashing":board.bian.combine?" · Combining":"") : "none (still figure)",
      worldElement: board.lines[board.ben.worldLi].element.en,
      yongshen: yongStr,
      hidden: hiddenStr,
      lines: L
    };
  }

  // The user drops THEIR divination prompt into USER_PROMPT below. The protocol
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
    // branch YEARS — the same 12 branches also name years ((y-4)%12 = branch
    // index; boundary at Lichun, ~Feb 4). Long-horizon questions ("someday /
    // in the future / after I graduate") must anchor on THIS scale, not on
    // day/month windows.
    var years = [];
    var curY = base.getUTCFullYear();
    for (var yb = 0; yb < 12; yb++){
      var off = (yb - ((curY - 4) % 12) + 12) % 12; if (off === 0) off = 12; // next, never the current year
      var y1 = curY + off;
      years.push(brRefName(yb) + "=" + y1 + " then " + (y1 + 12));
    }
    return [
      "TIMING REFERENCE (Gregorian, computed from the casting date " + (m.date || "") + " — quote these, never recalculate):",
      "Branch-month windows (solar, next from casting): " + months.join(" · "),
      (days.length ? "Branch DAYS repeat every 12 days; next occurrences: " + days.join(" · ") : ""),
      "Branch YEARS (next two occurrences; year boundary at Lichun, ~Feb 4): " + years.join(" · "),
      "RULE: whenever timing rests on a branch, attach Gregorian anchors from this table AT THE SCALE THE QUESTION ASKS. Near-term question (“this month / lately”) → the 2–3 nearest branch-day dates, then the branch-month window (e.g. “the next Shen days: Aug 8, then Aug 20; failing those, the Shen month, Aug 8–Sep 7”). LONG-HORIZON question (“以后 / someday / years out”) → the branch's next YEAR-occurrences (e.g. “the next Yin year: 2034, then 2046”), NEVER this month's dates. A bare branch name as timing is a defect; so is a near-term date pasted onto a years-out question."
    ].filter(Boolean).join("\n");
  }

  function buildMessages(board, roles, question, category, gender, lang, subject){
    var schema = [
      "Return ONLY valid minified JSON, no prose, with EXACTLY these keys:",
      '{',
      '"yongshenKey": one of parent|peer|output|wealth|officer|self,',
      '"yongshenReason": "<=20 words, why this 用神 fits the question",',
      '"strength": "strong"|"weak"|"mixed",',
      '"keyLines": [{"line":1-6,"note":"<=16 words"}],  // the 2-3 lines that decide it',
      '"verdict": "favorable"|"unfavorable"|"mixed"|"unclear",',
      '"timing": "<=18 words 应期 WITH Gregorian anchors from TIMING REFERENCE at the scale the question asks (near → day/month dates; 以后/long-horizon → branch YEARS, e.g. next Yin year 2034); or empty",',
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
      (subject && subject.matched
        ? ("用神 · CHOSEN FROM THE QUESTION: " + (YONGSHEN_INFO[subject.key] ? YONGSHEN_INFO[subject.key].cn : subject.key)
           + (subject.second ? (" + " + (YONGSHEN_INFO[subject.second] ? YONGSHEN_INFO[subject.second].cn : subject.second)
              + " — BOTH are 用神 here; if either one is weak the matter fails") : "")
           + "  (" + (subject.why || "") + ")"
           + "  · Say which line you are reading and why, in the reading itself.")
        : ("用神 · NOT NAMED BY THE QUESTION — falling back to 世爻 (自占). "
           + "This is a DEFAULT, not a finding: if the wording does point at a subject, read that line instead and say so.")),
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
    var board = opts.board, question = opts.question||"";
    // The subject is read off the question unless a caller names a category.
    var subject = subjectKey(question);
    var category = opts.category || subject.key;
    var gender = opts.gender||"", lang = opts.lang||"en";
    // provisional 用神 from category, so the board can paint roles immediately
    var priorKey = (opts.category && CATEGORY_YONGSHEN[opts.category]) || subject.key || "self";
    var roles = deriveRoles(board, priorKey);

    var hasClaude = (typeof window!=="undefined" && window.claude && typeof window.claude.complete==="function");
    if (!hasClaude || opts.mock){
      return Promise.resolve(mockReading(board, roles, question, category, lang));
    }

    var built = buildMessages(board, roles, question, category, gender, lang, subject);
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
    subjectKey: subjectKey,
    SUBJECT_RULES: SUBJECT_RULES,
    interpret: interpret,
    buildMessages: buildMessages,   // exposed so the user can inspect/replace the prompt
    CATEGORY_YONGSHEN: CATEGORY_YONGSHEN,
    YONGSHEN_INFO: YONGSHEN_INFO,
    setUserPrompt: function(p){ USER_PROMPT = p||""; }
  };
})();
