/* 解谜管线 · 程序出题的那一步 · 服务端 only
   ────────────────────────────────────────────────────────────────────────
   ⚠️ 实验中,还没接上线。线上仍是 M1→M4 四站;这条先在
      `tools/lab/puzzle.mjs` 上跑,owner 一句一句改定了再接。

   一卦 = 一道谜。程序出题,模型解题:

     M1(模型)读问题
       → 程序:把盘拆成线索(这个文件)
       → 每条线索一个模型,并联,各写一句「这条在他这件事里是什么」
       → 解谜(最后一个模型):拼起来、补细节、斟酌文字、用他的语言写出来

   这个文件全是代码,不调模型。它交出来的东西:
     线索     每条成立的判据、裁决梯走过的每一步、卦形、(问了时间时)每条应期,各一条
     验现事   盘上说「现在」的那几处(三合、三会成局),单独并联一个模型拿他的原话对照
     指向     能从判据和角色直接读出方向的,标上;读不出的不标
     打架     同一爻上能与不能同时成立的,摆在一起;程序能裁的已经裁了(`criteria.resolve`)
     谁是谁   每一方在他生活里是什么,只定一次,所有线索和解谜拿同一本
     现实依据 他说的事实,按 M1 标的六亲落到盘上
     细节素材 用神那几爻的六神、爻位象义(补全包),和这类事的读法卡

   ⚠️ 数据(判据规则、象义表、读法卡)由调用方给,这里不 import 数据文件 ——
      和 `criteria.js` 同一条理由:服务端没有 fs,一个本地跑得通、上线才炸的模块比没有更糟。
*/
import { basis } from "../doctrine/criteria.js";

/* CSV → 行对象。`liuyao-csv.js` 的 esc() 会给带逗号的值加引号,这里认引号。 */
export function parseCsv(csv) {
  const lines = String(csv || "").trim().split("\n");
  if (!lines.length || !lines[0]) return [];
  const split = (s) => {
    const out = [];
    let cur = "", q = false;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (q) {
        if (ch === '"' && s[i + 1] === '"') { cur += '"'; i++; }
        else if (ch === '"') q = false;
        else cur += ch;
      } else if (ch === '"') q = true;
      else if (ch === ",") { out.push(cur); cur = ""; }
      else cur += ch;
    }
    out.push(cur);
    return out;
  };
  const h = split(lines[0]);
  return lines.slice(1).map((l) => {
    const c = split(l), o = {};
    h.forEach((k, i) => { o[k] = c[i] === undefined ? "" : c[i]; });
    return o;
  });
}

/* 每一方的说法。⚠️ 这是「这个角色在五行上和用神是什么关系」,不是它在他生活里是什么 ——
   后者是「谁是谁」那一步的事,由事实和象义表定。 */
export const ROLE_SAYING = {
  用神: "他问的那一方",
  原神: "帮它的一方",
  忌神: "伤它的一方",
  仇神: "帮着伤它那一方的",
  泄神: "它往外送力气的地方"
};
const ROLE_HOW = { 原神: "生用神", 忌神: "克用神", 仇神: "生忌神", 泄神: "用神所生" };
/* 「忌神(伤它的一方)」—— 行文里提到一个角色时的写法,一处定义。 */
const roleText = (role) => role + "(" + ROLE_SAYING[role] + ")";
const roleFull = (role) => ROLE_SAYING[role] + (ROLE_HOW[role] ? ",即" + ROLE_HOW[role] : "");
const ROLE_ORDER = ["用神", "原神", "忌神", "仇神", "泄神"];
const POS = ["初爻", "二爻", "三爻", "四爻", "五爻", "六爻"];
const LIUQIN = ["父母", "兄弟", "子孙", "妻财", "官鬼"];

/* 指向:这条线索对他问的这件事是有利还是不利。
   ⚠️ 只标**从判据自己的结论和角色就读得出**的那几种。读不出的(泄神化进神之类)返回 null,
      交给解谜的人 —— 程序替它猜一个方向,和模型替它猜一个方向是同一个错。 */
export function direction(judgement, role) {
  switch (judgement) {
    case "能生": return { 向: "有利", 因: "帮它的那一方使得上劲" };
    case "不能生": return { 向: "不利", 因: "帮它的那一方使不上劲" };
    case "能克": return { 向: "不利", 因: "伤它的那一方伤得着" };
    case "不能克": return { 向: "有利", 因: "伤它的那一方伤不着" };
    case "入墓": return { 向: "不利", 因: "问的人自己被收住、困住(三墓说的是世爻)" };
    case "出墓": return { 向: "有利", 因: "问的人自己被困住的那一处被冲开" };
    case "进神":
    case "退神": {
      const up = judgement === "进神";
      const who = { 用神: "他问的那一方", 原神: "帮它的一方", 忌神: "伤它的一方", 仇神: "帮着伤它的一方" }[role];
      if (!who) return null;
      const good = (role === "用神" || role === "原神") === up;
      return { 向: good ? "有利" : "不利", 因: who + (up ? "在往前走" : "在往回退") };
    }
    default: return null;
  }
}

function toneDirection(tone, why) {
  if (tone === "凶") return { 向: "不利", 因: why || "裁决梯判凶" };
  if (tone === "吉") return { 向: "有利", 因: why || "裁决梯判吉" };
  return null;
}

/* 五行 → 这一问里的角色。`elements` 是 deriveRoles 给的 { yong, yuan, ji, chou, drain },
   值是引擎的五行序号(0 木 1 火 2 土 3 金 4 水 —— 引擎自己的顺序,不是另起的一张表)。 */
const WUXING = ["木", "火", "土", "金", "水"];
function roleOfElement(cn, elements) {
  if (!elements) return null;
  const gi = WUXING.indexOf(cn);
  const hit = [["yong", "用神"], ["yuan", "原神"], ["ji", "忌神"], ["chou", "仇神"], ["drain", "泄神"]]
    .find(([k]) => elements[k] === gi);
  return hit ? hit[1] : null;
}

/* 一个六亲在补全包象义表里的全部类目,原样。候选只许从这里取。 */
function symbolCats(card) {
  if (!card || !card.cats) return [];
  return Object.entries(card.cats).map(([类, 项]) => ({ 类, 项: 项.slice() }));
}
export function flatCandidates(cats) {
  return (cats || []).reduce((a, c) => a.concat(c.项), []);
}

/* 伏神那一格:「父母子(第1爻·飞克伏) 妻财子(第5爻)」→ [{ 六亲, 支, 爻, 关系 }]
   ⚠️ 几个伏神之间是**空格**分开的,不是斜杠 —— 第一版按斜杠切,第二个伏神整个丢了,
      用神正好是第二个的那几副盘上,字典里就没有用神。 */
function parseHidden(s) {
  const out = [];
  String(s || "").split(/[\s/]+/).forEach((part) => {
    const m = part.match(/^(父母|兄弟|子孙|妻财|官鬼)(.)\(第(\d)爻(?:·(.+?))?\)/);
    if (m) out.push({ 六亲: m[1], 支: m[2], 爻: Number(m[3]), 关系: m[4] || "" });
  });
  return out;
}

/* ── 谁是谁 ───────────────────────────────────────────────────────────── */
function whoIsWho({ L, B, subject, symbols, facts }) {
  const byRole = {};
  L.forEach((r) => { (byRole[r.角色] = byRole[r.角色] || []).push(r); });
  const roles = [];
  /* 用神不上卦:伏在某一爻下面。它仍然是这一问的主角 —— 字典里没有它,
     每条线索说到「它」的时候就不知道在说谁。 */
  if (!byRole["用神"]) {
    const h = parseHidden(B.伏神).find((x) => x.六亲 === B.用神);
    if (h) {
      roles.push({ 角色: "用神", 六亲: h.六亲, 爻: [], 伏: { 爻: h.爻, 支: h.支, 关系: h.关系 },
                   说法: ROLE_SAYING["用神"] + ",不上卦,伏在第" + h.爻 + "爻下",
                   指认: subject && subject.why ? subject.why : undefined });
    }
  }
  for (const role of ROLE_ORDER) {
    const rows = byRole[role];
    if (!rows) continue;
    const six = rows[0].六亲;
    const e = { 角色: role, 六亲: six, 爻: rows.map((r) => Number(r.爻)), 说法: roleFull(role) };
    const told = facts.filter((f) => f.tag === six);
    /* 用神是谁,程序按领域和性别已经定了(`subjectKey` 的 why);别的方只能靠他说的事实指认。 */
    if (role === "用神" && subject && subject.why) e.指认 = subject.why;
    if (told.length) e.他说的 = told.map((f) => f.text);
    if (!e.指认 && !told.length) e.候选 = symbolCats(symbols.liuqin[six]);
    roles.push(e);
  }
  const shi = L.find((r) => r.世应 === "世"), ying = L.find((r) => r.世应 === "应");
  return { roles, 世: shi ? Number(shi.爻) : null, 应: ying ? Number(ying.爻) : null };
}

function roleOfLine(L, n) {
  const r = L.find((x) => Number(x.爻) === n);
  return r ? r.角色 : "";
}
function whoLabel(dict, role, lines) {
  const e = dict.roles.find((x) => x.角色 === role);
  const pos = lines && lines.length ? "第" + lines.join("、") + "爻 " : "";
  if (!e) return pos + role;
  return pos + role + "·" + e.六亲 + "(" + e.说法 + ")"
    + (e.指认 ? ";在他的事里是:" + e.指认 : "")
    + (e.他说的 ? ";他说过:" + e.他说的.join(";") : "")
    + (e.候选 ? ";还没指认" : "");
}

/* ── 现实依据:他说的事实落到盘上 ─────────────────────────────────────── */
function groundFacts({ L, B, facts, dict }) {
  const hidden = parseHidden(B.伏神);
  return facts.map((f) => {
    if (!f.tag || f.tag === "无" || LIUQIN.indexOf(f.tag) < 0) {
      return { 事实: f.text, 六亲: null, 落点: "盘上没有对应,当作他给的前提" };
    }
    const rows = L.filter((r) => r.六亲 === f.tag);
    if (rows.length) {
      const role = rows[0].角色;
      return { 事实: f.text, 六亲: f.tag, 落点: "落在第" + rows.map((r) => r.爻).join("、") + "爻,这一问里它是" + roleText(role) };
    }
    const h = hidden.find((x) => x.六亲 === f.tag);
    if (h) return { 事实: f.text, 六亲: f.tag, 落点: f.tag + "不上卦,伏在第" + h.爻 + "爻下(" + h.关系 + ")" };
    return { 事实: f.text, 六亲: f.tag, 落点: "盘上没有" + f.tag };
  });
}

/* ── 摆桌子:这一卦的基本面,程序直接写,不让模型抄 ───────────────────── */
function table({ L, B, names }) {
  const moving = L.filter((r) => r.发动 === "是").map((r) => Number(r.爻));
  const flags = ["六冲卦", "六合卦", "变卦六冲", "变卦六合", "反吟", "伏吟", "归魂", "游魂", "独发", "独静", "尽静", "六爻乱动"]
    .filter((k) => B[k] === "是");
  return {
    本卦: (names && names.本卦) || B.卦 || "?",
    变卦: (names && names.变卦) || B.变卦 || "?",
    月建: B.月建, 日辰: B.日辰, 旬空: B.旬空,
    动爻: moving,
    世: Number(B.世) || null, 应: Number(B.应) || null,
    用神: B.用神, 用神爻: B.用神爻,
    卦形: flags,
    伏神: B.伏神 || ""
  };
}

/* ── 线索 ─────────────────────────────────────────────────────────────── */
function citeSource(rules, id) {
  const r = rules.find((x) => x.id === id);
  const s = r && r.来源;
  return s ? "《" + s.work + "》" + (s.chapter || "") + " 印刷页 " + s.printed_page : "";
}

function criterionClues({ criteria, rules, L, dict }) {
  const out = [];
  for (const v of criteria) {
    if (v.成立 !== true) continue;
    const lost = new Set((v.被裁 || []).map((x) => x.爻));
    const lines = v.爻.length ? v.爻.filter((n) => !lost.has(n)) : [];
    /* 所有爻上都输了 —— 这条不单独成线索,它在「打架」里带着。 */
    if (v.爻.length && !lines.length) continue;
    const role = lines.length ? roleOfLine(L, lines[0]) : "";
    const isWorld = v.主体 === "世爻";
    out.push({
      类: "判据",
      id: v.id,
      书上: v.原文 + (citeSource(rules, v.id) ? "(" + citeSource(rules, v.id) + ")" : ""),
      盘上: basis(v, lines.length ? lines : null).join(";"),
      谁: isWorld ? "第" + lines.join("、") + "爻 世爻,即问的人自己" : whoLabel(dict, role, lines),
      候选: isWorld ? null : ((dict.roles.find((x) => x.角色 === role) || {}).候选 || null),
      指向: direction(v.判, role),
      爻: lines,
      判: v.主体 + v.判
    });
  }
  return out;
}

function ladderClues({ ladderObj, dict, L }) {
  const out = [];
  const layers = [ladderObj && ladderObj.primary, ladderObj && ladderObj.second].filter(Boolean);
  layers.forEach((layer, li) => {
    layer.steps.forEach((s) => {
      if (!s.fired) return;
      out.push({
        类: "裁决梯",
        id: "SOP-4." + s.step + (li ? "(第二用神)" : ""),
        书上: "裁决梯第 " + s.step + " 步「" + s.rule + "」(SOP 里只有一行摘要,仓库里没有这一步的原文)",
        盘上: s.why || "",
        谁: layer.subject,
        候选: null,
        指向: toneDirection(s.tone, s.tone ? "裁决梯这一步判" + s.tone : null),
        爻: s.lines || [],
        判: s.rule + (layer.decisive && layer.decidedAt === s.step ? "(定案)" : "")
      });
    });
  });
  (ladderObj && ladderObj.shape || []).forEach((sh) => {
    /* ⚠️ 三合、三会成局**不在这里** —— 它们进「验现事」(见 presentChecks)。
       程序原来一律判吉(「事体久远坚牢」),可局是哪一方的五行决定它帮谁,
       仓库里又没有这一条的原文;owner 定的做法是不拿它断吉凶,拿它去对他现在的处境。 */
    if (/^三[合会]/.test(sh.tag)) return;
    out.push({
      类: "卦形",
      id: "卦形." + sh.tag,
      书上: sh.why + "(裁决梯模块里的判语,仓库里没有原文页码)",
      盘上: sh.tag,
      谁: "整副卦",
      候选: null,
      指向: toneDirection(sh.tone),
      爻: [],
      判: sh.tag
    });
  });
  if (ladderObj && ladderObj.hiddenYong) {
    /* 压在它上面的那一爻是谁,程序知道,线索模型不知道 —— 不写出来,它只能说
       「藏在别的事底下」,而「藏在他投出去的简历底下」才是这条线索的全部分量。 */
    const yong = dict.roles.find((e) => e.角色 === "用神");
    const fly = yong && yong.伏 ? yong.伏.爻 : null;
    out.push({
      类: "伏神", id: "伏神", 书上: "用神不上卦,须先断出伏(SOP 摘要,仓库里没有原文)",
      盘上: ladderObj.hiddenYong.why + (fly ? "压在它上面的是" + whoLabel(dict, roleOfLine(L, fly), [fly]) : ""),
      谁: whoLabel(dict, "用神", []), 候选: null, 指向: null, 爻: fly ? [fly] : [], 判: "用神伏藏"
    });
  }
  return out;
}

/* ── 验现事(owner 2026-09-23 定)────────────────────────────────────────
   盘上有几处说的是「**现在**」的局面,而不是结局。三合、三会成局就是:几个地支拧成一股,
   而那一股是哪一方的五行,程序算得出来;它在吉凶上帮谁,仓库里没有原文。
   所以它不当线索断吉凶,单独并联一个模型,拿他自己的话对一遍 —— 对上了,
   解读里提一句,那是这一卦**可以被他当场核对**的地方。

   ⭐⭐ 严谨的关键是它**得能输**:永远「对上」的验现事就是算命先生的开场白。
      所以模型只能答三样(对上 / 对不上 / 他没说),而说「对上」「对不上」必须把他的原话
      **原样抄出来** —— 抄不出来,`readVerifyAnswer` 按他没说算。
   ⚠️ 只收程序算得出结构的信号。月破、旬空这些「现在」的信号,等数据库里有它们象义的原文再加 ——
      没有原文就让模型自己说它像什么,正是 owner 说的「单纯用知识储备」。 */
function presentChecks({ ladderObj, elements, dict }) {
  const out = [];
  (ladderObj && ladderObj.shape || []).forEach((sh) => {
    const m = sh.tag.match(/^(三[合会])(.)局/);
    if (!m) return;
    const role = roleOfElement(m[2], elements);
    const e = role ? dict.roles.find((x) => x.角色 === role) : null;
    out.push({
      类: "验现事",
      id: "验现事." + sh.tag,
      信号: sh.tag,
      盘上: m[1] + "成" + m[2] + "局:几个地支拧成了一股" + m[2]
        + (role ? ";" + m[2] + "在这一问里是" + roleText(role) + "的五行" : ";这一股不是这一问里任何一方的五行"),
      谁: role ? whoLabel(dict, role, []) : "整副卦",
      候选: e && e.候选 ? e.候选 : null
    });
  });
  return out;
}

/* 验现事模型交回来的东西。格式:
     对照=<对上|对不上|他没说>
     他的原话=<原样抄他说的那一句;他没说写 无>
   `words` 是他打的原文。⭐ 说「对上」「对不上」却抄不出一句真在他原文里的话,一律按他没说算 ——
   一个模型编出来的「你说过……」,比什么都不说更伤这一篇。 */
export function readVerifyAnswer(item, text, words) {
  const s = String(text || "");
  const k = ((s.match(/对照\s*[=:：]\s*(对上|对不上|他没说)/) || [])[1] || "");
  const quote = ((s.match(/他的原话\s*[=:：]\s*(.+)/) || [])[1] || "").trim().replace(/^[「“"]|[」”"]$/g, "");
  const problems = [];
  if (!k) {
    problems.push("没有写「对照=对上/对不上/他没说」,按他没说算");
    return { 对照: "他没说", 原话: "", problems };
  }
  if (k === "他没说") return { 对照: k, 原话: "", problems };
  const norm = (x) => String(x || "").replace(/[\s,，。.!！?？、;；:：]/g, "");
  if (!quote || quote === "无" || !norm(words).includes(norm(quote))) {
    problems.push("说「" + k + "」,抄的却不是他原话里的句子(" + (quote || "空") + ")—— 按他没说算");
    return { 对照: "他没说", 原话: "", problems };
  }
  return { 对照: k, 原话: quote, problems };
}

function timingClues({ timing, dict }) {
  return (timing || []).filter((t) => t.成立 === true).map((t) => ({
    类: "应期",
    id: t.id,
    书上: t.原文,
    盘上: (t.应 || []).map((a) => a.说明).join(";") + (t.尺度 ? "(尺度:" + t.尺度 + ")" : ""),
    谁: whoLabel(dict, "用神", t.爻),
    候选: null,
    指向: { 向: "不标", 因: "应期只给时间候选,不改吉凶" },
    爻: t.爻 || [],
    判: "应期"
  }));
}

/* ── 对外 ─────────────────────────────────────────────────────────────── */
/* 一个问题出一道题。
   q        { n, ask, db, kind }             M1 解析出来的这一问
   facts    [{ text, tag }]                  M1 标了六亲的事实(整卦共用)
   board    { csv, criteria, fights, ladderObj, timing, subject }   程序算好的这一问的盘面
   rules    SOP-3 那 36 条(查书页出处用)
   symbols  { liuqin, spirits, linepos }     补全包象义表
   readers  [{ id, title, rule }]            这类事的读法卡(可空)
   names    { 本卦, 变卦 }                   卦名(可空;调试台不起名) */
export function buildPuzzle({ q, facts = [], flags = "", board, rules = [], symbols, readers = [], names = null }) {
  const L = parseCsv(board.csv.lines);
  const B = parseCsv(board.csv.board)[0] || {};
  /* 事实可以只属于某一问(M1 在方括号里写 |q2)。不分的话,「我在投简历」会被落到
     感情那一问的盘上,变成「帮着伤她的那一方」—— 一条和那一问无关的事实被读成了证据。 */
  facts = facts.filter((f) => !f.q || f.q === q.n);
  const dict = whoIsWho({ L, B, subject: board.subject, symbols, facts });
  const primary = board.ladderObj && board.ladderObj.primary;
  const fixed = board.ladderObj && (board.ladderObj.verdict === "凶" || (primary && primary.decisive))
    ? { 吉凶: board.ladderObj.verdict === "凶" ? "凶" : primary.tone,
        为什么: primary && primary.decisive ? "裁决梯第 " + primary.decidedAt + " 步:" + primary.note : "两个用神里有一个判凶,缺一不可" }
    : null;

  let clues = criterionClues({ criteria: board.criteria, rules, L, dict })
    .concat(ladderClues({ ladderObj: board.ladderObj, dict, L }));
  if (q.kind === "什么时候") clues = clues.concat(timingClues({ timing: board.timing, dict }));
  clues.forEach((c, i) => { c.编号 = "q" + q.n + "." + (i + 1); });
  const present = presentChecks({ ladderObj: board.ladderObj, elements: board.roles && board.roles.elements, dict });
  present.forEach((c, i) => { c.编号 = "q" + q.n + ".验" + (i + 1); });

  const byUse = L.filter((r) => r.角色 === "用神");
  const details = byUse.map((r) => ({
    爻: Number(r.爻),
    六神: r.六神,
    六神象: symbolCats(symbols.spirits[r.六神]),
    爻位: POS[Number(r.爻) - 1],
    爻位象: symbolCats(symbols.linepos[POS[Number(r.爻) - 1]])
  }));

  return {
    问: q,
    摆桌子: table({ L, B, names }),
    定死的: fixed,
    线索: clues,
    验现事: present,
    打架: (board.fights || []).map((f) => ({ ...f })),
    谁是谁: dict,
    现实依据: groundFacts({ L, B, facts, dict }),
    细节素材: details,
    读法卡: readers.filter((c) => (c.requires || []).every((req) => met(req, { flags, dict, board })))
  };
}

/* 读法卡的 `requires`:这张卡什么时候才该拿出来。判不了的条件当作不满足 ——
   多给一张不该给的卡,解谜的人会照着它读(「替无关第三方起卦时……」出现在自己问自己的解读里)。 */
function met(req, { flags, dict, board }) {
  const yong = dict.roles.find((e) => e.角色 === "用神");
  if (req === "替人占") return /替人占/.test(flags || "");
  if (req === "伏藏") return !!(yong && yong.伏);
  if (req === "合") {
    const keep = new Set((yong ? yong.爻 : []).concat(dict.世 ? [dict.世] : []).map(String));
    const B = parseCsv(board.csv.board)[0] || {};
    if (/合/.test(B.世应关系 || "")) return true;
    return parseCsv(board.csv.edges).some((e) => e.关系 === "合" && e.成立 === "是" && (keep.has(e.从) || keep.has(e.到)));
  }
  return false;
}

/* 线索模型交回来的东西。格式:
     这一卦里=<一句>
     候选=<A>|<B>          (只有「还没指认」的那一方才写)
   ⭐ 候选只许是补全包名单上的词 —— 程序在这里核,不信模型自己说「这是名单上的」。 */
export function readClueAnswer(clue, text) {
  const s = String(text || "");
  const line = (s.match(/这一卦里\s*[=:：]\s*(.+)/) || [])[1] || "";
  const cand = ((s.match(/候选\s*[=:：]\s*(.+)/) || [])[1] || "").split(/[|｜]/).map((x) => x.trim()).filter(Boolean);
  const allowed = flatCandidates(clue.候选);
  const outside = cand.filter((x) => allowed.indexOf(x) < 0);
  const problems = [];
  if (!line.trim()) problems.push("没有写「这一卦里=」那一句");
  if (outside.length) problems.push("候选不在名单上:" + outside.join("、"));
  if (cand.length && !clue.候选) problems.push("这一方已经指认过,不该再写候选");
  if (cand.length > 3) problems.push("候选超过三个");
  return { 句: line.trim(), 候选: cand, problems };
}

/* 解谜的人要的材料,按问题排好、带编号。纯文本,不带任何程序内部的名字。
   `verify` 是验现事模型交回来、经 `readVerifyAnswer` 核过的结果,按编号。 */
export function puzzleText(p, answers, verify) {
  const out = [];
  const q = p.问;
  out.push("【第" + q.n + "问】" + q.ask + "(" + (q.db || "其他") + "," + (q.kind || "能不能") + ")");
  const t = p.摆桌子;
  out.push("这一卦:" + t.本卦 + " 变 " + t.变卦 + ";月建" + t.月建 + ",日辰" + t.日辰 + ",旬空" + t.旬空
    + ";动了" + t.动爻.length + "爻" + (t.动爻.length ? "(第" + t.动爻.join("、") + "爻)" : "")
    + ";世在第" + t.世 + "爻,应在第" + t.应 + "爻" + (t.卦形.length ? ";" + t.卦形.join("、") : ""));
  out.push(p.定死的 ? "定死的:" + p.定死的.吉凶 + "。" + p.定死的.为什么 + " 不许翻。"
    : "定死的:没有。裁决梯前三步没有定案,方向由你拼。");
  out.push("线索:");
  p.线索.forEach((c) => {
    const a = answers && answers[c.编号];
    out.push("  [" + c.编号 + "] " + (a && a.句 ? a.句 : "(这条的线索模型没交)")
      + "  —— 指向:" + (c.指向 ? c.指向.向 + "(" + c.指向.因 + ")" : "不标")
      + ";依据:" + c.判 + "," + c.盘上);
    if (a && a.候选 && a.候选.length) out.push("       候选:" + a.候选.join("、"));
  });
  if ((p.验现事 || []).length) {
    out.push("验现事(盘上说的是「现在」的局面,已经有人拿他的原话对照过):");
    p.验现事.forEach((c) => {
      const v = verify && verify[c.编号];
      out.push("  [" + c.编号 + "] " + c.盘上 + ";说的是:" + c.谁
        + " —— " + (!v ? "(这一条没对照)"
          : v.对照 === "他没说" ? "他没说"
          : v.对照 + ",他的原话:「" + v.原话 + "」"));
    });
  }
  if (p.打架.length) {
    out.push("打架(同一爻上能与不能同时成立):");
    p.打架.forEach((f) => {
      out.push("  " + f.主体 + "第" + f.爻 + "爻:" + f.判[0] + " " + f.条件[f.判[0]] + " 个条件,"
        + f.判[1] + " " + f.条件[f.判[1]] + " 个条件 —— "
        + (f.胜 ? "按补全包的规矩取条件更具体的一条,取" + f.胜 : "打平,程序不裁,由你定"));
    });
  }
  out.push("谁是谁:");
  p.谁是谁.roles.forEach((e) => {
    out.push("  " + e.角色 + "·" + e.六亲 + (e.爻.length ? "(第" + e.爻.join("、") + "爻)" : "") + ":" + e.说法
      + (e.指认 ? ";是" + e.指认 : "") + (e.他说的 ? ";他说过" + e.他说的.join(";") : "")
      + (e.候选 ? ";还没指认" : ""));
  });
  out.push("  世在第" + p.谁是谁.世 + "爻,是问的人自己;应在第" + p.谁是谁.应 + "爻,是对方或外部");
  if (p.现实依据.length) {
    out.push("现实依据:");
    p.现实依据.forEach((f) => out.push("  「" + f.事实 + "」" + (f.六亲 ? "(" + f.六亲 + ")" : "") + " → " + f.落点));
  }
  if (p.细节素材.length) {
    out.push("细节素材(补全包象义表,只作映射,不许拿来改吉凶):");
    p.细节素材.forEach((d) => {
      out.push("  用神第" + d.爻 + "爻临" + d.六神 + ":" + d.六神象.map((c) => c.类 + "·" + c.项.join("、")).join(";"));
      out.push("  用神在" + d.爻位 + ":" + d.爻位象.map((c) => c.类 + "·" + c.项.join("、")).join(";"));
    });
  }
  if (p.读法卡.length) {
    out.push("这类事的读法:");
    p.读法卡.forEach((c) => out.push("  " + c.title + ":" + c.rule));
  }
  return out.join("\n");
}
