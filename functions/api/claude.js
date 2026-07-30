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
import { getUser, spendUnits, grantUnits, bumpRateLimit, METHOD_COST, FOLLOW_COST, unitsForUsage } from '../_lib/db.js';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, GET, OPTIONS',
  'access-control-allow-headers': 'content-type'
};

// Temporary kill switch: keep auth/account/billing routes online while
// preventing every AI proxy call (and therefore all OpenRouter spend).
// Set to false to restore the service.
const API_DISABLED = true;

// Canonical model ids the proxy is willing to call — OpenRouter slugs
// (vendor-prefixed). Old Anthropic-native ids are kept as aliases so any
// caller still sending them resolves to the right OpenRouter model.
const ALLOWED = {
  'anthropic/claude-opus-4.8': 'anthropic/claude-opus-4.8',
  'anthropic/claude-sonnet-5': 'anthropic/claude-sonnet-5',
  'claude-sonnet-5': 'anthropic/claude-sonnet-5',
  'sonnet-5': 'anthropic/claude-sonnet-5',
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

export async function onRequestPost(context) {
  const { request, env } = context;
  if (API_DISABLED) {
    return json({ error: 'AI API temporarily disabled', code: 'API_DISABLED' }, 503);
  }
  let refundTo = null; // { userId, amount } — set once we've deducted, cleared on success
  try {
    if (!env.OPENROUTER_API_KEY) {
      return json({ error: 'OPENROUTER_API_KEY not configured' }, 503);
    }
    const body = await request.json().catch(() => ({}));
    const messages = Array.isArray(body.messages) ? body.messages : [];
    if (!messages.length) return json({ error: 'no messages' }, 400);

    const product = String(body.product || '').toLowerCase();
    // mode "followup" = a question ON the existing casting (no new hexagram):
    // reserve at most half a cast and settle to actual usage afterwards. A
    // "cast" reserves the flat method price exactly as before.
    const mode = String(body.mode || '').toLowerCase() === 'followup' ? 'followup' : 'cast';
    const flat = product === 'sortis' ? METHOD_COST.sortis : product === 'stria' ? METHOD_COST.stria : 0;
    const cost = mode === 'followup'
      ? (product === 'sortis' ? FOLLOW_COST.sortis : product === 'stria' ? FOLLOW_COST.stria : 0)
      : flat;

    let unitsRemaining = null;
    const db = env.DB;

    if (db) {
      const gate = await guardRequest({ request, env, db, product, cost, mode });
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
    // optional sampling temperature (Anthropic models: 0..1). Used to give a
    // recast a genuinely fresher draw — the client sends temperature ≈ 1.
    if (body.temperature != null && Number.isFinite(Number(body.temperature))) {
      payload.temperature = Math.max(0, Math.min(1, Number(body.temperature)));
    }
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
      // OpenRouter extension: ship prompt/completion token counts in the final
      // stream chunk so settlement uses REAL usage, not an estimate.
      payload.usage = { include: true };
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
      // parses. The pump runs under waitUntil so BILLING SETTLEMENT survives
      // even a client disconnect: on a clean finish a cast keeps its flat
      // charge (unchanged economics); a stream that dies mid-reading — or any
      // follow-up — settles for the tokens actually delivered and refunds the
      // rest of the reserve. The trailing bw_meta event carries
      // { unitsRemaining, model, charged, incomplete? } for the client.
      const { readable, writable } = new TransformStream();
      const run = pumpAndSettle({
        upstream, writable, env, mode, product,
        reserved: cost, refundTo, unitsRemaining, model,
        inChars: JSON.stringify(payload.messages).length
      });
      if (context.waitUntil) context.waitUntil(run);
      return new Response(readable, {
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
    const text = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
    let charged = refundTo ? cost : 0;
    // Non-stream follow-up: settle to actual usage (the response is complete
    // by definition, so a cast keeps its flat price — unchanged).
    if (refundTo && mode === 'followup') {
      const s = await settleMetered(env.DB, refundTo, product, data.usage,
        { inChars: JSON.stringify(payload.messages).length, outChars: text.length }, cost, 'refund:follow_settle');
      charged = s.charged;
      if (s.units != null) unitsRemaining = s.units;
    }
    const result = { text, model };
    if (unitsRemaining != null) result.unitsRemaining = unitsRemaining;
    if (refundTo) result.charged = charged;
    return json(result, 200);
  } catch (e) {
    if (refundTo) { try { await grantUnits(env.DB, refundTo.userId, refundTo.amount, 'refund:error'); } catch (_) {} }
    return json({ error: String((e && e.message) || e) }, 500);
  }
}

// Read the upstream SSE, re-encode for the client, then SETTLE the reserve:
//   cast + clean finish        → flat charge stands (same profit as before)
//   cast + truncated stream    → charge metered actual, refund the rest
//   followup (always metered)  → charge actual usage, refund unused reserve
// Runs under waitUntil, so settlement happens even if the client goes away.
async function pumpAndSettle(o) {
  const writer = o.writable.getWriter();
  const reader = o.upstream.body.getReader();
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let buf = '', outChars = 0, usage = null, finish = null, clientGone = false;
  async function handleRecord(rec) {
    const dataLine = rec.split('\n').find((l) => l.indexOf('data:') === 0);
    if (!dataLine) return;
    const raw = dataLine.slice(5).trim();
    if (raw === '[DONE]') return;
    let obj;
    try { obj = JSON.parse(raw); } catch (e) { return; }
    if (obj.usage) usage = obj.usage;
    const ch = obj.choices && obj.choices[0];
    if (ch && ch.finish_reason) finish = ch.finish_reason;
    const text = ch && ch.delta && ch.delta.content;
    if (!text) return;
    outChars += text.length;
    if (!clientGone) {
      const event = 'data: ' + JSON.stringify({ type: 'content_block_delta', delta: { type: 'text_delta', text } }) + '\n\n';
      try { await writer.write(encoder.encode(event)); }
      catch (e) { clientGone = true; }
    }
  }
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const records = buf.split('\n\n');
      buf = records.pop();
      for (const rec of records) await handleRecord(rec);
      // client bailed: keep draining is pointless — stop and settle for what
      // was delivered up to this point.
      if (clientGone) { try { await reader.cancel(); } catch (e) {} break; }
    }
    // the upstream may end WITHOUT a trailing blank line — the residue is
    // often exactly the final record carrying usage + finish_reason, and
    // dropping it would misclassify a clean finish as a truncation.
    if (buf.trim()) await handleRecord(buf);
  } catch (e) { /* upstream died mid-stream → finish stays null → truncated */ }

  // 'stop'/'end_turn' = model finished; 'length' = hit max_tokens (the reading
  // is as long as we allow — that's a delivered reading, charge stands).
  const complete = finish === 'stop' || finish === 'end_turn' || finish === 'length';
  let charged = o.refundTo ? o.reserved : 0;
  let units = o.unitsRemaining;
  let incomplete = !complete;
  if (o.refundTo && (o.mode === 'followup' || !complete)) {
    try {
      const s = await settleMetered(o.env.DB, o.refundTo, o.product, usage,
        { inChars: o.inChars, outChars }, o.reserved,
        o.mode === 'followup' ? 'refund:follow_settle' : 'refund:truncated');
      charged = s.charged;
      if (s.units != null) units = s.units;
    } catch (e) { /* settlement failure must not kill the stream close */ }
  }
  if (!clientGone) {
    const meta = { unitsRemaining: units, model: o.model, charged };
    if (incomplete) meta.incomplete = true;
    try { await writer.write(encoder.encode('event: bw_meta\ndata: ' + JSON.stringify(meta) + '\n\n')); }
    catch (e) {}
  }
  try { await writer.close(); } catch (e) {}
}

// Charge metered actual (capped at the reserve), refund the difference.
// Returns { charged, units } — units is the fresh balance when a refund ran.
async function settleMetered(db, refundTo, product, usage, fallback, reserved, reason) {
  const metered = unitsForUsage(product, usage, fallback, reserved);
  const refund = reserved - metered;
  if (refund > 0) {
    const g = await grantUnits(db, refundTo.userId, refund, reason);
    return { charged: metered, units: g && g.ok ? g.units : null };
  }
  return { charged: metered, units: null };
}

// Auth + billing + rate-limit gate. Returns one of:
//   { error: { status, body } }              — reject, never call OpenRouter
//   { refund: {userId, amount}, unitsRemaining } — deducted; refund on failure
//   { unitsRemaining? }                        — allowed, nothing to refund
async function guardRequest({ request, env, db, product, cost, mode }) {
  const session = await sessionFromRequest(request, env);
  const user = session ? await getUser(db, session.uid) : null;
  const reason = (mode === 'followup' ? 'follow:' : 'cast:') + product;

  // A follow-up is metered against an account ledger — no anonymous follow-ups.
  if (mode === 'followup' && (product === 'sortis' || product === 'stria') && !user) {
    return { error: { status: 401, body: { error: 'sign in required for follow-ups' } } };
  }

  if (product === 'sortis') {
    if (!user) return { error: { status: 401, body: { error: 'sign in required for Sortis 6' } } };
    if (user.plan !== 'pro' && user.plan !== 'premium') {
      return { error: { status: 403, body: { error: 'Sortis 6 requires the Pro or Premium plan' } } };
    }
    const spend = await spendUnits(db, user.id, cost, reason);
    if (!spend.ok) return { error: { status: 402, body: { error: 'insufficient units', units: spend.units } } };
    return { refund: { userId: user.id, amount: cost }, unitsRemaining: spend.units };
  }

  if (product === 'stria' && user) {
    const spend = await spendUnits(db, user.id, cost, reason);
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
  if (API_DISABLED) {
    return json({
      ok: false,
      service: 'bournewise-claude-proxy',
      disabled: true,
      error: 'AI API temporarily disabled'
    }, 503);
  }
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
  // ceiling raised to 16384: a full Sortis reading (4000-6000 CJK chars across
  // all layers) was hitting the old 8192-token cap and truncating mid-sentence.
  return Math.max(256, Math.min(16384, n));
}

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json', ...CORS }
  });
}
