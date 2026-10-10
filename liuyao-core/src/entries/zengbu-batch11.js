/* 知识库条目 · 增删卜易 第十一批（用神章 L589，无用之元神）
   ────────────────────────────────────────────────────────────────────────
   以上元神见生不生，无力生用神，乃无用之元神也，虽有如无。 → state:L<p>:元·无用
   Verbatim, checked by tests/kb-entries.mjs. Only with a 用神 given.
*/

const BOOK = '增删卜易';
const POS = [1, 2, 3, 4, 5, 6];

export const ZENGBU_BATCH11 = POS.map((p) => ({
  id: `zb-l589-yuan-wuyong-p${p}`,
  source: { book: BOOK, chapter: '卷二 · 用神章', license: 'public-domain', line: 'L589' },
  text_zh: '乃无用之元神也',
  when: [`state:L${p}:元·无用`]
}));
