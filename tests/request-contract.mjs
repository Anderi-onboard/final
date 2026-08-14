/**
 * REQUEST CONTRACT
 *
 * When the prompt moved server-side, the browser stopped sending a system
 * prompt and started sending the INPUTS the server assembles one from. That
 * split has a failure mode with no symptom: if a client-side request builder
 * forgets a field, the server still produces a well-formed prompt — just an
 * empty one. Routing quietly degrades and nothing errors.
 *
 * It happened immediately. Both builders were still written as
 * `{ system: input.system, messages: input.messages }`, so `question`,
 * `reading`, `methodLabel`, `lastQuestion` and `lastReading` were all dropped
 * on the floor, and every intent/followup call reached the server with nothing
 * to build from.
 *
 * Run: node tests/request-contract.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const read = (f) => readFileSync(`${ROOT}/${f}`, 'utf8');

const claude = read('functions/api/claude.js');
const router = read('prompt-router.js');
const base = read('ds-base.js');
const chat = read('chat-app.js');

// Every body.<field> the Function reads when assembling a prompt.
// Negative lookahead on "(" so `upstream.body.getReader()` — a stream method,
// not a request field — does not read as an input the client owes us.
const consumed = new Set(
  [...claude.matchAll(/\bbody\.([a-zA-Z_][a-zA-Z0-9_]*)(?![a-zA-Z0-9_])(?!\s*\()/g)].map((m) => m[1])
);
// Fields the server sets itself or handles outside assembly.
for (const own of ['messages', 'system', 'stream', 'model', 'product', 'role', 'mode',
                   'max_tokens', 'temperature']) consumed.delete(own);

// Whatever is left is assembly input and MUST be forwarded by both builders.
const mustForward = [...consumed].sort();
assert.ok(mustForward.length > 0, 'no assembly inputs found — did buildSystem change shape?');

for (const field of mustForward) {
  assert.ok(
    router.includes(`"${field}"`) || router.includes(`'${field}'`),
    `prompt-router.js never forwards "${field}", which functions/api/claude.js builds from`
  );
  assert.ok(
    base.includes(`'${field}'`) || base.includes(`"${field}"`),
    `ds-base.js never forwards "${field}", which functions/api/claude.js builds from`
  );
}

// Neither builder may send a system prompt: the server rejects one with 400,
// so a stray `system` field turns every reading into a hard error.
for (const [name, src] of [['prompt-router.js', router], ['ds-base.js', base]]) {
  assert.ok(
    !/system:\s*input\.system/.test(src),
    `${name} sends input.system — /api/claude answers that with a 400`
  );
}

/* Roles the server HANDLES. Scoped to buildSystem's body: elsewhere in the file
   `m.role === 'user'` compares a MESSAGE role, and letting that into the set
   made this check pass for the wrong reason — the client's stray "user" matched
   the server's stray "user" and neither was an API role. */
const buildSystemSrc = (() => {
  const start = claude.indexOf('async function buildSystem(');
  assert.ok(start > 0, 'buildSystem() not found in functions/api/claude.js');
  // The parameter list is destructured — `buildSystem({ body, env, ... })` — so
  // the first '{' after the name belongs to the parameters, not the body. Find
  // the body brace after the parameter list closes.
  const paren = claude.indexOf('(', start);
  let pd = 0, p = paren;
  for (; p < claude.length; p++) {
    if (claude[p] === '(') pd++;
    else if (claude[p] === ')' && --pd === 0) break;
  }
  const open = claude.indexOf('{', p);
  let depth = 0, i = open;
  for (; i < claude.length; i++) {
    if (claude[i] === '{') depth++;
    else if (claude[i] === '}' && --depth === 0) break;
  }
  return claude.slice(open, i + 1);
})();
const serverRoles = new Set(
  // Bare `role`, never `m.role` — the lastUser lookup lives in this function too
  // and compares a message role.
  [...buildSystemSrc.matchAll(/(?<![.\w])role === '([a-z_]+)'/g)].map((m) => m[1])
);
assert.ok(serverRoles.size > 0, 'buildSystem() handles no roles — did it change shape?');
assert.ok(!serverRoles.has('user'), 'a message role leaked into the server role set');
/* Roles the client ASKS THE API for. Grepping chat-app.js for `role:` wholesale
   does not work: the app's own message objects use the same key for a different
   namespace ("user", "assistant", "oracle"). Scope to the argument object of a
   window.claude.complete(...) call, which is the only place an API role lives. */
const MESSAGE_ROLES = new Set(['user', 'assistant', 'system', 'oracle']);
const apiRoles = new Set();
for (const call of chat.matchAll(/window\.claude\.complete\(\{([\s\S]{0,600}?)\}\)/g)) {
  for (const m of call[1].matchAll(/\brole:\s*"([a-z_]+)"/g)) {
    if (!MESSAGE_ROLES.has(m[1])) apiRoles.add(m[1]);   // skip the messages array
  }
}
assert.ok(apiRoles.size > 0, 'no API roles found in chat-app.js — did the call shape change?');
for (const role of apiRoles) {
  if (role === 'utility') continue;            // generic; falls through to the default model
  assert.ok(
    serverRoles.has(role),
    `chat-app.js asks for role "${role}", which functions/api/claude.js does not handle`
  );
}

console.log(`request contract OK — ${mustForward.length} assembly inputs `
  + `(${mustForward.join(', ')}) forwarded by both builders; `
  + `roles ${[...apiRoles].sort().join('/')} all handled; no client system prompt`);
