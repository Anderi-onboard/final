/**
 * BOARD PAYLOAD CONTRACT
 *
 * The engine computes twenty-eight fields per line. distill() sends seven, and
 * flattens most of the rest into one space-separated `flags` string. That is a
 * reasonable design — but what it drops is not visible from either side, and
 * for the life of the product it dropped the two things the method rests on.
 *
 * 增删卜易 names 四处生克源头 — the four places generation and control come
 * from — and the first two are 月建 and 日辰. Every 旺衰 verdict in the book is
 * read off them. The engine computes all four booleans per line
 * (dayGenerates / dayControls / monthGenerates / monthControls), and distill()
 * carried the clash and the combine and silently dropped the generate/control.
 *
 * Measured on the board from 2026-08-27 (山风蛊 → 火地晋, 动爻 2/3/4):
 *
 *   line 1  engine: dayControls, fanyin      sent: "reversal"
 *   line 2  engine: dayCombine, monthGenerates, fanyin
 *                                            sent: no month-feeds
 *   line 4  engine: dayControls              sent: no day-controls
 *   line 5  engine: monthGenerates           sent: ""   ← the empty string
 *   line 6  engine: monthClash, monthControls sent: no month-controls
 *
 * Four of six lines lost a clock relation, and one line was sent with no flags
 * at all. The reading then had to infer 旺衰 from branch names — which is
 * exactly the identification-error class the deterministic layer exists to
 * remove, reintroduced at the serialisation step.
 *
 * This file guards the serialisation, not the engine: every boolean the engine
 * computes for a clock relation has to arrive.
 *
 * Run: node tests/board-payload.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const sandbox = { console: { log() {}, warn() {}, error() {} }, Math, JSON, Object, Array,
  String, Number, Error, Date, RegExp, Set, Map, parseInt, parseFloat, isNaN };
sandbox.window = sandbox;
sandbox.self = sandbox;
vm.createContext(sandbox);
for (const f of ['liuyao-engine.js', 'liuyao-ai.js']) {
  vm.runInContext(readFileSync(`${ROOT}/${f}`, 'utf8'), sandbox, { filename: f });
}
const AI = sandbox.BWLiuYaoAI;

/* 山风蛊 → 火地晋 — the board that produced the wrong 「能过」 — cast on two
   different days. The second fixture exists because the first one exercises
   three of the four clock relations and never dayGenerates: deleting the
   `day-feeds` push left this contract GREEN, so that branch was guarded by
   nothing. `dayGanzhi` pins the day (and sets dateAuthoritative), which is the
   only way to make a board that hits it. */
const LINES = [{ yang: false }, { yang: true }, { yang: true }, { yang: false }, { yang: false }, { yang: true }];
const QUESTION = '我明天考科目一能过吗';

function fixture(dayGanzhi) {
  const b = sandbox.BWLiuYao.computeBoard({ lines: LINES, changeIdx: [1, 2, 3], dayGanzhi });
  const subj = AI.subjectKey(QUESTION);
  const msg = AI.buildMessages(b, AI.deriveRoles(b, subj.key), QUESTION, subj.key, null, 'zh', subj);
  // Delimiter-bounded: `(.+)` assumed the payload was one line, which stopped
  // being true when the six lines were laid out one row each.
  const txt = msg.messages[0].content;
  const HEAD = 'BOARD (authoritative facts):\n';
  const p = JSON.parse(txt.slice(txt.indexOf(HEAD) + HEAD.length, txt.indexOf('\n\nTIMING')));
  assert.ok(Array.isArray(p.lines) && p.lines.length === 6,
    'the distilled board no longer carries six lines — this contract is reading the wrong thing');
  return { board: b, payload: p };
}

const FIXTURES = [
  fixture(undefined),   // today's date: monthGenerates / monthControls / dayControls / void / fanyin
  fixture(0)            // 甲子日: the only one of the four that reaches dayGenerates
];
const { board, payload } = FIXTURES[0];

/* ── every clock relation the engine computed has to arrive ────────────────
   Paired by engine field → the token distill must emit. A relation present on
   the board and absent from the payload is a fact the reading has to guess. */
const CLOCK = [
  ['monthGenerates', 'month-feeds'],
  ['monthControls', 'month-controls'],
  ['dayGenerates', 'day-feeds'],
  ['dayControls', 'day-controls'],
  ['monthClash', 'month-break'],
  ['dayClash', 'day-clash'],
  ['dayCombine', 'day-combine'],
  ['dayTomb', 'enters-day-tomb'],
  ['void', 'void'],
  ['fanyin', 'reversal'],
  ['fuyin', 'locked']
];
const missing = [];
const exercised = new Set();
let carried = 0;
for (const f of FIXTURES) {
  f.board.lines.forEach((line, i) => {
    const flags = String((f.payload.lines[i] || {}).flags || '');
    for (const [field, token] of CLOCK) {
      if (line[field] !== true) continue;
      exercised.add(field);
      if (flags.includes(token)) carried += 1;
      else missing.push(`line ${i + 1}: engine has ${field}, payload flags = "${flags}"`);
    }
  });
}
assert.deepEqual(missing, [],
  'a relation the engine computed did not reach the model:\n  ' + missing.join('\n  ')
  + '\nThe reading has to infer it from branch names, which is the error class the '
  + 'deterministic layer exists to remove.');

/* Anti-vacuity, and the specific hole this test already fell into: a relation
   no fixture triggers is guarded by nothing, and the contract still passes.
   All four clock relations must be exercised by SOME fixture. */
assert.ok(carried >= 10,
  `only ${carried} relations checked across both fixtures — the comparison stopped matching, `
  + 'so the assertion above passes without inspecting anything');
for (const field of ['monthGenerates', 'monthControls', 'dayGenerates', 'dayControls']) {
  assert.ok(exercised.has(field),
    `no fixture board has ${field}, so deleting its flags.push() leaves this contract green. `
    + 'Add a board that reaches it — pin the day with dayGanzhi.');
}

/* ── no line may be sent with an empty flag string ─────────────────────────
   Line 5 was. It is generated by the month and the payload said nothing at
   all, which reads to the model as "this line has no properties". */
const blank = FIXTURES[0].payload.lines
  .map((l, i) => (String(l.flags || '').trim() ? null : i + 1))
  .filter(Boolean);
assert.deepEqual(blank, [],
  `line(s) ${blank.join(', ')} arrive with no flags at all. On this board every line has at `
  + 'least one clock relation, so an empty string means the serialiser dropped it rather than '
  + 'the board being quiet.');

/* ── the two clocks are BRANCHES, and the month shipped as an element ──────
   月建 is the first of 四处生克源头 and 增删卜易 names it by branch on every
   page. The payload said "monthElement":"Metal", which leaves 申 and 酉 and
   makes the model pick. Measured on the reading that produced 「能过」: the
   month was 申, the reading said 酉月, and everything downstream inherited it —
   月破 is the branch that clashes 月建, so a wrong 月建 moves 月破 from 寅 to 卯
   and contradicts the flags on the lines.

   It was never a hallucination. It was a fact withheld and a guess then
   treated as one. Nothing else on this board can be checked against it either:
   the model has no way to notice it guessed wrong. */
const BRANCHES = '子丑寅卯辰巳午未申酉戌亥';
for (const { board: b, payload: p } of FIXTURES) {
  const wantMonth = b.meta.monthBranch.cn;
  assert.ok(String(p.month || '').includes(wantMonth),
    `the month reaches the model as "${p.month}" and the board's 月建 is ${wantMonth}. An element `
    + 'alone leaves two candidates and the model has to pick one; on the failed reading it picked '
    + 'the wrong one and every 月破 judgement downstream inherited it.');
  const wantDay = b.meta.dayPillar.branch.cn;
  assert.ok(String(p.day || '').includes(wantDay),
    `the day reaches the model as "${p.day}", missing the 日辰 branch ${wantDay}`);
}
assert.ok(!('monthElement' in payload),
  'monthElement is back. It is the element WITHOUT the branch, which is the whole defect — and '
  + 'shipping both invites the model to read the loose one.');

/* Every branch relation in the method — 冲 合 三合 墓 破 — is stated over
   glyphs, so a payload that gives only "Metal Rooster" makes the model
   translate before it can apply any of them. The failed reading wrote 酉冲寅;
   酉 clashes 卯. */
for (const l of payload.lines) {
  assert.ok([...BRANCHES].some((c) => String(l.najia).includes(c)),
    `line ${l.line} najia is "${l.najia}" — no branch glyph. A field called 纳甲 that ships as an `
    + 'English gloss forces a translation before any 冲/合/墓/破 can be applied, and that trip is '
    + 'where the failed reading lost 酉→卯.');
}

/* ── the moving count is stated, not counted ───────────────────────────────
   增删卜易 turns on how many lines are moving (独发 reads one way, 乱动
   another) and the failed reading counted two where the board had three.
   Counting objects inside a minified blob is a thing models get wrong; it is
   also a thing the serialiser already knows. */
for (const { board: b, payload: p } of FIXTURES) {
  const mv = b.lines.filter((l) => l.moving).map((l) => l.idx + 1);
  const word = ['none', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX'][mv.length];
  assert.ok(String(p.moving || '').includes(word),
    `the payload's moving field is "${p.moving}" but ${mv.length} lines are moving. State the `
    + 'count — the model should never have to count rows to get it.');
  for (const n of mv) {
    assert.ok(new RegExp(`\\b${n}\\b`).test(String(p.moving)),
      `line ${n} is moving and the moving field "${p.moving}" does not name it`);
  }
}

/* ── one row per line ─────────────────────────────────────────────────────
   The six line objects used to arrive inside a single unbroken ~1,800-char
   string: no rows to count, and every fact about line 4 buried mid-run. This
   is the second of two independent fixes for the counting error, and it is the
   one that also helps every other per-line fact. Whitespace only — still JSON. */
const rendered = AI.buildMessages(
  FIXTURES[0].board, AI.deriveRoles(FIXTURES[0].board, 'self'), QUESTION, 'self', null, 'zh',
  { key: 'self', matched: false }).messages[0].content;
const HEAD2 = 'BOARD (authoritative facts):\n';
const blockLines = rendered.slice(rendered.indexOf(HEAD2) + HEAD2.length, rendered.indexOf('\n\nTIMING')).split('\n');
const rows = blockLines.filter((l) => /^\s+\{"line":/.test(l));
assert.equal(rows.length, 6,
  `${rows.length} of the six lines are on their own row. They were one unbroken string, which is `
  + 'the layout that makes rows uncountable — for a model for the same reason as for a person.');

console.log(`board payload OK — ${carried} engine relations across ${FIXTURES.length} boards all reach `
  + 'the model, all four clock relations exercised, both clocks ship as branches, the moving count '
  + 'is stated, six lines on six rows, no line arrives blank');
