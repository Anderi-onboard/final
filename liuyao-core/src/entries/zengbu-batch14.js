/* 知识库条目 · 增删卜易 第十四批（独发章 L4197，独发与独静）
   ────────────────────────────────────────────────────────────────────────
   五爻俱动，一爻不动，谓之独静；五爻不动，一爻独动，谓之独发。
   → 独静: the one static line (state:L<p>:独静)
   → 独发: the one moving line (state:L<p>:独发)
   Verbatim, checked by tests/kb-entries.mjs.
*/

const BOOK = '增删卜易';
const POS = [1, 2, 3, 4, 5, 6];
const SRC = { book: BOOK, chapter: '卷二 · 独发章', license: 'public-domain', line: 'L4197' };

export const ZENGBU_BATCH14 = POS.flatMap((p) => [
  { id: `zb-l4197-dujing-p${p}`, source: SRC, text_zh: '五爻俱动，一爻不动，谓之独静', when: [`state:L${p}:独静`] },
  { id: `zb-l4197-duface-p${p}`, source: SRC, text_zh: '五爻不动，一爻独动，谓之独发', when: [`state:L${p}:独发`] }
]);
