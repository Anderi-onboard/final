// functions/api/claude.js — BourneWise AI proxy (Cloudflare Pages Function).
// Route = folder layout, so this serves  POST /api/claude.
//
// Calls the Claude models through OpenRouter rather than Anthropic directly.
// The browser never sees the OpenRouter key. The front-end declares INTENT
// (product + role) and this Function picks the right model server-side:
//
//   product "stria"  → Opus 5       (baseline reading)
//   product "sortis" → Opus 5       (moving-line and transformed-hexagram analysis)
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
// URL could POST directly and burn the real API key. When D1 is configured,
// both reading methods require a signed-in account with a positive balance.
// Nothing is held up front: the server checks the balance, calls the model,
// then charges measured token usage in full — no reservation, no ceiling. A
// reading that outruns the balance still finishes and still bills, leaving the
// account negative; the next request is what gets refused.
//   - generation calls without a session are rejected; router/qc/utility calls
//     have no user ledger and are rate-limited by IP as an abuse backstop.
// Without D1 bound, none of this can be enforced (there's no account store
// to check against) — that mode is meant for local dev / static demos, not
// public production traffic. See README "Accounts, ledger & history".
//
// Secrets / vars (Pages → Settings → Environment, or .dev.vars locally):
//   OPENROUTER_API_KEY  (required)
//   STRIA_MODEL         (optional override, default anthropic/claude-opus-5)
//   SORTIS_MODEL        (optional override, default anthropic/claude-opus-5)
//   UTILITY_MODEL       (optional override, default anthropic/claude-haiku-4.5)
//   CLAUDE_MAX_TOKENS   (optional, default 1024)
//   CLAUDE_THINKING     (optional, "on" to re-enable extended thinking — see
//                        the note at the payload below before you do)
//
// If the key is unset or this Function errors, the front-end falls back to its
// deterministic local reading — the site still works, just without live prose.

import { sessionFromRequest } from '../_lib/session.js';
import { getUser, chargeUnits, bumpRateLimit, unitsForUsage, countCjk, consumeFreeReading, releaseFreeReading } from '../_lib/db.js';
import { PromptEngine } from '../_lib/prompt-engine.js';

// Same-origin only. The old '*' let any page on the internet POST here; the
// session cookie is SameSite=Lax so a cross-site POST never carried credentials
// anyway, but the utility roles need no session at all, so '*' was an open door
// to the model budget. Requests with no Origin (curl, server-to-server) are not
// blocked by CORS in the first place — that is what the auth + rate limit are
// for — but there is no reason to advertise access to browsers.
const ALLOWED_ORIGINS = [
  'https://bournewise.com',
  'https://www.bournewise.com',
  'http://localhost:8788',
  'http://127.0.0.1:8788'
];
function corsFor(request) {
  const origin = request && request.headers.get('origin');
  const ok = origin && (ALLOWED_ORIGINS.includes(origin) || /^https:\/\/[a-z0-9-]+\.bournewise\.pages\.dev$/.test(origin));
  return {
    'access-control-allow-origin': ok ? origin : ALLOWED_ORIGINS[0],
    'access-control-allow-methods': 'POST, GET, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'access-control-allow-credentials': 'true',
    vary: 'origin'
  };
}
const CORS = corsFor(null);

// Cost kill switch: keeps auth/account/billing online while blocking every AI
// proxy call, and therefore all OpenRouter spend. Flip to true to stop spending
// immediately without taking the site down.
//
// Re-enabled 2026-08-14 at the owner's request, in the same change that moved
// the prompt server-side. Note what that means: spend resumes the moment this
// deploys. Two environment variables have to be right first — OPENROUTER_API_KEY
// (or every call 503s) and SESSION_SECRET, which is now required rather than
// falling back to a default, so without it nobody can sign in and no reading
// can be billed to anyone.
const API_DISABLED = false;

// Canonical model ids the proxy is willing to call — OpenRouter slugs
// (vendor-prefixed). Old Anthropic-native ids are kept as aliases so any
// caller still sending them resolves to the right OpenRouter model.
const ALLOWED = {
  'anthropic/claude-opus-5': 'anthropic/claude-opus-5',
  'claude-opus-5': 'anthropic/claude-opus-5',
  'opus-5': 'anthropic/claude-opus-5',
  'anthropic/claude-opus-4.8': 'anthropic/claude-opus-4.8',
  'anthropic/claude-sonnet-5': 'anthropic/claude-sonnet-5',
  'claude-sonnet-5': 'anthropic/claude-sonnet-5',
  'sonnet-5': 'anthropic/claude-sonnet-5',
  'anthropic/claude-sonnet-4.6': 'anthropic/claude-sonnet-4.6',
  'anthropic/claude-haiku-4.5': 'anthropic/claude-haiku-4.5',
  'claude-opus-4-8': 'anthropic/claude-opus-4.8',
  'claude-sonnet-4-6': 'anthropic/claude-sonnet-4.6',
  'claude-haiku-4-5': 'anthropic/claude-haiku-4.5',
  opus: 'anthropic/claude-opus-5',
  sonnet: 'anthropic/claude-sonnet-4.6',
  haiku: 'anthropic/claude-haiku-4.5'
};

// Utility roles are the unbilled, session-less path: they are rate-limited by
// IP and nothing else, so their model is fixed here and a client-supplied
// `model` cannot raise it. Before this, `body.model` was honoured FIRST, which
// meant an unauthenticated caller could ask for Opus on the free path and spend
// the budget 120 times an hour per IP at the top rate.
const UTILITY_ROLES = new Set(['router', 'qc', 'utility', 'intent', 'followup', 'followup_suggest']);

function isUtilityRole(body) {
  return UTILITY_ROLES.has(String(body.role || '').toLowerCase());
}

function resolveModel(body, env) {
  if (isUtilityRole(body)) return env.UTILITY_MODEL || 'anthropic/claude-haiku-4.5';
  if (body.model && ALLOWED[body.model]) return ALLOWED[body.model];
  const product = String(body.product || '').toLowerCase();
  if (product === 'sortis') return env.SORTIS_MODEL || 'anthropic/claude-opus-5';
  if (product === 'stria') return env.STRIA_MODEL || 'anthropic/claude-opus-5';
  return env.STRIA_MODEL || 'anthropic/claude-opus-5';
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
  let chargeTo = null;  // { userId, reason } — who to bill once the reading is written
  let freeClaim = null; // { userId, reason } — a signup entitlement already spent
                        // on this request, to be returned if nothing is delivered
  try {
    if (!env.OPENROUTER_API_KEY) {
      return json({ error: 'OPENROUTER_API_KEY not configured' }, 503);
    }
    const body = await request.json().catch(() => ({}));
    const messages = Array.isArray(body.messages) ? body.messages : [];
    if (!messages.length) return json({ error: 'no messages' }, 400);

    const product = String(body.product || '').toLowerCase();
    // mode "followup" = a question ON the existing casting (no new hexagram).
    // It changes only what the charge is labelled in the ledger — both modes
    // are billed the same way, from the tokens they actually use.
    const mode = String(body.mode || '').toLowerCase() === 'followup' ? 'followup' : 'cast';

    let unitsRemaining = null;
    const db = env.DB;

    if (db) {
      const gate = await guardRequest({ request, env, db, product, mode });
      if (gate.error) return json(gate.error.body, gate.error.status);
      if (gate.charge) chargeTo = gate.charge;
      if (gate.freeClaim) freeClaim = gate.freeClaim;
      if (gate.unitsRemaining != null) unitsRemaining = gate.unitsRemaining;
    }
    // no DB bound: unauthenticated, unmetered — documented limitation above.

    // ── THE SYSTEM PROMPT IS BUILT HERE, NEVER RECEIVED ──────────────────
    // The browser declares intent; this Function assembles the instructions.
    // A client-supplied `system` is not merely ignored, it is refused: silently
    // dropping it would let an attacker believe their injection worked while
    // the real prompt ran, and would hide a misbehaving client from us.
    if (body.system != null) {
      return json({
        error: 'system prompts are assembled server-side and may not be supplied by the client',
        code: 'CLIENT_SYSTEM_REJECTED'
      }, 400);
    }
    let built;
    try {
      built = await buildSystem({ body, env, product, mode, messages });
    } catch (e) {
      console.error('prompt assembly failed', e);
      return json({ error: 'prompt assembly failed' }, 500);
    }
    // Crisis is decided here, not in the browser. It used to be a client-side
    // branch on the route the client had computed itself, which meant the whole
    // hard-stop could be skipped by a caller that simply did not run it. No
    // model call, no charge — the resources are returned directly.
    if (built.route === 'crisis') {
      chargeTo = null;
      return json({ route: 'crisis', crisis: true, text: CRISIS_TEXT, model: null }, 200);
    }
    const systemPrompt = built.system;
    // A role that builds its own user turn replaces the client's placeholder.
    const turnMessages = built.userOverride
      ? messages.slice(0, -1).concat([{ role: 'user', content: built.userOverride }])
      : messages;

    const model = resolveModel(body, env);
    const max_tokens = clampTokens(body.max_tokens, env, product);
    // OpenAI-style shape: system goes in the messages array, not a sibling field.
    const orMessages = systemPrompt
      ? [{ role: 'system', content: systemPrompt }, ...turnMessages]
      : turnMessages;
    const payload = { model, max_tokens, messages: orMessages };
    // Extended thinking OFF unless explicitly asked for. Opus 5 turns it on by
    // default, and its thinking is drawn from the SAME max_tokens budget as the
    // reading — the reader never sees a token of it, but it is charged for all
    // of them. Measured on one board, four identical requests at max_tokens
    // 12000: thinking ate 9-11k of the budget and the reading was cut off
    // mid-sentence at 257 / 1126 / 1769 / 2444 chars, each costing $0.389.
    // The same prompt with thinking off finished cleanly (finish_reason "stop")
    // at 4067-4889 chars for $0.196-0.217. So it was truncating every reading
    // AND doubling the bill. Note that finish_reason "length" arrives looking
    // like an ordinary completion, which is why this stayed invisible.
    if (String(env.CLAUDE_THINKING || '').toLowerCase() !== 'on') {
      payload.reasoning = { enabled: false };
    }
    /* SAMPLING IS GONE ON THE OPUS 5 FAMILY. temperature / top_p / top_k were
       removed on Fable 5, Opus 5, Opus 4.8, 4.7 and Sonnet 5 — the native API
       returns 400 for them. This path used to send temperature ≈ 1 so that
       「再起一卦」 drew a fresher wording; on those models the parameter is at
       best dropped by the proxy and at worst rejects the request, so the lever
       has not done anything for some time.
       A recast is still genuinely fresh: it re-tosses the coins, so the BOARD
       is new. Only the prose-level jitter is gone, and effort is the knob that
       replaced it. Older models still accept sampling, so it is passed through
       for them rather than removed outright. */
    const SAMPLING_REMOVED = /(fable-5|opus-5|opus-4-8|opus-4-7|sonnet-5)/;
    if (body.temperature != null && Number.isFinite(Number(body.temperature))
        && !SAMPLING_REMOVED.test(model)) {
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
        if (freeClaim) { await releaseFreeReading(db, freeClaim.userId, freeClaim.reason); freeClaim = null; }
        const detail = await upstream.text().catch(() => '');
        // Nothing was held and no tokens were produced, so there is nothing to
        // undo — the reader is simply not charged.
        chargeTo = null;
        return upstreamError(upstream.status, detail);
      }

      // OpenRouter streams OpenAI-shaped chunks (`choices[0].delta.content`,
      // terminated by a `data: [DONE]` record) — re-encode each one as the
      // Anthropic-shaped `content_block_delta` event prompt-router.js already
      // parses. The pump runs under waitUntil so BILLING SETTLEMENT survives
      // even a client disconnect. Every response is charged for the tokens it
      // actually produced. The trailing bw_meta event carries
      // { unitsRemaining, model, charged, incomplete? } for the client.
      const { readable, writable } = new TransformStream();
      const promptText = JSON.stringify(payload.messages);
      const run = pumpAndSettle({
        upstream, writable, env, db, mode, product,
        chargeTo, freeClaim, unitsRemaining, model,
        inChars: promptText.length, inCjk: countCjk(promptText)
      }).catch(async (e) => {
        /* An unhandled rejection inside waitUntil takes the whole invocation
           down and the caller sees a bare 502 with no body — which is what a
           reader hit, losing their one free reading to an error page. Contain
           it here, and give the entitlement back. */
        console.error('pumpAndSettle failed', e);
        if (freeClaim) { try { await releaseFreeReading(env.DB, freeClaim.userId, freeClaim.reason); } catch (e2) {} }
        try { await writable.getWriter().close(); } catch (e2) {}
      });
      if (context.waitUntil) context.waitUntil(run);
      return new Response(readable, {
        status: 200,
        headers: { ...CORS, 'content-type': 'text/event-stream', 'cache-control': 'no-cache' }
      });
    }

    /* A full reading takes 60-90s to generate and the non-streaming path waits
       for all of it before a single byte moves, so the connection dies before
       the answer exists — measured against production: HTTP 000 at 73 seconds,
       zero bytes, and the reader still charged 1090 units because settlement
       runs regardless. Streaming is not an optimisation here, it is what keeps
       the request alive, so a reading is never generated without it. Utility
       roles are short and stay non-streaming. */
    if ((product === 'sortis' || product === 'stria') && body.stream !== true) {
      chargeTo = null;
      return json({
        error: 'a reading must be requested with stream:true — the non-streaming path cannot outlast generation',
        code: 'STREAM_REQUIRED'
      }, 400);
    }

    const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: openrouterHeaders,
      body: JSON.stringify(payload)
    });

    if (!resp.ok) {
      const detail = await resp.text().catch(() => '');
      chargeTo = null;
      return upstreamError(resp.status, detail);
    }
    const data = await resp.json();
    const text = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
    let charged = 0;
    // Charge once, for what this generation actually used.
    if (chargeTo) {
      const promptText = JSON.stringify(payload.messages);
      const s = await chargeUsage(env.DB, chargeTo, model, data.usage,
        { inChars: promptText.length, inCjk: countCjk(promptText), outChars: text.length, outCjk: countCjk(text) });
      charged = s.charged;
      if (s.units != null) unitsRemaining = s.units;
      chargeTo = null;
    }
    const result = { text, model };
    if (unitsRemaining != null) result.unitsRemaining = unitsRemaining;
    if (chargeTo) result.charged = charged;
    return json(result, 200);
  } catch (e) {
    // Thrown before settlement, so no charge was ever applied. The message goes
    // to the log, not to the caller: an upstream error body is written by
    // someone else and relaying it verbatim hands out whatever it happens to
    // contain. Nothing here has ever carried the key — it only goes into an
    // outbound authorization header — but a response is the wrong place to
    // find that out.
    console.error('claude proxy error', e);
    return json({ error: 'reading failed' }, 500);
  }
}

// Read the upstream SSE, re-encode for the client, then SETTLE: every cast and
// follow-up is charged its measured usage, including after a truncated stream —
// where the charge covers what actually arrived, and no more.
// Runs under waitUntil, so settlement happens even if the client goes away.
async function pumpAndSettle(o) {
  const writer = o.writable.getWriter();
  const reader = o.upstream.body.getReader();
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let buf = '', outChars = 0, outCjk = 0, usage = null, finish = null, clientGone = false;
  // What actually REACHED the reader, as opposed to what the upstream produced.
  // A request whose connection dies before the first byte lands used to be
  // billed in full: the settlement runs under waitUntil and counted upstream
  // output regardless of whether any of it was written. Measured in production
  // — a request that returned HTTP 000 with zero bytes still charged 1090 units.
  let delivered = 0;
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
    outCjk += countCjk(text);   // for the fallback estimate if usage never arrives
    if (!clientGone) {
      const event = 'data: ' + JSON.stringify({ type: 'content_block_delta', delta: { type: 'text_delta', text } }) + '\n\n';
      try { await writer.write(encoder.encode(event)); delivered += text.length; }
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

  // 'stop'/'end_turn' = the model finished its sentence. 'length' = it ran out
  // of budget mid-word, which is NOT a finished reading — it used to be counted
  // as one, so the client's auto-continue never fired for the single most
  // common way a reading gets cut off. The charge is unaffected either way:
  // chargeUsage bills measured tokens regardless of how the stream ended.
  const complete = finish === 'stop' || finish === 'end_turn';
  let charged = 0;
  let units = o.unitsRemaining;
  let incomplete = !complete;
  // Nothing reached the reader, so there is nothing to bill them for. The
  // tokens were still produced and the provider still charges us for them —
  // that cost is ours, not theirs. Billing a reader for prose they never saw is
  // the one settlement outcome that cannot be defended, and metered billing
  // without a reservation is exactly what makes it possible.
  if (delivered === 0) {
    console.error('claude proxy: stream delivered nothing',
      { model: o.model, upstreamChars: outChars, finish });
    // Nothing reached the reader, so neither the balance nor the signup
    // entitlement may be spent on it.
    o.chargeTo = null;
    if (o.freeClaim && o.env && o.env.DB) {
      try { await releaseFreeReading(o.env.DB, o.freeClaim.userId, o.freeClaim.reason); } catch (e) {}
    }
  }
  if (o.chargeTo) {
    try {
      const s = await chargeUsage(o.env.DB, o.chargeTo, o.model, usage,
        { inChars: o.inChars, inCjk: o.inCjk, outChars, outCjk });
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

// Bill the reading for exactly what it used. There is no cap to clip against
// and no hold to settle — `owed` is the charge. It may take the balance below
// zero; see chargeUnits() for why that is the correct outcome rather than a
// bug to guard against.
async function chargeUsage(db, chargeTo, model, usage, fallback) {
  const owed = Math.max(0, unitsForUsage(model, usage, fallback));
  if (!owed) return { charged: 0, units: null };
  const s = await chargeUnits(db, chargeTo.userId, owed, chargeTo.reason);
  return { charged: owed, units: s && s.units != null ? s.units : null };
}

// ── Server-side prompt assembly ────────────────────────────────────────────
// Every role the client can ask for, and the ONLY inputs it gets to supply for
// each. Anything not listed here cannot reach a system prompt.
//
//   reading  (product sortis|stria) → the full stack, routed from the question
//   intent                          → "same matter or a new one?" classifier
//   qc                              → post-generation check on a written reading
//   followup                        → suggested next questions for this casting
//   router                          → the internal classifier; the server calls
//                                     this itself during `reading`, so a client
//                                     asking for it directly gets the same
//                                     server-built prompt and nothing more
async function buildSystem({ body, env, product, mode, messages }) {
  const role = String(body.role || '').toLowerCase();
  const str = (v, max) => String(v == null ? '' : v).slice(0, max);

  // A completion function the engine can call for its own routing sub-request.
  // Utility model, small budget, never billed to the reader.
  const utility = async ({ system, messages: msgs, max_tokens }) => {
    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer ' + env.OPENROUTER_API_KEY,
        'http-referer': 'https://bournewise.com',
        'x-title': 'BourneWise'
      },
      body: JSON.stringify({
        model: env.UTILITY_MODEL || 'anthropic/claude-haiku-4.5',
        max_tokens: Math.max(1, Math.min(64, Number(max_tokens) || 16)),
        reasoning: { enabled: false },
        messages: system ? [{ role: 'system', content: system }, ...msgs] : msgs
      })
    });
    if (!r.ok) throw new Error('router upstream ' + r.status);
    const d = await r.json();
    return (d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content) || '';
  };

  /* These two build a COMPLETE USER TURN, not a system prompt — that is how the
     engine has always written them, and how the client used them before the
     move server-side. Putting the text in the system slot and leaving the
     client's placeholder ("Route this message.") as the user turn made the
     model hunt for a message it could not see and answer by asking for the
     inputs that were, in fact, already in front of it. So: no system prompt,
     and the built text REPLACES the user turn. */
  if (role === 'intent') {
    return { userOverride: PromptEngine.INTENT_ROUTER.build(
      str(body.question, 2000), str(body.lastQuestion, 2000), str(body.lastReading, 8000)
    ) };
  }
  if (role === 'followup' || role === 'followup_suggest') {
    return { userOverride: PromptEngine.FOLLOWUP_SUGGEST.build(
      str(body.question, 2000), str(body.reading, 20000), str(body.methodLabel, 40)
    ) };
  }
  if (role === 'qc') return { system: PromptEngine.QC_SYSTEM };
  if (role === 'router') return { system: PromptEngine.ROUTER_SYSTEM };

  // Default: a reading. Route it from the question and assemble the stack.
  // The question is taken from `body.question` when the client sends it, and
  // otherwise recovered from the last user message, so a client that only ever
  // posts messages still gets correctly routed.
  const lastUser = [...messages].reverse().find((m) => m && m.role === 'user');
  const question = str(body.question || (lastUser && lastUser.content) || '', 4000);
  return PromptEngine.buildSystemPrompt(question, product, utility, { mode });
}

// Returned verbatim when the gate trips. Kept here rather than in the engine so
// the resource list is visible in the file that decides to send it.
const CRISIS_TEXT = [
  "I need to pause here. If you're in crisis or thinking about harming yourself or others, please reach out now:",
  '',
  '\u2022 US/Canada: 988',
  '\u2022 UK/Ireland: 116 123 (Samaritans)',
  '\u2022 Australia: Lifeline 13 11 14',
  '\u2022 EU: 112',
  '\u2022 Anywhere: findahelpline.com',
  '',
  'You matter. A real person can help right now.'
].join('\n');

// Auth + billing + rate-limit gate. Returns one of:
//   { error: { status, body } }   — reject, never call OpenRouter
//   { charge, unitsRemaining }    — cleared to run; bill it after it is written
async function guardRequest({ request, env, db, product, mode }) {
  const session = await sessionFromRequest(request, env);
  const user = session ? await getUser(db, session.uid) : null;
  const reason = (mode === 'followup' ? 'follow:' : 'cast:') + product;

  // Every generation settles against a real prepaid ledger.
  if ((product === 'sortis' || product === 'stria') && !user) {
    return { error: { status: 401, body: { error: 'sign in required for generation' } } };
  }

  if (product === 'sortis' || product === 'stria') {
    /* A NEW CASTING may be covered by the signup entitlement: one complete
       reading, spent before units and never partially — it runs to the end
       whatever it costs, and settlement skips it rather than billing it.
       A FOLLOW-UP is never covered. That is the model: the first answer is
       whole and free, and paying starts when the reader wants to go deeper
       into their own casting. */
    if (mode !== 'followup') {
      /* Always ASK, never pre-check. Gating this on `user.free_readings > 0`
         meant that on a database without the column the expression read
         `undefined > 0` — false — so the claim was never attempted and a new
         account with no units could do nothing at all. consumeFreeReading owns
         the decision, including the pre-migration path where the entitlement is
         derived from the ledger instead of stored. */
      const claim = await consumeFreeReading(db, user.id, 'free-reading:' + product);
      if (claim.claimed) {
        // freeClaim travels with the request so it can be handed back if this
        // reading never reaches the reader.
        return {
          charge: null,
          freeClaim: { userId: user.id, reason: 'free-reading:' + product },
          unitsRemaining: claim.units,
          freeReadings: claim.freeReadings
        };
      }
      // Already used, or lost the race — fall through to the balance.
    }

    // Any positive balance buys entry. Asking for more than that would mean
    // guessing what this particular reading is going to cost, and every such
    // guess has to sit above typical usage — which turns into refusing readers
    // who could have afforded what they actually asked for.
    if (!(user.units > 0)) {
      return {
        error: {
          status: 402,
          body: {
            error: 'insufficient units',
            units: user.units,
            // Tells the client which of the two walls it hit: a reader who has
            // used their free reading and wants to follow up needs a different
            // sentence from one who has simply run out.
            code: mode === 'followup' ? 'TOPUP_FOR_FOLLOWUP' : 'TOPUP_REQUIRED'
          }
        }
      };
    }
    return { charge: { userId: user.id, reason }, unitsRemaining: user.units };
  }

  // Router/qc utility calls have no user ledger to bill. Fall back to a per-IP
  // rolling-hour rate limit so the endpoint can't be scripted into unlimited
  // free completions.
  const ip = clientIp(request);
  const hourBucket = Math.floor(Date.now() / 3600000);
  const bucketKey = 'ip:' + ip + ':util:' + hourBucket;
  const rl = await bumpRateLimit(db, bucketKey, 120);  // 120 router+qc calls/hr
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
      stria: env.STRIA_MODEL || 'anthropic/claude-opus-5',
      sortis: env.SORTIS_MODEL || 'anthropic/claude-opus-5',
      utility: env.UTILITY_MODEL || 'anthropic/claude-haiku-4.5'
    }
  }, 200);
}

export function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

/* The output ceiling. A READING'S BUDGET IS DECIDED HERE, not by the browser:
 * the client used to send max_tokens 12000 and that number drove the model, which
 * both contradicts "the browser declares intent only" and put the one hard,
 * deterministic length control in the least trustworthy place. For a reading the
 * request is now ignored and the server ceiling applies; utility roles may still
 * ask for less than their own small ceiling, since a category label needs nothing.
 *
 * IT IS A COST RAIL, NOT A LENGTH CONTROL, and the distinction matters because
 * it has bitten here before. A cap only shortens a reading by TRUNCATING it, in
 * the middle of a sentence, and reporting finish_reason "length" that looks like
 * an ordinary completion — which is exactly how extended thinking silently cut
 * readings off at 257 / 1126 / 1769 / 2444 characters. So the ceiling is set well
 * above anything a real reading reaches and never used to aim at a target length;
 * that job belongs to the floor in output_sortis. Measured across five live
 * readings: 2448-4904 completion tokens, 20-41% of the budget, so nothing is
 * anywhere near it and nothing gets cut.
 */
const READING_CEILING = 16384;
function clampTokens(req, env, product) {
  const reading = product === 'sortis' || product === 'stria';
  const envCap = Number(env.CLAUDE_MAX_TOKENS) || 0;
  if (reading) return Math.max(64, Math.min(READING_CEILING, envCap || READING_CEILING));
  // Utility roles emit a category label, a short QC verdict or a few suggested
  // questions. Nothing they legitimately do needs more, and this is the path with
  // no session and no ledger behind it.
  return Math.max(64, Math.min(512, Number(req || envCap) || 1024));
}

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json', ...CORS }
  });
}

/* The model provider refused. Two things have to be true of what we send back.
 *
 * IT MUST NOT BE A 502. Cloudflare Pages substitutes its own error page for a
 * Function's 502 — text/plain, "error code: 502", sixteen bytes, none of our
 * headers — so the body we wrote is discarded at the edge and the caller gets
 * an opaque failure instead of the reason. That is not theoretical: readings
 * died for hours behind it while OpenRouter had been answering, in plain
 * English and in 45ms, "you requested up to 12000 tokens, but can only afford
 * 1217". The whole outage was a balance of about two cents, and the platform
 * ate the sentence that said so. 503 passes through; 502 does not.
 *
 * IT MUST NOT RELAY THE UPSTREAM BODY. That body is written by someone else
 * and can carry anything; it goes to the log, where we can read it, and never
 * into a response. What the caller gets is our own sentence plus the upstream
 * status, which is enough to tell a broken key from an empty balance from a
 * provider outage — the three things anyone debugging this needs to separate.
 */
function upstreamError(status, detail) {
  console.error('openrouter error', status, detail);
  const out = { upstream: status, code: 'UPSTREAM_UNAVAILABLE', error: 'the reading service is unavailable' };
  if (status === 402) {
    // Worth naming exactly: nothing is wrong with the code, the site, or the
    // reader's balance. The provider account needs topping up, and no reading
    // can be generated until it is.
    out.code = 'UPSTREAM_CREDIT';
    out.error = 'the reading service is out of credit — no reading can be generated until it is topped up';
  } else if (status === 401 || status === 403) {
    out.code = 'UPSTREAM_AUTH';
    out.error = 'the reading service rejected our credentials';
  } else if (status === 429) {
    out.code = 'UPSTREAM_RATE';
    out.error = 'the reading service is rate limiting us — try again shortly';
  }
  return json(out, 503);
}
