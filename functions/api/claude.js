// functions/api/claude.js — Cloudflare Pages Function.
// Proxies the browser's window.claude.complete() calls to the Anthropic API so
// the secret key never reaches the client. Deployed automatically by Cloudflare
// Pages at the route  /api/claude  (folder layout = route).
//
// Required: set an environment variable / secret named ANTHROPIC_API_KEY in your
// Pages project (Settings → Environment variables → add secret).
// Optional: CLAUDE_MODEL (defaults to claude-haiku-4-5), CLAUDE_MAX_TOKENS (1024).
//
// If this Function is absent or the key is unset, the front-end falls back to its
// built-in deterministic reading — the site still works, just without live prose.

export async function onRequestPost({ request, env }) {
  const cors = {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type'
  };
  try {
    if (!env.ANTHROPIC_API_KEY) {
      return json({ error: 'ANTHROPIC_API_KEY not configured' }, 503, cors);
    }
    const body = await request.json().catch(() => ({}));
    const messages = Array.isArray(body.messages) ? body.messages : [];
    if (!messages.length) return json({ error: 'no messages' }, 400, cors);

    const payload = {
      model: env.CLAUDE_MODEL || 'claude-haiku-4-5',
      max_tokens: Number(env.CLAUDE_MAX_TOKENS) || 1024,
      messages
    };
    if (body.system) payload.system = body.system;

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(payload)
    });

    if (!resp.ok) {
      const detail = await resp.text().catch(() => '');
      return json({ error: 'anthropic ' + resp.status, detail }, 502, cors);
    }
    const data = await resp.json();
    const text = (data.content || [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('');
    return json({ text }, 200, cors);
  } catch (e) {
    return json({ error: String(e && e.message || e) }, 500, cors);
  }
}

export function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-headers': 'content-type'
    }
  });
}

function json(obj, status, extra) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json', ...(extra || {}) }
  });
}
