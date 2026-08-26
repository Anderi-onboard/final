/* prompt-checks.js — the parts of the old prompt engine that are safe in a browser.
   ─────────────────────────────────────────────────────────────────────────────
   prompt-engine.js moved to functions/_lib/ because every segment in it is a
   trade secret and the browser was also POSTing the assembled prompt up for the
   API to run verbatim. These three functions came back out: they are pure
   validation code, they contain no instruction text, and they read the reading
   AFTER it arrives — nothing here tells a model what to do.

     checkBoardFacts   does the prose contradict the computed board?
     checkReadability  does the prose trip the readability heuristics?
     boardCarries      helper — does the board actually carry this signal?

   Anything with prompt text in it belongs on the server. If you find yourself
   wanting a SEGMENT here, that is the signal to add a server route instead.
*/
(function () {
  "use strict";

  function checkBoardFacts(reading, board) {
      if (!board || !board.lines) return { ok: true, issues: [] };
      var text = String(reading || "");
      var issues = [];
      var wordNum = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };

      var movingCount = 0;
      board.lines.forEach(function (l) { if (l.moving) movingCount++; });

      var lineRe = /\b(?:line)\s+([0-9]+|one|two|three|four|five|six)\b/gi;
      var m;
      while ((m = lineRe.exec(text))) {
        var raw = m[1].toLowerCase();
        var n = wordNum[raw] != null ? wordNum[raw] : parseInt(raw, 10);
        if (n < 1 || n > 6) issues.push('cites "line ' + raw + '" — a hexagram only has 6 lines');
      }

      var countRe = /\b(one|two|three|four|five|six|\d)\s+moving\s+lines?\b/i;
      var cm = text.match(countRe);
      if (cm) {
        var claimed = wordNum[cm[1].toLowerCase()] != null ? wordNum[cm[1].toLowerCase()] : parseInt(cm[1], 10);
        if (claimed !== movingCount) {
          issues.push("says " + claimed + " moving line(s) but the board actually has " + movingCount);
        }
      }

      return { ok: issues.length === 0, issues: issues };
    }


  /* ── the four names checkReadability() needs ───────────────────────────────
     These were referenced here but defined only in functions/_lib/prompt-engine.js.
     When the checks were split out of the engine, the code came and the constants
     did not, so checkReadability() threw ReferenceError on its second line — on
     EVERY reading. The throw landed in routedReading's catch, became an error
     with no HTTP status, and rendered through castFail's generic copy: a reading
     that had streamed completely was replaced by a note about the reader's
     balance, and the text was deleted. Measured on production 2026-08-24.

     They are detection patterns, not instructions — no segment text, nothing
     that would reconstruct a prompt. That is the same test the rest of this
     file already passes. */
  var YONGSHEN_NAMED = /用神|妻财|官鬼|父母|子孙|兄弟|yongshen|yong shen|Response line|World line|世爻|应爻/i;
  var REFUSAL = /(读不出来|解不了|无法解读|不能解读|算不出|这个卦答不了|超出.{0,6}(范围|能力)|not something (?:the|this) (?:method|system) can|cannot be read|can'?t be read|beyond what (?:the|this) method|no way to read)/i;
  // The limits that are real. A refusal citing one of these is honest; a refusal
  // citing none of them is discomfort in disguise. (Naming the server-side
  // structure this list mirrors would put engine vocabulary in a browser file,
  // which prompt-secrecy.mjs forbids and is right to.)
  var REAL_LIMIT = /(分辨率|没有这种精度|目录|清单|查资料|不是起卦|resolution|catalogue|catalog|a lookup|not a divination question|no yongshen|没有对应的用神)/i;

  /* checkGrowthAnchored's own patterns, same story as the three above:
     referenced here, defined only in the engine. */
  // Inventing a psychological history for a category of strangers. Structurally
  // clean to spot: a type-word next to a past-experience or causal-origin verb.
  // What an arrangement DOES is describable; how people came to it is not.
  var INVENTED_PAST = /((?:这|那)(?:种|类)人(?:多半|大多|往往|通常|一般)?(?:都)?(?:是|曾|经历|见过|吃过|受过|走过|试过)|(?:多半|大多|往往|通常)是(?:见过|经历过|吃过|受过|试过)|(?:有(?:的|些)人|这(?:种|类)人)之所以[^。！？\n]{0,30}(?:是因为|因为)|people like (?:this|these|that)[^.!?\n]{0,40}(?:been through|been the|have seen|learned it|come from|grew up)|they (?:have all|usually|typically)[^.!?\n]{0,20}(?:been through|seen it|learned))/i;
  // Gesturing at a kind of person and walking straight past. Not a banned phrase
  // — the phrase is fine, the abandonment is the defect — so this checks for the
  // thing that proves the door was walked through: the cost. A way of living
  // described without its price is advertising. Scoped to the paragraph, since
  // the shape is claim-then-elaborate across a few sentences.
  var TYPE_CLAIM = /(有(?:的|些)?人(?:一辈子|一生)?(?:要|求|想要|图|追求)的就是|有(?:的|些)人(?:天生|本来)就|这(?:种|类)人(?:一辈子|一生)|some people (?:spend their (?:life|lives)|just want|are simply))/i;
  var COST_NAMED = /(代价|换来的|换的是|放弃|舍(?:掉|弃)|付出的是|不要的是|失去|让出|牺牲|拿.{0,6}换|costs?|price|gives? up|trades? away|in exchange for|what (?:they|you) lose|sacrific)/i;
  var COMFORT = /(相信自己|顺其自然|一切都会好|保持好心态|放平心态|时间会给你答案|未来可期|水到渠成|平常心|随缘|trust yourself|it will all work out|time will tell|stay positive|keep an open heart)/i;
  var ANCHORED = /(爻|卦|世|应|用神|旬空|入墓|三合|半合|六冲|六合|生|克|旺|休|囚|死|动|伏|line|yongshen|void|clash|frame)/i;
  // Preaching has a tell, and it is grammatical: the subject stops being this
  // person's situation and becomes people in general. Cheap to spot, and it
  // catches sermons that use no comfort-word at all.
  var SERMON = /(人生(?:就是|就像|总是|中)|每个人都|我们都(?:需要|应该|要)|要学会|重要的是要|人这一辈子|活在当下|做最好的自己|in life,? we|everyone (?:needs|must|should)|what matters most is to|learn to embrace)/i;
  // Cheerleading, and the maxim-as-payload that travels with it. Unlike 顺其自然
  // — which earns its place the moment a board reason stands next to it — these
  // have no legitimate use in this voice, so they get no anchoring escape.
  // The boundary is one word wide and worth holding: 你能做成 is a plain
  // indicative about this person and passes; 你一定可以的 asks them to feel
  // something and does not. Same in English: "you will do it" stays, "you can
  // do it!" goes.
  var CHEER = /(加油|你一定(?:可以|行|能|会)|相信你(?:可以|能|行)|你可以的|不要放弃|别放弃|坚持就是胜利|只要坚持|终(?:会|将)(?:成功|好起来|如愿)|一切皆有可能|you can do it|believe in yourself|don'?t give up|keep your chin up|stay strong)/i;
  // Restraint said out loud is not restraint — it converts a small silence into a
  // claim about how close the two of you are, from something that has known this
  // person for one question. Note what is deliberately NOT here: 「怎么走是你的
  // 事」 and its kin, which §SAFE-1 requires. Returning the decision faces
  // forward; narrating your own forbearance faces inward.
  var PERFORMED = /(我(?:不会|不|无意|也不)(?:替|帮|代)你(?:说|想|做主|决定|判断)|我(?:不|无意)(?:评判|论断|置评|多说|多问)|这我就不(?:说|问)了|我知道你(?:一定|肯定)|I (?:won'?t|will not|am not going to) (?:speak|decide|judge|choose) for you|I won'?t pretend to know how you)/i;
  // A gap belongs to the matter. Booking it against the person turns a fact into
  // an accusation or an assignment; the board shows neither.
  var CHARGED = /(还需要你(?:去|来)|需要你自己(?:去|来)|得你自己(?:去|来)|这一步得你|你(?:还)?(?:需要|应该|必须)(?:去|自己))/;
  // Overriding what someone told you they want, and calling it insight. The tell
  // is the same every time: the subject is 你 and the predicate asserts their
  // interior. It reads as perceptive and lands as a put-down — it says the wish
  // they actually stated was the lesser one. Rhetorical questions count: a
  // verdict does not stop being a verdict for ending in a question mark.
  var MIND_READ = /(你(?:真正|其实|骨子里|内心深处)(?:想要|想的|要的|需要|怕的|害怕|在意)|你要的(?:其实)?不是.{0,16}(?:而是|是)|你(?:真正|其实)想问的是|表面上.{0,10}实际上你|what you (?:really|actually|truly) (?:want|need|fear|mean)|you'?re (?:really|actually) (?:afraid|asking|looking for)|deep down (?:you|what you))/i;

  function checkGrowthAnchored(reading) {
    var issues = [];
    String(reading || "").split(/\n{2,}/).forEach(function (para) {
      if (INVENTED_PAST.test(para)) {
        issues.push('invents a history for strangers: "' + para.trim().slice(0, 40) +
          '" — describe what the arrangement DOES, never how people came to it; you do not know');
      }
      if (TYPE_CLAIM.test(para) && !COST_NAMED.test(para)) {
        issues.push('opened a door and walked past it: "' + para.trim().slice(0, 40) +
          '" — naming a kind of person owes their actual shape, and what it COSTS them is the test');
      }
    });
    // sentence-ish units, in both scripts
    String(reading || "").split(/(?:[。！？；\n]|(?<=[.!?])\s)+/).forEach(function (sent) {
      if (COMFORT.test(sent) && !ANCHORED.test(sent)) {
        issues.push('unanchored comfort: "' + sent.trim().slice(0, 40) + '" — say what on the board asks this, or cut it');
      }
      if (SERMON.test(sent)) {
        issues.push('preaching: "' + sent.trim().slice(0, 40) + '" — the subject is people in general; ' +
          'put this reader\'s actual situation back in the subject position');
      }
      if (CHEER.test(sent)) {
        issues.push('cheerleading: "' + sent.trim().slice(0, 40) + '" — it asks them to feel something ' +
          'instead of telling them anything; state it plainly (你能做成) or cut it');
      }
      if (PERFORMED.test(sent)) {
        issues.push('performed restraint or understanding: "' + sent.trim().slice(0, 40) +
          '" — real restraint is invisible; drop the announcement and simply leave it unsaid');
      }
      if (CHARGED.test(sent)) {
        issues.push('books the gap against the reader: "' + sent.trim().slice(0, 40) +
          '" — say what the MATTER still needs (「还需要落实」), not what they owe or must do');
      }
      if (MIND_READ.test(sent)) {
        issues.push('overrides what they said they want: "' + sent.trim().slice(0, 40) + '" — take the ' +
          'stated want at face value and help with THAT; say what the board shows, never what they "really" feel');
      }
    });
    return { ok: issues.length === 0, issues: issues };
  }

  function checkReadability(reading) {
      var text = String(reading || "");
      var issues = [];
      if (text.length > 200 && !YONGSHEN_NAMED.test(text)) {
        issues.push("names no 用神 — every reading must say which line it is reading and why");
      }
      if (REFUSAL.test(text) && !REAL_LIMIT.test(text)) {
        issues.push("declines as unreadable without naming a real limit — if the reason is the " +
          "priority ladder, give THAT reason; unreadability is not a way to decline");
      }
      issues = issues.concat(checkGrowthAnchored(text).issues);
      return { ok: issues.length === 0, issues: issues };
    }

  function boardCarries(board, key) {
      if (!board || !board.lines || !key) return { grade: "firm", why: "" };
      var open = null, i;
      for (i = 0; i < board.lines.length; i++) {
        var l = board.lines[i];
        if (l.relative && l.relative.key === key) { if (!open || (!l.void && open.void)) open = l; }
      }
      var cn = (open && open.relative.cn) || key;
      if (open && !open.void) {
        var caged = open.wangShuai && (open.wangShuai.cn === "死" || open.wangShuai.cn === "囚");
        // A yongshen sitting ON the World line is a real configuration and usually
        // says the matter is in the asker's own hands. But a question about how
        // 世 and 用神 stand TOWARD each other — what she makes of him, what he
        // makes of her — needs two lines to have a relation at all, and here there
        // is only one. Reported so the caller can recast rather than describe a
        // relation the board does not contain.
        var onWorld = board.ben && open.idx === board.ben.worldLi;
        return {
          grade: caged ? "soft" : "firm",
          onWorld: !!onWorld,
          why: caged
            ? cn + " is on the board but " + open.wangShuai.cn + " this month"
            : cn + " sits open on line " + (open.idx + 1) + (onWorld ? " — which is the World line itself" : ""),
          cn: cn
        };
      }
      if (open && open.void) {
        // 旺不为空、动不为空、有生扶不为空. A void line that is strong or moving is
        // 假空 — merely not here yet, and it acts once the period leaves the void
        // or the branch itself arrives. A void line that is ALSO 休囚死 is 真空 and
        // amounts to nothing; reading that as "not yet" is the softer lie.
        var strong = open.wangShuai && (open.wangShuai.cn === "旺" || open.wangShuai.cn === "相");
        // 入局得助 also lifts a line out of 真空, and the frame counts for more when
        // the branch it is missing is supplied by the month or the day. sanhe[].lines
        // is 1-based, matching how a diviner names them.
        var frame = null;
        (board.sanhe || []).forEach(function (f) {
          if (f.lines && f.lines.indexOf(open.idx + 1) >= 0) frame = frame || f;
        });
        var mb = board.meta && board.meta.monthBranch, db = board.meta && board.meta.dayPillar;
        var framePropped = !!(frame && frame.missing && (
          (mb && frame.missing.bi === mb.bi) || (db && db.branch && frame.missing.bi === db.branch.bi)));
        var live = strong || open.moving || !!frame;
        return live
          ? { grade: "soft", onWorld: !!(board.ben && open.idx === board.ben.worldLi),
              why: cn + " is void but " + (strong ? open.wangShuai.cn
                    : open.moving ? "moving"
                    : framePropped ? "held in a " + frame.element.cn + " frame the month or day completes"
                    : "held in a " + frame.element.cn + " frame") +
                    " — 假空, not here yet rather than absent", cn: cn }
          : { grade: "weak", onWorld: !!(board.ben && open.idx === board.ben.worldLi),
              why: cn + " is void AND " + ((open.wangShuai && open.wangShuai.cn) || "weak") + " — 真空, this line amounts to nothing", cn: cn };
      }

      var hid = null;
      for (i = 0; i < (board.hidden || []).length; i++) {
        if (board.hidden[i].relative && board.hidden[i].relative.key === key) hid = board.hidden[i];
      }
      if (!hid) return { grade: "weak", why: cn + " is neither on the board nor hidden behind it", cn: cn };
      cn = (hid.relative && hid.relative.cn) || cn;
      // Hidden is workable until the flying line above it also controls it — then
      // the line is both out of sight and held down, and nothing reliable is left.
      return hid.flyControlsHidden
        ? { grade: "weak", why: cn + " is hidden AND controlled by the line above it", cn: cn }
        : { grade: "soft", why: cn + " is hidden behind the line above it", cn: cn };
    }

  /* The two sub-routers, minus their prompts. `build()` writes instructions, so
     it stayed on the server and /api/claude serves it under role "intent" and
     role "followup"; `read()` and `decide()` only parse what comes back, and
     `decide()` in particular settles a routing call against computed board data
     rather than against anything a model said. Those belong here — running them
     in the browser costs a round trip less and gives away nothing. */
  var INTENT_ROUTER = {
    model: "claude-sonnet-5",
    maxTokens: 8,
    timeoutMs: 4000,
    fallback: "followup",
    read: function (reply) {
      var t = String(reply || "").toUpperCase();
      var m = t.match(/\b(WEALTH|OFFICER|PARENT|OUTPUT|PEER|SELF)\b/);
      return {
        intent: t.indexOf("NEW") >= 0 && t.indexOf("FOLLOWUP") < 0 ? "new" : "followup",
        yongshen: m ? m[1].toLowerCase() : null
      };
    },
    decide: function (parsed, board, carries) {
      var out = (parsed && parsed.intent) || "followup";
      if (out !== "followup" || !parsed || !parsed.yongshen || !board) return { intent: out, reason: "" };
      if (parsed.yongshen === "self") return { intent: out, reason: "" };
      var c = carries(board, parsed.yongshen);
      if (c.grade !== "weak") return { intent: out, reason: "" };
      return { intent: "new", reason: "the previous casting cannot carry this: " + c.why };
    }
  };

  var FOLLOWUP_SUGGEST = {
    model: "claude-sonnet-5",
    maxTokens: 700,
    timeoutMs: 9000,
    count: 6,
    read: function (reply) {
      var out = [];
      String(reply || "").split("\n").forEach(function (raw) {
        var line = raw.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim();
        var bar = line.indexOf("|");
        if (bar < 1) return;
        var label = line.slice(0, bar).trim().replace(/^\*+|\*+$/g, "");
        var prompt = line.slice(bar + 1).trim().replace(/^\*+|\*+$/g, "");
        // A label that ran long is a model that ignored the format, and a prompt
        // too short to be a sentence is a fragment. The floor has to be measured
        // per script: 「这盘能信几分？」 is a whole question in seven characters,
        // while seven characters of English is not yet a phrase.
        var cjk = (prompt.match(/[㐀-䶿一-鿿豈-﫿]/g) || []).length;
        var floor = cjk > prompt.length / 3 ? 5 : 12;
        if (!label || !prompt || label.length > 28 || prompt.length < floor) return;
        out.push([label, prompt]);
      });
      return out.length >= 3 ? out.slice(0, 6) : null;
    }
  };

  /* ── FOLLOW-UP AXES ───────────────────────────────────────────────────────
     A casting answers one matter, but it carries several AXES, and the output
     rules deliberately keep a first reading off the ones that were not asked
     about: "Do NOT hand someone 应期 machinery when they did not ask when. Do
     NOT hand someone a portrait when they asked about money."

     That is why the old follow-up chips did not work. They asked for more of
     the reading just given — "what is the weakest assumption", "where is the
     leverage" — and a reading that did its job has already answered those. The
     better the first reading, the emptier the chip.

     These are different questions of the SAME board, on axes the first reading
     was right to leave alone. Each one routes to a segment set that already
     exists (prompt-engine ROUTES) — the machinery was always there, the
     interface just never offered it.

     Labels and question text are interface copy, not instructions, which is
     why they can live in the browser. The prompts they route into stay on the
     server. */
  var FOLLOWUP_AXES = {
    sortis: [
      { key: "timing",     label: "When",        q: "What is the timing on this? Walk the 应期 down the scales — hour, day, month, year — and say which one you think it is." },
      { key: "other",      label: "Their side",  q: "Read the other party from this same board — what does their side of it look like, and what are they responding to?" },
      { key: "imagery",    label: "What it looks like", q: "Work the 取象 on this board: what does the thing at the centre of this actually look like, in concrete detail?" },
      { key: "quantity",   label: "How many",    q: "How many? Work it from the 用神 branch's 河图 number against its strength, not by counting lines." },
      { key: "review",     label: "Check it back", q: "Something has happened since this casting. Read the board back against it: what did it get right, what did it miss, and what does that change?" }
    ],
    stria: [
      { key: "timing",     label: "When",        q: "What is the timing on this, at the scale the question actually lives on?" },
      { key: "other",      label: "Their side",  q: "Read the other side of this from the same figure — what is it responding to?" },
      { key: "imagery",    label: "What it looks like", q: "Work the imagery on this figure: what does the thing at the centre of it actually look like?" },
      { key: "review",     label: "Check it back", q: "Something has happened since this casting. Read the figure back against it — what held, what did not?" }
    ]
  };


  window.BWPromptChecks = {
    FOLLOWUP_AXES: FOLLOWUP_AXES,
    INTENT_ROUTER: INTENT_ROUTER,
    FOLLOWUP_SUGGEST: FOLLOWUP_SUGGEST,
    checkBoardFacts: checkBoardFacts,
    checkReadability: checkReadability,
    boardCarries: boardCarries
  };
})();
