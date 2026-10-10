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

/* Stand-in for demonstration only: answers keep the shape the contracts ask for,
   every text is marked （演示）, and nothing here is a reading. The subject is
   labelled by keyword, and each claim answers the entry id it was given. */
export function createDemoLLM() {
  return createMockLLM({
    understand: ({ user }) => {
      const q = (/提问：(.*)/.exec(user) || [])[1] || '';
      return {
        restated: `（演示）${q}`, category: '演示',
        subject: /财|钱|求财/.test(q) ? 'wealth' : 'self',
        askerGender: 'unknown', askingForSelf: true, premises: [], factorsToCheck: [],
        wantsTiming: false, tone: '（演示）', psychology: '（演示）', risk: 'none',
        needs: { recastNotice: false, clarify: [] }
      };
    },
    claim: ({ user }) => {
      const id = (/entryId 必须填：(\S+)/.exec(user) || [])[1] || 'demo';
      return {
        entryId: id, claim: '（演示）这一条原句在本卦上的断法，占位文字。', linkToUser: '（演示）',
        realWorld: '（演示）', lines: [], confidence: 'low'
      };
    },
    synth: () => ({
      answered: true,
      answer: '（演示模式：没有接入模型，这里是占位文字，不是解读。）',
      checks: [], confidence: 'low', unansweredParts: []
    })
  });
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

/* Anthropic Messages API, called directly with the account's own key.
   Model names are configuration: the adapter sends whatever string it is given.
   The key goes only into the x-api-key header; it is never part of a message,
   an error, or a display. */
export function createAnthropicLLM({
  apiKey, models, baseUrl = 'https://api.anthropic.com', fetchImpl = globalThis.fetch,
  temperature = 0.3, maxTokens = 2000, version = '2023-06-01'
}) {
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY 未设置');
  for (const role of ROLES) {
    if (!models || !models[role]) throw new Error(`no model configured for role "${role}"`);
  }
  return {
    async complete({ role, system, user }) {
      const model = models[role];
      const res = await fetchImpl(`${baseUrl}/v1/messages`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': version
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          temperature,
          system,
          messages: [{ role: 'user', content: user }]
        })
      });
      if (!res.ok) {
        let detail = '';
        try {
          const body = await res.json();
          detail = body && body.error && body.error.message ? `：${body.error.message}` : '';
        } catch (e) { detail = ''; }
        throw new Error(`model call failed for role "${role}": HTTP ${res.status}${detail}`);
      }
      const data = await res.json();
      const text = Array.isArray(data && data.content)
        ? data.content.filter((b) => b && b.type === 'text').map((b) => b.text).join('')
        : '';
      if (!text) throw new Error(`model returned no text for role "${role}"`);
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
