/* 契约:老链路已作废封存,不许长回来(2026-09-14,owner 定)。
   ────────────────────────────────────────────────────────────────────────
   owner:「我草你为啥不把之前的老旧链路给下了封存啊 你觉得我是想跑那条链路吗
   …… 合完了之后再按照现在的走 别再用以前的东西了」。

   ⭐⭐ **兜底不是无害的。** 被删掉的那几条,每一条当时的注释都写着它只覆盖
   「router 模块没加载」那种怪情况。合起来它们是**一整条能悄悄跑起来的老产品**:
   一次调用、95k 字符的段落栈、不带盘、或者干脆回占位断语。而读的人付了钱,
   **页面上分不出来这一篇是哪一条路写的**。本仓库为「降级了却像在正常工作」
   付过的钱,CLAUDE.md 里记着好几笔;这些兜底就是下一笔。

   所以不是「优先走新的」,是**老的不存在**。少一块就抛,不换一条路。

   ⚠️ 这条契约只盯**入口**,不盯提示词。`prompt-engine.js` 一个字都没删 ——
   QC / ROUTER / INTENT / FOLLOWUP 仍然用它,那几样是工具不是老链路。
   作废的是「把整套段落栈装配成一篇解读」这一条路径。
*/
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
/* 注释里合法地谈论老链路(每一处删除都留了为什么)。扫源码要先把注释剥掉,
   否则这条契约会被自己的墓志铭点亮。⚠️ 防空转:剥完必须还剩东西。 */
const strip = (s) => s
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/^\s*\/\/.*$/gm, " ");

const FILES = {
  "chat-app.js": read("chat-app.js"),
  "prompt-router.js": read("prompt-router.js"),
  "liuyao-ai.js": read("liuyao-ai.js"),
  "functions/api/claude.js": read("functions/api/claude.js")
};
for (const [name, src] of Object.entries(FILES)) {
  const code = strip(src);
  assert.ok(code.length > src.length * 0.2,
    `${name} 剥掉注释后只剩 ${code.length} 字符 —— 剥法坏了,下面全是空转`);
  FILES[name] = code;
}

/* ── ① 四个老入口,一个都不许有活的调用 ─────────────────────────────────── */
const GONE = [
  ["BWLiuYaoAI.interpret(", "chat-app.js",
   "自己叫模型、拿老提示词、解析 JSON,失败回 mockReading 的占位断语"],
  ["buildExperienceEnvelope(", "prompt-router.js",
   "把所有东西包成一段 user 消息交给老装配 —— 它让「这一站要什么」变成「全给它」"],
  ["askOracle(", "chat-app.js",
   "三句话的行内提示词、不带盘、跳过四节点和裁决梯"],
  ["sortisLegacy(", "chat-app.js",
   "prompt-router 没加载时换一条路,而读的人看不出来换了"]
];
for (const [call, where, why] of GONE) {
  assert.ok(!FILES[where].includes(call),
    `${where} 又出现了 ${call} —— ${why}。老链路作废封存,不是「优先走新的」`);
}

/* ── ② 服务端不许再有「装配一篇解读」的 default ────────────────────────── */
const api = FILES["functions/api/claude.js"];
assert.ok(!/buildSystemPrompt\(/.test(api),
  "claude.js 又在调 buildSystemPrompt —— 一个没带 role 的请求会**静默**落到它上面,"
  + "于是线上同时跑着两套完全不同的东西,而页面上分不出来是哪一套写的");
assert.match(api, /LEGACY_PIPELINE_RETIRED/,
  "没带 node role 的解读请求必须被明确拒绝,而不是悄悄换一条路");
/* 而 PromptEngine 本身还在用 —— 这条契约不是要删 owner 的提示词。 */
for (const still of ["QC_SYSTEM", "INTENT_ROUTER", "FOLLOWUP_SUGGEST"]) {
  assert.ok(api.includes("PromptEngine." + still),
    `PromptEngine.${still} 不见了 —— 那几样是工具不是老链路,不该跟着退役`);
}

/* ── ③ 客户端不许有第二条出路 ───────────────────────────────────────────── */
const router = FILES["prompt-router.js"];
assert.match(router, /四节点管线缺件,无法起卦/,
  "缺件时不再抛了 —— 那意味着它又在拿半套材料往下走");
assert.match(router, /role: "m4"/,
  "M4 没写死 role —— 忘了带 role 和故意走老路在线上长得一模一样");
const chat = FILES["chat-app.js"];
assert.ok(!/return null; *\/\/ router module missing/.test(chat) &&
          !/if \(routed\) return routed/.test(chat),
  "chat-app 又在拿 routedReading 的假值走自己的兜底");

/* ── ④ liuyao-ai 只剩确定性的那几件 ─────────────────────────────────────── */
const ai = FILES["liuyao-ai.js"];
for (const dead of ["function buildMessages", "function interpret", "function mockReading",
                    "USER_PROMPT"]) {
  assert.ok(!ai.includes(dead),
    `liuyao-ai.js 里又有 ${dead} —— 它是老链路的一部分(浏览器里自己叫模型、`
    + "或者一个浏览器侧的提示词插槽),和「提示词只在服务端」那条界线矛盾");
}
/* 留下的是引擎的输出,不是老链路 —— 少了它们四节点就没有材料。 */
for (const keep of ["boardText", "relationLines", "subjectKey", "deriveRoles"]) {
  assert.ok(new RegExp("function " + keep + "\\b").test(ai),
    `liuyao-ai.js 少了 ${keep} —— 它是引擎的输出,四节点读它`);
}

/* ── ⑤ 删路径时顺手扛着的那些东西,要还在 ───────────────────────────────
   ⚠️ 这一格是这条契约真正值钱的地方。危机硬停原来挂在老路由上,用神的
   「这是默认不是判定」原来挂在老 header 上 —— **两条都差点跟着一条路径
   一起消失,而且消失之后 payload 看上去完全正常。** */
assert.match(api, /PromptEngine\.gate\(/,
  "四节点分支里没有危机闸 —— 它原来挂在老路由上,那条路由已经退役");
assert.match(ai, /默认\*\*不是判定/,
  "用神的出处不再跟着 payload 发了 —— 一个读不出来的默认和一个判定长得一模一样,"
  + "这正是 subjectKey 上面那段事故的形状");

console.log("ok   legacy-retired — 四个老入口全断、服务端无 default 装配、"
  + "客户端无第二条出路,而危机闸和用神出处都还在");
