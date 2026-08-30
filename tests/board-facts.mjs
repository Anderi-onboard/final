/**
 * BOARD FACTS CONTRACT
 *
 * A reading may not state a board fact the board does not carry. That sounds
 * obvious and went unenforced for the life of the product, because the one
 * check that existed was written in the wrong language.
 *
 * Measured on a live reading, 2026-08-27 (question: 「我明天考科目一能过吗」,
 * board 申月癸酉日, moving lines 2/3/4):
 *
 *   · it wrote 「动爻两条」 against three moving lines, and the one it dropped
 *     was the World line its entire verdict then rested on. The count check
 *     existed — as /\b(one|two|…)\s+moving\s+lines?\b/i. Readings follow the
 *     asker's language, so it had never once matched.
 *   · it wrote 「酉月酉日」 against a 申月 board and built half the verdict on
 *     「月建日辰全都是金」. There was no month check at all.
 *   · it wrote 「被月建酉金正面对冲」 of a 寅 line. 酉 clashes 卯; 申 clashes 寅.
 *     The 月破 conclusion was right under the real month, so a wrong mechanism
 *     rode out on a right answer — the version of this error that no amount of
 *     reading catches.
 *
 * The verdict was 「能过」. The asker did not pass.
 *
 * This file's acceptance line is that exact reading: feed it in, and all three
 * must fire. Everything else here is the negative side — a correct reading must
 * stay silent, or the check gets switched off the first week it cries wolf.
 *
 * Run: node tests/board-facts.mjs
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
vm.runInContext(readFileSync(`${ROOT}/prompt-checks.js`, 'utf8'), sandbox, { filename: 'prompt-checks.js' });
const PC = sandbox.BWPromptChecks;
assert.ok(PC && typeof PC.checkBoardFacts === 'function', 'checkBoardFacts is gone');

/** The board from the reading above: 申月癸酉日, three moving lines. */
const BOARD = {
  lines: [{}, { moving: true }, { moving: true }, { moving: true }, {}, {}],
  meta: { monthBranch: { cn: '申' }, dayPillar: { branch: { cn: '酉' } } }
};
const run = (text) => {
  const r = PC.checkBoardFacts(text, BOARD);
  return { ok: r.ok, issues: Array.from(r.issues) };
};

// ── a correct restatement must be silent ──────────────────────────────────
//
// This half matters as much as the other. A board-fact check that fires on
// accurate prose gets disabled, and then the real errors travel free.
const CLEAN = [
  ['pillars and count, all correct',
    '申月癸酉日起卦。动爻三条:二、三、四爻。'],
  ['a clash named correctly, by branch',
    '应爻寅木被月建申金正面对冲,是月破。'],
  ['a clash named correctly, by animal',
    '六爻木虎,被月建金猴正面对冲,月破。'],
  ['the reading names its own pillars — 日辰月建 puts a 辰 in front of a 月',
    '酉日申月,日辰月建都是金,世爻跟着旺。'],
  ['one branch and a clash, nothing to check',
    '这一爻逢冲,力量散掉了。'],
  ['three or more branches — a summary, not an assertion about a pair',
    '寅申巳三刑,里面还带着冲。'],
  ['English, correct',
    'Three moving lines on this board. The Response line is month-broken.']
];
for (const [label, text] of CLEAN) {
  const r = run(text);
  assert.deepEqual(r.issues, [], `false positive on ${label}: ${r.issues.join(' / ')}`);
}

// ── every error class must fire ───────────────────────────────────────────
const PLANTED = [
  ['moving-line count, Chinese', '动爻两条:二爻和四爻。', /动爻 2 条.*实际是 3/],
  ['moving-line count, English', 'The board shows two moving lines.', /2 moving line/],
  ['the month', '酉月酉日,月建日辰都是金。', /酉月.*申月/],
  ['the day', '申月子日起的卦。', /子日.*酉日/],
  ['a clash, by branch', '应爻寅木被酉金对冲,月破。', /寅.*冲的是 申/],
  ['a clash, by animal', '六爻木虎,被月建金鸡正面对冲。', /冲的是 申/],
  ['a clash, stated in the other order', '酉金正面冲着寅木那一条。', /酉.*冲的是 卯/]
];
for (const [label, text, pattern] of PLANTED) {
  const r = run(text);
  assert.ok(!r.ok, `${label} was not caught — the check is blind to it`);
  assert.ok(r.issues.some((i) => pattern.test(i)),
    `${label} fired, but with the wrong message: ${r.issues.join(' / ')}`);
}

/* ── the acceptance line: the reading that actually shipped ────────────────
   Not a synthetic sample. If a rewrite of these checks passes everything above
   and still lets this through, the checks were rewritten to pass the tests. */
const SHIPPED = `- 起卦时间:2026年8月27日,酉月酉日 —— **月建、日辰都是金**
- 动爻两条:二爻水猪(父母,旬空)化火蛇;四爻土狗(妻财,旬空)化金鸡
六爻木虎,兄弟,白虎,状态是「死」,还**月破** —— 被月建酉金正面对冲。`;
const shipped = run(SHIPPED);
assert.ok(!shipped.ok, 'the reading that shipped and was wrong now passes — that is the whole failure');
for (const [what, pattern] of [
  ['the dropped moving line', /动爻 2 条/],
  ['the invented month', /酉月/],
  ['the impossible clash', /冲的是 申/]
]) {
  assert.ok(shipped.issues.some((i) => pattern.test(i)),
    `${what} is not reported. Issues were: ${shipped.issues.join(' / ') || '(none)'}`);
}

// Anti-vacuity: a check that inspects nothing reports nothing.
assert.ok(shipped.issues.length >= 3,
  `only ${shipped.issues.length} issue(s) on a reading with three known errors — a pattern stopped matching`);

/* ── 用神 assignment has ONE owner ─────────────────────────────────────────
   The table lived in both `readability` and `sortis_method` Step 1, which is
   the failure mode CLAUDE.md §7.5 records: two copies drift, and a question
   type added to one is missing from the other. Step 1 now points at the table
   instead of restating it. */
const { PromptEngine } = await import(`${ROOT}/functions/_lib/prompt-engine.js`);
const S = PromptEngine.SEGMENTS;
const owners = Object.entries(S)
  .filter(([, v]) => /→\s*妻财|wealth→Wife-Wealth|婚恋对象、配偶\s*→/.test(String(v)))
  .map(([k]) => k);
assert.deepEqual(owners, ['readability'],
  `the 用神 table appears in ${owners.join(' + ')}. It has one owner; a second copy is how an `
  + 'exam question ends up read off whichever line happens to be strongest.');

/* ── the three rules the failed reading needed, each in its owner ──────── */
assert.match(String(S.readability), /考试、考核、资格、录取/,
  'the exam row is gone from the 用神 table — it takes two yongshen (官鬼 and 父母) and has two '
  + '忌神 (妻财 and 子孙), and reading it off one line is what produced a 「能过」 that was wrong');
assert.match(String(S.sortis_method), /STRENGTH IS INDEXED TO A DAY/,
  'the segment no longer says which day strength is judged against. 旬空 travels with the 旬: the '
  + 'World line was strongest on the casting day and 旬空 on the day the question actually asked about');
assert.match(String(S.sortis_method), /A transform is a PROCESS, not a second label/,
  'the transform rule stopped saying a 化 is a sequence with an actor — read as two nouns, '
  + '父母化子孙 loses the thing it says');
assert.match(String(S.sortis_method), /一看空、二看冲/,
  'the ordered sweep is gone. 空 is first because a void yongshen is the commonest way a reading '
  + 'gets built on something that is not there');
assert.ok(!/wealth→Wife-Wealth/.test(String(S.sortis_method)),
  'Step 1 is carrying a second copy of the table again');

/* ── four rules from 增删卜易 that the failed reading needed ───────────────
   The owner supplied the book's own breakdown, and it named a fourth error in
   that reading which nothing here had caught: it used a 变爻 from the fourth
   line to feed the World line, and leaned on it («有一条线正在往你身上补劲»).
   变爻 act only on the line that produced them. The rule was absent from the
   prompt entirely, so there was nothing to violate. */
assert.match(String(S.sortis_method), /A 变爻 ACTS ONLY ON ITS OWN 动爻/,
  'the transform-scope rule is gone. Without it any 变爻 can be borrowed to support any line, '
  + 'which is how a reading manufactures support that is not on the board');
assert.match(String(S.sortis_method), /破而有救/,
  '月破 is back to one grade. 破而有救 (moving and generated — repairable, acts at 实破 or on a 合 day) '
  + 'and 到底之破 (static, 休囚, nothing generating it — simply gone) fail in opposite directions, and '
  + 'the shared cause is skipping the grade');
assert.match(String(S.meta_rules), /A STAGED PROCESS IS NOT ONE MATTER/,
  'the staged-process rule is gone — 县试/府试/道试, 科目一/二/三, 初试/复试 each take their own casting, '
  + 'and the failed reading closed by pronouncing on 科目二 off a board taken for 科目一');
assert.match(String(S.inference_traps), /THE INDEX IS NOT ONLY THE QUESTION TYPE/,
  'the indexical rule no longer says the index can be a parameter inside the question. 近病逢空即愈 vs '
  + '久病逢空必危 is the same signal inverting on a parameter the route cannot see');

console.log(`board facts OK — ${CLEAN.length} correct readings stay silent, ${PLANTED.length} error `
  + `classes fire, the shipped reading reports ${shipped.issues.length}, 用神 table has one owner`);
