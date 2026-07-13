// functions/_lib/db.js — D1 data layer. The server is the source of truth for
// accounts, units, and history. Plan grants mirror account.js (front-end mirror).

// Free signup now grants 500 units (new-user welcome grant).
export const PLAN_GRANT = { free: 500, pro: 22500, premium: 45000 };
export const METHOD_COST = { stria: 300, sortis: 1500 };
export const PAID = { pro: true, premium: true };

function uuid() {
  return (crypto.randomUUID && crypto.randomUUID()) ||
    ('u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
}
const now = () => Date.now();

// Upsert by email; first sign-in seeds the free grant. Returns the user row.
export async function ensureUser(db, { email, name, provider }) {
  email = String(email || '').toLowerCase().trim();
  const existing = await db.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
  if (existing) {
    if (name && name !== existing.name) {
      await db.prepare('UPDATE users SET name=?, updated_at=? WHERE id=?')
        .bind(name, now(), existing.id).run();
      existing.name = name;
    }
    return existing;
  }
  const id = uuid(), t = now();
  await db.prepare(
    'INSERT INTO users (id,email,name,provider,plan,units,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)'
  ).bind(id, email, name || 'Seeker', provider || 'email', 'free', PLAN_GRANT.free, t, t).run();
  await db.prepare('INSERT INTO ledger (user_id,delta,reason,balance,created_at) VALUES (?,?,?,?,?)')
    .bind(id, PLAN_GRANT.free, 'grant:free', PLAN_GRANT.free, t).run();
  return db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
}

export async function getUser(db, id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
}

export async function getUserByEmail(db, email) {
  email = String(email || '').toLowerCase().trim();
  if (!email) return null;
  return db.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
}

// Create a brand-new email/password account with the free welcome grant.
// Caller must have already checked the email isn't taken.
export async function createEmailUser(db, { email, name, passwordHash }) {
  email = String(email || '').toLowerCase().trim();
  const id = uuid(), t = now();
  await db.prepare(
    'INSERT INTO users (id,email,name,provider,plan,units,password_hash,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)'
  ).bind(id, email, name || email.split('@')[0], 'email', 'free', PLAN_GRANT.free, passwordHash || null, t, t).run();
  await db.prepare('INSERT INTO ledger (user_id,delta,reason,balance,created_at) VALUES (?,?,?,?,?)')
    .bind(id, PLAN_GRANT.free, 'grant:signup', PLAN_GRANT.free, t).run();
  return db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
}

// Atomic-enough spend: re-read, guard balance, write new balance + ledger row.
export async function spendUnits(db, userId, cost, reason) {
  const u = await getUser(db, userId);
  if (!u) return { ok: false, error: 'no user' };
  if (u.units < cost) return { ok: false, error: 'insufficient', units: u.units };
  const bal = u.units - cost, t = now();
  await db.prepare('UPDATE users SET units=?, updated_at=? WHERE id=?').bind(bal, t, userId).run();
  await db.prepare('INSERT INTO ledger (user_id,delta,reason,balance,created_at) VALUES (?,?,?,?,?)')
    .bind(userId, -cost, reason || 'spend', bal, t).run();
  return { ok: true, units: bal };
}

export async function grantUnits(db, userId, amount, reason) {
  const u = await getUser(db, userId);
  if (!u) return { ok: false, error: 'no user' };
  const bal = u.units + amount, t = now();
  await db.prepare('UPDATE users SET units=?, updated_at=? WHERE id=?').bind(bal, t, userId).run();
  await db.prepare('INSERT INTO ledger (user_id,delta,reason,balance,created_at) VALUES (?,?,?,?,?)')
    .bind(userId, amount, reason || 'grant', bal, t).run();
  return { ok: true, units: bal };
}

// Switch plan and add that plan's monthly grant.
export async function setPlan(db, userId, plan) {
  if (!PLAN_GRANT.hasOwnProperty(plan)) return { ok: false, error: 'bad plan' };
  const u = await getUser(db, userId);
  if (!u) return { ok: false, error: 'no user' };
  const grant = plan === 'free' ? 0 : PLAN_GRANT[plan];
  const bal = u.units + grant, t = now();
  await db.prepare('UPDATE users SET plan=?, units=?, updated_at=? WHERE id=?').bind(plan, bal, t, userId).run();
  if (grant) {
    await db.prepare('INSERT INTO ledger (user_id,delta,reason,balance,created_at) VALUES (?,?,?,?,?)')
      .bind(userId, grant, 'grant:' + plan, bal, t).run();
  }
  return { ok: true, plan, units: bal };
}

// ── Payments (provider-agnostic fulfillment) ─────────────────────────────
// The webhook layer normalizes each provider's payload into these calls, so
// the money→units/plan logic lives in ONE place and reuses grantUnits/setPlan.

// Idempotency guard: record that we've handled a provider event. Returns true
// the FIRST time an event id is seen, false on any retry/duplicate — so a
// re-delivered webhook can never grant twice. Call this before fulfilling.
export async function markEvent(db, provider, eventId, type, userId) {
  if (!eventId) return true; // nothing to dedupe on — let caller proceed
  try {
    await db.prepare('INSERT INTO billing_events (event_id,provider,type,user_id,created_at) VALUES (?,?,?,?,?)')
      .bind(String(eventId), provider || 'unknown', type || null, userId || null, now()).run();
    return true;
  } catch (e) {
    return false; // PRIMARY KEY conflict → already processed
  }
}

// Map a provider customer id back to a user via a known subscription row.
export async function getUserByCustomer(db, provider, customerId) {
  if (!customerId) return null;
  const row = await db.prepare(
    'SELECT user_id FROM subscriptions WHERE provider=? AND customer_id=? ORDER BY updated_at DESC LIMIT 1'
  ).bind(provider, String(customerId)).first();
  return row ? getUser(db, row.user_id) : null;
}

// One-time top-up (a unit pack): grant the units.
export async function fulfillTopup(db, userId, units, reason) {
  const n = Math.max(0, parseInt(units, 10) || 0);
  if (!n) return { ok: false, error: 'zero units' };
  return grantUnits(db, userId, n, reason || 'topup:paid');
}

// Subscription created/renewed: upsert the subscription row, set the plan, and
// grant that plan's monthly units. Idempotency is the caller's job (markEvent),
// so a single renewal event grants exactly one month.
export async function fulfillSubscription(db, s) {
  const { userId, provider, subscriptionId, customerId, plan, status, periodEnd } = s || {};
  if (!userId || !PLAN_GRANT.hasOwnProperty(plan) || plan === 'free') {
    return { ok: false, error: 'bad subscription' };
  }
  const t = now();
  await db.prepare(
    'INSERT INTO subscriptions (id,user_id,provider,customer_id,plan,status,period_end,created_at,updated_at) ' +
    'VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET ' +
    'plan=excluded.plan, status=excluded.status, period_end=excluded.period_end, ' +
    'customer_id=excluded.customer_id, updated_at=excluded.updated_at'
  ).bind(String(subscriptionId || (provider + ':' + userId)), userId, provider || 'unknown',
         customerId ? String(customerId) : null, plan, status || 'active', periodEnd || null, t, t).run();
  // active/trialing → apply the plan + monthly grant; other statuses just record
  if (!status || status === 'active' || status === 'trialing') {
    return setPlan(db, userId, plan);
  }
  return { ok: true, plan, recorded: true };
}

// Subscription canceled / expired / unpaid: mark it and drop the user to free
// (units already granted are kept — they're paid for).
export async function expireSubscription(db, subscriptionId, status) {
  const t = now();
  const row = await db.prepare('SELECT user_id FROM subscriptions WHERE id=?').bind(String(subscriptionId)).first();
  await db.prepare('UPDATE subscriptions SET status=?, updated_at=? WHERE id=?')
    .bind(status || 'canceled', t, String(subscriptionId)).run();
  if (!row) return { ok: false, error: 'no subscription' };
  await db.prepare('UPDATE users SET plan=?, updated_at=? WHERE id=?').bind('free', t, row.user_id).run();
  return { ok: true, userId: row.user_id, plan: 'free' };
}

export async function listCastings(db, userId, limit) {
  const r = await db.prepare(
    'SELECT id,title,method,payload,created_at FROM castings WHERE user_id=? ORDER BY created_at DESC LIMIT ?'
  ).bind(userId, limit || 50).all();
  return (r.results || []).map((row) => ({
    id: row.id, title: row.title, method: row.method,
    created_at: row.created_at,
    payload: safeParse(row.payload)
  }));
}

export async function saveCasting(db, userId, { id, title, method, payload }) {
  const t = now();
  await db.prepare(
    'INSERT INTO castings (id,user_id,title,method,payload,created_at) VALUES (?,?,?,?,?,?) ' +
    'ON CONFLICT(id) DO UPDATE SET title=excluded.title, payload=excluded.payload'
  ).bind(String(id), userId, String(title || 'Untitled'), String(method || 'stria'), JSON.stringify(payload || {}), t).run();
  return { ok: true };
}

export async function deleteCasting(db, userId, id) {
  await db.prepare('DELETE FROM castings WHERE id=? AND user_id=?').bind(String(id), userId).run();
  return { ok: true };
}

// Fixed-window counter for anonymous /api/claude calls (no user to bill).
// key should already encode identity + purpose + window, e.g.
// "ip:1.2.3.4:cast:474512" (hour bucket). Returns { ok:false } once the
// bucket hits max, so the caller can 429 instead of hitting Anthropic.
export async function bumpRateLimit(db, key, max) {
  const row = await db.prepare('SELECT count FROM rate_limits WHERE bucket_key=?').bind(key).first();
  if (row) {
    if (row.count >= max) return { ok: false, count: row.count };
    await db.prepare('UPDATE rate_limits SET count=count+1 WHERE bucket_key=?').bind(key).run();
    return { ok: true, count: row.count + 1 };
  }
  await db.prepare('INSERT INTO rate_limits (bucket_key,count,created_at) VALUES (?,1,?)')
    .bind(key, now()).run();
  return { ok: true, count: 1 };
}

export function publicUser(u) {
  return u && {
    id: u.id, email: u.email, name: u.name, provider: u.provider,
    plan: u.plan, units: u.units, signedIn: true
  };
}

function safeParse(s) { try { return JSON.parse(s); } catch (e) { return {}; } }
