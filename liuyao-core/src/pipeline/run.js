/* The reading pipeline.
   ────────────────────────────────────────────────────────────────────────
   Order, as the owner set it: the program gathers everything about the casting
   first; the models then work in turn.

     0. casting   program   six lines → board → packet → packet text (src/)
     1. understand model    what the person asks; subject; premises; risk
     2. yong      program   subject → 用神 line (subjects.js, 用神章)
                  program   packet with that 用神; retrieve book entries whose
                            tokens the casting carries (3-lock: step + board + entry)
     3. claim     model ×N  one per matched entry: apply the book's sentence to
                            this casting and to the person's situation.
                            Claims citing an entry that was not given, or a line
                            outside 1–6, are dropped by the program.
     4. synth     model     check the answer, its logic and confidence; write it

   Models never see the raw board. They see the packet text, which says every
   fact the program computed and names the chapter each fact comes from.
*/
import { buildPacket } from '../packet.js';
import { renderPacket } from '../render.js';
import { ledger, retrieve, validateEntry } from '../retrieve.js';
import { ENTRIES as DEFAULT_CORPUS } from '../corpus.js';
import { checkSpec } from '../validate.js';
import { yongFor } from './subjects.js';
import { UNDERSTAND_SPEC, CLAIM_SPEC, SYNTH_SPEC } from './contracts.js';
import { understandPrompt, claimPrompt, synthPrompt } from './prompts.js';
import { parseJSONText } from './llm.js';

export const NOTICE = {
  ONE_CAST: '一事一卦（增删卜易序）：“只不可心怀两事而占，一念之诚则应，若连占两三事者，则不灵也。” 卦恍惚者次日再卜；急事可连占。',
  RECAST: '同一件事今日已经起过卦。书云当次日再卜；本次结论以首次起卦为准，不得因再起的卦改口。',
  NO_MATCH: '知识库中没有与本卦匹配的断语。只能陈述盘面事实；不得引用书中断语；任何推断须标明为推断。',
  FOLLOW_UP: '追问沿用同一卦，不重新起卦。'
};

export class PipelineError extends Error {
  constructor(stage, detail) {
    super(`${stage}: ${detail}`);
    this.stage = stage;
    this.detail = detail;
  }
}

/* One model stage, parsed and checked. Asked again once with the reason. */
async function askJSON({ llm, role, prompt, spec, trace, attempts = 2 }) {
  let last = null;
  let user = prompt.user;
  for (let i = 1; i <= attempts; i++) {
    const text = await llm.complete({ role, system: prompt.system, user });
    trace.push({ stage: role, attempt: i });
    const parsed = parseJSONText(text);
    const errors = parsed.ok ? checkSpec(parsed.value, spec, role) : [parsed.error];
    if (errors.length === 0) return parsed.value;
    last = errors;
    user = `${prompt.user}\n\n上一次输出不合格：${errors.slice(0, 5).join('；')}。请只输出符合要求的 JSON。`;
  }
  throw new PipelineError(role, last.join('；'));
}

function halted(reason, extra) {
  return { status: reason, ...extra };
}

/* Runs one reading on a casting. `casting` is what castRandom/castWithBacks
   returns. Follow-ups pass the earlier result's casting, so the same lines are
   read again and nothing is cast twice. */
export async function runReading({
  question, casting, llm, corpus = DEFAULT_CORPUS, options = {}
}) {
  const trace = [];
  const notices = [];
  const maxEntries = options.maxEntries ?? 12;
  const concurrency = options.concurrency ?? 4;

  if (options.followUp) notices.push(NOTICE.FOLLOW_UP);
  if (options.priorCastings > 0 && !options.followUp) notices.push(NOTICE.ONE_CAST);

  // 1 · understand
  const understanding = await askJSON({
    llm, role: 'understand', spec: UNDERSTAND_SPEC, trace,
    prompt: understandPrompt({ question, previousAnswer: options.previousAnswer || null })
  });
  if (understanding.risk === 'crisis') {
    return halted('halted', { reason: 'crisis', understanding, trace, notices });
  }
  if (understanding.needs.recastNotice) notices.push(NOTICE.RECAST);

  // 2 · program: 用神, packet, retrieval
  const yong = yongFor(understanding.subject, understanding.askerGender);
  if (yong.clarify || understanding.needs.clarify.length) {
    return halted('needs_clarification', {
      questions: [yong.clarify, ...understanding.needs.clarify].filter(Boolean),
      understanding, trace, notices
    });
  }
  const packet = buildPacket(casting.board, { yongKey: yong.key });
  const rendered = renderPacket(packet);
  const tokens = [...packet.tokens, `subject:${understanding.subject}`];
  const matched = retrieve(tokens, corpus, { limit: maxEntries });
  const coverage = ledger(tokens, corpus);
  if (matched.length === 0) notices.push(NOTICE.NO_MATCH);

  // 3 · claim, one model call per matched entry
  const claims = [];
  const rejected = [];
  const entries = matched.map((m) => m.entry);
  for (let i = 0; i < entries.length; i += concurrency) {
    const batch = entries.slice(i, i + concurrency);
    const results = await Promise.all(batch.map(async (entry) => {
      const bad = validateEntry(entry);
      if (bad.length) return { rejected: { entryId: entry.id, reason: `条目不合格：${bad.join('；')}` } };
      const c = await askJSON({
        llm, role: 'claim', spec: CLAIM_SPEC, trace,
        prompt: claimPrompt({ entry, packetText: rendered.text, understanding })
      });
      if (c.entryId !== entry.id) {
        return { rejected: { entryId: entry.id, reason: `论断引用了未给出的条目 ${c.entryId}` } };
      }
      const badLines = c.lines.filter((n) => !Number.isInteger(n) || n < 1 || n > 6);
      if (badLines.length) {
        return { rejected: { entryId: entry.id, reason: `爻位越界：${badLines.join('、')}` } };
      }
      return { claim: c };
    }));
    for (const r of results) {
      if (r.claim) claims.push(r.claim);
      if (r.rejected) rejected.push(r.rejected);
    }
  }

  // 4 · synth
  const synthesis = await askJSON({
    llm, role: 'synth', spec: SYNTH_SPEC, trace,
    prompt: synthPrompt({
      question, understanding, claims, packetText: rendered.text,
      notices, retrieved: matched, coverage, rejected
    })
  });

  return {
    status: synthesis.answered ? 'answered' : 'partial',
    question,
    understanding,
    yong: { key: yong.key, source: yong.source },
    casting: { backs: casting.backs, moving: casting.moving, date: casting.date, board: casting.board },
    packet,
    packetText: rendered.text,
    retrieved: matched.map((m) => ({ id: m.entry.id, matched: m.matched })),
    coverage,
    claims,
    rejected,
    synthesis,
    notices,
    trace
  };
}

/* A follow-up on the same casting. The earlier result carries its casting, so
   no new lines are cast; the earlier answer is handed to the understanding stage. */
export function runFollowUp({ question, previous, llm, corpus, options = {} }) {
  if (!previous || !previous.casting || !previous.casting.board) {
    throw new Error('follow-up needs the previous reading, with its casting');
  }
  return runReading({
    question,
    casting: previous.casting,
    llm,
    corpus,
    options: { ...options, followUp: true, previousAnswer: previous.synthesis.answer }
  });
}
