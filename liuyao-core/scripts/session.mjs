#!/usr/bin/env node
/* Run a reading inside a Claude Code session, with the session's own model.

   No API key and no network. The program runs every stage it can. At each model
   stage it writes the prompt it would send to <dir>/pending.json and stops there.
   The session model reads those prompts, writes the replies to <dir>/replies.json
   (id → the raw text the model would return), and the program is run again.
   Each run starts from the same casting, so nothing is cast twice.

     node scripts/session.mjs start --question "…" [--throws 1,2,3,0,3,2] [--date YYYY-MM-DD]
         → creates out/session/<time>/, casts once, prints the directory, runs to the first pause
     node scripts/session.mjs step <dir>
         → runs again with the replies on file; prints what is still pending, or the reading
     node scripts/session.mjs follow <dir> --question "…"
         → a follow-up on the same casting (same lines, same board); needs a finished reading in <dir>.
           It answers the same level in more detail. A new level needs a new casting (start).

   Replies are keyed by the id shown in pending.json. A reply is used exactly as written,
   and the contracts (src/pipeline/contracts.js) still check it: a bad reply is asked again
   once and then stops the stage visibly, as it does for any other model.
*/
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { runStage } from '../comfy/bridge.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const STAGES = ['understand', 'packet', 'retrieve', 'claims', 'synth'];

export function idOf({ role, system, user }) {
  return createHash('sha256').update(`${role}\n${system}\n${user}`).digest('hex').slice(0, 12);
}

/* The model, as far as the stages can tell: a reply on file, or a pause. */
export function sessionLLM(replies, pending) {
  return {
    async complete({ role, system, user }) {
      const id = idOf({ role, system, user });
      if (Object.prototype.hasOwnProperty.call(replies, id)) return replies[id];
      pending.push({ id, role, system, user });
      const e = new Error(`awaiting reply ${id}`);
      e.awaiting = true;
      throw e;
    }
  };
}

const read = (p, fallback) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : fallback);

/* One pass over the stages with the replies on file. */
export async function step(dir) {
  const init = read(resolve(dir, 'init.json'), null);
  if (!init) throw new Error(`${dir} has no init.json: start a reading first`);
  const replies = read(resolve(dir, 'replies.json'), {});
  const pending = [];
  // concurrency is unbounded so every claim prompt is asked in the same pass.
  const config = { mode: 'session', llm: sessionLLM(replies, pending), concurrency: 1000000 };
  let state = init.state;
  const displays = [];
  for (const stage of STAGES) {
    let out;
    try {
      out = await runStage(stage, state, config);
    } catch (e) {
      if (e.awaiting) break;
      throw e;
    }
    displays.push(out.display);
    state = out.state;
    if (state.stop) break;
  }
  if (pending.length) {
    writeFileSync(resolve(dir, 'pending.json'), JSON.stringify(pending, null, 2) + '\n');
    return { status: 'awaiting', pending, displays };
  }
  return { status: 'done', state, displays };
}

export async function start({ question, throws, date, dir }) {
  const config = { mode: 'mock' }; // the cast stage asks no model
  const out = await runStage('cast', { question, throws: throws || '', date: date || '' }, config);
  mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, 'init.json'), JSON.stringify({ state: out.state }, null, 2) + '\n');
  return out.display;
}

export async function follow({ dir, question, newDir }) {
  const prev = read(resolve(dir, 'init.json'), null);
  const prevResult = read(resolve(dir, 'result.json'), null);
  if (!prev) throw new Error(`${dir} has no init.json`);
  if (!prevResult) throw new Error(`${dir} has no finished reading yet (result.json): finish it before following up`);
  // Same casting, same lines. Only the question and the earlier answer change.
  const state = { ...prev.state, question, previousAnswer: prevResult.answer, notices: [], scope: undefined };
  mkdirSync(newDir, { recursive: true });
  writeFileSync(resolve(newDir, 'init.json'), JSON.stringify({ state, followOf: dir }, null, 2) + '\n');
  return newDir;
}

function report(dir, result) {
  if (result.status === 'awaiting') {
    console.log(`待回答：${result.pending.length} 条（提示词已写入 ${resolve(dir, 'pending.json')}）`);
    const byRole = result.pending.reduce((m, p) => ({ ...m, [p.role]: (m[p.role] || 0) + 1 }), {});
    console.log(`  ${Object.entries(byRole).map(([r, n]) => `${r} ×${n}`).join('　')}`);
    console.log(`  前面已完成的站：\n${result.displays.map((d) => d.split('\n')[0]).join('\n')}`);
    return;
  }
  const text = result.displays.join('\n\n').split('<本次目录>').join(dir);
  writeFileSync(resolve(dir, 'reading.txt'), text + '\n');
  writeFileSync(resolve(dir, 'result.json'), JSON.stringify(result.state.result, null, 2) + '\n');
  console.log(text);
  console.log(`\n已保存：${resolve(dir, 'reading.txt')}`);
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      question: { type: 'string' },
      throws: { type: 'string' },
      date: { type: 'string' },
      dir: { type: 'string' }
    },
    strict: true
  });
  const cmd = positionals[0];
  if (cmd === 'start') {
    if (!values.question) throw new Error('start 需要 --question');
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const dir = values.dir ? resolve(values.dir) : resolve(ROOT, 'out', 'session', stamp);
    const castText = await start({ question: values.question, throws: values.throws, date: values.date, dir });
    console.log(`目录：${dir}\n\n${castText}\n`);
    report(dir, await step(dir));
  } else if (cmd === 'follow') {
    if (!values.question) throw new Error('follow 需要 --question');
    const from = resolve(positionals[1] || '');
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const newDir = resolve(ROOT, 'out', 'session', `${stamp}-follow`);
    await follow({ dir: from, question: values.question, newDir });
    console.log(`追问目录：${newDir}（同一卦，同一组爻）\n`);
    report(newDir, await step(newDir));
  } else if (cmd === 'step') {
    const dir = resolve(positionals[1] || '');
    report(dir, await step(dir));
  } else {
    console.log('usage: node scripts/session.mjs start --question "…" [--throws …] [--date …]\n       node scripts/session.mjs step <dir>');
    process.exitCode = 2;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
}
