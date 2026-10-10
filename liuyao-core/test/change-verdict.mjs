/**
 * 卦变 VERDICT CONTRACT (卦变生克墓绝章, L2060–2091)
 *
 * The book sorts a moving line by how its changed element (变) stands to its own
 * element (我): 变生我 → 化生 → 吉; 变克我 → 化克 → 凶 whatever the 用神 strength;
 * 我克变 → 化去 → 不凶. 比和, 变墓, 变绝 and 我生变 are named or not listed and get
 * no verdict. Checked here against the five-element cycles written out below.
 *
 * Run: node test/change-verdict.mjs
 */
import assert from 'node:assert/strict';
import { loadEngine } from '../src/engine.js';
import { buildPacket } from '../src/packet.js';

const L = loadEngine();
const GEN = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };   // 生
const CTRL = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };   // 克
const EL_OF = { 子: '水', 丑: '土', 寅: '木', 卯: '木', 辰: '土', 巳: '火', 午: '火', 未: '土', 申: '金', 酉: '金', 戌: '土', 亥: '水' };

const DATES = [
  ...Array.from({ length: 12 }, (_, k) => new Date(2026, 9, 1 + k, 10, 0)),
  ...Array.from({ length: 12 }, (_, m) => new Date(2026, m, 15, 10, 0))
];
const patterns = [[0], [2], [4], [1, 3], [0, 2, 5]];   // every pattern has a moving line

let checked = 0, counts = { 化生: 0, 化克: 0, 化去: 0, unjudged: 0 };
for (const date of DATES) {
  for (let bits = 0; bits < 64; bits++) {
    for (const moving of patterns) {
      const board = L.computeBoard({ lines: [0, 1, 2, 3, 4, 5].map((i) => ({ yang: !!((bits >> i) & 1), changing: false })), changeIdx: moving, date });
      const p = buildPacket(board, {});
      for (const l of p.lines) {
        if (!l.moving) { assert.equal(l.changeVerdict, null, `line ${l.pos} is static but has a 卦变 verdict`); continue; }
        const mine = EL_OF[l.branch];
        const changed = EL_OF[l.transform.branch];
        const cv = l.changeVerdict;
        assert.ok(cv, `line ${l.pos} moves but has no 卦变 record`);

        let want;
        if (GEN[changed] === mine) want = { relation: '化生', verdict: '吉', regardlessOfYong: false };
        else if (CTRL[changed] === mine) want = { relation: '化克', verdict: '凶', regardlessOfYong: true };
        else if (CTRL[mine] === changed) want = { relation: '化去', verdict: '不凶', regardlessOfYong: false };
        else if (mine === changed) want = { relation: '比和', verdict: null, regardlessOfYong: false };
        else want = { relation: '我生变', verdict: null, regardlessOfYong: false };

        assert.equal(cv.relation, want.relation, `line ${l.pos} ${l.branch}→${l.transform.branch}: relation`);
        assert.equal(cv.verdict, want.verdict, `line ${l.pos} ${l.branch}→${l.transform.branch}: verdict`);
        assert.equal(cv.regardlessOfYong, want.regardlessOfYong, `line ${l.pos}: 不论用神衰旺 flag`);
        if (want.verdict === null) assert.ok(cv.open, `line ${l.pos}: an unjudged 卦变 must say why`);
        if (want.relation === '化克') assert.ok(cv.open && cv.open.includes('化来'), '化克 must carry the open 化来 point');
        counts[want.verdict === null ? 'unjudged' : want.relation]++;
        checked++;
      }
    }
  }
}
console.log(`change-verdict: ok — ${checked} moving lines: 化生 ${counts.化生}, 化克 ${counts.化克}, 化去 ${counts.化去}, unjudged ${counts.unjudged}`);
