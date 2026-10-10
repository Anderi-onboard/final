/**
 * 无用之元神 CONTRACT (用神章 L585–589)
 *
 * A 元神 that shows but cannot give life to the 用神 (见生不生). Checked against 五行
 * and 冲 written out here, for the two reasons the board alone decides: 休囚 with a
 * controlling moving line or day/month (or not moving), and 休囚 with 旬空 or 月破.
 * The 变 and 墓 reasons are listed as structural. OPEN ⚠ (recorded in yuan.useless):
 * "被伤克" is taken as controlled by a moving line or the day or month.
 *
 * Run: node test/yuan-useless.mjs
 */
import assert from 'node:assert/strict';
import { loadEngine } from '../src/engine.js';
import { buildPacket } from '../src/packet.js';

const L = loadEngine();
const GEN = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
const CTRL = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };
const EL_OF = { 子: '水', 丑: '土', 寅: '木', 卯: '木', 辰: '土', 巳: '火', 午: '火', 未: '土', 申: '金', 酉: '金', 戌: '土', 亥: '水' };
const CLASH = [['子', '午'], ['丑', '未'], ['寅', '申'], ['卯', '酉'], ['辰', '戌'], ['巳', '亥']];
const clash = (a, b) => CLASH.some(([x, y]) => (a === x && b === y) || (a === y && b === x));
const rankOf = (el, mon) => (el === mon ? 4 : GEN[mon] === el ? 3 : GEN[el] === mon ? 2 : CTRL[mon] === el ? 1 : 0);
const STRUCTURAL = ['元神休囚动化退神', '元神衰而又绝', '元神入三墓', '元神休囚动而化绝、化克、化破、化散'];

const DATES = [
  ...Array.from({ length: 12 }, (_, k) => new Date(2026, 9, 1 + k, 10, 0)),
  ...Array.from({ length: 12 }, (_, m) => new Date(2026, m, 15, 10, 0))
];
const patterns = [[], [0], [2], [1, 4], [0, 3, 5]];
let checked = 0, verdicts = {};

for (const date of DATES) {
  for (let bits = 0; bits < 64; bits++) {
    for (const moving of patterns) {
      const board = L.computeBoard({ lines: [0, 1, 2, 3, 4, 5].map((i) => ({ yang: !!((bits >> i) & 1), changing: false })), changeIdx: moving, date });
      const dayBr = board.meta.dayPillar.branch.cn, monBr = board.meta.monthBranch.cn;
      const dayEl = EL_OF[dayBr], monEl = EL_OF[monBr];
      const xun = new Set(Array.from(board.meta.xunkong || [], (b) => b.cn));
      const bl = Array.from(board.lines).map((l) => ({ br: l.branch.cn, el: EL_OF[l.branch.cn], moving: l.moving }));
      const movers = bl.filter((x) => x.moving);
      for (const key of ['wealth', 'officer', 'parent', 'output']) {
        const p = buildPacket(board, { yongKey: key });
        if (!p.yong) continue;
        for (const u of p.yong.yuan.useless) {
          const line = bl[u.pos - 1];
          const rank = rankOf(line.el, monEl);
          const controlled = movers.some((m) => CTRL[m.el] === line.el) || CTRL[dayEl] === line.el || CTRL[monEl] === line.el;
          const want = new Set();
          if (rank <= 2 && (!line.moving || controlled)) want.add('元神休囚不动，或动而休囚又被伤克');
          if (rank <= 2 && (xun.has(line.br) || clash(line.br, monBr))) want.add('元神休囚又逢旬空月破');
          const listed = new Set(u.rules.map((r) => r.text));
          for (const t of listed) if (!STRUCTURAL.includes(t)) assert.ok(want.has(t), `${u.pos}: ${t} listed but false`);
          for (const t of want) assert.ok(listed.has(t), `${u.pos}: ${t} holds but is not listed`);
          // a 变 or 墓 reason needs its own condition to hold; check the listed ones are reachable
          assert.equal(u.verdict, u.rules.length ? '无用' : '未论', `${u.pos}: verdict`);
          verdicts[u.verdict] = (verdicts[u.verdict] || 0) + 1;
          checked++;
        }
      }
    }
  }
}
console.log(`yuan-useless: ok — ${checked} 元神 lines: ${JSON.stringify(verdicts)}`);
