// functions/api/webhooks/lemonsqueezy.js — POST /api/webhooks/lemonsqueezy
// Lemon Squeezy calls this after a payment. We verify the signature, dedupe by
// event, resolve the user, and fulfill through the provider-agnostic db.js
// helpers. Set the webhook URL in the Lemon Squeezy dashboard to
//   https://bournewise.com/api/webhooks/lemonsqueezy
// with events: order_created, subscription_created, subscription_updated,
// subscription_payment_success, subscription_cancelled, subscription_expired.

import { verifyLsSignature, variantMeaning } from '../../_lib/lemonsqueezy.js';
import {
  markEvent, fulfillTopup, fulfillSubscription, expireSubscription, getUserByEmail
} from '../../_lib/db.js';

export async function onRequestPost({ request, env }) {
  const secret = env.LEMONSQUEEZY_WEBHOOK_SECRET;
  const db = env.DB;
  if (!secret || !db) return new Response('not configured', { status: 503 });

  const raw = await request.text();
  const sig = request.headers.get('X-Signature');
  if (!(await verifyLsSignature(raw, sig, secret))) {
    return new Response('bad signature', { status: 401 });
  }

  let evt;
  try { evt = JSON.parse(raw); } catch (e) { return new Response('bad json', { status: 400 }); }

  const meta = evt.meta || {};
  const eventName = meta.event_name || '';
  const custom = meta.custom_data || {};
  const data = evt.data || {};
  const attr = data.attributes || {};

  // stable event id for idempotency (LS doesn't send one header consistently)
  const eventId = 'ls:' + eventName + ':' + (data.id || '') + ':' + (attr.updated_at || attr.created_at || '');

  // resolve the user: custom user_id from checkout first, else by email
  let userId = custom.user_id ? String(custom.user_id) : null;
  if (!userId && attr.user_email) {
    const u = await getUserByEmail(db, attr.user_email);
    userId = u ? u.id : null;
  }

  // idempotency — a re-delivered event never fulfills twice
  const first = await markEvent(db, 'lemonsqueezy', eventId, eventName, userId);
  if (!first) return new Response('duplicate', { status: 200 });

  try {
    if (eventName === 'order_created') {
      const item = attr.first_order_item || {};
      const meaning = variantMeaning(env, item.variant_id || attr.variant_id);
      if (userId && meaning && meaning.kind === 'topup') {
        await fulfillTopup(db, userId, meaning.units, 'topup:lemonsqueezy');
      }
    } else if (
      eventName === 'subscription_created' ||
      eventName === 'subscription_updated' ||
      eventName === 'subscription_payment_success'
    ) {
      const meaning = variantMeaning(env, attr.variant_id);
      const subId = 'ls_sub:' + (attr.subscription_id || data.id || '');
      const status = attr.status || 'active';
      const periodEnd = attr.renews_at ? Math.floor(new Date(attr.renews_at).getTime() / 1000) : null;
      if (userId && meaning && meaning.kind === 'sub') {
        if (status === 'cancelled' || status === 'expired' || status === 'unpaid') {
          await expireSubscription(db, subId, status);
        } else {
          // grant units ONLY on the payment event (initial + renewals); the
          // create/update events just keep the plan flag current.
          await fulfillSubscription(db, {
            userId, provider: 'lemonsqueezy', subscriptionId: subId,
            customerId: attr.customer_id, plan: meaning.plan, status: 'active',
            periodEnd, grant: eventName === 'subscription_payment_success'
          });
        }
      }
    } else if (eventName === 'subscription_cancelled' || eventName === 'subscription_expired') {
      const subId = 'ls_sub:' + (data.id || '');
      await expireSubscription(db, subId, eventName === 'subscription_expired' ? 'expired' : 'canceled');
    }
    // other events (subscription_paused, etc.) are acknowledged, not acted on.
  } catch (e) {
    // 500 → Lemon Squeezy retries later; markEvent already recorded this id, so
    // the retry is a no-op dedupe. Clear the marker so the retry can re-run.
    try { await db.prepare('DELETE FROM billing_events WHERE event_id=?').bind(eventId).run(); } catch (_) {}
    return new Response('fulfill error', { status: 500 });
  }

  return new Response('ok', { status: 200 });
}
