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

console.log(`ok   board-csv — 四张表 × ${N} 副盘,列名和 relations 同源,`
  + `\`?\` 只在临绝/卦名(算不出来)出现,${NEW_CELLS.length} 个新格全部亮过,`
  + `合被冲开 ${heOpen}/${heTotal}`);
