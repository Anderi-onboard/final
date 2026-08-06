// functions/_lib/db.js — D1 data layer. The server is the source of truth for
// accounts, prepaid units, and history. Legacy plan values remain readable so
// existing accounts migrate without losing balances.

// Free signup now grants 500 units (new-user welcome grant).
// ── ONE unit price, everywhere ─────────────────────────────────────────────
// A unit is worth the same wherever it came from: $19 buys 30,000 of them,
// $29 buys 46,000, a $5 top-up buys 8,000. Tiered "bulk discounts" used to make
// the same unit worth anywhere from $0.000537 to $0.001778 — a 3.3x spread —
// which meant the margin on an identical reading swung between 50% and 85%
// depending on which package the reader happened to buy. One price makes the
// margin uniform (~59%) and, more importantly, makes a unit something a reader
// can actually reason about. Subscribing is still the better deal, but the
// advantage now comes from what a plan includes — Sortis access, full history,
// units that refill every month — not from a cheaper unit.
export const UNIT_PRICE_USD = 1 / 1500;   // exactly 1,500 units per $1

export const PLAN_GRANT = { free: 500, pro: 28500, premium: 43500 };

// Annual plans pay ten months for twelve: the same monthly allowance x12,
// granted at once. That discount is a deliberate margin trade (~51% against
// ~59% monthly), which is what "two months free" costs.
export const ANNUAL_MONTHS = 12;

// One-time top-ups. Same unit price as the plans — the denominations differ,
// the value of a unit does not.
export const PACKS = [
  { units: 7500, usd: 5 },
  { units: 15000, usd: 10 },
  { units: 30000, usd: 20 },
  { units: 75000, usd: 50 }
];

// TYPICAL cost of a reading, from measured usage. Nothing is held or deducted
// against these — a reading is billed for the tokens it actually used, once it
// is written. They exist so the interface can say roughly what a reading runs
// before you ask for it, and they are the only numbers here a reader ever sees.
//
// Re-measured after extended thinking was turned off in api/claude.js (it was
// spending most of the token budget on reasoning the reader never saw, which
// inflated every one of these). Same board, Opus 5, thinking off:
//   sortis initial    725 / 767 / 848 units   (3693 / 4067 / 4889 chars)
//   stria  initial    417 / 428 units         (1202 / 1288 chars)
//   sortis follow-up  600 / 643 units
//   stria  follow-up  480 units
// Rounded to the median, then up rather than down: a reader should not be
// surprised by a charge larger than the figure shown before they asked.
// IF CLAUDE_THINKING IS EVER SET BACK TO "on", these roughly double — re-measure
// before trusting them.
export const METHOD_COST = { stria: 440, sortis: 780 };
export const PAID = { pro: true, premium: true };

// ── Metered billing — strictly proportional, no ceiling ────────────────────
// A reading is billed for the tokens it actually consumed. There is no cap and
// no flat price: a short reading costs less than a long one, always, and the
// charge tracks real cost instead of an assumed average.
//
// WHY THE RATES ARE KEYED BY MODEL, NOT BY PRODUCT
// The model behind a product changes (Stria has already moved from Sonnet 4.6
// to Opus 5, a 1.67x jump in per-token price). Rates attached to "stria" would
// have kept charging the old model's price for the new model's cost — exactly
// the drift that put Stria under 40% margin on some tiers. Billing the model
// that actually ran means a model swap re-prices itself, with no constant to
// remember to update. An unknown model bills at the most expensive known rate,
// so a new model can never accidentally be sold below cost.
//
// HOW THE NUMBERS WERE DERIVED (units per 1,000 tokens)
//   units = model price (USD) / D,  where D = $0.0002566 of model cost per unit
// Reading it the other way: a unit sells for 1/1500 = $0.000667 and costs about
// $0.000268 to honour once the unbilled QC and router calls that ride along with
// a cast are counted, which is the ~60% margin below.
//
//   what a reader pays          $/unit     margin on a Sortis reading
//   any monthly plan or pack    0.000667   59.8%
//   any annual plan             0.000556   51.8%   (two months free)
//
// Only two numbers, because there is only one unit price. Annual is the single
// deliberate exception: twelve months of units for ten months' money, which
// costs exactly the ~8 points of margin between those rows. Both sit inside the
// 50-65% band; annual is the floor, so if the model's price ever rises it is the
// row to re-check first.
//
// To move the whole curve, change D and regenerate — every rate below is just
// the model's OpenRouter price divided by it. Change UNIT_PRICE_USD instead and
// you move what a dollar buys without touching what a reading costs to run.
export const MODEL_RATES = {
  'anthropic/claude-opus-5':     { in: 19.5, out: 97.5 },  // $5 / $25 per M
  'anthropic/claude-opus-4.8':   { in: 19.5, out: 97.5 },  // $5 / $25
  'anthropic/claude-sonnet-4.6': { in: 11.7, out: 58.5 },  // $3 / $15
  'anthropic/claude-sonnet-5':   { in: 7.8,  out: 39.0 },  // $2 / $10
  'anthropic/claude-haiku-4.5':  { in: 3.9,  out: 19.5 }   // $1 / $5
};
const FALLBACK_RATE = MODEL_RATES['anthropic/claude-opus-5'];

// Typical cost of a follow-up. Lower than a fresh reading because the answer is
// shorter, higher than you might expect because the conversation so far is
// re-sent as context and that context is billed like any other input. Stria's
// was the worst of the four: 330 against a measured 480, because a Stria
// follow-up carries the same conversation as a Sortis one while its own answer
// stays short, so input dominates the bill. See METHOD_COST for the samples.
export const FOLLOW_COST = { stria: 490, sortis: 640 };

// Chinese runs about 1.064 tokens per character; Latin script about 0.287
// (both measured against the Claude tokenizer). The old estimate assumed 4
// characters per token for everything, which under-counted a Chinese reading
// more than fourfold — the wrong direction, since this path only runs when a
// stream died and we are billing without the provider's own usage numbers.
const TOK_CJK = 1.064, TOK_LATIN = 0.287;
function estimateTokens(chars, cjk) {
  chars = Number(chars) || 0;
  cjk = Math.min(Number(cjk) || 0, chars);
  return Math.ceil(cjk * TOK_CJK + (chars - cjk) * TOK_LATIN);
}

// tokens → units at the rates of the model that ran. usage is OpenRouter's
// {prompt_tokens, completion_tokens}; the fallback estimate is used only when a
// dropped stream never delivered usage.
export function unitsForUsage(model, usage, fallback) {
  const r = MODEL_RATES[model] || FALLBACK_RATE;
  const f = fallback || {};
  const inTok = (usage && Number(usage.prompt_tokens)) || estimateTokens(f.inChars, f.inCjk);
  const outTok = (usage && Number(usage.completion_tokens)) || estimateTokens(f.outChars, f.outCjk);
  return Math.ceil((inTok / 1000) * r.in + (outTok / 1000) * r.out);
}

// Count CJK characters so the fallback estimate above can tell the two scripts
// apart. Covers the CJK unified ideographs plus the punctuation that fills a
// Chinese reading.
export function countCjk(text) {
  const m = String(text || '').match(/[　-〿㐀-䶿一-鿿豈-﫿＀-￯]/g);
  return m ? m.length : 0;
}

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

// ── Billing (Creem merchant-of-record) ──────────────────────────────────────
// The production DB carries two provider-agnostic tables (see schema.sql):
//   billing_events(event_id PK, provider, type, user_id, created_at)
//   subscriptions(id PK, user_id, provider, customer_id, plan, status,
//                 period_end, created_at, updated_at)
// billing_events is the webhook idempotency ledger: INSERT OR IGNORE, and only
// a FRESH row is allowed to move units — replayed/duplicated deliveries no-op.

export async function recordBillingEvent(db, eventId, provider, type, userId) {
  const r = await db.prepare(
    'INSERT OR IGNORE INTO billing_events (event_id,provider,type,user_id,created_at) VALUES (?,?,?,?,?)'
  ).bind(String(eventId), provider, type || null, userId || null, now()).run();
  return { fresh: !!(r && r.meta && r.meta.changes > 0) };
}

// Release the idempotency claim when fulfilment FAILED after we'd already
// staked it. The claim is taken before the grant so a duplicate delivery can
// never double-pay; the cost is that a mid-fulfilment error would otherwise
// leave the event marked done forever, and the provider's retry — the only
// thing that could still deliver those units — would be waved off as a
// duplicate. Paid customer, no units, no second chance. Dropping the row puts
// the event back in play for exactly that retry.
export async function deleteBillingEvent(db, eventId) {
  await db.prepare('DELETE FROM billing_events WHERE event_id=?').bind(String(eventId)).run();
  return { ok: true };
}

export async function upsertSubscription(db, { id, userId, provider, customerId, plan, status, periodEnd }) {
  const t = now();
  await db.prepare(
    'INSERT INTO subscriptions (id,user_id,provider,customer_id,plan,status,period_end,created_at,updated_at) ' +
    'VALUES (?,?,?,?,?,?,?,?,?) ' +
    'ON CONFLICT(id) DO UPDATE SET status=excluded.status, plan=excluded.plan, ' +
    'customer_id=COALESCE(excluded.customer_id, subscriptions.customer_id), ' +
    'period_end=COALESCE(excluded.period_end, subscriptions.period_end), updated_at=excluded.updated_at'
  ).bind(String(id), userId, provider, customerId || null, plan, status, periodEnd || null, t, t).run();
  return { ok: true };
}

export async function getSubscriptionByUser(db, userId, provider) {
  return db.prepare(
    "SELECT * FROM subscriptions WHERE user_id=? AND provider=? AND status IN ('active','trialing','past_due','canceling') " +
    'ORDER BY updated_at DESC LIMIT 1'
  ).bind(userId, provider).first();
}

export async function getSubscriptionById(db, id) {
  return db.prepare('SELECT * FROM subscriptions WHERE id=?').bind(String(id)).first();
}

// Plan change WITHOUT a unit grant — webhook flows grant units separately
// (per subscription.paid event, deduped), so the demo-era setPlan() grant
// must not double-fire there.
export async function setPlanQuiet(db, userId, plan) {
  if (!PLAN_GRANT.hasOwnProperty(plan)) return { ok: false, error: 'bad plan' };
  await db.prepare('UPDATE users SET plan=?, updated_at=? WHERE id=?').bind(plan, now(), userId).run();
  return { ok: true, plan };
}
