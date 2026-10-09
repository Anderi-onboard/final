/**
 * CANDIDATE 神煞 CONTRACT
 *
 * 桃花、劫煞、月德、文昌 are NOT in 增删卜易's own 星煞章 (which tests only
 * 贵人、禄神、驿马、天喜). Their rules come from the public 八字 tradition, and
 * one from a single line in the book. They are shown to the user for judgment
 * and must not reach the reading as if they were the book's rules. So:
 *
 *   1. THE TABLE IS WRITTEN OUT HERE, NOT IMPORTED. The expected mapping below
 *      is copied from rules.js's source review, so a silent edit to the table
 *      in rules.js fails here rather than passing through.
 *   2. EACH CANDIDATE LANDS ON THE LINES IT SHOULD, checked against the board's
 *      own branch and stem fields, not against the code's lookup.
 *   3. CANDIDATES NEVER BECOME TOKENS. They are not retrieval keys until the
 *      user has judged them; if one leaks into the feature list, a knowledge
 *      entry could cite it as if it were the book's rule.
 *   4. EVERY CANDIDATE SAYS WHERE IT COMES FROM AND THAT IT IS PENDING.
 *
 * Run: node test/shensha-candidates.mjs
 */
import assert from 'node:assert/strict';
import { loadEngine } from '../src/engine.js';
import { boardFeatures } from '../src/features.js';
import { buildPacket } from '../src/packet.js';

const L = loadEngine();

// Expected tables, written out (see note 1).
const EXPECT = {
  桃花: { basis: '日支', kind: 'branch', table: { '申子辰': '酉', '寅午戌': '卯', '亥卯未': '子', '巳酉丑': '午' } },
  劫煞: { basis: '日支', kind: 'branch', table: { '申子辰': '巳', '亥卯未': '申', '寅午戌': '亥', '巳酉丑': '寅' } },
  月德: { basis: '月支', kind: 'stem', table: { '寅午戌': '丙', '申子辰': '壬', '亥卯未': '甲', '巳酉丑': '庚' } },
  文昌: { basis: '日干', kind: 'branch', table: { '丁': '酉' } }
};
const TRIAD = {
  申: '申子辰', 子: '申子辰', 辰: '申子辰', 寅: '寅午戌', 午: '寅午戌', 戌: '寅午戌',
  亥: '亥卯未', 卯: '亥卯未', 未: '亥卯未', 巳: '巳酉丑', 酉: '巳酉丑', 丑: '巳酉丑'
};

const cases = [
  { yang: [1, 1, 1, 1, 1, 1], date: new Date(2026, 9, 8, 10, 0) },
  { yang: [0, 0, 0, 0, 0, 0], date: new Date(2026, 9, 9, 10, 0) },
  { yang: [1, 0, 0, 1, 0, 0], changing: [3], date: new Date(2026, 9, 12, 10, 0) },
  { yang: [0, 1, 1, 0, 1, 0], date: new Date(2026, 5, 3, 14, 0) }
];

let checked = 0;
for (const c of cases) {
  const lines = c.yang.map((b, i) => ({ yang: !!b, changing: !!(c.changing || []).includes(i) }));
  const board = L.computeBoard({ lines, changeIdx: c.changing || [], date: c.date });
  const packet = buildPacket(board, {});
  const dayBranch = board.meta.dayPillar.branch.cn;
  const monthBranch = board.meta.monthBranch.cn;
  const dayStem = board.meta.dayPillar.stem.cn;

  assert.deepEqual(packet.candidates.map((x) => x.key), Object.keys(EXPECT),
    'candidate set must be exactly the four listed, in order');

  for (const cand of packet.candidates) {
    const want = EXPECT[cand.key];
    const basisChar = want.basis === '日支' ? dayBranch : want.basis === '月支' ? monthBranch : dayStem;
    const key = want.basis === '日干' ? basisChar : TRIAD[basisChar];
    const target = want.table[key] ?? null;
    assert.equal(cand.target, target, `${cand.key} for ${want.basis}=${basisChar}`);

    // 2. the lines it lands on, checked against the board's own fields.
    // Array.from: arrays from the vm engine are another realm (see kb-packet.mjs).
    const landed = Array.from(board.lines)
      .filter((l) => (want.kind === 'branch' ? l.branch.cn === target : l.stem.cn === target))
      .map((l) => l.idx + 1);
    if (target) assert.deepEqual(Array.from(cand.lines), landed, `${cand.key} must land on ${landed}`);
    else assert.deepEqual(cand.lines, [], `${cand.key} must land nowhere when the table is silent`);

    // 4. provenance and status are always written.
    assert.equal(cand.status, '待判断');
    assert.ok(cand.source.length > 0);
    checked++;
  }

  // 3. no candidate reaches the retrieval tokens.
  for (const t of boardFeatures(board, {})) {
    for (const key of Object.keys(EXPECT)) assert.ok(!t.includes(key), `${key} leaked into token ${t}`);
  }
}
console.log(`shensha-candidates: ok — ${cases.length} boards, ${checked} candidate checks, none tokenised`);
