/* The reading pipeline, composed from the stages in stages.js.
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
import { ENTRIES as DEFAULT_CORPUS } from '../corpus.js';
import {
  NOTICE, PipelineError, understandStage, yongStage, packetStage,
  retrieveStage, claimsStage, synthStage, startNotices
} from './stages.js';

export { NOTICE, PipelineError };

function halted(reason, extra) {
  return { status: reason, ...extra };
}

/* Runs one reading on a casting. `casting` is what castRandom/castWithBacks
   returns. Follow-ups pass the earlier result's casting, so the same lines are
   read again and nothing is cast twice. */
export async function runReading({
  question, casting, llm, corpus = DEFAULT_CORPUS, options = {}
}) {
  const calls = [];
  const notices = startNotices({ followUp: options.followUp, priorCastings: options.priorCastings });
  const maxEntries = options.maxEntries ?? 12;
  const concurrency = options.concurrency ?? 4;

  // 1 · understand
  const u = await understandStage({
    llm, question, previousAnswer: options.previousAnswer || null, calls
  });
  if (!u.ok) throw new PipelineError('understand', u.errors.join('；'));
  const understanding = u.value;
  if (understanding.risk === 'crisis') {
    return halted('halted', { reason: 'crisis', understanding, trace: calls, notices });
  }
  if (understanding.needs.recastNotice) notices.push(NOTICE.RECAST);

  // 2 · program: 用神, packet, retrieval
  const y = yongStage({ understanding });
  if (y.clarify) {
    return halted('needs_clarification', { questions: y.questions, understanding, trace: calls, notices });
  }
  const { packet, rendered, tokens } = packetStage({ casting, understanding, yong: y.yong });
  const { matched, coverage } = retrieveStage({ tokens, corpus, maxEntries });
  if (matched.length === 0) notices.push(NOTICE.NO_MATCH);

  // 3 · claim, one model call per matched entry
  const { claims, rejected, calls: claimCalls } = await claimsStage({
    llm, matched, packetText: rendered.text, understanding, concurrency
  });
  calls.push(...claimCalls);

  // 4 · synth
  const s = await synthStage({
    llm, question, understanding, claims, packetText: rendered.text,
    notices, matched, coverage, rejected, calls
  });
  if (!s.ok) throw new PipelineError('synth', s.errors.join('；'));
  const synthesis = s.value;

  return {
    status: synthesis.answered ? 'answered' : 'partial',
    question,
    understanding,
    yong: { key: y.yong.key, source: y.yong.source },
    casting: { backs: casting.backs, moving: casting.moving, date: casting.date, board: casting.board },
    packet,
    packetText: rendered.text,
    retrieved: matched.map((m) => ({ id: m.entry.id, matched: m.matched })),
    coverage,
    claims,
    rejected,
    synthesis,
    notices,
    trace: calls
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
