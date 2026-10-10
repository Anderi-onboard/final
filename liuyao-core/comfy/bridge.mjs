#!/usr/bin/env node
/* The bridge between ComfyUI and the reading pipeline.

   One call = one stage:   stdin  {stage, state, config}
                           stdout {state, display}   or   {error}

   `state` carries everything the later stages need (it is a plain JSON object,
   passed from node to node as text). `display` is the Chinese text the node
   shows: for every model call, the system prompt, the user input, the raw
   output and the program's verdict on it; for every program stage, what it
   decided and why.

   A stage that stopped the reading (crisis, clarification, a model output that
   would not parse) sets state.stop; later stages pass the state through and
   show that they did not run. Nothing is silently skipped.

   The stages are the same functions run.js uses (src/pipeline/stages.js), so
   the bridge cannot drift from the pipeline: comfy-bridge test checks it.

   Run as a script for ComfyUI: node comfy/bridge.mjs < input.json
*/
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { castRandom, castWithBacks } from '../src/casting.js';
import { ENTRIES as CORPUS } from '../src/corpus.js';
import { createDemoLLM, createOpenRouterLLM } from '../src/pipeline/llm.js';
import {
  NOTICE, startNotices, understandStage, yongStage, packetStage,
  retrieveStage, claimsStage, synthStage
} from '../src/pipeline/stages.js';

const BY_ID = new Map(CORPUS.map((e) => [e.id, e]));

/* ── helpers ─────────────────────────────────────────────────────────────── */

function makeLLM(config) {
  // Tests inject a scripted model here. Not reachable from ComfyUI, which only sends JSON.
  if (config.llm) return config.llm;
  if (config.mode === 'mock' || !config.mode) return createDemoLLM();
  if (config.mode !== 'openrouter') throw new Error(`未知的模式：${config.mode}`);
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('mode 为 openrouter，但环境变量 OPENROUTER_API_KEY 未设置。要么设置它，要么把配置节点的 mode 改回 mock');
  }
  return createOpenRouterLLM({
    apiKey,
    models: {
      understand: config.model_understand,
      claim: config.model_claim,
      synth: config.model_synth
    }
  });
}

/* One model call, shown whole: the prompt the model got, what it returned,
   and whether the program accepted it. */
function callBlock(calls) {
  return calls.map((c) => [
    `── ${c.stage} 第 ${c.attempt} 次调用 ──`,
    '=== 系统提示 ===', c.system,
    '=== 用户输入 ===', c.user,
    '=== 模型输出 ===', c.raw,
    '=== 程序判定 ===',
    c.errors.length ? `不合格：${c.errors.join('；')}` : '合格'
  ].join('\n')).join('\n\n');
}

function stopped(state) {
  const s = state.stop;
  return `（上一站停止，本站未运行：${s.stage} · ${s.reason}）`;
}

function passthrough(state) {
  return { state, display: stopped(state) };
}

function stop(state, stage, reason, extra = {}) {
  return { ...state, stop: { stage, reason, ...extra } };
}

const bullets = (xs) => (xs && xs.length ? xs.map((x) => `  · ${x}`).join('\n') : '  （无）');

/* ── stages ──────────────────────────────────────────────────────────────── */

export function cast(state) {
  const question = String(state.question || '').trim();
  if (!question) throw new Error('问题不能为空');
  const date = state.date ? new Date(`${state.date}T10:00:00`) : new Date();
  if (Number.isNaN(date.getTime())) throw new Error(`日期无法解析：${state.date}`);
  const backs = String(state.throws || '').trim();
  const casting = backs
    ? castWithBacks(backs.split(',').map((n) => Number(n.trim())), date)
    : castRandom(date);
  const lines = casting.lines.map((l) => `  ${l.name}${l.yang ? '阳' : '阴'}${l.changing ? '（动）' : ''}`).join('\n');
  const out = {
    ...state,
    question,
    casting,
    notices: startNotices({ followUp: false, priorCastings: 0 })
  };
  const display = [
    '━━ 1 · 起卦（程序）━━',
    `问题：${question}`,
    `时间：${date.toISOString().slice(0, 10)}`,
    `三钱六爻（由初至上）：\n${lines}`,
    `本卦：${casting.board.ben.name}　${casting.board.bian ? `之变卦：${casting.board.bian.name}` : '（无动爻）'}`
  ].join('\n');
  return { state: out, display };
}

export async function understand(state, config) {
  if (state.stop) return passthrough(state);
  const llm = makeLLM(config);
  const calls = [];
  const u = await understandStage({ llm, question: state.question, calls });
  const head = `━━ 2 · 理解问题（模型）━━\n${callBlock(calls)}`;
  if (!u.ok) {
    const s = stop(state, 'understand', u.errors.join('；'));
    return { state: s, display: `${head}\n\n停止：模型两次输出都不合格。` };
  }
  const v = u.value;
  const next = { ...state, understanding: v };
  if (v.needs.recastNotice) next.notices = [...(state.notices || []), NOTICE.RECAST];
  if (v.risk === 'crisis') {
    return { state: stop(next, 'understand', 'crisis'), display: `${head}\n\n停止：判为危机，只给资源，不给解读。` };
  }
  const summary = [
    '\n━━ 2 · 理解结果（程序读取）━━',
    `需求：${v.restated}`,
    `门类：${v.category}　对象：${v.subject}　提问人性别：${v.askerGender}　${v.askingForSelf ? '自占' : '代占'}`,
    `是否问应期：${v.wantsTiming ? '是' : '否'}　风险：${v.risk}`,
    `前提（问题带来，盘不能证实）：\n${bullets(v.premises)}`,
    `可能涉及的因素：\n${bullets(v.factorsToCheck)}`,
    `程序需要追问：\n${bullets(v.needs.clarify)}`
  ].join('\n');
  return { state: next, display: `${head}${summary}` };
}

export function packet(state) {
  if (state.stop) return passthrough(state);
  const y = yongStage({ understanding: state.understanding });
  if (y.clarify) {
    const s = stop(state, 'packet', 'needs_clarification', { questions: y.questions });
    return { state: s, display: `━━ 3 · 用神与排盘（程序）━━\n需要先问：\n${bullets(y.questions)}` };
  }
  const { packet: pk, rendered, tokens } = packetStage({
    casting: state.casting, understanding: state.understanding, yong: y.yong
  });
  const next = { ...state, yong: y.yong, packetText: rendered.text, tokens };
  const display = [
    '━━ 3 · 用神与排盘（程序）━━',
    `用神：${y.yong.key}　依据：${y.yong.source}`,
    `输入给模型的盘面（程序写的全部事实）：\n${rendered.text}`,
    `检索用的标记（${tokens.length} 个）：\n  ${tokens.join('  ')}`
  ].join('\n\n');
  return { state: next, display };
}

export function retrieve(state) {
  if (state.stop) return passthrough(state);
  const { matched, coverage } = retrieveStage({ tokens: state.tokens, corpus: CORPUS, maxEntries: 12 });
  const notices = [...(state.notices || [])];
  if (matched.length === 0) notices.push(NOTICE.NO_MATCH);
  const next = {
    ...state,
    matchedIds: matched.map((m) => m.entry.id),
    coverage: { placed: Object.keys(coverage.placed).length, unplaced: coverage.unplaced, total: coverage.total },
    notices
  };
  const rows = matched.map((m) => [
    `· ${m.entry.id}　${m.entry.source.book}·${m.entry.source.chapter}`,
    `  原文：${m.entry.text_zh}`,
    `  命中标记：${m.matched.join('  ')}`
  ].join('\n'));
  const display = [
    `━━ 4 · 检索（程序，逐字匹配）━━`,
    `命中 ${matched.length} 条：`,
    rows.length ? rows.join('\n') : '（没有命中）',
    `标记覆盖：${Object.keys(coverage.placed).length} 个有条目，${coverage.unplaced.length} 个未落位（共 ${coverage.total}）`,
    `未落位：${coverage.unplaced.slice(0, 30).join('  ') || '（无）'}`
  ].join('\n');
  return { state: next, display };
}

export async function claims(state, config) {
  if (state.stop) return passthrough(state);
  const llm = makeLLM(config);
  const matched = state.matchedIds.map((id) => ({ entry: BY_ID.get(id) }));
  let r;
  try {
    r = await claimsStage({
      llm, matched, packetText: state.packetText, understanding: state.understanding, concurrency: 4
    });
  } catch (e) {
    return { state: stop(state, 'claim', e.message), display: `━━ 5 · 依书断法（模型）━━\n停止：${e.message}` };
  }
  const verdicts = [
    ...r.claims.map((c) => `  ✓ ${c.entryId}：${c.claim}（爻位 ${c.lines.join('、') || '无'}，置信 ${c.confidence}）`),
    ...r.rejected.map((x) => `  ✗ ${x.entryId}：${x.reason}`)
  ].join('\n');
  const display = [
    `━━ 5 · 依书断法（模型，每条命中条目一次）━━`,
    callBlock(r.calls),
    '━━ 5 · 断法判定（程序）━━',
    `采用 ${r.claims.length} 条，丢弃 ${r.rejected.length} 条：`,
    verdicts || '  （无）'
  ].join('\n\n');
  return { state: { ...state, claims: r.claims, rejected: r.rejected }, display };
}

export async function synth(state, config) {
  if (state.stop) return passthrough(state);
  const llm = makeLLM(config);
  const calls = [];
  const matched = state.matchedIds.map((id) => ({ entry: BY_ID.get(id) }));
  const s = await synthStage({
    llm, question: state.question, understanding: state.understanding,
    claims: state.claims, packetText: state.packetText, notices: state.notices || [],
    matched, coverage: state.coverage, rejected: state.rejected, calls
  });
  const head = `━━ 6 · 综合（模型）━━\n${callBlock(calls)}`;
  if (!s.ok) {
    return { state: stop(state, 'synth', s.errors.join('；')), display: `${head}\n\n停止：模型两次输出都不合格。` };
  }
  const v = s.value;
  const result = {
    status: v.answered ? 'answered' : 'partial',
    answer: v.answer,
    confidence: v.confidence,
    checks: v.checks,
    unansweredParts: v.unansweredParts
  };
  const display = [
    head,
    '━━ 6 · 回答（程序整理）━━',
    `状态：${result.status}　置信：${result.confidence}`,
    `逐项核对：\n${v.checks.map((c) => `  ${c.pass ? '✓' : '✗'} ${c.name}：${c.note}`).join('\n') || '  （无）'}`,
    `未回答的部分：\n${bullets(v.unansweredParts)}`,
    `回答：\n${v.answer}`
  ].join('\n\n');
  return { state: { ...state, result }, display };
}

export const STAGES = { cast, understand, packet, retrieve, claims, synth };

/* One stage, by name. Used by the ComfyUI nodes and by the test. */
export async function runStage(stage, state, config = {}) {
  const fn = STAGES[stage];
  if (!fn) throw new Error(`未知的阶段：${stage}`);
  return fn(state, config);
}

/* ── script entry (ComfyUI calls this through its Python node) ─────────── */

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const input = JSON.parse(readFileSync(0, 'utf8'));
    const out = await runStage(input.stage, input.state || {}, input.config || {});
    process.stdout.write(JSON.stringify(out));
  } catch (e) {
    process.stdout.write(JSON.stringify({ error: e.message }));
  }
}
