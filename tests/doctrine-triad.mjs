/* 契约:判据三方对账 —— 原文、依赖事实、规则表达式,三样说的要是同一件事。
   ────────────────────────────────────────────────────────────────────────
   补全包每一条判据有三份写法:书上的**原文**、转写人列的**依赖事实**、
   程序真正求值的**规则表达式**。程序只看表达式,所以另外两份写错了没有任何东西会响。

   ⭐⭐ 2026-09-23 手修过的 7 条里,这个对账能机器抓出 5 条:
      进神.1/.2 —— 依赖事实写着「化进神」,表达式里没有 ADVANCE_SPIRIT,
                   于是任何动变旺衰相同的爻(连伏吟都算)都判成进神,400 副盘 292 次成立里只有 12 次是真的;
      三墓 日墓/动墓/化墓 —— 原文是「只验世爻入墓有三」,主体写成了用神。
      下面那段自检把这两种错**原样放回去**,必须报出来 —— 对账要是抓不到它们,它就是在空转。

   书在建库。新录的每一条都会走这一遍:依赖事实里出现字典没有的词,这里就红,
   要么给字典加一行(说清那个词对应哪一类原子),要么改那条记录 —— 不许悄悄放过。
*/
import assert from "node:assert/strict";
import { loadCriteria, loadTiming } from "../functions/_lib/doctrine/criteria-rules.mjs";

/* 依赖事实里的词 → 表达式里应当出现的原子 */
const FACT_ATOM = {
  "旺衰": /_(STRONG|WEAK)$/,
  "动爻旺衰": /^MOVING_LINE_(STRONG|WEAK)$/, "变爻旺衰": /^TRANSFORMED_LINE_(STRONG|WEAK)$/,
  "动变旺衰": /^BOTH_LINES_STRONG$/,
  "临日辰": /_AT_DAY$/, "临月建": /_AT_MONTH$/,
  "日辰生": /^DAY_GENERATES_/, "月建生": /^MONTH_GENERATES_/, "动爻生": /^MOVING_LINE_GENERATES_/,
  "发动": /_(MOVING|STATIC)(_|$)/, "发动=false": /_STATIC$/, "发动=true": /_MOVING$/,
  "元神发动": /^ORIGIN_MOVING$/, "忌神发动": /^TABOO_MOVING$/, "仇神发动": /^ENEMY_MOVING$/,
  "回头生": /^RETURN_GENERATION$/, "回头克": /^RETURN_CONTROL$/,
  "化进神": /ADVANCE_SPIRIT$/, "化退神": /RETREAT_SPIRIT$/,
  "日辰十二长生=长生": /_AT_DAY_GROWTH$/, "日辰十二长生=帝旺": /_AT_DAY_PROSPERITY$/,
  "旬空": /XUN_EMPTY$/, "化空": /^TRANSFORM_EMPTY$|^MOVING_OR_TRANSFORMED_XUN_EMPTY$/,
  "月破": /MONTH_BREAK$|^MOVING_OR_TRANSFORMED_BREAK$/, "化破": /^TRANSFORM_BREAK$|^MOVING_OR_TRANSFORMED_BREAK$/,
  "日月动爻克": /_CONTROLLED$/, "日月动爻生扶": /^MOVING_LINE_SUPPORTED$/,
  "绝": /AT_ABSOLUTE$|_OR_ABSOLUTE$/, "化绝": /^TRANSFORM_ABSOLUTE$/, "化散": /^TRANSFORM_SCATTER$/,
  /* 应期那条「入三墓」的触发原子是 TARGET_IN_ANY_TOMB,一个原子管三种墓 */
  "日墓": /DAY_TOMB$|ANY_TOMB$/, "动墓": /MOVING_TOMB$|ANY_TOMB$/, "化墓": /TRANSFORMS_TOMB$|ANY_TOMB$/,
  "入墓": /TOMB/, "随鬼入墓": /FOLLOWS_GHOST/,
  "冲墓": /^TOMB_(OPENED_BY_CLASH|CLASHED_OR_BROKEN_BY_DAY_MONTH_OR_MOVING_LINE)$/,
  "日月动爻冲墓": /^TOMB_CLASHED_OR_BROKEN_BY_DAY_MONTH_OR_MOVING_LINE$/,
  "墓库月破": /^TOMB_CLASHED_OR_BROKEN_BY_DAY_MONTH_OR_MOVING_LINE$/,
  "近事": /^NEAR_TERM$/,
  /* 应期那十条的触发事实 */
  "太旺": /OVERSTRONG$/, "旺衰=休囚死": /WEAK/,
  "与月合": /COMBINED$/, "动爻相合": /COMBINED$/, "动化合": /COMBINED$/
};
/* 原文里的字 → 依赖事实里至少要有其中一个。只收词面没有歧义的几个
   (「帝旺」里有「旺」、「动爻变爻」里有「动」,所以不拿单字去对)。
   ⚠️ 只对断法判据(SOP-3)做:应期那十条的原文**连着说条件和应** ——
      「太旺者,逢墓逢冲」里的墓是应在哪天,不是触发条件。 */
const TEXT_FACT = [
  [/进神/, ["化进神"]], [/退神/, ["化退神"]],
  [/回头生/, ["回头生"]], [/回头克/, ["回头克"]],
  [/旺相|休囚|衰/, ["旺衰", "动爻旺衰", "变爻旺衰", "动变旺衰", "旺衰=休囚死"]],
  [/长生/, ["日辰十二长生=长生"]], [/帝旺/, ["日辰十二长生=帝旺"]],
  [/绝/, ["绝", "化绝"]], [/散/, ["化散"]],
  [/墓/, ["日墓", "动墓", "化墓", "入墓", "随鬼入墓", "冲墓", "日月动爻冲墓", "墓库月破"]],
  [/空/, ["旬空", "化空"]], [/月破|空破/, ["月破", "化破", "墓库月破"]]
];
const ATOM = /[A-Z][A-Z_0-9]+/g;
const atomsOf = (e) => (String(e).match(ATOM) || []).filter((x) => !["AND", "OR", "XOR", "NOT"].includes(x));

/* 一条记录 → 它哪里对不上。`use` 允许拿别的表达式/主体去核(自检用)。 */
function audit(r, use = {}) {
  const m = r.机器值 || {};
  const expr = use.expr ?? (m.规则表达式 || m.触发表达式 || "");
  const facts = m.依赖事实 || m.触发事实 || [];
  const subj = use.subj ?? m.主体;
  const A = atomsOf(expr), out = [];
  for (const f of facts) {
    const re = FACT_ATOM[f];
    if (!re) out.push(`依赖事实「${f}」字典里没有 —— 给 FACT_ATOM 加一行,写清它对应哪一类原子`);
    else if (!A.some((a) => re.test(a))) out.push(`依赖事实写了「${f}」,表达式里没有对应的原子`);
  }
  for (const a of A) {
    if (!facts.some((f) => FACT_ATOM[f] && FACT_ATOM[f].test(a))) out.push(`表达式里的 ${a} 在依赖事实里没有对应的词`);
  }
  for (const [re, want] of m.规则表达式 ? TEXT_FACT : []) {
    if (re.test(r.原文) && !facts.some((f) => want.includes(f))) {
      out.push(`原文有「${r.原文.match(re)[0]}」,依赖事实里没有`);
    }
  }
  if (subj && /世爻/.test(r.原文) && subj !== "世爻") out.push(`原文说的是世爻,主体写成了「${subj}」`);
  return out;
}

const records = [...loadCriteria(), ...loadTiming()];
assert.ok(records.length >= 46, `只读到 ${records.length} 条 —— 包里是 36 + 10`);

/* ① 现在的包:每一条三方都对得上 */
const bad = records.map((r) => [r.id, audit(r)]).filter(([, o]) => o.length);
assert.equal(bad.length, 0, "三方对不上:\n" + bad.map(([id, o]) => "  " + id + "\n" + o.map((x) => "     · " + x).join("\n")).join("\n"));

/* ② 自检:把 09-23 之前的错原样放回去,必须报出来 */
const caught = [];
for (const r of records.filter((x) => x.本仓库改动)) {
  const c = r.本仓库改动;
  const o = audit(r, { expr: c.原表达式 && !/^TARGET_/.test(c.原表达式) ? c.原表达式 : undefined,
                       subj: c.原主体 || undefined });
  if (o.length) caught.push(r.id);
}
for (const id of ["SOP-3.进神.1", "SOP-3.进神.2", "SOP-3.三墓.日墓", "SOP-3.三墓.动墓", "SOP-3.三墓.化墓"]) {
  assert.ok(caught.includes(id), `自检:${id} 改之前的错放回去以后,对账没报 —— 它在空转`);
}

console.log(`ok   doctrine-triad — ${records.length} 条判据/应期,原文 · 依赖事实 · 表达式三方对得上;`
  + `把 09-23 之前的 ${caught.length} 处错放回去,一处不漏全报出来`);
