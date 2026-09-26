/* liuyao-features.js — 盘面事实 → RAG 检索键。
   ────────────────────────────────────────────────────────────────────────
   为什么单独一个文件:引擎算的是**盘**,`liuyao-relations.js` 算的是**关系**,
   这里只做一件事 —— 把它们已经算出来的东西,翻译成那批 RAG 用来路由的 id。

   ⚠️ **这是「第二张要同步的名单」最容易长出来的地方。** 本仓库为它付过三次学费
      (方法页的减半规则、触控热区、断法分区表)。所以:

      · 映射**只在这里**。别处不许再写一份 `旬空 → XUN_EMPTY`。
      · 名单**只有一份**,就是下面的 MAP。`tests/feature-vocab.mjs` 拿 RAG 那边
        实际用到的 id 来对它 —— 卡里引用了这里永远不发的 id,那张卡就是**不可达**的,
        而不可达不会报错,只会让它永远排不上。

   ⚠️ **这里一个断法都没有。** 「旬空」是事实,「旬空所以事无凭据」是断法,断法在卡上。
      这个文件里不许出现吉凶。

   ⚠️ **发出去的只是状态名,不是断法**,所以它可以从浏览器发到服务端 ——
      断法(卡的原文)仍然只在服务端。这条界线不要挪。
*/
(function () {

  /* 恒为真的四个:任何一副盘都有六亲、六神、爻位、卦名。
     ⚠️ 实测后果:TECH-SYMBOLIC 因此**每卦都会被选中**。这是 RAG 那侧的键设计
        问题(拿「盘上有没有六亲」当路由条件,答案永远是有),不是映射的问题。
        照实发,不替它加阈值 —— 替别人的键悄悄加条件,下次谁都查不出来。 */
  var ALWAYS = ["SIX_RELATIVE", "SIX_SPIRIT", "LINE_POSITION", "HEXAGRAM_IMAGE"];

  /* M1 出的那五个:问题层面的事实,盘上读不出来。
     M1 的 `flags=` 用中文写(小模型写中文比写常量名稳),这里翻成 id ——
     ⚠️ 翻译只在这一处。M1 的提示词里**不出现这些 id**,那是程序侧的地址。 */
  var M1_FLAG_MAP = {
    "替人占":       "THIRD_PARTY_DIVINATION",
    "多个人":       "MULTI_ACTOR",
    "指定对象":     "SPECIFIC_TARGET",
    "问时间":       "DATE_TRIGGER",
    "问了不止一件": "MULTI_QUESTION"
  };
  var FROM_M1 = Object.keys(M1_FLAG_MAP).map(function (k) { return M1_FLAG_MAP[k]; });

  /* M1 那一行 `flags=替人占、多个人` → id 数组。`无` / 空 → []。 */
  function fromM1Flags(line) {
    if (!line) return [];
    var body = String(line).replace(/^\s*flags\s*=\s*/, "").trim();
    if (!body || body === "无") return [];
    var out = [];
    body.split(/[、,,;;\s]+/).forEach(function (w) {
      var id = M1_FLAG_MAP[w.trim()];
      if (id && out.indexOf(id) < 0) out.push(id);
    });
    return out;
  }

  /* 是判断不是事实,不该当检索键 —— 记在这儿,不发。 */
  var NOT_A_FACT = ["MULTIPLE_PLAUSIBLE_INTERPRETATIONS"];

  /* ── 每爻状态 → feature。读的是 liuyao-relations.js 的 state 那几个中文字段。
     ⭐⭐ **2026-09-14 补齐:引擎一直在算,这张表没往外发。** 对着补全包的
     `feature_alias_map`(34 条)核了一遍,34 条里有 21 条在这里没有落点 ——
     而**其中绝大多数 `liuyao-relations.js` 早就算出来了**(真空/假空/真破/假破/
     暗动/化空/化绝/回头冲/回头合 全在 state 和 transforms[].kinds 里)。
     也就是说:46 条判据引用的检索键有三分之二找不到地方落,**不是因为引擎读不出来,
     是因为这张映射表短了一截**。一张没同步的映射表不会报错,它只是让下游永远
     检索不到那一类卡 —— 而下游照样有卡可读。

     ⚠️ **真/假要分开发,不能只发「旬空」。** 判据的走向是相反的:真空是
     「这条线死了」,假空是「它还在,只是现在不出面」。合成一个 id,
     就是把两条相反的断法路由到同一批卡上。 */
  var STATE_MAP = [
    { field: "旬空",     id: "XUN_EMPTY" },
    { field: "真空",     id: "TRUE_VOID" },
    { field: "假空",     id: "FALSE_VOID" },
    { field: "月破",     id: "MONTH_BREAK" },
    { field: "真破",     id: "TRUE_BREAK" },
    { field: "假破",     id: "FALSE_BREAK" },
    { field: "日破",     id: "DAY_BREAK" },
    { field: "暗动",     id: "HIDDEN_MOVEMENT" },
    /* ⚠️ 入墓仍然发一个笼统的 ENTER_TOMB,**但三种墓各自也发自己的 id**。
       断法上它们不一样(日墓待冲、月墓待出月、动墓随动爻),只发笼统那个
       等于把三条应期规则压成一条 —— 而 SOP-5 恰恰按这个分尺度。 */
    { field: "日墓",     id: "ENTER_TOMB" },
    { field: "日墓",     id: "DAY_TOMB" },
    { field: "月墓",     id: "ENTER_TOMB" },
    { field: "月墓",     id: "MONTH_TOMB" },
    { field: "动化入墓", id: "ENTER_TOMB" },
    { field: "动化入墓", id: "TRANSFORM_TOMB" },
    { field: "动化空",   id: "TRANSFORM_EMPTY" },
    { field: "发动",     id: "MOVING_LINE" },
    /* ── 2026-09-21 补:下面这几样 relations 一直在算,而这张表发不出去。
       ⚠️ 「算出来了」和「发得出去」是两件事,而且第二件失败时**不报错** ——
          下游只是永远检索不到那一类卡,照样有卡可读。这是本仓库反复付钱的形状,
          补全包 README 已经为另一批记过一次,这是没补完的那一半。 */
    { field: "冲空则实", id: "CLASH_OPENS_VOID" },      // SOP-2.7 日辰冲起旬空
    { field: "动墓",     id: "ENTER_TOMB" },
    { field: "动墓",     id: "MOVING_TOMB" },            // 补全包标 blocked 的三条之一
    { field: "破墓",     id: "TOMB_BROKEN" },            // SOP-3.三墓.破墓
    { field: "月制动爻", id: "MONTH_CURBS_MOVER" },      // SOP-2.4 月建制服动爻
    { field: "月制变爻", id: "MONTH_CURBS_TRANSFORM" }   // SOP-2.4 月建制服变爻
  ];

  /* ── 卦级 → feature。relations.shape 的 13 项里,这 9 项以前一个都没发出去。
     它们不是「检索键」而已 —— 新架构里 features 就是给模型看的那张表,
     发不出去 = 模型根本不知道这是一副六合卦。 */
  var SHAPE_MAP = [
    { field: "独发",     id: "SOLO_MOVER" },
    { field: "独静",     id: "SOLO_STATIC" },
    { field: "尽静",     id: "ALL_STATIC" },
    { field: "六爻乱动", id: "CHAOTIC_MOVEMENT" },
    { field: "六冲卦",   id: "SIX_CLASH_HEXAGRAM" },
    { field: "六合卦",   id: "SIX_COMBINE_HEXAGRAM" },
    { field: "变卦六冲", id: "TRANSFORMED_SIX_CLASH" },
    { field: "变卦六合", id: "TRANSFORMED_SIX_COMBINE" },
    { field: "归魂",     id: "RETURNING_SOUL" },
    { field: "游魂",     id: "WANDERING_SOUL" },
    { field: "反吟",     id: "REVERSED_CHANT" },
    { field: "伏吟",     id: "REPEATED_CHANT" }
  ];

  /* ── 变爻 kinds → feature。读 relations.transforms[].kinds。
     ⚠️ **「化绝」不再映射成 AT_ABSOLUTE。** 那是两件事:AT_ABSOLUTE 是
     「这一爻临绝地」,TRANSFORM_ABSOLUTE 是「它动了,动成了自己的绝」——
     后者是《增删卜易》§3 写死的大凶败局,前者不是。混成一个 id,
     那条败局就检索不到自己的卡,而页面上什么都看不出来。 */
  var TRANSFORM_MAP = {
    "回头生": "RETURN_GENERATION",
    "回头克": "RETURN_CONTROL",
    "回头冲": "RETURN_CLASH",
    "回头合": "RETURN_COMBINATION",
    "化绝":   "TRANSFORM_ABSOLUTE",
    "化空":   "TRANSFORM_EMPTY",
    "化入墓": "TRANSFORM_TOMB",
    "化进神": "ADVANCE_SPIRIT",
    "化退神": "RETREAT_SPIRIT"
  };

  /* ── 爻爻关系 → feature。只收 acts 为真的 ——
     静爻不生克动爻(《增删卜易》§4),不成立的关系不该把库路由开。 */
  var PAIR_MAP   = { "生": "GENERATES", "克": "CONTROLS" };
  var MUTUAL_MAP = { "冲": "CLASHES",   "合": "COMBINES", "刑": "PUNISHES", "害": "HARMS" };

  /* ⚠️ **合被冲开要发自己的 id,不能只发 COMBINES。** 400 副盘实测:
     382 个合里 153 个(40%)实际已经被日辰/月建/动爻冲开了。只发 COMBINES,
     那 40% 路由到的是「合住」那一批卡 —— **结论正好相反,而页面上看不出来**。 */
  var COMBINE_OPENED = "COMBINATION_BROKEN";

  /* 世应之间。以前一条都不发 —— 而「世应相合」「应生世」是断关系类问题时
     第一个要看的东西。 */
  var WORLD_RESP_MAP = {
    "世生应": "WORLD_GENERATES_RESP", "世克应": "WORLD_CONTROLS_RESP",
    "应生世": "RESP_GENERATES_WORLD", "应克世": "RESP_CONTROLS_WORLD",
    "世应比和": "WORLD_RESP_PEER",    "世应相冲": "WORLD_RESP_CLASH",
    "世应相合": "WORLD_RESP_COMBINE", "世应相害": "WORLD_RESP_HARM",
    "世应相刑": "WORLD_RESP_PUNISH"
  };

  /* ── 时钟对**用神**的作用。这四个 feature 名字里带 TARGET,
     所以只看用神那几爻 —— 对任意一爻发,等于这四个也恒为真。 */
  var CLOCK_TARGET = [
    { when: "月建", kinds: ["受生", "临", "比和"], id: "MONTH_SUPPORT" },
    { when: "月建", kinds: ["受克"],               id: "MONTH_CONTROLS_TARGET" },
    { when: "日辰", kinds: ["受生", "临", "比和"], id: "DAY_SUPPORT" },
    { when: "日辰", kinds: ["受克"],               id: "DAY_CONTROLS_TARGET" }
  ];

  var STRONG = ["旺", "相"];

  function of(board, roles, subject) {
    var R = (typeof window !== "undefined" && window.BWRelations) || null;
    if (!R) return { features: [], error: "关系模块未运行" };
    var r;
    try { r = R.compute(board); }
    catch (e) { return { features: [], error: "关系模块未能运行:" + (e && e.message) }; }

    var set = {};
    var add = function (id, why) {
      if (!id) return;
      if (!set[id]) set[id] = [];
      if (why && set[id].indexOf(why) < 0) set[id].push(why);
    };

    ALWAYS.forEach(function (id) { add(id, "任何盘都有"); });

    /* 用神爻号(1-based),和 relationLines 同一套取法 —— 第二用神一并算进来。 */
    var yong = ((roles && roles.yongLines) || []).map(function (i) { return i + 1; });
    var isYong = function (n) { return yong.indexOf(n) >= 0; };

    r.state.forEach(function (s) {
      STATE_MAP.forEach(function (m) {
        if (s[m.field]) add(m.id, "第" + s.line + "爻 " + m.field);
      });
      /* 旺衰只对用神发 —— 见 CLOCK_TARGET 上面那条注释,同一条理由。 */
      if (isYong(s.line)) {
        add(STRONG.indexOf(s.旺衰) >= 0 ? "TARGET_STRONG" : "TARGET_WEAK",
            "第" + s.line + "爻 " + s.旺衰);
      }
    });

    r.transforms.forEach(function (t) {
      add("TRANSFORMING_LINE", "第" + t.line + "爻 " + t.from + "→" + t.to);
      t.kinds.forEach(function (k) {
        if (TRANSFORM_MAP[k]) add(TRANSFORM_MAP[k], "第" + t.line + "爻 " + k);
      });
    });

    r.pairs.forEach(function (p) {
      if (!p.acts) return;
      p.kinds.forEach(function (k) {
        if (PAIR_MAP[k]) add(PAIR_MAP[k], p.from + k + p.to);
      });
    });
    r.mutual.forEach(function (m) {
      if (!m.acts) return;
      m.kinds.forEach(function (k) {
        if (MUTUAL_MAP[k]) add(MUTUAL_MAP[k], m.a + k + m.b);
      });
      if (m.kinds.indexOf("合") >= 0 && m.冲开) {
        add(COMBINE_OPENED, m.a + "合" + m.b + " 被" + [].concat(m.冲开).join("/") + "冲开");
      }
    });

    /* 卦级 —— 以前 13 项一项都没发。 */
    if (r.shape) {
      SHAPE_MAP.forEach(function (s) {
        if (r.shape[s.field]) {
          add(s.id, typeof r.shape[s.field] === "number"
            ? "第" + r.shape[s.field] + "爻" : s.field);
        }
      });
    }

    /* 世应。冲开和上面同一条理由:相合而被冲开,和相合是相反的两件事。 */
    if (r.worldResp) {
      (r.worldResp.rels || []).forEach(function (x) {
        if (WORLD_RESP_MAP[x]) add(WORLD_RESP_MAP[x], "世" + r.worldResp.world + "应" + r.worldResp.resp + " " + x);
      });
      if (r.worldResp.冲开) {
        add(COMBINE_OPENED, "世应相合 被" + [].concat(r.worldResp.冲开).join("/") + "冲开");
      }
    }

    /* 飞神与伏神。伏神能不能出伏,全看这两格 —— 以前只发一个「有伏神」。 */
    (r.hidden || []).forEach(function (h) {
      if (h.flyGeneratesHidden) add("FLYING_FEEDS_HIDDEN", "第" + (h.position + 1) + "爻 飞神生伏神");
      if (h.flyControlsHidden) add("FLYING_CURBS_HIDDEN", "第" + (h.position + 1) + "爻 飞神克伏神");
    });

    /* 太岁。clock 一直在算它,而这张表从来没往外发过。 */
    r.clock.forEach(function (c) {
      c.rels.forEach(function (x) {
        if (String(x.with).indexOf("太岁") !== 0) return;
        if (x.kind === "受生" || x.kind === "临" || x.kind === "比和") add("YEAR_SUPPORT", "第" + c.line + "爻 " + x.with + x.kind);
        if (x.kind === "受克") add("YEAR_CONTROLS", "第" + c.line + "爻 " + x.with + x.kind);
        if (x.kind === "冲")   add("YEAR_CLASH", "第" + c.line + "爻 " + x.with + x.kind);
      });
    });

    if ((r.sanhe && r.sanhe.length)) add("THREE_HARMONY_CHAIN", "三合" + r.sanhe.length + "个");
    if ((r.sanhui && r.sanhui.length)) add("THREE_MEETING_CHAIN", "三会" + r.sanhui.length + "个");

    r.clock.forEach(function (c) {
      if (!isYong(c.line)) return;
      c.rels.forEach(function (x) {
        CLOCK_TARGET.forEach(function (t) {
          if (x.with.indexOf(t.when) === 0 && t.kinds.indexOf(x.kind) >= 0) {
            add(t.id, "第" + c.line + "爻 " + x.with + x.kind);
          }
        });
      });
    });

    /* 相生链长度 ≥3 才算「多步相生」—— 两爻的生已经在 GENERATES 里了。 */
    if (r.chains && r.chains.length) add("MULTI_STEP_GENERATION", r.chains.length + " 条链");

    if (board.hidden || (board.ben && board.ben.hidden)) add("HIDDEN_SPIRIT", "伏神在卦");
    if (board.bian) add("CHANGED_HEXAGRAM", "有变卦");

    return {
      features: Object.keys(set).sort(),
      why: set,
      fromM1: FROM_M1,          // 这五个由 M1 补,不是这里发的
      notAFact: NOT_A_FACT
    };
  }

  /* 契约要拿的:这个文件**有能力**发出的全部 id(不是这一卦发了哪些)。
     ⚠️ 这张表必须和上面每一张映射表同步 —— 它就是 `tests/feature-vocab.mjs`
        用来查「有没有孤儿」的那一份。漏登记一个,那个 id 发得出去却不在词表里,
        而孤儿检查会以全绿的样子放过它。 */
  function vocabulary() {
    var v = {};
    ALWAYS.forEach(function (x) { v[x] = 1; });
    STATE_MAP.forEach(function (m) { v[m.id] = 1; });
    Object.keys(TRANSFORM_MAP).forEach(function (k) { v[TRANSFORM_MAP[k]] = 1; });
    Object.keys(PAIR_MAP).forEach(function (k) { v[PAIR_MAP[k]] = 1; });
    Object.keys(MUTUAL_MAP).forEach(function (k) { v[MUTUAL_MAP[k]] = 1; });
    CLOCK_TARGET.forEach(function (t) { v[t.id] = 1; });
    SHAPE_MAP.forEach(function (s) { v[s.id] = 1; });
    Object.keys(WORLD_RESP_MAP).forEach(function (k) { v[WORLD_RESP_MAP[k]] = 1; });
    v[COMBINE_OPENED] = 1;
    ["TARGET_STRONG", "TARGET_WEAK", "TRANSFORMING_LINE", "THREE_HARMONY_CHAIN",
     "THREE_MEETING_CHAIN", "MULTI_STEP_GENERATION", "HIDDEN_SPIRIT", "CHANGED_HEXAGRAM",
     "FLYING_FEEDS_HIDDEN", "FLYING_CURBS_HIDDEN",
     "YEAR_SUPPORT", "YEAR_CONTROLS", "YEAR_CLASH"]
      .forEach(function (x) { v[x] = 1; });
    return Object.keys(v).sort();
  }

  window.BWFeatures = {
    of: of, vocabulary: vocabulary, fromM1Flags: fromM1Flags,
    fromM1: FROM_M1, notAFact: NOT_A_FACT
  };
})();
