// functions/api/claude.js — BourneWise AI proxy (Cloudflare Pages Function).
// Route = folder layout, so this serves  POST /api/claude.
//
// The browser never sees the Anthropic key. The front-end declares INTENT
// (product + role) and this Function picks the right model server-side:
//
//   product "stria"  → Sonnet 4.6   (baseline reading)
//   product "sortis" → Opus 4.8     (deep causal synthesis)
//   role    "router" / "qc"         → Haiku 4.5 (cheap classification / QC)
//
// A client MAY still pass an explicit `model`, but only allow-listed ids are
// honoured — anything else is ignored and the intent-based default is used.
//
// ── Abuse protection (only active when env.DB is bound — see README) ──────
// This endpoint used to be reachable with ZERO auth: anyone who found the
// URL could POST directly and burn the real Anthropic key, and "Sortis 6 is
// Pro-only" was enforced ONLY by a client-side check in account.js — trivial
// to bypass with a raw request. Now, when D1 is configured:
//   - product:"sortis"  → REQUIRES a signed-in session on a pro/premium
//     plan; the server deducts 1,500 units atomically before calling
//     Anthropic (refunded if the Anthropic call itself fails).
//   - product:"stria" with a session → server deducts 300 units the same way.
//   - product:"stria" with NO session (the anonymous free-trial guest) and
//     any role:"router"/"qc"/"utility" call → no user ledger to charge, so
//     instead we rate-limit by IP (rolling hour window) as a backstop
//     against pure script abuse, without breaking the no-signup free trial.
// Without D1 bound, none of this can be enforced (there's no account store
// to check against) — that mode is meant for local dev / static demos, not
// public production traffic. See README "Accounts, ledger & history".
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

import { sessionFromRequest } from '../_lib/session.js';
import { getUser, spendUnits, grantUnits, bumpRateLimit, METHOD_COST } from '../_lib/db.js';

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
  if (body.model && ALLOWED[body.model]) return ALLOWED[body.model];
  const role = String(body.role || '').toLowerCase();
  if (role === 'router' || role === 'qc' || role === 'utility') {
    return env.UTILITY_MODEL || 'claude-haiku-4-5';
  }
  const product = String(body.product || '').toLowerCase();
  if (product === 'sortis') return env.SORTIS_MODEL || 'claude-opus-4-8';
  if (product === 'stria') return env.STRIA_MODEL || 'claude-sonnet-4-6';
  return env.STRIA_MODEL || 'claude-sonnet-4-6';
}

function clientIp(request) {
  return request.headers.get('cf-connecting-ip') ||
    (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() ||
    'unknown';
}

export async function onRequestPost({ request, env }) {
  let refundTo = null; // { userId, amount } — set once we've deducted, cleared on success
  try {
    if (!env.ANTHROPIC_API_KEY) {
      return json({ error: 'ANTHROPIC_API_KEY not configured' }, 503);
    }
    const body = await request.json().catch(() => ({}));
    const messages = Array.isArray(body.messages) ? body.messages : [];
    if (!messages.length) return json({ error: 'no messages' }, 400);

    const product = String(body.product || '').toLowerCase();
    const cost = product === 'sortis' ? METHOD_COST.sortis : product === 'stria' ? METHOD_COST.stria : 0;

    let unitsRemaining = null;
    const db = env.DB;

    if (db) {
      const gate = await guardRequest({ request, env, db, product, cost });
      if (gate.error) return json(gate.error.body, gate.error.status);
      if (gate.refund) refundTo = gate.refund;
      if (gate.unitsRemaining != null) unitsRemaining = gate.unitsRemaining;
    }
    // no DB bound: unauthenticated, unmetered — documented limitation above.

    const model = resolveModel(body, env);
    const max_tokens = clampTokens(body.max_tokens, env);
    const payload = { model, max_tokens, messages };
    if (body.system) payload.system = body.system;

    // Streaming path: only the main reading call asks for this (router/qc
    // stay non-streaming — they're single short completions, nothing to
    // gain from streaming them). Billing/auth already happened above via
    // guardRequest, identical to the non-streaming path; only the response
    // shape differs from here on.
    if (body.stream === true) {
      payload.stream = true;
      const upstream = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify(payload)
      });

      if (!upstream.ok || !upstream.body) {
        if (refundTo) await grantUnits(env.DB, refundTo.userId, refundTo.amount, 'refund:anthropic_' + upstream.status);
        const detail = await upstream.text().catch(() => '');
        return json({ error: 'anthropic ' + upstream.status, detail }, 502);
      }

      // Passthrough Anthropic's SSE bytes unchanged, then append one extra
      // bw_meta event carrying unitsRemaining once the upstream stream ends
      // — the only piece of information the client needs that Anthropic's
      // stream itself doesn't carry. A failure mid-stream (after headers are
      // already committed) can't be refunded here; that's a known, accepted
      // gap of SSE — same tradeoff every streaming proxy makes.
      const encoder = new TextEncoder();
      const metaEvent = 'event: bw_meta\ndata: ' + JSON.stringify({ unitsRemaining, model }) + '\n\n';
      const tail = new TransformStream({
        flush(controller) { controller.enqueue(encoder.encode(metaEvent)); }
      });
      return new Response(upstream.body.pipeThrough(tail), {
        status: 200,
        headers: { ...CORS, 'content-type': 'text/event-stream', 'cache-control': 'no-cache' }
      });
    }

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
      if (refundTo) await grantUnits(env.DB, refundTo.userId, refundTo.amount, 'refund:anthropic_' + resp.status);
      const detail = await resp.text().catch(() => '');
      return json({ error: 'anthropic ' + resp.status, detail }, 502);
    }
    const data = await resp.json();
    const text = (data.content || [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('');
    const result = { text, model };
    if (unitsRemaining != null) result.unitsRemaining = unitsRemaining;
    return json(result, 200);
  } catch (e) {
    if (refundTo) { try { await grantUnits(env.DB, refundTo.userId, refundTo.amount, 'refund:error'); } catch (_) {} }
    return json({ error: String((e && e.message) || e) }, 500);
  }
}

// Auth + billing + rate-limit gate. Returns one of:
//   { error: { status, body } }              — reject, never call Anthropic
//   { refund: {userId, amount}, unitsRemaining } — deducted; refund on failure
//   { unitsRemaining? }                        — allowed, nothing to refund
async function guardRequest({ request, env, db, product, cost }) {
  const session = await sessionFromRequest(request, env);
  const user = session ? await getUser(db, session.uid) : null;

  if (product === 'sortis') {
    if (!user) return { error: { status: 401, body: { error: 'sign in required for Sortis 6' } } };
    if (user.plan !== 'pro' && user.plan !== 'premium') {
      return { error: { status: 403, body: { error: 'Sortis 6 requires the Pro or Premium plan' } } };
    }
    const spend = await spendUnits(db, user.id, cost, 'cast:sortis');
    if (!spend.ok) return { error: { status: 402, body: { error: 'insufficient units', units: spend.units } } };
    return { refund: { userId: user.id, amount: cost }, unitsRemaining: spend.units };
  }

  if (product === 'stria' && user) {
    const spend = await spendUnits(db, user.id, cost, 'cast:stria');
    if (!spend.ok) return { error: { status: 402, body: { error: 'insufficient units', units: spend.units } } };
    return { refund: { userId: user.id, amount: cost }, unitsRemaining: spend.units };
  }

  // No authenticated user to bill (anonymous guest trial, or a router/qc
  // utility call) — fall back to a per-IP rolling-hour rate limit so the
  // endpoint can't be scripted into unlimited free generations.
  const ip = clientIp(request);
  const hourBucket = Math.floor(Date.now() / 3600000);
  const isGeneration = cost > 0;
  const max = isGeneration ? 30 : 120; // 30 anon casts/hr; 120 router+qc/hr (≈ backs 60 casts)
  const bucketKey = 'ip:' + ip + ':' + (isGeneration ? 'cast' : 'util') + ':' + hourBucket;
  const rl = await bumpRateLimit(db, bucketKey, max);
  if (!rl.ok) return { error: { status: 429, body: { error: 'rate limit exceeded, try again later' } } };
  return {};
}

// GET /api/claude — health probe. Confirms the route is live and whether the
// key is configured, without ever leaking the key. Lets the front-end (and you)
// verify the backend is wired before spending a unit.
export async function onRequestGet({ env }) {
  return json({
    ok: true,
    service: 'bournewise-claude-proxy',
    keyConfigured: !!env.ANTHROPIC_API_KEY,
    billingEnforced: !!env.DB,
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
