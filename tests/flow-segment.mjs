/**
 * FLOW SEGMENT CONTRACT
 *
 * voice governs whether a sentence says anything — arguments, reference,
 * presupposition, implicature. flow governs the layer above it: a sentence the
 * reader can already parse, arranged so they get through it without backing
 * up, without holding something in memory, and without starting to argue.
 *
 * The danger this file exists for is one specific misreading. Every rule in it
 * makes prose easier, and the cheapest way to make prose easier is to delete
 * some — so a "readability" segment is an invitation to compress, and
 * compressing is what CLAUDE.md §6 explicitly forbids: 篇幅只有下限没有上限,
 * 写长了不是毛病. A reading that lost a paragraph to flow lost the thing the
 * reader paid for.
 *
 * So the segment has to open by refusing that reading, and it has to keep
 * saying it inside the rules that are most temptingly cuttable — the 让步
 * ordering rule and the 人格/处境 rule both move words rather than drop them,
 * and both say so.
 *
 * Also guarded: that it stays SIX rules. The failure recorded in CLAUDE.md is
 * five rules that all meant one thing, which taught the model a checklist
 * rather than a principle. Six rules over three angles, each with one
 * generalising question, is the shape. A seventh should have to argue for
 * itself in a diff.
 *
 * Run: node tests/flow-segment.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const { PromptEngine } = await import(`${ROOT}/functions/_lib/prompt-engine.js`);
const flow = PromptEngine.SEGMENTS.flow;

assert.ok(flow, 'SEGMENTS.flow is gone');

// ── it must refuse to be read as a compression instruction ────────────────
assert.match(flow, /不许用来删东西/,
  'flow does not open by refusing compression — a readability rule that does not say '
  + '"do not cut" will be spent cutting, and length has no ceiling here');
assert.match(flow, /篇幅一个字不能短|字不能短/,
  'flow does not protect length explicitly');
assert.match(flow, /写长不是毛病/,
  'flow drops the line that ties it back to the length rule it must not contradict');

/* The two rules that move words are exactly the two that look like deletions,
   so each has to say it is a reordering. Without that, "让步在前" reads as
   "drop the caveats" and "落在处境上" reads as "soften it". */
assert.match(flow, /该保留的限度一个字都不删|只是挪到主张前面/,
  'the concession-ordering rule does not say the caveats are moved rather than cut');
assert.match(flow, /尺寸一点不减/,
  'the situation-not-character rule does not say the severity is unchanged — without it, '
  + 'it reads as an instruction to go soft');
assert.match(flow, /这不是少说|不是把话说软/,
  'flow never distinguishes reordering from saying less');

// ── six rules, three angles, one question each ────────────────────────────
const rules = flow.match(/\*\*[一二三四五六] · /g) || [];
assert.equal(rules.length, 6,
  `flow carries ${rules.length} rules, not six. Five rules that all meant one thing is the `
  + 'failure recorded in CLAUDE.md §6 — the model learned the list instead of the principle. '
  + 'A seventh has to earn its place, and adding one silently is how a segment becomes a checklist.');

for (const angle of ['语言学', '逻辑学', '心理学']) {
  assert.ok(flow.includes(angle), `flow lost the ${angle} angle`);
}

/* Each rule generalises through a question, not through a word list. A rule
   that names banned tokens catches those tokens and nothing else; a rule that
   names the test catches the ones nobody thought of. */
const questions = flow.match(/^问:/gm) || [];
assert.equal(questions.length, 6,
  `${questions.length} generalising questions for 6 rules — a rule without one is a word list, `
  + 'and a word list only ever catches the examples in it');

const bad = flow.match(/^ {2}✗/gm) || [];
const good = flow.match(/^ {2}✓/gm) || [];
assert.equal(bad.length, 6, `${bad.length} ✗ examples for 6 rules`);
assert.equal(good.length, 6, `${good.length} ✓ examples for 6 rules`);

/* ── the ✓ rewrite must not be a shortened ✗ ───────────────────────────────
   This is the assertion that actually bites. If the good example is simply the
   bad one with clauses removed, the segment teaches compression no matter what
   its opening paragraph says — the examples are what a model imitates. Every
   pair has to keep most of its length, and the pairs that add words are the
   ones doing it right. */
const pairs = [...flow.matchAll(/^ {2}✗ (.+)\n {2}✓ (.+)$/gm)];
assert.equal(pairs.length, 6, `only ${pairs.length} ✗/✓ pairs parsed — the shape changed and this check is hollow`);
const shrunk = pairs
  .map(([, before, after], i) => ({ i: i + 1, before: before.length, after: after.length }))
  .filter((p) => p.after < p.before * 0.72);
assert.deepEqual(shrunk, [],
  'a ✓ rewrite is much shorter than its ✗ — the examples teach cutting, which is the one '
  + 'thing this segment must not teach. Rearrange the sentence instead of shortening it.');


/* ── a ✓ must be the same claim as its ✗, not a different one ──────────────
   The length check above catches a rewrite that CUTS. It does not catch one
   that SWAPS, and swapping is the subtler failure. The sixth rule shipped with

     ✗ 你太急了,沉不住气。
     ✓ 这一段你等不起 —— 而盘上最近的一档在2028。

   which reads as a fix and is not one: the first says the man is moving early,
   the second says a deadline is bearing down on him. The cause moved off him
   and onto the situation, so the "rewrite" answers a different question — and
   if the board really shows him rushing, it now says something false. Length
   was preserved; the assertion was not. The rule broke itself with its own
   example.

   ⚠️ DO NOT rebuild this as a lexical-overlap check. That was tried and it
   cannot work here. Share of content characters an ✓ keeps from its ✗
   (particles stripped), over the six shipped pairs and the bad one:

       rule 1  84%   rule 2  56%   rule 4  78%   rule 5  79%
       rule 3  23%   rule 6 (correct)  0/4      rule 6 (the bad pair)  0/4

   No threshold separates the last two, and that is not bad luck. Rule 6 says
   to trade a one-place predicate (急(你)) for a two-place relation
   (快于(你, 盘的节奏)) — replacing the predicate word IS the instruction, so a
   correct rewrite of that rule is guaranteed to score zero. An overlap check
   red-flags the one rule it was written to guard, and the next agent weakens
   it until it passes. That is how a contract becomes a formality.

   Same claim is not mechanically checkable. What is checkable: the rule
   carries the warning in prose, and the pair that already failed stays out. */
const persona = flow.match(/\*\*六 · [\s\S]*?(?=\n\n|$)/);
assert.ok(persona, 'the sixth rule no longer parses — this pin points at nothing');
assert.match(persona[0], /换的是挂法,不是断言/,
  'the 人格/处境 rule stopped saying the assertion is unchanged. Without that line it reads as '
  + '"move the blame onto the environment", which is a different claim, not a rewrite');
assert.match(persona[0], /那是换了个结论,不是改写/,
  'the rule no longer names the failure it sits one step away from');

assert.ok(!flow.includes('这一段你等不起'),
  'the sixth rule is back to the example that shipped and was wrong. It turns a claim about the '
  + 'reader moving early into a claim about an external deadline: same length, different '
  + 'assertion. Re-hang the predicate, do not move the cause.');

// ── and it has to reach the reading ───────────────────────────────────────
assert.ok(PromptEngine.SEGMENTS.voice, 'voice is gone — flow was meant to sit above it, not replace it');
assert.ok(flow.length < PromptEngine.SEGMENTS.voice.length / 3,
  'flow is no longer 极简 — it was asked for as a short segment beside a long one, and a '
  + 'readability rule that is itself hard to read has answered its own question wrong');

for (const route of ['relationship', 'timing', 'wealth', 'general']) {
  const assembled = PromptEngine.assemblePrompt(route, 'sortis', 'initial');
  assert.ok(assembled.includes('怎么排才读得下去'),
    `route ${route} assembles without flow, so its readings are governed by voice alone`);
}

console.log(`flow segment OK — ${rules.length} rules over 3 angles, ${questions.length} generalising `
  + `questions, ${pairs.length} rewrite pairs none of which shorten, ${flow.length} chars`);
