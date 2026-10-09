/* 知识库条目 · 增删卜易 第一批（盘面条件只看位置与状态，不依赖问题）
   ────────────────────────────────────────────────────────────────────────
   Each entry's text_zh is a verbatim clause of the book, checked against
   knowledge/sources/zengbu-boyi-excerpts.json by tests/kb-entries.mjs.

   Three rules, instantiated per 爻位 because `when` tokens carry a position:
     独发章 L4197  五爻不动，一爻独动，谓之独发。
                   → when mov:1 & mov@p            (exactly one moving line, at p)
     暗动章 L1988  静爻休囚，日辰冲之，为日破。      → when L<p>:dayClash & L<p>:resting|trapped, unless mov@p
                   静爻旺相，日辰冲之，为暗动。      → when L<p>:dayClash & L<p>:thriving|strong,  unless mov@p

   Scope: only these three clauses. The book's commentary on them (野鹤, 觉子,
   and the 乾按 notes, which are modern and are NOT stored) is not entered.
*/

const BOOK = '增删卜易';
const POS = [1, 2, 3, 4, 5, 6];

const duFa = POS.map((p) => ({
  id: `zb-l4197-dufa-p${p}`,
  source: { book: BOOK, chapter: '卷二 · 独发章', license: 'public-domain', line: 'L4197' },
  text_zh: '五爻不动，一爻独动，谓之独发。',
  when: ['mov:1', `mov@${p}`]
}));

const riPo = POS.flatMap((p) => ['resting', 'trapped'].map((st) => ({
  id: `zb-l1988-ripo-${st}-p${p}`,
  source: { book: BOOK, chapter: '卷一 · 暗动章', license: 'public-domain', line: 'L1988' },
  text_zh: '静爻休囚，日辰冲之，为日破',
  when: [`L${p}:dayClash`, `L${p}:${st}`],
  unless: [`mov@${p}`]
})));

const anDong = POS.flatMap((p) => ['thriving', 'strong'].map((st) => ({
  id: `zb-l1988-andong-${st}-p${p}`,
  source: { book: BOOK, chapter: '卷一 · 暗动章', license: 'public-domain', line: 'L1988' },
  text_zh: '静爻旺相，日辰冲之，为暗动。',
  when: [`L${p}:dayClash`, `L${p}:${st}`],
  unless: [`mov@${p}`]
})));

export const ZENGBU_BATCH1 = [...duFa, ...riPo, ...anDong];
