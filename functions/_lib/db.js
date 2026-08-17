// functions/_lib/db.js — D1 data layer. The server is the source of truth for
// accounts, prepaid units, and history. Legacy plan values remain readable so
// existing accounts migrate without losing balances.

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

// The free grant has to clear a real reading with room to spare, or the signup
// funnel is broken on arrival. At 500 it did not: a Sortis reading measures
// around 780 units, so a new account could not cast the flagship method even
// once, and Stria at ~440 left nothing for the follow-up that makes a reading
// useful. 1,500 buys a Sortis reading and a follow-up, or three Stria readings
// — enough to see what the product actually does before deciding to pay.
// A new account starts with NO units and one whole reading instead. The old
// 1,500-unit welcome had a failure the entitlement does not: units can be spent
// on something that does not finish, so a newcomer could arrive, watch a
// balance drain, and never once see what the product actually does. A reading
// either happens or it does not, and this one happens whatever it costs —
// settlement skips it rather than billing it.
//
// Follow-ups are NOT covered. That is deliberate and it is the business model:
// the first answer is complete and free, and paying begins when the reader
// wants to go deeper into their own casting.
export const PLAN_GRANT = { free: 0, pro: 28500, premium: 43500 };
export const SIGNUP_FREE_READINGS = 1;

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

// TYPICAL cost of a reading, from measured usage. ESTIMATE ONLY — nothing is
// held, capped or gated on these numbers; they exist so the interface can set
// an expectation before the request begins. The bill is whatever the tokens
// come to.
//
// Re-measured after extended thinking was turned off in api/claude.js (it was
// spending most of the token budget on reasoning the reader never saw, which
// inflated every one of these). Same board, Opus 5, thinking off:
//   sortis initial    725 / 767 / 848 units   (3693 / 4067 / 4889 chars)
//   stria  initial    417 / 428 units         (1202 / 1288 chars)
//   sortis follow-up  600 / 643 units
//   stria  follow-up  480 units
// Rounded to the median, then up rather than down: an estimate that runs a
// little high is a better neighbour than one that runs low.
// IF CLAUDE_THINKING IS EVER SET BACK TO "on", these roughly double — re-measure
// before trusting them.
// OFFLINE FALLBACK ONLY. /api/rates derives the real figures from the
// assembled prompt at request time; these exist for callers that cannot reach
// the engine. They are a snapshot and they WILL drift — the previous pair sat
// 49% below the real charge for months because the prompt grew and nobody
// re-measured. Never quote these to a user; quote /api/rates.
export const METHOD_COST = { stria: 785, sortis: 998 };
export const PAID = { pro: true, premium: true };

// ── Metered billing, no ceiling ────────────────────────────────────────────
// A reading is billed for the tokens it actually consumed. Full stop. A short
// answer costs little, a long one costs more, and the charge tracks the work
// in both directions — 359 units used is 359 units charged.
//
// There is deliberately no reservation and no cap. Both were tried and both
// were wrong in the same way: a ceiling has to be set above typical usage to
// avoid clipping the bill, and admission then has to demand that whole ceiling
// up front, so readers who could comfortably afford a reading were refused one.
// Charging proportionally needs neither number.
//
// A reading already in flight is never interrupted for money. Admission asks
// only that the balance is positive; settlement then charges the full measured
// amount even when that takes the balance below zero. The reader gets the
// reading they started, and the next request is the one that gets refused —
// see chargeUnits() for why the settlement debit has no balance guard.
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
export const FOLLOW_COST = { stria: 731, sortis: 797 };  // offline fallback — see METHOD_COST

// Chinese runs about 1.064 tokens per character; Latin script about 0.287
// (both measured against the Claude tokenizer). The old estimate assumed 4
// characters per token for everything, which under-counted a Chinese reading
// more than fourfold — the wrong direction, since this path only runs when a
// stream died and we are billing without the provider's own usage numbers.
const TOK_CJK = 1.064, TOK_LATIN = 0.287;
// Exported so /api/rates can size the prompt with the SAME function that
// bills it. The rate card used to carry its own hardcoded token counts and
// drifted 49% behind the real prompt; anything that quotes a cost now derives
// it from here.
export function estimateTokens(chars, cjk) {
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
  await grantFreeReadings(db, id, SIGNUP_FREE_READINGS);
  // The welcome is a reading, not a balance, so that is what the ledger records.
  // delta 0 keeps the running balance honest — nothing was added to spend.
  await db.prepare('INSERT INTO ledger (user_id,delta,reason,balance,created_at) VALUES (?,?,?,?,?)')
    .bind(id, 0, 'grant:free-reading', PLAN_GRANT.free, t).run();
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
  await grantFreeReadings(db, id, SIGNUP_FREE_READINGS);
  await db.prepare('INSERT INTO ledger (user_id,delta,reason,balance,created_at) VALUES (?,?,?,?,?)')
    .bind(id, 0, 'grant:free-reading', PLAN_GRANT.free, t).run();
  return db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
}

/* Pre-migration fallback for the signup entitlement: an account with no
   casting in its ledger has not had its free reading yet. Derived rather than
   stored, so it works on a database that has never been migrated. */
async function consumeFirstReadingFromLedger(db, userId, reason) {
  const t = now();
  try {
    const prior = await db.prepare(
      "SELECT COUNT(*) AS n FROM ledger WHERE user_id=? AND (reason LIKE 'cast:%' OR reason LIKE 'follow:%' OR reason LIKE 'free-reading%')"
    ).bind(userId).first();
    if (prior && Number(prior.n) > 0) return { claimed: false, units: null, freeReadings: 0 };
    const u = await db.prepare('SELECT units FROM users WHERE id=?').bind(userId).first();
    await db.prepare('INSERT INTO ledger (user_id,delta,reason,balance,created_at) VALUES (?,?,?,?,?)')
      .bind(userId, 0, reason || 'free-reading', u ? u.units : 0, t).run();
    return { claimed: true, units: u ? u.units : 0, freeReadings: 0 };
  } catch (e2) {
    return { claimed: false, units: null, freeReadings: 0 };
  }
}

/* Set the signup entitlement in a SEPARATE statement that is allowed to fail.

   A deploy and a D1 migration are not atomic, and this is what that costs when
   you forget it: naming free_readings in the INSERT took production
   registration to HTTP 500 the moment the code shipped, because the column did
   not exist yet. Nobody could create an account.

   So the column is never required by a write that must succeed. Before the
   migration this throws and is swallowed — the account is created with no free
   reading, which is recoverable — and after it, it does its job. Code has to
   survive arriving before its migration, because sometimes it will. */
async function grantFreeReadings(db, userId, count) {
  try {
    await db.prepare('UPDATE users SET free_readings=? WHERE id=?').bind(count, userId).run();
  } catch (e) {
    console.error('free_readings column missing — run the migration in schema.sql', e && e.message);
  }
}

/* Spend one free reading, if the account still has one. Conditional on the
   count so two simultaneous first readings cannot both claim it — the UPDATE
   only matches while free_readings > 0, and `changes` tells us whether this
   request is the one that got it. */
export async function consumeFreeReading(db, userId, reason) {
  const t = now();
  let out;
  try {
    out = await db.batch([
      db.prepare('UPDATE users SET free_readings=free_readings-1, updated_at=? WHERE id=? AND free_readings>0')
        .bind(t, userId),
      db.prepare('SELECT units, free_readings FROM users WHERE id=?').bind(userId)
    ]);
  } catch (e) {
    /* Column not migrated yet. Declining here would leave a new account with
       no units AND no reading — a signup that can do nothing, which is the
       exact failure the 1,500-unit grant was raised to fix.

       So fall back to a fact that needs no migration: has this account ever
       been charged for a casting? The ledger is append-only and already
       records every one. No prior cast means this is the first, and the first
       is free. It is one query on a small per-user table, it only runs before
       the migration, and it cannot double-grant, because the settlement that
       follows a paid reading writes the row that closes it off. */
    return consumeFirstReadingFromLedger(db, userId, reason);
  }
  const claimed = !!(out[0] && out[0].meta && out[0].meta.changes);
  const row = (out[1] && out[1].results && out[1].results[0]) || null;
  if (claimed) {
    await db.prepare('INSERT INTO ledger (user_id,delta,reason,balance,created_at) VALUES (?,?,?,?,?)')
      .bind(userId, 0, reason || 'free-reading', row ? row.units : 0, t).run();
  }
  return { claimed, units: row ? row.units : null, freeReadings: row ? row.free_readings : 0 };
}

// Conditional arithmetic update + ledger insert in one D1 transaction. This
// prevents two simultaneous readings from both passing a stale balance check.
export async function spendUnits(db, userId, cost, reason) {
  cost = Math.max(0, Math.floor(Number(cost) || 0));
  if (!cost) {
    const u = await getUser(db, userId);
    return u ? { ok: true, units: u.units } : { ok: false, error: 'no user' };
  }
  const t = now();
  const out = await db.batch([
    db.prepare('UPDATE users SET units=units-?, updated_at=? WHERE id=? AND units>=?')
      .bind(cost, t, userId, cost),
    db.prepare('INSERT INTO ledger (user_id,delta,reason,balance,created_at) SELECT id,?,?,units,? FROM users WHERE id=? AND changes()=1')
      .bind(-cost, reason || 'spend', t, userId),
    db.prepare('SELECT units FROM users WHERE id=?').bind(userId)
  ]);
  const changed = Number(out[0] && out[0].meta && out[0].meta.changes) > 0;
  const row = out[2] && out[2].results && out[2].results[0];
  if (!row) return { ok: false, error: 'no user' };
  return changed ? { ok: true, units: row.units } : { ok: false, error: 'insufficient', units: row.units };
}

// Settlement debit — the counterpart to spendUnits, and deliberately WITHOUT
// its `units>=?` guard. By the time this runs the model has already written
// the reading and the tokens are already spent upstream; refusing the debit
// would not un-spend them, it would just hand out the reading for free. So the
// charge always lands, even when it takes the balance below zero.
//
// That negative balance is the mechanism behind "finish the reading they
// started": a reader who runs out mid-reading still gets it in full, and the
// shortfall sits on the account until they top up. guardRequest() refuses the
// NEXT request, which is the right place to stop — before work is done, not
// after. The ledger row records the true delta either way, so a balance can
// always be reconstructed by replaying it.
export async function chargeUnits(db, userId, amount, reason) {
  amount = Math.max(0, Math.floor(Number(amount) || 0));
  if (!amount) {
    const u = await getUser(db, userId);
    return u ? { ok: true, units: u.units } : { ok: false, error: 'no user' };
  }
  const t = now();
  const out = await db.batch([
    db.prepare('UPDATE users SET units=units-?, updated_at=? WHERE id=?').bind(amount, t, userId),
    db.prepare('INSERT INTO ledger (user_id,delta,reason,balance,created_at) SELECT id,?,?,units,? FROM users WHERE id=?')
      .bind(-amount, reason || 'charge', t, userId),
    db.prepare('SELECT units FROM users WHERE id=?').bind(userId)
  ]);
  const row = out[2] && out[2].results && out[2].results[0];
  if (!row) return { ok: false, error: 'no user' };
  return { ok: true, units: row.units };
}

export async function grantUnits(db, userId, amount, reason) {
  amount = Math.max(0, Math.floor(Number(amount) || 0));
  if (!amount) {
    const u = await getUser(db, userId);
    return u ? { ok: true, units: u.units } : { ok: false, error: 'no user' };
  }
  const t = now();
  const out = await db.batch([
    db.prepare('UPDATE users SET units=units+?, updated_at=? WHERE id=?').bind(amount, t, userId),
    db.prepare('INSERT INTO ledger (user_id,delta,reason,balance,created_at) SELECT id,?,?,units,? FROM users WHERE id=? AND changes()=1')
      .bind(amount, reason || 'grant', t, userId),
    db.prepare('SELECT units FROM users WHERE id=?').bind(userId)
  ]);
  const row = out[2] && out[2].results && out[2].results[0];
  return row ? { ok: true, units: row.units } : { ok: false, error: 'no user' };
}

// Remove as much of a reversed purchase grant as is still present, without
// ever pushing an account below zero. The ledger row is written with the exact
// amount removed and the post-reversal balance. This is used only for signed
// provider refund/dispute webhooks, never from a browser route.
export async function revokeUnits(db, userId, amount, reason) {
  amount = Math.max(0, Math.floor(Number(amount) || 0));
  if (!amount) {
    const u = await getUser(db, userId);
    return u ? { ok: true, units: u.units } : { ok: false, error: 'no user' };
  }
  const t = now();
  const out = await db.batch([
    db.prepare('INSERT INTO ledger (user_id,delta,reason,balance,created_at) SELECT id,-MIN(?,units),?,MAX(0,units-?),? FROM users WHERE id=? AND units>0')
      .bind(amount, reason || 'revoke', amount, t, userId),
    db.prepare('UPDATE users SET units=MAX(0,units-?), updated_at=? WHERE id=? AND units>0')
      .bind(amount, t, userId),
    db.prepare('SELECT units FROM users WHERE id=?').bind(userId)
  ]);
  const row = out[2] && out[2].results && out[2].results[0];
  if (!row) return { ok: false, error: 'no user' };
  return { ok: true, units: row.units };
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
    'ON CONFLICT(id) DO UPDATE SET title=excluded.title, method=excluded.method, payload=excluded.payload ' +
    'WHERE castings.user_id=excluded.user_id'
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
    plan: u.plan, units: u.units,
    // The interface has to be able to say "your first reading is on us" rather
    // than showing a balance of 0, which reads as "you cannot do anything".
    freeReadings: u.free_readings || 0,
    signedIn: true
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
