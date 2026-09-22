/* 契约:盘的四张 CSV 表。
   ────────────────────────────────────────────────────────────────────────
   这四张表是判据引擎唯一的输入。它们坏掉的方式全都是**不报错**的那种:

   ① **列名成了第二名单。** `liuyao-relations.js` 给 state 加一格,而
      `liuyao-csv.js` 的 `LINE_STATE` 没跟上 —— CSV 少一列,判据读不到那一格,
      于是那条判据永远不亮。**而它有卡可读、有结论可出。**
      本仓库为「两张要同步的名单」已经付过四次学费。

   ② **`?` 被当成 `否`。** `?` 的约定是「引擎算不出来」。把它读成否,
      「忌神衰而又绝」永远不成立,而拿到的是一个看起来完全正常的相反结论。
      所以这里反过来钉:**`临绝` 必须始终是 `?`** —— 哪天它变成是/否,
      而长生十二宫还没作为数据进仓库,那就是有人凭记忆猜了一张表。

   ③ **`?` 被拿去表示「不适用」。** 第一版 `独发` 就是这样:动爻数 ≠ 1 时
      写成 `?`,判据读到的是「不知道是不是独发」。两种意思撞在一个符号上,
      三态就白分了。

   ④ **新加的格一次都不亮。** 加了一列、而它在任何盘上都是否,等于没加 ——
      而 CSV 看起来完全正常。

   ⚠️ 防空转:每一格都有下限断言,扫的盘数也写死下限。
*/
import assert from "node:assert/strict";
import { material, engine } from "../tools/lab/board.mjs";

const N = 200;                       // 扫多少副盘
const boards = [];
for (let s = 1; s <= N; s++) boards.push(material({ seed: s, db: "婚恋", gender: "m" }));
assert.equal(boards.length, N, "盘没排出来,下面全是空转");

const win = engine();
const CSV = win.BWCsv;
assert.ok(CSV && typeof CSV.tables === "function", "liuyao-csv.js 没有 publish BWCsv.tables");

/* ⚠️ `liuyao-*.js` 是在 `node:vm` 的沙箱里跑的,所以从它们那里拿到的数组
   **属于另一个 realm** —— 原型不是这边的 `Array.prototype`。
   `assert.deepEqual`(strict 模式下就是 deepStrictEqual)会报
   「same structure but not reference-equal」,而内容一模一样。
   **报出来的错和它要查的东西毫无关系**,足够让下一个人以为列名真的对不上。
   所以跨沙箱拿过来的数组一律先 `Array.from` 搬回这一边。 */
const cols = {
  lines: Array.from(CSV.columns.lines),
  edges: Array.from(CSV.columns.edges),
  clock: Array.from(CSV.columns.clock),
  shape: Array.from(CSV.columns.shape)
};

/* ── ① 列名不许是第二名单 ───────────────────────────────────────────── */
const rel = win.BWRelations.compute(boards[0].board);
/* state 里除了身份那几格,每一格都必须在 CSV 的列里。 */
const IDENTITY = new Set(["line", "世爻", "应爻"]);
const stateKeys = Object.keys(rel.state[0]).filter((k) => !IDENTITY.has(k));
const lineCols = new Set(cols.lines);
const missing = stateKeys.filter((k) => !lineCols.has(k));
assert.deepEqual(missing, [],
  `relations 的 state 有这几格,而 liuyao-csv.js 的 LINE_STATE 没有:\n  ${missing.join(" ")}\n`
  + "  → CSV 少一列,读这一格的判据就永远不亮,而它照样有结论可出");
assert.ok(stateKeys.length >= 20,
  `state 只有 ${stateKeys.length} 格 —— 关系引擎缩水了,这条契约在空转`);

/* shape 同理。 */
const shapeKeys = Object.keys(rel.shape);
const shapeCols = new Set(cols.shape);
const shapeMissing = shapeKeys.filter((k) => !shapeCols.has(k));
assert.deepEqual(shapeMissing, [],
  `relations 的 shape 有这几格,而 CSV 的 BOARD_SHAPE 没有:${shapeMissing.join(" ")}`);

/* ── ② 四张表的形状 ─────────────────────────────────────────────────── */
const parse = (csv) => {
  const rows = csv.trim().split("\n");
  return { header: rows[0].split(","), body: rows.slice(1) };
};
let edgeRows = 0, clockRows = 0;
for (const b of boards) {
  assert.deepEqual(Object.keys(b.csv).sort(), ["board", "clock", "edges", "lines"],
    "四张表不齐 —— 判据引擎的输入少了一块");
  const L = parse(b.csv.lines);
  assert.equal(L.body.length, 6, "爻表不是 6 行 —— 六爻就是六爻");
  assert.deepEqual(L.header, cols.lines, "爻表的表头和 columns.lines 对不上");
  const B = parse(b.csv.board);
  assert.equal(B.body.length, 1, "盘表不是 1 行");
  edgeRows += parse(b.csv.edges).body.length;
  clockRows += parse(b.csv.clock).body.length;
}
assert.ok(edgeRows > N * 5, `${N} 副盘只出了 ${edgeRows} 条边 —— 爻与爻之间的关系丢了`);
assert.ok(clockRows > N * 10, `${N} 副盘只出了 ${clockRows} 条钟表关系`);

/* ── ③ `?` 只许出现在真的算不出来的列 ───────────────────────────────── */
/* 白名单三条,每一条都有理由,而且理由是「这个仓库里没有那份数据」:
     临绝   —— 要长生十二宫,仓库里没有那张表
     卦/变卦 —— 卦名由 casting-figure.js 的 BWFigure 供给,不画图的调用方拿不到 */
const UNKNOWN_OK = new Set(["临绝", "卦", "变卦"]);
const qCols = new Map();
for (const b of boards) {
  for (const [name, csv] of Object.entries(b.csv)) {
    const { header, body } = parse(csv);
    for (const line of body) {
      line.split(",").forEach((v, i) => {
        if (v === "?") qCols.set(header[i], (qCols.get(header[i]) || 0) + 1);
      });
    }
  }
}
const badQ = [...qCols.keys()].filter((c) => !UNKNOWN_OK.has(c));
assert.deepEqual(badQ, [],
  `这些列出现了 \`?\`,而它们是算得出来的:${badQ.join(" ")}\n`
  + "  → `?` 只许表示「引擎算不出来」。拿它表示「不适用」,判据会把一个确定的否读成不知道");

/* 反过来:临绝必须**始终**是 `?`。 */
assert.equal(qCols.get("临绝"), N * 6,
  `临绝有 ${qCols.get("临绝")}/${N * 6} 格是 \`?\` —— 它必须全是。`
  + "长生十二宫不在这个仓库里,给它一个是/否就是凭记忆猜了一张表;"
  + "补全包把 AT_ABSOLUTE 标成 blocked 正是这一条");

/* ── ④ 新加的每一格都要真的能亮 ─────────────────────────────────────── */
const NEW_CELLS = ["冲空则实", "动墓", "入墓", "破墓", "月制动爻", "月制变爻"];
const lit = Object.fromEntries(NEW_CELLS.map((c) => [c, 0]));
let heTotal = 0, heOpen = 0;
for (const b of boards) {
  const { header, body } = parse(b.csv.lines);
  for (const line of body) {
    const cells = line.split(",");
    for (const c of NEW_CELLS) {
      const v = cells[header.indexOf(c)];
      if (v && v !== "否" && v !== "?") lit[c]++;
    }
  }
  const E = parse(b.csv.edges);
  const ki = E.header.indexOf("关系"), oi = E.header.indexOf("冲开");
  for (const line of E.body) {
    const cells = line.split(",");
    if (cells[ki] !== "合") continue;
    heTotal++;
    if (cells[oi] !== "否") heOpen++;
  }
}
for (const c of NEW_CELLS) {
  assert.ok(lit[c] > 0,
    `「${c}」在 ${N} 副盘里一次都没亮 —— 加了一列而它恒为否,等于没加,`
    + "而 CSV 看起来完全正常");
}
assert.ok(heOpen > 0 && heOpen < heTotal,
  `合被冲开 ${heOpen}/${heTotal} —— 全是或全不是都说明这一格没在真的判。`
  + "合住和合被冲开是两个相反的结论,只算前一半时页面上看不出任何异常");

/* ── ⑤ 转义:带逗号的值不许把一行拆成两列 ───────────────────────────── */
assert.equal(CSV.tri(null), "?", "tri(null) 必须是 ?");
assert.equal(CSV.tri(false), "否", "tri(false) 必须是 否");
assert.equal(CSV.tri(true), "是", "tri(true) 必须是 是");
assert.equal(CSV.tri([]), "否", "空数组是「没有」,不是「不知道」");
for (const b of boards.slice(0, 20)) {
  for (const csv of Object.values(b.csv)) {
    const { header, body } = parse(csv);
    for (const line of body) {
      /* 简单查:不带引号的行,逗号数必须等于列数 - 1 */
      if (line.indexOf('"') >= 0) continue;
      assert.equal(line.split(",").length, header.length,
        `这一行的列数和表头对不上,说明有值里带了逗号却没加引号:\n  ${line}`);
    }
  }
}

/* ── ⑥ 没有任何一格是把对象 `String()` 出来的 ─────────────────────────
   上面每一条断言查的都是**形状**:列数、行数、`?` 落在哪、逗号有没有转义。
   `[object Object]` 一样不带逗号、不是 `?`、列也在 —— **全部形状检查一路绿着过去**,
   而那一格的内容是坏的。实测它在 30/400 副盘上出现过(`liuyao-relations.js`
   往 `transforms[].kinds` 里 push 了引擎的 `jinTui` 对象而不是字符串)。
   ⚠️ 这是本仓库那条「样式已应用 ≠ 画出来了」的数据侧版本:
      **表的结构对,不等于表里的值是字。** */
let scanned = 0;
for (const b of boards) {
  for (const [name, csv] of Object.entries(b.csv)) {
    scanned++;
    assert.ok(csv.indexOf("[object ") < 0,
      `${name} 表里有一格是把对象 String() 出来的(\`[object …]\`)。\n`
      + "  → 某个 kind/值是对象而不是字符串。读它的一方(判据、features 的 map)\n"
      + "    拿到的是 `[object Object]`,查不到任何东西 —— 而且不报错。");
  }
}
assert.ok(scanned >= N * 4, `只扫了 ${scanned} 张表 —— 这条在空转`);

/* ── ⑦ CSV 和 features 不许对同一件事各说各话 ─────────────────────────
   `化出关系` 那一格和 `ADVANCE_SPIRIT`/`RETREAT_SPIRIT` 说的是同一件事,
   来源也是同一个 `transforms[].kinds`。它们分头坏掉过:kinds 里塞的是对象时,
   CSV 写出 `[object Object]`、而 `liuyao-features.js` 的 `TRANSFORM_MAP[k]`
   查 `"[object Object]"` 得到 undefined —— **两个 feature 一次都没发出去过**,
   补全包里 36 条判据引用它们 14 次,一次都命中不了。
   ⭐ 钉「两边必须一致」,而不是「至少亮一次」:前者能指出是哪一副盘不一致,
      后者在只剩一条路能亮时照样绿。 */
const TRANS_FEATURE = { "化进神": "ADVANCE_SPIRIT", "化退神": "RETREAT_SPIRIT" };
const seen = { "化进神": 0, "化退神": 0 };
for (const b of boards) {
  const { header, body } = parse(b.csv.lines);
  const ri = header.indexOf("化出关系");
  for (const line of body) {
    for (const kind of (line.split(",")[ri] || "").split("/")) {
      const id = TRANS_FEATURE[kind];
      if (!id) continue;
      seen[kind]++;
      assert.ok(b.features.includes(id),
        `CSV 的 化出关系 写着「${kind}」,而 features 里没有 ${id}。\n`
        + "  → 同一个事实,两个出口只走通了一个。判据读 features 的那一半永远不亮,\n"
        + "    而 CSV 看起来完全正常。");
    }
  }
}
for (const [kind, n] of Object.entries(seen)) {
  assert.ok(n > 0, `${N} 副盘里一次「${kind}」都没有 —— 上面那条断言在空转`);
}

/* ── ⑧ 角色列:判据的行选择器 ────────────────────────────────────────
   补全包 36 条判据的原子是**角色 × 格**的乘积(`ORIGIN_STRONG` =「元神那一行的
   旺衰格」),68 个原子里 58 个是这个形状。少了这一列,**每条判据都选不中行** ——
   而表的形状完全正常,上面七条断言一条都不会响。
   ⭐ 钉「和 roles.yongLines 一致」而不是「这一列非空」:非空只要求填了东西,
      一致才要求填对。用神选错行,整篇解读读的是另一爻,页面上看不出任何异常。
   ⚠️ 这一列**不在 `?` 白名单里**,所以 ③ 已经替它挡住了「没人给 roles」那一种。 */
const ROLE_CN = new Set(["用神", "原神", "忌神", "仇神", "泄神", "比和"]);
let roleCells = 0;
for (const b of boards) {
  const { header, body } = parse(b.csv.lines);
  const ci = header.indexOf("角色");
  assert.ok(ci >= 0, "lines 表没有 角色 列 —— 判据没有行选择器,一条都选不中");
  const yongRows = [];
  body.forEach((line, i) => {
    const v = line.split(",")[ci];
    roleCells++;
    assert.ok(ROLE_CN.has(v),
      `第 ${i + 1} 爻的角色是「${v}」,不在五行对用神的那几种关系里`);
    if (v === "用神") yongRows.push(i);
  });
  assert.deepEqual(yongRows, Array.from(b.roles.yongLines),
    "CSV 标的用神行和 deriveRoles().yongLines 对不上 —— "
    + "判据会照着这一列去读旺衰/发动,读的却是另一爻");
}
assert.ok(roleCells === N * 6, `角色格只有 ${roleCells} 个,应为 ${N * 6} —— 这条在空转`);

/* ── ⑨ 发给模型的那份和 CSV 不许对入墓各说各话 ─────────────────────────
   `liuyao-verdict.js` 的 `states` 是 `boardText` 的来源,也就是**真正发给 M3 的
   那一份**。它的 `tomb` 曾经写的是 `dayTomb || monthTomb` —— 动墓整个不在里面。
   于是同一副盘同一爻,CSV 说入墓,模型收到「没入墓」:1200 格里 142 格相反,
   涉及 84/200 副盘。SOP-3 元神不能生五「元神入三墓」在 CSV 上成立,
   而模型据此写出来的那一段读起来完全正常。

   ⭐ 根因是同一件事算了两遍(relations 一遍、verdict 一遍、而 verdict 那遍
      少算一种墓)。现在动墓只在 `liuyao-engine.js` 算一次,两边都读它。
      这条断言钉的是**两个出口必须一致**,不是某一边的写法。 */
{
  let cells = 0, disagree = [];
  for (const b of boards) {
    const { header, body } = parse(b.csv.lines);
    const ci = header.indexOf("入墓");
    for (const m of b.boardText.matchAll(/\{"label":"第(\d)爻[^}]*"tomb":(true|false)[^}]*\}/g)) {
      const row = body.map((l) => l.split(",")).find((r) => Number(r[0]) === Number(m[1]));
      if (!row) continue;
      cells++;
      if ((row[ci] === "是") !== (m[2] === "true")) disagree.push(`第${m[1]}爻`);
    }
  }
  assert.ok(cells >= N * 6, `只比了 ${cells} 格 —— 正则没匹配上,这条在空转`);
  assert.deepEqual(disagree, [],
    `CSV 说入墓、而发给模型的 boardText 说没入墓(或反过来):${disagree.length} 格。\n`
    + "  → 三种墓不是一个东西(日墓等冲、月墓等出月、动墓跟着那个动爻走)。\n"
    + "    合成一个标记时漏掉一种,模型收到的就是相反的事实,而它写出来的那段读着完全正常。");
  /* 三种墓要分开发,不能只发一个合起来的 tomb —— 应期按这个分尺度。 */
  assert.ok(/"dayTomb":/.test(boards[0].boardText) && /"monthTomb":/.test(boards[0].boardText)
    && /"movingTomb":/.test(boards[0].boardText),
    "boardText 只发了合起来的 tomb,没有分开的日墓/月墓/动墓 —— 应期按这三种分尺度,合起来就算不出来");
}

console.log(`ok   board-csv — 四张表 × ${N} 副盘,列名和 relations 同源,`
  + `\`?\` 只在临绝/卦名(算不出来)出现,${NEW_CELLS.length} 个新格全部亮过,`
  + `合被冲开 ${heOpen}/${heTotal},无 [object] 泄漏,角色列与 yongLines 一致,`
  + `化进神 ${seen["化进神"]} / 化退神 ${seen["化退神"]} 两边一致`);
