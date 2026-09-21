/* 契约:判据求值。
   ────────────────────────────────────────────────────────────────────────
   这套东西坏掉的方式,没有一种会报错:

   ① **它开始下结论。** 输出一个「忌神能克」的总判断看起来是进步 ——
      而 200 副盘里有 60 副两边同时成立,那个总判断在这 30% 上是掷硬币,
      掷完还看不出来是掷的。所以这里反过来钉:**正反同时成立必须还能发生**。
      哪天它不可能了,就是有人偷偷加了裁决,而书上那个先后仍然没人写下来。

   ② **它不再逐爻判。** 第一版对主体的几行取「任一」,于是第 5 爻旺而化旺、
      第 6 爻休而化休时,「动旺相而化旺相」和「动休囚而化休囚」**同时成立** ——
      两个条件落在不同的爻上,而书上说的是一爻。CSV 和条数都完全正常。

   ③ **它不再只看 CSV。** 伸手去拿 relations 能少写几行,代价是从此没人知道
      那张表缺什么 —— 而「表够不够用」正是做这张表的全部理由。

   ④ **`引用` 指向不存在的格。** 「凭第 3 爻的月破那一格」是这套东西唯一值钱的
      产出。指错了格,读的人无从发现:那句话照样通顺。

   ⑤ **算不出来被当成不成立。** 九条判据今天判不了(长生十二宫不在仓库、
      「化散」没给判法、「近事」来自问题不是盘)。把它们读成「不成立」,
      「忌神衰而又绝」永远不亮,而拿到的是一个看起来完全正常的相反结论。
*/
import assert from "node:assert/strict";
import { material } from "../tools/lab/board.mjs";
import { judge, format } from "../functions/_lib/doctrine/criteria.js";
import { loadCriteria, loadTiming } from "../functions/_lib/doctrine/criteria-rules.mjs";

const N = 200;
const rules = loadCriteria();
assert.equal(rules.length, 36, `SOP-3 应该是 36 条,读到 ${rules.length}`);
assert.ok(rules.every((r) => r.机器值 && r.机器值.规则表达式),
  "有判据没有 规则表达式 —— SOP-5 混进来了?那 10 条是应期规则,形状不同,"
  + "混进来会让求值器对每一条都报「算不出来」,读起来像这副盘信息不够");
assert.ok(loadTiming().every((r) => !r.机器值.规则表达式),
  "应期那 10 条不该有 规则表达式");

const boards = [];
for (let s = 1; s <= N; s++) boards.push(material({ seed: s, db: "婚恋", gender: "m" }));

/* ── ① 三态,而且「算不出来」必须带原因 ─────────────────────────────── */
let on = 0, off = 0, na = 0;
const naIds = new Set();
for (const b of boards) {
  assert.equal(b.criteria.length, 36, "material() 给的判据条数不对");
  for (const v of b.criteria) {
    assert.ok(v.成立 === true || v.成立 === false || v.成立 === null,
      `${v.id} 的 成立 是 ${v.成立} —— 只许 true / false / null`);
    if (v.成立 === true) on++;
    else if (v.成立 === false) off++;
    else {
      na++; naIds.add(v.id);
      assert.ok(v.缺.length > 0 && v.缺.every((x) => x.原子 && x.为什么),
        `${v.id} 判不了,却没说缺哪个原子、为什么。`
        + "一条沉默的判据和一条不成立的判据在下游长得一模一样");
    }
  }
}
assert.ok(on > N, `${N} 副盘只成立 ${on} 次 —— 这条契约在空转`);
assert.ok(na > 0 && naIds.size >= 5,
  `判不了的只有 ${naIds.size} 条 —— 长生十二宫、化散、近事、随鬼入墓都不在仓库里,`
  + "全都判得了说明有人给它们编了判法");

/* ── ② 正反同时成立必须还可能发生 —— 这是设计,不是 bug ───────────── */
let bothSides = 0;
for (const b of boards) {
  const yes = b.criteria.some((v) => v.id.startsWith("SOP-3.忌神.能克.") && v.成立 === true);
  const no = b.criteria.some((v) => v.id.startsWith("SOP-3.忌神.不能克.") && v.成立 === true);
  if (yes && no) bothSides++;
}
assert.ok(bothSides > 0,
  "没有任何一副盘上「能克」和「不能克」同时成立。\n"
  + "  → 要么有人加了裁决(而书上那个先后没有写在 46 条里的任何一条),\n"
  + "    要么求值器缩水了。这个引擎的约定是**报条目,不下结论**。");
assert.ok(bothSides < N,
  `${N} 副盘全都两边成立 —— 那说明判据根本没在判`);

/* ── ③ 逐爻判:同一爻上不许出现互斥的两条 ───────────────────────────── */
/* 进神.1「动旺相而化旺相」和 进神.2「动休囚而化休囚」说的是同一爻的两种相反状态。
   逐爻判时它们在同一爻上不可能同时成立;按「任一」判就会。 */
const EXCLUSIVE = [["SOP-3.进神.1", "SOP-3.进神.2"], ["SOP-3.退神.2", "SOP-3.退神.3"]];
let checked = 0;
for (const b of boards) {
  for (const [x, y] of EXCLUSIVE) {
    const a = b.criteria.find((v) => v.id === x), c = b.criteria.find((v) => v.id === y);
    if (a.成立 !== true || c.成立 !== true) continue;
    checked++;
    const shared = a.爻.filter((n) => c.爻.includes(n));
    assert.deepEqual(shared, [],
      `${x} 和 ${y} 在第 ${shared.join("、")} 爻上同时成立 —— 它们是同一爻的相反状态。\n`
      + "  → 求值器把主体的几行取了「任一」,于是两个条件落在了不同的爻上,\n"
      + "    而书上说的是一爻动而化进。");
  }
  /* 有主体的判据成立时,必须说得出是哪一爻。 */
  for (const v of b.criteria) {
    if (v.成立 !== true || !v.主体) continue;
    assert.ok(v.爻.length > 0,
      `${v.id} 成立却没有爻号 —— 「这盘有进神」和「第5爻是进神」不是同一句话`);
  }
}
assert.ok(checked >= 10, `互斥对只撞上 ${checked} 次 —— 这条在空转`);

/* ── ④ 引用必须指向真实存在、而且值对得上的格 ───────────────────────── */
const parse = (csv) => {
  const rows = csv.trim().split("\n").map((r) => r.split(","));
  return { header: rows[0], body: rows.slice(1) };
};
let cited = 0;
for (const b of boards.slice(0, 40)) {
  const L = parse(b.csv.lines);
  for (const v of b.criteria) {
    if (v.成立 !== true) continue;
    for (const c of v.引用) {
      cited++;
      if (c.表 !== "lines") continue;          // edges/clock 的值是拼出来的说明句
      const row = L.body.find((r) => Number(r[0]) === c.行);
      assert.ok(row, `${v.id} 引用了第 ${c.行} 爻,而 lines 表里没有这一行`);
      const ci = L.header.indexOf(c.列);
      assert.ok(ci >= 0, `${v.id} 引用了 lines 表没有的列「${c.列}」`);
      assert.equal(row[ci], c.值,
        `${v.id} 说第 ${c.行} 爻的 ${c.列} 是「${c.值}」,表里是「${row[ci]}」`);
    }
  }
}
assert.ok(cited > 400, `只查了 ${cited} 条引用 —— 这条在空转`);

/* ── ⑤ 它真的在读那张表 ─────────────────────────────────────────────── */
/* 改一格 CSV,结论必须跟着变。⭐ 这是「只看 CSV」唯一测得出来的形式:
   要是它偷偷去读 relations,改表就不会有任何反应,而一切看起来完全正常。 */
{
  const b = boards.find((x) =>
    x.criteria.some((v) => v.id === "SOP-3.忌神.不能克.2" && v.成立 === true));
  assert.ok(b, "200 副盘里没有一副「忌神静临空破」成立 —— 换一条来测");
  const before = judge(rules, b.csv).find((v) => v.id === "SOP-3.忌神.不能克.2");
  assert.equal(before.成立, true);
  /* 把那一爻的 发动 从「否」改成「是」—— 原文是「忌神**静**临空破」 */
  const ln = before.爻[0];
  const rows = b.csv.lines.split("\n");
  const h = rows[0].split(",");
  const mi = h.indexOf("发动");
  const patched = rows.map((r, i) => {
    if (i === 0) return r;
    const c = r.split(",");
    if (Number(c[0]) === ln) c[mi] = "是";
    return c.join(",");
  }).join("\n");
  const after = judge(rules, { ...b.csv, lines: patched })
    .find((v) => v.id === "SOP-3.忌神.不能克.2");
  assert.equal(after.成立, false,
    "把 CSV 里那一爻改成发动之后,「忌神静临空破」还是成立。\n"
    + "  → 求值器没有在读这张表。它读的是别的地方,而那意味着这张表\n"
    + "    缺什么、够不够用,从此没人知道。");
}

/* ── ⑥ 给模型的文本:说清两件事,而且不带程序内部的名字 ─────────────── */
{
  const txt = format(boards[0].criteria);

  /* 必须说清的两件事。钉的是这两个主张,不是某一句话的字面 ——
     第一版断言写的是整句原话,改一次措辞就红一次,教人去改测试而不是读测试。 */
  assert.ok(/并列/.test(txt),
    "没有告诉读的人这些条目是并列的 —— 一串并排的断语会被读成一条推理链");
  assert.ok(/不分轻重|不判轻重/.test(txt),
    "没有说明此处不分轻重 —— 200 副盘里 60 副正反同时成立,"
    + "不说这一句,读的人会以为排在前面的更重要");
  assert.ok(naIds.size === 0 || /判不了/.test(txt),
    "判不了的那几条没有出现在文本里 —— 沉默和否定在读的人眼里一样");
  assert.ok(!/结论[:：]/.test(txt) && !/所以(能|不能)克/.test(txt),
    "文本里出现了结论");

  /* ⭐ 程序内部的名字不许出现在给人和给模型看的文本里。
     `lines` 是 CSV 的表名,`TABOO_AT_DAY_GROWTH` 是原子的内部标识 ——
     两样都是程序用来寻址的,对读的人是噪声。旧版写的是
     「凭:lines 第2爻 旺衰=囚」,现在是「依据 第2爻 旺衰囚」。 */
  assert.ok(!/\b(lines|edges|clock|board)\b/.test(txt),
    "文本里出现了 CSV 的英文表名 —— 那是程序寻址用的,读的人不知道是什么");
  assert.ok(!/[A-Z]{3,}_[A-Z_]+/.test(txt),
    "文本里出现了全大写的原子名 —— 那是内部标识,应当写它的中文名");
  assert.ok(!/[\u{1F300}-\u{1FAFF}\u{2190}-\u{21FF}\u{2600}-\u{27BF}\u{FE0F}]/u.test(txt),
    "文本里有表情符号 —— 这是给人读的正文,不是代码注释");
}

console.log(`ok   criteria-engine — ${N} 副盘 × 36 条:成立 ${on} · 不成立 ${off} · `
  + `判不了 ${na}(${naIds.size} 条缺原子),正反同时成立 ${bothSides}/${N}(这是设计),`
  + `逐爻互斥 ${checked} 次全对,${cited} 条引用格格对得上`);
