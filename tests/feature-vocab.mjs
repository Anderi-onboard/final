/* 契约:RAG 要的每一个 feature id,都得有主。
   ────────────────────────────────────────────────────────────────────────
   为什么要这条:那批 RAG 靠 feature id 路由。卡里引用了一个**永远不会被发出**
   的 id,那张卡就是不可达的 —— 而**不可达不报错**,它只是永远排不上,看起来
   像「这条断法不适用」。本仓库为这种「坏了也看不出来」的失败付过很多次钱。

   三个来源,必须刚好覆盖,不许有孤儿:
     from_board  → liuyao-features.js 的 vocabulary() 发
     from_m1     → M1 的 flags= 那一行,经 fromM1Flags() 翻成 id
     not_a_fact  → 明知故犯不发(是判断,不是事实),留在名单里是为了说明理由

   ⚠️ 反向也要卡:liuyao-features.js 发了 RAG 根本不认的 id,那是白发 ——
      要么 RAG 该加一张卡,要么这个 id 该删。两种都得有人决定,不能沉默。
*/
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const spec = JSON.parse(readFileSync(path.join(root, "functions/_lib/doctrine/rag-features.json"), "utf8"));

/* 在一个假 window 里跑浏览器侧那个文件,只为了拿 vocabulary()。 */
const sandbox = { window: {} };
sandbox.window.window = sandbox.window;
new Function("window", readFileSync(path.join(root, "liuyao-features.js"), "utf8"))(sandbox.window);
const BW = sandbox.window.BWFeatures;

assert.ok(BW && typeof BW.vocabulary === "function", "liuyao-features.js 没有 publish BWFeatures.vocabulary");

const emitted = new Set(BW.vocabulary());
const board = new Set(spec.from_board);
const m1 = new Set(spec.from_m1);
const notFact = new Set(spec.not_a_fact);

/* 防空转:名单不许悄悄变空。29/5/1 是 2026-09-14 从那个 zip 里数出来的。 */
assert.ok(board.size >= 29, `from_board 只剩 ${board.size} 条 —— 名单缩水了,先查是不是解析坏了`);
assert.ok(emitted.size >= 29, `vocabulary() 只发 ${emitted.size} 个 —— 映射表缩水了`);
assert.equal(board.size + m1.size + notFact.size, spec.counted,
  `三类加起来 ${board.size + m1.size + notFact.size},和 counted=${spec.counted} 对不上`);

/* ① RAG 说「从盘来」的,liuyao-features.js 必须发得出来 */
const orphans = [...board].filter((id) => !emitted.has(id));
assert.deepEqual(orphans, [],
  `这些 id 卡里在用、但 liuyao-features.js 永远不发 —— 引用它们的卡是不可达的:\n  ${orphans.join("\n  ")}`);

/* ② 反过来:发了但 RAG 不认的,是白发 */
const unused = [...emitted].filter((id) => !board.has(id));
assert.deepEqual(unused, [],
  `liuyao-features.js 发了 RAG 不认的 id —— 要么 RAG 该加卡,要么这里该删:\n  ${unused.join("\n  ")}`);

/* ③ M1 那五个:必须由 fromM1Flags() 翻得出来,而且不能和盘的重名 */
assert.deepEqual([...m1].sort(), [...BW.fromM1].sort(),
  "rag-features.json 的 from_m1 和 liuyao-features.js 的 M1_FLAG_MAP 对不上");
for (const id of m1) {
  assert.ok(!emitted.has(id), `${id} 两边都在发 —— 一个 id 只许有一个主`);
}
const flagged = BW.fromM1Flags("flags=替人占、多个人、指定对象、问时间、问了不止一件");
assert.deepEqual(flagged.sort(), [...m1].sort(),
  `M1 的中文 flags 翻不全:拿到 ${flagged.join(",")}`);
assert.deepEqual(BW.fromM1Flags("flags=无"), [], "flags=无 应该翻成空数组");
assert.deepEqual(BW.fromM1Flags(""), [], "空行应该翻成空数组");

/* ④ 明知故犯的那一个:必须仍然不发,而且必须写着为什么 */
for (const id of notFact) {
  assert.ok(!emitted.has(id), `${id} 是判断不是事实,不该被当成检索键发出去`);
  assert.ok(spec.notes && spec.notes[id],
    `${id} 列在 not_a_fact 里却没写原因 —— 没有理由的例外,下一个人只会把它补上`);
}

console.log(`ok   feature-vocab — 盘 ${board.size} · M1 ${m1.size} · 不发 ${notFact.size},无孤儿`);
