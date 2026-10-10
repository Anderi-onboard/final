/**
 * COMFY BRIDGE CONTRACT — the stages the ComfyUI nodes call
 *
 * Why this exists: the ComfyUI nodes show each stage separately. That view is
 * only honest if (a) running the stages one by one gives the same reading as
 * run.js, (b) every model call is shown with its prompt, input and output, and
 * (c) a stop is shown as a stop, never as a silent skip.
 * Run: node test/comfy-bridge.mjs
 */
import assert from 'node:assert/strict';
import { castWithBacks } from '../src/casting.js';
import { runReading } from '../src/pipeline/run.js';
import { createDemoLLM, createMockLLM } from '../src/pipeline/llm.js';
import { runStage } from '../comfy/bridge.mjs';

const INPUT = { question: '这个月的求财能不能成', throws: '1,2,3,0,3,2', date: '2026-10-08' };
const json = (o) => JSON.stringify(o);

async function chain(state, config) {
  let s = state;
  const shown = {};
  for (const stage of ['cast', 'understand', 'packet', 'retrieve', 'claims', 'synth']) {
    const out = await runStage(stage, s, config);
    assert.equal(out.error, undefined, `${stage} failed: ${out.error}`);
    shown[stage] = out.display;
    s = out.state;
    if (s.stop) break;
  }
  return { state: s, shown };
}

// 1. The stages, run one by one with the demo model, give the same reading as runReading.
{
  const config = { mode: 'mock', llm: createDemoLLM() };
  const { state } = await chain(INPUT, config);
  assert.equal(state.stop, undefined, 'the demo reading should not stop');

  const casting = castWithBacks([1, 2, 3, 0, 3, 2], new Date('2026-10-08T10:00:00'));
  const r = await runReading({ question: INPUT.question, casting, llm: createDemoLLM(), corpus: undefined });

  assert.equal(state.result.answer, r.synthesis.answer, 'same answer');
  assert.equal(state.result.status, r.status, 'same status');
  assert.equal(state.understanding.subject, r.understanding.subject, 'same subject');
  assert.equal(state.yong.key, r.yong.key, 'same 用神');
  assert.equal(state.packetText, r.packetText, 'same packet text the models read');
  assert.deepEqual(state.matchedIds, r.retrieved.map((x) => x.id), 'same entries retrieved, same order');
  assert.deepEqual(state.claims.map((c) => c.entryId), r.claims.map((c) => c.entryId), 'same claims, same order');
  assert.equal(state.rejected.length, r.rejected.length, 'same rejections');
}

// 2. Every model stage shows the prompt, the input, the output and the verdict.
{
  const { shown } = await chain(INPUT, { mode: 'mock', llm: createDemoLLM() });
  for (const stage of ['understand', 'claims', 'synth']) {
    for (const marker of ['=== 系统提示 ===', '=== 用户输入 ===', '=== 模型输出 ===', '=== 程序判定 ===']) {
      assert.ok(shown[stage].includes(marker), `${stage} shows ${marker}`);
    }
  }
  assert.ok(shown.understand.includes(`提问：${INPUT.question}`), 'the understand input carries the question');
  assert.ok(shown.claims.includes('entryId 必须填：'), 'each claim input names the entry it must cite');
}

// 3. A crisis stops the reading, and the stop is shown on every later node.
{
  const llm = createMockLLM({
    understand: () => json({
      restated: 'x', category: 'x', subject: 'self', askerGender: 'unknown', askingForSelf: true,
      premises: [], factorsToCheck: [], wantsTiming: false, tone: 'x', psychology: 'x',
      risk: 'crisis', needs: { recastNotice: false, clarify: [] }
    })
  });
  const { state, shown } = await chain(INPUT, { mode: 'mock', llm });
  assert.equal(state.stop.stage, 'understand');
  assert.equal(state.stop.reason, 'crisis');
  assert.equal(state.result, undefined, 'no reading is written after a crisis');
  const after = await runStage('packet', state, { mode: 'mock', llm });
  assert.ok(after.display.includes('上一站停止'), 'a later node says it did not run');
  assert.equal(after.state.packetText, undefined);
  assert.ok(shown.understand.includes('危机'), 'the understand node says why it stopped');
}

// 4. Output that never parses stops at understand, and both attempts are shown.
{
  const llm = createMockLLM({ understand: () => 'not json at all' });
  const out = await runStage('understand', INPUT, { mode: 'mock', llm });
  assert.equal(out.state.stop.stage, 'understand');
  const attempts = (out.display.match(/第 \d 次调用/g) || []).length;
  assert.equal(attempts, 2, 'the model is asked again once, and the second try is shown');
  assert.ok(out.display.includes('不合格'), 'the verdict says it was rejected');
}

// 5. openrouter without a key is an error, not a silent demo.
{
  const saved = process.env.OPENROUTER_API_KEY;
  delete process.env.OPENROUTER_API_KEY;
  await assert.rejects(runStage('understand', INPUT, { mode: 'openrouter' }), /OPENROUTER_API_KEY/);
  if (saved !== undefined) process.env.OPENROUTER_API_KEY = saved;
}

// 6. Unknown stage and empty question are errors.
{
  await assert.rejects(runStage('nonsense', {}, {}), /未知的阶段/);
  await assert.rejects(runStage('cast', { question: '  ' }, {}), /问题不能为空/);
}

console.log('comfy-bridge: ok — chain equals runReading (answer, 用神, packet, entries, claims); every model stage shows prompt/input/output/verdict; crisis and parse failure stop visibly; missing key is an error');
