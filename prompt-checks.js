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

  window.BWPromptChecks = {
    INTENT_ROUTER: INTENT_ROUTER,
    FOLLOWUP_SUGGEST: FOLLOWUP_SUGGEST,
    checkBoardFacts: checkBoardFacts,
    checkReadability: checkReadability,
    boardCarries: boardCarries
  };
})();
