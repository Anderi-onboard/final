-- BourneWise — Cloudflare D1 schema (server-side source of truth for
-- accounts, the unit ledger, and casting history).
--
-- Apply locally:   npx wrangler d1 execute bournewise --local --file=./schema.sql
-- Apply remote:    npx wrangler d1 execute bournewise --remote --file=./schema.sql

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,             -- uuid
  email         TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL,
  provider      TEXT NOT NULL DEFAULT 'email',-- email | google | apple | reddit | github | discord ...
  plan          TEXT NOT NULL DEFAULT 'free',
  units         INTEGER NOT NULL DEFAULT 1500,-- free signup welcome grant (one Sortis 6)
  password_hash TEXT,                         -- pbkdf2$… for email accounts; NULL for OAuth
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
);

-- append-only audit of every unit movement (grants, spends, top-ups)
CREATE TABLE IF NOT EXISTS ledger (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  delta      INTEGER NOT NULL,              -- negative = spend
  reason     TEXT NOT NULL,                 -- 'cast:stria' | 'cast:sortis' | 'grant:pro' | 'topup' ...
  balance    INTEGER NOT NULL,              -- resulting balance (denormalised for history)
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ledger_user ON ledger(user_id, created_at);

-- saved castings (history), one row per inquiry
CREATE TABLE IF NOT EXISTS castings (
  id         TEXT PRIMARY KEY,             -- client-supplied id (Date-based)
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  method     TEXT NOT NULL,                -- 'stria' | 'sortis'
  payload    TEXT NOT NULL,               -- JSON: { msgs, spec, board, ... }
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_castings_user ON castings(user_id, created_at);

-- fixed-window rate limiter for anonymous / unauthenticated calls to
-- functions/api/claude.js (defense against script abuse of the AI proxy
-- when the caller has no D1 account to deduct units from). One row per
-- "ip + purpose + hour" bucket; see functions/_lib/db.js bumpRateLimit().
CREATE TABLE IF NOT EXISTS rate_limits (
  bucket_key TEXT PRIMARY KEY,
  count      INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

-- ── Payments (provider-agnostic core) ────────────────────────────────────
-- Webhook idempotency: one row per provider event we've already fulfilled, so
-- a retried/duplicated webhook can never double-grant units. Keyed by the
-- provider's own event id.
CREATE TABLE IF NOT EXISTS billing_events (
  event_id   TEXT PRIMARY KEY,             -- provider event id
  provider   TEXT NOT NULL,                -- 'stripe' | 'lemonsqueezy' | 'paddle'
  type       TEXT,                         -- event type (audit)
  user_id    TEXT,                         -- resolved user, if known
  created_at INTEGER NOT NULL
);

-- Active subscriptions, so renewals re-grant and cancellations/expiries can
-- downgrade the plan. One row per provider subscription id; customer_id maps
-- later provider events back to the user.
CREATE TABLE IF NOT EXISTS subscriptions (
  id          TEXT PRIMARY KEY,            -- provider subscription id
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider    TEXT NOT NULL,
  customer_id TEXT,                        -- provider customer id
  plan        TEXT NOT NULL,               -- pro | premium
  status      TEXT NOT NULL,               -- active | canceled | past_due | expired
  period_end  INTEGER,                     -- unix seconds, current period end
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_subs_user ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subs_customer ON subscriptions(provider, customer_id);

-- ── Billing (Creem merchant-of-record; provider-agnostic shapes) ────────────
-- Webhook idempotency: one row per provider event id; only a fresh insert may
-- move units, so replayed deliveries can never double-grant.
CREATE TABLE IF NOT EXISTS billing_events (
  event_id   TEXT PRIMARY KEY,             -- provider event id
  provider   TEXT NOT NULL,                -- 'creem' | ...
  type       TEXT,                         -- event type (audit)
  user_id    TEXT,                         -- resolved user, if known
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id          TEXT PRIMARY KEY,            -- provider subscription id
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider    TEXT NOT NULL,
  customer_id TEXT,                        -- provider customer id
  plan        TEXT NOT NULL,               -- pro | premium
  status      TEXT NOT NULL,               -- active | canceling | canceled | past_due | expired
  period_end  INTEGER,                     -- unix seconds, current period end
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);
