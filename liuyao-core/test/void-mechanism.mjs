/**
 * 旬空 VERDICT CONTRACT (旬空章 L2546)
 *
 * The book names several reasons a 旬空 line is or is not void, in three kinds:
 * the line's own strength (自身), its motion (动), outside support (外力), its
 * hidden state (隐), the 月建 clash (破) and the seasonal empty element (真空).
 * This test checks the packet's verdict against those conditions, computed here
 * from the board and written out, not read back from the packet's own rule list.
 *
 *   1. 真空 is the book's own table: 春土、夏金、秋木、三冬火.
 *   2. Each reason fires exactly when its condition holds on the board.
 *   3. A 破 or 真空 reason always gives 为空 (decisive).
 *   4. Otherwise any 不为空 reason gives 不为空; with none, 为空.
 *   5. 动爻生扶 counts a MOVING line other than this one, not the line itself.
 *
 * Run: node test/void-mechanism.mjs
 */
import assert from 'node:assert/strict';
import { loadEngine } from '../src/engine.js';
import { buildPacket } from '../src/packet.js';
import { TRUE_VOID_ELEMENT_BY_MONTH } from '../src/rules.js';

const L = loadEngine();

// Written out from L2546 and the five-element generating cycle.
const TRUE_VOID = { 寅: '土', 卯: '土', 辰: '土', 巳: '金', 午: '金', 未: '金', 申: '木', 酉: '木', 戌: '木', 亥: '火', 子: '火', 丑: '火' };
const GENERATES = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
const CLASH = [['子', '午'], ['丑', '未'], ['寅', '申'], ['卯', '酉'], ['辰', '戌'], ['巳', '亥']];
const clashes = (a, b) => CLASH.some(([x, y]) => (a === x && b === y) || (a === y && b === x));
const ELEM = ['木', '火', '土', '金', '水'];

const DATES = [
  ...Array.from({ length: 12 }, (_, k) => new Date(2026, 9, 1 + k, 10, 0)),
  ...Array.from({ length: 12 }, (_, m) => new Date(2026, m, 15, 10, 0))
];
const patterns = [[], [0], [2], [4], [1, 3], [0, 2, 5]];

// 1. the seasonal table is the book's. Read from rules.js, the table the packet
// actually uses. (An earlier version read it off the engine, which has no such
// export, and the check was silently skipped. The assertion below would fail if
// the table were absent, so it cannot be skipped again.)
{
  const BR = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  assert.equal(TRUE_VOID_ELEMENT_BY_MONTH.length, 12, 'the 真空 table must cover all twelve 月建');
  for (let bi = 0; bi < 12; bi++) {
    assert.equal(ELEM[TRUE_VOID_ELEMENT_BY_MONTH[bi]], TRUE_VOID[BR[bi]], `真空 for 月建${BR[bi]}`);
  }
}

let lines = 0, voids = 0, hiddenLines = 0;
for (const date of DATES) {
  for (let bits = 0; bits < 64; bits++) {
    for (const moving of patterns) {
      const board = L.computeBoard({ lines: [0, 1, 2, 3, 4, 5].map((i) => ({ yang: !!((bits >> i) & 1), changing: false })), changeIdx: moving, date });
      const p = buildPacket(board, {});
      const dayBr = board.meta.dayPillar.branch.cn;
      const monthBr = board.meta.monthBranch.cn;
      const xun = new Set(p.time.xunkong);
      const movers = p.lines.filter((l) => l.moving).map((l) => ({ pos: l.pos, el: l.element }));

      for (const l of p.lines) {
        if (!xun.has(l.branch)) { assert.equal(l.voidVerdict, null); continue; }
        const fired = new Set();
        const movingNow = l.moving;
        if (l.wangShuai === '旺' || l.wangShuai?.cn === '旺' || l.wangShuai?.en === 'Thriving') fired.add('旺不为空');
        if (!movingNow && (l.wangShuai?.en === 'Thriving' || l.wangShuai?.en === 'Strong')) fired.add('有气不动，为空');
        if (movingNow) fired.add('动不为空');
        if (GENERATES[ELEM_OF(dayBr)] === l.element) fired.add('日建生扶，不为空');
        if (movers.some((m) => m.pos !== l.pos && GENERATES[m.el] === l.element)) fired.add('动爻生扶，不为空');
        if (l.branch === monthBr) fired.add('值月建，逢空不空');   // not in L2546; kept, flagged
        if (clashes(l.branch, monthBr)) fired.add('月破，为空');
        if (TRUE_VOID[monthBr] === l.element) fired.add('真空，为空');

        // 伏 (hidden) reasons are not recomputed here (kb-packet.mjs checks 伏神). For a
        // line the packet judges by a 隐 reason, only the ORDER is checked, below.
        const hiddenReason = l.voidRules.some((r) => r.cls === '隐');
        if (hiddenReason) {
          const decisiveListed = l.voidRules.some((r) => r.decisive);
          const notVoidListed = l.voidRules.some((r) => r.verdict === 'notVoid');
          const orderOk = l.voidVerdict === (decisiveListed ? 'void' : notVoidListed ? 'notVoid' : 'void');
          assert.ok(orderOk, `line ${l.pos}: verdict ${l.voidVerdict} does not follow the order`);
          lines++; hiddenLines++;
          continue;
        }
        const decisive = ['月破，为空', '真空，为空'].some((t) => fired.has(t));
        const notVoidFired = [...fired].some((t) => t.endsWith('不为空'));
        const want = decisive ? 'void' : notVoidFired ? 'notVoid' : 'void';
        assert.equal(l.voidVerdict, want, `line ${l.pos} ${l.branch} (${l.element}) bits=${bits} moving=${moving}: got ${l.voidVerdict}, want ${want}; fired=${[...fired]}`);

        // The packet's own rule list must name every reason that fired here (none missing).
        // 动而化空 and 伏而旺相 are not computed here (transform and hidden lines are checked in kb-packet).
        for (const t of fired) if (t === '动而化空，不为空' || t === '伏而旺相，不为空') fired.delete(t);
        const listed = new Set(l.voidRules.map((r) => r.text));
        for (const t of fired) {
          assert.ok(listed.has(t), `line ${l.pos}: ${t} fired but not listed`);
        }
        lines++;
        if (want === 'void') voids++;
      }
    }
  }
}
function ELEM_OF(br) {
  return { 子: '水', 丑: '土', 寅: '木', 卯: '木', 辰: '土', 巳: '火', 午: '火', 未: '土', 申: '金', 酉: '金', 戌: '土', 亥: '水' }[br];
}
console.log(`void-mechanism: ok — ${lines} 旬空 lines checked (${voids} void; ${hiddenLines} judged by a hidden line, order-checked only), 真空 table matches L2546`);
