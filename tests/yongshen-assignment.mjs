/**
 * YONGSHEN ASSIGNMENT CONTRACT
 *
 * The 用神 is chosen from the QUESTION. For the life of this product it was
 * chosen from a hardcoded string.
 *
 *   chat-app.js  → BWPromptRouter.interpret({ …, category: "general" })
 *   prompt-router → CATEGORY_YONGSHEN["general"] === "self"
 *   liuyao-ai     → deriveRoles(board, "self") → 用神 = 世爻
 *
 * So every reading ever produced read the World line as its subject, whatever
 * was asked, and 原神/忌神/仇神 were derived from that anchor. The board block
 * then states 「用神 = 世爻」 as an authoritative fact, and the reading does what
 * it is told — which is why the failure looked like the model ignoring a rule.
 * It was not ignoring anything.
 *
 * Measured 2026-08-27 on 「我明天考科目一能过吗」 (申月癸酉日, 山风蛊 → 火地晋,
 * 动爻 2/3/4): anchored on 世, the word 用神 appeared zero times, 父母 — the
 * exam's own line — was read as background, and the verdict was 「能过」. The
 * asker did not pass.
 *
 * Under the correct assignment the same board inverts:
 *   用神 父母亥水  旬空, 发动, 化巳火 — and 巳火 is the 仇神
 *   原神 官鬼酉金  临日辰 on the casting day, 旬空 on the day asked about
 *   忌神 妻财戌土  旬空 on the casting day, 临日辰 on the day asked about
 *
 * Twenty-five of CATEGORY_YONGSHEN's twenty-eight keys were unreachable,
 * including exam:"parent" — the right answer, present in the code, never once
 * selected.
 *
 * Run: node tests/yongshen-assignment.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const read = (f) => readFileSync(`${ROOT}/${f}`, 'utf8');

const sandbox = { console: { log() {}, warn() {}, error() {} }, Math, JSON, Object, Array,
  String, Number, Error, Date, RegExp, Set, Map, parseInt, parseFloat, isNaN };
sandbox.window = sandbox;
sandbox.self = sandbox;
vm.createContext(sandbox);
for (const f of ['liuyao-engine.js', 'liuyao-ai.js']) {
  vm.runInContext(read(f), sandbox, { filename: f });
}
const AI = sandbox.BWLiuYaoAI;
assert.equal(typeof AI.subjectKey, 'function',
  'BWLiuYaoAI.subjectKey is gone — without it the 用神 falls back to a category string again');

/* ── the subject comes from the wording ───────────────────────────────────
   Not exhaustive, and not meant to be: these are the 事类 增删卜易 devotes
   chapters to, and each one that resolves to 世爻 is a reading anchored on the
   asker instead of on the matter. */
const CASES = [
  ['我明天考科目一能过吗', 'parent', 'officer'],
  ['我今年考研能上岸吗', 'parent', 'officer'],
  ['这单生意能赚钱吗', 'wealth', null],
  ['我妈这个病要紧吗', 'officer', null],
  ['今年能买上房吗', 'parent', null],
  ['和他合伙做这事行不行', 'peer', null],
  ['我该不该辞职', 'officer', null],
  ['明年能不能怀上', 'output', null],
  ['我女朋友是不是还喜欢我', 'wealth', null]
];
for (const [q, key, second] of CASES) {
  const s = AI.subjectKey(q);
  assert.equal(s.key, key, `「${q}」 resolved to ${s.key}, expected ${key}`);
  assert.equal(s.second || null, second, `「${q}」 second yongshen was ${s.second || null}, expected ${second}`);
  assert.equal(s.matched, true, `「${q}」 fell through to the default — it names its subject plainly`);
  assert.ok(s.why && s.why.length > 4, `「${q}」 carries no reason for its assignment`);
}

/* ── an exam takes TWO, and fails if either is weak ───────────────────────
   官鬼 is the placement, 父母 is the paper. Reading one of them is how a board
   whose 父母 is void produces 「能过」. */
const exam = AI.subjectKey('我明天考科目一能过吗');
assert.ok(exam.second, 'the exam no longer carries its second 用神');
assert.match(exam.why, /官鬼|父母/, 'the exam assignment does not say what each line stands for');

/* ── the default must be visible ──────────────────────────────────────────
   世爻 is right for 自占, so the fallback stays. What may not come back is the
   silence: a default indistinguishable from a decision is why this survived. */
const vague = AI.subjectKey('我最近运气怎么样');
assert.equal(vague.key, 'self', 'the 自占 fallback is gone');
assert.equal(vague.matched, false,
  'the fallback reports itself as a match — then nothing downstream can tell a chosen 用神 from a '
  + 'defaulted one, which is exactly how every reading came to be anchored on 世爻');

/* ── nothing hardcodes the category any more ──────────────────────────────
   This is the actual defect. Grep-level, because it is a one-line regression
   that reintroduces the whole failure. */
// Strip comments first. The lines explaining this defect quote the very string
// being banned, and a scan that cannot tell code from commentary reports the
// warning as the crime — the same false positive the free-reading contract hit.
const code = (f) => read(f)
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/^\s*\/\/.*$/gm, ' ');
const chatApp = code('chat-app.js');
assert.ok(!/category:\s*["']general["']/.test(chatApp),
  'chat-app.js hardcodes category:"general" again. That single string made every reading on this '
  + 'product read the World line as its 用神, whatever the question was.');
// Anti-vacuity: the scrubber must leave the file it is supposed to scan.
assert.ok(chatApp.length > read('chat-app.js').length * 0.5 && /BWPromptRouter\.interpret/.test(chatApp),
  'the comment scrubber ate chat-app.js, so the ban above is checking nothing');
// Comments here name subjectKey too, so this reads the code, not the prose.
const router = code('prompt-router.js');
assert.match(router, /AI\.subjectKey\(/,
  'prompt-router no longer CALLS subjectKey for the 用神 — it is back to a category lookup, whose '
  + 'default is 世爻');
assert.ok(/BWPromptRouter|interpret/.test(router),
  'the comment scrubber ate prompt-router.js, so the check above is checking nothing');

/* ── the assignment reaches the model as data ─────────────────────────────
   Deriving it and not shipping it is the same as not deriving it. */
const board = sandbox.BWLiuYao.computeBoard({
  lines: [{ yang: false }, { yang: true }, { yang: true }, { yang: false }, { yang: false }, { yang: true }],
  changeIdx: [1, 2, 3]
});
const roles = AI.deriveRoles(board, exam.key);
const built = AI.buildMessages(board, roles, '我明天考科目一能过吗', exam.key, null, 'zh', exam);
const text = built.messages[0].content;
assert.match(text, /CHOSEN FROM THE QUESTION/,
  'the board block no longer says where the 用神 came from');
assert.match(text, /父母/, 'the board block does not name the chosen 用神');
assert.match(text, /BOTH are 用神/, 'the second 用神 is not carried into the block');

/* ── and the roles it derives are the ones the board actually needs ───────
   Anchored on 父母 (水): 原神 金, 忌神 土, 仇神 火. That last one is why this
   board matters — the 用神 is void, moving, and transforms into 巳火, so it
   transforms into the 仇神. Anchored on 世 that fact has nowhere to land. */
const el = roles.elements;
assert.equal(el.yong, 4, '用神 element is not 水 — the assignment moved');
assert.equal(el.yuan, 3, '原神 should be 金 (金生水)');
assert.equal(el.ji, 2, '忌神 should be 土 (土克水)');
assert.equal(el.chou, 1, '仇神 should be 火 (火生土) — the element the 用神 transforms into on this board');

const worldAnchored = AI.deriveRoles(board, 'self');
assert.notEqual(worldAnchored.elements.yong, el.yong,
  'anchoring on 世 and anchoring on the question now give the same 用神 — the fix is inert');

/* ── the SECOND 用神 has to be marked in the data, not only announced ───────
   Announcing it and then labelling it from the first anchor's lattice is worse
   than not announcing it, because the two disagree and the per-line field
   wins: it is concrete, it sits on the line, and the header is one sentence
   far above it.

   Measured on the exam board before this was fixed:
     header   用神 · 父母 + 官鬼 — BOTH are 用神 here
     line 3   "relative":"Pressure (官鬼)", "role":"Support"
   The reading duly took 官鬼 as background support for 父母.

   Only two things are true from both anchors at once, so only those are
   marked: this line is also a subject, and this line controls the other
   subject. No second lattice — 原/忌/仇/泄 are coherent from one anchor only,
   and a second set would contradict the first on every line. */
function payloadFor(lines, changeIdx, question) {
  const b = sandbox.BWLiuYao.computeBoard({ lines, changeIdx });
  const s = AI.subjectKey(question);
  const m = AI.buildMessages(b, AI.deriveRoles(b, s.key), question, s.key, null, 'zh', s);
  const txt = m.messages[0].content;
  const HEAD = 'BOARD (authoritative facts):\n';
  return JSON.parse(txt.slice(txt.indexOf(HEAD) + HEAD.length, txt.indexOf('\n\nTIMING')));
}

const examPayload = payloadFor(
  [{ yang: false }, { yang: true }, { yang: true }, { yang: false }, { yang: false }, { yang: true }],
  [1, 2, 3], '我明天考科目一能过吗');

const officerLines = examPayload.lines.filter((l) => l.relative.includes('官鬼'));
assert.ok(officerLines.length, 'the exam fixture no longer carries 官鬼 — this check points at nothing');
for (const l of officerLines) {
  assert.match(String(l.flags), /ALSO-用神/,
    `line ${l.line} is 官鬼 — the second 用神 on an exam — and arrives flagged only as `
    + `"${l.role}". The header says BOTH are 用神 and the data says otherwise; the data wins.`);
}
assert.match(String(examPayload.yongshen), /officer/,
  'the yongshen field names only the first subject, so the second exists in one sentence of prose '
  + 'and nowhere in the board');
assert.match(String(examPayload.yongshen), /FIRST 用神 only/,
  'the payload does not say the role column is measured from the first anchor — without that, the '
  + '"Support" on the second 用神 reads as a contradiction rather than as a different measurement');

/* 子孙 is 剥官之神 — the thing that takes the placement away — and on this
   board it is the only hidden spirit. From the 父母 anchor alone it comes out
   as "Spoiler — feeds the adversary", which is true and buries the point. */
assert.match(String(examPayload.hidden), /second 用神/,
  'the hidden spirit is labelled from the first anchor only. On the exam board that is 子孙, whose '
  + 'whole significance here (子孙为剥官之神) is a fact about the SECOND 用神.');

/* 坤为地, 动爻 2 — 官鬼 on line 3, and 子孙 on the void World line, which is
   the per-line half of the same fact. The exam fixture above never reaches it
   (its second 用神 is Metal and no line is Fire), so without this board the
   attacks-second-用神 branch is guarded by nothing. */
const kun = payloadFor(new Array(6).fill(0).map(() => ({ yang: false })), [1], '我明天考科目一能过吗');
const marked = kun.lines.filter((l) => /ALSO-用神/.test(String(l.flags)));
const attacking = kun.lines.filter((l) => /attacks-second-用神/.test(String(l.flags)));
assert.equal(marked.length, 1, `坤为地: ${marked.length} lines flagged as the second 用神, expected 1 (官鬼 on line 3)`);
assert.equal(attacking.length, 1,
  `坤为地: ${attacking.length} lines flagged as attacking the second 用神, expected 1 (子孙 on line 6). `
  + 'If this is 0 the per-line branch is dead and only the hidden-spirit path is covered.');
assert.match(String(attacking[0].relative), /子孙/, 'the line marked as attacking the second 用神 is not 子孙');

/* And it must stay off boards with one 用神, or every reading gains a second
   subject it was never given. */
const single = payloadFor(
  [{ yang: false }, { yang: true }, { yang: true }, { yang: false }, { yang: false }, { yang: true }],
  [1, 2, 3], '这单生意能赚钱吗');
assert.ok(!single.lines.some((l) => /用神\(second|attacks-second/.test(String(l.flags))),
  '一个用神的问题也标出了第二用神 — the marks fire on questions that have only one subject');

console.log(`yongshen assignment OK — ${CASES.length} questions resolve from wording, the exam takes two `
  + 'and both are marked in the board data, the default reports itself, and the assignment reaches the block');
