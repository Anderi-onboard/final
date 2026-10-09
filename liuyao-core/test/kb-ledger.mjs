/**
 * COVERAGE LEDGER CONTRACT
 *
 * Retrieval says which entries fire. The ledger says where every board fact
 * went. The failure it guards is a fact that is on the board, matches nothing,
 * and simply disappears from the reading without anyone being told. So:
 *
 *   1. CONSERVATION. placed tokens + unplaced tokens === the board's feature
 *      tokens, exactly, no token counted twice and none dropped.
 *   2. EMPTY CORPUS. With no entries, everything is unplaced (the reading must
 *      be told that nothing is cited, not left to infer it).
 *   3. A TOKEN CITED BY TWO ENTRIES is placed under both, and lists both ids.
 *   4. `unless` excludes an entry from the ledger as it does from retrieve, so
 *      the two never disagree about what an entry means.
 *   5. A QUIET CASE: 青龙 is a line token on a real board. A spirit with no
 *      entry must show up as unplaced, not vanish.
 *
 * Run: node test/kb-ledger.mjs
 */
import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEngine } from '../src/engine.js';
import { boardFeatures } from '../src/features.js';
import { ledger, retrieve } from '../src/retrieve.js';

void resolve(dirname(fileURLToPath(import.meta.url)), '..');
const L = loadEngine();
const lines = [1, 1, 1, 1, 1, 1].map((b) => ({ yang: !!b, changing: false }));
const board = L.computeBoard({ lines, changeIdx: [], date: new Date(2026, 9, 8, 10, 0) });
const features = boardFeatures(board, { yongKey: 'wealth' });

// 1 + 2: conservation, and everything unplaced on an empty corpus.
const empty = ledger(features, []);
assert.deepEqual(Object.keys(empty.placed), []);
assert.deepEqual(empty.unplaced, [...features].sort());
assert.equal(empty.total, new Set(features).size);

// 3: two entries sharing a token; the token lists both.
const a = { id: 'a-one', when: ['ben:111111', 'L1:spirit:青龙'] };
const b = { id: 'b-two', when: ['L1:spirit:青龙'] };
const two = ledger(features, [a, b]);
assert.deepEqual(two.placed['L1:spirit:青龙'], ['a-one', 'b-two']);
assert.ok(two.unplaced.every((t) => !(t in two.placed)), 'placed and unplaced must be disjoint');

// 4: an `unless` that fires excludes the entry, exactly as retrieve() does.
const barred = { id: 'c-barred', when: ['L1:spirit:青龙'], unless: ['ben:111111'] };
const l4 = ledger(features, [barred]);
const r4 = retrieve(features, [barred]);
assert.equal(r4.length, 0);
assert.equal(l4.placed['L1:spirit:青龙'], undefined, 'ledger must agree with retrieve on unless');

// 5: conservation over a mixed corpus.
const mixed = ledger(features, [a, b, barred]);
const seen = [...Object.keys(mixed.placed), ...mixed.unplaced].sort();
assert.deepEqual(seen, [...new Set(features)].sort(), 'placed + unplaced must equal the tokens exactly');
assert.equal(seen.length, mixed.total);

console.log(`kb-ledger: ok — ${features.length} tokens conserved; spirit 青龙 unplaced on empty corpus`);
