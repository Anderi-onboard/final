/* 本地调试台 · 模型那一半 —— OpenAI 兼容的 /v1/chat/completions。
   ────────────────────────────────────────────────────────────────────────
   Ollama / LM Studio / llama.cpp server / vLLM 都讲这套协议,所以这里不绑任何一家:

     ollama serve                      → http://localhost:11434/v1
     LM Studio(Local Server 开着)    → http://localhost:1234/v1
     llama-server -m model.gguf        → http://localhost:8080/v1
     vLLM                              → http://localhost:8000/v1

   ⚠️ **不许在这里写死任何提示词。** 每一站的 system 都从 `functions/_lib/nodes/`
      的真 `buildNode` 来 —— 调试台调的是**上线那份**,不是它的复制品。
      抄一份到这里,你调的就是调试台,而不是产品。 */

/* 推理模型(Qwen3.x 一族)会把思考写在 `<think>…</think>` 里、放在答案**前面**。
   下游每一站都按行解析(`lang=`、`这一卦里=`、`lib=`),思考里正好也会出现这些字样 ——
   不剥掉的话,M1 读到的可能是它**想过又否掉**的那个 db。
   有的服务端把思考放进单独的 `reasoning_content` 字段,那种情况下 content 里本来就没有,
   这里不读那个字段。开头没闭合的 `<think>`(被 max_tokens 截断在思考中途)整段都不是答案。
   ⚠️ 有的对话模板把开头那个 `<think>` 放在提示词里,于是输出里**只有闭合的那一半** ——
      最后一个 `</think>` 之前的全是思考。 */
export function stripThink(text) {
  let s = String(text || "");
  s = s.replace(/<think>[\s\S]*?<\/think>/gi, "");
  const close = s.toLowerCase().lastIndexOf("</think>");
  if (close >= 0) s = s.slice(close + "</think>".length);
  if (/^\s*<think>/i.test(s)) s = "";
  return s.trim();
}

export class Local {
  constructor({ base = "http://localhost:11434/v1", key = "local", timeout = 300000 } = {}) {
    this.base = base.replace(/\/$/, "");
    this.key = key;
    this.timeout = timeout;
  }

  async models() {
    const r = await fetch(this.base + "/models", {
      headers: { authorization: "Bearer " + this.key }
    });
    if (!r.ok) throw new Error(`GET /models → ${r.status} ${await r.text()}`);
    const d = await r.json();
    return (d.data || []).map((m) => m.id);
  }

  /* 一次调用。返回 { text, ms, usage } —— usage 是**服务端报的**,
     没有就留 null;不要拿本地估算冒充它。
     `extra` 原样并进请求体(比如 Qwen3.8 的 `chat_template_kwargs`)。
     ⚠️ 只由调用方显式给 —— 本地端点有的会对不认识的字段回 400,
        这里默认一个字段都不多发。 */
  async chat({ model, system, user, temperature = 0, max_tokens = 4096, stop = null, extra = null }) {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), this.timeout);
    const t0 = Date.now();
    try {
      const r = await fetch(this.base + "/chat/completions", {
        method: "POST",
        signal: ac.signal,
        headers: { "content-type": "application/json", authorization: "Bearer " + this.key },
        body: JSON.stringify({
          model,
          messages: [{ role: "system", content: system }, { role: "user", content: user }],
          temperature,
          max_tokens,
          ...(stop ? { stop } : {}),
          ...(extra && typeof extra === "object" ? extra : {})
        })
      });
      const body = await r.text();
      if (!r.ok) throw new Error(`POST /chat/completions → ${r.status}\n${body.slice(0, 600)}`);
      let d;
      try { d = JSON.parse(body); }
      catch { throw new Error("回的不是 JSON(端点对吗?):\n" + body.slice(0, 400)); }
      const text = d.choices?.[0]?.message?.content ?? "";
      return {
        text: stripThink(text),
        ms: Date.now() - t0,
        usage: d.usage || null,
        finish: d.choices?.[0]?.finish_reason || null
      };
    } catch (e) {
      if (e.name === "AbortError") throw new Error(`超时 ${this.timeout}ms —— 本地大模型第一次加载权重会很慢,把 --timeout 调大`);
      if (/ECONNREFUSED|fetch failed/.test(String(e.message))) {
        throw new Error(`连不上 ${this.base} —— 本地服务起了吗?(ollama serve / LM Studio 的 Local Server)`);
      }
      throw e;
    } finally {
      clearTimeout(t);
    }
  }
}
