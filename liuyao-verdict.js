/* liuyao-verdict.js — 《增删卜易》断卦裁决,写成代码而不是提示词
   ═══════════════════════════════════════════════════════════════════════════
   window.BWVerdict.judge(board, roles, subject) → 裁决记录

   为什么这是代码不是提示词:
   这套判据里几乎每一条的输入,引擎早就算出来了 —— 回头克是
   `transform.controlsBen`、月破是 `monthClash`、化墓是 `backToTomb`、
   进退神是 `transform.jinTui`、六冲变六冲是 `ben.clash` 与 `bian.clash`。
   两个内行拿同一副盘会算出同一个答案,所以它归代码(CLAUDE.md 那条判据:
   会算出同一个答案的归代码,会分歧且两边都站得住的才归模型)。
   写进提示词等于让模型每一卦重新推导一遍一套它本可以直接读到的结论 ——
   而这一轮已经证明,让模型自己从地支名推关系,推错了没有任何东西会响。

   这个模块只做判定,不写字。它输出:
     · 整条裁决梯每一步的命中与否、依据、涉及哪几爻
     · 定案在第几步(decidedAt),没定案就说没定案
     · 第四步的生克对比是一份计数,不是一个结论
   一个"不知道"必须长得和一个"判定"不一样 —— 这是 subjectKey 的
   `matched:false` 那条规矩的推广。

   ⚠️ 它不许覆盖模型能看见而它看不见的东西。第 1–3 步是硬判据(书上写死的
   否决项),第 4 步只给计数,第 5 步只给应期候选。分量、措辞、以及一切
   要看问题本身的事,仍然归模型。
*/
(function () {
  "use strict";

  var EL_CN = ["木", "火", "土", "金", "水"];
  var BR_CN = ["子","丑","寅","卯","辰","巳","午","未","申","酉","戌","亥"];
  function generates(a, b) { return (a + 1) % 5 === b; }   // a 生 b
  function controls(a, b) { return (a + 2) % 5 === b; }    // a 克 b

  /* 春土 · 夏金 · 秋木 · 冬火 —— 真空的四种。季节按月建地支取:
     春 寅卯辰 · 夏 巳午未 · 秋 申酉戌 · 冬 亥子丑。 */
  function seasonOf(monthBi) {
    if (monthBi >= 2 && monthBi <= 4) return "春";
    if (monthBi >= 5 && monthBi <= 7) return "夏";
    if (monthBi >= 8 && monthBi <= 10) return "秋";
    return "冬";
  }
  var TRUE_VOID_ELEMENT = { "春": 2, "夏": 3, "秋": 0, "冬": 1 }; // 土 金 木 火

  function lineLabel(l) {
    return "第" + (l.idx + 1) + "爻 " + l.relative.cn + l.branch.cn + l.element.cn;
  }

  /* ── 一爻的状态册 ──────────────────────────────────────────────────────
     §1「根基判据」+ §2/§3 里所有落在单爻上的条目。每一项都带上它是从哪个
     引擎字段读来的,所以下一个人能核,不用信这段注释。 */
  function stateOf(board, l) {
    var monthBi = board.meta.monthBranch.bi;
    var dayBi = board.meta.dayPillar.branch.bi;
    var season = seasonOf(monthBi);
    var t = l.transform || null;

    var onDay = (l.branch.bi === dayBi);
    var onMonth = (l.branch.bi === monthBi);
    var fedByClock = !!(l.dayGenerates || l.monthGenerates);
    var hitByClock = !!(l.dayControls || l.monthControls);

    /* 动爻生扶:只数别的动爻,而且只数动爻本身 —— §4「变爻仅能作用于本位
       动爻」,所以变爻不进这个计数。 */
    var fedByMover = false, hitByMover = false;
    board.lines.forEach(function (o) {
      if (!o.moving || o.idx === l.idx) return;
      if (generates(o.element.gi, l.element.gi)) fedByMover = true;
      if (controls(o.element.gi, l.element.gi)) hitByMover = true;
    });

    /* 有根:旺相,或临日月,或得日月生,或得动爻生扶。
       无根:休囚无气 + 月破 + 日克 —— 这一条比「!有根」严,书上是分开写的,
       而且它带着一句很重的话:纵有动爻生扶亦「寒谷不回春」。 */
    var rooted = (l.wangShuai.rank >= 3) || onDay || onMonth || fedByClock || fedByMover;
    var rootless = (l.wangShuai.rank <= 1) && !!l.monthClash && !!l.dayControls;

    /* 真空 vs 假空。假空的三条(动不为空、旺不为空、得生不为空)是或的关系。 */
    var trueVoid = !!l.void && (TRUE_VOID_ELEMENT[season] === l.element.gi)
      && l.wangShuai.rank <= 1 && !l.moving && (hitByClock || hitByMover);
    var falseVoid = !!l.void && (l.moving || l.wangShuai.rank >= 3 || fedByClock || fedByMover);

    /* 到底之破 vs 假破。静而休囚无气又无生助的月破,百无一用。
       ⚠️ 一处判据冲突,已裁,可翻:owner 那份文档把到底之破的条件写成
       「无日月动爻**生助**」,而临日建是「值」不是「生」—— 严格照字面,
       一个临日辰的月破爻会被判成到底之破。但《增删卜易》另有「临日建者不破」,
       日辰是六爻之主宰,值日即为得时。这里按后者,把 onDay/onMonth 计入救。
       要改回字面,把下面两处的 `|| onDay || onMonth` 去掉即可,救与不救
       会在 why 里具名报出,不会静默变化。 */
    var breakRescued = fedByClock || fedByMover || onDay || onMonth || l.wangShuai.rank >= 3;
    var deadBreak = !!l.monthClash && !l.moving && l.wangShuai.rank <= 1 && !breakRescued;
    var falseBreak = !!l.monthClash && (l.moving || breakRescued);
    var breakRescue = !l.monthClash ? null
      : (onDay ? "临日建" : onMonth ? "临月建" : fedByClock ? "得日月生"
        : fedByMover ? "得动爻生扶" : l.wangShuai.rank >= 3 ? "旺相" : null);

    var s = {
      idx: l.idx, label: lineLabel(l), element: l.element.gi, branch: l.branch.bi,
      rank: l.wangShuai.rank, rankCn: l.wangShuai.cn,
      moving: !!l.moving, onDay: onDay, onMonth: onMonth,
      fedByClock: fedByClock, hitByClock: hitByClock,
      fedByMover: fedByMover, hitByMover: hitByMover,
      rooted: rooted, rootless: rootless,
      "void": !!l.void, trueVoid: trueVoid, falseVoid: falseVoid,
      monthBreak: !!l.monthClash, deadBreak: deadBreak, falseBreak: falseBreak, breakRescue: breakRescue,
      tomb: !!l.dayTomb || !!l.monthTomb,
      season: season
    };

    /* §3 的败局项与 §2 的成局项,都只在动爻上成立 —— 它们说的全是「化」。 */
    if (t) {
      s.transform = {
        branch: t.branch.bi, element: t.element.gi, relative: t.relative.key,
        backControls: !!t.controlsBen,                       // 回头克
        backFeeds: !!t.feedsBen,                             // 回头生
        backClashes: !!t.clashBen,                           // 回头冲
        toGhost: (t.relative.key === "officer"),             // 化鬼
        toDead: (l.deadBranch && t.branch.bi === l.deadBranch.bi), // 化绝
        toTomb: !!t.backToTomb,                              // 化墓
        toVoid: !!t.backToVoid,                              // 化空
        advance: !!(t.jinTui && /进/.test(t.jinTui.cn || "")),
        retreat: !!(t.jinTui && /退/.test(t.jinTui.cn || ""))
      };
    }
    return s;
  }

  /* ── §4 第一步:卦变回头克(绝卦)──────────────────────────────────────
     书上的例子全是八纯卦(巽木变乾金、离火变坎水、震木变兑金),说的是整卦
     变出来的五行回头克本卦。落到一般的卦上,读的是内外卦各自的五行。
     ⚠️ 这是全模块唯一一处我在把例子推广成规则,所以它把命中的是哪一宫、
     哪两个五行都报出来,让人能推翻它。命中即定凶,而且不看用神。 */
  function reversalHexagram(board) {
    if (!board.bian) return { fired: false, why: "静卦,无变卦" };
    var hits = [];
    [["下卦", board.ben.lower, board.bian.lower], ["上卦", board.ben.upper, board.bian.upper]]
      .forEach(function (p) {
        var a = p[1].element.gi, b = p[2].element.gi;
        if (controls(b, a)) {
          hits.push(p[0] + " " + p[1].cn + EL_CN[a] + " 变 " + p[2].cn + EL_CN[b]
            + " —— " + EL_CN[b] + "克" + EL_CN[a]);
        }
      });
    return hits.length
      ? { fired: true, why: "卦变回头克(绝卦):" + hits.join(";") + "。不看用神,直断凶。", hits: hits }
      : { fired: false, why: "内外卦变出之五行均不克本卦" };
  }

  /* ── §2 的两条接续判据 ────────────────────────────────────────────────
     贪生忘克:忌神虽动来克,但元神同动而忌神生元神,元神再生用神,转祸为福。 */
  function greedyGeneration(board, els) {
    var jiMoving = board.lines.filter(function (l) { return l.moving && l.element.gi === els.ji; });
    var yuanMoving = board.lines.filter(function (l) { return l.moving && l.element.gi === els.yuan; });
    if (!jiMoving.length || !yuanMoving.length) {
      return { fired: false, why: "忌神与元神未同动" };
    }
    if (!generates(els.ji, els.yuan)) {
      return { fired: false, why: EL_CN[els.ji] + "不生" + EL_CN[els.yuan] + ",不成贪生" };
    }
    return {
      fired: true,
      why: "贪生忘克:忌神" + EL_CN[els.ji] + "与元神" + EL_CN[els.yuan] + "同动,"
        + EL_CN[els.ji] + "生" + EL_CN[els.yuan] + "、" + EL_CN[els.yuan] + "再生用神"
        + EL_CN[els.yong] + ",忌神之力转为生助。",
      lines: jiMoving.concat(yuanMoving).map(function (l) { return l.idx + 1; })
    };
  }

  /* ── §4 第四步:动爻生克力量对比 ──────────────────────────────────────
     这一步**只出计数,不出结论**。生多克少则吉是书上的话,但"多少"要连着
     旺衰和日月一起看,而那是分量判断 —— 分量归模型。 */
  function moverTally(board, yongEl) {
    var feed = [], hit = [], drain = [];
    board.lines.forEach(function (l) {
      if (!l.moving) return;
      if (generates(l.element.gi, yongEl)) feed.push(l.idx + 1);
      else if (controls(l.element.gi, yongEl)) hit.push(l.idx + 1);
      else if (generates(yongEl, l.element.gi)) drain.push(l.idx + 1);
    });
    return { feed: feed, hit: hit, drain: drain,
      why: "动爻生用神 " + feed.length + " 爻" + (feed.length ? "(" + feed.join("、") + ")" : "")
        + ",克用神 " + hit.length + " 爻" + (hit.length ? "(" + hit.join("、") + ")" : "")
        + ",泄用神 " + drain.length + " 爻" + (drain.length ? "(" + drain.join("、") + ")" : "") };
  }

  /* ── §2/§3 的卦级形势 ────────────────────────────────────────────────── */
  function hexagramShape(board) {
    var out = [];
    var b = board.ben, v = board.bian;
    if (b.clash && v && v.clash) out.push({ tag: "六冲变六冲", tone: "凶", why: "内外乱击乱冲,始热终冷、成而后败。" });
    else if (b.combine && v && v.clash) out.push({ tag: "六合变六冲", tone: "凶", why: "先合后离,成而后败。" });
    else if (b.clash && v && v.combine) out.push({ tag: "六冲变六合", tone: "吉", why: "先难后易,散而复聚。" });
    (board.sanhe || []).forEach(function (h) {
      out.push({ tag: "三合" + (h.element && h.element.cn ? h.element.cn : "") + "局",
        tone: "吉", why: (h.note || "三合成局,事体久远坚牢。") });
    });
    if (board.lines.some(function (l) { return l.fanyin; })) {
      out.push({ tag: "反吟", tone: "凶", why: "反吟主反复,到手又变。" });
    }
    if (board.lines.some(function (l) { return l.fuyin; })) {
      out.push({ tag: "伏吟", tone: "凶", why: "伏吟主呻吟难进,原地不动。" });
    }
    return out;
  }

  /* ── 单个用神走一遍裁决梯 ────────────────────────────────────────────── */
  function ladderFor(board, els, yongLines, worldLine, label) {
    var steps = [];
    var decided = null;

    var rev = reversalHexagram(board);
    steps.push({ step: 1, rule: "卦变回头克(绝卦)", fired: rev.fired, tone: rev.fired ? "凶" : null, why: rev.why });
    if (rev.fired) decided = decided || { at: 1, tone: "凶", why: rev.why };

    /* 用神不上卦时,根基读伏神所在的那一爻是读不出来的 —— 伏神的旺衰另有
       断法(出伏)。这里如实报"读不到",不拿飞爻冒充。 */
    /* 世爻常常就是用神那一爻。不去重的话它被数两遍,读起来像两条独立证据 ——
       而这一轮的教训正是"同一件事说两遍不会变成两件事"。 */
    var seen = {}, subjects = [];
    yongLines.concat(worldLine != null ? [worldLine] : []).forEach(function (s) {
      if (s && !seen[s.idx]) { seen[s.idx] = 1; subjects.push(s); }
    });
    var yongAbsent = !yongLines.length;
    if (!subjects.length) {
      steps.push({ step: 2, rule: "用神/世爻有根", fired: false, tone: null,
        why: "用神不上卦(伏神),根基须由出伏断,此梯读不到。" });
    } else {
      var rootlessOnes = subjects.filter(function (s) { return s.rootless; });
      steps.push({ step: 2, rule: "用神/世爻有根", fired: rootlessOnes.length > 0,
        tone: rootlessOnes.length ? "凶" : null,
        /* 用神不上卦时这一步只读到了世爻。不说出来,读的人会以为用神也过了这一关 ——
           静默的默认和一个判定长得一样,这是本仓库反复栽的那个形状。 */
        why: (yongAbsent ? "⚠️ 用神不上卦,此步只读到世爻;用神根基须另由出伏断。" : "")
          + (rootlessOnes.length
            ? "无根:" + rootlessOnes.map(function (s) { return s.label + "(" + s.rankCn + "、月破、日克)"; }).join(";")
              + " —— 纵有动爻生扶亦生之不起。"
            : subjects.map(function (s) {
                return s.label + (s.rooted ? " 有根" : " 未见明生扶,但不足无根之条件");
              }).join(";")),
        lines: rootlessOnes.map(function (s) { return s.idx + 1; }) });
      if (rootlessOnes.length) decided = decided || { at: 2, tone: "凶", why: "用神/世爻无根" };

      var bad = [];
      subjects.forEach(function (s) {
        if (!s.transform) return;
        var f = [];
        if (s.transform.backControls) f.push("化回头克");
        if (s.transform.toGhost) f.push("化鬼");
        if (s.transform.toDead) f.push("化绝");
        if (s.transform.toTomb) f.push("化墓");
        if (s.transform.retreat) f.push("化退神");
        if (f.length) bad.push({ idx: s.idx, label: s.label, flags: f });
      });
      steps.push({ step: 3, rule: "用神/世爻动化凶", fired: bad.length > 0,
        tone: bad.length ? "凶" : null,
        why: bad.length
          ? bad.map(function (b) { return b.label + " " + b.flags.join("、"); }).join(";")
          : "用神/世爻未动化回头克、鬼、绝、墓、退。",
        lines: bad.map(function (b) { return b.idx + 1; }) });
      if (bad.length) decided = decided || { at: 3, tone: "凶", why: "用神/世爻动化凶" };

      var good = [];
      subjects.forEach(function (s) {
        if (!s.transform) return;
        var f = [];
        if (s.transform.backFeeds) f.push("回头生");
        if (s.transform.advance) f.push("化进神");
        if (f.length) good.push(s.label + " " + f.join("、"));
      });
      if (good.length) steps.push({ step: "3+", rule: "动化吉", fired: true, tone: "吉",
        why: good.join(";") + " —— 主势不可挡。" });
    }

    var tally = moverTally(board, els.yong);
    steps.push({ step: 4, rule: "动爻生克对比", fired: true, tone: null, why: tally.why, tally: tally });

    var greedy = greedyGeneration(board, els);
    if (greedy.fired) steps.push({ step: "4+", rule: "贪生忘克", fired: true, tone: "吉", why: greedy.why, lines: greedy.lines });

    /* 第五步只出应期候选,不出吉凶。假空出空于值日/冲之日,假破实破于值日/值月。 */
    var timing = [];
    subjects.forEach(function (s) {
      if (s.falseVoid) timing.push(s.label + " 假空(动/旺/得生),应在出空或冲空之日:" + BR_CN[s.branch] + "日、冲之日");
      if (s.trueVoid) timing.push(s.label + " 真空(" + s.season + s.rankCn + "、静而受克),到底全空");
      if (s.falseBreak) timing.push(s.label + " 月破而有救(" + (s.breakRescue || "动") + "),实破于值日值月:" + BR_CN[s.branch] + "日/月;过月不破");
      if (s.deadBreak) timing.push(s.label + " 到底之破(静、无气、无生助),百无一用");
    });
    steps.push({ step: 5, rule: "假空假破应期", fired: timing.length > 0, tone: null,
      why: timing.length ? timing.join(";") : "无空破待应" });

    return {
      subject: label,
      steps: steps,
      decidedAt: decided ? decided.at : null,
      tone: decided ? decided.tone : null,
      decisive: !!decided,
      note: decided ? decided.why : "前三步无否决项,吉凶落在第四步的分量上 —— 归模型。"
    };
  }

  function judge(board, roles, subject) {
    if (!board || !board.lines || !roles || !roles.elements) return null;
    var els = roles.elements;
    var states = board.lines.map(function (l) { return stateOf(board, l); });

    var yongLines = (roles.yongLines || []).map(function (i) { return states[i]; });
    var world = states[board.ben.worldLi];

    var out = {
      doctrine: "增删卜易 · 断卦裁决梯",
      shape: hexagramShape(board),
      primary: ladderFor(board, els, yongLines, world, "用神 " + EL_CN[els.yong] + " + 世爻"),
      second: null,
      hiddenYong: roles.yongHidden ? {
        why: "用神不上卦,伏于第" + (roles.yongHidden.position + 1) + "爻之下,须先断出伏。",
        flyFeeds: !!roles.yongHidden.flyGeneratesHidden,
        flySuppresses: !!roles.yongHidden.flyControlsHidden,
        hiddenControlsFly: !!roles.yongHidden.hiddenControlsFly
      } : null
    };

    /* 两个用神(功名、考试之类):缺一不可,所以任一为凶即全局为凶。 */
    if (subject && subject.second) {
      // 第二用神的五行从盘上按六亲反查 —— roles 只带得动一个锚。
      var secKey = subject.second;
      var secIdx = [];
      board.lines.forEach(function (l) { if (l.relative.key === secKey) secIdx.push(l.idx); });
      if (secIdx.length) {
        var secEls = { yong: board.lines[secIdx[0]].element.gi };
        secEls.yuan = (secEls.yong + 4) % 5;
        secEls.ji = (secEls.yong + 3) % 5;
        secEls.chou = (secEls.yong + 2) % 5;
        secEls.drain = (secEls.yong + 1) % 5;
        out.second = ladderFor(board, secEls, secIdx.map(function (i) { return states[i]; }), world,
          "第二用神 " + EL_CN[secEls.yong]);
        out.second.note += " 两个用神缺一不可,任一为凶则事不成。";
      }
    }

    var tones = [out.primary.tone, out.second && out.second.tone].filter(Boolean);
    out.verdict = tones.indexOf("凶") >= 0 ? "凶"
      : (out.primary.decisive ? out.primary.tone : "未定 —— 前三步无否决项");
    out.states = states;
    return out;
  }

  var api = { judge: judge, stateOf: stateOf, reversalHexagram: reversalHexagram, EL_CN: EL_CN };
  if (typeof window !== "undefined") window.BWVerdict = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
