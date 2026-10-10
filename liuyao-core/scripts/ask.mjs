#!/usr/bin/env node
/* Ask a question locally, and watch every stage.

     npm run ask                                  interactive: type a question, read the reading
     node scripts/ask.mjs --question "求财能不能成" --throws 1,2,3,0,3,2
     node scripts/ask.mjs --question "…" --mock   demonstration model, no network

   Model mode:
     --mock             stand-in model; placeholder answers, labelled （演示）
     --real             OpenRouter; needs OPENROUTER_API_KEY and LIUYAO_MODEL_UNDERSTAND,
                        LIUYAO_MODEL_CLAIM, LIUYAO_MODEL_SYNTH
     (neither)          --real if OPENROUTER_API_KEY is set, otherwise --mock

   Settings can live in liuyao-core/.env (read at start; existing variables win).

   --throws   six back counts, first line first (0 交 1 单 2 拆 3 重). Omit for a random casting.
   --date     YYYY-MM-DD. Omit for today.

   Each run is printed and also saved to out/reading-<time>.txt, with every model
   prompt, input and output, so the whole chain can be read afterwards.
   The stages are the same ones the ComfyUI nodes call (comfy/bridge.mjs).
*/
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { parseArgs } from 'node:util';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ENTRIES } from '../src/corpus.js';
import { runStage } from '../comfy/bridge.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ENV_FILE = resolve(ROOT, '.env');
if (existsSync(ENV_FILE) && typeof process.loadEnvFile === 'function') process.loadEnvFile(ENV_FILE);

const { values: args } = parseArgs({
  options: {
    question: { type: 'string' },
    throws: { type: 'string' },
    date: { type: 'string' },
    mock: { type: 'boolean' },
    real: { type: 'boolean' },
    help: { type: 'boolean', short: 'h' }
  },
  strict: true
});

if (args.help) {
  console.log('usage: node scripts/ask.mjs [--question "…"] [--throws 1,2,3,0,3,2] [--date YYYY-MM-DD] [--mock | --real]');
  process.exit(0);
}
if (args.mock && args.real) {
  console.error('--mock and --real cannot both be given');
  process.exit(2);
}

function configFromEnv() {
  const real = args.real || (!args.mock && Boolean(process.env.OPENROUTER_API_KEY));
  return {
    mode: real ? 'openrouter' : 'mock',
    model_understand: process.env.LIUYAO_MODEL_UNDERSTAND || '',
    model_claim: process.env.LIUYAO_MODEL_CLAIM || '',
    model_synth: process.env.LIUYAO_MODEL_SYNTH || ''
  };
}

const config = configFromEnv();
const chapters = new Set(ENTRIES.map((e) => e.source.chapter)).size;
const banner = config.mode === 'mock'
  ? '模式：演示（mock）。模型输出是占位文字，不是解读。'
  : `模式：真模型（openrouter）。理解=${config.model_understand}　断法=${config.model_claim}　综合=${config.model_synth}`;
console.log(`六爻 · 本地运行\n${banner}\n知识库：${ENTRIES.length} 条，来自 ${chapters} 章\n`);

mkdirSync(resolve(ROOT, 'out'), { recursive: true });
const outFile = resolve(ROOT, 'out', `reading-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`);
const saved = [];

/* Runs every stage on one question and prints each display as it comes. */
async function ask(question) {
  let state = { question, throws: args.throws || '', date: args.date || '' };
  const stages = ['cast', 'understand', 'packet', 'retrieve', 'claims', 'synth'];
  for (const stage of stages) {
    const label = stage;
    let out;
    try {
      out = await runStage(stage, state, config);
    } catch (e) {
      const msg = `【${label}】出错：${e.message}`;
      console.log(`\n${msg}`);
      saved.push(msg);
      process.exitCode = 1;
      break;
    }
    console.log(`\n${out.display}`);
    saved.push(out.display);
    state = out.state;
    if (state.stop) {
      console.log(`\n【停止】${state.stop.stage} · ${state.stop.reason}`);
      break;
    }
  }
  const header = `问题：${question}\n${'='.repeat(60)}`;
  saved.push('');
  writeFileSync(outFile, [header, ...saved].join('\n\n') + '\n');
  console.log(`\n已保存：${outFile}`);
}

if (args.question) {
  await ask(args.question.trim());
} else {
  const rl = createInterface({ input: process.stdin });
  const prompt = '问题（空行退出）> ';
  process.stdout.write(prompt);
  for await (const line of rl) {
    const q = line.trim();
    if (!q) break;
    saved.length = 0;
    await ask(q);
    process.stdout.write(`\n${prompt}`);
  }
  rl.close();
}
