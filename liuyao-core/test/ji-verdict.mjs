/**
 * 忌神吉凶 CONTRACT (用神章 L593, L598)
 *
 * 有力之忌神 (动而克害用神) has five reasons (诸占大凶, L595); 无力之忌神 (动不克
 * 用神) has seven (诸占化凶为吉, L602). Checked here, with 五行 cycles and 冲 pairs
 * written out, against the board's own branches, moving lines, 旬空, and the
 * day/month. The 变 reasons (化回头生, 化进神, 化退神, 化绝, 化克, 化破) and the
 * 墓 reasons come from the transform and tomb fields, which their own tests cover;
 * here they are checked for structure only.
 *
 * Run: node test/ji-verdict.mjs
 */
import assert from 'node:assert/strict';
import { loadEngine } from '../src/engine.js';
import { buildPacket } from '../src/packet.js';
import { classifyFacts } from '../src/facts.js';

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
const patterns = [[], [0], [2], [1, 4], [0, 3, 5]];
const YONG = ['wealth', 'officer', 'parent'];
let checked = 0, verdicts = {};

for (const date of DATES) {
  for (let bits = 0; bits < 64; bits++) {
    for (const moving of patterns) {
      const board = L.computeBoard({ lines: [0, 1, 2, 3, 4, 5].map((i) => ({ yang: !!((bits >> i) & 1), changing: false })), changeIdx: moving, date });
      const dayBr = board.meta.dayPillar.branch.cn, monBr = board.meta.monthBranch.cn;
      const dayEl = EL_OF[dayBr], monEl = EL_OF[monBr];
      const bl = Array.from(board.lines).map((l) => ({ pos: l.idx + 1, br: l.branch.cn, el: EL_OF[l.branch.cn], moving: l.moving, void: l.void }));
      const movers = bl.filter((l) => l.moving);
      for (const key of YONG) {
        const p = buildPacket(board, { yongKey: key });
        if (!p.yong) continue;
        const yongEls = p.yong.lines.map((q) => EL_OF[bl[q - 1].br]);
        const yuanMoving = p.yong.yuan.lines.some((q) => bl[q - 1].moving);
        const chouMoving = p.yong.chou.lines.some((q) => bl[q - 1].moving);
        const jiPositions = p.yong.ji.lines;
        // every 忌神 the packet names must be a line the board puts on the 忌神 cycle
        for (const j of p.yong.ji.judgement) {
          const line = bl[j.pos - 1];
          const el = line.el;
          const controls = yongEls.some((ye) => CTRL[el] === ye);   // a 忌神 controls the 用神
          assert.equal(j.controlsYong, controls, `${j.pos}: controlsYong`);
          assert.equal(j.moving, line.moving, `${j.pos}: moving`);
          const side = controls ? '有力' : '无力';
          const rank = rankOf(el, monEl);
          const want = new Set();
          if (side === '有力') {
            if (line.moving) {
              if (rank >= 3 || GEN[dayEl] === el || GEN[monEl] === el || movers.some((m) => GEN[m.el] === el) || line.br === dayBr || line.br === monBr) want.add('忌神旺相，或遇日月动爻生扶，或临日月');
              if (rank === 4 && line.void) want.add('忌神旺动，临空、化空');
              if (chouMoving) want.add('忌神与仇神同动');
            }
            // 长生帝旺于日辰: the day stage is 长生 or 旺, read from the packet's line (stage table tested in kb-rules)
            const ds = p.lines[j.pos - 1].dayStage;
            if (line.moving && (ds === '长生' || ds === '旺')) want.add('忌神长生帝旺于日辰');
          } else {
            if ((rank <= 2 && !line.moving) || (rank <= 2 && line.moving && (CTRL[dayEl] === el || CTRL[monEl] === el))) want.add('忌神休囚不动，动而休囚被日月动爻克');
            if (!line.moving && (line.void || clash(line.br, monBr))) want.add('忌神静，临空破');
            if (line.moving && yuanMoving) want.add('忌神与元神同动');
          }
          // the packet's reasons must be exactly the ones the board gives (non-变, non-墓 ones)
          // 化空 (a moving 旺 line that turns void) needs the transform, so it is accepted when the
          // line is moving, 旺, and not void now; the transform itself is tested in kb-packet.
          const AIR = '忌神旺动，临空、化空';
          const airOk = side === '有力' && line.moving && rank === 4;
          if (airOk && line.void) want.add(AIR);
          if (j.rules.some((r) => r.text === AIR)) assert.ok(airOk, `${j.pos}: ${AIR} listed for a line that is not moving 旺`);
          const structural = new Set(['忌神入三墓', '忌神衰，动化退神', '忌神衰而又绝', '忌神动，化绝、化克、化破', '忌神动，化回头生、化进神', AIR]);
          const listed = new Set(j.rules.map((r) => r.text));
          for (const t of listed) if (!structural.has(t)) assert.ok(want.has(t), `${j.pos}: ${t} listed but false on the board`);
          for (const t of want) assert.ok(listed.has(t), `${j.pos}: ${t} holds but is not listed`);
          // verdict
          const expect = side === '有力' ? (line.moving && j.rules.length ? '有力' : '未论') : (j.rules.length ? '无力' : '未论');
          assert.equal(j.verdict, expect, `${j.pos}: verdict ${j.verdict}, want ${expect}`);
          verdicts[j.verdict] = (verdicts[j.verdict] || 0) + 1;
          checked++;
        }
      }
    }
  }
}
// The verdicts reach the matcher as states, one per 忌神 line.
{
  const board = L.computeBoard({ lines: [0, 1, 0, 1, 1, 0].map((v) => ({ yang: !!v, changing: false })), changeIdx: [1, 4], date: new Date(2026, 9, 12, 10, 0) });
  for (const key of YONG) {
    const p = buildPacket(board, { yongKey: key });
    if (!p.yong) continue;
    const f = classifyFacts(p);
    for (const j of p.yong.ji.judgement) {
      const want = j.verdict === '有力' ? `state:L${j.pos}:忌·有力` : j.verdict === '无力' ? `state:L${j.pos}:忌·无力` : null;
      if (want) assert.ok(f.states.some((st) => st.token === want), `${want} must reach the matcher`);
    }
  }
}
console.log(`ji-verdict: ok — ${checked} 忌神 lines: ${JSON.stringify(verdicts)}`);
