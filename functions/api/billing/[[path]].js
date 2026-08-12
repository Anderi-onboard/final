// functions/api/billing/[[path]].js — Creem billing lifecycle.
//
//   POST /api/billing/webhook   ← Creem event deliveries (HMAC-SHA256 signed)
//   POST /api/billing/cancel    ← in-product subscription cancellation (session)
//   POST /api/billing/portal    ← Creem customer-portal link (session)
//   GET  /api/billing/status    ← current subscription for the signed-in user
//
// Money → units flow (idempotent by provider event id via billing_events):
//   checkout.completed  pack sku → grant the pack's units once
//                       plan sku → record subscription + set plan (units come
//                                  from subscription.paid, never here)
//   subscription.active → record/refresh the subscription row + plan
//   subscription.paid   → THE grant event: plan's monthly units, once per event
//   subscription.canceled / expired → downgrade to free (units are kept)
//   subscription.scheduled_cancel   → mark canceling; plan stays until period end
//
// Env: CREEM_API_KEY, CREEM_WEBHOOK_SECRET (Developers → Webhook),
//      CREEM_PRODUCT_PRO / CREEM_PRODUCT_PREMIUM (reverse product→plan map).

import { sessionFromRequest } from '../../_lib/session.js';
import {
  getUser, grantUnits, PLAN_GRANT,
  recordBillingEvent, upsertSubscription, getSubscriptionByUser, getSubscriptionById, setPlanQuiet
} from '../../_lib/db.js';
import { creemBase } from '../checkout.js';

const PROVIDER = 'creem';
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
  if (!db) return json({ error: 'accounts backend not configured' }, 501);

  if (route === 'webhook' && request.method === 'POST') return webhook(request, env, db);

  // Everything below acts on the signed-in user's own subscription.
  const session = await sessionFromRequest(request, env);
  const user = session ? await getUser(db, session.uid) : null;
  if (!user) return json({ error: 'sign in required' }, 401);

  if (route === 'status' && request.method === 'GET') {
    const sub = await getSubscriptionByUser(db, user.id, PROVIDER);
    return json({ ok: true, plan: user.plan, subscription: sub ? pubSub(sub) : null }, 200);
  }

  if (route === 'cancel' && request.method === 'POST') {
    if (!env.CREEM_API_KEY) return json({ error: 'payments not configured' }, 503);
    const sub = await getSubscriptionByUser(db, user.id, PROVIDER);
    if (!sub) return json({ error: 'no active subscription' }, 404);
    const r = await fetch(creemBase(env) + '/v1/subscriptions/' + encodeURIComponent(sub.id) + '/cancel', {
      method: 'POST',
      headers: { 'x-api-key': env.CREEM_API_KEY, 'content-type': 'application/json' }
    });
    if (!r.ok) {
      const detail = await r.text().catch(() => '');
      return json({ error: 'cancel failed', detail }, 502);
    }
    // Plan stays until the period ends; the canceled/expired webhook downgrades.
    await upsertSubscription(db, { id: sub.id, userId: user.id, provider: PROVIDER, customerId: sub.customer_id, plan: sub.plan, status: 'canceling', periodEnd: sub.period_end });
    return json({ ok: true, message: 'Subscription set to cancel — your plan stays active until the period ends, and your units are yours to keep.' }, 200);
  }

  if (route === 'portal' && request.method === 'POST') {
    if (!env.CREEM_API_KEY) return json({ error: 'payments not configured' }, 503);
    const sub = await getSubscriptionByUser(db, user.id, PROVIDER);
    if (!sub || !sub.customer_id) return json({ error: 'no billing profile yet' }, 404);
    const r = await fetch(creemBase(env) + '/v1/customers/billing', {
      method: 'POST',
      headers: { 'x-api-key': env.CREEM_API_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({ customer_id: sub.customer_id })
    });
    const d = await r.json().catch(() => ({}));
    const url = d.customer_portal_link || d.url || d.portal_url;
    if (!r.ok || !url) return json({ error: 'portal unavailable' }, 502);
    return json({ ok: true, url }, 200);
  }

  return json({ error: 'not found' }, 404);
}

// ── webhook ────────────────────────────────────────────────────────────────
async function webhook(request, env, db) {
  if (!env.CREEM_WEBHOOK_SECRET) return json({ error: 'webhook not configured' }, 503);
  const raw = await request.text();
  const sig = request.headers.get('creem-signature') || '';
  const expect = await hmacHex(env.CREEM_WEBHOOK_SECRET, raw);
  if (!timingSafeEq(sig, expect)) return json({ error: 'bad signature' }, 400);

  let evt;
  try { evt = JSON.parse(raw); } catch (e) { return json({ error: 'bad payload' }, 400); }
  const type = String(evt.eventType || evt.type || '');
  const obj = evt.object || {};
  const eventKey = String(evt.id || (type + ':' + (obj.id || '') + ':' + (evt.created_at || '')));

  // Resolve who this event belongs to: metadata we planted at checkout, or the
  // subscription row we stored on an earlier event.
  const meta = obj.metadata || (obj.subscription && obj.subscription.metadata) || {};
  let userId = meta.userId || null;
  const subObj = type === 'checkout.completed' ? (obj.subscription || null) : obj;
  const subId = subObj && subObj.object === 'subscription' ? subObj.id : (obj.subscription && obj.subscription.id) || null;
  if (!userId && subId) {
    const row = await getSubscriptionById(db, subId);
    if (row) userId = row.user_id;
  }

  // Idempotency FIRST: a replayed delivery must never re-grant.
  const rec = await recordBillingEvent(db, eventKey, PROVIDER, type, userId);
  if (!rec.fresh) return json({ ok: true, duplicate: true }, 200);
  if (!userId) return json({ ok: true, ignored: 'no user resolved' }, 200);

  const productId = productIdOf(obj);
  const plan = planForSku(meta.sku) || planForProduct(env, productId);
  const customerId = customerIdOf(obj);
  const periodEnd = subObj && (subObj.current_period_end_date || subObj.current_period_end) || null;

  if (type === 'checkout.completed') {
    const sku = String(meta.sku || '');
    if (sku.indexOf('pack') === 0) {
      const amount = parseInt(sku.slice(4), 10) || 0;
      if (amount > 0) await grantUnits(db, userId, amount, 'topup:creem:' + (obj.id || eventKey));
    } else if (plan) {
      await setPlanQuiet(db, userId, plan);
      if (subId) await upsertSubscription(db, { id: subId, userId, provider: PROVIDER, customerId, plan, status: 'active', periodEnd: toTs(periodEnd) });
    }
    return json({ ok: true }, 200);
  }

  if (type === 'subscription.active' || type === 'subscription.trialing') {
    if (plan && subId) {
      await setPlanQuiet(db, userId, plan);
      await upsertSubscription(db, { id: subId, userId, provider: PROVIDER, customerId, plan, status: 'active', periodEnd: toTs(periodEnd) });
    }
    return json({ ok: true }, 200);
  }

  if (type === 'subscription.paid') {
    const p = plan || (await getSubscriptionById(db, subId) || {}).plan;
    if (p && PLAN_GRANT[p]) {
      await setPlanQuiet(db, userId, p);
      await grantUnits(db, userId, PLAN_GRANT[p], 'grant:creem:' + p);
      if (subId) await upsertSubscription(db, { id: subId, userId, provider: PROVIDER, customerId, plan: p, status: 'active', periodEnd: toTs(periodEnd) });
    }
    return json({ ok: true }, 200);
  }

  if (type === 'subscription.scheduled_cancel') {
    if (subId) {
      const row = await getSubscriptionById(db, subId);
      if (row) await upsertSubscription(db, { id: subId, userId, provider: PROVIDER, customerId, plan: row.plan, status: 'canceling', periodEnd: toTs(periodEnd) });
    }
    return json({ ok: true }, 200);
  }

  if (type === 'subscription.canceled' || type === 'subscription.expired') {
    await setPlanQuiet(db, userId, 'free'); // units already granted stay theirs
    if (subId) {
      const row = await getSubscriptionById(db, subId);
      await upsertSubscription(db, { id: subId, userId, provider: PROVIDER, customerId, plan: (row && row.plan) || 'free', status: type === 'subscription.expired' ? 'expired' : 'canceled', periodEnd: toTs(periodEnd) });
    }
    return json({ ok: true }, 200);
  }

  return json({ ok: true, unhandled: type }, 200);
}

// ── helpers ────────────────────────────────────────────────────────────────
// Each billing interval is its own Creem product, so a plan arrives as
// "pro"/"premium" or as "promonthly"/"proannual"/"premiummonthly"/…
function planForSku(sku) {
  sku = String(sku || '').toLowerCase().replace(/(monthly|annual)$/, '');
  return sku === 'pro' || sku === 'premium' ? sku : null;
}
function planForProduct(env, productId) {
  if (!productId) return null;
  for (const plan of ['pro', 'premium']) {
    for (const suffix of ['', 'MONTHLY', 'ANNUAL']) {
      if (productId === env['CREEM_PRODUCT_' + plan.toUpperCase() + suffix]) return plan;
    }
  }
  return null;
}
function productIdOf(obj) {
  const p = obj.product || (obj.order && obj.order.product) || (obj.subscription && obj.subscription.product);
  return typeof p === 'string' ? p : (p && p.id) || null;
}
function customerIdOf(obj) {
  const c = obj.customer || (obj.order && obj.order.customer) || (obj.subscription && obj.subscription.customer);
  return typeof c === 'string' ? c : (c && c.id) || null;
}
function toTs(v) {
  if (!v) return null;
  if (typeof v === 'number') return v;
  const t = Date.parse(v);
  return isNaN(t) ? null : Math.floor(t / 1000);
}
function pubSub(s) {
  return { id: s.id, plan: s.plan, status: s.status, period_end: s.period_end };
}

async function hmacHex(secret, data) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
// constant-time-ish compare (length leak is fine — signatures are fixed-width)
function timingSafeEq(a, b) {
  a = String(a); b = String(b);
  if (a.length !== b.length || !a.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status, headers: { 'content-type': 'application/json', ...CORS }
  });
}
