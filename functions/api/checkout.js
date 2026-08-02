// functions/api/checkout.js — POST /api/checkout
// Creates a Creem hosted-checkout session for a prepaid unit pack and hands
// the browser its URL. pricing.html already speaks this contract: it POSTs
// { sku } and redirects to { url }; on 503 (payments not configured yet) it
// falls back to the local demo grant, so the page keeps working before the
// Creem env vars exist.
//
//   sku "pack4500" | "pack15000"…  → one-time unit top-ups
//
// Env (Pages → Settings → Variables and secrets):
//   CREEM_API_KEY            required — creem_… (live) or creem_test_… (test);
//                            the key prefix selects the API base automatically
//   CREEM_PRODUCT_PACK4500 … product ids for the unit packs (one per pack sku)
//
// The session's metadata carries { userId, sku } — the webhook uses it to
// credit the right account without trusting anything client-side.

import { sessionFromRequest } from '../_lib/session.js';
import { getUser } from '../_lib/db.js';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type'
};

export function creemBase(env) {
  return String(env.CREEM_API_KEY || '').indexOf('creem_test_') === 0
    ? 'https://test-api.creem.io'
    : 'https://api.creem.io';
}

export async function onRequestPost({ request, env }) {
  try {
    if (!env.CREEM_API_KEY) return json({ error: 'payments not configured' }, 503);
    const db = env.DB;
    if (!db) return json({ error: 'accounts backend not configured' }, 501);

    const session = await sessionFromRequest(request, env);
    const user = session ? await getUser(db, session.uid) : null;
    if (!user) return json({ error: 'sign in required' }, 401);

    const body = await request.json().catch(() => ({}));
    const sku = String(body.sku || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!sku) return json({ error: 'no sku' }, 400);
    if (!/^pack(4500|15000|30000|75000)$/.test(sku)) return json({ error: 'unknown sku' }, 400);

    // sku → product id via env: pack4500 → CREEM_PRODUCT_PACK4500
    const productId = env['CREEM_PRODUCT_' + sku.toUpperCase()];
    if (!productId) return json({ error: 'unknown sku' }, 400);

    const origin = new URL(request.url).origin;
    const resp = await fetch(creemBase(env) + '/v1/checkouts', {
      method: 'POST',
      headers: { 'x-api-key': env.CREEM_API_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({
        product_id: productId,
        request_id: user.id + ':' + sku + ':' + Date.now(),
        success_url: origin + '/settings.html?billing=success',
        customer: { email: user.email },
        metadata: { userId: user.id, sku }
      })
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data.checkout_url) {
      return json({ error: 'checkout failed', detail: data && (data.message || data.error) }, 502);
    }
    return json({ url: data.checkout_url }, 200);
  } catch (e) {
    return json({ error: String((e && e.message) || e) }, 500);
  }
}

export function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status, headers: { 'content-type': 'application/json', ...CORS }
  });
}
