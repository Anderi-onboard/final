/**
 * UPSTREAM ERROR CONTRACT
 *
 * When the model provider refuses, the reason has to survive the trip back.
 * Twice now it did not, and each time the failure looked like a bug in our
 * code when it was not.
 *
 * 1. NEVER 502. Cloudflare Pages substitutes its own error page for a
 *    Function's 502 response: `content-type: text/plain`, body `error code:
 *    502`, sixteen bytes, none of our CORS headers. The JSON we wrote is
 *    discarded at the edge, so the caller sees an opaque platform failure and
 *    has no way to learn what happened. Readings died behind this for hours
 *    while OpenRouter had been answering in 45ms, in plain English: "You
 *    requested up to 12000 tokens, but can only afford 1217." The outage was a
 *    two-cent balance; the platform ate the sentence that said so. 503 passes
 *    through untouched, so upstream failures go out as 503.
 *
 * 2. NEVER RELAY THE UPSTREAM BODY. It is written by someone else and can
 *    carry anything. It belongs in the log, where we can read it, and never in
 *    a response — the caller gets our own sentence plus the numeric status,
 *    which is enough to separate a bad key from an empty balance from a
 *    provider outage.
 *
 * 3. SAY NOTHING WAS CHARGED. The generic failure copy tells the reader to
 *    check their balance rather than assume a refund — correct for a reading
 *    that died mid-flight and billed for what it produced, and alarming
 *    nonsense when the provider refused before generating a token. A 503 has
 *    its own line, and the free reading is released server-side to match it.
 *
 * Run: node tests/upstream-error.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => readFileSync(resolve(ROOT, f), 'utf8');

const claude = read('functions/api/claude.js');
const chat = read('chat-app.js');
const copy = read('copy.js');

// ── 1. no response anywhere in the proxy carries status 502 ────────────────
// Match the status argument of a json()/Response() call, not the digits 502
// wherever they appear — the comments explaining this rule say "502" a lot.
const five02 = [
  /\bjson\s*\([^;]*?,\s*502\s*\)/s,
  /status\s*:\s*502\b/
].filter((re) => re.test(claude));
assert.equal(five02.length, 0,
  'functions/api/claude.js returns a 502 — Cloudflare Pages replaces it with its own '
  + 'error page and the body is lost. Use upstreamError() / 503 instead.');

// ── 2. upstream failures go through the one helper, which logs and hides ───
assert.match(claude, /function upstreamError\s*\(\s*status\s*,\s*detail\s*\)/,
  'upstreamError(status, detail) is the single place an upstream refusal is turned into a response');

const helper = claude.slice(claude.indexOf('function upstreamError'));
const body = helper.slice(0, helper.indexOf('\n}\n') + 3);

assert.match(body, /console\.error\([^)]*detail/,
  'the upstream detail must reach the log — it is the only copy of the reason');
assert.doesNotMatch(body, /(error|message)\s*:\s*[^,;]*\bdetail\b/,
  'the upstream body must never be relayed to the caller');
assert.match(body, /json\(\s*out\s*,\s*503\s*\)/,
  'upstreamError must answer 503, the status Cloudflare passes through');

// Both call sites — streaming and non-streaming — use it.
assert.equal((claude.match(/return upstreamError\(/g) || []).length, 2,
  'both the streaming and non-streaming upstream failures go through upstreamError');

// ── 3. an empty provider balance is named, not lumped in with "unavailable" ─
assert.match(body, /status === 402/, 'a 402 is credit exhaustion and says so');
assert.match(body, /UPSTREAM_CREDIT/, 'the credit case carries its own machine-readable code');
assert.match(body, /out of credit/i, 'the credit case says what to do about it in words');
assert.match(body, /status === 401 \|\| status === 403/, 'auth failures are distinguishable from credit');

// ── 4. the reader is told nothing was charged ──────────────────────────────
assert.match(copy, /upstreamDown:/, 'copy.js carries the 503 line');
const line = copy.slice(copy.indexOf('upstreamDown:')).split('\n')[0];
assert.match(line, /nothing was charged/i, 'the 503 line states plainly that nothing was charged');
assert.match(line, /free reading is still yours/i, 'and that the free reading survived');

// Both failure renderers branch on 503 before falling through to the generic
// "check the balance" copy, which is the wrong thing to say here.
assert.equal((chat.match(/status === 503\) msg = C\.errors\.upstreamDown/g) || []).length, 2,
  'both castFail() and fail() must handle 503 — otherwise the reader is told to check a balance '
  + 'that was never touched');

// ── 5. the free reading is given back when the provider refuses ────────────
const streamBranch = claude.slice(claude.indexOf('if (!upstream.ok || !upstream.body)'));
assert.match(streamBranch.slice(0, 500), /releaseFreeReading\(/,
  'a provider refusal must return the free reading — it bought nothing');

console.log('upstream-error: ok');
