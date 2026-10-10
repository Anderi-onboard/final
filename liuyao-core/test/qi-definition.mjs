/**
 * 有气 CONTRACT (the working definition, ⚠ open)
 *
 * The book uses 有气 often, next to 旺相, and never gives it a number. The working
 * definition here is 旺衰 rank >= 2 (休 or above; 囚 and 死 are 无气, 失陷 in 觉子
 * L7864). This test pins that definition against the 五行 table written out, and
 * checks that the 旬空 rule that uses 有气 (L2546, 有气不动亦为空) reads the same one.
 * Changing the definition should be a deliberate edit: this test is where it shows.
 *
 * Run: node test/qi-definition.mjs
 */
import assert from 'node:assert/strict';
import { loadEngine } from '../src/engine.js';
import { buildPacket } from '../src/packet.js';

const L = loadEngine();
const GEN = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
const CTRL = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };
const EL_OF = { 子: '水', 丑: '土', 寅: '木', 卯: '木', 辰: '土', 巳: '火', 午: '火', 未: '土', 申: '金', 酉: '金', 戌: '土', 亥: '水' };
const rankOf = (el, mon) => (el === mon ? 4 : GEN[mon] === el ? 3 : GEN[el] === mon ? 2 : CTRL[mon] === el ? 1 : 0);
const DATES = Array.from({ length: 12 }, (_, m) => new Date(2026, m, 15, 10, 0));
let lines = 0, qi = 0;
for (const date of DATES) {
  for (let bits = 0; bits < 64; bits++) {
    for (const mv of [[], [0], [3]]) {
      const board = L.computeBoard({ lines: [0, 1, 2, 3, 4, 5].map((i) => ({ yang: !!((bits >> i) & 1), changing: false })), changeIdx: mv, date });
      const p = buildPacket(board, {});
      const monEl = EL_OF[board.meta.monthBranch.cn];
      for (const pk of p.lines) {
        const want = rankOf(EL_OF[pk.branch], monEl) >= 2;
        assert.equal(pk.qi, want, `${pk.pos} ${pk.branch}: qi`);
        if (pk.qi) qi++;
        // the 旬空 rule: 有气不动 is listed exactly when the line is void, static, and 有气
        const has = pk.voidRules.some((r) => r.text === '有气不动，为空');
        assert.equal(has, !!(pk.void && !pk.moving && pk.qi), `${pk.pos}: 有气不动 rule vs definition`);
        lines++;
      }
    }
  }
}
console.log(`qi-definition: ok — ${lines} lines, ${qi} 有气 (definition: 旺衰 rank >= 2; open ⚠)`);
