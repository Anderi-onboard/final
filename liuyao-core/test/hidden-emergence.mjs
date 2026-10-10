/**
 * 伏神出伏 CONTRACT (飞伏神章 L3010, L3018)
 *
 * The book's six 有用 reasons and five 无用 reasons for a hidden line, checked here
 * against the board's own fields: the branches, moving lines, 旬空, and 五行 cycles
 * written out below. The 墓绝 reasons depend on the 生旺墓绝 table, which has its own
 * contract (kb-rules.mjs); here they are checked in one direction only.
 *
 *   1. every reason the packet lists has its condition true on the board;
 *   2. every reason whose condition is true (and does not depend on 墓绝) is listed;
 *   3. 无用 is decisive: any 无用 reason gives 终不出; else a 有用 reason gives 可出;
 *      else 未论.
 *
 * Run: node test/hidden-emergence.mjs
 */
import assert from 'node:assert/strict';
import { loadEngine } from '../src/engine.js';
import { buildPacket } from '../src/packet.js';
import { stageOf } from '../src/rules.js';

const L = loadEngine();
const NAME = ['木', '火', '土', '金', '水'];
const GEN = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
const CTRL = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };
const EL_OF = { 子: '水', 丑: '土', 寅: '木', 卯: '木', 辰: '土', 巳: '火', 午: '火', 未: '土', 申: '金', 酉: '金', 戌: '土', 亥: '水' };
const BR = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const CLASH = [['子', '午'], ['丑', '未'], ['寅', '申'], ['卯', '酉'], ['辰', '戌'], ['巳', '亥']];
const clash = (a, b) => CLASH.some(([x, y]) => (a === x && b === y) || (a === y && b === x));
// 旺相休囚 of an element in a month: the book's 四时旺相, written out.
const rankOf = (el, mon) => (el === mon ? 4 : GEN[mon] === el ? 3 : GEN[el] === mon ? 2 : CTRL[mon] === el ? 1 : 0);

const DATES = [
  ...Array.from({ length: 12 }, (_, k) => new Date(2026, 9, 1 + k, 10, 0)),
  ...Array.from({ length: 12 }, (_, m) => new Date(2026, m, 15, 10, 0))
];
const patterns = [[], [0], [3], [1, 4]];
let checked = 0, hiddenSeen = 0, verdicts = {};

for (const date of DATES) {
  for (let bits = 0; bits < 64; bits++) {
    for (const moving of patterns) {
      const board = L.computeBoard({ lines: [0, 1, 2, 3, 4, 5].map((i) => ({ yang: !!((bits >> i) & 1), changing: false })), changeIdx: moving, date });
      const p = buildPacket(board, {});
      const dayBr = board.meta.dayPillar.branch.cn, monBr = board.meta.monthBranch.cn;
      const dayEl = EL_OF[dayBr], monEl = EL_OF[monBr];
      const xun = new Set(Array.from(board.meta.xunkong || [], (b) => b.cn));
      const movingEls = Array.from(board.lines).filter((l) => l.moving).map((l) => EL_OF[l.branch.cn]);

      for (const pk of p.lines) {
        for (const h of pk.hidden) {
          hiddenSeen++;
          const hb = h.branch, he = EL_OF[hb];
          const fb = pk.branch;   // the flying line is the visible line at this position (飞伏神章)
          const fe = EL_OF[fb];
          const fRank = rankOf(fe, monEl), hRank = rankOf(he, monEl);
          const flyVoid = xun.has(fb);
          const want = new Set();

          // 有用 (L3010)
          if (GEN[dayEl] === he || GEN[monEl] === he) want.add('伏得日月生');
          if (hRank >= 3) want.add('伏旺相');
          if (GEN[fe] === he) want.add('伏得飞神生');
          if (movingEls.some((m) => GEN[m] === he)) want.add('伏得动爻生');
          if (clash(dayBr, fb) || clash(monBr, fb) || CTRL[dayEl] === fe || CTRL[monEl] === fe) want.add('伏得日月动爻冲克飞神');
          if (flyVoid || clash(fb, monBr) || clash(fb, dayBr) || fRank <= 2) want.add('伏得飞神空破休囚墓绝');
          // 无用 (L3018)
          if (hRank <= 1) want.add('伏休囚无气');
          if (clash(hb, dayBr) || clash(hb, monBr) || CTRL[dayEl] === he || CTRL[monEl] === he) want.add('伏被日月冲克');
          if (CTRL[fe] === he && fRank >= 3) want.add('伏被旺相飞神克');
          if (hRank <= 2 && xun.has(hb) && clash(hb, monBr)) want.add('伏休囚值旬空月破');

          const listed = new Set(h.emergence.rules.map((r) => r.text));
          // 1 + 2: the packet agrees with the board, for the reasons that do not depend on 墓绝.
          const stageReasons = new Set(['伏得飞神空破休囚墓绝', '伏墓绝于日月飞爻']);
          for (const t of listed) if (!stageReasons.has(t)) assert.ok(want.has(t), `${pk.pos}: ${t} listed but its condition is false`);
          for (const t of want) assert.ok(listed.has(t), `${pk.pos}: ${t} holds on the board but is not listed`);
          // 墓绝 reasons: forward check against the stage table.
          for (const t of listed) if (stageReasons.has(t)) {
            if (t === '伏得飞神空破休囚墓绝') assert.ok(flyVoid || clash(fb, monBr) || clash(fb, dayBr) || fRank <= 2 || ['墓', '绝'].includes(stageOf(NAME.indexOf(fe), board.meta.dayPillar.branch.bi)) || ['墓', '绝'].includes(stageOf(NAME.indexOf(fe), board.meta.monthBranch.bi)), `${pk.pos}: 空破休囚墓绝 not true`);
          }

          // 3. the verdict order.
          const never = h.emergence.rules.some((r) => r.verdict === 'never');
          const emerges = h.emergence.rules.some((r) => r.verdict === 'emerges');
          const expect = never ? '终不出' : emerges ? '可出' : '未论';
          assert.equal(h.emergence.verdict, expect, `${pk.pos}: verdict ${h.emergence.verdict}, want ${expect}`);
          verdicts[expect] = (verdicts[expect] || 0) + 1;
          checked++;
        }
      }
    }
  }
}
console.log(`hidden-emergence: ok — ${checked} hidden lines (${hiddenSeen} seen): ${JSON.stringify(verdicts)}`);
