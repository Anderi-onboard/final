/* 契约:书中例回放 —— 书上断过的卦,程序断出来的要和书一样,而且只许越来越一样。
   ────────────────────────────────────────────────────────────────────────
   `pack-20260914/gold-cases-12.jsonl` 是《增删卜易》里十二个断过、后来应验了的卦
   (占什么、月日、本卦之变卦、书上怎么断、后来怎么验、书页)。拿书上的月日和卦
   把盘原样重建出来,跑现在的程序,看两件事:

     ① 书上断这一卦时引的那几条判据,程序认不认(成立没有)。
     ② 裁决梯的定案,和书上的吉凶有没有相反。

   ⭐⭐ 为什么这是数据库的验收线:判据和裁决梯里凡是**我从摘要推出来**的规则,
      书自己的例子一跑就露馅。2026-09-23 第一次回放:书上判吉的十卦,梯子判凶八卦 ——
      第一步把八纯卦的例子推广到了所有卦上(六卦),第三步把用神官鬼化官鬼当成「化鬼」、
      把墓被冲破的化墓和同时是化进神的化墓都当成败局;引擎还不认土的进退神
      (书上引的判据 27 条只成立 11 条)。这些都修了,数字就是下面那两条下限。

   ⚠️ 两栏是**本仓库标的**,不是包里的字段:每一卦的用神(照书上 focus 里被读的那一方)
      和书上断的吉凶(照 expected 那句话)。建库时请把它们直接写进书中例记录
      (`用神`、`吉凶` 两个字段),这里会优先读记录里的,标注只是没有时的兜底。

   ⚠️ 只许越来越好:`MIN_FIRED` 只许调高、`MAX_CONTRADICT` 只许调低。改了引擎
      或判据以后这里红了,先看是哪一卦变了 —— 输出里每一卦都列着。
*/
import assert from "node:assert/strict";
import fs from "node:fs";
import { engine, ROOT } from "../tools/lab/board.mjs";
import { judge, resolve } from "../functions/_lib/doctrine/criteria.js";
import { timing } from "../functions/_lib/doctrine/timing.js";
import { loadCriteria, loadTiming } from "../functions/_lib/doctrine/criteria-rules.mjs";

const MIN_FIRED = 18;       // 书上引的 SOP-3/SOP-5 判据,程序认得的条数(27 条里)
const MAX_CONTRADICT = 1;   // 裁决梯定凶、书上断吉的卦数(剩下那一卦是 008,见下)

/* ── 六十四卦:按京房八宫生成,不是逐个手写 ─────────────────────────────
   每宫八卦依次是 本宫、一世……五世、游魂、归魂。一世翻初爻,二世翻初二爻……五世翻到五爻;
   游魂是五世再把四爻翻回来;归魂是本宫只翻五爻。世爻依次在 6 1 2 3 4 5 4 3。
   ⭐ 这张表不另写卦象组成 —— 它自己的正确性由引擎的卦宫表来核(下面第一段),
      两边任何一边抄错一个字,这条契约当场红。 */
const PALACES = {
  乾: ["乾", "姤", "遁", "否", "观", "剥", "晋", "大有"],
  坎: ["坎", "节", "屯", "既济", "革", "丰", "明夷", "师"],
  艮: ["艮", "贲", "大畜", "损", "睽", "履", "中孚", "渐"],
  震: ["震", "豫", "解", "恒", "升", "井", "大过", "随"],
  巽: ["巽", "小畜", "家人", "益", "无妄", "噬嗑", "颐", "蛊"],
  离: ["离", "旅", "鼎", "未济", "蒙", "涣", "讼", "同人"],
  坤: ["坤", "复", "临", "泰", "大壮", "夬", "需", "比"],
  兑: ["兑", "困", "萃", "咸", "蹇", "谦", "小过", "归妹"]
};
const TRI = { 乾: [1, 1, 1], 兑: [1, 1, 0], 离: [1, 0, 1], 震: [1, 0, 0],
              巽: [0, 1, 1], 坎: [0, 1, 0], 艮: [0, 0, 1], 坤: [0, 0, 0] };   // 初爻在前
const FLIPS = [[], [0], [0, 1], [0, 1, 2], [0, 1, 2, 3], [0, 1, 2, 3, 4], [0, 1, 2, 4], [4]];
const WORLD = [6, 1, 2, 3, 4, 5, 4, 3];
const HEX = {};
for (const [p, names] of Object.entries(PALACES)) {
  names.forEach((n, i) => {
    const lines = [...TRI[p], ...TRI[p]];
    FLIPS[i].forEach((k) => { lines[k] = 1 - lines[k]; });
    HEX[n] = { lines, palace: p, world: WORLD[i] };
  });
}
assert.equal(Object.keys(HEX).length, 64, "六十四卦表不是 64 个名字 —— 有重名或漏写");

const win = engine();
const L = win.BWLiuYao;
const computeBoard = (lines, changeIdx, monthBranch, dayGanzhi) => L.computeBoard({
  lines: lines.map((y) => ({ yang: !!y })), changeIdx, monthBranch, dayGanzhi,
  date: new Date(Date.UTC(2026, 0, 1, 12)), method: "sortis", name: null, transformedName: null
});

/* ① 卦表和引擎的卦宫表互相核 */
for (const [n, h] of Object.entries(HEX)) {
  const b = computeBoard(h.lines, [], 0, 0);
  const pal = String(b.ben.palace.cn || "").replace("宫", "");
  assert.equal(pal, h.palace, `${n}:按八宫生成是${h.palace}宫,引擎说是${pal}宫 —— 两边有一边错了`);
  assert.equal(b.ben.worldLi + 1, h.world, `${n}:按八宫生成世在第${h.world}爻,引擎说第${b.ben.worldLi + 1}爻`);
}

/* ── 本仓库的标注(建库以后由记录自己带)──────────────────────────────
   key 是 liuyao-ai.js 的用神键;tone 是书上的吉凶;jt 是书上点名的进退神那一爻。 */
const ANNOT = {
  "GOLD-ZSXY-001": { key: "officer", tone: "吉" },
  "GOLD-ZSXY-002": { key: "wealth", tone: "吉", jt: [5, "进神"] },   // 财持世未化戌「化进」
  "GOLD-ZSXY-003": { key: "officer", tone: "凶", jt: [2, "退神"] },  // 官辰化丑「化退神」
  "GOLD-ZSXY-004": { key: "officer", tone: "吉", jt: [6, "退神"] },  // 子孙戌化未「化退」
  "GOLD-ZSXY-005": { key: "wealth", tone: "凶", jt: [3, "进神"] },   // 兄弟丑化辰「化进神」
  "GOLD-ZSXY-006": { key: "parent", tone: "吉", jt: [6, "进神"] },   // 父母未化戌「化进神」
  "GOLD-ZSXY-007": { key: "self", tone: "吉" },
  "GOLD-ZSXY-008": { key: "peer", tone: "吉", jt: [6, "退神"] },     // 兄弟戌化未「化退神」
  "GOLD-ZSXY-009": { key: "officer", tone: "吉" },
  "GOLD-ZSXY-010": { key: "parent", second: "officer", tone: "吉", jt: [6, "进神"] }, // 父母未化戌
  "GOLD-ZSXY-011": { key: "officer", tone: "吉" },
  "GOLD-ZSXY-012": { key: "self", tone: "吉" }
};
const SIX_KEY = { 父母: "parent", 兄弟: "peer", 子孙: "output", 妻财: "wealth", 官鬼: "officer", 世爻: "self" };

const BR = "子丑寅卯辰巳午未申酉戌亥", ST = "甲乙丙丁戊己庚辛壬癸";
const rules = loadCriteria(), trules = loadTiming();
const gold = fs.readFileSync(`${ROOT}/functions/_lib/doctrine/pack-20260914/gold-cases-12.jsonl`, "utf8")
  .trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));

let cited = 0, fired = 0, contradict = 0, jtChecked = 0;
const report = [];
for (const g of gold) {
  const a = ANNOT[g.id] || {};
  const key = SIX_KEY[g.用神] || a.key;
  const tone = g.吉凶 || a.tone;
  assert.ok(key && tone, `${g.id} 没有用神或书上的吉凶 —— 记录里写上「用神」「吉凶」两个字段`);

  const [benName, bianName] = String(g.hexagram).split("之");
  const ben = HEX[benName], bian = HEX[bianName];
  assert.ok(ben && bian, `${g.id} 的卦「${g.hexagram}」拆不出两个认得的卦名(认得的是八宫那 64 个)`);
  const md = String(g.month_day).match(/^(.)月(.)(.)日$/);
  assert.ok(md, `${g.id} 的月日「${g.month_day}」不是「X月XX日」`);
  const mb = BR.indexOf(md[1]), s = ST.indexOf(md[2]), b = BR.indexOf(md[3]);
  assert.ok(mb >= 0 && s >= 0 && b >= 0 && s % 2 === b % 2, `${g.id} 的月日「${g.month_day}」不是合法的干支`);
  let gz = 0; while (!(gz % 10 === s && gz % 12 === b)) gz++;

  const changeIdx = ben.lines.map((y, i) => (y !== bian.lines[i] ? i : -1)).filter((i) => i >= 0);
  const board = computeBoard(ben.lines, changeIdx, mb, gz);
  const subject = { key, second: a.second || null, why: "书中例", matched: true, source: "gold" };
  const roles = win.BWLiuYaoAI.deriveRoles(board, key);
  const csv = win.BWCsv.tables(board, win.BWRelations.compute(board), roles, subject);
  const crit = judge(rules, csv);
  resolve(crit);
  const tm = timing(trules, board, roles, L.BRANCH);
  const ladder = win.BWVerdict.judge(board, roles, subject);

  /* 书上点名的进退神,引擎要认得出来 —— 土的那几卦就是靠这一条钉住的 */
  if (a.jt) {
    const [n, want] = a.jt;
    const t = board.lines[n - 1].transform;
    assert.ok(t && t.jinTui && t.jinTui.cn === want,
      `${g.id} ${g.question}:书上说第 ${n} 爻${want},引擎算出来是「${t && t.jinTui ? t.jinTui.cn : "不是进退神"}」`
      + `(${board.lines[n - 1].branch.cn}化${t ? t.branch.cn : "?"})`);
    jtChecked++;
  }

  /* 第一步「卦变回头克」:书上的例子只有八纯卦变八纯卦,这十二卦一卦都不是 */
  const s1 = ladder.primary.steps.find((x) => x.step === 1);
  assert.ok(!s1.fired, `${g.id} ${g.question}:第一步「卦变回头克」开了(${s1.why})。`
    + "书上断这一卦是" + tone + ",而第一步不看用神直断凶 —— 它又被推广到了书上没见过的卦上");

  const miss = [];
  for (const id of g.rules.filter((x) => /^SOP-[35]\./.test(x))) {
    cited++;
    const v = crit.find((x) => x.id === id) || tm.find((x) => x.id === id);
    assert.ok(v, `${g.id} 引的 ${id} 在判据和应期两张表里都找不到`);
    if (v.成立 === true) fired++;
    else miss.push(id + (v.成立 === null ? "(判不了)" : ""));
  }
  const got = String(ladder.verdict).startsWith("凶") ? "凶" : "未定";
  const bad = got === "凶" && tone === "吉";
  if (bad) contradict++;
  report.push(`   ${g.id.slice(-3)} ${g.hexagram.padEnd(5, "　")} 书${tone} 梯${got}${bad ? " ✗" : "  "}`
    + (miss.length ? `  没认出:${miss.join(" ")}` : ""));
}

assert.equal(report.length, 12, `只回放了 ${report.length} 个书中例 —— 包里是 12 个`);
assert.ok(cited >= 25 && jtChecked >= 7, `只核到 ${cited} 条引用、${jtChecked} 处进退神 —— 这条契约在空转`);
const table = report.join("\n");
assert.ok(fired >= MIN_FIRED,
  `书上引的判据程序只认出 ${fired}/${cited} 条(下限 ${MIN_FIRED})。哪一卦少了:\n${table}`);
assert.ok(contradict <= MAX_CONTRADICT,
  `裁决梯在 ${contradict} 个书上断吉的卦上定了凶(上限 ${MAX_CONTRADICT}):\n${table}`);

console.log(`ok   gold-replay — 12 个书中例:引的判据认出 ${fired}/${cited} 条,梯子和书相反 ${contradict} 卦,`
  + `土的进退神 ${jtChecked} 处都认得,六十四卦和引擎的卦宫表逐个对上`);
if (process.env.GOLD_VERBOSE) console.log(table);
