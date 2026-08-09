import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spendUnits, grantUnits, revokeUnits, unitsForUsage } from '../functions/_lib/db.js';

class Statement {
  constructor(db, sql) { this.db = db; this.sql = sql; this.args = []; }
  bind(...args) { this.args = args; return this; }
}

class MockD1 {
  constructor(units) {
    this.users = new Map([['u1', { id: 'u1', units }]]);
    this.ledger = [];
  }
  prepare(sql) { return new Statement(this, sql); }
  async batch(statements) {
    const usersBefore = new Map([...this.users].map(([k, v]) => [k, { ...v }]));
    const ledgerBefore = this.ledger.slice();
    const out = [];
    let priorChanges = 0;
    try {
      for (const st of statements) {
        let changes = 0, results = [];
        if (st.sql.startsWith('UPDATE users SET units=units-')) {
          const [cost, , id, minimum] = st.args;
          const user = this.users.get(id);
          if (user && user.units >= minimum) { user.units -= cost; changes = 1; }
        } else if (st.sql.startsWith('UPDATE users SET units=units+')) {
          const [amount, , id] = st.args;
          const user = this.users.get(id);
          if (user) { user.units += amount; changes = 1; }
        } else if (st.sql.startsWith('UPDATE users SET units=MAX')) {
          const [amount, , id] = st.args;
          const user = this.users.get(id);
          if (user && user.units > 0) { user.units = Math.max(0, user.units - amount); changes = 1; }
        } else if (st.sql.startsWith('INSERT INTO ledger') && st.sql.includes('-MIN')) {
          const [amount, reason, , createdAt, id] = st.args;
          const user = this.users.get(id);
          if (user && user.units > 0) {
            const delta = -Math.min(amount, user.units);
            this.ledger.push({ user_id: id, delta, reason, balance: Math.max(0, user.units - amount), created_at: createdAt });
            changes = 1;
          }
        } else if (st.sql.startsWith('INSERT INTO ledger')) {
          const [delta, reason, createdAt, id] = st.args;
          const user = this.users.get(id);
          if (user && priorChanges === 1) {
            this.ledger.push({ user_id: id, delta, reason, balance: user.units, created_at: createdAt });
            changes = 1;
          }
        } else if (st.sql.startsWith('SELECT units FROM users')) {
          const user = this.users.get(st.args[0]);
          results = user ? [{ units: user.units }] : [];
        } else throw new Error('Unsupported statement: ' + st.sql);
        out.push({ success: true, meta: { changes }, results });
        priorChanges = changes;
      }
      return out;
    } catch (error) {
      this.users = usersBefore;
      this.ledger = ledgerBefore;
      throw error;
    }
  }
}

const db = new MockD1(100);
const concurrent = await Promise.all([
  spendUnits(db, 'u1', 80, 'cast:stria:reserve'),
  spendUnits(db, 'u1', 80, 'cast:stria:reserve')
]);
assert.equal(concurrent.filter(x => x.ok).length, 1, 'only one concurrent reservation may spend');
assert.equal(db.users.get('u1').units, 20);
assert.equal(db.ledger.length, 1);
assert.equal(db.ledger[0].balance, 20);

await Promise.all([
  grantUnits(db, 'u1', 30, 'release:a'),
  grantUnits(db, 'u1', 50, 'topup:b')
]);
assert.equal(db.users.get('u1').units, 100);
assert.equal(db.ledger.at(-1).balance, 100);
const reversed = await revokeUnits(db, 'u1', 140, 'refund:creem:test');
assert.equal(reversed.ok, true);
assert.equal(reversed.units, 0, 'refund reversal may not create a negative balance');
assert.equal(db.ledger.at(-1).delta, -100);
assert.equal(db.ledger.at(-1).balance, 0);
assert.equal(unitsForUsage('anthropic/claude-opus-5', { prompt_tokens: 1000, completion_tokens: 1000 }), 117);

const checkout = readFileSync(new URL('../functions/api/checkout.js', import.meta.url), 'utf8');
assert.match(checkout, /pack\(\?:7500\|15000\|30000\|75000\)/);
assert.doesNotMatch(checkout, /pack4500|PACK4500/);

const accountApi = readFileSync(new URL('../functions/api/account/[[path]].js', import.meta.url), 'utf8');
assert.doesNotMatch(accountApi, /route === '(?:grant|plan|spend)'/);

const billingApi = readFileSync(new URL('../functions/api/billing/[[path]].js', import.meta.url), 'utf8');
assert.match(billingApi, /mode: 'scheduled', onExecute: 'cancel'/);
assert.match(billingApi, /type === 'refund\.created' \|\| type === 'dispute\.created'/);
assert.match(billingApi, /obj\.checkout && obj\.checkout\.metadata/);

console.log('billing contract: PASS');
