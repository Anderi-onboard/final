/* 知识库条目 · 增删卜易 第四批（旬空章 L2546，何者不为空）
   ────────────────────────────────────────────────────────────────────────
   野鹤曰：旺不为空，动不为空，…，月破为空，…
   Three clauses that are pure board conditions, per 爻位:
     旺不为空   → when L<p>:void, L<p>:thriving           (the line is 旺, so 空 does not hold)
     动不为空   → when L<p>:void, mov@p                   (the line moves, so 空 does not hold)
     月破为空   → when L<p>:void, L<p>:monthClash         (月建冲爻 is 月破, and 空 holds)
   Verbatim, checked by tests/kb-entries.mjs.
   Not entered: 有气不动亦为空, 伏而被克亦为空, 有日建动爻生扶者亦不为空 — these
   need 伏神 and 生扶 tokens that are not yet in the vocabulary.
*/

const BOOK = '增删卜易';
const POS = [1, 2, 3, 4, 5, 6];
const CLAUSES = [
  { key: 'wang', text: '旺不为空', when: (p) => [`L${p}:void`, `L${p}:thriving`] },
  { key: 'dong', text: '动不为空', when: (p) => [`L${p}:void`, `mov@${p}`] },
  { key: 'yuepo', text: '月破为空', when: (p) => [`L${p}:void`, `L${p}:monthClash`] }
];

export const ZENGBU_BATCH4 = POS.flatMap((p) => CLAUSES.map((c) => ({
  id: `zb-l2546-${c.key}-p${p}`,
  source: { book: BOOK, chapter: '卷一 · 旬空章', license: 'public-domain', line: 'L2546' },
  text_zh: c.text,
  when: c.when(p)
})));
