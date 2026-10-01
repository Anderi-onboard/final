/* 判据规则的读取 · **node only** —— 和求值器分开的唯一理由就是这个。
   ────────────────────────────────────────────────────────────────────────
   `criteria.js` 是纯函数:给它规则和四张表,它求值。规则从哪来它不管。
   这里是 node 侧的来源(调试台、ComfyUI 桥、契约都走它),读的是补全包原件。

   ⚠️ **不把 jsonl 转成一个 .js 常量文件。** 那会造出本仓库付过四次学费的
      「第二张名单」:包里改一条,生成的那份不动,而**两份都是合法的 JS,
      谁也不会报错**。要在 Pages Functions 里用,由那边注入同一份规则,
      不是在这里 `fs.readFileSync`(Workers 没有 fs,本地跑得通、上线才炸)。
*/
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "pack-20260914");

function jsonl(file) {
  return fs.readFileSync(path.join(DIR, file), "utf8")
    .trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
}

/* SOP-3 的 36 条:断法判据,有 `规则表达式`。
   ⚠️ SOP-5 那 10 条**不在这里**:它们没有 `规则表达式`,是另一种形状
      (`触发表达式` + `应` + `尺度`),是应期规则不是断法判据。
      混进同一个数组,求值器会对每一条都报「算不出来」,
      而那读起来像「这副盘信息不够」,不是「这十条根本不该走这条路」。 */
export function loadCriteria() {
  return jsonl("sop3-36.jsonl");
}

/* 应期那 10 条,原样返回。这里不求值 —— 留给它自己的那一步。 */
export function loadTiming() {
  return jsonl("sop5-10.jsonl");
}

/* SOP-6 象义:六亲、六神、爻位,各带类目和书页出处。
   ⭐ 一个象对应好几种现实时,候选**只许从这里取** —— 模型从记忆里掏出来的
      「白虎主破损」和包里的「白虎:伤灾、血光……破坏」长得一样,
      而只有后者翻得回书页。 */
export function loadSymbols() {
  const rs = JSON.parse(fs.readFileSync(path.join(DIR, "six-relations-spirits-11.json"), "utf8"));
  const ls = JSON.parse(fs.readFileSync(path.join(DIR, "linepos-shensha-18.json"), "utf8"));
  const pick = (o, kind) => Object.fromEntries(Object.entries(o).filter(([, v]) => v.kind === kind));
  return {
    liuqin: pick(rs, "six_relation"),
    spirits: pick(rs, "six_spirit"),
    linepos: pick(ls, "linepos")
  };
}
