/**
 * SESSION RUN CONTRACT — the pause-and-resume protocol
 *
 * The session runner stops at each model stage, writes the prompts, and runs
 * again when replies are on file. This test plays the session model with
 * scripted replies and checks: the stages pause in order (understand, then all
 * claims together, then synth); a second pass with the same replies gives the
 * same result; a reply for an old prompt is not reused; a bad reply is asked
 * again and then stops visibly; the end result equals runReading with the same
 * scripted model.
 * Run: node test/session-run.mjs
 */
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { castWithBacks } from '../src/casting.js';
import { runReading } from '../src/pipeline/run.js';
import { createMockLLM } from '../src/pipeline/llm.js';
import { start, step, idOf } from '../scripts/session.mjs';

const QUESTION = '这个月的求财能不能成';
const THROWS = '1,2,3,0,3,2';
const DATE = '2026-10-08';

// What the session model would answer, for each role, given the prompt.
const answer = {
  understand: () => JSON.stringify({
    restated: '问求财能否成', category: '求财', subject: 'wealth', askerGender: 'unknown',
    askingForSelf: true, premises: [], factorsToCheck: [], wantsTiming: false,
    tone: '平静', psychology: '可能平静', risk: 'none', needs: { recastNotice: false, clarify: [] }
  }),
  claim: (user) => {
    const id = (/entryId 必须填：(\S+)/.exec(user) || [])[1];
    return JSON.stringify({ entryId: id, claim: '断', linkToUser: '货款', realWorld: '可能对应', lines: [], confidence: 'low' });
  },
  synth: () => JSON.stringify({ answered: true, answer: '答', checks: [], confidence: 'low', unansweredParts: [] })
};

const dir = mkdtempSync(join(tmpdir(), 'lysession-'));
await start({ question: QUESTION, throws: THROWS, date: DATE, dir });

const rounds = [];
let result;
for (let i = 0; i < 6; i++) {
  result = await step(dir);
  if (result.status === 'done') break;
  rounds.push([...new Set(result.pending.map((p) => p.role))].join('+') + ` ×${result.pending.length}`);
  const replies = {};
  for (const p of result.pending) replies[p.id] = answer[p.role](p.user);
  const prev = JSON.parse(
    (() => { try { return readFileSync(join(dir, 'replies.json'), 'utf8'); } catch (e) { return '{}'; } })()
  );
  writeFileSync(join(dir, 'replies.json'), JSON.stringify({ ...prev, ...replies }, null, 2));
}

// 1. The stages pause in order: understand alone, then all claims together, then synth.
assert.deepEqual(rounds, ['understand ×1', `claim ×${result.state.matchedIds.length}`, 'synth ×1'].slice(0, rounds.length));
assert.equal(result.status, 'done', 'the reading finishes');
assert.equal(rounds.length, 3, 'three pauses: understand, claims, synth');

// 2. The same replies give the same result when the runner is run again.
const again = await step(dir);
assert.equal(again.status, 'done');
assert.equal(again.state.result.answer, result.state.result.answer);

// 3. The result equals runReading with the same scripted model.
const casting = castWithBacks(THROWS.split(',').map(Number), new Date(`${DATE}T10:00:00`));
const llm = createMockLLM({
  understand: ({ user }) => answer.understand(user),
  claim: ({ user }) => answer.claim(user),
  synth: ({ user }) => answer.synth(user)
});
const r = await runReading({ question: QUESTION, casting, llm });
assert.equal(result.state.result.answer, r.synthesis.answer, 'same answer as runReading');
assert.deepEqual(result.state.claims.map((c) => c.entryId), r.claims.map((c) => c.entryId), 'same claims');

// 4. A reply written for an old prompt is not reused: the id changes with the text.
assert.notEqual(idOf({ role: 'claim', system: 's', user: 'a' }), idOf({ role: 'claim', system: 's', user: 'b' }));

// 5. A bad reply is asked again once, then stops the stage visibly.
{
  const bad = mkdtempSync(join(tmpdir(), 'lysession-bad-'));
  await start({ question: QUESTION, throws: THROWS, date: DATE, dir: bad });
  let res = await step(bad);
  assert.equal(res.status, 'awaiting');
  writeFileSync(join(bad, 'replies.json'), JSON.stringify({ [res.pending[0].id]: 'not json' }));
  res = await step(bad);
  assert.equal(res.status, 'awaiting', 'the bad reply is not accepted');
  assert.equal(res.pending[0].role, 'understand', 'the same stage asks again with the reason');
  assert.match(res.pending[0].user, /上一次输出不合格/);
}

console.log('session-run: ok — pauses in order (understand, claims together, synth); same replies give the same reading; equals runReading; a changed prompt needs a new reply; a bad reply is asked again');
