/**
 * MODEL ADAPTER CONTRACT — OpenRouter-compatible, with a fake fetch (no network)
 *
 * Checks what goes out (URL, headers, the model named for each role) and what
 * comes back (the text of the first choice; anything else is an error). The
 * model text is parsed strictly: a sentence before the JSON is rejected.
 * Run: node test/llm.mjs
 */
import assert from 'node:assert/strict';
import { createOpenRouterLLM, parseJSONText } from '../src/pipeline/llm.js';

const models = { understand: 'model-a', claim: 'model-b', synth: 'model-c' };
const sent = [];
const fakeFetch = async (url, init) => {
  sent.push({ url, init, body: JSON.parse(init.body) });
  return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: '{"ok":true}' } }] }) };
};

const llm = createOpenRouterLLM({ apiKey: 'k-test', models, fetchImpl: fakeFetch });
const out = await llm.complete({ role: 'claim', system: 'S', user: 'U' });
assert.equal(out, '{"ok":true}');
assert.equal(sent[0].url, 'https://openrouter.ai/api/v1/chat/completions');
assert.equal(sent[0].init.headers.authorization, 'Bearer k-test');
assert.equal(sent[0].body.model, 'model-b', 'the claim role uses its own model');
assert.deepEqual(sent[0].body.messages, [{ role: 'system', content: 'S' }, { role: 'user', content: 'U' }]);

// Each role maps to its own model.
await llm.complete({ role: 'understand', system: '', user: '' });
await llm.complete({ role: 'synth', system: '', user: '' });
assert.deepEqual(sent.map((s) => s.body.model), ['model-b', 'model-a', 'model-c']);

// Missing configuration fails at construction, not in the middle of a reading.
assert.throws(() => createOpenRouterLLM({ apiKey: 'k', models: { understand: 'a' }, fetchImpl: fakeFetch }), /claim/);

// HTTP errors and empty answers are errors.
const bad = createOpenRouterLLM({ apiKey: 'k', models, fetchImpl: async () => ({ ok: false, status: 429, json: async () => ({}) }) });
await assert.rejects(() => bad.complete({ role: 'claim', system: '', user: '' }), /HTTP 429/);
const empty = createOpenRouterLLM({ apiKey: 'k', models, fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ choices: [] }) }) });
await assert.rejects(() => empty.complete({ role: 'claim', system: '', user: '' }), /no text/);

// JSON parsing: a code fence is tolerated; prose around the object is not.
assert.deepEqual(parseJSONText('```json\n{"a":1}\n```').value, { a: 1 });
assert.equal(parseJSONText('好的，结果是 {"a":1}').ok, false);
assert.equal(parseJSONText('{"a":').ok, false);

console.log('llm: ok — role→model, headers, HTTP and empty-reply errors, strict JSON');
