/* Model adapters. The pipeline depends only on `complete({ role, system, user })`
   returning the model's text. Three adapters:
     createMockLLM        — tests and the demo; answers from handlers, no network
     createOpenRouterLLM  — OpenRouter-compatible chat API, one model per role
   Model names are configuration, not code: pass them in. */

export const ROLES = ['understand', 'claim', 'synth'];

export function createMockLLM(handlers) {
  const calls = [];
  return {
    calls,
    async complete({ role, system, user }) {
      calls.push({ role, system, user });
      const h = handlers[role];
      if (!h) throw new Error(`mock LLM has no handler for role "${role}"`);
      const out = await h({ system, user });
      return typeof out === 'string' ? out : JSON.stringify(out);
    }
  };
}

export function createOpenRouterLLM({
  apiKey, models, baseUrl = 'https://openrouter.ai/api/v1', fetchImpl = globalThis.fetch,
  referer = 'https://bournewise.com', title = 'BourneWise liuyao-core', temperature = 0.3, maxTokens = 2000
}) {
  for (const role of ROLES) {
    if (!models || !models[role]) throw new Error(`no model configured for role "${role}"`);
  }
  return {
    async complete({ role, system, user }) {
      const model = models[role];
      if (!model) throw new Error(`no model configured for role "${role}"`);
      const res = await fetchImpl(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${apiKey}`,
          'http-referer': referer,
          'x-title': title
        },
        body: JSON.stringify({
          model,
          temperature,
          max_tokens: maxTokens,
          messages: [{ role: 'system', content: system }, { role: 'user', content: user }]
        })
      });
      if (!res.ok) throw new Error(`model call failed for role "${role}": HTTP ${res.status}`);
      const data = await res.json();
      const text = data && data.choices && data.choices[0] && data.choices[0].message
        ? data.choices[0].message.content : null;
      if (typeof text !== 'string') throw new Error(`model returned no text for role "${role}"`);
      return text;
    }
  };
}

/* The model is asked for JSON. Accept it with or without a code fence, and
   nothing else: a stray sentence before the object is an error, not a guess. */
export function parseJSONText(text) {
  const t = String(text).trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    return { ok: true, value: JSON.parse(t) };
  } catch (e) {
    return { ok: false, error: `not valid JSON: ${e.message}` };
  }
}
