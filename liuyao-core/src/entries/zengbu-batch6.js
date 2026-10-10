/* 知识库条目 · 增删卜易 第六批（卦变生克墓绝章 L2062–2084）
   ────────────────────────────────────────────────────────────────────────
   Each verdict clause is entered against the state the packet names for it:
     化生 (变生我)   state:L<p>:卦变·化生   → 即以吉断            (L2070)
     化克 (变克我)   state:L<p>:卦变·化克   → 即以凶推            (L2077)
                                              凡遇卦化克者，不论用神之衰旺，皆以凶推 (L2062)
     化去 (我克变)   state:L<p>:卦变·化去   → 不为凶也            (L2084)
   Not entered: 化来 (L2091), because its 大凶 needs a test the book does not give (open ⚠).
   Verbatim, checked by tests/kb-entries.mjs.
*/

const BOOK = '增删卜易';
const POS = [1, 2, 3, 4, 5, 6];
const CHAPTER = '卷二 · 卦变生克墓绝章';

export const ZENGBU_BATCH6 = POS.flatMap((p) => [
  { id: `zb-l2070-huasheng-p${p}`, source: { book: BOOK, chapter: CHAPTER, license: 'public-domain', line: 'L2070' },
    text_zh: '即以吉断', when: [`state:L${p}:卦变·化生`] },
  { id: `zb-l2077-huake-p${p}`, source: { book: BOOK, chapter: CHAPTER, license: 'public-domain', line: 'L2077' },
    text_zh: '即以凶推', when: [`state:L${p}:卦变·化克`] },
  { id: `zb-l2062-huake-regardless-p${p}`, source: { book: BOOK, chapter: CHAPTER, license: 'public-domain', line: 'L2062' },
    text_zh: '凡遇卦化克者，不论用神之衰旺，皆以凶推', when: [`state:L${p}:卦变·化克`] },
  { id: `zb-l2084-huaqu-p${p}`, source: { book: BOOK, chapter: CHAPTER, license: 'public-domain', line: 'L2084' },
    text_zh: '不为凶也', when: [`state:L${p}:卦变·化去`] }
]);
