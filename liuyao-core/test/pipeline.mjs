/**
 * PIPELINE CONTRACT — the reading stages, with a scripted model
 *
 * Every path the owner asked for is exercised with a scripted model, so nothing
 * here touches the network: understanding → program 用神 → retrieval → claims
 * → synthesis; retry on bad output; rejection of claims that cite nothing
 * given or lines out of range; crisis and clarification stop the reading early;
 * follow-ups reuse the casting; the 一事一卦 notice.
 * Run: node test/pipeline.mjs
 */
import assert from 'node:assert/strict';
import { castWithBacks } from '../src/casting.js';
import { runReading, runFollowUp, PipelineError, NOTICE } from '../src/pipeline/run.js';
import { createMockLLM } from '../src/pipeline/llm.js';
import { yongFor } from '../src/pipeline/subjects.js';

const DATE = new Date(2026, 9, 8, 10, 0);
const casting = () => castWithBacks([1, 2, 3, 0, 3, 2], DATE); // 水火既济, 3·4·5 moving

// A reading the book would support, written as a test entry (NOT added to the
// corpus). It matches this casting (ben 101010) and the wealth subject.
const ENTRY = {
  id: 'test-entry-1',
  source: { book: 'SYNTHETIC', chapter: 'test', license: 'public-domain' },
  text_zh: '（测试用原句）',
  when: ['ben:101010', 'subject:wealth'],
  claim: '（测试用白话）'
};

const understand = (over = {}) => ({
  restated: '问求财能否成', category: '求财', subject: 'wealth', askerGender: 'unknown',
  askingForSelf: true, premises: [], factorsToCheck: ['货款'], wantsTiming: false,
  tone: '平静', psychology: '可能平静', risk: 'none',
  needs: { recastNotice: false, clarify: [] }, ...over
});
const claimFor = (id, over = {}) => ({
  entryId: id, claim: '断', linkToUser: '货款', realWorld: '可能对应货款', lines: [3, 6],
  confidence: 'mid', ...over
});
const synthOk = (over = {}) => ({
  answered: true, answer: '答', checks: [{ name: '回答', pass: true, note: '' }],
  confidence: 'mid', unansweredParts: [], ...over
});
const json = (o) => JSON.stringify(o);

// 1. The whole path, once.
{
  const llm = createMockLLM({
    understand: () => json(understand()),
    claim: () => json(claimFor(ENTRY.id)),
    synth: () => json(synthOk())
  });
  const r = await runReading({ question: '求财', casting: casting(), llm, corpus: [ENTRY] });
  assert.equal(r.status, 'answered');
  assert.deepEqual(r.trace.map((t) => t.stage), ['understand', 'claim', 'synth']);
  assert.equal(r.yong.key, 'wealth', 'the program, not the model, picks 用神 from the subject');
  assert.deepEqual(r.retrieved.map((x) => x.id), [ENTRY.id]);
  assert.equal(r.claims.length, 1);
  assert.ok(r.packetText.includes('【六爻'), 'the model receives the packet text');
  assert.equal(r.notices.includes(NOTICE.NO_MATCH), false);
}

// 2. Bad output is asked for again once, with the reason.
{
  let n = 0;
  const llm = createMockLLM({
    understand: () => (n++ === 0 ? 'not json at all' : json(understand())),
    claim: () => json(claimFor(ENTRY.id)),
    synth: () => json(synthOk())
  });
  const r = await runReading({ question: '求财', casting: casting(), llm, corpus: [ENTRY] });
  assert.deepEqual(r.trace.filter((t) => t.stage === 'understand').map((t) => t.attempt), [1, 2]);
  assert.equal(r.status, 'answered');
  assert.match(llm.calls[1].user, /上一次输出不合格/, 'the retry says what was wrong');
}

// 3. A claim that cites an entry it was not given is dropped by the program.
{
  const llm = createMockLLM({
    understand: () => json(understand()),
    claim: () => json(claimFor('made-up-id')),
    synth: () => json(synthOk())
  });
  const r = await runReading({ question: '求财', casting: casting(), llm, corpus: [ENTRY] });
  assert.equal(r.claims.length, 0);
  assert.equal(r.rejected.length, 1);
  assert.match(r.rejected[0].reason, /未给出的条目/);
}

// 4. A claim whose line is outside 1–6 is dropped.
{
  const llm = createMockLLM({
    understand: () => json(understand()),
    claim: () => json(claimFor(ENTRY.id, { lines: [7] })),
    synth: () => json(synthOk())
  });
  const r = await runReading({ question: '求财', casting: casting(), llm, corpus: [ENTRY] });
  assert.equal(r.claims.length, 0);
  assert.match(r.rejected[0].reason, /爻位越界/);
}

// 5. Crisis stops the reading: no claim, no synthesis.
{
  const llm = createMockLLM({
    understand: () => json(understand({ risk: 'crisis' })),
    claim: () => { throw new Error('must not be called'); },
    synth: () => { throw new Error('must not be called'); }
  });
  const r = await runReading({ question: '…', casting: casting(), llm, corpus: [ENTRY] });
  assert.equal(r.status, 'halted');
  assert.equal(r.reason, 'crisis');
  assert.deepEqual(llm.calls.map((c) => c.role), ['understand']);
}

// 6. Spouse with the asker's sex unknown: ask, do not guess.
{
  const llm = createMockLLM({
    understand: () => json(understand({ subject: 'spouse', askerGender: 'unknown' })),
    claim: () => { throw new Error('must not be called'); },
    synth: () => { throw new Error('must not be called'); }
  });
  const r = await runReading({ question: '配偶', casting: casting(), llm, corpus: [ENTRY] });
  assert.equal(r.status, 'needs_clarification');
  assert.match(r.questions[0], /性别/);
}

// 7. No entry matches: the reading says so, and synthesis still runs.
{
  const llm = createMockLLM({
    understand: () => json(understand()),
    claim: () => { throw new Error('no entries, so no claim'); },
    synth: () => json(synthOk({ answered: false, unansweredParts: ['书中无依据'] }))
  });
  const r = await runReading({ question: '求财', casting: casting(), llm, corpus: [] });
  assert.equal(r.status, 'partial');
  assert.ok(r.notices.includes(NOTICE.NO_MATCH));
  assert.equal(r.claims.length, 0);
}

// 8. Synthesis that never produces valid output stops the reading, with the stage named.
{
  const llm = createMockLLM({
    understand: () => json(understand()),
    claim: () => json(claimFor(ENTRY.id)),
    synth: () => 'still not json'
  });
  await assert.rejects(
    () => runReading({ question: '求财', casting: casting(), llm, corpus: [ENTRY] }),
    (e) => e instanceof PipelineError && e.stage === 'synth'
  );
}

// 9. A follow-up reuses the casting: no new lines, and the earlier answer is handed on.
{
  const c = casting();
  const llm = createMockLLM({
    understand: () => json(understand({ restated: '追问：怎么办' })),
    claim: () => json(claimFor(ENTRY.id)),
    synth: () => json(synthOk({ answer: '第二次的答' }))
  });
  const first = await runReading({ question: '求财', casting: c, llm, corpus: [ENTRY] });
  const second = await runFollowUp({ question: '那怎么办', previous: first, llm, corpus: [ENTRY] });
  assert.equal(second.casting.board, first.casting.board, 'the same board object: nothing was cast again');
  assert.ok(second.notices.includes(NOTICE.FOLLOW_UP));
  assert.match(llm.calls.filter((x) => x.role === 'understand')[1].user, /上一次的结论摘要/);
  assert.match(llm.calls.filter((x) => x.role === 'understand')[1].user, /答/);
}

// 10. 一事一卦: a question already cast today gets the book's notice.
{
  const llm = createMockLLM({
    understand: () => json(understand()),
    claim: () => json(claimFor(ENTRY.id)),
    synth: () => json(synthOk())
  });
  const r = await runReading({ question: '求财', casting: casting(), llm, corpus: [ENTRY], options: { priorCastings: 1 } });
  assert.ok(r.notices.includes(NOTICE.ONE_CAST));
}

// 11. 用神 by subject, from 用神章, with the spouse rule.
{
  assert.equal(yongFor('self').key, 'self');
  assert.equal(yongFor('parent').key, 'parent');
  assert.equal(yongFor('sibling').key, 'peer');
  assert.equal(yongFor('child').key, 'output');
  assert.equal(yongFor('wealth').key, 'wealth');
  assert.equal(yongFor('official').key, 'officer');
  assert.equal(yongFor('friend').key, 'ying', '占朋友、外人，以应爻为用神');
  assert.equal(yongFor('spouse', 'male').key, 'wealth', '男占妻 → 妻财');
  assert.equal(yongFor('spouse', 'female').key, 'officer', '妻占夫 → 官鬼');
  assert.ok(yongFor('spouse', 'unknown').clarify);
  assert.ok(yongFor('nonsense').clarify);
}

console.log('pipeline: ok — 11 paths: full run, retry, two rejections, crisis, clarification, empty corpus, synth failure, follow-up, 一事一卦, 用神 table');
