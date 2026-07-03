// functions/api/auth/[[path]].js — sign-in routes.
//   POST /api/auth/dev      { email, name, provider }  → real, persisted sign-in
//   GET  /api/auth/google                              → redirect to Google consent
//   GET  /api/auth/google/callback?code=...            → exchange, upsert, set session
//   POST /api/auth/signout                             → clear session
//
// "dev" sign-in is a real account (persisted in D1), not a mock — it just skips
// the OAuth round-trip, which is ideal for local dev and email/password later.
// Google OAuth activates only when GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are set.

import { signSession, sessionCookie, clearCookie } from '../../_lib/session.js';
import { ensureUser, publicUser } from '../../_lib/db.js';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'content-type'
};

export async function onRequest(context) {
  const { request, env, params } = context;
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  const segs = Array.isArray(params.path) ? params.path : (params.path ? [params.path] : []);
  const route = segs.join('/');
  const db = env.DB;

  if (route === 'signout' && request.method === 'POST') {
    return json({ ok: true }, 200, { 'set-cookie': clearCookie() });
  }

  if (!db) return json({ error: 'accounts backend not configured' }, 501);

  // ── dev / email sign-in (persisted) ──
  if (route === 'dev' && request.method === 'POST') {
    const b = await body(request);
    const email = String(b.email || '').toLowerCase().trim();
    if (!email || email.indexOf('@') < 0) return json({ error: 'valid email required' }, 400);
    const u = await ensureUser(db, { email, name: b.name || email.split('@')[0], provider: b.provider || 'email' });
    const tok = await signSession({ uid: u.id, email: u.email, iat: Date.now() }, env.SESSION_SECRET);
    return json({ ok: true, user: publicUser(u) }, 200, { 'set-cookie': sessionCookie(tok) });
  }

  // ── Google OAuth start ──
  if (route === 'google' && request.method === 'GET') {
    if (!env.GOOGLE_CLIENT_ID) return json({ error: 'google oauth not configured' }, 501);
    const redirect = originOf(request) + '/api/auth/google/callback';
    const url = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      redirect_uri: redirect,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'online',
      prompt: 'select_account'
    });
    return Response.redirect(url, 302);
  }

  // ── Google OAuth callback ──
  if (route === 'google/callback' && request.method === 'GET') {
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
      return json({ error: 'google oauth not configured' }, 501);
    }
    const code = new URL(request.url).searchParams.get('code');
    if (!code) return json({ error: 'no code' }, 400);
    const redirect = originOf(request) + '/api/auth/google/callback';

    const tokRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code, client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirect, grant_type: 'authorization_code'
      })
    });
    if (!tokRes.ok) return json({ error: 'token exchange failed' }, 502);
    const tok = await tokRes.json();

    const profRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { authorization: 'Bearer ' + tok.access_token }
    });
    if (!profRes.ok) return json({ error: 'profile fetch failed' }, 502);
    const prof = await profRes.json();
    if (!prof.email) return json({ error: 'no email scope' }, 502);

    const u = await ensureUser(db, { email: prof.email, name: prof.name || prof.email.split('@')[0], provider: 'google' });
    const session = await signSession({ uid: u.id, email: u.email, iat: Date.now() }, env.SESSION_SECRET);
    // land back on the app with the session cookie set
    return new Response(null, {
      status: 302,
      headers: { location: originOf(request) + '/index.html', 'set-cookie': sessionCookie(session) }
    });
  }

  return json({ error: 'not found', route }, 404);
}

function originOf(request) {
  const u = new URL(request.url);
  return u.origin;
}
async function body(request) { try { return await request.json(); } catch (e) { return {}; } }
function json(obj, status, extra) {
  return new Response(JSON.stringify(obj), {
    status, headers: { 'content-type': 'application/json', ...CORS, ...(extra || {}) }
  });
}
