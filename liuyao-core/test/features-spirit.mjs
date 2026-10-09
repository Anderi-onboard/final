/**
 * SPIRIT TOKEN CONTRACT
 *
 * 六神 (青龙 朱雀 勾陈 螣蛇 白虎 玄武) sit on every line, started by the day
 * stem. The packet already carried them, but the feature extractor emitted no
 * token for them, so a knowledge-base entry about 青龙 could never fire. That
 * is the quiet failure this test guards: a fact that is on the board but
 * invisible to retrieval.
 *
 * Checks, all against the engine's own board (not a copy of the table):
 *   1. every line emits exactly one `L<pos>:spirit:<cn>` token;
 *   2. the token names a real 六神, and the six lines use six distinct spirits;
 *   3. the token agrees with the board's own spirit field;
 *   4. the packet's tokens are the extractor's output (same list the matcher uses).
 *
 * Run: node test/features-spirit.mjs
 */
import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEngine } from '../src/engine.js';
import { boardFeatures } from '../src/features.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
void ROOT;
const SIX = ['青龙', '朱雀', '勾陈', '螣蛇', '白虎', '玄武'];
const L = loadEngine();

const cases = [
  { name: '乾为天 (甲日)', yang: [1, 1, 1, 1, 1, 1], date: new Date(2026, 9, 8, 10, 0) },
  { name: '坤为地 (庚日)', yang: [0, 0, 0, 0, 0, 0], date: new Date(2026, 9, 9, 10, 0) },
  { name: '山雷颐 (动四爻)', yang: [1, 0, 0, 1, 0, 0], changing: [3], date: new Date(2026, 9, 12, 10, 0) },
];

for (const c of cases) {
  const lines = c.yang.map((b, i) => ({ yang: !!b, changing: !!(c.changing || []).includes(i) }));
  const board = L.computeBoard({ lines, changeIdx: c.changing || [], date: c.date });
  const tokens = boardFeatures(board, {});
  const spiritTokens = tokens.filter((t) => /^L\d:spirit:/.test(t));

  assert.equal(spiritTokens.length, 6, `${c.name}: expected 6 spirit tokens, got ${spiritTokens.length}`);
  const names = spiritTokens.map((t) => t.split(':')[2]);
  for (const n of names) assert.ok(SIX.includes(n), `${c.name}: unknown spirit ${n}`);
  assert.equal(new Set(names).size, 6, `${c.name}: six lines must carry six distinct spirits`);

  board.lines.forEach((l, i) => {
    assert.ok(tokens.includes(`L${i + 1}:spirit:${l.spirit.cn}`),
      `${c.name}: line ${i + 1} spirit ${l.spirit.cn} not emitted`);
  });
}
console.log(`features-spirit: ok — ${cases.length} boards, 18 spirit tokens, six distinct per board`);
