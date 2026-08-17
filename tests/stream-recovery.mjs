/**
 * STREAM RECOVERY CONTRACT
 *
 * A reading streams to the screen while the server meters it. Those two facts
 * together mean a dropped connection is NOT a failed request: the text that
 * arrived is on the reader's screen, and pumpAndSettle has already charged for
 * the tokens that produced it — settlement runs under waitUntil and does not
 * care whether the socket survived.
 *
 * The client used to reject on a mid-stream read error, which threw the partial
 * reading away and replaced it with "your units are back where they were". Both
 * halves were wrong: the reader lost text they had paid for, and the message
 * described a refund that never happens.
 *
 * Run: node tests/stream-recovery.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => readFileSync(resolve(ROOT, f), 'utf8');

const router = read('prompt-router.js');
const chat = read('chat-app.js');
const copy = read('copy.js');
const claude = read('functions/api/claude.js');

// ── the server bills what it delivered, whatever happened to the socket ────
const pump = (() => {
  const start = claude.indexOf('async function pumpAndSettle(');
  assert.ok(start > 0, 'pumpAndSettle() not found');
  const open = claude.indexOf('{', claude.indexOf(')', start));
  let depth = 0, i = open;
  for (; i < claude.length; i++) {
    if (claude[i] === '{') depth++;
    else if (claude[i] === '}' && --depth === 0) break;
  }
  return claude.slice(open, i + 1);
})();
assert.ok(/chargeUsage\(/.test(pump),
  'pumpAndSettle no longer settles — the premise of this whole file is gone');
assert.ok(/clientGone/.test(pump),
  'pumpAndSettle no longer tracks a departed client');

// ── the client keeps partial text rather than rejecting ───────────────────
const streamFn = (() => {
  const start = router.indexOf('function makeStreamComplete(');
  assert.ok(start > 0, 'makeStreamComplete() not found');
  const open = router.indexOf('{', router.indexOf(')', start));
  let depth = 0, i = open;
  for (; i < router.length; i++) {
    if (router[i] === '{') depth++;
    else if (router[i] === '}' && --depth === 0) break;
  }
  return router.slice(open, i + 1);
})();

assert.ok(
  /reader\.read\(\)\.then\(\s*function[\s\S]{0,40}?,\s*function/.test(streamFn)
  || /reader\.read\(\)\.then\([\s\S]*?\},\s*function \(readErr\)/.test(streamFn),
  'reader.read() has no rejection handler — a cut stream discards the text again'
);
assert.ok(/return fullText;\s*\/\/ keep the part that arrived/.test(streamFn)
  || /if \(fullText\)[\s\S]{0,220}return fullText/.test(streamFn),
  'the rejection path does not resolve with the text that already arrived');
assert.ok(/throw readErr/.test(streamFn),
  'a stream that delivered nothing must still surface as an error');

// ── no user-facing copy promises a refund ─────────────────────────────────
for (const [name, src] of [['chat-app.js', chat], ['copy.js', copy]]) {
  for (const claim of ['back where they were', 'nothing was charged', 'units refunded']) {
    assert.ok(
      !src.includes(claim),
      `${name} tells the reader "${claim}" — settlement bills delivered tokens, so that is not true`
    );
  }
}

// ── nothing delivered means nothing charged ────────────────────────────────
// Settlement runs under waitUntil, so a request whose connection dies before
// the first byte used to bill in full. Measured in production: HTTP 000, zero
// bytes, 1090 units charged.
assert.ok(/delivered\s*===\s*0/.test(pump),
  'pumpAndSettle bills again without checking whether anything reached the reader');
assert.ok(/delivered \+= text\.length/.test(pump),
  'pumpAndSettle no longer counts what it successfully wrote to the client');

// ── a reading is never generated without a stream ──────────────────────────
// The non-streaming path cannot outlast a 60-90s generation; it produced a dead
// connection AND a charge.
assert.ok(/STREAM_REQUIRED/.test(claude),
  '/api/claude accepts a non-streamed reading again — it will time out and bill for nothing');
assert.ok(!/complete_after_retry/.test(router),
  'the unreachable non-streamed QC retry is back, and it posts a system prompt the proxy rejects');
assert.ok(!/system: result\.system/.test(router),
  'prompt-router.js posts result.system again — /api/claude answers that with a 400');

console.log('stream recovery OK — partial readings survive a cut stream, '
  + 'a dead stream still errors, nothing undelivered is billed, and no copy promises a refund');
