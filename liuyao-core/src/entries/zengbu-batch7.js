/* 知识库条目 · 增删卜易 第七批（用神章 L878，日月如天）
   ────────────────────────────────────────────────────────────────────────
   惟日月能生之、克之、冲之、合之，…日月如天，能生克动爻、静爻、飞爻、伏爻、变爻，
   而诸爻皆不能伤日月。
     日生 / 月生 → 日月能生之            (state:L<p>:日生 / 月生)
     日克 / 月克 → 日月能生之、克之       (state:L<p>:日克 / 月克)
     爻伤日 / 爻伤月 → 而诸爻皆不能伤日月 (state:L<p>:爻伤日 / 爻伤月)
   Verbatim, checked by tests/kb-entries.mjs.
*/

const BOOK = '增删卜易';
const POS = [1, 2, 3, 4, 5, 6];
const SRC = { book: BOOK, chapter: '卷二 · 用神章', license: 'public-domain', line: 'L878' };

export const ZENGBU_BATCH7 = POS.flatMap((p) => [
  { id: `zb-l878-riri-p${p}`, source: SRC, text_zh: '日月能生之', when: [`state:L${p}:日生`] },
  { id: `zb-l878-yueshen-p${p}`, source: SRC, text_zh: '日月能生之', when: [`state:L${p}:月生`] },
  { id: `zb-l878-rike-p${p}`, source: SRC, text_zh: '日月能生之、克之', when: [`state:L${p}:日克`] },
  { id: `zb-l878-yueke-p${p}`, source: SRC, text_zh: '日月能生之、克之', when: [`state:L${p}:月克`] },
  { id: `zb-l878-shangri-p${p}`, source: SRC, text_zh: '而诸爻皆不能伤日月', when: [`state:L${p}:爻伤日`] },
  { id: `zb-l878-shangyue-p${p}`, source: SRC, text_zh: '而诸爻皆不能伤日月', when: [`state:L${p}:爻伤月`] }
]);
