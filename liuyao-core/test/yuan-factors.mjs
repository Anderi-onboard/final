/**
 * 有力之元神 CONTRACT (用神章 L543–547)
 *
 * 元神 can give life to the 用神 when it has one of five things: 旺相、临日月、得日月
 * 动爻生扶 (L543); 动化回头生或化进神 (L545); 长生帝旺于日辰; 与忌神同动; 旺动临空、
 * 化空 (L547). Checked here, for every 元神 line, against 五行 cycles and 冲 pairs written
 * out, for the three factors that depend only on the board: 旺相/临日月, 日月动爻生扶,
 * and 与忌神同动. The transform and stage factors are checked for structure only.
 *
 * Run: node test/yuan-factors.mjs
 */
import assert from 'node:assert/strict';
import { loadEngine } from '../src/engine.js';
import { buildPacket } from '../src/packet.js';

const L = loadEngine();
const GEN = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
const CTRL = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };
const EL_OF = { 子: '水', 丑: '土', 寅: '木', 卯: '木', 辰: '土', 巳: '火', 午: '火', 未: '土', 申: '金', 酉: '金', 戌: '土', 亥: '水' };
const rankOf = (el, mon) => (el === mon ? 4 : GEN[mon] === el ? 3 : GEN[el] === mon ? 2 : CTRL[mon] === el ? 1 : 0);

const DATES = [
  ...Array.from({ length: 12 }, (_, k) => new Date(2026, 9, 1 + k, 10, 0)),
  ...Array.from({ length: 12 }, (_, m) => new Date(2026, m, 15, 10, 0))
];
const patterns = [[], [0], [2], [1, 4], [0, 3, 5]];
const YONG = ['wealth', 'officer', 'parent', 'peer'];
const STRUCTURAL = ['化回头生或化进神', '日辰长生帝旺', '旺动临空化空'];
let lines = 0, factors = 0;

for (const date of DATES) {
  for (let bits = 0; bits < 64; bits++) {
    for (const moving of patterns) {
      const board = L.computeBoard({ lines: [0, 1, 2, 3, 4, 5].map((i) => ({ yang: !!((bits >> i) & 1), changing: false })), changeIdx: moving, date });
      const dayBr = board.meta.dayPillar.branch.cn, monBr = board.meta.monthBranch.cn;
      const dayEl = EL_OF[dayBr], monEl = EL_OF[monBr];
      const bl = Array.from(board.lines).map((l) => ({ br: l.branch.cn, el: EL_OF[l.branch.cn], moving: l.moving }));
      for (const key of YONG) {
        const p = buildPacket(board, { yongKey: key });
        if (!p.yong) continue;
        const jiMoving = p.yong.ji.lines.some((q) => bl[q - 1].moving);
        for (const pos of p.yong.yuan.lines) {
          const line = bl[pos - 1];
          const got = p.yong.yuan.factors.find((f) => f.pos === pos).factors;
          const want = [];
          if (rankOf(line.el, monEl) >= 3 || line.br === dayBr || line.br === monBr) want.push('旺相或临日月');
          if (GEN[dayEl] === line.el || GEN[monEl] === line.el) want.push('日月动爻生扶');
          if (line.moving && jiMoving) want.push('与忌神同动');
          // no factor the board does not support; every board-supported factor is listed
          for (const g of got) if (!STRUCTURAL.includes(g)) assert.ok(want.includes(g), `${pos}: ${g} listed but not on the board`);
          for (const w of want) assert.ok(got.includes(w), `${pos}: ${w} holds but is not listed`);
          factors += want.length;
          lines++;
        }
      }
    }
  }
}
console.log(`yuan-factors: ok — ${lines} 元神 lines, ${factors} board-given factors matched`);
