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
import { readFileSync } from "node:fs";
import { buildNode, parseM1 } from "../functions/_lib/nodes/fill.js";
import { RAG } from "../functions/_lib/doctrine/rag/data.js";
import { selectLibraries, selectCards } from "../functions/_lib/doctrine/rag/retrieve.js";
import { M4 } from "../functions/_lib/nodes/prompts.js";

const ROOT = new URL("..", import.meta.url).pathname;
const read = (p) => readFileSync(ROOT + p, "utf8");

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

/* ── ⑤ 一次解读只收一次门票 ───────────────────────────────────────────────
   四节点把一次解读拆成四次调用。`guardRequest` 是按 `product` 分流的,而四次
   都带 `product:"sortis"` —— 不拦的话 **M1(一次分类调用)就把新用户那唯一一次
   免费解读花掉了**,后面三站各自去撞余额,而新用户余额是 0:新注册的人一卦
   都起不了。和 codex 那次加 reserve+cap 是同一个后果,成因换了一个。
   CLAUDE.md §5:「改这里前先问 owner」。 */
const claude = read("functions/api/claude.js");
const utilSet = claude.match(/const UTILITY_ROLES = new Set\(\[([\s\S]*?)\]\)/);
assert.ok(utilSet, "UTILITY_ROLES 找不到了 —— 这条契约扫的是它,改了名字就要改这里");
for (const r of ["m1", "m2", "m3"]) {
  assert.ok(new RegExp(`['"]${r}['"]`).test(utilSet[1]),
    `${r} 不在 UTILITY_ROLES 里 —— 它会走 sortis 那条闸,`
    + "第一次调用就花掉新用户的免费解读,而新用户余额是 0:一卦都起不了");
}
assert.ok(!/['"]m4['"]/.test(utilSet[1]),
  "m4 进了 UTILITY_ROLES —— 它**就是**那次解读,不收它的钱等于整个产品免费");
assert.ok(/UTILITY_ROLES\.has\(String\(role/.test(claude),
  "guardRequest 不再按 role 分流了 —— 只看 product 的话,任何带 product 的 utility "
  + "调用都会去花一次免费解读");
assert.ok(/guardRequest\(\{[^}]*role:/.test(claude),
  "调用 guardRequest 时没把 role 传进去 —— 里面那条按 role 的分流就永远读到 undefined");

/* ── ⑥ M4 必须带着取象标记的格式 ─────────────────────────────────────────
   ⚠️ 这条钉的是**页面**,不是提示词。`chat-app.js` 画象按钮、串联、追问面板,
   全靠解读正文里的 `{词|符号}`;老栈里教这个的是 prompt-engine 的 xiang_chain,
   新栈里只有 M4。M4 第一版 269 tok,读起来很干净 —— 而页面上每一个可点的东西
   都会黑掉,解读照样 stream。**降级了却看起来在正常工作**,本仓库最贵的那种。
   下次再给 M4 减肥,红的是这里,不是页面。 */
const m4 = buildNode("m4", body).system;
assert.ok(/\{实际的词\|符号\}/.test(m4), "M4 里没有取象标记的格式 —— 页面上的象按钮会全黑");
assert.ok(/左边永远不许是术语/.test(m4), "M4 丢了「左边不许是术语」—— 这是这个标记唯一会出错的地方");
assert.ok(/\{\{mark\}\}/.test(M4), "M4 模板里没有 {{mark}} 槽 —— 格式那段接不进去");
/* 前端认哪几种符号,提示词就得允许哪几种。少一类,那一类标出来点不开。 */
for (const sym of ["父母", "妻财", "官鬼", "世爻", "应爻"]) {
  assert.ok(m4.includes(sym), `M4 的可用符号里没有「${sym}」—— 模型不会标它,前端也就画不出来`);
}

/* ── ⑦ 他自己说的既成事实要走完全程 ─────────────────────────────────────
   ⚠️ CLAUDE.md §6 写着「分清盘给的和问题给的,**记两本账**」—— 而第二本账
   **一直没有槽**。后果不是报错:M3 看到「用神化父母」,只能在「学业 / 文书 /
   名分」里挑一个,**挑出来的那个读起来和读出来的一模一样**。
   2026-09-15 实测就是这样:「她是医学生」进不了管线,于是学业被判给了官鬼。 */
const M1_WITH_FACTS = "lang=Chinese\ndb=婚恋\nask=我和她还有没有可能\nhurt=0\n"
  + "flags=指定对象\nfacts=她是大学生;学医;现在在忙学业";
assert.equal(parseM1(M1_WITH_FACTS).facts, "她是大学生;学医;现在在忙学业",
  "parseM1 不再解析 facts —— 第二本账在入口就丢了");
const withFacts = buildNode("m3", { ...body, m1: M1_WITH_FACTS, m2: "lib=CLASS-RELATIONSHIP" });
assert.match(withFacts.system, /她是大学生;学医/,
  "M1 抄下来的既成事实没到 M3 —— 那一格是「实=」那一层唯一的来源");
/* 没有事实时**必须写「他没说」,不能留空**:一个空格子和一句「他没说」
   在提示词里长得一样,在推理里完全相反(填不填由第⑤步决定)。 */
const noFacts = buildNode("m3", { ...body, m2: "lib=CLASS-RELATIONSHIP" });
/* ⚠️ 断言要钉**那一格**,不是钉「他没说」这三个字 —— M3 的提示词正文里
   第⑤步自己就写着「而他没说过」,所以裸的 /他没说/ 会匹配到提示词本身,
   **把槽填空也照样绿**。植入检查当场抓到了这条,是我的断言指错了地方。 */
assert.match(noFacts.system, /他自己说的既成事实:\(他没说/,
  "没有既成事实时 M3 的那一格是空的 —— 模型会把它当成「随便填」");
/* 指认的五步必须在,而且「不许新增候选」那半句是承重的那半句。 */
assert.match(withFacts.system, /只能在盘上已有的六亲里选,不能新增/,
  "M3 少了六亲指认那条规矩 —— 事实一旦能新增候选,它就能按到任何一爻上");
/* 同一个陷阱:提示词里举例写着「链=断在 法3」,所以裸的 /链=/ 匹配得到。
   钉的必须是**格式那一行**。 */
assert.match(withFacts.system, /链=<程N> → <法N> → <推N>/,
  "M3 不再要求交出一条带行号的链 —— 那就只剩结论,没有可追的推理");

/* ── ⑧ 调试台调的必须是上线那份 ───────────────────────────────────────── */
const lab = read("tools/lab/run.mjs");
assert.match(lab, /from "\.\.\/\.\.\/functions\/_lib\/nodes\/fill\.js"/,
  "调试台不再 import 真的 buildNode —— 抄一份的话,你调的是调试台不是产品");
assert.ok(!/export const M[1-4]\s*=/.test(lab) && !/你只做一件事/.test(lab),
  "调试台里出现了提示词正文 —— 它只许从 functions/_lib/nodes/ 取");

console.log(`ok   node-pipeline — ${RAG.libs.length} 库 / ${RAG.cards.length} 卡,四站槽全填,`
  + "两级收窄成立,一次解读只收一次门票,M4 带着取象标记,既成事实走完全程");
