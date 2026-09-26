#!/usr/bin/env node
/* 本地调试台 —— 用本地大模型跑一遍 M1→M2→M3→M4,一站一站看、一站一站调。
   ────────────────────────────────────────────────────────────────────────
   用法(先起本地服务,例如 `ollama serve`):

     node tools/lab/run.mjs --q "我和她还有可能吗" --facts "她是大学生,医学生"

   调一站的工作流 —— **这是这个工具存在的全部理由**:
     ① 先跑一整遍,存下来      node tools/lab/run.mjs --q "…" --save
     ② 改 functions/_lib/nodes/prompts.js 里 M3 那段
     ③ 只重跑 M3,上游钉住     node tools/lab/run.mjs --only m3 --from runs/最新那个.json
        —— 上游的输出从文件里读,不重新调模型。**盘一样、M1/M2 的答案一样,
        变的只有你刚改的那一段。** 不钉住上游,你分不清这次答得不一样
        是因为提示词改了,还是因为上一站这次答得不一样。

   常用参数:
     --base   http://localhost:11434/v1   OpenAI 兼容端点(Ollama/LM Studio/llama.cpp/vLLM)
     --model  全局模型;或分站 --model m1=qwen2.5:7b --model m4=qwen2.5:32b
     --seed   投掷种子(默认 1,同一副盘);--seed random 才真摇
     --q      问题     --facts  他自己说的既成事实(逗号分隔)
     --gender m|f      男占/女占 —— 婚恋取哪一边靠它
     --temp   默认 0(调提示词时**必须是 0**,否则你在调噪声)
     --only   m1|m2|m3|m4 只跑这一站   --from 上游从这个 run 文件读
     --dry    只打印提示词,不调模型(改提示词时先用这个看槽填对没有)
     --save   把这次 run 存进 tools/lab/runs/
     --list   列出端点上有哪些模型
     --raw    连 system 提示词全文一起打印
*/
import fs from "node:fs";
import path from "node:path";
import { buildNode, parseM1 } from "../../functions/_lib/nodes/fill.js";
import { Local } from "./client.mjs";
import { material, tok, ROOT } from "./board.mjs";

/* ── 参数 ──────────────────────────────────────────────────────────────── */
const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf("--" + n); return i < 0 ? d : (argv[i + 1] ?? true); };
const has = (n) => argv.includes("--" + n);
const many = (n) => argv.reduce((a, v, i) => (v === "--" + n ? a.concat(argv[i + 1]) : a), []);

const BASE = flag("base", process.env.LAB_BASE || "http://localhost:11434/v1");
const SEED = flag("seed", "1");
const Q = flag("q", "我和她还有可能吗 会在一起并肩作战吗");
const FACTS = flag("facts", "");
const GENDER = flag("gender", "");
const TEMP = Number(flag("temp", "0"));
const ONLY = flag("only", "");
const FROM = flag("from", "");
const DRY = has("dry");
const RAW = has("raw");
const SAVE = has("save");

/* --model 可以给一次(全站)也可以分站给。分站是这个管线的要点:
   M1 是四行分类、M2 是选几个库,小模型就够;M4 要写一整篇。 */
const MODELS = { m1: null, m2: null, m3: null, m4: null };
let fallbackModel = process.env.LAB_MODEL || null;
for (const m of many("model")) {
  if (!m) continue;
  const hit = String(m).match(/^(m[1-4])=(.+)$/);
  if (hit) MODELS[hit[1]] = hit[2]; else fallbackModel = m;
}
for (const k of Object.keys(MODELS)) if (!MODELS[k]) MODELS[k] = fallbackModel;

const client = new Local({ base: BASE, timeout: Number(flag("timeout", "300000")) });

/* ── 打印 ──────────────────────────────────────────────────────────────── */
const C = { d: "\x1b[2m", b: "\x1b[1m", y: "\x1b[33m", g: "\x1b[32m", r: "\x1b[31m", x: "\x1b[0m" };
const rule = (s) => console.log(`\n${C.b}${"─".repeat(3)} ${s} ${"─".repeat(Math.max(0, 66 - s.length))}${C.x}`);
const dim = (s) => console.log(C.d + s + C.x);

/* ── 主流程 ────────────────────────────────────────────────────────────── */
if (has("list")) {
  const ms = await client.models();
  console.log(`${BASE} 上有 ${ms.length} 个模型:`);
  ms.forEach((m) => console.log("  " + m));
  process.exit(0);
}

if (!DRY && !MODELS.m1) {
  console.error(`${C.r}没给模型。${C.x}  --model qwen2.5:7b   或分站 --model m1=… --model m4=…`
    + `\n先看端点上有什么: node tools/lab/run.mjs --list --base ${BASE}`);
  process.exit(1);
}

/* 钉住上游:--only 时从上一次的 run 文件里读,不重新调模型。 */
let prior = null;
if (FROM) {
  prior = JSON.parse(fs.readFileSync(FROM, "utf8"));
  console.log(`${C.d}上游钉在 ${path.basename(FROM)}(seed ${prior.seed} · 问题「${prior.question}」)${C.x}`);
}

const run = {
  at: new Date().toISOString(),
  base: BASE, models: { ...MODELS }, temp: TEMP,
  seed: prior?.seed ?? SEED,
  question: prior?.question ?? Q,
  facts: prior?.facts ?? FACTS,
  gender: prior?.gender ?? GENDER,
  stations: {}
};
const want = (id) => !ONLY || ONLY === id;
const upstream = (id) => prior?.stations?.[id]?.out ?? "";

async function station(id, body, label) {
  const built = buildNode(id, body);
  if (!built) throw new Error(`buildNode('${id}') 回了 null`);
  const sysT = tok(built.system);
  rule(`${id.toUpperCase()}  ${label}`);
  console.log(`${C.d}model ${MODELS[id] || "(dry)"} · system ${sysT} tok${C.x}`);
  if (RAW || DRY) {
    const left = built.system.match(/\{\{[a-z]+\}\}/g) || [];
    if (left.length) console.log(`${C.r}⚠️ 还有没填上的槽:${left.join(" ")}${C.x}`);
    dim("┌─ system ─────────────────────────────────────────────────────────");
    dim(built.system.split("\n").map((l) => "│ " + l).join("\n"));
    dim("└──────────────────────────────────────────────────────────────────");
    dim("user: " + (built.userOverride || "(问题本身)"));
  }
  if (DRY) return { out: "", sysT, built };
  const r = await client.chat({
    model: MODELS[id], system: built.system,
    user: built.userOverride || body.question, temperature: TEMP,
    max_tokens: id === "m4" ? 8192 : 1024
  });
  console.log(r.text);
  console.log(`${C.d}└ ${r.ms}ms${r.usage ? ` · in ${r.usage.prompt_tokens} / out ${r.usage.completion_tokens}` : ""}`
    + `${r.finish && r.finish !== "stop" ? ` · ${C.y}finish=${r.finish}${C.x}` : ""}${C.x}`);
  return { out: r.text, sysT, ms: r.ms, usage: r.usage, finish: r.finish, built };
}

/* ── M1:读问题。它的 db= 定用神,所以必须先跑。
   ⚠️ `--facts` 拼进问题里发,**不是另开一个字段** —— 线上没有这个字段,
   人就是把「她是医学生」打在问题里的。M1 的活正是**从他打的字里**把
   既成事实抄出来(`facts=` 那一行);单开一个字段直接喂给它,
   等于替它做了那一步,于是调试台永远测不出它会不会漏抄。 */
const askText = run.question + (run.facts ? "。" + run.facts : "");
let m1Text = upstream("m1");
if (want("m1") && !FROM) {
  const s = await station("m1", { question: askText }, "读问题");
  m1Text = s.out; run.stations.m1 = { out: s.out, sysTok: s.sysT, ms: s.ms };
} else if (m1Text) {
  rule("M1  读问题 (钉住)"); console.log(C.d + m1Text + C.x);
}

/* ── 盘:用神由 M1 的 db 定 —— 这一步没有模型,全是代码。 */
/* ⚠️ `--db` 是给 `--dry` 和 `--only m3` 用的旁路:M1 没跑时 db 是空的,
   用神就退回世爻,于是下游几站全在读一副**和真跑时不一样的盘**。
   线上没有这个旁路 —— 那里 db 只能来自 M1。 */
const m1 = parseM1(m1Text);
const dbOverride = flag("db", "");
if (!m1.db && dbOverride) m1.db = String(dbOverride);
if (!m1.db) console.log(`${C.y}⚠️ 没有 db(M1 没跑或没答)—— 用神会退回世爻。`
  + `dry/only 时加 --db 婚恋 才是真盘。${C.x}`);
const mat = material({ seed: run.seed, db: m1.db, gender: run.gender || m1.gender || "" });
rule("盘面(程序算的,没有模型)");
console.log(`投掷 ${mat.spec.raw.join(" ")}  动爻 ${mat.spec.changeIdx.map((i) => i + 1).join(",") || "无"}`);
console.log(`用神 ${C.b}${mat.subject.key}${C.x} ← ${mat.subject.source}  ${C.d}${mat.subject.why}${C.x}`);
console.log(`裁决 ${C.b}${(mat.ladder.match(/裁决:(.*)/) || [])[1] || "?"}${C.x}`);
console.log(`feature ${mat.features.length} 个: ${mat.features.join(" ")}`);
if (RAW) { dim("\n" + mat.ladder); dim("\n" + mat.relations); }

const common = {
  question: run.question, features: mat.features, board: mat.boardText,
  ladder: mat.ladder, relations: mat.relations, m1: m1Text
};

/* ── M2:选库(两级 RAG 的第一级) */
let m2Text = upstream("m2");
if (want("m2") && !(FROM && ONLY && ONLY !== "m2")) {
  const s = await station("m2", common, "选库");
  m2Text = s.out; run.stations.m2 = { out: s.out, sysTok: s.sysT, ms: s.ms };
} else if (m2Text) { rule("M2  选库 (钉住)"); console.log(C.d + m2Text + C.x); }

/* ── M3:取证。⚠️ 它只看得见 M2 开的那几个库的卡 —— 收窄在 fill.js 里。 */
let m3Text = upstream("m3");
if (want("m3") && !(FROM && ONLY && ONLY !== "m3")) {
  const s = await station("m3", { ...common, m2: m2Text }, "取证");
  m3Text = s.out; run.stations.m3 = { out: s.out, sysTok: s.sysT, ms: s.ms, cards: s.built.meta?.cards?.map((c) => c.id) };
  if (s.built.meta?.cards) console.log(`${C.d}开卡 ${s.built.meta.cards.map((c) => c.id).join(" ")}${C.x}`);
} else if (m3Text) { rule("M3  取证 (钉住)"); console.log(C.d + m3Text + C.x); }

/* ── M4:说话。 */
if (want("m4")) {
  const s = await station("m4", { ...common, m3: m3Text }, "说话");
  run.stations.m4 = { out: s.out, sysTok: s.sysT, ms: s.ms };
}

/* ── 存 ────────────────────────────────────────────────────────────────── */
if (SAVE && !DRY) {
  const dir = path.join(ROOT, "tools/lab/runs");
  fs.mkdirSync(dir, { recursive: true });
  const f = path.join(dir, run.at.replace(/[:.]/g, "-") + ".json");
  fs.writeFileSync(f, JSON.stringify({ ...run, board: mat.boardText, ladder: mat.ladder }, null, 2));
  console.log(`\n${C.g}存了${C.x} ${path.relative(ROOT, f)}`);
  console.log(`${C.d}只重跑一站: node tools/lab/run.mjs --only m3 --from ${path.relative(ROOT, f)} --model …${C.x}`);
}
