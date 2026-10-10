/**
 * 三合成局 CONTRACT (三合章 L1456–1464)
 *
 * The book's four ways a 三合 局 forms, by which lines move (三合章: 此三合者有四):
 *   形一  three 本爻 moving, the 局 is formed               (一卦之内，三爻动而合局)
 *   形二  two 本爻 moving, one static                        (两爻动，一爻不动，亦成合局)
 *   形三  内卦 初、三爻 moving, and the 变爻 completes it    (动而变出之爻成三合)
 *   形四  外卦 四、六爻 moving, and the 变爻 completes it    (同上)
 * The 局 and its five elements, and the 生/克 of the 世, are written out below.
 *
 * Run: node test/sanhe-forms.mjs
 */
import assert from 'node:assert/strict';
import { loadEngine } from '../src/engine.js';
import { buildPacket } from '../src/packet.js';

const L = loadEngine();
const BR = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const EL = { 木: 0, 火: 1, 土: 2, 金: 3, 水: 4 };
const GEN = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
const CTRL = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };
const EL_OF = { 子: '水', 丑: '土', 寅: '木', 卯: '木', 辰: '土', 巳: '火', 午: '火', 未: '土', 申: '金', 酉: '金', 戌: '土', 亥: '水' };
// 三合 by its branches (written out, 三合章 L1456).
const TRIADS = [
  { br: ['申', '子', '辰'], el: '水' }, { br: ['巳', '酉', '丑'], el: '金' },
  { br: ['寅', '午', '戌'], el: '火' }, { br: ['亥', '卯', '未'], el: '木' }
];
const DATES = [
  ...Array.from({ length: 12 }, (_, k) => new Date(2026, 9, 1 + k, 10, 0)),
  ...Array.from({ length: 12 }, (_, m) => new Date(2026, m, 15, 10, 0))
];
const patterns = [[0], [0, 2], [0, 2, 4], [1, 3], [3, 5], [0, 1, 2], [3, 4, 5], [0, 3, 5], [2, 4]];
let groups = 0, forms = { 1: 0, 2: 0, 3: 0, 4: 0, none: 0 };

for (const date of DATES) {
  for (let bits = 0; bits < 64; bits++) {
    for (const moving of patterns) {
      const board = L.computeBoard({ lines: [0, 1, 2, 3, 4, 5].map((i) => ({ yang: !!((bits >> i) & 1), changing: false })), changeIdx: moving, date });
      const p = buildPacket(board, {});
      const bl = Array.from(board.lines).map((l) => ({ pos: l.idx + 1, br: l.branch.cn, moving: l.moving }));
      const trans = p.lines.map((l) => (l.transform ? l.transform.branch : null));
      const dayBr = board.meta.dayPillar.branch.cn, monBr = board.meta.monthBranch.cn;
      const worldPos = board.ben.worldLi + 1;
      for (const t of TRIADS) {
        // members, from the board: 本爻 (ben) with their moving flag, and 变爻 (bian) branches.
        const ben = bl.filter((x) => t.br.includes(x.br));
        const bian = [];
        for (const x of bl) if (x.moving && trans[x.pos - 1] && t.br.includes(trans[x.pos - 1])) bian.push({ pos: x.pos });
        const have = new Set([...ben.map((x) => x.br), ...bian.map((b) => b.pos ? t.br.find((b2) => b2 === trans[b.pos - 1]) : null), dayBr, monBr].filter(Boolean));
        const formed = t.br.every((b) => have.has(b));
        const pg = p.relations.sanhe.find((g) => g.cn === t.el + '局');
        assert.equal(!!pg, formed, `${t.el}局 formed: packet ${!!pg}, board ${formed}`);
        if (!formed) continue;
        const benMoving = ben.filter((x) => x.moving).map((x) => x.pos);
        const benStatic = ben.filter((x) => !x.moving).length;
        const movingAt = (q) => benMoving.includes(q);
        let want = null;
        if (benMoving.length === 3) want = 1;
        else if (benMoving.length === 2 && benStatic === 1) want = 2;
        else if (bian.length >= 1 && movingAt(1) && movingAt(3) && bian.every((b) => b.pos === 1 || b.pos === 3)) want = 3;
        else if (bian.length >= 1 && movingAt(4) && movingAt(6) && bian.every((b) => b.pos === 4 || b.pos === 6)) want = 4;
        assert.equal(pg.form, want, `${t.el}局 at ${JSON.stringify(benMoving)} bian ${JSON.stringify(bian)}: form ${pg.form}, want ${want}`);
        // 局 and 世: which way it bears on the 世 (L1460: 局生世 利于我; 局克世 则以凶推).
        const worldBr = bl[worldPos - 1].br;
        let rel = null;
        if (t.br.includes(worldBr)) rel = '世在局内';
        else if (GEN[t.el] === EL_OF[worldBr]) rel = '局生世';
        else if (CTRL[t.el] === EL_OF[worldBr]) rel = '局克世';
        if (rel) assert.equal(pg.worldRel, rel, `${t.el}局 world: ${pg.worldRel}, want ${rel}`);
        forms[want ?? 'none']++;
        groups++;
      }
    }
  }
}
console.log(`sanhe-forms: ok — ${groups} 局 checked: 形一 ${forms[1]}, 形二 ${forms[2]}, 形三 ${forms[3]}, 形四 ${forms[4]}, 四形之外 ${forms.none}`);
