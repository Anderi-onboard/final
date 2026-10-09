/* 知识库条目 · 增删卜易 第二批（六冲章，盘面条件）
   ────────────────────────────────────────────────────────────────────────
   L1609  爻冲有五：爻遇月冲，为月破；…   → 爻遇月冲，为月破
          a line whose branch clashes with the month's branch is 月破.
          Instantiated per 爻位: when L<p>:monthClash.
   L1605  日月冲爻者，一也。卦逢六冲者，二也。 → 卦逢六冲者
          when hex:clash (the hexagram is a 六冲卦).
   Verbatim, checked by tests/kb-entries.mjs against the excerpt file.
*/

const BOOK = '增删卜易';
const POS = [1, 2, 3, 4, 5, 6];

const yuePo = POS.map((p) => ({
  id: `zb-l1609-yuepo-p${p}`,
  source: { book: BOOK, chapter: '卷一 · 六冲章', license: 'public-domain', line: 'L1609' },
  text_zh: '爻遇月冲，为月破',
  when: [`L${p}:monthClash`]
}));

const liuChong = [{
  id: 'zb-l1605-liuchong',
  source: { book: BOOK, chapter: '卷一 · 六冲章', license: 'public-domain', line: 'L1605' },
  text_zh: '卦逢六冲者',
  when: ['hex:clash']
}];

export const ZENGBU_BATCH2 = [...liuChong, ...yuePo];
