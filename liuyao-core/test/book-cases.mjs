/**
 * BOOK-CASE ACCURACY TEST
 *
 * Tests the PROGRAM's reading of a board against the book's own worked
 * examples (增删卜易 卦例), not a model's. Each claim below is something the
 * book prints or says about one casting; if the packet disagrees, the program
 * is wrong about the board, and no model stage can be trusted on top of it.
 *
 * Case transcription is hand-checked against the source text. Cases whose
 * line layout in the source is ambiguous (two-column OCR text) are NOT here.
 * Adding one means transcribing it, checking it against the printed text, and
 * writing the source line numbers next to each claim.
 *
 * Case 例二 (姤卦, 增删卜易 父母持世章, L~2555–2560 in the source text):
 *   巳月 丙申日 (旬空：辰巳)，占病，得“姤卦”乾宫：天风姤
 *   printed lines bottom→top: 父母辛丑土(世), 子孙辛亥水, 兄弟辛酉金,
 *     官鬼壬午火(应), 兄弟壬申金, 父母壬戌土; spirits 朱雀 勾陈 螣蛇 白虎 玄武 青龙.
 *
 * Run: node test/book-cases.mjs
 */
import assert from 'node:assert/strict';
import { loadEngine } from '../src/engine.js';
import { buildPacket } from '../src/packet.js';

const L = loadEngine();
const yang = [0, 1, 1, 1, 1, 1];   // 初→上; 0 = 阴 (the printed ━ ━ at 初)

// Find the date the book names: 月建巳, 日 丙申. Searched, not hard-coded, so
// the test does not depend on a guessed date.
function dateFor(monthCn, stemCn, branchCn) {
  for (let d = new Date(2026, 0, 1); d < new Date(2027, 0, 1); d = new Date(d.getTime() + 86400000)) {
    const at = new Date(d.getTime() + 12 * 3600000);
    const b = L.computeBoard({ lines: yang.map((v) => ({ yang: !!v, changing: false })), changeIdx: [], date: at });
    if (b.meta.monthBranch.cn === monthCn && b.meta.dayPillar.stem.cn === stemCn && b.meta.dayPillar.branch.cn === branchCn) return at;
  }
  throw new Error('no date found');
}

const CASES = [{
  id: '例二 姤卦 父母持世 (增删卜易)',
  date: dateFor('巳', '丙', '申'),
  yongKey: 'parent',
  claims: [
    ['旬空 辰、巳', (p) => assert.deepEqual(Array.from(p.time.xunkong), ['辰', '巳'])],
    ['六爻地支 丑亥酉午申戌（由初至上）', (p) => assert.deepEqual(p.lines.map((l) => l.branch), ['丑', '亥', '酉', '午', '申', '戌'])],
    ['六亲 父母 子孙 兄弟 官鬼 兄弟 父母', (p) => assert.deepEqual(p.lines.map((l) => l.relative), ['parent', 'output', 'peer', 'officer', 'peer', 'parent'])],
    ['六神 朱雀 勾陈 螣蛇 白虎 玄武 青龙（丙日朱雀起初）', (p) => assert.deepEqual(p.lines.map((l) => l.spirit), ['朱雀', '勾陈', '螣蛇', '白虎', '玄武', '青龙'])],
    ['世在初爻，应在第四爻', (p) => {
      assert.equal(p.ben.world, 1);
      assert.equal(p.ben.ying, 4);
      assert.deepEqual(p.lines.map((l) => l.world), [true, false, false, false, false, false]);
      assert.deepEqual(p.lines.map((l) => l.ying), [false, false, false, true, false, false]);
    }],
    ['持世爻为父母（“父母持世”）', (p) => assert.equal(p.lines[0].relative, 'parent')],
    ['用神子孙亥水月破（巳亥相冲）', (p) => assert.equal(p.lines[1].monthBreak, true)],
    // 占药以子孙为用神 (the book's own rule for this question) — a second packet, yongKey 'output'.
    ['占药：子孙用神落在第二爻', (p, board) => {
      const q = buildPacket(board, { yongKey: 'output' });
      assert.deepEqual(Array.from(q.yong.lines), [2]);
    }]
  ]
}];

let claims = 0;
for (const c of CASES) {
  const board = L.computeBoard({ lines: yang.map((v) => ({ yang: !!v, changing: false })), changeIdx: [], date: c.date });
  const p = buildPacket(board, { yongKey: c.yongKey });
  for (const [label, check] of c.claims) {
    try {
      check(p, board);
    } catch (e) {
      throw new Error(`${c.id}: claim “${label}” fails — ${e.message.split('\n')[0]}`);
    }
    claims++;
  }
}
console.log(`book-cases: ok — ${CASES.length} case, ${claims} printed claims all reproduced`);
