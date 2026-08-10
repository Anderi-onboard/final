// functions/api/account/[[path]].js — the account API (server source of truth).
// One catch-all dispatches every /api/account/* route by method + path.
//   GET    /api/account/me              → { signedIn, user, castings }
//   GET    /api/account/castings        → history list
//   POST   /api/account/castings        { id,title,method,payload }
//   DELETE /api/account/castings/:id    → remove one
//   POST   /api/account/signout         → clear session
//
// If D1 isn't bound (env.DB missing), every route returns 501 so the front-end
// silently keeps using its local (guest) store — the site never breaks.

import { sessionFromRequest, clearCookie } from '../../_lib/session.js';
import {
  getUser, publicUser, listCastings, saveCasting, deleteCasting
} from '../../_lib/db.js';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
  'access-control-allow-headers': 'content-type'
};

export async function onRequest(context) {
  const { request, env, params } = context;
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  const segs = Array.isArray(params.path) ? params.path : (params.path ? [params.path] : []);
  const route = segs.join('/');
  const db = env.DB;
  if (!db) return json({ error: 'accounts backend not configured' }, 501);

  const sess = await sessionFromRequest(request, env);

  // signout doesn't need a valid session
  if (route === 'signout' && request.method === 'POST') {
    return json({ ok: true }, 200, { 'set-cookie': clearCookie() });
  }

  // me — return account + history, or a clean signed-out marker
  if (route === 'me' && request.method === 'GET') {
    if (!sess) return json({ signedIn: false }, 200);
    const u = await getUser(db, sess.uid);
    if (!u) return json({ signedIn: false }, 200, { 'set-cookie': clearCookie() });
    const castings = await listCastings(db, u.id, 50);
    return json({ signedIn: true, user: publicUser(u), castings }, 200);
  }

  // everything below requires a session
  if (!sess) return json({ error: 'not signed in' }, 401);
  const uid = sess.uid;

  if (route === 'castings' && request.method === 'GET') {
    return json({ castings: await listCastings(db, uid, 50) }, 200);
  }
  if (route === 'castings' && request.method === 'POST') {
    const b = await body(request);
    if (!b.id) return json({ error: 'id required' }, 400);
    return json(await saveCasting(db, uid, b), 200);
  }
  if (segs[0] === 'castings' && segs[1] && request.method === 'DELETE') {
    return json(await deleteCasting(db, uid, segs[1]), 200);
  }

  return json({ error: 'not found', route, method: request.method }, 404);
}

async function body(request) { try { return await request.json(); } catch (e) { return {}; } }
function json(obj, status, extra) {
  return new Response(JSON.stringify(obj), {
    status, headers: { 'content-type': 'application/json', ...CORS, ...(extra || {}) }
  });
}
