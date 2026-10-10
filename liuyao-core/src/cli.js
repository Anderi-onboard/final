#!/usr/bin/env node
/* Command line: cast, read, print every stage.
     node src/cli.js --question "这个月的求财能不能成" [--throws 1,2,3,0,3,2] [--date 2026-10-08] [--mock]

   --throws   the six throws as back counts (0–3, first throw first). Omit to cast
              with the server-grade random source.
   --mock     run with a stand-in model that returns fixed answers. Its output is
              a placeholder, not a reading. Without --mock, OPENROUTER_API_KEY and
              LIUYAO_MODEL_UNDERSTAND / _CLAIM / _SYNTH must be set.
*/
import { castRandom, castWithBacks } from './casting.js';
import { runReading, PipelineError } from './pipeline/run.js';
import { createDemoLLM, createOpenRouterLLM } from './pipeline/llm.js';

function args(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) out[key] = true;
    else { out[key] = next; i++; }
  }
  return out;
}

function realLLM() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not set (use --mock to run without a model)');
  const models = {
    understand: process.env.LIUYAO_MODEL_UNDERSTAND,
    claim: process.env.LIUYAO_MODEL_CLAIM,
    synth: process.env.LIUYAO_MODEL_SYNTH
  };
  return createOpenRouterLLM({ apiKey, models });
}

async function main() {
  const a = args(process.argv.slice(2));
  if (!a.question) {
    console.error('usage: node src/cli.js --question "…" [--throws 1,2,3,0,3,2] [--date YYYY-MM-DD] [--mock]');
    process.exit(2);
  }
  const date = a.date ? new Date(`${a.date}T10:00:00`) : new Date();
  const casting = a.throws
    ? castWithBacks(String(a.throws).split(',').map(Number), date)
    : castRandom(date);
  const llm = a.mock ? createDemoLLM() : realLLM();
  const result = await runReading({ question: a.question, casting, llm, options: {} });

  console.log(`起卦：${casting.lines.map((l) => `${l.name}${l.yang ? '阳' : '阴'}${l.changing ? '动' : ''}`).join(' ')}`);
  console.log(`状态：${result.status}${result.reason ? '（' + result.reason + '）' : ''}`);
  if (result.questions) console.log(`需要先问：${result.questions.join('；')}`);
  if (result.packetText) console.log('\n' + result.packetText);
  if (result.notices && result.notices.length) console.log('\n程序提示：\n- ' + result.notices.join('\n- '));
  if (result.synthesis) {
    console.log(`\n回答（置信 ${result.synthesis.confidence}）：\n${result.synthesis.answer}`);
  }
  if (result.trace) console.log(`\n模型调用：${result.trace.map((t) => `${t.stage}#${t.attempt}`).join(' → ')}`);
}

main().catch((e) => {
  if (e instanceof PipelineError) console.error(`流水线停在 ${e.stage}：${e.detail}`);
  else console.error(e.message);
  process.exit(1);
});
