// functions/api/claude.js — BourneWise AI proxy (Cloudflare Pages Function).
// Route = folder layout, so this serves  POST /api/claude.
//
// The browser never sees the Anthropic key. The front-end declares INTENT
// (product + role) and this Function picks the right model server-side, so
// model choice and cost control live in one place:
//
//   product "stria"  → Sonnet 4.6   (baseline reading)
//   product "sortis" → Opus 4.8     (deep causal synthesis)
//   role    "router" / "qc"         → Haiku 4.5 (cheap classification / QC)
//
// A client MAY still pass an explicit `model`, but only allow-listed ids are
// honoured — anything else is ignored and the intent-based default is used.
//
// Secrets / vars (Pages → Settings → Environment, or .dev.vars locally):
//   ANTHROPIC_API_KEY   (required)
//   STRIA_MODEL         (optional override, default claude-sonnet-4-6)
//   SORTIS_MODEL        (optional override, default claude-opus-4-8)
//   UTILITY_MODEL       (optional override, default claude-haiku-4-5)
//   CLAUDE_MAX_TOKENS   (optional, default 1024)
//
// If the key is unset or this Function errors, the front-end falls back to its
// deterministic local reading — the site still works, just without live prose.

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, GET, OPTIONS',
  'access-control-allow-headers': 'content-type'
};

// Canonical model ids the proxy is willing to call. Friendly aliases included.
const ALLOWED = {
  'claude-opus-4-8': 'claude-opus-4-8',
  'claude-sonnet-4-6': 'claude-sonnet-4-6',
  'claude-haiku-4-5': 'claude-haiku-4-5',
  opus: 'claude-opus-4-8',
  sonnet: 'claude-sonnet-4-6',
  haiku: 'claude-haiku-4-5'
};

function resolveModel(body, env) {
  // 1. explicit, allow-listed request wins (back-compat with router/qc overrides)
  if (body.model && ALLOWED[body.model]) return ALLOWED[body.model];
  // 2. role-based: classification / quality-control runs on the cheap model
  const role = String(body.role || '').toLowerCase();
  if (role === 'router' || role === 'qc' || role === 'utility') {
    return env.UTILITY_MODEL || 'claude-haiku-4-5';
  }
  // 3. product-based: the main reading
  const product = String(body.product || '').toLowerCase();
  if (product === 'sortis') return env.SORTIS_MODEL || 'claude-opus-4-8';
  if (product === 'stria') return env.STRIA_MODEL || 'claude-sonnet-4-6';
  // 4. nothing declared — a safe, capable default
  return env.STRIA_MODEL || 'claude-sonnet-4-6';
}

export async function onRequestPost({ request, env }) {
  try {
    if (!env.ANTHROPIC_API_KEY) {
      return json({ error: 'ANTHROPIC_API_KEY not configured' }, 503);
    }
    const body = await request.json().catch(() => ({}));
    const messages = Array.isArray(body.messages) ? body.messages : [];
    if (!messages.length) return json({ error: 'no messages' }, 400);

    const model = resolveModel(body, env);
    const max_tokens = clampTokens(body.max_tokens, env);

    const payload = { model, max_tokens, messages };
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
      return json({ error: 'anthropic ' + resp.status, detail }, 502);
    }
    const data = await resp.json();
    const text = (data.content || [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('');
    return json({ text, model }, 200);
  } catch (e) {
    return json({ error: String((e && e.message) || e) }, 500);
  }
}

// GET /api/claude — health probe. Confirms the route is live and whether the
// key is configured, without ever leaking the key. Lets the front-end (and you)
// verify the backend is wired before spending a unit.
export async function onRequestGet({ env }) {
  return json({
    ok: true,
    service: 'bournewise-claude-proxy',
    keyConfigured: !!env.ANTHROPIC_API_KEY,
    models: {
      stria: env.STRIA_MODEL || 'claude-sonnet-4-6',
      sortis: env.SORTIS_MODEL || 'claude-opus-4-8',
      utility: env.UTILITY_MODEL || 'claude-haiku-4-5'
    }
  }, 200);
}

export function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

function clampTokens(req, env) {
  const n = Number(req || env.CLAUDE_MAX_TOKENS) || 1024;
  return Math.max(256, Math.min(8192, n));
}

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json', ...CORS }
  });
}
