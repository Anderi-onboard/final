/**
 * 变 kinds CONTRACT (one place for every rule about the change)
 *
 * For each moving line, changeKinds must be exactly the set of change facts the board
 * gives: 回头生 / 回头克 (五行 of the change against the line), 化冲 (the change clashes
 * the line's branch), 化合 (combines with it), 化空 (the change is in 旬空), 化进神 /
 * 化退神 (branch pair), 化绝 (the change's stage on the day is 绝). The five-element
 * cycles, clash and combine pairs, and 旬空 are written out here; 进退 pairs and the
 * 墓/绝 table are trusted to their own contracts.
 *
 * Run: node test/change-kinds.mjs
 */
import assert from 'node:assert/strict';
import { loadEngine } from '../src/engine.js';
import { buildPacket } from '../src/packet.js';

const L = loadEngine();
const GEN = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
const CTRL = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };
const EL_OF = { 子: '水', 丑: '土', 寅: '木', 卯: '木', 辰: '土', 巳: '火', 午: '火', 未: '土', 申: '金', 酉: '金', 戌: '土', 亥: '水' };
const CLASH = [['子', '午'], ['丑', '未'], ['寅', '申'], ['卯', '酉'], ['辰', '戌'], ['巳', '亥']];
const COMBINE = [['子', '丑'], ['寅', '亥'], ['卯', '戌'], ['辰', '酉'], ['巳', '申'], ['午', '未']];
const pairIn = (tbl, a, b) => tbl.some(([x, y]) => (a === x && b === y) || (a === y && b === x));

const DATES = [
  ...Array.from({ length: 12 }, (_, k) => new Date(2026, 9, 1 + k, 10, 0)),
  ...Array.from({ length: 12 }, (_, m) => new Date(2026, m, 15, 10, 0))
];
const patterns = [[0], [2], [4], [1, 3], [0, 3, 5], [0, 1, 2, 3, 4]];
let checked = 0, total = 0;

for (const date of DATES) {
  for (let bits = 0; bits < 64; bits++) {
    for (const mv of patterns) {
      const board = L.computeBoard({ lines: [0, 1, 2, 3, 4, 5].map((i) => ({ yang: !!((bits >> i) & 1), changing: false })), changeIdx: mv, date });
      const p = buildPacket(board, {});
      const xun = new Set(Array.from(board.meta.xunkong || [], (b) => b.cn));
      const dayBr = board.meta.dayPillar.branch.cn;
      const dayEl = EL_OF[dayBr];
      for (const pk of p.lines) {
        total++;
        if (!pk.moving || !pk.transform) { assert.deepEqual(pk.changeKinds, [], `${pk.pos}: static line has change kinds`); continue; }
        const el = EL_OF[pk.branch], tbr = pk.transform.branch, tel = EL_OF[tbr];
        const want = [];
        if (GEN[tel] === el) want.push('化回头生');
        if (CTRL[tel] === el) want.push('化回头克');
        if (pk.transform.jinTui === '进神') want.push('化进神');
        if (pk.transform.jinTui === '退神') want.push('化退神');
        if (xun.has(tbr)) want.push('化空');
        if (pk.changeStage === '绝') want.push('化绝');
        if (pairIn(CLASH, pk.branch, tbr)) want.push('化冲');
        if (pairIn(COMBINE, pk.branch, tbr)) want.push('化合');
        if (pk.changeStage === '墓') want.push('化墓');
        // 化墓 is trusted to the 墓 table (kb-rules); checked for presence in both directions.
        const got = pk.changeKinds.filter((k) => k !== '化墓');
        const wantNoTomb = want.filter((k) => k !== '化墓');
        assert.deepEqual([...got].sort(), [...wantNoTomb].sort(), `${pk.pos} ${pk.branch}→${tbr}: change kinds`);
        assert.equal(pk.changeKinds.includes('化墓'), pk.changeStage === '墓', `${pk.pos}: 化墓`);
        checked++;
      }
    }
  }
}
console.log(`change-kinds: ok — ${checked} moving lines checked of ${total} lines`);
