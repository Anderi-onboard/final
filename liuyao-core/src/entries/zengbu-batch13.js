/* 知识库条目 · 增删卜易 第十三批（动变章 L4057、L4059，进神与退神）
   ────────────────────────────────────────────────────────────────────────
   进: 动旺相化旺相 乘势而进 (进1); 动休囚化休囚 待时而进 (进2);
       动爻变爻有一值休囚 亦得旺相之日而进 (进3); 有一值空破 待填实之日而进 (进4).
   退: 动休囚化休囚 及时而退 (退2); 动爻变爻有一旺相 待休囚之时而退 (退3);
       有一逢空破 待填实之日而退 (退4).
   退1 (动旺相化旺相 → 退, but 不退 with 日月生扶 near-term) is NOT entered: its
   exception is an open ⚠ in the packet.
   Verbatim, checked by tests/kb-entries.mjs.
*/

const BOOK = '增删卜易';
const POS = [1, 2, 3, 4, 5, 6];
const CH = '卷二 · 动变章';
const RULES = [
  { code: '进1', text: '乘势而进', line: 'L4057' },
  { code: '进2', text: '待时而进', line: 'L4057' },
  { code: '进3', text: '亦得旺相之日而进', line: 'L4058' },
  { code: '进4', text: '待填实之日而进', line: 'L4058' },
  { code: '退2', text: '及时而退', line: 'L4059' },
  { code: '退3', text: '待休囚之时而退', line: 'L4060' },
  { code: '退4', text: '待填实之日而退', line: 'L4060' }
];

export const ZENGBU_BATCH13 = POS.flatMap((p) => RULES.map((r) => ({
  id: `zb-${r.line.toLowerCase()}-${r.code.startsWith('进') ? 'jin' : 'tui'}${r.code[1]}-p${p}`,
  source: { book: BOOK, chapter: CH, license: 'public-domain', line: r.line },
  text_zh: r.text,
  when: [`state:L${p}:${r.code}`]
})));
