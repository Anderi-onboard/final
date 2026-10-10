/**
 * 进神 / 退神 CONTRACT (动变章 L4057–4060, 野鹤曰)
 *
 * For a moving line whose change is 进神 (or 退神), the book gives four reasons each,
 * by 旺相 (rank >= 3 in the month) and 空破 (旬空 or 月破) of the line and of its
 * change. Checked here, with 五行 and 冲 written out, against the board's own
 * branches and 旬空. The side (进 or 退) is the branch pair (kb-packet.mjs checks the
 * pairs); here the reasons are checked against it.
 *
 * Run: node test/jintui-verdict.mjs
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

const DATES = [
  ...Array.from({ length: 12 }, (_, k) => new Date(2026, 9, 1 + k, 10, 0)),
  ...Array.from({ length: 12 }, (_, m) => new Date(2026, m, 15, 10, 0))
];
const patterns = [[0], [2], [4], [1, 3], [0, 3, 5]];
let checked = 0, sides = {};

for (const date of DATES) {
  for (let bits = 0; bits < 64; bits++) {
    for (const moving of patterns) {
      const board = L.computeBoard({ lines: [0, 1, 2, 3, 4, 5].map((i) => ({ yang: !!((bits >> i) & 1), changing: false })), changeIdx: moving, date });
      const p = buildPacket(board, {});
      const monBr = board.meta.monthBranch.cn, monEl = EL_OF[monBr];
      const xun = new Set(Array.from(board.meta.xunkong || [], (b) => b.cn));
      for (const pk of p.lines) {
        if (!pk.moving || !pk.transform) { assert.equal(pk.jinTuiVerdict, null, `${pk.pos}: no 进退 for a static line`); continue; }
        const jv = pk.jinTuiVerdict;
        const lbr = pk.branch, tbr = pk.transform.branch;
        const lS = rankOf(EL_OF[lbr], monEl) >= 3, tS = rankOf(EL_OF[tbr], monEl) >= 3;
        const broken = xun.has(lbr) || clash(lbr, monBr) || xun.has(tbr) || clash(tbr, monBr);
        const want = new Set();
        if (pk.transform.jinTui === '进神') {
          if (lS && tS) want.add('动旺相化旺相：乘势而进');
          if (!lS && !tS) want.add('动休囚化休囚：待时而进');
          if (!lS || !tS) want.add('动爻变爻有一值休囚：亦得旺相之日而进');
          if (broken) want.add('动爻变爻有一值空破：待填实之日而进');
        } else if (pk.transform.jinTui === '退神') {
          if (lS && tS) want.add('动旺相化旺相：退（有日月动爻生扶、占近事则不退，⚠未入判定）');
          if (!lS && !tS) want.add('动休囚化休囚：及时而退');
          if (lS || tS) want.add('动爻变爻有一旺相：待休囚之时而退');
          if (broken) want.add('动爻变爻有一逢空破：待填实之日而退');
        }
        const listed = new Set(jv.rules.map((r) => r.text));
        assert.deepEqual([...listed].sort(), [...want].sort(), `${pk.pos} ${lbr}→${tbr} (${pk.transform.jinTui}): rules`);
        assert.equal(jv.verdict, jv.rules.length ? (pk.transform.jinTui === '进神' ? '进' : '退') : '未论', `${pk.pos}: verdict`);
        sides[jv.verdict] = (sides[jv.verdict] || 0) + 1;
        checked++;
      }
    }
  }
}
console.log(`jintui-verdict: ok — ${checked} moving lines with a 进神/退神: ${JSON.stringify(sides)}`);
