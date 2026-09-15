#!/usr/bin/env node
/* 一个假的本地模型端点 —— 用来验证**接线**,不是用来验证解读。
   ────────────────────────────────────────────────────────────────────────
   `node tools/lab/fake-model.mjs` 起在 :11434,讲 OpenAI 那套
   (`/v1/models` + `/v1/chat/completions`,含 SSE)。

   ⭐ 它存在的理由:本地真模型要下几十个 G,而**接线坏没坏和模型好不好是两件事**。
      整条路 —— 计费闸、免费额度、危机闸、buildNode、SSE、前端渲染 ——
      可以用它在几秒内走一遍;等那条路是通的,再把 MODEL_BASE_URL 指向真的。

   ⚠️ 它按 system 提示词认出自己是哪一站,**答那一站的格式**。全都回散文的话
      下游会退回静态兜底、**而且看起来像正常工作** —— CLAUDE.md §5 为离线兜底
      记过同一条。所以这里 M1 答四行、M2 答 lib=、M3 答四层、M4 答一篇带标记的解读。 */
import http from "node:http";

const PORT = Number(process.argv[2] || process.env.PORT || 11434);
const MODELS = ["fake-small", "fake-big"];

/* 按 system 认站。认的是每一站提示词里独有的那句话 —— 认错了它就答错格式,
   而答错格式在下游是静默的。 */
function stationOf(system) {
  const s = String(system || "");
  if (s.includes("输出严格四行")) return "m1";
  if (s.includes("选出该开的库")) return "m2";
  if (s.includes("把盘变成这一卦的事")) return "m3";
  if (s.includes("你是讲这件事的人")) return "m4";
  if (s.includes("PASS") || s.includes("REWRITE")) return "qc";
  return "other";
}

const ANSWER = {
  m1: [
    "lang=Chinese",
    "db=婚恋",
    "ask=我和她还有没有可能",
    "hurt=0",
    "flags=指定对象",
    "facts=她是大学生;学医;现在在忙学业"
  ].join("\n"),
  m2: "lib=CLASS-RELATIONSHIP 凭=感情、关系、复合\nlib=TECH-VOID-BREAK 凭=XUN_EMPTY",
  m3: [
    "程1=火雷噬嗑 → 雷火丰,酉月壬辰日,世五应二,用神妻财两现(三爻动、五爻持世),动两爻",
    "程2=第3爻 妻财辰土 发动,化亥水父母 —— 化绝;裁决梯第3步定案",
    "程3=第5爻 妻财未土 旬空(假空,被第6爻动爻生着)",
    "法1=JM-VB-001 旬空四种候选:不存在 / 无力行动 / 不公开 / 尚未落实",
    "法2=JM-FLOW-003 连生要查源头、中间、终点是否真为用神",
    "实1=他说她是大学生、学医、在忙学业 —— 学业落在父母的名单里,而第3爻正是化父母",
    "推1=她在动的那一条,方向是学业,而那条路上她自己的劲到头",
    "推2=属于你们那一份在世位上,没被拿走,只是还没到场",
    "撑=程2,实1,推1   驳=—   救=程3(假空,会出空)   缺=JM-MOV-002 回头克(盘上没有,不用)",
    "链=程2 → 法2 → 推1 → 所以现在推没用,她那一头得先走完"
  ].join("\n"),
  m4: [
    "先说结论:还有,但不在现在这一段里 —— 而且挡着的不是别人。",
    "",
    "{她现在把劲全放在念书上|父母},动的那一条走到底是她自己先空掉,不是你们散了。",
    "",
    "而{属于你们俩的那一份|世爻}就在你自己的位置上,没被谁拿走,只是眼下还没到场。",
    "",
    "---",
    "",
    "*这是对一次投掷的一种读法,不是一份判决。*"
  ].join("\n"),
  qc: "PASS",
  other: "ok"
};

function chunks(text) {
  /* 一次发完技术上能跑,但**什么都没测到** —— 打字机、流式预览、自动滚动、
     落定动画全都只在文字正在到达时存在。CLAUDE.md §5 写过这一条。 */
  const out = [];
  for (let i = 0; i < text.length; i += 24) out.push(text.slice(i, i + 24));
  return out;
}

http.createServer((req, res) => {
  const cors = {
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "content-type, authorization"
  };
  if (req.method === "OPTIONS") { res.writeHead(204, cors); return res.end(); }

  if (req.url.replace(/\/$/, "").endsWith("/models")) {
    res.writeHead(200, { ...cors, "content-type": "application/json" });
    return res.end(JSON.stringify({ data: MODELS.map((id) => ({ id, object: "model" })) }));
  }

  if (!req.url.includes("/chat/completions")) {
    res.writeHead(404, cors); return res.end("not found");
  }

  let raw = "";
  req.on("data", (d) => { raw += d; });
  req.on("end", () => {
    let body = {};
    try { body = JSON.parse(raw); } catch {}
    /* ⚠️ 真的本地端点(llama.cpp / vLLM)会对未知字段 400。这里照做,
       否则 claude.js 那个「OpenRouter 扩展字段要按端点门控」就永远测不出来 —— *
       它会一路绿到你换上真端点的那一天。 */
    for (const k of ["reasoning", "usage", "provider", "transforms"]) {
      if (body[k] !== undefined) {
        res.writeHead(400, { ...cors, "content-type": "application/json" });
        return res.end(JSON.stringify({
          error: { message: `unknown field '${k}' — 本地端点不认 OpenRouter 的扩展字段`, type: "invalid_request_error" }
        }));
      }
    }

    const system = (body.messages || []).find((m) => m.role === "system")?.content || "";
    const station = stationOf(system);
    const text = ANSWER[station] ?? ANSWER.other;
    const usage = { prompt_tokens: Math.round(JSON.stringify(body.messages || "").length / 3),
                    completion_tokens: Math.round(text.length / 3) };
    console.log(`  ${new Date().toISOString().slice(11, 19)}  ${station.padEnd(5)} ${body.model || "?"}`
      + `${body.stream ? " (stream)" : ""}  → ${text.length} 字符`);

    if (!body.stream) {
      res.writeHead(200, { ...cors, "content-type": "application/json" });
      return res.end(JSON.stringify({
        id: "fake", object: "chat.completion", model: body.model,
        choices: [{ index: 0, message: { role: "assistant", content: text }, finish_reason: "stop" }],
        usage
      }));
    }

    res.writeHead(200, {
      ...cors, "content-type": "text/event-stream",
      "cache-control": "no-cache", connection: "keep-alive"
    });
    const parts = chunks(text);
    let i = 0;
    const tick = setInterval(() => {
      if (i < parts.length) {
        res.write("data: " + JSON.stringify({
          id: "fake", object: "chat.completion.chunk", model: body.model,
          choices: [{ index: 0, delta: { content: parts[i++] } }]
        }) + "\n\n");
        return;
      }
      clearInterval(tick);
      res.write("data: " + JSON.stringify({
        id: "fake", object: "chat.completion.chunk", model: body.model,
        choices: [{ index: 0, delta: {}, finish_reason: "stop" }], usage
      }) + "\n\n");
      res.write("data: [DONE]\n\n");
      res.end();
    }, 12);
  });
}).listen(PORT, "127.0.0.1", () => {
  console.log(`假模型端点 http://127.0.0.1:${PORT}/v1   模型:${MODELS.join(" ")}`);
  console.log(`它验的是接线,不是解读 —— 每一站答那一站的格式,而且拒收 OpenRouter 的扩展字段。`);
});
