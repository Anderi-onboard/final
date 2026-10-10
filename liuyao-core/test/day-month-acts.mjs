/**
 * 日月如天 CONTRACT (用神章 L878)
 *
 * 惟日月能生之、克之、冲之、合之，日月如天，能生克动爻、静爻、飞爻、伏爻、变爻，
 * 而诸爻皆不能伤日月。 Each kind of line must carry the day's and the month's relation:
 *   1. 生 / 克 by the day and by the month, for the line, its hidden (伏) line and its
 *      changed (变) line, written out from the five-element cycles here;
 *   2. 爻伤日 / 爻伤月: the line controls the day or the month (no effect, 徒受其名);
 *   3. the engine's own day/month generates & controls flags agree with the packet.
 *
 * Run: node test/day-month-acts.mjs
 */
import assert from 'node:assert/strict';
import { loadEngine } from '../src/engine.js';
import { buildPacket } from '../src/packet.js';

const L = loadEngine();
const GEN = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
const CTRL = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };
const EL_OF = { 子: '水', 丑: '土', 寅: '木', 卯: '木', 辰: '土', 巳: '火', 午: '火', 未: '土', 申: '金', 酉: '金', 戌: '土', 亥: '水' };
// The packet's toDay/toMonth = how the day (or month) stands to the line, in 六亲 terms
// seen FROM the line (relOf(line, day)): parent = the day generates the line;
// officer = the day controls the line; wealth = the line controls the day;
// output = the line generates the day.
// Hidden lines carry their element as an index (木火土金水 = 0..4), the others as a name.
const NAME = ['木', '火', '土', '金', '水'];
const relFrom = (lineEl, dayEl) => (lineEl === dayEl ? 'peer' : GEN[dayEl] === lineEl ? 'parent'
  : GEN[lineEl] === dayEl ? 'output' : CTRL[lineEl] === dayEl ? 'wealth' : CTRL[dayEl] === lineEl ? 'officer' : null);

const DATES = [
  ...Array.from({ length: 12 }, (_, k) => new Date(2026, 9, 1 + k, 10, 0)),
  ...Array.from({ length: 12 }, (_, m) => new Date(2026, m, 15, 10, 0))
];
const patterns = [[], [0], [3], [1, 4]];
let lines = 0, hidden = 0, changed = 0, harmed = 0;

for (const date of DATES) {
  for (let bits = 0; bits < 64; bits++) {
    for (const moving of patterns) {
      const board = L.computeBoard({ lines: [0, 1, 2, 3, 4, 5].map((i) => ({ yang: !!((bits >> i) & 1), changing: false })), changeIdx: moving, date });
      const p = buildPacket(board, {});
      const dayEl = EL_OF[board.meta.dayPillar.branch.cn];
      const monEl = EL_OF[board.meta.monthBranch.cn];
      for (const l of Array.from(board.lines)) {
        const pk = p.lines[l.idx];
        const el = EL_OF[l.branch.cn];
        // 1. the line itself, against the cycles.
        assert.equal(pk.toDay, relFrom(el, dayEl), `line ${pk.pos}: toDay`);
        assert.equal(pk.toMonth, relFrom(el, monEl), `line ${pk.pos}: toMonth`);
        // 2. 爻伤日 = the line controls the day.
        assert.equal(pk.dayHarmed, CTRL[el] === dayEl, `line ${pk.pos}: 爻伤日`);
        assert.equal(pk.monthHarmed, CTRL[el] === monEl, `line ${pk.pos}: 爻伤月`);
        if (pk.dayHarmed) harmed++;
        // 3. the engine's own flags agree (generates/controls the day, the month).
        assert.equal(!!l.dayGenerates, GEN[dayEl] === el, `line ${pk.pos}: engine dayGenerates`);
        assert.equal(!!l.dayControls, CTRL[dayEl] === el, `line ${pk.pos}: engine dayControls`);
        assert.equal(!!l.monthGenerates, GEN[monEl] === el, `line ${pk.pos}: engine monthGenerates`);
        assert.equal(!!l.monthControls, CTRL[monEl] === el, `line ${pk.pos}: engine monthControls`);
        // 4. the hidden (伏) line: the day and the month act on it too.
        for (const h of pk.hidden) {
          const hel = NAME[h.el];   // hidden lines store the element index
          assert.equal(h.toDay, relFrom(hel, dayEl), `line ${pk.pos} hidden: toDay`);
          assert.equal(h.toMonth, relFrom(hel, monEl), `line ${pk.pos} hidden: toMonth`);
          hidden++;
        }
        // 5. the changed (变) line, for a moving line.
        if (pk.moving && pk.changeToDay !== null) {
          const tel = EL_OF[pk.transform.branch];
          assert.equal(pk.changeToDay, relFrom(tel, dayEl), `line ${pk.pos} change: toDay`);
          assert.equal(pk.changeToMonth, relFrom(tel, monEl), `line ${pk.pos} change: toMonth`);
          changed++;
        }
        lines++;
      }
    }
  }
}
console.log(`day-month-acts: ok — ${lines} lines, ${hidden} hidden lines, ${changed} changed lines; 爻伤日 on ${harmed}`);
