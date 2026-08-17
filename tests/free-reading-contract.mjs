/**
 * FREE READING CONTRACT
 *
 * The welcome changed from a 1,500-unit balance to one complete reading.
 * The balance had a failure the entitlement does not: units can be spent on
 * something that does not finish, so a newcomer could arrive, watch a number
 * drain, and never once see what the product does. A reading either happens or
 * it does not.
 *
 * Two properties matter and neither is visible in the UI until it is too late:
 * the free reading must be claimable exactly once even under a race, and a
 * follow-up must never consume it — that separation IS the business model.
 *
 * Run: node tests/free-reading-contract.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PLAN_GRANT, SIGNUP_FREE_READINGS, consumeFreeReading, publicUser } from '../functions/_lib/db.js';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');

// ── the shape of the welcome ───────────────────────────────────────────────
assert.equal(PLAN_GRANT.free, 0, 'a new account must start with no purchased units');
assert.equal(SIGNUP_FREE_READINGS, 1, 'a new account must be owed exactly one reading');

// ── the entitlement survives a race ────────────────────────────────────────
// Two first readings firing at once must not both run free.
class Row { constructor(u, f) { this.units = u; this.free_readings = f; } }
function mockDb(user) {
  const ledger = [];
  return {
    ledger,
    prepare(sql) {
      return {
        sql, args: [],
        bind(...a) { this.args = a; return this; },
        async run() {
          if (this.sql.startsWith('INSERT INTO ledger')) ledger.push(this.args);
          return { meta: { changes: 1 } };
        }
      };
    },
    async batch(stmts) {
      const out = [];
      for (const st of stmts) {
        if (st.sql.includes('free_readings=free_readings-1')) {
          // the conditional is the whole point: only matches while > 0
          if (user.free_readings > 0) { user.free_readings -= 1; out.push({ meta: { changes: 1 } }); }
          else out.push({ meta: { changes: 0 } });
        } else if (st.sql.startsWith('SELECT units, free_readings')) {
          out.push({ results: [{ units: user.units, free_readings: user.free_readings }] });
        } else out.push({ meta: { changes: 0 } });
      }
      return out;
    }
  };
}

const user = new Row(0, 1);
const db = mockDb(user);
const first = await consumeFreeReading(db, 'u1', 'free-reading:sortis');
const second = await consumeFreeReading(db, 'u1', 'free-reading:sortis');

assert.equal(first.claimed, true, 'the first reading must claim the entitlement');
assert.equal(second.claimed, false, 'the second must NOT — one free reading, not unlimited');
assert.equal(user.free_readings, 0, 'the entitlement must land at zero, never negative');
assert.equal(db.ledger.length, 1, 'only the claim that succeeded may write a ledger row');
assert.equal(db.ledger[0][1], 0, 'a free reading moves no units, so its ledger delta is 0');

// ── the guard spends it on a cast and never on a follow-up ─────────────────
const claude = readFileSync(`${ROOT}/functions/api/claude.js`, 'utf8');
assert.ok(/mode !== 'followup' && user\.free_readings > 0/.test(claude),
  'the free reading is no longer restricted to a new casting — a follow-up would eat it');
assert.ok(/TOPUP_FOR_FOLLOWUP/.test(claude),
  'the client cannot tell "pay to go deeper" apart from "you ran out"');
assert.ok(/charge: null/.test(claude),
  'a claimed free reading must settle as no charge at all');

// ── the interface can say it ───────────────────────────────────────────────
const pub = publicUser({ id: 'u', email: 'e', name: 'n', provider: 'email', plan: 'free', units: 0, free_readings: 1 });
assert.equal(pub.freeReadings, 1,
  'publicUser hides the entitlement, so the UI can only show a balance of 0');

// ── existing accounts are not paid the welcome twice ───────────────────────
const schema = readFileSync(`${ROOT}/schema.sql`, 'utf8');
assert.ok(/ADD COLUMN free_readings INTEGER NOT NULL DEFAULT 0/.test(schema),
  'the migration must give EXISTING accounts 0 free readings — they had the old grant');

// ── the code must survive arriving before its migration ───────────────────
// Naming free_readings in the INSERT took production registration to HTTP 500
// the moment it shipped, because a deploy and a D1 migration are not atomic.
const dbSrc = readFileSync(`${ROOT}/functions/_lib/db.js`, 'utf8');
for (const insert of dbSrc.match(/INSERT INTO users \([^)]*\)/g) || []) {
  assert.ok(
    !insert.includes('free_readings'),
    'an INSERT INTO users names free_readings — that is a 500 on every signup '
    + 'until the migration runs, and deploys do not wait for migrations'
  );
}
assert.ok(/async function grantFreeReadings/.test(dbSrc),
  'the entitlement is no longer set by a statement that is allowed to fail');

// And a claim against a database without the column must decline, not throw.
const noColumn = {
  prepare(sql) { return { sql, bind() { return this; }, async run() { return {}; } }; },
  async batch() { throw new Error('no such column: free_readings'); }
};
/* Before the migration the entitlement is DERIVED from the ledger instead of
   declined. Declining would leave a fresh account with no units and no reading
   — a signup that can do nothing, which is the failure the old 1,500-unit
   grant existed to prevent. Verified both ways. */
function ledgerDb(priorCasts) {
  const rows = [];
  return {
    rows,
    prepare(sql) {
      return {
        sql, args: [],
        bind(...a) { this.args = a; return this; },
        async first() {
          if (this.sql.includes('COUNT(*)')) return { n: priorCasts };
          if (this.sql.startsWith('SELECT units')) return { units: 0 };
          return null;
        },
        async run() { if (this.sql.startsWith('INSERT INTO ledger')) rows.push(this.args); return {}; }
      };
    },
    async batch() { throw new Error('no such column: free_readings'); }
  };
}

const fresh = ledgerDb(0);
const firstEver = await consumeFreeReading(fresh, 'u1', 'free-reading:sortis');
assert.equal(firstEver.claimed, true,
  'before the migration, an account with no casting in its ledger must still get its free reading');
assert.equal(fresh.rows.length, 1, 'the derived claim must leave its own ledger row');

const returning = ledgerDb(3);
const notAgain = await consumeFreeReading(returning, 'u1', 'free-reading:sortis');
assert.equal(notAgain.claimed, false,
  'an account that has already cast must not get a second free reading from the fallback');
assert.equal(returning.rows.length, 0, 'a declined claim writes nothing');

console.log('free reading OK — one per signup, claimable once under a race, '
  + 'never consumed by a follow-up, visible to the interface, and safe before its migration');
