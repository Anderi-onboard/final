#!/usr/bin/env node
/* 解谜管线的调试台 —— 跑一卦,把每一步拿到了什么、交出了什么全打出来。
   ────────────────────────────────────────────────────────────────────────
   ⚠️ 实验中,线上仍是 M1→M4。这张台子是拿来和 owner 一句一句改的。

   两种跑法:

   ① 手填模型那几步(没有模型端点时):
        node tools/lab/puzzle.mjs --seed 1 --gender m --date 2026-09-23T12:00:00Z \
             --q "…问题…" --m1 m1.txt --out runs/x
      先打印程序那一步和每条线索的输入;线索的回答写进 answers.txt 再跑一遍:
        … --answers answers.txt [--reading reading.txt]
      answers.txt 的格式:
        [q1.1]
        这一卦里=<一句>
        候选=<A>|<B>        (只有「还没指认」的那一方才写)

   ② 接模型真跑:
        … --base http://localhost:11434/v1 --small qwen2.5:7b --big qwen2.5:32b
      M1 和线索用 --small,解谜用 --big。线索是**同时发**的(Promise.all)。

   --out 给了就把每一段全文写成文件:m1.txt、clues/q1.1.txt …、solve.txt、flow.txt。
*/
import fs from "node:fs";
import path from "node:path";
import { material } from "./board.mjs";
import { Local } from "./client.mjs";
import { loadCriteria, loadSymbols } from "../../functions/_lib/doctrine/criteria-rules.mjs";
import { RAG } from "../../functions/_lib/doctrine/rag/data.js";
import { DB_DOMAINS } from "../../functions/_lib/doctrine/rag/retrieve.js";
import { buildPuzzle, readClueAnswer, puzzleText } from "../../functions/_lib/puzzle/program.js";
import { fillM1, fillClue, fillSolve, parseM1P } from "../../functions/_lib/puzzle/prompts.js";

function args(argv) {
  const a = {};
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i];
    if (!k.startsWith("--")) continue;
    const v = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
    a[k.slice(2)] = v;
  }
  return a;
}

/* 这类事的读法卡:M1 的 db → 事体库 → 库里的卡,原文。和 retrieve.js 用同一张对照表。 */
export function readersFor(db) {
  const want = new Set(DB_DOMAINS[db] || []);
  const libs = RAG.libs.filter((l) => (l.domains || []).some((d) => want.has(d)));
  const ids = new Set(libs.flatMap((l) => l.children || []));
  return RAG.cards.filter((c) => ids.has(c.id))
    .map((c) => ({ id: c.id, title: c.title, rule: c.rule, requires: c.requires || [] }));
}

/* 卦名:调试台不加载 casting-figure.js,用上下卦说。 */
function trigramName(side) {
  return side && side.upper && side.lower ? "上" + side.upper.cn + "下" + side.lower.cn : "?";
}

/* 一卦 → 每一问一道题。`m1` 是 M1 那几行原文。 */
export function puzzlesFor({ seed, gender, date, m1 }) {
  const parsed = parseM1P(m1);
  const rules = loadCriteria();
  const symbols = loadSymbols();
  const qs = parsed.questions.length ? parsed.questions : [{ n: 1, ask: "", db: "其他", kind: "能不能" }];
  const puzzles = qs.map((q) => {
    const m = material({ seed, db: q.db, gender, date });
    const names = { 本卦: trigramName(m.board.ben), 变卦: m.board.bian ? trigramName(m.board.bian) : "无变卦" };
    return {
      m,
      p: buildPuzzle({ q, facts: parsed.facts, flags: parsed.flags, board: m, rules, symbols, readers: readersFor(q.db), names })
    };
  });
  return { parsed, puzzles, symbols };
}

function sopSteps(m, p) {
  const t = p.摆桌子;
  const L = m.csv.lines.trim().split("\n").map((r) => r.split(","));
  const H = L[0];
  const col = (r, k) => r[H.indexOf(k)];
  const rows = L.slice(1);
  const wang = rows.map((r) => "第" + col(r, "爻") + "爻" + col(r, "干支") + col(r, "旺衰")).join(" ");
  const marks = rows.flatMap((r) => ["旬空", "月破", "日破", "暗动"].filter((k) => col(r, k) === "是")
    .map((k) => "第" + col(r, "爻") + "爻" + k));
  const on = m.criteria.filter((v) => v.成立 === true);
  const lost = on.filter((v) => v.被裁 && v.被裁.length);
  return [
    "  立极  用神取" + t.用神 + "(" + (m.subject.why || "") + ")"
      + (t.用神爻 ? ",在第" + String(t.用神爻).split("/").join("、") + "爻"
        : ((p.谁是谁.roles.find((e) => e.角色 === "用神") || {}).伏
          ? ",不上卦,伏在第" + p.谁是谁.roles.find((e) => e.角色 === "用神").伏.爻 + "爻下" : ",盘上找不到")),
    "  日月  月建" + t.月建 + " 日辰" + t.日辰 + " 旬空" + t.旬空 + ";" + wang + (marks.length ? ";" + marks.join(" ") : ""),
    "  动态  判据成立 " + on.length + " 条" + (lost.length ? ",其中 " + lost.length + " 条在打架里输了" : "")
      + ";判不了 " + m.criteria.filter((v) => v.成立 === null).length + " 条",
    "  裁决  " + (p.定死的 ? "定死:" + p.定死的.吉凶 + "(" + p.定死的.为什么 + ")" : "前三步没定案,方向留给解谜"),
    "  应期  " + (p.问.kind === "什么时候" ? "问了时间,应期判据进线索" : "没问时间,不进线索"),
    "  象义  " + (p.细节素材.map((d) => "用神第" + d.爻 + "爻临" + d.六神 + "、在" + d.爻位).join(";") || "用神不上卦,没有六神爻位可取")
  ];
}

function readAnswers(file) {
  const out = {};
  if (!file) return out;
  let cur = null;
  for (const raw of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = raw.match(/^\s*\[(q\d+\.\d+)\]\s*$/);
    if (m) { cur = m[1]; out[cur] = ""; continue; }
    if (cur) out[cur] += raw + "\n";
  }
  return out;
}

async function main() {
  const a = args(process.argv);
  const seed = a.seed === "random" ? "random" : Number(a.seed || 1);
  const gender = String(a.gender || "");
  const date = a.date ? new Date(a.date) : null;
  const question = String(a.q || "");
  const outDir = a.out ? path.resolve(String(a.out)) : null;
  if (outDir) fs.mkdirSync(path.join(outDir, "clues"), { recursive: true });
  const write = (name, text) => { if (outDir) fs.writeFileSync(path.join(outDir, name), text); };
  const client = a.base ? new Local({ base: String(a.base), key: String(a.key || "local") }) : null;
  const flow = [];
  const say = (s) => { flow.push(s); console.log(s); };

  /* ── M1 ── */
  const symbols = loadSymbols();
  write("m1-prompt.txt", fillM1(symbols));
  let m1 = a.m1 ? fs.readFileSync(String(a.m1), "utf8") : "";
  if (!m1 && client) {
    const r = await client.chat({ model: String(a.small), system: fillM1(symbols), user: question, temperature: 0, max_tokens: 400 });
    m1 = r.text;
  }
  if (!m1) { console.error("没有 M1 的输出:给 --m1 文件,或者给 --base 让它真跑"); process.exit(1); }
  write("m1.txt", m1);
  say("问:" + question);
  say("");
  say("【M1 · 模型】读问题");
  m1.trim().split("\n").forEach((l) => say("  " + l));

  const { parsed, puzzles } = puzzlesFor({ seed, gender, date, m1 });

  /* ── 程序 ── */
  say("");
  say("【程序】排盘、判据、裁决、出题(不调模型)");
  const spec = puzzles[0].m.spec;
  say("  投掷 " + spec.raw.join(" ") + ";动爻 " + (spec.changeIdx.map((i) => i + 1).join("、") || "无")
    + ";" + puzzles[0].p.摆桌子.本卦 + " 变 " + puzzles[0].p.摆桌子.变卦);
  for (const { m, p } of puzzles) {
    say("");
    say("第" + p.问.n + "问:" + p.问.ask + "(" + p.问.db + "," + p.问.kind + ")");
    sopSteps(m, p).forEach(say);
    if (p.打架.length) {
      say("  打架  " + p.打架.map((f) => f.主体 + "第" + f.爻 + "爻 " + f.判.join("/") + " → "
        + (f.胜 ? "取" + f.胜 : "打平")).join(";"));
    }
    say("  现实  " + (p.现实依据.map((f) => "「" + f.事实 + "」→ " + f.落点).join(";") || "他没说事实"));
    say("  线索  " + p.线索.length + " 条 → " + p.线索.length + " 个模型同时跑");
    p.线索.forEach((c) => {
      say("    [" + c.编号 + "] " + c.类 + "·" + c.判 + " —— " + (c.指向 ? c.指向.向 : "不标")
        + (c.候选 ? "(未指认,要写候选)" : ""));
      write("clues/" + c.编号 + ".txt", fillClue(c, p.问));
    });
  }

  /* ── 线索(并联)── */
  let answers = {};
  const raw = readAnswers(a.answers);
  const all = puzzles.flatMap(({ p }) => p.线索.map((c) => ({ c, q: p.问 })));
  if (client && !a.answers) {
    const got = await Promise.all(all.map(({ c, q }) =>
      client.chat({ model: String(a.small), system: fillClue(c, q), user: "写。", temperature: 0, max_tokens: 200 })
        .then((r) => [c.编号, r.text]).catch((e) => [c.编号, ""])));
    got.forEach(([id, text]) => { raw[id] = text; });
  }
  if (Object.keys(raw).length) {
    say("");
    say("【线索 · 模型 × " + all.length + ",同时跑】每个只看得到自己那一条");
    for (const { c } of all) {
      const r = readClueAnswer(c, raw[c.编号]);
      answers[c.编号] = r;
      say("  [" + c.编号 + "] " + (r.句 || "(没交)") + (r.候选.length ? "  候选:" + r.候选.join("、") : "")
        + (r.problems.length ? "  问题:" + r.problems.join(";") : ""));
    }
  }

  /* ── 解谜 ── */
  const text = puzzles.map(({ p }) => puzzleText(p, answers)).join("\n\n");
  const solve = fillSolve({ question, lang: parsed.lang, hurt: parsed.hurt, puzzlesText: text });
  write("solve.txt", solve);
  say("");
  say("【解谜 · 模型】拿到的材料(写法规矩和取象标记略,全文见 solve.txt)");
  text.split("\n").forEach((l) => say("  " + l));
  let reading = a.reading ? fs.readFileSync(String(a.reading), "utf8") : "";
  if (!reading && client && Object.keys(answers).length) {
    const r = await client.chat({ model: String(a.big), system: solve, user: "写给他。", temperature: 0, max_tokens: 4096 });
    reading = r.text;
  }
  if (reading) {
    say("");
    say("【输出】");
    reading.trim().split("\n").forEach((l) => say("  " + l));
  }
  write("flow.txt", flow.join("\n") + "\n");
}

if (import.meta.url === "file://" + process.argv[1]) {
  main().catch((e) => { console.error(e && e.stack || e); process.exit(1); });
}
