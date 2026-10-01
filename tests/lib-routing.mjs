/* 契约:M1 的 db 到事体库的路由。
   ────────────────────────────────────────────────────────────────────────
   M1 花一次模型调用算出 `db=婚恋`,而选库是**子串包含**:库的 `domains` 里写的是
   感情/婚姻/恋爱(那批原始 RAG 自己的词),没有「婚恋」这两个字。于是
   `db=婚恋` 打不开感情库,`db=求财` 打不开生意库 —— 九个取值里只有「考试」
   字面命中。真实问题能救回一部分:8 个案例里仍有 3 个一个事体库都没开。

   ⚠️ 它不报错。M3 照样有卡可读、照样交得出材料,只是少了这一卦本该有的那一类。

   这个文件钉三件互相咬住的事:
     ① M1 的枚举**从 prompts.js 里解析出来**,不在这里手抄 —— 手抄的那份会漂。
     ② 枚举里每一个值都要在 `DB_DOMAINS` 里有条目(哪怕是空数组:
        「还没有这个库」是待办,「漏写了」是 bug,两者在代码里长得一模一样)。
     ③ 对照表里每一个词都要真的是某个库的 domain,每个事体库都要够得着 ——
        单向对上不算对上,两头都要接住。
*/
import assert from "node:assert/strict";
import { RAG } from "../functions/_lib/doctrine/rag/data.js";
import { selectLibraries, DB_DOMAINS } from "../functions/_lib/doctrine/rag/retrieve.js";
import { M1 } from "../functions/_lib/nodes/prompts.js";
import { material } from "../tools/lab/board.mjs";

/* ── ① 枚举来自提示词本身 ─────────────────────────────────────────────
   ⭐ 这是一面镜子,不是第二张名单:改了 prompts.js 里那一行,这里跟着改。
      手抄一份的话,M1 多一个领域、而路由表不知道,新领域就静默打不开任何库。 */
const m = M1.match(/db=<([^>]+)>/);
assert.ok(m, "prompts.js 里找不到 `db=<…|…>` 那一行 —— 这条契约在测一个不存在的枚举");
const ENUM = m[1].split("|").map((s) => s.trim()).filter(Boolean);
assert.ok(ENUM.length >= 5, `枚举只解析出 ${ENUM.length} 个值 —— 正则失配了`);

/* ── ② 枚举里每一个值都要有条目 ───────────────────────────────────── */
const missing = ENUM.filter((db) => !(db in DB_DOMAINS));
assert.deepEqual(missing, [],
  `M1 的 db 枚举里有这几个值,而 DB_DOMAINS 没有条目:${missing.join(" ")}\n`
  + "  → 没有条目的值打不开任何事体库,而且不报错。没有库的要写成空数组,\n"
  + "    因为「还没有这个库」是待办,「漏写了」是 bug,两者在代码里长得一样。");
const extra = Object.keys(DB_DOMAINS).filter((db) => !ENUM.includes(db));
assert.deepEqual(extra, [],
  `DB_DOMAINS 里有 M1 根本不会输出的值:${extra.join(" ")} —— 它们永远不会被用到`);

/* ── ③ 对照表两头都要接住 ─────────────────────────────────────────── */
const allDomains = new Set();
RAG.libs.forEach((l) => (l.domains || []).forEach((d) => allDomains.add(d)));
for (const [db, words] of Object.entries(DB_DOMAINS)) {
  for (const w of words) {
    assert.ok(allDomains.has(w),
      `DB_DOMAINS 的「${db}」指向「${w}」,而没有任何库的 domains 里有这个词。\n`
      + "  → 这一条对照是死的:它看起来把 db 接上了库,实际什么都打不开。");
  }
}
/* 反过来:每个事体库都要够得着,否则它是死库。 */
const reachable = new Set();
for (const words of Object.values(DB_DOMAINS)) {
  for (const l of RAG.libs) {
    if ((l.domains || []).some((d) => words.includes(d))) reachable.add(l.id);
  }
}
const classLibs = RAG.libs.filter((l) => l.id.startsWith("CLASS-")).map((l) => l.id);
const dead = classLibs.filter((id) => !reachable.has(id));
assert.deepEqual(dead, [],
  `这几个事体库没有任何 db 值够得着:${dead.join(" ")}\n`
  + "  → 库写了、卡也写了,而它永远不会被打开。");
assert.ok(classLibs.length >= 3, `只有 ${classLibs.length} 个事体库 —— 这条在空转`);

/* ── ④ 真跑:每一个有库的 db,都必须开出它的库 ─────────────────────── */
const board = material({ seed: 1, db: "婚恋", gender: "m" });
let routed = 0;
for (const [db, words] of Object.entries(DB_DOMAINS)) {
  const want = RAG.libs.filter((l) => (l.domains || []).some((d) => words.includes(d))).map((l) => l.id);
  /* 问题里**故意不含任何领域词** —— 要测的是 db 这条路,不是问题文本碰巧救了它。 */
  const got = selectLibraries({ question: "这次有戏吗", intent: db, db,
                                features: board.features, limit: 6 }).map((l) => l.id);
  for (const id of want) {
    routed++;
    assert.ok(got.includes(id),
      `db=${db} 没有打开 ${id}(问题里不含领域词)。\n`
      + "  → M1 算出来的分类没有到达选库。这一步不报错,M3 照样交得出材料。");
  }
}
assert.ok(routed >= 3, `只验到 ${routed} 条路由 —— 这条在空转`);

/* ── ⑤ db 是按键取的,不是子串撞的 ───────────────────────────────────
   一个不在枚举里的值不许靠字面相似打开任何事体库 —— 那会让一个拼错的 db
   看起来像正常工作。 */
{
  const bogus = "婚";
  const got = selectLibraries({ question: "这次有戏吗", intent: bogus, db: bogus,
                                features: board.features, limit: 6 })
    .filter((l) => l.id.startsWith("CLASS-"));
  assert.deepEqual(got.map((l) => l.id), [],
    `db="${bogus}"(不在枚举里)打开了事体库 —— 说明 db 还在靠子串撞,不是按键取`);
}

/* ── ⑥ 必开的不进 limit ───────────────────────────────────────────────
   ⚠️ **这条分支今天不触发。** 实测 200 副盘,必开最多 6 个,而 limit 就是 6 ——
      它恰好卡在天花板上,没被削过。所以这里把 limit 压到 1 来真的走一遍那段,
      否则那两行是一段没测过的代码,而它防的恰恰是「少一个库、不报错」。 */
{
  const rows = selectLibraries({ question: "我和她还有可能吗", intent: "婚恋", db: "婚恋",
                                 features: board.features, limit: 1 });
  const hard = rows.filter((r) => r.hard);
  assert.ok(hard.length > 1,
    `limit=1 时只剩 ${hard.length} 个必开的库 —— 必开被 limit 削了。\n`
    + "  → 盘上确实成立的理法库被削掉之后,M3 再也看不到那个库的卡,而它照样交得出材料。");
  assert.equal(rows.length, hard.length,
    "limit=1 时还带上了软排的库 —— 软的那一截应该被削到 0");
  /* 必开的必须说得出凭什么必开。 */
  for (const r of hard) {
    assert.ok(r.why.some((w) => w.startsWith("feature:") || w.startsWith("db:")),
      `${r.id} 标成必开,却说不出是凭 feature 还是凭 db`);
  }
}

console.log(`ok   lib-routing — M1 的 ${ENUM.length} 个 db 值全部有条目,`
  + `${routed} 条路由真跑通(问题里不含领域词),${classLibs.length} 个事体库都够得着,`
  + "必开不受 limit 削");
