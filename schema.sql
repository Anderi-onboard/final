-- BourneWise — Cloudflare D1 schema (server-side source of truth for
-- accounts, the unit ledger, and casting history).
--
-- Apply locally:   npx wrangler d1 execute bournewise --local --file=./schema.sql
-- Apply remote:    npx wrangler d1 execute bournewise --remote --file=./schema.sql

CREATE TABLE IF NOT EXISTS users (
  id           TEXT PRIMARY KEY,            -- uuid
  email        TEXT UNIQUE NOT NULL,
  name         TEXT NOT NULL,
  provider     TEXT NOT NULL DEFAULT 'email',
  plan         TEXT NOT NULL DEFAULT 'free',
  units        INTEGER NOT NULL DEFAULT 300,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
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
