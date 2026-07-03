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

async function hmacKey(secret) {
  return crypto.subtle.importKey(
    'raw', enc.encode(secret || 'bournewise-dev-secret'),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']
  );
}

export async function signSession(payload, secret) {
  const body = b64urlEncode(enc.encode(JSON.stringify(payload)));
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
    return JSON.parse(dec.decode(b64urlDecode(body)));
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
