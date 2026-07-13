// functions/api/checkout.js — POST /api/checkout
// Creates a hosted Lemon Squeezy checkout for a signed-in user and returns its
// URL. Inert until Lemon Squeezy env vars are configured (returns 503), so the
// pricing page can fall back to its current local behaviour until then.

import { sessionFromRequest } from '../_lib/session.js';
import { getUser } from '../_lib/db.js';
import { lsConfigured, skuToVariant, createCheckout } from '../_lib/lemonsqueezy.js';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type'
};

export async function onRequestPost({ request, env }) {
  if (!lsConfigured(env)) return json({ error: 'not_configured' }, 503);
  if (!env.DB) return json({ error: 'not_configured' }, 503);

  const session = await sessionFromRequest(request, env);
  const user = session ? await getUser(env.DB, session.uid) : null;
  if (!user) return json({ error: 'sign_in_required' }, 401);

  const body = await request.json().catch(() => ({}));
  const variantId = skuToVariant(env, String(body.sku || ''));
  if (!variantId) return json({ error: 'unknown_sku' }, 400);

  const origin = new URL(request.url).origin;
  const res = await createCheckout(env, {
    variantId,
    userId: user.id,
    email: user.email,
    redirectUrl: origin + '/?checkout=success'
  });
  if (!res.ok || !res.url) return json({ error: 'checkout_failed', detail: res.detail || '' }, 502);
  return json({ url: res.url }, 200);
}

export function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json', ...CORS }
  });
}
