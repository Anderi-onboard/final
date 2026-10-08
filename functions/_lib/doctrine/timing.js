/* 应期 · 服务端 only(断法即产品,不进 assets/)
   ────────────────────────────────────────────────────────────────────────
   《增删卜易》各门类应期总注章那十条,拿盘算出候选的日子。

   ⭐⭐⭐ 应期不由问题触发,由用神状态触发。
   旬空的爻就有旬空的应期,不管他问的是什么。所以这十条的触发条件写在
   爻的状态上,不写在事体类型上。前四步那套按事体类型路由的逻辑照搬过来,
   一条都不会命中。

   ⭐⭐ 它只产候选,不改吉凶。
   第四步已经定了凶,这一步只说它什么时候凶。把应期读成结论,就等于让
   一个「什么时候」去改「是什么」。

   ⚠️ 输入是盘,不是四张 CSV 表 —— 和判据引擎不同,这是有理由的。
      判据是「某一格等于什么」,表是按格寻址的,所以判据只看表就够,而且
      只看表才证明得了那张表够用。应期算的是地支之间的关系(本支的冲是哪个支、
      墓库的冲是哪个支),那不是一个格,把它塞进文本表再解析回来,
      买不到任何东西,只多一层能出错的解析。

   ⚠️ 十条里有两条今天算不出来,而且报的是算不出来,不是不应:
      5.3 太旺   —— 旺衰只有休囚旺死相五档,没有「太旺」这一级,判法包里也没给
      5.4 衰绝   —— 「长生」「帝旺」要长生十二宫,本仓库没有那张表
      把它们当成「不应」,一个衰绝的用神就永远等不到它的生旺之日,
      而输出看起来完全正常。
*/

/* 「取」:拿到一个支之后,应在哪个支上。 */
const TAKE = {
  值:   (bi, BR) => bi,
  填实: (bi, BR) => bi,                       // 破而逢合之外的另一条:填实之日则不破
  冲:   (bi, BR) => BR.clash(bi),
  冲墓: (bi, BR) => BR.clash(bi),             // 自 已经是墓库了,这里就是冲它
  合:   (bi, BR) => BR.combine(bi),
  墓:   (bi, BR) => BR.tombOf(BR.EL[bi]),
  长生: null,                                  // 缺长生十二宫
  帝旺: null,                                  // 缺长生十二宫
  出空: "出旬"                                 // 不是一个支,是这一旬走完
};

const BLOCKED = {
  TARGET_OVERSTRONG: { 名: "太旺", 因: "旺衰仅休囚旺死相五档,无此级,判法包里也没给" },
  长生: { 名: "长生", 因: "需长生十二宫,本仓库无此表" },
  帝旺: { 名: "帝旺", 因: "需长生十二宫,本仓库无此表" }
};

/* 触发:十条全是 TARGET_*,读的都是用神那一爻的一格。 */
function fires(atom, line, combined) {
  switch (atom) {
    case "TARGET_STATIC":         return !line.moving;
    case "TARGET_MOVING":         return !!line.moving;
    case "TARGET_XUN_EMPTY":      return !!line.void;
    case "TARGET_MONTH_BREAK":    return !!line.monthClash;
    case "TARGET_IN_ANY_TOMB":    return !!(line.dayTomb || line.monthTomb || line.movingTomb
                                    || (line.transform && line.transform.backToTomb));
    case "TARGET_COMBINED":       return !!combined;
    case "TARGET_ADVANCE_SPIRIT": return !!(line.transform && line.transform.jinTui
                                    && line.transform.jinTui.dir === "advance");
    case "TARGET_RETREAT_SPIRIT": return !!(line.transform && line.transform.jinTui
                                    && line.transform.jinTui.dir === "retreat");
    /* 「衰绝者,遇生遇旺」—— 衰**或**绝,两者之一即可。衰这一半算得出来
       (触发事实写的是「旺衰=休囚死」,也就是 rank ≤ 2,不是 ≤ 1);
       绝那一半要长生十二宫,缺。所以这条会触发,然后在「应」那一步报缺 ——
       ⚠️ 写成 rank ≤ 1 的话,一个休的用神根本不触发,而它本该等它的生旺之日。 */
    case "TARGET_WEAK_OR_ABSOLUTE": return line.wangShuai.rank <= 2;
    case "TARGET_OVERSTRONG":     return null;                          // 算不出来
    default:                      return null;
  }
}

/* 「自」:从哪个支起算。 */
function from(which, line, BR) {
  switch (which) {
    case "本爻": return line.branch.bi;
    case "墓库": return BR.tombOf(line.element.gi);
    case "合神": return BR.combine(line.branch.bi);
    case "变爻": return line.transform ? line.transform.branch.bi : null;
    default:     return null;
  }
}

/* 一爻对一条规则。 */
function one(rule, line, BR, xunkong, combined) {
  const m = rule.机器值 || {};
  const hit = fires(m.触发表达式, line, combined);
  if (hit === null) {
    const b = BLOCKED[m.触发表达式] || { 名: m.触发表达式, 因: "求值器没有这个触发条件" };
    return { 成立: null, 缺: [b], 应: [] };
  }
  if (!hit) return { 成立: false, 缺: [], 应: [] };

  const 应 = [], 缺 = [];
  for (const a of m.应 || []) {
    const take = TAKE[a.取];
    if (take === null || take === undefined) {
      const b = BLOCKED[a.取] || { 名: a.取, 因: "求值器没有这种取法" };
      if (!缺.some((x) => x.名 === b.名)) 缺.push(b);
      continue;
    }
    if (take === "出旬") {
      应.push({ 取: a.取, 自: a.自, 支: null,
                说明: "出了这一旬(本旬空的是 " + xunkong.join("、") + ")" });
      continue;
    }
    const base = from(a.自, line, BR);
    if (base === null) continue;                 // 没有变爻时,自=变爻 的那条不成立
    const bi = take(base, BR);
    if (bi === null || bi === undefined) continue;
    应.push({ 取: a.取, 自: a.自, 支: BR.CN[bi],
              说明: a.自 + BR.CN[base] + " 的 " + a.取 + " 是 " + BR.CN[bi] });
  }
  /* ⚠️ 触发成立、而每一条应法都算不出来,那是「应不出来」,不是「不应」。 */
  if (!应.length && 缺.length) return { 成立: null, 缺, 应: [] };
  return { 成立: true, 缺, 应 };
}

/* ── 对外 ────────────────────────────────────────────────────────────
   `rules` 由调用方给(node 侧从补全包的 jsonl 读)。
   `board` 是 `BWLiuYao.computeBoard` 的结果,`roles` 是 `deriveRoles` 的结果,
   `BR` 是 `BWLiuYao.BRANCH`。 */
export function timing(rules, board, roles, BR) {
  const yong = (roles && roles.yongLines) || [];
  const xunkong = ((board.meta && board.meta.xunkong) || []).map((x) => x.cn);
  /* 合神那一格引擎没有现成的,这里按六合补一次:和本支相合的那个支,
     只要它真的在盘上或在日月上,这一爻才算「逢六合」。 */
  const onBoard = new Set(board.lines.map((l) => l.branch.bi));
  if (board.meta && board.meta.dayPillar) onBoard.add(board.meta.dayPillar.branch.bi);
  if (board.meta && board.meta.monthBranch) onBoard.add(board.meta.monthBranch.bi);

  return rules.map((r) => {
    const m = r.机器值 || {};
    const out = { id: r.id, 原文: r.原文, 尺度: m.尺度 || "未言",
                  触发: m.触发表达式, 成立: false, 爻: [], 应: [], 缺: [] };
    for (const i of yong) {
      const line = board.lines[i];
      if (!line) continue;
      /* ⚠️ **不往引擎的 line 上挂东西。** 第一版写的是 `line.combinedBy = …`,
         而这个 board 是 `material()` 要返回出去的 —— 一个断法模块往盘上留一个
         别处看不见的字段,下一个读盘的人不知道它从哪来,也不知道它是不是每次都在。
         算出来传进去就行。 */
      const combined = onBoard.has(BR.combine(line.branch.bi))
        || !!(line.transform && BR.combine(line.branch.bi) === line.transform.branch.bi);
      const res = one(r, line, BR, xunkong, combined);
      if (res.成立 === null) {
        if (out.成立 !== true) { out.成立 = null; }
        res.缺.forEach((b) => { if (!out.缺.some((x) => x.名 === b.名)) out.缺.push(b); });
        continue;
      }
      if (!res.成立) continue;
      out.成立 = true;
      out.爻.push(i + 1);
      res.应.forEach((a) => out.应.push(Object.assign({ 爻: i + 1 }, a)));
      res.缺.forEach((b) => { if (!out.缺.some((x) => x.名 === b.名)) out.缺.push(b); });
    }
    return out;
  });
}

/* 给人和给模型看的文本。规矩和判据那边一样:不下结论,只报候选;
   算不出来的要说出来,因为沉默和「不应」在读的人眼里一样。 */
export function format(rows) {
  const on = rows.filter((r) => r.成立 === true);
  const na = rows.filter((r) => r.成立 === null);
  const out = [];
  out.push("应期候选 " + on.length + " 条。只说什么时候,不改吉凶。");
  out.push("它由用神状态触发,不由问题触发:旬空的爻就有旬空的应期,与问的是什么无关。");
  on.forEach((r) => {
    out.push("");
    out.push((r.爻.length ? "第" + r.爻.join("、") + "爻" : "") + "，尺度" + r.尺度);
    out.push("  " + r.原文);
    /* ⚠️ 同一个候选去重。两爻都入同一个墓时,冲开的是同一个支,
       打两遍读起来像两个候选,而它是一个。 */
    const seen = new Set();
    r.应.forEach((a) => {
      const k = a.支 + "|" + a.说明;
      if (seen.has(k)) return;
      seen.add(k);
      out.push("  应在 " + (a.支 ? a.支 + "（第" + a.爻 + "爻的" + a.自 + a.取 + "）" : a.说明));
    });
    out.push("  " + r.id);
  });
  if (na.length) {
    out.push("");
    out.push("算不出来 " + na.length + " 条。缺的是数据，不是不应。");
    na.forEach((r) => {
      out.push("  " + r.id + "  缺" + r.缺.map((x) => x.名 + "：" + x.因).join("；"));
    });
  }
  return out.join("\n");
}

export const _internal = { TAKE, BLOCKED, fires, from };
