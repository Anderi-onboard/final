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

  /* ── 每爻状态 → feature。读的是 liuyao-relations.js 的 state 那几个中文字段。 */
  var STATE_MAP = [
    { field: "旬空",     id: "XUN_EMPTY" },
    { field: "月破",     id: "MONTH_BREAK" },
    { field: "日破",     id: "DAY_BREAK" },
    { field: "日墓",     id: "ENTER_TOMB" },
    { field: "月墓",     id: "ENTER_TOMB" },
    { field: "动化入墓", id: "ENTER_TOMB" },
    { field: "发动",     id: "MOVING_LINE" }
  ];

  /* ── 变爻 kinds → feature。读 relations.transforms[].kinds。 */
  var TRANSFORM_MAP = {
    "回头生": "RETURN_GENERATION",
    "回头克": "RETURN_CONTROL",
    "化绝":   "AT_ABSOLUTE",
    "化进神": "ADVANCE_SPIRIT",
    "化退神": "RETREAT_SPIRIT"
  };

  /* ── 爻爻关系 → feature。只收 acts 为真的 ——
     静爻不生克动爻(《增删卜易》§4),不成立的关系不该把库路由开。 */
  var PAIR_MAP   = { "生": "GENERATES", "克": "CONTROLS" };
  var MUTUAL_MAP = { "冲": "CLASHES",   "合": "COMBINES" };

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
    });

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

    if ((r.sanhe && r.sanhe.length) || (r.sanhui && r.sanhui.length)) {
      add("THREE_HARMONY_CHAIN", "局" + ((r.sanhe || []).length + (r.sanhui || []).length) + "个");
    }
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

  /* 契约要拿的:这个文件**有能力**发出的全部 id(不是这一卦发了哪些)。 */
  function vocabulary() {
    var v = {};
    ALWAYS.forEach(function (x) { v[x] = 1; });
    STATE_MAP.forEach(function (m) { v[m.id] = 1; });
    Object.keys(TRANSFORM_MAP).forEach(function (k) { v[TRANSFORM_MAP[k]] = 1; });
    Object.keys(PAIR_MAP).forEach(function (k) { v[PAIR_MAP[k]] = 1; });
    Object.keys(MUTUAL_MAP).forEach(function (k) { v[MUTUAL_MAP[k]] = 1; });
    CLOCK_TARGET.forEach(function (t) { v[t.id] = 1; });
    ["TARGET_STRONG", "TARGET_WEAK", "TRANSFORMING_LINE", "THREE_HARMONY_CHAIN",
     "MULTI_STEP_GENERATION", "HIDDEN_SPIRIT", "CHANGED_HEXAGRAM"]
      .forEach(function (x) { v[x] = 1; });
    return Object.keys(v).sort();
  }

  window.BWFeatures = {
    of: of, vocabulary: vocabulary, fromM1Flags: fromM1Flags,
    fromM1: FROM_M1, notAFact: NOT_A_FACT
  };
})();
