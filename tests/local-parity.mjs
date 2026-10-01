/* 契约:本地跑的和线上跑的是同一条路,差别只有端点和模型名。
   ────────────────────────────────────────────────────────────────────────
   owner 2026-09-15:「整套断卦流程的本地方案,接本地 API,**和线上除了 API
   和环境没有不同**,且能真正实现之前说的所有功能」。

   ⭐ 「没有不同」不是一句愿望,它是三条可查的性质:
     ① 上游端点**只有一处定义**。以前这个 URL 抄了三遍(流式/非流式/utility),
        改一个漏两个是必然的 —— 而**漏掉的那一处会照样跑通**,它只是跑去了
        另一个端点。本地方案里那意味着:三站走本地、一站偷偷走线上并且花钱。
     ② OpenRouter 的扩展字段(`reasoning` / `usage:{include:true}`)必须
        **按端点门控**。Ollama 忽略未知字段,llama.cpp 和 vLLM 会 400 ——
        一个本地端点因为两个它没听过的字段拒收整个请求,而报出来的是
        「模型调用失败」。
     ③ **每一道闸都按 role 判,不按 product 判。** product 是客户端字段。
        这条已经栽过两次,第二次就是本地第一次跑起来时撞上的。

   ⚠️ 这条契约扫的是源码。防空转:每一格都有下限断言。
*/
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const ROOT = new URL("..", import.meta.url).pathname;
const read = (p) => readFileSync(ROOT + p, "utf8");
const api = read("functions/api/claude.js");
assert.ok(api.length > 20000, `claude.js 只有 ${api.length} 字符 —— 这条契约在空转`);

/* ── ① 端点只有一处 ─────────────────────────────────────────────────────── */
const hardcoded = api.match(/openrouter\.ai\/api\/v1\/chat\/completions/g) || [];
assert.deepEqual(hardcoded, [],
  `claude.js 里又出现了 ${hardcoded.length} 个写死的 OpenRouter 调用地址 —— `
  + "改一个漏两个是必然的,而**漏掉的那一处会照样跑通**:它只是跑去了另一个端点。"
  + "本地方案里那意味着三站走本地、一站偷偷走线上并且花钱");
assert.match(api, /function upstreamUrl\(env\)/,
  "upstreamUrl 没了 —— 端点必须从一个地方出");
assert.match(api, /env\.MODEL_BASE_URL/,
  "MODEL_BASE_URL 读不到了 —— 那就没有办法把上游指到本地");
/* 三处调用点都得走它。数 fetch(upstreamUrl(env)) 的出现次数。 */
const viaFn = (api.match(/fetch\(upstreamUrl\(env\)/g) || []).length;
assert.ok(viaFn >= 3,
  `只有 ${viaFn} 处在用 upstreamUrl()(应 ≥3:流式 / 非流式 / utility)—— 有调用点绕过去了`);

/* ── ② 厂商扩展字段按端点门控 ───────────────────────────────────────────── */
assert.match(api, /function applyVendorExtras/,
  "applyVendorExtras 没了 —— reasoning/usage 会无条件发给本地端点");
const extras = api.slice(api.indexOf("function applyVendorExtras"),
  api.indexOf("function applyVendorExtras") + 900);
assert.match(extras, /if \(!isOpenRouter\(env\)\) return payload/,
  "applyVendorExtras 不再先判端点 —— llama.cpp / vLLM 会因为不认识的字段 400,"
  + "而报出来的是「模型调用失败」");
/* 这两个字段不许在**别处**赋值 —— 把 applyVendorExtras 自己的函数体切掉再扫,
   否则它会抓到那一条正确的赋值,而一条抓自己的断言等于没有断言。 */
const fnStart = api.indexOf("function applyVendorExtras");
const fnEnd = api.indexOf("\n}", fnStart) + 2;
const outside = api.slice(0, fnStart) + api.slice(fnEnd);
const bare = (outside.match(/^\s*payload\.(reasoning|usage) = /gm) || []).map((b) => b.trim());
assert.deepEqual(bare, [],
  `applyVendorExtras 之外又出现了 ${bare.join(" / ")} —— 它们只许经那一个函数,`
  + "否则本地端点会收到它不认识的字段并 400");

/* ── ③ 闸按 role 判,不按 product ─────────────────────────────────────────
   ⚠️ **这一条是本地第一次跑起来时当场撞上的,而且它是个真 bug:**
   M1/M2/M3 都带 `product:"sortis"`(客户端 makeComplete({role, product}) 就是
   这么发的),而它们是短的、非流式的。只看 product 的话,**四节点的第一站
   就被 400 挡回来,整条管线在线上一次都跑不起来** —— 而这件事在没有 key 的
   机器上看不出来:谁也没真发过一个请求。 */
const streamGate = api.slice(api.indexOf("STREAM_REQUIRED") - 900, api.indexOf("STREAM_REQUIRED"));
assert.match(streamGate, /isUtilityRole\(body\)/,
  "STREAM_REQUIRED 那道闸又只看 product 了 —— M1/M2/M3 都带 product:\"sortis\","
  + "会被它挡回来,于是四节点在线上一次都跑不起来");
/* 计费闸同理(node-pipeline 也钉着,这里是从「本地=线上」这一侧再钉一次)。 */
assert.match(api, /UTILITY_ROLES\.has\(String\(role/,
  "计费闸不再按 role 分流 —— 见 node-pipeline 那条");

/* ── ④ 没 key 但有本地端点时不许 503 ────────────────────────────────────── */
assert.match(api, /!env\.OPENROUTER_API_KEY && !env\.MODEL_BASE_URL/,
  "配置检查还在只认 OPENROUTER_API_KEY —— 本地端点不需要 key,"
  + "这样会在第一个请求上 503,而 503 的文案说的是一个根本用不上的变量");

/* ── ⑤ 本地那套东西齐不齐 ───────────────────────────────────────────────── */
for (const f of ["scripts/local.mjs", ".dev.vars.example", "tools/lab/fake-model.mjs"]) {
  assert.ok(existsSync(ROOT + f), `${f} 没了 —— 本地方案跑不起来`);
}
const pkg = JSON.parse(read("package.json"));
assert.equal(pkg.scripts.local, "node scripts/local.mjs", "npm run local 没了");
assert.ok(pkg.devDependencies && pkg.devDependencies.wrangler,
  "wrangler 不在 devDependencies 里 —— 本地跑的就不是真的 Pages Functions 了");

/* 启动脚本必须**先检查再起**:三件事任意一件不对,站点都会在你走完注册、
   登录、投卦之后才报一个跟原因无关的错。 */
const local = read("scripts/local.mjs");
for (const [what, re] of [
  ["`.dev.vars` 在不在", /\.dev\.vars/],
  ["本地端点通不通", /\/models/],
  ["模型名对不对", /missing/],
  ["本地 D1 建过表没有", /d1["'\s,]+.*execute|"d1"/]
]) {
  assert.match(local, re, `scripts/local.mjs 不再检查「${what}」—— 它会在更晚的地方报一个更难懂的错`);
}

/* 假端点要**拒收** OpenRouter 的扩展字段,否则 ② 那条永远测不出来:
   它会一路绿到你换上真端点的那一天。 */
const fake = read("tools/lab/fake-model.mjs");
assert.match(fake, /reasoning/,
  "假端点不再拒收 OpenRouter 的扩展字段 —— 那条门控就永远测不到,"
  + "会一路绿到你换上真端点的那一天");

console.log("ok   local-parity — 端点一处定义、厂商字段按端点门控、闸按 role 判、"
  + "无 key 有本地端点不 503,本地那套齐全");
