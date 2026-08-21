/**
 * OUTPUT BUDGET CONTRACT
 *
 * A reading's max_tokens is decided by the server. The browser used to send
 * 12000 and that number drove the model — which contradicts "the browser
 * declares intent only" and put the one hard, deterministic length control in
 * the least trustworthy place in the system.
 *
 * THE CEILING IS A COST RAIL, NOT A LENGTH CONTROL. A cap can only shorten a
 * reading by truncating it mid-sentence, and it reports finish_reason "length"
 * looking like an ordinary completion — which is exactly how extended thinking
 * silently cut readings off at 257 / 1126 / 1769 / 2444 characters. So it sits
 * well above anything a real reading reaches: measured across five live
 * readings, 2448-4904 completion tokens, 20-41% of the budget. Aiming at a
 * target length is the floor's job, in output_sortis.
 *
 * Run: node tests/token-cap.mjs
 */
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
const src = readFileSync(new URL('../functions/api/claude.js', import.meta.url), 'utf8');
const at = src.indexOf('const READING_CEILING');
const end = src.indexOf('\n}', src.indexOf('function clampTokens')) + 2;
const sb = { console }; vm.createContext(sb);
vm.runInContext(src.slice(at, end), sb);
const f = (req, env, product) => vm.runInContext('clampTokens', sb)(req, env, product);
// A reading ignores whatever the client asked for.
for (const req of [12000, 500, 999999, undefined, 0, -5, 'abc']) {
  assert.equal(f(req, {}, 'sortis'), 16384, `sortis must ignore client max_tokens=${req}`);
  assert.equal(f(req, {}, 'stria'), 16384, `stria must ignore client max_tokens=${req}`);
}
// The env var is the operator's knob, and only downward.
assert.equal(f(12000, { CLAUDE_MAX_TOKENS: '9000' }, 'sortis'), 9000);
assert.equal(f(12000, { CLAUDE_MAX_TOKENS: '99999' }, 'sortis'), 16384);
// Utility roles stay small and may still ask for less.
assert.equal(f(12000, {}, 'intent'), 512);
assert.equal(f(200, {}, 'intent'), 200);
assert.equal(f(1, {}, 'intent'), 64);
console.log('token-cap: ok — readings pinned to the server ceiling, utility roles capped at 512');
