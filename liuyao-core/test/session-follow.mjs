/**
 * SESSION FOLLOW-UP CONTRACT — a follow-up stays on the same casting
 *
 * A follow-up reuses the casting (the same six lines, the same board) and hands
 * the earlier answer to the understanding stage. It must not cast again, and it
 * must not be able to start from a reading that has not finished.
 * Run: node test/session-follow.mjs
 */
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { start, step, follow } from '../scripts/session.mjs';

const QUESTION = '北京物流设计大赛能打到哪个地步（已过校赛）';
const base = mkdtempSync(join(tmpdir(), 'lyfollow-'));
const first = join(base, 'first');
await start({ question: QUESTION, throws: '1,2,3,0,3,2', date: '2026-10-08', dir: first });

// A follow-up needs a finished reading first.
await assert.rejects(follow({ dir: first, question: '追问', newDir: join(base, 'f0') }), /finished reading/);

// Pretend the first reading finished with this answer.
writeFileSync(join(first, 'result.json'), JSON.stringify({ answer: '第一次的结论：站得住。' }));

const second = join(base, 'second');
await follow({ dir: first, question: '对方那一边是什么情况', newDir: second });

const a = JSON.parse(readFileSync(join(first, 'init.json'), 'utf8')).state;
const b = JSON.parse(readFileSync(join(second, 'init.json'), 'utf8')).state;
assert.deepEqual(b.casting, a.casting, 'the same casting, the same lines');
assert.equal(b.previousAnswer, '第一次的结论：站得住。', 'the earlier answer is carried');
assert.equal(b.question, '对方那一边是什么情况');

// The follow-up's first pause shows the earlier answer to the model.
const res = await step(second);
assert.equal(res.status, 'awaiting');
assert.equal(res.pending[0].role, 'understand');
assert.match(res.pending[0].user, /上一次的结论摘要：第一次的结论：站得住。/);

console.log('session-follow: ok — a follow-up reuses the same casting, carries the earlier answer to the model, and refuses to start before a reading has finished');
