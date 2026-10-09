/* What each model stage must return. Anything else is rejected, and the stage
   is asked again once with the reason. */
import { SUBJECTS } from './subjects.js';

export const UNDERSTAND_SPEC = {
  restated: 'string',                       // one sentence: what the person wants to know
  category: 'string',                       // the 门类 in plain words (求财, 功名, 疾病…)
  subject: { enum: [...SUBJECTS, 'unknown'] },
  askerGender: { enum: ['male', 'female', 'unknown'] },
  askingForSelf: 'boolean',                 // 自占 (true) or 代占 (false)
  premises: ['string'],                     // what the question takes as already true
  factorsToCheck: ['string'],               // what in the situation could matter
  wantsTiming: 'boolean',                   // asks when (应期)
  tone: 'string',                           // how the question is written
  psychology: 'string',                     // a guess at state of mind; must say 可能
  risk: { enum: ['none', 'distress', 'crisis'] },
  needs: {
    recastNotice: 'boolean',                // same matter asked again today
    clarify: ['string']                     // what must be asked back before reading
  }
};

export const CLAIM_SPEC = {
  entryId: 'string',                        // must be the id of the entry given
  claim: 'string',                          // the 断语 applied to this casting
  linkToUser: 'string',                     // which part of the person's situation it meets
  realWorld: 'string',                      // what it could correspond to in real life
  lines: ['number'],                        // 爻位 (1–6) the claim rests on
  confidence: { enum: ['low', 'mid', 'high'] }
};

export const SYNTH_SPEC = {
  answered: 'boolean',                      // did the reading answer the question as asked
  answer: 'string',                         // the reply to the person
  checks: [{ name: 'string', pass: 'boolean', note: 'string' }],
  confidence: { enum: ['low', 'mid', 'high'] },
  unansweredParts: ['string']
};
