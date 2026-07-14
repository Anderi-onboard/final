// functions/api/claude.js — BourneWise AI proxy (Cloudflare Pages Function).
// Route = folder layout, so this serves  POST /api/claude.
//
// Calls the Claude models through OpenRouter rather than Anthropic directly.
// The browser never sees the OpenRouter key. The front-end declares INTENT
// (product + role) and this Function picks the right model server-side:
//
//   product "stria"  → Sonnet 4.6   (baseline reading)
//   product "sortis" → Opus 4.8     (deep causal synthesis)
//   role    "router" / "qc"         → Haiku 4.5 (cheap classification / QC)
//
// A client MAY still pass an explicit `model`, but only allow-listed ids are
// honoured — anything else is ignored and the intent-based default is used.
//
// OpenRouter speaks the OpenAI chat-completions shape, not Anthropic's native
// /v1/messages shape. To avoid touching the client (prompt-router.js parses
// Anthropic-style `content_block_delta` SSE events), this Function translates
// in both directions: it builds an OpenAI-style request, and — for the
// streaming path — re-encodes OpenRouter's `choices[].delta.content` chunks
// back into the `content_block_delta` events the client already understands.
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
//   OPENROUTER_API_KEY  (required)
//   STRIA_MODEL         (optional override, default anthropic/claude-sonnet-4.6)
//   SORTIS_MODEL        (optional override, default anthropic/claude-opus-4.8)
//   UTILITY_MODEL       (optional override, default anthropic/claude-haiku-4.5)
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

// Canonical model ids the proxy is willing to call — OpenRouter slugs
// (vendor-prefixed). Old Anthropic-native ids are kept as aliases so any
// caller still sending them resolves to the right OpenRouter model.
const ALLOWED = {
  'anthropic/claude-opus-4.8': 'anthropic/claude-opus-4.8',
  'anthropic/claude-sonnet-4.6': 'anthropic/claude-sonnet-4.6',
  'anthropic/claude-haiku-4.5': 'anthropic/claude-haiku-4.5',
  'claude-opus-4-8': 'anthropic/claude-opus-4.8',
  'claude-sonnet-4-6': 'anthropic/claude-sonnet-4.6',
  'claude-haiku-4-5': 'anthropic/claude-haiku-4.5',
  opus: 'anthropic/claude-opus-4.8',
  sonnet: 'anthropic/claude-sonnet-4.6',
  haiku: 'anthropic/claude-haiku-4.5'
};

function resolveModel(body, env) {
  if (body.model && ALLOWED[body.model]) return ALLOWED[body.model];
  const role = String(body.role || '').toLowerCase();
  if (role === 'router' || role === 'qc' || role === 'utility') {
    return env.UTILITY_MODEL || 'anthropic/claude-haiku-4.5';
  }
  const product = String(body.product || '').toLowerCase();
  if (product === 'sortis') return env.SORTIS_MODEL || 'anthropic/claude-opus-4.8';
  if (product === 'stria') return env.STRIA_MODEL || 'anthropic/claude-sonnet-4.6';
  return env.STRIA_MODEL || 'anthropic/claude-sonnet-4.6';
}

function clientIp(request) {
  return request.headers.get('cf-connecting-ip') ||
    (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() ||
    'unknown';
}

export async function onRequestPost({ request, env }) {
  let refundTo = null; // { userId, amount } — set once we've deducted, cleared on success
  try {
    if (!env.OPENROUTER_API_KEY) {
      return json({ error: 'OPENROUTER_API_KEY not configured' }, 503);
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
    // OpenAI-style shape: system goes in the messages array, not a sibling field.
    const orMessages = body.system ? [{ role: 'system', content: body.system }, ...messages] : messages;
    const payload = { model, max_tokens, messages: orMessages };
    const openrouterHeaders = {
      'content-type': 'application/json',
      authorization: 'Bearer ' + env.OPENROUTER_API_KEY,
      'http-referer': 'https://bournewise.com',
      'x-title': 'BourneWise'
    };

    // Streaming path: only the main reading call asks for this (router/qc
    // stay non-streaming — they're single short completions, nothing to
    // gain from streaming them). Billing/auth already happened above via
    // guardRequest, identical to the non-streaming path; only the response
    // shape differs from here on.
    if (body.stream === true) {
      payload.stream = true;
      const upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: openrouterHeaders,
        body: JSON.stringify(payload)
      });

      if (!upstream.ok || !upstream.body) {
        if (refundTo) await grantUnits(env.DB, refundTo.userId, refundTo.amount, 'refund:openrouter_' + upstream.status);
        const detail = await upstream.text().catch(() => '');
        return json({ error: 'openrouter ' + upstream.status, detail }, 502);
      }

      // OpenRouter streams OpenAI-shaped chunks (`choices[0].delta.content`,
      // terminated by a `data: [DONE]` record) — re-encode each one as the
      // Anthropic-shaped `content_block_delta` event prompt-router.js already
      // parses, then append the same trailing bw_meta event as before. A
      // failure mid-stream (after headers are already committed) can't be
      // refunded here; that's a known, accepted gap of SSE — same tradeoff
      // every streaming proxy makes.
      const encoder = new TextEncoder();
      const decoder = new TextDecoder();
      let buf = '';
      let finishReason = null, sawText = false;
      function scanRecord(raw) {
        if (!raw || raw === '[DONE]') return null;
        let obj;
        try { obj = JSON.parse(raw); } catch (e) { return null; }
        const ch = obj.choices && obj.choices[0];
        if (ch && ch.finish_reason) finishReason = ch.finish_reason;
        return ch && ch.delta && ch.delta.content;
      }
      const reencode = new TransformStream({
        transform(chunk, controller) {
          buf += decoder.decode(chunk, { stream: true });
          const records = buf.split('\n\n');
          buf = records.pop();
          for (const rec of records) {
            const dataLine = rec.split('\n').find((l) => l.indexOf('data:') === 0);
            if (!dataLine) continue;
            const text = scanRecord(dataLine.slice(5).trim());
            if (!text) continue;
            sawText = true;
            const event = 'data: ' + JSON.stringify({ type: 'content_block_delta', delta: { type: 'text_delta', text } }) + '\n\n';
            controller.enqueue(encoder.encode(event));
          }
        },
        async flush(controller) {
          // pick up a finish_reason sitting in the trailing (unsplit) buffer
          if (buf) {
            const dl = buf.split('\n').find((l) => l.indexOf('data:') === 0);
            if (dl && scanRecord(dl.slice(5).trim())) sawText = true;
          }
          // A reading that didn't finish cleanly ('stop') was cut by the token
          // cap ('length') or the upstream stream dropped — the atomic deduction
          // already happened, so REFUND it: the user must never pay full units
          // for a half reading (this was the "生成到一半还扣钱" waste).
          const meta = { unitsRemaining, model, finishReason };
          if (refundTo && (!sawText || finishReason !== 'stop')) {
            try {
              const r = await grantUnits(env.DB, refundTo.userId, refundTo.amount, 'refund:incomplete_' + (finishReason || 'drop'));
              if (r && r.ok) meta.unitsRemaining = r.units;
              meta.incomplete = true;
              meta.refunded = true;
              refundTo = null;
            } catch (e) {}
          }
          controller.enqueue(encoder.encode('event: bw_meta\ndata: ' + JSON.stringify(meta) + '\n\n'));
        }
      });
      return new Response(upstream.body.pipeThrough(reencode), {
        status: 200,
        headers: { ...CORS, 'content-type': 'text/event-stream', 'cache-control': 'no-cache' }
      });
    }

    const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: openrouterHeaders,
      body: JSON.stringify(payload)
    });

    if (!resp.ok) {
      if (refundTo) await grantUnits(env.DB, refundTo.userId, refundTo.amount, 'refund:openrouter_' + resp.status);
      const detail = await resp.text().catch(() => '');
      return json({ error: 'openrouter ' + resp.status, detail }, 502);
    }
    const data = await resp.json();
    const choice = data.choices && data.choices[0];
    const text = (choice && choice.message && choice.message.content) || '';
    const result = { text, model };
    // truncated by the token cap → refund (never charge for a half reading)
    if (refundTo && choice && choice.finish_reason === 'length') {
      try {
        const r = await grantUnits(env.DB, refundTo.userId, refundTo.amount, 'refund:incomplete_length');
        if (r && r.ok) result.unitsRemaining = r.units;
        result.incomplete = true;
        refundTo = null;
      } catch (e) {}
    } else if (unitsRemaining != null) {
      result.unitsRemaining = unitsRemaining;
    }
    return json(result, 200);
  } catch (e) {
    if (refundTo) { try { await grantUnits(env.DB, refundTo.userId, refundTo.amount, 'refund:error'); } catch (_) {} }
    return json({ error: String((e && e.message) || e) }, 500);
  }
}

// Auth + billing + rate-limit gate. Returns one of:
//   { error: { status, body } }              — reject, never call OpenRouter
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
    keyConfigured: !!env.OPENROUTER_API_KEY,
    billingEnforced: !!env.DB,
    models: {
      stria: env.STRIA_MODEL || 'anthropic/claude-sonnet-4.6',
      sortis: env.SORTIS_MODEL || 'anthropic/claude-opus-4.8',
      utility: env.UTILITY_MODEL || 'anthropic/claude-haiku-4.5'
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
