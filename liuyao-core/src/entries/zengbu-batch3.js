/* 知识库条目 · 增删卜易 第三批（六合章 L1330，爻之合者四种）
   ────────────────────────────────────────────────────────────────────────
   静而逢合，谓之合起；动而逢合，谓之合绊；爻与爻合，谓之合好；爻动化合，谓之化扶。
   Each clause is one state token per 爻位: state:L<p>:合起 etc. (facts.js).
   Verbatim, checked by tests/kb-entries.mjs.
*/

const BOOK = '增删卜易';
const POS = [1, 2, 3, 4, 5, 6];
const CLAUSES = [
  ['合起', '静而逢合'],
  ['合绊', '动而逢合'],
  ['合好', '爻与爻合'],   // 合好 = 动与动爻相合 (L1330 “爻动与动爻相合”); see test
  ['化扶', '爻动化合']
];

export const ZENGBU_BATCH3 = POS.flatMap((p) => CLAUSES.map(([name, clause]) => ({
  id: `zb-l1330-${name === '合起' ? 'heqi' : name === '合绊' ? 'hebiang' : name === '合好' ? 'hehao' : 'huafu'}-p${p}`,
  source: { book: BOOK, chapter: '卷一 · 六合章', license: 'public-domain', line: 'L1330' },
  text_zh: name === '合起' ? '静而逢合，谓之合起'
    : name === '合绊' ? '动而逢合，谓之合绊'
    : name === '合好' ? '爻与爻合，谓之合好'
    : '爻动化合，谓之化扶',
  when: [`state:L${p}:${name}`]
})));
