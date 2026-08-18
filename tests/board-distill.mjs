/**
 * BOARD DISTILL CONTRACT
 *
 * distill() is the only description of the casting the model ever sees. A fact
 * it omits does not exist for the reading, and a fact it states ambiguously is
 * worse than one it omits — the model will resolve the ambiguity confidently
 * and build on it.
 *
 * Both failures were measured on one live reading, against the fixture here
 * (山雷頤 → 风雷益, wealth question, fifth line moving):
 *
 *   1. WORD ORDER MADE A LINE'S VOID LOOK LIKE THE TRANSFORM'S. The flags were
 *      assembled with the transform FIRST and the line's own void SECOND, so
 *      line 5 read "MOVING→Fire Snake (Output) void". The Rat was void; the
 *      Snake it became was not. The reading took the Snake as void, gave it a
 *      section, and hung a timing claim on it filling. Flags describing the
 *      line now precede the transform, and the transform's own void state is
 *      stated outright instead of left to word order.
 *
 *   2. HIDDEN SPIRITS WERE REPORTED ONLY WHEN THE 用神 WAS THE HIDDEN ONE. On
 *      this board 妻财 sits on two lines, so nothing fired — while 子孙, its
 *      only generator, was hidden under the single moving line, and the board
 *      held no Fire at all. The model was handed a subject with no visible
 *      source and never told the source existed. When the 原神 is the missing
 *      one, whether it can surface IS the answer.
 *
 * Run: node tests/board-distill.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const sandbox = { window: {}, console };
sandbox.window.window = sandbox.window;
vm.createContext(sandbox);
vm.runInContext(readFileSync(resolve(ROOT, 'liuyao-ai.js'), 'utf8'), sandbox, { filename: 'liuyao-ai.js' });
const AI = sandbox.window.BWLiuYaoAI;
assert.ok(AI && AI.deriveRoles && AI.buildMessages, 'BWLiuYaoAI must expose deriveRoles and buildMessages');

const board = JSON.parse(readFileSync(resolve(ROOT, 'tests/fixtures/board-yi-to-yi.json'), 'utf8'));

// A wealth question: 妻财 IS on the board (lines 3 and 4), which is precisely
// the case that used to silence the hidden-spirit block.
const roles = AI.deriveRoles(board, 'wealth');
assert.equal(roles.yongHidden, null, 'fixture invariant: the 用神 is on the board, not hidden');

const text = AI.buildMessages(board, roles, '我这个项目以后的发展，能做大吗？', 'wealth', undefined, 'zh')
  .messages[0].content;
const distilled = JSON.parse(text.slice(text.indexOf('{"date"'), text.indexOf('\n\nTIMING')));

// ── 1. the transform is last, and its void state is not left to inference ──
const moving = distilled.lines.filter((l) => /MOVING/.test(l.flags));
assert.equal(moving.length, 1, 'fixture invariant: exactly one moving line');
const flags = moving[0].flags;

assert.ok(/MOVING→/.test(flags), 'the moving line names what it transforms into');
assert.ok(flags.indexOf('void') < flags.indexOf('MOVING→'),
  `the line's own void must come BEFORE the transform, or it reads as the transform's: "${flags}"`);
assert.match(flags, /transform-(is|not)-void/,
  'the transform\'s void state is stated outright, never inferred from word order');
// This board: the Rat is void, the Snake it becomes is not.
assert.match(flags, /transform-not-void/,
  'on this fixture the transform target is NOT void — saying otherwise is the bug being pinned');

/* No line may carry a BARE "void" token after its transform — the exact string
   shape that caused the misreading. The hyphenated transform-is-void /
   transform-not-void tokens are the fix, not the bug, so match whole tokens
   rather than substrings: "transform-not-void" ends in the letters of "void"
   while saying the opposite. */
for (const l of distilled.lines) {
  const tokens = l.flags.split(/\s+/);
  const at = tokens.findIndex((t) => t.startsWith('MOVING→'));
  if (at === -1) continue;
  assert.ok(!tokens.slice(at + 1).includes('void'),
    `line ${l.line} carries a bare "void" after its transform, which reads as the target `
    + `being void: "${l.flags}"`);
}

// ── 2. hidden spirits are reported whether or not the 用神 is the hidden one ─
assert.ok(distilled.hidden, 'distill() must carry a hidden-spirit field');
assert.notEqual(distilled.hidden, 'none — all six relatives appear among the lines',
  'this fixture has two hidden spirits; reporting none is the omission being pinned');

// 子孙 is the 原神 for a wealth question — the subject's only source, and off
// the board entirely. It must be named, and named as the source.
assert.match(distilled.hidden, /Output Fire Snake hidden under line 5/,
  'the hidden 子孙巳火 under line 5 must be reported');
assert.match(distilled.hidden, /role here: Support/,
  'and labelled with the role it plays for THIS question — it feeds the subject');
assert.match(distilled.hidden, /Pressure Metal Rooster hidden under line 3/,
  'the second hidden spirit is reported too, not just the most interesting one');

// The three facts that decide 出伏 here, none of which a per-line flag can
// carry, because each is a relation between a line and something not on it.
assert.match(distilled.hidden, /flying line controls it \(suppressed\)/,
  'flying-over-hidden control is reported');
assert.match(distilled.hidden, /flying line is VOID/,
  'a void flying line loosens its grip — omitting it hides the way out');
assert.match(distilled.hidden, /transforms into THIS VERY BRANCH/,
  'a moving line transforming into the branch hidden beneath it IS that branch surfacing');

// ── 3. the promise the system prompt makes is kept ─────────────────────────
const sys = AI.buildMessages(board, roles, 'q', 'wealth', undefined, 'en').system;
if (/hidden spirits/.test(sys)) {
  assert.ok(distilled.hidden,
    'the system prompt tells the model hidden spirits are among the given facts — so they must be given');
}

console.log('board-distill: ok');
