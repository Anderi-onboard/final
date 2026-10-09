/**
 * RELATION / STATE SPLIT CONTRACT (facts.js)
 *
 * The user's rule: a fact that needs no logical link is a 状态 and is cited as
 * a fact; a fact the reading must argue through is a 关系, and only when it
 * touches the 用神 chain (用神, 元神, 忌神, 仇神). Checked here:
 *
 *   1. EVERY RELATION TOUCHES THE CHAIN. A 关系 whose two lines are both off
 *      the chain is a bug: it would ask the reading to argue a link that does
 *      not bear on the question.
 *   2. NOTHING LOST. Every chain-touching pairwise link on the board is a
 *      relation (the split does not silently drop one).
 *   3. TOKENS HAVE THE DOCUMENTED SHAPE (rel:/state: grammar in facts.js).
 *   4. 有力 IS MARKED PROVISIONAL, and nothing else is. 有力 is the user's
 *      own judgment; until confirmed the flag must stay visible.
 *   5. WITHOUT A 用神 THERE ARE NO RELATIONS, and the packet says so.
 *
 * Run: node test/facts-split.mjs
 */
import assert from 'node:assert/strict';
import { loadEngine } from '../src/engine.js';
import { buildPacket } from '../src/packet.js';
import { classifyFacts } from '../src/facts.js';

const L = loadEngine();
const boards = [
  { yang: [1, 1, 1, 1, 1, 1], date: new Date(2026, 9, 8, 10, 0) },
  { yang: [0, 0, 0, 0, 0, 0], date: new Date(2026, 9, 9, 10, 0) },
  { yang: [1, 0, 0, 1, 0, 0], changing: [3], date: new Date(2026, 9, 12, 10, 0) },
  { yang: [0, 1, 1, 0, 1, 0], date: new Date(2026, 5, 3, 14, 0) }
];
const KEYS = ['wealth', 'officer', 'self', 'parent'];

let rels = 0, states = 0;
for (const b of boards) {
  const lines = b.yang.map((v, i) => ({ yang: !!v, changing: !!(b.changing || []).includes(i) }));
  const board = L.computeBoard({ lines, changeIdx: b.changing || [], date: b.date });
  for (const key of KEYS) {
    const packet = buildPacket(board, { yongKey: key });
    const f = classifyFacts(packet);
    const chain = new Set(Array.from(f.chain ?? []));

    // 1. every relation touches the chain.
    for (const r of f.relations) {
      assert.ok(chain.has(r.a) || chain.has(r.b), `${key}: relation ${r.token} touches no chain line`);
      rels++;
    }

    // 2. nothing lost: each chain-touching clash/combine pair on the board is a relation.
    const want = packet.relations.chong.filter((c) => chain.has(c.a) || chain.has(c.b)).length;
    const got = f.relations.filter((r) => r.kind === '冲').length;
    assert.equal(got, want, `${key}: 冲 relations ${got} vs ${want} on the board`);
    const wantHe = packet.relations.he.filter((h) => chain.has(h.a) || chain.has(h.b)).length;
    assert.equal(f.relations.filter((r) => r.kind === '合').length, wantHe, `${key}: 合 relations dropped`);

    // 3. token shape.
    for (const r of f.relations) {
      assert.match(r.token, /^rel:(生|克):L\d>L\d$|^rel:(冲|合):L\d-L\d$|^rel:刑:(L\d>L\d|L\d-L\d)$/, r.token);
    }
    for (const s of f.states) {
      assert.match(s.token, /^state:L[1-6]:\S+$/, s.token);
      assert.equal(s.token, `state:L${s.pos}:${s.name}`);
      states++;
    }

    // 4. only 有力 is provisional.
    for (const s of f.states) {
      assert.equal(s.provisional, s.name === '有力', `${key}: ${s.token} provisional flag`);
    }

    // 5. no 用神 → no relations, and the flag says so.
    if (!packet.yong) {
      assert.equal(f.relations.length, 0);
      assert.equal(f.noYong, true);
    }
  }
  // no 用神 at all:
  const bare = buildPacket(board, {});
  const bf = classifyFacts(bare);
  assert.equal(bf.relations.length, 0, 'no 用神 must mean no relations');
  assert.equal(bf.noYong, true);
}
console.log(`facts-split: ok — ${rels} relations all chain-touching, ${states} states, 有力 alone provisional`);
