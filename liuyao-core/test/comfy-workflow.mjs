/**
 * COMFY WORKFLOW CONTRACT — the saved graph is wired the way the pipeline runs
 *
 * What it checks, on comfy/liuyao-reading.json:
 *   · the file is what build_workflow.py produces (no hand edits drift away);
 *   · every node type is a class the Python package registers;
 *   · every link is recorded on both ends, with matching types, and every
 *     socket is connected;
 *   · the graph, run in order through the bridge, gives the same reading as
 *     runReading: wiring mistakes (say, config into the state socket) fail here.
 * Run: node test/comfy-workflow.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { castWithBacks } from '../src/casting.js';
import { runReading } from '../src/pipeline/run.js';
import { createDemoLLM } from '../src/pipeline/llm.js';
import { runStage } from '../comfy/bridge.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const COMFY = resolve(ROOT, 'comfy');
const wf = JSON.parse(readFileSync(resolve(COMFY, 'liuyao-reading.json'), 'utf8'));

// 1. The committed file is the generated one.
{
  const gen = spawnSync('python3', [resolve(COMFY, 'build_workflow.py')], { encoding: 'utf8' });
  assert.equal(gen.status, 0, gen.stderr);
  assert.equal(gen.stdout, readFileSync(resolve(COMFY, 'liuyao-reading.json'), 'utf8'),
    'comfy/liuyao-reading.json is stale: run python3 comfy/build_workflow.py > comfy/liuyao-reading.json');
}

// 2. Every node type is registered by the Python package.
const py = readFileSync(resolve(COMFY, 'comfyui-liuyao', 'nodes.py'), 'utf8');
const registered = new Set([...py.matchAll(/^\s+"(Liuyao\w+)":\s+Liuyao\w+,/gm)].map((m) => m[1]));
assert.ok(registered.size >= 7, `the package registers the nodes (found ${registered.size})`);
for (const n of wf.nodes) assert.ok(registered.has(n.type), `${n.type} is registered`);

// 3. Links are recorded on both ends, typed, and every socket is connected.
const byId = new Map(wf.nodes.map((n) => [n.id, n]));
assert.equal(wf.last_link_id, wf.links.length, 'last_link_id counts the links');
for (const [lid, o, os, t, ts, type] of wf.links) {
  const origin = byId.get(o);
  const target = byId.get(t);
  assert.ok(origin && target, `link ${lid} joins two nodes`);
  assert.ok(origin.outputs[os].links.includes(lid), `link ${lid} is listed on its origin`);
  assert.equal(target.inputs[ts].link, lid, `link ${lid} is listed on its target`);
  assert.equal(origin.outputs[os].type, type, `link ${lid} type matches the origin`);
  assert.equal(target.inputs[ts].type, type, `link ${lid} type matches the target`);
}
for (const n of wf.nodes) {
  for (const inp of n.inputs) assert.notEqual(inp.link, null, `${n.type}.${inp.name} is connected`);
}

// 4. Run the graph in node order through the bridge; the result is the pipeline's.
{
  const linkInto = (node, slot) => wf.links.find(([, , , t, ts]) => t === node.id && ts === slot);
  const outputOf = new Map(); // node id → { state, config }
  const cfgNode = wf.nodes.find((n) => n.type === 'LiuyaoConfig');
  const [mode, mu, mc, ms] = cfgNode.widgets_values;
  const config = { mode, model_understand: mu, model_claim: mc, model_synth: ms, llm: createDemoLLM() };
  // The config node's output travels as text in ComfyUI; here the test keeps the object so the scripted model survives.
  outputOf.set(cfgNode.id, { config });

  const stageOf = { LiuyaoCast: 'cast', LiuyaoUnderstand: 'understand', LiuyaoPacket: 'packet',
    LiuyaoRetrieve: 'retrieve', LiuyaoClaims: 'claims', LiuyaoSynth: 'synth' };
  let final = null;
  for (const n of wf.nodes.filter((x) => x.type !== 'LiuyaoConfig').sort((a, b) => a.id - b.id)) {
    let state;
    if (n.type === 'LiuyaoCast') {
      const [question, throws, date] = n.widgets_values;
      state = { question, throws, date };
    } else {
      const link = linkInto(n, 0);
      assert.ok(link, `${n.type} has a state input`);
      state = JSON.parse(outputOf.get(link[1]).state);
    }
    let cfg = {};
    if (n.inputs.some((i) => i.name === 'config')) {
      const link = linkInto(n, 1);
      cfg = outputOf.get(link[1]).config;
      assert.equal(link[1], cfgNode.id, `${n.type} takes its config from the config node`);
    }
    const out = await runStage(stageOf[n.type], state, cfg);
    assert.equal(out.error, undefined, `${n.type}: ${out.error}`);
    outputOf.set(n.id, { state: JSON.stringify(out.state) });
    final = out;
  }
  assert.ok(final.state.result, 'the graph ends with a reading');

  const casting = castWithBacks([1, 2, 3, 0, 3, 2], new Date('2026-10-08T10:00:00'));
  const r = await runReading({ question: wf.nodes[1].widgets_values[0], casting, llm: createDemoLLM() });
  assert.equal(final.state.result.answer, r.synthesis.answer, 'the graph gives the pipeline\'s answer');
}

console.log(`comfy-workflow: ok — ${wf.nodes.length} nodes, ${wf.links.length} links; file matches build_workflow.py; graph run in order equals runReading`);
