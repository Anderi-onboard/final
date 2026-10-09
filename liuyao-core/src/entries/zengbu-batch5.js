/* 知识库条目 · 增删卜易 第五批（旬空章 L2546，外力生扶不空）
   ────────────────────────────────────────────────────────────────────────
   有日建动爻生扶者，亦不为空。
   The clause has two mechanisms (日建 or 动爻 generating the line). Each gets its
   own entry, so the entry fires only on the mechanism that actually held.
   The reasons are states named by their clause (facts.js: state:L<p>:<reason>).
   Verbatim, checked by tests/kb-entries.mjs.
*/

const BOOK = '增删卜易';
const POS = [1, 2, 3, 4, 5, 6];
const CLAUSE = '有日建动爻生扶者，亦不为空';

export const ZENGBU_BATCH5 = POS.flatMap((p) => [
  {
    id: `zb-l2546-rijian-p${p}`,
    source: { book: BOOK, chapter: '卷一 · 旬空章', license: 'public-domain', line: 'L2546' },
    text_zh: CLAUSE,
    when: [`state:L${p}:日建生扶，不为空`]
  },
  {
    id: `zb-l2546-dongyao-p${p}`,
    source: { book: BOOK, chapter: '卷一 · 旬空章', license: 'public-domain', line: 'L2546' },
    text_zh: CLAUSE,
    when: [`state:L${p}:动爻生扶，不为空`]
  }
]);
