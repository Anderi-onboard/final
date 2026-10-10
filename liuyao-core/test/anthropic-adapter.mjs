/**
 * ANTHROPIC ADAPTER CONTRACT — the direct API path, with a fake transport
 *
 * No network. A fake fetch records what would be sent and returns scripted
 * answers. Checks: the request goes to the Messages endpoint with the key in
 * the x-api-key header only; the model name is the one configured for the
 * role; text blocks are joined; a failure carries the status and the API's
 * message but never the key; the bridge refuses to run without the key.
 * Run: node test/anthropic-adapter.mjs
 */
import assert from 'node:assert/strict';
import { createAnthropicLLM } from '../src/pipeline/llm.js';
import { runStage } from '../comfy/bridge.mjs';

const KEY = 'sk-test-KEY-never-leak-123';
const MODELS = { understand: 'm-understand', claim: 'm-claim', synth: 'm-synth' };

function fakeFetch(respond) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) });
    const r = respond(calls.length);
    return {
      ok: r.status === undefined || (r.status >= 200 && r.status < 300),
      status: r.status ?? 200,
      json: async () => r.body
    };
  };
  return { fn, calls };
}

// 1. A normal call: endpoint, headers, body, and joined text blocks.
{
  const { fn, calls } = fakeFetch(() => ({
    body: { content: [{ type: 'text', text: '{"a":' }, { type: 'text', text: '1}' }] }
  }));
  const llm = createAnthropicLLM({ apiKey: KEY, models: MODELS, fetchImpl: fn });
  const out = await llm.complete({ role: 'understand', system: 'SYS', user: 'USR' });
  assert.equal(out, '{"a":1}', 'text blocks are joined in order');
  const c = calls[0];
  assert.equal(c.url, 'https://api.anthropic.com/v1/messages');
  assert.equal(c.init.headers['x-api-key'], KEY);
  assert.ok(c.init.headers['anthropic-version'], 'API version header is sent');
  assert.equal(c.body.model, 'm-understand', 'the model for this role');
  assert.equal(c.body.system, 'SYS');
  assert.deepEqual(c.body.messages, [{ role: 'user', content: 'USR' }]);
  assert.equal(JSON.stringify(c.body).includes(KEY), false, 'the key is never in the body');
}

// 2. Each role uses its own model.
{
  const { fn, calls } = fakeFetch(() => ({ body: { content: [{ type: 'text', text: 'x' }] } }));
  const llm = createAnthropicLLM({ apiKey: KEY, models: MODELS, fetchImpl: fn });
  await llm.complete({ role: 'claim', system: 's', user: 'u' });
  await llm.complete({ role: 'synth', system: 's', user: 'u' });
  assert.deepEqual(calls.map((c) => c.body.model), ['m-claim', 'm-synth']);
}

// 3. A failure shows the status and the API's message, not the key.
{
  const { fn } = fakeFetch(() => ({ status: 401, body: { error: { message: 'invalid x-api-key' } } }));
  const llm = createAnthropicLLM({ apiKey: KEY, models: MODELS, fetchImpl: fn });
  await assert.rejects(llm.complete({ role: 'understand', system: 's', user: 'u' }), (e) => {
    assert.match(e.message, /HTTP 401/);
    assert.match(e.message, /invalid x-api-key/);
    assert.equal(e.message.includes(KEY), false, 'the key is not in the error');
    return true;
  });
}

// 4. An empty answer is an error, not an empty reading.
{
  const { fn } = fakeFetch(() => ({ body: { content: [] } }));
  const llm = createAnthropicLLM({ apiKey: KEY, models: MODELS, fetchImpl: fn });
  await assert.rejects(llm.complete({ role: 'understand', system: 's', user: 'u' }), /no text/);
}

// 5. Missing key or missing model is refused up front.
assert.throws(() => createAnthropicLLM({ apiKey: '', models: MODELS }), /ANTHROPIC_API_KEY/);
assert.throws(() => createAnthropicLLM({ apiKey: KEY, models: { understand: 'a' } }), /no model configured/);

// 6. The bridge's anthropic mode: no key → an error that names the variable.
{
  const saved = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  await assert.rejects(
    runStage('understand', { question: 'q' }, { mode: 'anthropic', ...MODELS }),
    /ANTHROPIC_API_KEY/
  );
  if (saved !== undefined) process.env.ANTHROPIC_API_KEY = saved;
}

console.log('anthropic-adapter: ok — endpoint, key in header only, per-role model, text joined; failures show status and message, never the key; missing key refused');
