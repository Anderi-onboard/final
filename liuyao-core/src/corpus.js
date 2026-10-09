/* 知识库条目 (knowledge-base entries)
   ────────────────────────────────────────────────────────────────────────
   One entry = one 断语 from a source text, indexed by the board features it
   applies to. Entries are the ONLY thing a reading may cite as tradition; a
   claim with no entry is the model's own inference and must be labelled so.

   {
     id:     'zengbu-boyi-j3-012'          unique, stable, never reused
     source: {
       book:    '增删卜易'                  title as published
       chapter: '卷三 · 用神章'
       license: 'public-domain'            ONLY this value is accepted —
                                           modern commentaries are not stored
     }
     text_zh: '…'                          VERBATIM original, one sentence
                                           to a short passage. No paraphrase
                                           in this field.
     when:    ['ben:山雷頤', 'L3:wealth']   ALL must match (AND). Never empty:
                                           an empty `when` would fire on
                                           every board.
     unless?: ['hex:fanyin']               NONE may match.
     claim:   '妻财持世者…'                 one plain-Chinese restatement of
                                           what the text asserts, for the
                                           synthesis stage. Optional.
   }

   ⚠️ Copyright: the classics named here (增删卜易, 卜筮正宗, 黄金策, 火珠林 …)
   are public domain as texts. Modern annotated editions, translations and
   teaching books are NOT — their wording must not be copied in.

   Entries are added from the book, verbatim, in batches. Each batch is checked
   by tests/kb-entries.mjs against the excerpt file it cites.
*/

import { ZENGBU_BATCH1 } from './entries/zengbu-batch1.js';

// First batch: 增删卜易 独发章, 暗动章 (see src/entries/zengbu-batch1.js).
export const ENTRIES = [...ZENGBU_BATCH1];
