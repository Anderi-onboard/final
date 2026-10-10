/* 知识库条目 · 增删卜易 第八批（飞伏神章 L3013, L3020，伏神出伏）
   ────────────────────────────────────────────────────────────────────────
   此六者，皆有用之伏神也，…   → state:L<p>:伏·可出
   此五者，乃无用之伏神也，虽有如无，终不能出。 → state:L<p>:伏·终不出
   The six 有用 reasons and five 无用 reasons are in the packet (emergence.rules);
   the entries cite the book's verdict sentence, and the rules are shown in the reading.
   Verbatim, checked by tests/kb-entries.mjs.
*/

const BOOK = '增删卜易';
const POS = [1, 2, 3, 4, 5, 6];

export const ZENGBU_BATCH8 = POS.flatMap((p) => [
  { id: `zb-l3013-youyong-p${p}`, source: { book: BOOK, chapter: '卷二 · 飞伏神章', license: 'public-domain', line: 'L3013' },
    text_zh: '皆有用之伏神也', when: [`state:L${p}:伏·可出`] },
  { id: `zb-l3020-wuyong-p${p}`, source: { book: BOOK, chapter: '卷二 · 飞伏神章', license: 'public-domain', line: 'L3020' },
    text_zh: '终不能出', when: [`state:L${p}:伏·终不出`] }
]);
