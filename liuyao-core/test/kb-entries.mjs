/**
 * KNOWLEDGE-BASE ENTRY CONTRACT (first batch: 增删卜易 独发章, 暗动章)
 *
 * An entry is only worth having if it is (a) the book's own words and (b) fires
 * on exactly the boards the book's condition describes. Both are checked here.
 *
 *   1. STRUCTURE. Every entry passes validateEntry (public-domain, verbatim
 *      text_zh, non-empty `when`, ids are slugs).
 *   2. VERBATIM. Each text_zh is a substring of the excerpt line it cites
 *      (knowledge/sources/zengbu-boyi-excerpts.json). The excerpt file holds
 *      original text only; 乾按 and 编者按 never enter it.
 *   3. FIRES WHEN THE BOOK SAYS, AND ONLY THEN. The expected firing set is
 *      computed from the BOARD's own fields (moving, dayClash, wangShuai), not
 *      from the tokens, so a token bug cannot make the test agree with itself.
 *
 * Run: node test/kb-entries.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadEngine } from '../src/engine.js';
import { boardFeatures } from '../src/features.js';
import { retrieve, validateEntry } from '../src/retrieve.js';
import { ENTRIES } from '../src/corpus.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const excerpts = JSON.parse(readFileSync(resolve(ROOT, 'knowledge/sources/zengbu-boyi-excerpts.json'), 'utf8'));
const L = loadEngine();

// 1. structure
for (const e of ENTRIES) {
  const errs = validateEntry(e);
  assert.deepEqual(errs, [], `${e.id}: ${errs.join('; ')}`);
}
const ids = ENTRIES.map((e) => e.id);
assert.equal(new Set(ids).size, ids.length, 'entry ids must be unique');

// 2. verbatim
for (const e of ENTRIES) {
  const src = excerpts.lines[e.source.line];
  assert.ok(src, `${e.id}: excerpt ${e.source.line} missing`);
  assert.ok(src.text.includes(e.text_zh), `${e.id}: text_zh is not verbatim in ${e.source.line}`);
}

// 3. firing, against the board's own fields.
// Twelve October days (day branch varies) plus one day in each month (月建 varies):
// 月破 depends on the month, so an October-only sweep would never test it.
const DATES = [
  ...Array.from({ length: 12 }, (_, k) => new Date(2026, 9, 1 + k, 10, 0)),
  ...Array.from({ length: 12 }, (_, m) => new Date(2026, m, 15, 10, 0))
];
const patterns = [[], [0], [2], [4], [1, 3], [0, 2, 5]];
let boards = 0, fires = 0;
for (const date of DATES) {
  for (let bits = 0; bits < 64; bits++) {
    for (const moving of patterns) {
      const lines = [0, 1, 2, 3, 4, 5].map((i) => ({ yang: !!((bits >> i) & 1), changing: false }));
      const board = L.computeBoard({ lines, changeIdx: moving, date });
      const got = new Set(retrieve(boardFeatures(board, {}), ENTRIES, { limit: 1000 }).map((h) => h.entry.id));
      const want = new Set();
      const movingPos = Array.from(board.lines).filter((l) => l.moving).map((l) => l.idx + 1);
      // 独发: exactly one moving line, and it is p.
      if (movingPos.length === 1) want.add(`zb-l4197-dufa-p${movingPos[0]}`);
      for (const l of Array.from(board.lines)) {
        const p = l.idx + 1;
        if (l.moving || !l.dayClash) continue;   // 暗动 / 日破 apply to a static line hit by the day
        const st = l.wangShuai.en.toLowerCase();
        if (st === 'resting' || st === 'trapped') want.add(`zb-l1988-ripo-${st}-p${p}`);
        if (st === 'thriving' || st === 'strong') want.add(`zb-l1988-andong-${st}-p${p}`);
      }
      // 六冲章 (batch 2). 爻遇月冲 → 月破, whether or not the line moves (the book
      // gives no such condition). Clash pairs written out here, not imported.
      const CLASH = [['子', '午'], ['丑', '未'], ['寅', '申'], ['卯', '酉'], ['辰', '戌'], ['巳', '亥']];
      const clashes = (a, b) => CLASH.some(([x, y]) => (a === x && b === y) || (a === y && b === x));
      const monthCn = board.meta.monthBranch.cn;
      for (const l of Array.from(board.lines)) {
        if (clashes(monthCn, l.branch.cn)) want.add(`zb-l1609-yuepo-p${l.idx + 1}`);
      }
      // 卦逢六冲: the packet's 六冲卦 flag (tested separately in kb-packet.mjs).
      if (board.ben.clash) want.add('zb-l1605-liuchong');

      // Every entry the board should fire, and nothing else from this batch.
      const batch = new Set(ids);
      const gotBatch = new Set([...got].filter((id) => batch.has(id)));
      assert.deepEqual([...gotBatch].sort(), [...want].sort(),
        `${date.toISOString().slice(0, 10)} bits=${bits} moving=${moving}: fired ${[...gotBatch]} expected ${[...want]}`);
      boards++;
      fires += want.size;
    }
  }
}
console.log(`kb-entries: ok — ${ENTRIES.length} entries, all verbatim, ${boards} boards, ${fires} expected firings matched`);
