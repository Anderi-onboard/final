/* liuyao-relations.js — 盘上一切可测的关系,全量算出来。
   ────────────────────────────────────────────────────────────────────────
   为什么单独一个文件:引擎算的是**盘**(纳甲、六亲、旺衰、变爻),这里算的是
   **关系**(谁和谁生克冲合刑害)。两件事,两个所有者。

   ⚠️ 这里只报事实,不报吉凶。「第5爻合第1爻」是事实;「合住了所以名额被绊」
      是断法,断法必须有原文,原文由 owner 给。上一轮我把一条凭记忆的断法
      当成既定事实提议写进裁决梯 —— 那正是这套架构要防的事。所以这个文件里
      一个「吉」「凶」「主」「反主」都不许出现。

   ⚠️ 动静的方向是记录下来的,不是拿来筛的。《增删卜易》§4:动爻能生克静爻,
      静爻不能生克动爻,暗动之爻可以作用。所以每条关系带一个 acts 标记,
      由下游决定认不认 —— 这里不替它决定。

   全量清点(2026-09):速断十二条里有六条今天算不出来,全卡在爻爻关系上。
*/
(function () {
  // 子0 丑1 寅2 卯3 辰4 巳5 午6 未7 申8 酉9 戌10 亥11
  // 木0 火1 土2 金3 水4
  var BR = '子丑寅卯辰巳午未申酉戌亥'.split('');
  var EL = ['木', '火', '土', '金', '水'];

  var gen  = function (a, b) { return (a + 1) % 5 === b; };   // 木生火 火生土 …
  var ctl  = function (a, b) { return (a + 2) % 5 === b; };   // 木克土 土克水 …
  var CLASH = function (a, b) { return (a + 6) % 12 === b; };
  var COMBINE = { 0:1, 1:0, 2:11, 11:2, 3:10, 10:3, 4:9, 9:4, 5:8, 8:5, 6:7, 7:6 };

  // 三刑:寅巳申(无恩)· 丑戌未(恃势)· 子卯(无礼);辰午酉亥自刑
  var XING_TRIOS = [[2, 5, 8], [1, 10, 7]];
  var XING_PAIR  = [[0, 3]];
  var XING_SELF  = [4, 6, 9, 11];
  // 六害(穿):子未 丑午 寅巳 卯辰 申亥 酉戌
  var HARM = { 0:7, 7:0, 1:6, 6:1, 2:5, 5:2, 3:4, 4:3, 8:11, 11:8, 9:10, 10:9 };
  // 三会:寅卯辰木 · 巳午未火 · 申酉戌金 · 亥子丑水
  var HUI = [{ br: [2, 3, 4], el: 0 }, { br: [5, 6, 7], el: 1 },
             { br: [8, 9, 10], el: 3 }, { br: [11, 0, 1], el: 4 }];
  // 墓库(引擎同表):木未 火戌 土戌 金丑 水辰
  var TOMB = [7, 10, 10, 1, 4];

  function pillarBranch(p) { return p && p.branch ? p.branch.bi : null; }

  /* 一个爻对一个外部地支的全部关系。日/月/岁/时共用这一个函数 —— 四处
     source 各写一份是本仓库付过三次学费的那种「第二张名单」。 */
  function vsBranch(line, bi, el, label) {
    if (bi === null || bi === undefined) return [];
    var out = [], g = line.element.gi, b = line.branch.bi;
    if (b === bi)            out.push({ kind: '临',  with: label });
    if (CLASH(b, bi))        out.push({ kind: '冲',  with: label });
    if (COMBINE[b] === bi)   out.push({ kind: '合',  with: label });
    if (HARM[b] === bi)      out.push({ kind: '害',  with: label });
    if (isXing(b, bi))       out.push({ kind: '刑',  with: label });
    if (el !== null && el !== undefined) {
      if (gen(el, g))        out.push({ kind: '受生', with: label });
      if (ctl(el, g))        out.push({ kind: '受克', with: label });
      if (gen(g, el))        out.push({ kind: '生出', with: label });
      if (ctl(g, el))        out.push({ kind: '克出', with: label });
      if (g === el)          out.push({ kind: '比和', with: label });
    }
    if (TOMB[g] === bi)      out.push({ kind: '入墓', with: label });
    return out;
  }

  function isXing(a, b) {
    if (a === b) return XING_SELF.indexOf(a) >= 0;
    for (var i = 0; i < XING_TRIOS.length; i++) {
      var t = XING_TRIOS[i];
      if (t.indexOf(a) >= 0 && t.indexOf(b) >= 0) return true;
    }
    for (var j = 0; j < XING_PAIR.length; j++) {
      var p = XING_PAIR[j];
      if (p.indexOf(a) >= 0 && p.indexOf(b) >= 0) return true;
    }
    return false;
  }

  function compute(board) {
    var L = board.lines, meta = board.meta;
    var dayBr = meta.dayPillar.branch.bi, dayEl = meta.dayPillar.branch.el.gi;
    var monBr = meta.monthBranch.bi, monEl = meta.monthBranch.el.gi;
    var yearBr = pillarBranch(meta.pillars && meta.pillars.year);
    var yearEl = yearBr === null ? null : L[0].branch.el && null;  // 见下,用表取
    var hourBr = (meta.pillars && meta.pillars.hourKnown) ? pillarBranch(meta.pillars.hour) : null;
    var BR_EL = [4, 2, 0, 0, 2, 1, 1, 2, 3, 3, 2, 4];   // 地支→五行,和引擎同表
    yearEl = yearBr === null ? null : BR_EL[yearBr];
    var hourEl = hourBr === null ? null : BR_EL[hourBr];

    /* ── 每爻的状态判定(真假之别,下游要用) ───────────────────────── */
    var state = L.map(function (l) {
      var strong = l.wangShuai.rank >= 3;
      var fed = l.dayGenerates || l.monthGenerates;
      // 暗动:日冲静爻而爻不衰。日破:日冲静爻而爻衰。两者靠旺衰分,不是同一件事。
      var anDong = !l.moving && l.dayClash && (strong || fed);
      var riPo   = !l.moving && l.dayClash && !(strong || fed);
      return {
        line: l.idx + 1,
        旬空: l.void,
        真空: l.void && !l.moving && !strong && !fed,
        假空: l.void && (l.moving || strong || fed),
        月破: l.monthClash,
        真破: l.monthClash && !l.moving && !strong && !fed && l.branch.bi !== dayBr,
        假破: l.monthClash && (l.moving || strong || fed || l.branch.bi === dayBr),
        暗动: anDong,
        日破: riPo,
        日墓: l.dayTomb, 月墓: l.monthTomb,
        动化入墓: !!(l.transform && l.transform.backToTomb),
        动化空: !!(l.transform && l.transform.backToVoid),
        // 随鬼入墓:世爻与官鬼同支或世爻入日月墓且卦中官鬼发动。事实两半都报,
        // 合起来算不算「随鬼入墓」由断法定。
        世爻: l.idx === board.ben.worldLi,
        应爻: l.idx === board.ben.respLi,
        旺衰: l.wangShuai.cn,
        发动: l.moving
      };
    });

    /* ── 爻 ←→ 爻 ─────────────────────────────────────────────────
       有方向的(生/克)和无方向的(合冲刑害比和)分成两张表。

       ⚠️ 第一版把无方向的关系挂在 i<j 那一行上,于是它继承了第 i 爻的 acts ——
          静爻合动爻被标成「不作用」,而**动爻合静爻正是要紧的那一种**。
          合冲刑害是相互的,没有施受;只要有一头能动,这条关系就在场。 */
    var desc = function (k) {
      var l = L[k];
      return l.relative.cn + l.branch.cn + l.element.cn
        + (l.moving ? '(动)' : (state[k].暗动 ? '(暗动)' : ''));
    };
    var canAct = function (k) { return L[k].moving || state[k].暗动; };

    var pairs = [];        // 有方向:谁生谁、谁克谁
    for (var i = 0; i < 6; i++) {
      for (var j = 0; j < 6; j++) {
        if (i === j) continue;
        var ga = L[i].element.gi, gb = L[j].element.gi, rel = [];
        if (gen(ga, gb)) rel.push('生');
        if (ctl(ga, gb)) rel.push('克');
        if (!rel.length) continue;
        pairs.push({ from: i + 1, to: j + 1, fromDesc: desc(i), toDesc: desc(j),
                     kinds: rel, acts: canAct(i) });
      }
    }

    var mutual = [];       // 无方向:合冲刑害比和
    for (var m = 0; m < 6; m++) {
      for (var n = m + 1; n < 6; n++) {
        var bm = L[m].branch.bi, bn = L[n].branch.bi, k2 = [];
        if (L[m].element.gi === L[n].element.gi) k2.push('比和');
        if (CLASH(bm, bn))      k2.push('冲');
        if (COMBINE[bm] === bn) k2.push('合');
        if (HARM[bm] === bn)    k2.push('害');
        if (isXing(bm, bn))     k2.push('刑');
        if (!k2.length) continue;
        mutual.push({ a: m + 1, b: n + 1, aDesc: desc(m), bDesc: desc(n), kinds: k2,
                      // 有一头能动,这条关系就在场;两头皆静则只是并列
                      acts: canAct(m) || canAct(n),
                      mover: canAct(m) ? m + 1 : (canAct(n) ? n + 1 : null) });
      }
    }

    /* ── 变爻:只作用于本位动爻(§4),引擎已经算了,这里只搬过来对齐格式 ── */
    var transforms = [];
    L.forEach(function (l) {
      if (!l.transform) return;
      var t = l.transform, k = [];
      if (t.feedsBen) k.push('回头生');
      if (t.controlsBen) k.push('回头克');
      if (t.clashBen) k.push('回头冲');
      if (t.combineBen) k.push('回头合');
      if (t.jinTui) k.push(t.jinTui);
      if (t.backToTomb) k.push('化入墓');
      if (t.backToVoid) k.push('化空');
      if (t.branch.bi === l.deadBranch.bi) k.push('化绝');
      if (t.relative.key === 'officer' && l.relative.key !== 'officer') k.push('化鬼');
      transforms.push({
        line: l.idx + 1,
        from: l.relative.cn + l.branch.cn + l.element.cn,
        to: t.relative.cn + t.branch.cn + t.element.cn,
        kinds: k
      });
    });

    /* ── 日 / 月 / 太岁 / 时辰 对每一爻 ────────────────────────────── */
    var clock = [];
    L.forEach(function (l) {
      var all = []
        .concat(vsBranch(l, dayBr, dayEl, '日辰' + BR[dayBr]))
        .concat(vsBranch(l, monBr, monEl, '月建' + BR[monBr]))
        .concat(yearBr === null ? [] : vsBranch(l, yearBr, yearEl, '太岁' + BR[yearBr]))
        .concat(hourBr === null ? [] : vsBranch(l, hourBr, hourEl, '时辰' + BR[hourBr]));
      if (all.length) clock.push({ line: l.idx + 1, rels: all });
    });

    /* ── 世应之间 ─────────────────────────────────────────────────── */
    var w = L[board.ben.worldLi], r = L[board.ben.respLi];
    var wr = [];
    if (gen(w.element.gi, r.element.gi)) wr.push('世生应');
    if (ctl(w.element.gi, r.element.gi)) wr.push('世克应');
    if (gen(r.element.gi, w.element.gi)) wr.push('应生世');
    if (ctl(r.element.gi, w.element.gi)) wr.push('应克世');
    if (w.element.gi === r.element.gi)   wr.push('世应比和');
    if (CLASH(w.branch.bi, r.branch.bi)) wr.push('世应相冲');
    if (COMBINE[w.branch.bi] === r.branch.bi) wr.push('世应相合');
    if (HARM[w.branch.bi] === r.branch.bi)    wr.push('世应相害');
    if (isXing(w.branch.bi, r.branch.bi))     wr.push('世应相刑');

    /* ── 三会局(引擎已有三合,这里补三会)────────────────────────── */
    var sanhui = [];
    HUI.forEach(function (h) {
      var hit = [];
      L.forEach(function (l) { if (h.br.indexOf(l.branch.bi) >= 0) hit.push(l); });
      var brs = {};
      hit.forEach(function (l) { brs[l.branch.bi] = 1; });
      var n = Object.keys(brs).length;
      if (n < 2) return;
      sanhui.push({
        type: n === 3 ? 'full' : 'half',
        element: EL[h.el],
        lines: hit.map(function (l) { return l.idx + 1; }),
        missing: n === 3 ? null : h.br.filter(function (b) { return !brs[b]; }).map(function (b) { return BR[b]; }),
        hasMoving: hit.some(function (l) { return l.moving; })
      });
    });

    /* ── 卦级 ─────────────────────────────────────────────────────── */
    var movingN = board.moving.length;
    var shape = {
      动爻数: movingN,
      独发: movingN === 1 ? board.moving[0] + 1 : null,
      独静: movingN === 5 ? (function () {
        for (var k = 0; k < 6; k++) if (board.moving.indexOf(k) < 0) return k + 1;
        return null;
      })() : null,
      尽静: movingN === 0,
      六爻乱动: movingN >= 4,
      六冲卦: board.ben.clash, 六合卦: board.ben.combine,
      变卦六冲: board.bian ? board.bian.clash : null,
      变卦六合: board.bian ? board.bian.combine : null,
      归魂: /归魂/.test(board.ben.series.cn), 游魂: /游魂/.test(board.ben.series.cn),
      反吟: L.some(function (l) { return l.fanyin; }),
      伏吟: L.some(function (l) { return l.fuyin; })
    };

    /* ── 用神多现:同一个六亲出现在几爻 ───────────────────────────── */
    var multi = {};
    L.forEach(function (l) {
      (multi[l.relative.cn] = multi[l.relative.cn] || []).push(l.idx + 1);
    });
    Object.keys(multi).forEach(function (k) { if (multi[k].length < 2) delete multi[k]; });

    /* ── 相生链:a生b、b生c 连起来的路径(接续相生 / 连环相生要用)──────
       只报路径,不说它算什么。长度 ≥3 才收 —— 两爻的生已经在 pairs 里了。 */
    var chains = [];
    var edges = pairs.filter(function (p) { return p.kinds.indexOf('生') >= 0 && p.acts; });
    edges.forEach(function (e1) {
      edges.forEach(function (e2) {
        if (e1.to !== e2.from || e2.to === e1.from) return;
        chains.push({ path: [e1.from, e1.to, e2.to],
                      desc: e1.fromDesc + ' 生 ' + e1.toDesc + ' 生 ' + e2.toDesc });
        edges.forEach(function (e3) {
          if (e2.to !== e3.from || e3.to === e2.from || e3.to === e1.from) return;
          chains.push({ path: [e1.from, e1.to, e2.to, e3.to],
                        desc: e1.fromDesc + ' 生 ' + e1.toDesc + ' 生 ' + e2.toDesc + ' 生 ' + e3.toDesc });
        });
      });
    });

    return {
      state: state,
      pairs: pairs,
      mutual: mutual,
      transforms: transforms,
      clock: clock,
      worldResp: { world: board.ben.worldLi + 1, resp: board.ben.respLi + 1, rels: wr },
      sanhe: board.sanhe || [],
      sanhui: sanhui,
      shape: shape,
      multi: multi,
      chains: chains,
      hidden: board.hidden || []
    };
  }

  var api = { compute: compute };
  if (typeof window !== 'undefined') window.BWRelations = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
