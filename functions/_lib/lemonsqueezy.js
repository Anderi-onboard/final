// functions/_lib/lemonsqueezy.js — Lemon Squeezy adapter (checkout + webhook
// signature + product mapping). This is the ONLY provider-specific payment
// code; everything it fulfills goes through the provider-agnostic helpers in
// db.js (markEvent / fulfillTopup / fulfillSubscription / expireSubscription).
//
// It stays fully INERT until these env vars are set (Pages → Settings → Env):
//   LEMONSQUEEZY_API_KEY        (server key)
//   LEMONSQUEEZY_STORE_ID       (numeric store id)
//   LEMONSQUEEZY_WEBHOOK_SECRET (the signing secret you set on the webhook)
//   LS_VARIANT_PRO / LS_VARIANT_PREMIUM                 (subscription variants)
//   LS_VARIANT_PACK_4500 / _15000 / _30000 / _75000     (one-time pack variants)
// Until LEMONSQUEEZY_API_KEY + LEMONSQUEEZY_STORE_ID exist, /api/checkout returns
// 503 and the pricing page keeps its current local demo behaviour.

export function lsConfigured(env) {
  return !!(env.LEMONSQUEEZY_API_KEY && env.LEMONSQUEEZY_STORE_ID);
}

// SKU sent by the pricing page → the Lemon Squeezy variant id (from env).
export function skuToVariant(env, sku) {
  const map = {
    pro: env.LS_VARIANT_PRO,
    premium: env.LS_VARIANT_PREMIUM,
    pack4500: env.LS_VARIANT_PACK_4500,
    pack15000: env.LS_VARIANT_PACK_15000,
    pack30000: env.LS_VARIANT_PACK_30000,
    pack75000: env.LS_VARIANT_PACK_75000
  };
  return map[sku] ? String(map[sku]) : null;
}

// Reverse: a variant id from a webhook → what it grants.
export function variantMeaning(env, variantId) {
  const v = variantId == null ? '' : String(variantId);
  if (!v) return null;
  if (v === String(env.LS_VARIANT_PRO || '')) return { kind: 'sub', plan: 'pro' };
  if (v === String(env.LS_VARIANT_PREMIUM || '')) return { kind: 'sub', plan: 'premium' };
  if (v === String(env.LS_VARIANT_PACK_4500 || '')) return { kind: 'topup', units: 4500 };
  if (v === String(env.LS_VARIANT_PACK_15000 || '')) return { kind: 'topup', units: 15000 };
  if (v === String(env.LS_VARIANT_PACK_30000 || '')) return { kind: 'topup', units: 30000 };
  if (v === String(env.LS_VARIANT_PACK_75000 || '')) return { kind: 'topup', units: 75000 };
  return null;
}

// Create a hosted checkout, attributing it to the signed-in user via custom
// data (comes back on the webhook as meta.custom_data.user_id).
export async function createCheckout(env, { variantId, userId, email, redirectUrl }) {
  const body = {
    data: {
      type: 'checkouts',
      attributes: {
        checkout_data: {
          email: email || undefined,
          custom: { user_id: String(userId) }
        },
        product_options: redirectUrl ? { redirect_url: redirectUrl } : undefined
      },
      relationships: {
        store: { data: { type: 'stores', id: String(env.LEMONSQUEEZY_STORE_ID) } },
        variant: { data: { type: 'variants', id: String(variantId) } }
      }
    }
  };
  const r = await fetch('https://api.lemonsqueezy.com/v1/checkouts', {
    method: 'POST',
    headers: {
      'Accept': 'application/vnd.api+json',
      'Content-Type': 'application/vnd.api+json',
      'Authorization': 'Bearer ' + env.LEMONSQUEEZY_API_KEY
    },
    body: JSON.stringify(body)
  });
  if (!r.ok) {
    const detail = await r.text().catch(() => '');
    return { ok: false, status: r.status, detail };
  }
  const j = await r.json().catch(() => null);
  const url = j && j.data && j.data.attributes && j.data.attributes.url;
  return url ? { ok: true, url } : { ok: false, status: 502, detail: 'no checkout url' };
}

// Verify the X-Signature header: hex HMAC-SHA256 of the raw body with the
// webhook signing secret. Constant-time compare.
export async function verifyLsSignature(rawBody, signatureHex, secret) {
  if (!signatureHex || !secret) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, enc.encode(rawBody));
  const hex = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('');
  if (hex.length !== signatureHex.length) return false;
  let diff = 0;
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ signatureHex.charCodeAt(i);
  return diff === 0;
}
