/* 契约:应期。
   ────────────────────────────────────────────────────────────────────────
   《增删卜易》那十条应期,拿盘算出候选的日子。它坏掉的方式都是不报错的:

   ① **触发条件写在事体类型上。** 应期由**用神状态**触发,不由问题触发 ——
      旬空的爻就有旬空的应期,与他问的是什么无关。照着前四步那套按事体
      路由的逻辑接,一条都不会命中,而输出是空的,看起来像「这盘没有应期」。

   ② **算不出来被当成不应。** 十条里两条今天算不出来(太旺没有这一级、
      长生帝旺要长生十二宫)。把它们读成「不应」,一个衰绝的用神就永远等不到
      它的生旺之日,而输出完全正常。

   ③ **它开始改吉凶。** 应期只产候选。第四步已经定了凶,这一步只说它什么时候凶。

   ④ **某一条从来不动。** 加了一条而它在任何盘上都不触发,等于没加。

   ⑤ **地支查表抄了第二份。** 六冲六合和五行墓库在 `liuyao-engine.js` 里已经有,
      这里必须用它导出的那一份。抄一份不会报错,两份都跑得通,而分叉的那次
      没有任何东西看得出来 —— 动墓那次就是这么来的,142/1200 格发给模型的是反的。
*/
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";   // ⑥ 还用它读 timing.js 查副作用
import { material, engine } from "../tools/lab/board.mjs";
import { timing, format, _internal } from "../functions/_lib/doctrine/timing.js";
import { loadTiming } from "../functions/_lib/doctrine/criteria-rules.mjs";

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const N = 400;
const rules = loadTiming();
assert.equal(rules.length, 10, `SOP-5 应该是 10 条,读到 ${rules.length}`);
assert.ok(rules.every((r) => r.机器值 && r.机器值.触发表达式 && r.机器值.应),
  "有规则没有 触发表达式 或 应 —— SOP-3 的判据混进来了?那些是另一种形状");

const boards = [];
for (let s = 1; s <= N; s++) boards.push(material({ seed: s, db: "婚恋", gender: "m" }));

/* ── ① 触发读的是用神的状态,不是问题 ─────────────────────────────────
   同一副盘,换一个完全不同的问题和领域,触发的那几条必须一模一样。
   ⭐ 这条是整个第五步的定性:它一旦跟着问题变,就说明有人把前四步那套
      按事体路由的逻辑接了过来。 */
{
  const a = material({ seed: 7, db: "婚恋", gender: "m" });
  const b = material({ seed: 7, db: "疾病", gender: "f" });
  const key = (m) => m.timing.filter((r) => r.成立 === true).map((r) => r.id).sort().join(" ");
  assert.equal(key(a), key(b),
    "换了问题和领域,触发的应期条目跟着变了。\n"
    + "  → 应期由用神状态触发,不由问题触发。跟着问题变,说明触发条件接错了地方。");
  assert.ok(key(a).length > 0, "seed 7 一条都没触发 —— 这条对比在空转");
}

/* ── ② 三态:成立 / 不成立 / 算不出来 ───────────────────────────────── */
const fired = {}, blocked = {};
for (const b of boards) {
  assert.equal(b.timing.length, 10, "material() 给的应期条数不对");
  for (const r of b.timing) {
    assert.ok(r.成立 === true || r.成立 === false || r.成立 === null,
      `${r.id} 的 成立 是 ${r.成立} —— 只许 true / false / null`);
    const k = r.id.replace("SOP-5.", "");
    if (r.成立 === true) {
      fired[k] = (fired[k] || 0) + 1;
      assert.ok(r.应.length > 0, `${r.id} 成立却一个候选都没给 —— 那和不成立没有区别`);
      assert.ok(r.爻.length > 0, `${r.id} 成立却说不出是哪一爻`);
    } else if (r.成立 === null) {
      blocked[k] = (blocked[k] || 0) + 1;
      assert.ok(r.缺.length > 0 && r.缺.every((x) => x.名 && x.因),
        `${r.id} 算不出来,却没说缺什么、为什么。沉默和「不应」在读的人眼里一样`);
    }
  }
}

/* ── ③ 两条今天算不出来的,必须报「算不出来」而不是「不应」 ───────────── */
assert.ok(blocked["3"] > 0,
  "5.3(太旺)从来没报过算不出来。旺衰只有休囚旺死相五档,没有太旺这一级,"
  + "判法包里也没给 —— 它要是报了「不应」,那是编出来的");
assert.ok(blocked["4"] > 0,
  "5.4(衰绝)从来没报过算不出来。长生和帝旺要长生十二宫,本仓库没有那张表");
assert.equal(fired["3"] || 0, 0, "5.3 居然算出来了 —— 太旺的判法是从哪来的?");
assert.equal(fired["4"] || 0, 0, "5.4 居然算出来了 —— 长生十二宫是从哪来的?");

/* ── ④ 剩下八条每条都要真的动过 ─────────────────────────────────────
   ⚠️ 5.9(用神化进神)在 400 副盘里一次都不亮 —— 要用神那一爻正好化进神,
      而进神本身就少。它在 seed 424 上亮,所以单独钉那一副,不放宽到「大部分条」。 */
for (const k of ["1", "2", "5", "6", "7", "8", "10"]) {
  assert.ok(fired[k] > 0,
    `5.${k} 在 ${N} 副盘里一次都没触发 —— 加了一条而它永远不动,等于没加`);
}
{
  const m = material({ seed: 424, db: "婚恋", gender: "m" });
  const r = m.timing.find((x) => x.id === "SOP-5.9");
  assert.equal(r.成立, true,
    "5.9(化进神)在 seed 424 上不再触发。那一副的用神正好化进神,"
    + "是这条规则唯一验得到的地方(3000 个种子里只有这一副)");
  assert.deepEqual(r.应.map((a) => a.支).sort(), ["卯", "戌"],
    "5.9 在 seed 424 上算出来的候选变了");
}

/* ── ⑤ 地支查表只能有一份 ───────────────────────────────────────────
   timing.js 不许自己写六冲六合或五行墓库,必须用引擎导出的 BRANCH。 */
{
  /* ⭐ **行为测,不是 grep。** 第一版查的是源码里有没有中文六合表,
     而真要抄的人会照引擎里那份**数字**表抄(`{0:1,1:0,2:11,…}`),
     grep 打不到 —— 实测植入数字表时这条是绿的。
     现在把 `BR` 换成一份故意错的传进去:timing 要是自己藏了一份表,
     输出不会跟着变,那就当场红。 */
  const real = engine().BWLiuYao.BRANCH;
  const board = boards[0].board, roles = boards[0].roles;
  /* ⚠️ **要逐条比,不能比整体。** 第一版比的是整份输出,而 `BR.combine`
     在别处也用(`自=合神`),所以换掉它整体照样变,`notEqual` 就过了 ——
     实测植入数字六合表时这条是绿的。现在钉到**那一条规则的那一个候选**上:
       combine → 5.2 的「合@本爻」
       clash   → 5.1 的「冲@本爻」
       tombOf  → 5.5 的「自=墓库」 */
  const pick = (BR, id, 取) => {
    const r = timing(rules, board, roles, BR).find((x) => x.id === id);
    assert.ok(r && r.成立 === true, `${id} 在这副盘上没触发 —— 这条对比在空转`);
    const a = r.应.find((x) => x.取 === 取);
    assert.ok(a, `${id} 没有「${取}」这个候选`);
    return a.支;
  };
  for (const [k, id, 取, stub] of [
    ["combine", "SOP-5.2", "合", { ...real, combine: (bi) => (bi + 1) % 12 }],
    ["clash", "SOP-5.1", "冲", { ...real, clash: (bi) => (bi + 1) % 12 }],
    ["tombOf", "SOP-5.5", "冲墓", { ...real, tombOf: () => 0 }]
  ]) {
    assert.notEqual(pick(stub, id, 取), pick(real, id, 取),
      `把 BR.${k} 换成错的,${id} 的「${取}」候选没变 —— 说明 timing.js 自己藏了一份表。\n`
      + "  → 六冲六合和五行墓库在 liuyao-engine.js 里已经有。两份不会报错,\n"
      + "    两份都跑得通,而分叉的那次没有任何东西看得出来。");
  }
  const BR = real;
  assert.ok(BR && typeof BR.clash === "function" && typeof BR.combine === "function"
    && typeof BR.tombOf === "function" && Array.isArray(BR.CN),
    "BWLiuYao.BRANCH 没有导出应期要的那几样");
  /* 导出的那份本身要对:子冲午、子合丑、木墓于未。 */
  assert.equal(BR.CN[BR.clash(0)], "午", "子的冲不是午");
  assert.equal(BR.CN[BR.combine(0)], "丑", "子的合不是丑");
  assert.equal(BR.CN[BR.tombOf(0)], "未", "木的墓库不是未");
}

/* ── ⑥ 不许改吉凶,也不许往盘上留东西 ───────────────────────────────── */
{
  /* ⚠️ 这一条第一版是 grep 源码里有没有「吉凶」—— 那是拿字面去代替行为,
     而且当场打中了文件自己的注释,以及 5.6 原文里的「或凶或吉」(书上的字,
     必须原样印)。**查结构,不查字面**:输出里根本不许有承载吉凶的字段。 */
  const KEYS = ["id", "原文", "尺度", "触发", "成立", "爻", "应", "缺"];
  for (const r of boards[0].timing) {
    assert.deepEqual(Object.keys(r).sort(), [...KEYS].sort(),
      `应期的输出多了或少了字段:${Object.keys(r).join(" ")}\n`
      + "  → 多出来的那个要是承载吉凶,这一步就在改第四步已经定下的结论了");
  }
  const m = material({ seed: 1, db: "婚恋", gender: "m" });
  assert.ok(!m.board.lines.some((l) => "combinedBy" in l),
    "应期往引擎的 line 上挂了字段。那个 board 是要返回出去的,"
    + "下一个读盘的人不知道这个字段从哪来、是不是每次都在");
}

/* ── ⑦ 给人看的文本:不带程序内部的名字,也不带表情 ─────────────────── */
{
  const txt = format(boards[0].timing);
  assert.ok(/不改吉凶/.test(txt), "文本没说它不改吉凶 —— 读的人会把候选日读成结论");
  assert.ok(/由用神状态触发/.test(txt), "文本没说触发来自用神状态,不来自问题");
  assert.ok(!/[A-Z]{3,}_[A-Z_]+/.test(txt), "文本里出现了全大写的内部标识");
  assert.ok(!/[\u{1F300}-\u{1FAFF}\u{2190}-\u{21FF}\u{2600}-\u{27BF}\u{FE0F}]/u.test(txt),
    "文本里有表情符号 —— 这是给人读的正文");
  assert.ok(!/undefined|\[object/.test(txt), "文本里有 undefined 或 [object …]");
}

const total = Object.values(fired).reduce((a, b) => a + b, 0);
console.log(`ok   timing-engine — ${N} 副盘 × 10 条:成立 ${total} 次,`
  + `八条全部动过(5.9 单钉 seed 424),太旺与长生帝旺报「算不出来」共 `
  + `${(blocked["3"] || 0) + (blocked["4"] || 0)} 次,地支查表只有引擎那一份`);
