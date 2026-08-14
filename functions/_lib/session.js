// functions/_lib/session.js — stateless signed-cookie sessions.
// A session is  base64url(JSON payload) + "." + base64url(HMAC-SHA256).
// No server store needed; the signature (keyed by SESSION_SECRET) is the trust.
// Underscore-prefixed dir → not a route; imported by the API functions.

const COOKIE = 'bw_session';
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function b64urlEncode(bytes) {
  let s = btoa(String.fromCharCode(...new Uint8Array(bytes)));
  return s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  const bin = atob(str);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
const enc = new TextEncoder();
const dec = new TextDecoder();

// There is no default secret, deliberately. This used to fall back to the
// literal string 'bournewise-dev-secret' when SESSION_SECRET was unset, which
// meant a single missing environment variable silently turned every session
// into a forgeable one: anyone could mint a cookie for any uid — someone else's
// account, or a fresh one — and spend from it. A misconfigured deploy must fail
// loudly instead, so callers get a 503 and nobody gets a session at all.
async function hmacKey(secret) {
  if (!secret || String(secret).length < 16) {
    throw new Error('SESSION_SECRET is missing or too short — refusing to sign or verify sessions');
  }
  return crypto.subtle.importKey(
    'raw', enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']
  );
}

export function sessionSecretConfigured(env) {
  return !!(env && env.SESSION_SECRET && String(env.SESSION_SECRET).length >= 16);
}

export async function signSession(payload, secret) {
  // exp is what makes the cookie's Max-Age mean anything. Max-Age is a hint to
  // a browser we do not control; a stolen token is replayed with curl, which
  // ignores it entirely. Without a signed expiry a leaked session was valid
  // forever and could not be revoked.
  const withExp = { ...payload, exp: Date.now() + MAX_AGE * 1000 };
  const body = b64urlEncode(enc.encode(JSON.stringify(withExp)));
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(body));
  return body + '.' + b64urlEncode(sig);
}

export async function verifySession(token, secret) {
  if (!token || token.indexOf('.') < 0) return null;
  const [body, sig] = token.split('.');
  try {
    const key = await hmacKey(secret);
    const ok = await crypto.subtle.verify('HMAC', key, b64urlDecode(sig), enc.encode(body));
    if (!ok) return null;
    const payload = JSON.parse(dec.decode(b64urlDecode(body)));
    // Tokens minted before exp existed carry none; treat their iat as the
    // start of the same window so old sessions age out instead of being
    // grandfathered in forever.
    const expiry = Number(payload && payload.exp)
      || (Number(payload && payload.iat) ? Number(payload.iat) + MAX_AGE * 1000 : 0);
    if (!expiry || Date.now() > expiry) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

export function readCookie(request, name) {
  const h = request.headers.get('cookie') || '';
  const m = h.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : null;
}

export async function sessionFromRequest(request, env) {
  const tok = readCookie(request, COOKIE);
  return verifySession(tok, env.SESSION_SECRET);
}

export function sessionCookie(token) {
  return COOKIE + '=' + encodeURIComponent(token) +
    '; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=' + MAX_AGE;
}
export function clearCookie() {
  return COOKIE + '=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0';
}

export const SESSION_COOKIE = COOKIE;
