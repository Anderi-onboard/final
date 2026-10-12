/**
 * LOCAL MODE CONTRACT — the bridge talks to a chat endpoint on this machine
 *
 * A node server stands in for local/serve_qwen_unsloth.py. Checks: the bridge's
 * local mode posts to the configured endpoint with the configured model name, and
 * the understanding it gets back is read and checked like any other model output.
 * Also runs the Python endpoint's own shape test.
 * Run: node test/local-llm.mjs
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runStage } from '../comfy/bridge.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const seen = [];
const server = createServer((req, res) => {
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    const j = JSON.parse(body);
    seen.push({ url: req.url, model: j.model, auth: req.headers.authorization, messages: j.messages });
    const content = JSON.stringify({
      restated: '问求财能否成', category: '求财', subject: 'wealth', askerGender: 'unknown',
      askingForSelf: true, premises: [], factorsToCheck: [], wantsTiming: false,
      tone: '平静', psychology: '可能平静', risk: 'none', needs: { recastNotice: false, clarify: [] }
    });
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ choices: [{ message: { role: 'assistant', content } }] }));
  });
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

process.env.LOCAL_LLM_BASE_URL = `http://127.0.0.1:${port}/v1`;
process.env.LOCAL_MODEL = 'qwen-test-name';
delete process.env.LOCAL_API_KEY;

const cast = await runStage('cast', { question: '这个月的求财能不能成', throws: '1,2,3,0,3,2', date: '2026-10-08' }, {});
const u = await runStage('understand', cast.state, { mode: 'local' });
server.close();

assert.equal(u.error, undefined);
assert.equal(u.state.understanding.subject, 'wealth', 'the local model output is read and checked');
assert.equal(seen.length, 1);
assert.equal(seen[0].url, '/v1/chat/completions', 'posts to the chat endpoint');
assert.equal(seen[0].model, 'qwen-test-name', 'uses the configured model name');
assert.equal(seen[0].auth, 'Bearer local', 'no key needed: a placeholder is sent');
assert.match(seen[0].messages[1].content, /提问：这个月的求财能不能成/);

// The Python endpoint's shape test.
const py = spawnSync('python3', [resolve(ROOT, 'local', 'test_server.py')], { encoding: 'utf8' });
assert.equal(py.status, 0, py.stderr || py.stdout);

console.log('local-llm: ok — local mode posts to the configured endpoint with the configured model, reads the reply through the same checks; endpoint shape test passes');
