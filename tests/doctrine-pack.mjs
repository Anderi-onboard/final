/* 契约:补全包 20260914 完整、没被伪造、而且它的边界写在代码里。
   ────────────────────────────────────────────────────────────────────────
   这个包是 owner 自己校对过书页图像得来的(每条都带 pdf_page / printed_page /
   verification)。它不可再生 —— 所以这条契约钉的是三件事:

   ① **条数不许悄悄变少。** 少一条不会报错,只会让那条判据永远不参与。
   ② **`project_feature` 不许伪造。** 包里自己写着「当前包没有伪造
      project_feature……绑定必须由代码方对照当前提交完成」。填一个引擎发不出来的
      名字,那条判据**永远命中不了,而且不报错** —— 比留 null 糟得多。
   ③ **它是断法,不是网页资产。** 放在 functions/_lib/ 下面才拿不到;
      挪到 web root 就是把书连同判据一起开源了。

   ⚠️ 防空转:每一格都带下限断言。一个正则悄悄失配的扫描器会以全绿的样子失效。
*/
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import vm from "node:vm";

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const DIR = ROOT + "/functions/_lib/doctrine/pack-20260914";
const read = (f) => readFileSync(DIR + "/" + f, "utf8");
const lines = (f) => read(f).split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l));

/* ── ① 条数 ─────────────────────────────────────────────────────────────
   下限不是定值:加东西不该变成一次测试失败(那教人改测试而不是读测试)。
   不能发生的是集合**悄悄变小**。 */
const COUNTS = [
  ["sop3-36.jsonl", 36, "SOP-3 动态演变判据"],
  ["sop5-10.jsonl", 10, "SOP-5 应期判据"],
  ["exam-rules-10.jsonl", 10, "考试六正四反"],
  ["exam-types-3.jsonl", 3, "考试三个主机制类型"],
  ["mappings-29.jsonl", 29, "象义映射卡"],
  ["gold-cases-12.jsonl", 12, "金标验例"]
];
for (const [file, min, what] of COUNTS) {
  const rows = lines(file);
  assert.ok(rows.length >= min, `${what} 只剩 ${rows.length} 条(应 ≥ ${min})—— 集合缩水了`);
  for (const r of rows) {
    assert.ok(r.id, `${file} 里有一行没有 id`);
  }
}
for (const f of ["linepos-shensha-18.json", "six-relations-spirits-11.json"]) {
  const j = JSON.parse(read(f));
  const n = Array.isArray(j) ? j.length : Object.keys(j).length;
  assert.ok(n >= 2, `${f} 解析出来只有 ${n} 项 —— 文件坏了或者被清空了`);
}

/* ── 来源不许丢。这个包的全部价值就是**每一条都能翻回书页上那一页**;
   去掉来源它就退化成一份听起来很像的散文。 */
let sourced = 0;
for (const r of lines("sop3-36.jsonl").concat(lines("sop5-10.jsonl"))) {
  const s = r.来源 || r.source;
  assert.ok(s && s.pdf_page && s.printed_page, `${r.id} 没有书页出处`);
  assert.ok(r.原文 || r.original, `${r.id} 没有原文 —— 那一格不可再生,不能空`);
  sourced++;
}
assert.equal(sourced, 46, `只核到 ${sourced} 条带出处的判据,应当是 46 —— 扫描器失配了`);

/* ── ② 别名表:填上的必须真的发得出来,填不上的必须留 null ──────────────── */
const alias = JSON.parse(read("feature-alias-map.json"));
assert.ok(Array.isArray(alias.rows) && alias.rows.length >= 34,
  `别名表只剩 ${alias.rows ? alias.rows.length : 0} 行(应 ≥ 34)`);

const sandbox = { console };
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(readFileSync(ROOT + "/liuyao-features.js", "utf8"), sandbox, { filename: "f.js" });
const emits = new Set(sandbox.BWFeatures.vocabulary().concat(sandbox.BWFeatures.fromM1));
assert.ok(emits.size >= 29, `vocabulary() 只有 ${emits.size} 个 —— 供给侧缩水了`);

let bound = 0, blocked = 0;
for (const r of alias.rows) {
  if (r.project_feature) {
    assert.ok(emits.has(r.project_feature),
      `别名表把 ${r.canonical_feature} 绑到了 ${r.project_feature},而 liuyao-features.js `
      + "永远不发这个 id —— 那条判据会永远命中不了,**而且不报错**。填不上就留 null");
    bound++;
  } else {
    assert.equal(r.action, "blocked",
      `${r.canonical_feature} 没有 project_feature,却也没标 blocked —— `
      + "一个说不清自己接没接上的条目,和一个接错了的条目一样危险");
    assert.ok(r.note && r.note.length > 5, `${r.canonical_feature} 标了 blocked 但没说为什么`);
    blocked++;
  }
}
assert.ok(bound >= 31, `只接上 ${bound} 条(应 ≥ 31)—— 接线退步了`);

/* ── ③ 边界:它是断法,不能出现在 web root ───────────────────────────────
   ⚠️ 量的是 git 跟踪的东西。部署就是一次 checkout,本地未跟踪的文件永远到不了
   生产 —— 反过来,扫工作树会让一个**已跟踪的泄漏**在本地缺失时通过。
   prompt-secrecy.mjs 为同一件事写过同一条。 */
const tracked = execFileSync("git", ["-C", ROOT, "ls-files"], { encoding: "utf8" })
  .split("\n").filter(Boolean);
assert.ok(tracked.length > 50, `git ls-files 只回了 ${tracked.length} 个 —— 这条检查在空转`);
const packFiles = tracked.filter((p) => /pack-20260914/.test(p));
assert.ok(packFiles.length >= 9, `包里只有 ${packFiles.length} 个文件被跟踪(应 ≥ 9)`);
for (const p of packFiles) {
  assert.ok(p.startsWith("functions/_lib/"),
    `${p} 不在 functions/_lib/ 下面 —— 这是《增删卜易》原文加判据,`
    + "挪出去就是把书连同断法一起开源了");
}

/* ── ④ 包自己声明的三条边界,要在代码里成立 ────────────────────────────── */
assert.ok(existsSync(DIR + "/README.md"), "包的 README 没了 —— 它记着还差什么");
const readme = read("README.md");
assert.match(readme, /还没做的,而且知道没做/,
  "README 里那段「还没做」删了 —— 一个只写做了什么的交付说明,读起来像做完了");
/* 「MULTIPLE_PLAUSIBLE_INTERPRETATIONS 是推理状态,不是事实检索键」—— 包里明写的,
   而仓库侧早就这么做了。两边同时成立才算接上。 */
const feat = readFileSync(ROOT + "/liuyao-features.js", "utf8");
assert.match(feat, /NOT_A_FACT[\s\S]{0,120}MULTIPLE_PLAUSIBLE_INTERPRETATIONS/,
  "MULTIPLE_PLAUSIBLE_INTERPRETATIONS 不再被标成「不是事实」—— 包里明写着它是推理状态");

console.log(`ok   doctrine-pack — 46 条判据带书页出处、${bound} 条接上 / ${blocked} 条如实留空、`
  + `${packFiles.length} 个文件全在 _lib 下`);
