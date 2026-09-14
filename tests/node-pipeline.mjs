/* 契约:四节点管线接得上,而且两级收窄是真的收窄。
   ────────────────────────────────────────────────────────────────────────
   这条钉的是四件「不报错的坏」:

   ① **槽没填上。** `{{cards}}` 留在提示词里发出去,模型会当成一段占位文字读过去,
      一个字都不会抱怨。
   ② **两级收窄反了。** 第一版先全局取前 6、再筛掉不属于 M2 选中的库的 ——
      实测 M2 挑两个库,交集只剩 1 张卡。**M3 照样有卡可读,只是少了五张。**
   ③ **分数漏进提示词。** 模型看见 9.271 就会开始引用它,而读解读的人不知道那是什么。
   ④ **M1 的提示词里出现 feature id。** id 是程序侧的地址,M1 写中文 flags。

   ⚠️ 防空转:管线得**真的检索到东西**。没有下限断言的话,一个永远返回空数组的
      检索也能让上面四条全绿。
*/
import assert from "node:assert/strict";
import { buildNode, parseM1 } from "../functions/_lib/nodes/fill.js";
import { RAG } from "../functions/_lib/doctrine/rag/data.js";
import { selectLibraries, selectCards } from "../functions/_lib/doctrine/rag/retrieve.js";

/* ── 防空转:数据层不许悄悄变空 ─────────────────────────────────────── */
assert.ok(RAG.libs.length >= 11, `选库只剩 ${RAG.libs.length} 个 —— 数据层缩水了`);
assert.ok(RAG.cards.length >= 29, `断法卡只剩 ${RAG.cards.length} 张 —— 数据层缩水了`);
for (const c of RAG.cards) {
  assert.ok(c.rule && c.rule.length > 10, `${c.id} 没有原文 —— 那一格不可再生,不能空`);
  assert.ok(RAG.libs.some((l) => l.id === c.lib), `${c.id} 的父库 ${c.lib} 不存在`);
}
/* 每个库声明的子卡都得真的在 —— 引用了不存在的卡,那条路由通向空。 */
for (const l of RAG.libs) {
  for (const id of l.children || []) {
    assert.ok(RAG.cards.some((c) => c.id === id), `${l.id} 声明了子卡 ${id},但它不存在`);
  }
}

const FEATURES = ["XUN_EMPTY", "COMBINES", "GENERATES", "MOVING_LINE", "AT_ABSOLUTE"];
const body = {
  question: "我和她还有可能吗",
  features: FEATURES,
  ladder: "凶 · 定案在第 3 步",
  relations: "第3爻 ─生→ 第5爻",
  m1: "lang=Chinese\ndb=婚恋\nask=我和她还有没有可能\nhurt=0\nflags=多个人"
};

/* ── ① 四站都建得出来,而且槽全填上 ─────────────────────────────────── */
for (const node of ["m1", "m2", "m3", "m4"]) {
  const built = buildNode(node, { ...body, m2: "lib=CLASS-RELATIONSHIP\nlib=TECH-VOID-BREAK", m3: "程=x" });
  assert.ok(built && built.system, `${node} 没建出 system`);
  const left = built.system.match(/\{\{[a-z]+\}\}/g) || [];
  assert.deepEqual(left, [], `${node} 还有没填上的槽:${left.join(" ")} —— 它会当占位文字被读过去,不报错`);
}

/* ── ② 两级收窄:M2 选了哪几个库,M3 就只能看到那几个库的卡 ─────────── */
const two = buildNode("m3", { ...body, m2: "lib=TECH-VOID-BREAK" });
const ids = two.meta.cards.map((c) => c.id);
const allowed = new Set(RAG.libs.find((l) => l.id === "TECH-VOID-BREAK").children);
assert.ok(ids.length > 0, "M3 一张卡都没开到 —— 检索空转了");
for (const id of ids) {
  assert.ok(allowed.has(id), `M2 只开了 TECH-VOID-BREAK,M3 却拿到 ${id}`);
}
/* 关键的那一条:收窄到一个库时,该库的卡要**全部**进来,而不是被全局前 N 截掉。
   第一版就是先全局排序再过滤,实测只剩 1 张。 */
assert.equal(ids.length, allowed.size,
  `TECH-VOID-BREAK 有 ${allowed.size} 张卡,M3 只拿到 ${ids.length} 张 —— `
  + "收窄和取前 N 的顺序反了:必须先按库收窄,再在库内排序");

/* 选两个库时,两个库的卡都要有 */
const both = buildNode("m3", { ...body, m2: "lib=CLASS-RELATIONSHIP\nlib=TECH-VOID-BREAK" });
const libsSeen = new Set(both.meta.cards.map((c) => RAG.cards.find((x) => x.id === c.id).lib));
assert.ok(libsSeen.size >= 2, `选了两个库,M3 却只看到 ${[...libsSeen].join(",")} 一个库的卡`);

/* ── ③ 分数不许进提示词 ─────────────────────────────────────────────── */
for (const node of ["m2", "m3"]) {
  const built = buildNode(node, { ...body, m2: "lib=TECH-VOID-BREAK" });
  assert.ok(!/\bscore\b|weight:|\d+\.\d{3,}/.test(built.system),
    `${node} 的提示词里漏进了检索分数 —— 模型看见分数就会开始引用分数`);
}

/* ── ④ M1 的提示词里不许出现 feature id ─────────────────────────────── */
const m1p = buildNode("m1", body).system;
for (const id of ["XUN_EMPTY", "MULTI_ACTOR", "THIRD_PARTY_DIVINATION", "MOVING_LINE"]) {
  assert.ok(!m1p.includes(id), `M1 的提示词里出现了 ${id} —— id 是程序侧的地址,M1 写中文 flags`);
}
/* 而中文 flags 得真的解析得出来 */
const p = parseM1(body.m1);
assert.equal(p.lang, "Chinese");
assert.equal(p.db, "婚恋");
assert.equal(p.hurt, "0");
assert.ok(p.flags.includes("多个人"));

/* ── 检索本身不空转 ─────────────────────────────────────────────────── */
const libs = selectLibraries({ question: "我和她还有可能吗", intent: "婚恋 感情", features: FEATURES });
assert.ok(libs.length >= 2, `选库只命中 ${libs.length} 个 —— 检索空转了`);
assert.ok(libs.some((l) => l.id === "CLASS-RELATIONSHIP"), "婚恋问题没路由到 CLASS-RELATIONSHIP");
const exam = selectLibraries({ question: "我明天考科目一能过吗", intent: "考试 能不能过", features: FEATURES });
assert.ok(exam.some((l) => l.id === "CLASS-EXAM"), "考试问题没路由到 CLASS-EXAM");
const examCards = selectCards({
  question: "我明天考科目一能过吗", intent: "考试 能不能过 及格",
  features: FEATURES, libraries: exam.filter((l) => l.id === "CLASS-EXAM")
});
assert.ok(examCards.length === 3, `考试库该开 3 张类型卡,开到 ${examCards.length} 张`);
assert.ok(examCards.every((c) => c.doctrineId), "考试卡必须带 doctrineId —— 用神由程序按它取,模型不得自己定");

console.log(`ok   node-pipeline — ${RAG.libs.length} 库 / ${RAG.cards.length} 卡,四站槽全填,两级收窄成立`);
