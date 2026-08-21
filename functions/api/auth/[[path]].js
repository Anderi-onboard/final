// functions/api/auth/[[path]].js — sign-in / sign-up routes.
//
//   POST /api/auth/register  { email, password, name }  → create account + session
//   POST /api/auth/login     { email, password }        → verify + session
//   POST /api/auth/signout                              → clear session
//   GET  /api/auth/providers                            → which OAuth providers are configured
//   GET  /api/auth/oauth/:provider                      → redirect to provider consent
//   GET  /api/auth/oauth/:provider/callback?code=...    → exchange, upsert, set session
//
// Email/password accounts are stored in D1 (password hashed with PBKDF2, see
// _lib/password.js). OAuth providers are config-driven: a provider activates
// only when its {PROVIDER}_CLIENT_ID / {PROVIDER}_CLIENT_SECRET env vars are set
// (except Apple, which additionally needs a signed client-secret JWT — see note).
// New accounts open at zero units and one free reading (db.PLAN_GRANT.free = 0,
// db.SIGNUP_FREE_READINGS = 1). The welcome is a reading, not a balance.

import {
  signSession, sessionCookie, clearCookie, sessionSecretConfigured, readCookie
} from '../../_lib/session.js';
import { ensureUser, getUserByEmail, createEmailUser, publicUser, bumpRateLimit } from '../../_lib/db.js';
import { hashPassword, verifyPassword } from '../../_lib/password.js';

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
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'access-control-allow-credentials': 'true',
    vary: 'origin'
  };
}
let CORS = corsFor(null);

// OAuth CSRF: the `state` parameter used to be the literal provider name, which
// is a constant an attacker knows in advance. That made the callback accept any
// code anyone cared to send it — the login-CSRF shape, where a victim ends up
// silently signed into the ATTACKER'S account and everything they then cast is
// written to it. State is now a random nonce stored in a short-lived cookie and
// required to match on the way back.
const STATE_COOKIE = 'bw_oauth_state';
function newState() {
  const b = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function stateCookie(provider, nonce) {
  return STATE_COOKIE + '=' + encodeURIComponent(provider + ':' + nonce) +
    '; Path=/api/auth; HttpOnly; Secure; SameSite=Lax; Max-Age=600';
}
function clearStateCookie() {
  return STATE_COOKIE + '=; Path=/api/auth; HttpOnly; Secure; SameSite=Lax; Max-Age=0';
}

function clientIp(request) {
  return request.headers.get('cf-connecting-ip') ||
    (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
}

// Credential endpoints had no rate limit at all: password guessing was unlimited,
// and registration was unlimited too — which mattered most, because every new
// account carries a free reading, so a script could mint free model budget
// indefinitely. (It was a 1,500-unit grant when this was written; the shape of
// the abuse is the same either way — one whole reading is worth more than 1,500
// units, so the limit matters more now, not less.)
async function limited(db, request, bucket, max) {
  if (!db) return false;
  const key = 'ip:' + clientIp(request) + ':' + bucket + ':' + Math.floor(Date.now() / 3600000);
  const rl = await bumpRateLimit(db, key, max);
  return !rl.ok;
}

// Standard OAuth2 providers. Each needs {KEY}_CLIENT_ID + {KEY}_CLIENT_SECRET.
// `apple` is intentionally absent from the auto-generic flow: its client secret
// is a short-lived ES256 JWT signed with a .p8 key, so it needs a dedicated
// path + APPLE_TEAM_ID / APPLE_KEY_ID / APPLE_PRIVATE_KEY. It shows in the
// button list but reports "not configured" until that's wired.
const OAUTH = {
  google: {
    authorize: 'https://accounts.google.com/o/oauth2/v2/auth',
    token: 'https://oauth2.googleapis.com/token',
    userinfo: 'https://openidconnect.googleapis.com/v1/userinfo',
    scope: 'openid email profile',
    email: (p) => p.email, name: (p) => p.name
  },
  github: {
    authorize: 'https://github.com/login/oauth/authorize',
    token: 'https://github.com/login/oauth/access_token',
    userinfo: 'https://api.github.com/user',
    emailsUrl: 'https://api.github.com/user/emails',
    scope: 'read:user user:email',
    email: (p) => p.email, name: (p) => p.name || p.login
  },
  discord: {
    authorize: 'https://discord.com/api/oauth2/authorize',
    token: 'https://discord.com/api/oauth2/token',
    userinfo: 'https://discord.com/api/users/@me',
    scope: 'identify email',
    email: (p) => p.email, name: (p) => p.global_name || p.username
  },
  reddit: {
    authorize: 'https://www.reddit.com/api/v1/authorize',
    token: 'https://www.reddit.com/api/v1/access_token',
    userinfo: 'https://oauth.reddit.com/api/v1/me',
    scope: 'identity',
    basicAuth: true,               // reddit token endpoint wants HTTP Basic
    email: (p) => (p.name ? p.name + '@reddit.local' : null), // reddit doesn't expose email
    name: (p) => p.name
  },
  facebook: {
    authorize: 'https://www.facebook.com/v19.0/dialog/oauth',
    token: 'https://graph.facebook.com/v19.0/oauth/access_token',
    userinfo: 'https://graph.facebook.com/me?fields=id,name,email',
    scope: 'email public_profile',
    email: (p) => p.email || (p.id ? p.id + '@facebook.local' : null), name: (p) => p.name
  }
};

// Only the providers actually surfaced on the login page. (OAUTH above keeps a
// couple of extras wired generically in case they're re-enabled later.)
const SOCIAL_LABELS = { google: 'Google', reddit: 'Reddit', discord: 'Discord' };

export async function onRequest(context) {
  const { request, env, params } = context;
  CORS = corsFor(request);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  const segs = Array.isArray(params.path) ? params.path : (params.path ? [params.path] : []);
  const route = segs.join('/');
  const db = env.DB;

  // Anything that mints a session needs a real signing secret. Fail closed and
  // say so, rather than handing out cookies signed with a guessable default.
  const mintsSession = route === 'register' || route === 'login' || segs[0] === 'oauth';
  if (mintsSession && !sessionSecretConfigured(env)) {
    return json({ error: 'sessions are not configured on this deployment' }, 503);
  }

  if (route === 'signout' && request.method === 'POST') {
    return json({ ok: true }, 200, { 'set-cookie': clearCookie() });
  }

  // which providers can the login page light up? (email is always on)
  if (route === 'providers' && request.method === 'GET') {
    const configured = {};
    Object.keys(SOCIAL_LABELS).forEach((k) => {
      configured[k] = !!(env[k.toUpperCase() + '_CLIENT_ID'] && env[k.toUpperCase() + '_CLIENT_SECRET']);
    });
    return json({ email: true, providers: configured }, 200);
  }

  if (!db) return json({ error: 'accounts backend not configured' }, 501);

  // ── email + password ──
  if (route === 'register' && request.method === 'POST') {
    if (await limited(db, request, 'register', 10)) {
      return json({ error: 'too many sign-ups from this address — try again later' }, 429);
    }
    const b = await body(request);
    const email = String(b.email || '').toLowerCase().trim();
    const password = String(b.password || '');
    if (!validEmail(email)) return json({ error: 'a valid email is required' }, 400);
    if (password.length < 8) return json({ error: 'password must be at least 8 characters' }, 400);
    const existing = await getUserByEmail(db, email);
    if (existing) return json({ error: 'that email is already registered — sign in instead' }, 409);
    const passwordHash = await hashPassword(password);
    const u = await createEmailUser(db, { email, name: b.name || email.split('@')[0], passwordHash });
    const tok = await signSession({ uid: u.id, email: u.email, iat: Date.now() }, env.SESSION_SECRET);
    return json({ ok: true, user: publicUser(u) }, 200, { 'set-cookie': sessionCookie(tok) });
  }

  if (route === 'login' && request.method === 'POST') {
    if (await limited(db, request, 'login', 30)) {
      return json({ error: 'too many sign-in attempts — try again later' }, 429);
    }
    const b = await body(request);
    const email = String(b.email || '').toLowerCase().trim();
    const password = String(b.password || '');
    if (!email || !password) return json({ error: 'email and password are required' }, 400);
    const u = await getUserByEmail(db, email);
    // uniform error so we don't reveal which emails exist
    const bad = () => json({ error: 'wrong email or password' }, 401);
    if (!u || !u.password_hash) return bad();
    if (!(await verifyPassword(password, u.password_hash))) return bad();
    const tok = await signSession({ uid: u.id, email: u.email, iat: Date.now() }, env.SESSION_SECRET);
    return json({ ok: true, user: publicUser(u) }, 200, { 'set-cookie': sessionCookie(tok) });
  }

  // ── OAuth start:  /oauth/:provider ──
  if (segs[0] === 'oauth' && segs[1] && !segs[2] && request.method === 'GET') {
    const key = segs[1];
    if (key === 'apple') return json({ error: 'apple sign-in not configured' }, 501);
    const cfg = OAUTH[key];
    if (!cfg) return json({ error: 'unknown provider' }, 404);
    const cid = env[key.toUpperCase() + '_CLIENT_ID'];
    if (!cid) return json({ error: key + ' sign-in not configured' }, 501);
    const redirect = originOf(request) + '/api/auth/oauth/' + key + '/callback';
    const nonce = newState();
    const url = cfg.authorize + '?' + new URLSearchParams({
      client_id: cid, redirect_uri: redirect, response_type: 'code', scope: cfg.scope,
      state: key + ':' + nonce, access_type: 'online', prompt: 'select_account'
    });
    return new Response(null, {
      status: 302,
      headers: { location: url, 'set-cookie': stateCookie(key, nonce), ...CORS }
    });
  }

  // ── OAuth callback:  /oauth/:provider/callback ──
  if (segs[0] === 'oauth' && segs[1] && segs[2] === 'callback' && request.method === 'GET') {
    const key = segs[1];
    const cfg = OAUTH[key];
    if (!cfg) return json({ error: 'unknown provider' }, 404);
    const cid = env[key.toUpperCase() + '_CLIENT_ID'];
    const secret = env[key.toUpperCase() + '_CLIENT_SECRET'];
    if (!cid || !secret) return json({ error: key + ' sign-in not configured' }, 501);
    const qs = new URL(request.url).searchParams;
    const code = qs.get('code');
    if (!code) return json({ error: 'no code' }, 400);

    // The nonce we planted before the redirect has to come back, in the state
    // parameter AND in the cookie, and match. Without this the callback accepts
    // any code from anyone (see the note on STATE_COOKIE above).
    const expected = readCookie(request, STATE_COOKIE) || '';
    const got = qs.get('state') || '';
    const nonce = expected.startsWith(key + ':') ? expected.slice(key.length + 1) : '';
    if (!nonce || got !== key + ':' + nonce) {
      return json({ error: 'sign-in link expired or came from somewhere else — start again' }, 400, {
        'set-cookie': clearStateCookie()
      });
    }
    const redirect = originOf(request) + '/api/auth/oauth/' + key + '/callback';

    // exchange code → access token
    const tokenHeaders = { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json', 'user-agent': 'BourneWise/1.0' };
    const tokenParams = { code, redirect_uri: redirect, grant_type: 'authorization_code' };
    if (cfg.basicAuth) tokenHeaders.authorization = 'Basic ' + btoa(cid + ':' + secret);
    else { tokenParams.client_id = cid; tokenParams.client_secret = secret; }
    const tokRes = await fetch(cfg.token, { method: 'POST', headers: tokenHeaders, body: new URLSearchParams(tokenParams) });
    if (!tokRes.ok) return json({ error: 'token exchange failed', detail: await tokRes.text().catch(() => '') }, 502);
    const tok = await tokRes.json().catch(() => ({}));
    if (!tok.access_token) return json({ error: 'no access token' }, 502);

    // fetch profile
    const profRes = await fetch(cfg.userinfo, { headers: { authorization: 'Bearer ' + tok.access_token, 'user-agent': 'BourneWise/1.0', accept: 'application/json' } });
    if (!profRes.ok) return json({ error: 'profile fetch failed' }, 502);
    const prof = await profRes.json().catch(() => ({}));

    let email = cfg.email(prof);
    // GitHub hides email on the profile unless public — fall back to the emails API
    if (!email && cfg.emailsUrl) {
      const eRes = await fetch(cfg.emailsUrl, { headers: { authorization: 'Bearer ' + tok.access_token, 'user-agent': 'BourneWise/1.0', accept: 'application/json' } });
      if (eRes.ok) {
        const emails = await eRes.json().catch(() => []);
        const primary = Array.isArray(emails) && (emails.find((e) => e.primary) || emails[0]);
        if (primary) email = primary.email;
      }
    }
    if (!email) return json({ error: 'no email from ' + key }, 502);

    const u = await ensureUser(db, { email, name: cfg.name(prof) || email.split('@')[0], provider: key });
    const session = await signSession({ uid: u.id, email: u.email, iat: Date.now() }, env.SESSION_SECRET);
    // Two Set-Cookie headers: install the session, retire the one-shot state.
    const headers = new Headers({ location: originOf(request) + '/index.html' });
    headers.append('set-cookie', sessionCookie(session));
    headers.append('set-cookie', clearStateCookie());
    return new Response(null, { status: 302, headers });
  }

  return json({ error: 'not found', route }, 404);
}

function validEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }
function originOf(request) { return new URL(request.url).origin; }
async function body(request) { try { return await request.json(); } catch (e) { return {}; } }
function json(obj, status, extra) {
  return new Response(JSON.stringify(obj), {
    status, headers: { 'content-type': 'application/json', ...CORS, ...(extra || {}) }
  });
}
