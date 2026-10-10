/* The reading stages, one function each. run.js composes them; the ComfyUI
   bridge (comfy/bridge.mjs) calls them one at a time so each can be seen.
   Nothing here decides a reading by itself: the model stages return JSON, the
   program checks it against contracts.js and keeps or drops what it returns.

   Every model call is recorded in `calls` as
     { stage, attempt, system, user, raw, errors }
   so a caller can show the prompt, the input and the output of each call. */
import { buildPacket } from '../packet.js';
import { renderPacket } from '../render.js';
import { ledger, retrieve, validateEntry } from '../retrieve.js';
import { checkSpec } from '../validate.js';
import { yongFor } from './subjects.js';
import { UNDERSTAND_SPEC, CLAIM_SPEC, SYNTH_SPEC } from './contracts.js';
import { understandPrompt, claimPrompt, synthPrompt } from './prompts.js';
import { parseJSONText } from './llm.js';

export class PipelineError extends Error {
  constructor(stage, detail) {
    super(`${stage}: ${detail}`);
    this.stage = stage;
    this.detail = detail;
  }
}

export const NOTICE = {
  ONE_CAST: '一事一卦（增删卜易序）：“只不可心怀两事而占，一念之诚则应，若连占两三事者，则不灵也。” 卦恍惚者次日再卜；急事可连占。',
  RECAST: '同一件事今日已经起过卦。书云当次日再卜；本次结论以首次起卦为准，不得因再起的卦改口。',
  NO_MATCH: '知识库中没有与本卦匹配的断语。只能陈述盘面事实；不得引用书中断语；任何推断须标明为推断。',
  FOLLOW_UP: '追问沿用同一卦，不重新起卦。'
};

/* Asks a model for JSON that matches `spec`. Asked again once with the reason.
   Returns { ok, value, errors }; the caller decides whether a failure stops. */
export async function askJSON({ llm, role, prompt, spec, calls, attempts = 2 }) {
  let last = null;
  let user = prompt.user;
  for (let i = 1; i <= attempts; i++) {
    const raw = await llm.complete({ role, system: prompt.system, user });
    const parsed = parseJSONText(raw);
    const errors = parsed.ok ? checkSpec(parsed.value, spec, role) : [parsed.error];
    calls.push({ stage: role, attempt: i, system: prompt.system, user, raw, errors });
    if (errors.length === 0) return { ok: true, value: parsed.value, errors: [] };
    last = errors;
    user = `${prompt.user}\n\n上一次输出不合格：${errors.slice(0, 5).join('；')}。请只输出符合要求的 JSON。`;
  }
  return { ok: false, value: null, errors: last };
}

/* Notices that depend only on how the reading was asked. */
export function startNotices({ followUp = false, priorCastings = 0 } = {}) {
  const notices = [];
  if (followUp) notices.push(NOTICE.FOLLOW_UP);
  if (priorCastings > 0 && !followUp) notices.push(NOTICE.ONE_CAST);
  return notices;
}

export function understandStage({ llm, question, previousAnswer = null, calls }) {
  return askJSON({
    llm, role: 'understand', spec: UNDERSTAND_SPEC, calls,
    prompt: understandPrompt({ question, previousAnswer })
  });
}

/* Program: who the question is about → 用神, and whether the reading can go on. */
export function yongStage({ understanding }) {
  const yong = yongFor(understanding.subject, understanding.askerGender);
  const questions = [yong.clarify, ...understanding.needs.clarify].filter(Boolean);
  return { yong, clarify: yong.clarify || understanding.needs.clarify.length > 0, questions };
}

/* Program: packet with the 用神, and the tokens that retrieval will match on. */
export function packetStage({ casting, understanding, yong }) {
  const packet = buildPacket(casting.board, { yongKey: yong.key });
  const rendered = renderPacket(packet);
  const tokens = [...packet.tokens, `subject:${understanding.subject}`];
  return { packet, rendered, tokens };
}

/* Program: exact retrieval. Returns the matches and the ledger of every token. */
export function retrieveStage({ tokens, corpus, maxEntries = 12 }) {
  const matched = retrieve(tokens, corpus, { limit: maxEntries });
  const coverage = ledger(tokens, corpus);
  return { matched, coverage };
}

/* One claim model call per matched entry, a few at a time. A claim is dropped
   by the program if its entry is bad, if it cites another entry, or if a line
   is out of range. Results are returned in the order of the matches. */
export async function claimsStage({ llm, matched, packetText, understanding, concurrency = 4 }) {
  const entries = matched.map((m) => m.entry);
  const perEntry = new Array(entries.length);
  for (let i = 0; i < entries.length; i += concurrency) {
    const batch = entries.slice(i, i + concurrency);
    await Promise.all(batch.map(async (entry, k) => {
      const idx = i + k;
      const calls = [];
      const bad = validateEntry(entry);
      if (bad.length) {
        perEntry[idx] = { calls, rejected: { entryId: entry.id, reason: `条目不合格：${bad.join('；')}` } };
        return;
      }
      const r = await askJSON({
        llm, role: 'claim', spec: CLAIM_SPEC, calls,
        prompt: claimPrompt({ entry, packetText, understanding })
      });
      if (!r.ok) throw new PipelineError('claim', r.errors.join('；'));
      const c = r.value;
      if (c.entryId !== entry.id) {
        perEntry[idx] = { calls, rejected: { entryId: entry.id, reason: `论断引用了未给出的条目 ${c.entryId}` } };
        return;
      }
      const badLines = c.lines.filter((n) => !Number.isInteger(n) || n < 1 || n > 6);
      if (badLines.length) {
        perEntry[idx] = { calls, rejected: { entryId: entry.id, reason: `爻位越界：${badLines.join('、')}` } };
        return;
      }
      perEntry[idx] = { calls, claim: c };
    }));
  }
  const claims = [];
  const rejected = [];
  const calls = [];
  for (const r of perEntry) {
    calls.push(...r.calls);
    if (r.claim) claims.push(r.claim);
    if (r.rejected) rejected.push(r.rejected);
  }
  return { claims, rejected, calls };
}

export function synthStage({ llm, question, understanding, claims, packetText, notices, matched, coverage, rejected, calls }) {
  return askJSON({
    llm, role: 'synth', spec: SYNTH_SPEC, calls,
    prompt: synthPrompt({
      question, understanding, claims, packetText, notices,
      retrieved: matched, coverage, rejected
    })
  });
}
