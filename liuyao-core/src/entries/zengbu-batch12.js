/* 知识库条目 · 增删卜易 第十二批（三合章 L1460–1463，三合成局）
   ────────────────────────────────────────────────────────────────────────
   一卦之内，有三爻动而合局者，一也。        → state:L<p>:三合·形1  (三爻动而合局)
   两爻动，一爻不动，亦成合局者，二也。        → state:L<p>:三合·形2  (亦成合局)
   有内卦初爻、三爻动，动而变出之爻成三合者，三也。 → state:L<p>:三合·形3  (动而变出之爻成三合)
   有外卦四爻、六爻动，动而变出之爻成三合者，四也。 → state:L<p>:三合·形4  (同上)
   倘局克世爻，则以凶推。                      → state:L<p>:三合·局克世  (L1463)
   Verbatim, checked by tests/kb-entries.mjs. Each 爻 that belongs to a 局 gets the state.
*/

const BOOK = '增删卜易';
const POS = [1, 2, 3, 4, 5, 6];
const CH = '卷一 · 三合章';
// 形三 is made of 爻 1, 3 and the 变 that completes it; 形四 of 爻 4, 6. The 纳甲 branches of
// one trigram's three lines fall in three different 三合 groups, so 爻 2 (or 5) can never be
// a member of 形三 (or 形四): the entries sit only where the form can apply.
const FORM_POS = { 3: [1, 3], 4: [4, 6] };

export const ZENGBU_BATCH12 = [
  ...POS.flatMap((p) => [
    { id: `zb-l1460-sanhe-f1-p${p}`, source: { book: BOOK, chapter: CH, license: 'public-domain', line: 'L1460' },
      text_zh: '三爻动而合局', when: [`state:L${p}:三合·形1`] },
    { id: `zb-l1460-sanhe-f2-p${p}`, source: { book: BOOK, chapter: CH, license: 'public-domain', line: 'L1460' },
      text_zh: '亦成合局', when: [`state:L${p}:三合·形2`] },
    { id: `zb-l1463-sanhe-kesh-p${p}`, source: { book: BOOK, chapter: CH, license: 'public-domain', line: 'L1463' },
      text_zh: '局克世爻，则以凶推', when: [`state:L${p}:三合·局克世`] }
  ]),
  ...FORM_POS[3].map((p) => ({ id: `zb-l1461-sanhe-f3-p${p}`, source: { book: BOOK, chapter: CH, license: 'public-domain', line: 'L1461' },
    text_zh: '动而变出之爻成三合', when: [`state:L${p}:三合·形3`] })),
  ...FORM_POS[4].map((p) => ({ id: `zb-l1461-sanhe-f4-p${p}`, source: { book: BOOK, chapter: CH, license: 'public-domain', line: 'L1461' },
    text_zh: '动而变出之爻成三合', when: [`state:L${p}:三合·形4`] }))
];
