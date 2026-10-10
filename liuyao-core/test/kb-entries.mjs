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
import { buildPacket } from '../src/packet.js';
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
      // The matcher's tokens: the packet's list (board features ∪ 关系/状态).
      const pk = buildPacket(board, {});
      const got = new Set(retrieve(pk.tokens, ENTRIES, { limit: 1000 }).map((h) => h.entry.id));
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
      const CLASH = [['子', '午'], ['丑', '未'], ['寅', '申'], ['卯', '酉'], ['辰', '戌'], ['巳', '亥']];
      const clashes = (a, b) => CLASH.some(([x, y]) => (a === x && b === y) || (a === y && b === x));
      const monthCn = board.meta.monthBranch.cn;
      // 六冲章 (batch 2). 爻遇月冲 → 月破, whether or not the line moves (the book
      // gives no such condition). Clash pairs written out here, not imported.
      for (const l of Array.from(board.lines)) {
        if (clashes(monthCn, l.branch.cn)) want.add(`zb-l1609-yuepo-p${l.idx + 1}`);
      }
      // 卦逢六冲: the packet's 六冲卦 flag (tested separately in kb-packet.mjs).
      if (board.ben.clash) want.add('zb-l1605-liuchong');

      // 六合章 L1330 (batch 3). Combine pairs written out here, not imported.
      // 合起: static, and combines with 日 or 月.  合绊: moving, and combines with
      // 日/月 or any line.  合好: moving, and combines with another MOVING line
      // (L1330 “爻动与动爻相合”; L1324 “但有一爻不动，亦不为合”).  化扶: moving, and
      // the changed branch combines with its own original branch (L1330 “化出之爻回头相合”).
      const COMBINE = [['子', '丑'], ['寅', '亥'], ['卯', '戌'], ['辰', '酉'], ['巳', '申'], ['午', '未']];
      const combines = (a, b) => COMBINE.some(([x, y]) => (a === x && b === y) || (a === y && b === x));
      const all = Array.from(board.lines);
      for (const l of all) {
        const p = l.idx + 1;
        const bc = l.branch.cn;
        const withMD = combines(bc, board.meta.dayPillar.branch.cn) || combines(bc, board.meta.monthBranch.cn);
        const others = all.filter((o) => o.idx !== l.idx && combines(bc, o.branch.cn));
        if (!l.moving && withMD) want.add(`zb-l1330-heqi-p${p}`);
        if (l.moving && (withMD || others.length)) want.add(`zb-l1330-hebiang-p${p}`);
        if (l.moving && others.some((o) => o.moving)) want.add(`zb-l1330-hehao-p${p}`);
        if (l.moving && combines(bc, pk.lines[l.idx].transform.branch)) want.add(`zb-l1330-huafu-p${p}`);
      }

      // 旬空章 L2546 (batch 4). 空 is the engine's void flag (旬空 table tested in
      // kb-packet.mjs). 旺 = wangShuai Thriving. 月破 = branch clashes the 月建.
      for (const l of all) {
        const p = l.idx + 1;
        if (!l.void) continue;
        if (l.wangShuai.en === 'Thriving') want.add(`zb-l2546-wang-p${p}`);
        if (l.moving) want.add(`zb-l2546-dong-p${p}`);
        if (clashes(monthCn, l.branch.cn)) want.add(`zb-l2546-yuepo-p${p}`);
      }

      // 旬空章 L2546 batch 5: 日建 or 动爻 generates the line's element (五行 generating cycle written out).
      const GEN = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
      const EL_OF = { 子: '水', 丑: '土', 寅: '木', 卯: '木', 辰: '土', 巳: '火', 午: '火', 未: '土', 申: '金', 酉: '金', 戌: '土', 亥: '水' };
      const dayEl = EL_OF[board.meta.dayPillar.branch.cn];
      for (const l of all) {
        const p = l.idx + 1;
        if (!l.void) continue;
        const el = EL_OF[l.branch.cn];
        if (GEN[dayEl] === el) want.add(`zb-l2546-rijian-p${p}`);
        if (all.some((o) => o.moving && o.idx !== l.idx && GEN[EL_OF[o.branch.cn]] === el)) want.add(`zb-l2546-dongyao-p${p}`);
      }

      // 卦变生克墓绝章 (batch 6): 化生 → 吉, 化克 → 凶 (whatever 用神), 化去 → 不凶.
      // Relations from the five-element cycles, written out; 比和 and 我生变 get no entry.
      const CTRL_K = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };
      for (const l of all) {
        if (!l.moving) continue;
        const p = l.idx + 1;
        const mine = EL_OF[l.branch.cn];
        const changed = EL_OF[pk.lines[l.idx].transform.branch];
        if (GEN[changed] === mine) want.add(`zb-l2070-huasheng-p${p}`);
        else if (CTRL_K[changed] === mine) { want.add(`zb-l2077-huake-p${p}`); want.add(`zb-l2062-huake-regardless-p${p}`); }
        else if (CTRL_K[mine] === changed) want.add(`zb-l2084-huaqu-p${p}`);
      }

      // 用神章 L878 (batch 7): 日月如天 — the day and the month generate, control, or are
      // harmed by each line (五行 cycles written out; 爻伤日 = the line controls the day).
      const CTRL_D = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };
      const dayEl7 = EL_OF[board.meta.dayPillar.branch.cn];
      const monEl7 = EL_OF[board.meta.monthBranch.cn];
      for (const l of all) {
        const p = l.idx + 1;
        const el = EL_OF[l.branch.cn];
        if (GEN[dayEl7] === el) want.add(`zb-l878-riri-p${p}`);
        if (GEN[monEl7] === el) want.add(`zb-l878-yueshen-p${p}`);
        if (CTRL_D[dayEl7] === el) want.add(`zb-l878-rike-p${p}`);
        if (CTRL_D[monEl7] === el) want.add(`zb-l878-yueke-p${p}`);
        if (CTRL_D[el] === dayEl7) want.add(`zb-l878-shangri-p${p}`);
        if (CTRL_D[el] === monEl7) want.add(`zb-l878-shangyue-p${p}`);
      }

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
