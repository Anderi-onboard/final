/**
 * SESSION CONTRACT
 *
 * Two defects lived here, both invisible until exploited:
 *
 *   1. hmacKey() fell back to the literal 'bournewise-dev-secret' when
 *      SESSION_SECRET was unset, so one missing environment variable turned
 *      every session into a forgeable one — mint a cookie for any uid and
 *      spend from that account.
 *   2. verifySession() checked the signature but never an expiry. The 30-day
 *      Max-Age is a hint to a browser; a stolen token replayed with curl was
 *      valid forever and could not be revoked.
 *
 * Run: node tests/session-contract.mjs
 */
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { signSession, verifySession, sessionSecretConfigured } from '../functions/_lib/session.js';

const SECRET = 'a-real-secret-at-least-16-chars-long';
const OTHER = 'a-different-secret-16-chars';

const token = await signSession({ uid: 'u1', email: 'a@b.c', iat: Date.now() }, SECRET);
assert.equal((await verifySession(token, SECRET)).uid, 'u1', 'a valid session must verify');
assert.equal(await verifySession(token, OTHER), null, 'a session must not verify under another secret');

// No secret means no session — never a session signed with a default.
assert.equal(await verifySession(token, ''), null, 'verification must fail closed with no secret');
assert.equal(await verifySession(token, undefined), null, 'verification must fail closed with no secret');
await assert.rejects(() => signSession({ uid: 'u1' }, ''), 'signing must refuse without a secret');
await assert.rejects(() => signSession({ uid: 'u1' }, 'tooshort'), 'signing must refuse a short secret');

assert.equal(sessionSecretConfigured({ SESSION_SECRET: '' }), false);
assert.equal(sessionSecretConfigured({ SESSION_SECRET: 'short' }), false);
assert.equal(sessionSecretConfigured({ SESSION_SECRET: SECRET }), true);

// Every issued token carries a signed expiry.
const payload = JSON.parse(
  Buffer.from(token.split('.')[0].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString()
);
assert.ok(payload.exp && payload.exp > Date.now(), 'signSession must stamp a future exp');

// A correctly-signed but expired token is refused. Signed here with the real
// key so the test proves the EXPIRY is what rejects it, not the signature.
const b64url = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
function mint(claims) {
  const body = b64url(claims);
  return body + '.' + createHmac('sha256', SECRET).update(body).digest('base64url');
}
assert.equal(await verifySession(mint({ uid: 'u1', exp: Date.now() - 1000 }), SECRET), null,
  'an expired token must be rejected');
assert.ok(await verifySession(mint({ uid: 'u1', exp: Date.now() + 60000 }), SECRET),
  'an unexpired token must be accepted');

// Legacy tokens predate exp; they age out from iat rather than living forever.
assert.equal(await verifySession(mint({ uid: 'u1', iat: Date.now() - 31 * 86400000 }), SECRET), null,
  'a legacy token past the window must be rejected');
assert.ok(await verifySession(mint({ uid: 'u1', iat: Date.now() }), SECRET),
  'a recent legacy token must still work');

// A token with neither exp nor iat is not a session.
assert.equal(await verifySession(mint({ uid: 'u1' }), SECRET), null,
  'a token with no expiry information must be rejected');

console.log('session contract OK — fails closed without a secret, and expiry is enforced');
