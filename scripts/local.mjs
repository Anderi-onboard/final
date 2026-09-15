#!/usr/bin/env node
/* 一条命令把整站在本地跑起来:`npm run local`
   ────────────────────────────────────────────────────────────────────────
   跑的是**真的 Pages Functions**(wrangler pages dev),不是任何一个替身:
   浏览器 → /api/claude → guardRequest(计费/免费额度)→ 危机闸 →
   buildNode(M1–M4)→ 上游模型 → SSE 流回去 → 前端渲染象标记和追问面板。

   ⭐ **和线上的差别只有两样,都在 `.dev.vars` 里:上游端点、模型名。**
      代码一行不改 —— 这就是「接本地 API,和线上除了 API 和环境没有不同」。

   这个脚本只做三件事,每一件都是**跑之前会先失败一次**的那种:
     ① `.dev.vars` 在不在、该有的变量齐不齐
     ② 本地模型端点通不通、它上面有没有 `.dev.vars` 点名的那几个模型
     ③ 本地 D1 建过表没有(没建的话登录会 500,而 500 的文案不会告诉你这个)
   三件都过了再把 wrangler 拉起来。 */
import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const C = { d: "\x1b[2m", b: "\x1b[1m", y: "\x1b[33m", g: "\x1b[32m", r: "\x1b[31m", x: "\x1b[0m" };
const die = (msg, fix) => {
  console.error(`\n${C.r}✗ ${msg}${C.x}` + (fix ? `\n  ${fix}` : ""));
  process.exit(1);
};
const ok = (msg) => console.log(`${C.g}✓${C.x} ${msg}`);

/* ── ① .dev.vars ─────────────────────────────────────────────────────────── */
const varsPath = path.join(ROOT, ".dev.vars");
if (!fs.existsSync(varsPath)) {
  die(".dev.vars 不存在", `cp .dev.vars.example .dev.vars   然后按里面的注释改两行`);
}
const vars = {};
for (const line of fs.readFileSync(varsPath, "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*)$/);
  if (m) vars[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}

if (!vars.SESSION_SECRET) {
  die("SESSION_SECRET 没设", "没有它谁都登录不了 —— 而计费闸要一个账号,于是一卦都起不了");
}
if (String(vars.LIVE_MODEL || "").toLowerCase() !== "on") {
  console.log(`${C.y}⚠️  LIVE_MODEL 不是 on —— 站点会跑**离线模式**:返回罐头解读、不调模型、不计费。${C.x}`);
  console.log(`${C.d}   那是线上的默认,不是 bug。要真调本地模型就在 .dev.vars 里写 LIVE_MODEL=on${C.x}`);
} else if (!vars.MODEL_BASE_URL && !vars.OPENROUTER_API_KEY) {
  die("LIVE_MODEL=on 但没有上游端点",
    "本地:MODEL_BASE_URL=http://localhost:11434/v1   线上:OPENROUTER_API_KEY=sk-or-…");
}

/* ── ② 本地端点 ──────────────────────────────────────────────────────────── */
const live = String(vars.LIVE_MODEL || "").toLowerCase() === "on";
const base = (vars.MODEL_BASE_URL || "").replace(/\/+$/, "");
if (live && base) {
  let ids = null;
  try {
    const r = await fetch(base + "/models", {
      headers: { authorization: "Bearer " + (vars.MODEL_API_KEY || "local") },
      signal: AbortSignal.timeout(8000)
    });
    if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
    ids = ((await r.json()).data || []).map((m) => m.id);
  } catch (e) {
    die(`连不上本地模型端点 ${base}\n  ${e.message}`,
      "起服务:ollama serve  /  LM Studio 的 Local Server  /  llama-server -m x.gguf");
  }
  ok(`${base} 通,${ids.length} 个模型`);
  /* ⚠️ 模型名写错**不会在这里报**,会在第一次起卦时报「模型调用失败」——
     而那时你已经走完了注册、登录、投卦。在这儿先对一遍。 */
  const want = [...new Set([vars.SORTIS_MODEL, vars.STRIA_MODEL, vars.UTILITY_MODEL].filter(Boolean))];
  const missing = want.filter((m) => !ids.includes(m));
  if (missing.length) {
    console.log(`${C.y}⚠️  .dev.vars 点名的模型端点上没有:${missing.join(" ")}${C.x}`);
    console.log(`${C.d}   端点上有的:${ids.slice(0, 12).join(" ")}${ids.length > 12 ? " …" : ""}${C.x}`);
    console.log(`${C.d}   Ollama 的话先 ollama pull <名字>${C.x}`);
  } else if (want.length) {
    ok(`模型都在:${want.join(" ")}`);
  }
} else if (live) {
  console.log(`${C.y}⚠️  走的是 OpenRouter(线上模型)—— 这会真花钱。${C.x}`);
}

/* ── ③ 本地 D1 ───────────────────────────────────────────────────────────── */
/* wrangler 的本地 D1 落在 .wrangler/state 里。没建表的话登录会 500,
   而 500 的文案不会告诉你是缺表 —— 所以每次都跑一遍(建表语句是幂等的)。 */
const wrangler = path.join(ROOT, "node_modules/.bin/wrangler");
if (!fs.existsSync(wrangler)) die("wrangler 没装", "npm install");
process.stdout.write(`${C.d}本地 D1 建表…${C.x}`);
const d1 = spawnSync(wrangler,
  ["d1", "execute", "bournewise", "--local", "--file=./schema.sql", "-y"],
  { cwd: ROOT, encoding: "utf8" });
if (d1.status !== 0) {
  console.log("");
  console.log(`${C.y}⚠️  建表没成功 —— 账号和历史会退回本地 guest 模式(站点不崩,但登不了录、也就起不了卦)${C.x}`);
  console.log(C.d + String(d1.stderr || d1.stdout).trim().split("\n").slice(-6).join("\n") + C.x);
} else {
  console.log(` ${C.g}好${C.x}`);
}

/* ── 起 ──────────────────────────────────────────────────────────────────── */
const port = process.env.PORT || "8788";
console.log(`\n${C.b}起 wrangler pages dev${C.x}  ${C.d}(整站 + functions/,读 .dev.vars)${C.x}`);
console.log(`${C.d}上游:${live ? (base || "OpenRouter") : "离线(罐头解读)"}${C.x}`);
console.log(`${C.d}打开 http://localhost:${port} —— 先注册一个账号,首卦免费${C.x}`);
console.log(`${C.d}健康探针 curl http://localhost:${port}/api/claude 会回它现在指着哪个上游${C.x}\n`);

const child = spawn(wrangler, ["pages", "dev", ".", "--port", port, "--ip", "127.0.0.1"],
  { cwd: ROOT, stdio: "inherit" });
child.on("exit", (c) => process.exit(c ?? 0));
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => child.kill(sig));
