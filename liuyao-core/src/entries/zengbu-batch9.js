/* 知识库条目 · 增删卜易 第九批（用神章 L595, L602，忌神吉凶）
   ────────────────────────────────────────────────────────────────────────
   以上乃有力之忌神，势同斧钺，诸占大凶。   → state:L<p>:忌·有力
   以上乃无力之忌神也，诸占化凶为吉。       → state:L<p>:忌·无力
   Only when a 用神 is given (the 忌神 is defined by it). Verbatim, checked by tests/kb-entries.mjs.
*/

const BOOK = '增删卜易';
const POS = [1, 2, 3, 4, 5, 6];

export const ZENGBU_BATCH9 = POS.flatMap((p) => [
  { id: `zb-l595-youli-p${p}`, source: { book: BOOK, chapter: '卷二 · 用神章', license: 'public-domain', line: 'L595' },
    text_zh: '诸占大凶', when: [`state:L${p}:忌·有力`] },
  { id: `zb-l602-wuli-p${p}`, source: { book: BOOK, chapter: '卷二 · 用神章', license: 'public-domain', line: 'L602' },
    text_zh: '诸占化凶为吉', when: [`state:L${p}:忌·无力`] }
]);
