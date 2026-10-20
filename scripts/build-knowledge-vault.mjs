/* Generate the machine-derived half of the Obsidian vault in knowledge/.
 *
 * Two folders are written here and nowhere else:
 *   knowledge/07 卦库/     — the 64 hexagrams, each one installed (装卦) by the
 *                            site's own engine, liuyao-engine.js
 *   knowledge/08 类象库/   — one note per symbol, read from
 *                            assets/xiangshu/lei-xiang.json
 *
 * Why generated rather than written: a hand-typed 纳甲 table is 384 cells, and
 * a vault that disagrees with the engine is worse than no vault — whoever
 * checks a reading against it gets told the board is wrong when the notes are.
 * The engine is already verified against 京房纳甲 (BWLiuYao._selfTest), and
 * this script additionally asserts the eight-palace membership, the 六冲 and
 * 六合 hexagrams and the self-test before it writes a single file.
 *
 * Everything else in knowledge/ is written by hand. Do not hand-edit the two
 * folders above; change the engine or the JSON and re-run:
 *
 *   node scripts/build-knowledge-vault.mjs          write
 *   node scripts/build-knowledge-vault.mjs --check  exit 1 if anything is stale
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VAULT = path.join(ROOT, 'knowledge');
const HEX_DIR = '07 卦库';
const XIANG_DIR = '08 类象库';

/* ── load the engine exactly as the browser does ─────────────────────────── */
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'liuyao-engine.js'), 'utf8'), sandbox);
const LY = sandbox.window.BWLiuYao;
const selfTest = LY._selfTest();
assert.equal(selfTest.fail, 0, 'liuyao-engine self-test failed:\n' + selfTest.results.join('\n'));

const LEI = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/xiangshu/lei-xiang.json'), 'utf8'));

/* English names come from the casting figure, so the vault uses the same ones
   the reader sees on screen. */
const figureSrc = fs.readFileSync(path.join(ROOT, 'casting-figure.js'), 'utf8');
const EN = {};
for (const m of figureSrc.matchAll(/S\((\d),(\d),"([^"]+)"\)/g)) EN[Number(m[2]) | (Number(m[1]) << 3)] = m[3];
assert.equal(Object.keys(EN).length, 64, 'could not read 64 English names from casting-figure.js');

/* ── tables ──────────────────────────────────────────────────────────────── */
// trigram index = 3-bit pattern, bit0 = bottom line (the engine's encoding)
const TRI = ['坤', '震', '坎', '兑', '艮', '离', '巽', '乾'];
const TRI_NATURE = { 乾: '天', 坤: '地', 震: '雷', 巽: '风', 坎: '水', 离: '火', 艮: '山', 兑: '泽' };
const TRI_SYM = { 乾: '☰', 兑: '☱', 离: '☲', 震: '☳', 巽: '☴', 坎: '☵', 艮: '☶', 坤: '☷' };

// King Wen order: [name, upper, lower]
const KW = [
  ['乾为天', '乾', '乾'], ['坤为地', '坤', '坤'], ['水雷屯', '坎', '震'], ['山水蒙', '艮', '坎'],
  ['水天需', '坎', '乾'], ['天水讼', '乾', '坎'], ['地水师', '坤', '坎'], ['水地比', '坎', '坤'],
  ['风天小畜', '巽', '乾'], ['天泽履', '乾', '兑'], ['地天泰', '坤', '乾'], ['天地否', '乾', '坤'],
  ['天火同人', '乾', '离'], ['火天大有', '离', '乾'], ['地山谦', '坤', '艮'], ['雷地豫', '震', '坤'],
  ['泽雷随', '兑', '震'], ['山风蛊', '艮', '巽'], ['地泽临', '坤', '兑'], ['风地观', '巽', '坤'],
  ['火雷噬嗑', '离', '震'], ['山火贲', '艮', '离'], ['山地剥', '艮', '坤'], ['地雷复', '坤', '震'],
  ['天雷无妄', '乾', '震'], ['山天大畜', '艮', '乾'], ['山雷颐', '艮', '震'], ['泽风大过', '兑', '巽'],
  ['坎为水', '坎', '坎'], ['离为火', '离', '离'], ['泽山咸', '兑', '艮'], ['雷风恒', '震', '巽'],
  ['天山遁', '乾', '艮'], ['雷天大壮', '震', '乾'], ['火地晋', '离', '坤'], ['地火明夷', '坤', '离'],
  ['风火家人', '巽', '离'], ['火泽睽', '离', '兑'], ['水山蹇', '坎', '艮'], ['雷水解', '震', '坎'],
  ['山泽损', '艮', '兑'], ['风雷益', '巽', '震'], ['泽天夬', '兑', '乾'], ['天风姤', '乾', '巽'],
  ['泽地萃', '兑', '坤'], ['地风升', '坤', '巽'], ['泽水困', '兑', '坎'], ['水风井', '坎', '巽'],
  ['泽火革', '兑', '离'], ['火风鼎', '离', '巽'], ['震为雷', '震', '震'], ['艮为山', '艮', '艮'],
  ['风山渐', '巽', '艮'], ['雷泽归妹', '震', '兑'], ['雷火丰', '震', '离'], ['火山旅', '离', '艮'],
  ['巽为风', '巽', '巽'], ['兑为泽', '兑', '兑'], ['风水涣', '巽', '坎'], ['水泽节', '坎', '兑'],
  ['风泽中孚', '巽', '兑'], ['雷山小过', '震', '艮'], ['水火既济', '坎', '离'], ['火水未济', '离', '坎']
];
const byPattern = {};
KW.forEach(([name, up, lo], i) => {
  const pat = TRI.indexOf(lo) | (TRI.indexOf(up) << 3);
  assert.equal(byPattern[pat], undefined, `two King Wen entries share pattern ${pat}`);
  byPattern[pat] = { no: i + 1, name, up, lo, pat };
});

/* The eight palaces as every textbook lists them. Asserted against the engine
   so a regression in liuyao-engine.js's PALACE map fails here, loudly. */
const PALACES = {
  乾: ['乾为天', '天风姤', '天山遁', '天地否', '风地观', '山地剥', '火地晋', '火天大有'],
  坎: ['坎为水', '水泽节', '水雷屯', '水火既济', '泽火革', '雷火丰', '地火明夷', '地水师'],
  艮: ['艮为山', '山火贲', '山天大畜', '山泽损', '火泽睽', '天泽履', '风泽中孚', '风山渐'],
  震: ['震为雷', '雷地豫', '雷水解', '雷风恒', '地风升', '水风井', '泽风大过', '泽雷随'],
  巽: ['巽为风', '风天小畜', '风火家人', '风雷益', '天雷无妄', '火雷噬嗑', '山雷颐', '山风蛊'],
  离: ['离为火', '火山旅', '火风鼎', '火水未济', '山水蒙', '风水涣', '天水讼', '天火同人'],
  坤: ['坤为地', '地雷复', '地泽临', '地天泰', '雷天大壮', '泽天夬', '水天需', '水地比'],
  兑: ['兑为泽', '泽水困', '泽地萃', '泽山咸', '水山蹇', '地山谦', '雷山小过', '雷泽归妹']
};
const SIX_CLASH = ['乾为天', '坤为地', '坎为水', '离为火', '震为雷', '艮为山', '巽为风', '兑为泽', '天雷无妄', '雷天大壮'];
const SIX_COMBINE = ['天地否', '地天泰', '地雷复', '雷地豫', '泽水困', '水泽节', '火山旅', '山火贲'];
const POS = ['初', '二', '三', '四', '五', '上'];
const BR = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const BR_COMBINE = { 0: 1, 1: 0, 2: 11, 11: 2, 3: 10, 10: 3, 4: 9, 9: 4, 5: 8, 8: 5, 6: 7, 7: 6 };

function linesOf(pat) {
  return Array.from({ length: 6 }, (_, i) => ({ yang: !!(pat & (1 << i)), changing: false }));
}
function board(pat) {
  // date-dependent fields (六神, 旬空, 旺衰) are not used here — only the
  // installation, which depends on the figure alone.
  return LY.computeBoard({ lines: linesOf(pat), changeIdx: [], dayGanzhi: 0, monthBranch: 2 });
}
function patOf(bits) { return bits.reduce((p, y, i) => p | (y ? 1 << i : 0), 0); }
function bitsOf(pat) { return Array.from({ length: 6 }, (_, i) => !!(pat & (1 << i))); }
const link = (h) => `[[${h.name}]]`;

/* ── verify the engine against the textbook before writing anything ──────── */
for (const [palace, names] of Object.entries(PALACES)) {
  names.forEach((name, series) => {
    const h = Object.values(byPattern).find((x) => x.name === name);
    const b = board(h.pat);
    assert.equal(b.ben.palace.cn, palace + '宫', `${name}: engine says ${b.ben.palace.cn}, textbook says ${palace}宫`);
    assert.equal(b.ben.series.idx, series, `${name}: engine series ${b.ben.series.cn}`);
  });
}
for (const h of Object.values(byPattern)) {
  const b = board(h.pat);
  assert.equal(b.ben.clash, SIX_CLASH.includes(h.name), `${h.name}: 六冲 flag disagrees with the textbook`);
  assert.equal(b.ben.combine, SIX_COMBINE.includes(h.name), `${h.name}: 六合 flag disagrees with the textbook`);
}

/* ── relations between two branches, as the vault phrases them ───────────── */
const EL = ['木', '火', '土', '金', '水'];
function elRel(a, b) {          // a toward b, by element index
  if (a === b) return '比和';
  if ((a + 1) % 5 === b) return '生';
  if ((b + 1) % 5 === a) return '被生';
  if ((a + 2) % 5 === b) return '克';
  return '被克';
}
function brRel(x, y) {          // branch objects from the engine
  const out = [];
  if ((x.bi + 6) % 12 === y.bi) out.push('六冲');
  if (BR_COMBINE[x.bi] === y.bi) out.push('六合');
  const r = elRel(x.el.gi, y.el.gi);
  out.push(r === '比和' ? '比和' : r === '生' ? '世生应' : r === '被生' ? '应生世' : r === '克' ? '世克应' : '应克世');
  return out.join(' · ');
}

/* ── 07 卦库 ─────────────────────────────────────────────────────────────── */
const files = new Map();
const put = (rel, body) => files.set(rel, body.replace(/\n{3,}/g, '\n\n').trimEnd() + '\n');

const GEN_NOTE = '> [!info] 本页由 `scripts/build-knowledge-vault.mjs` 用站点自己的排盘引擎 `liuyao-engine.js` 生成。\n'
  + '> 不要手改 —— 改引擎或数据后重新运行脚本。手写的心得请写进 [[断卦心得]] 或案例。';

function hexNote(h) {
  const b = board(h.pat);
  const bits = bitsOf(h.pat);
  const hu = byPattern[patOf([bits[1], bits[2], bits[3], bits[2], bits[3], bits[4]])];
  const cuo = byPattern[patOf(bits.map((y) => !y))];
  const zong = byPattern[patOf(bits.slice().reverse())];
  const palace = b.ben.palace.cn.slice(0, 1);
  const w = b.ben.worldLi, r = b.ben.respLi;
  const world = b.lines[w], resp = b.lines[r];
  const tags = ['卦', `宫/${palace}`, `世系/${b.ben.series.cn}`];
  if (b.ben.clash) tags.push('六冲卦');
  if (b.ben.combine) tags.push('六合卦');

  const rows = b.lines.slice().reverse().map((l) => {
    const i = l.idx;
    const draw = l.yang ? '▅▅▅▅▅' : '▅▅　▅▅';
    const mark = l.markerCn || '';
    const pos = i + 1;
    const proper = (pos % 2 === 1) === l.yang ? '当位' : '不当位';
    const centre = pos === 2 || pos === 5 ? '中' : '';
    const partner = b.lines[(i + 3) % 6];
    const resonance = partner.yang !== l.yang ? '有应' : '无应';
    return `| ${POS[i]}爻 | ${draw} | ${l.stem.cn}${l.branch.cn}${l.element.cn} | ${l.relative.cn} | ${mark} | ${[proper, centre, resonance].filter(Boolean).join('·')} |`;
  });

  const hidden = b.hidden.length
    ? b.hidden.map((x) => `- **${x.relative.cn}** 不上卦，伏在${POS[x.position]}爻 ${x.flyingBranch.cn}${x.flyingBranch.el.cn}（${x.flyingRelative.cn}）之下：`
      + `伏神 ${x.hiddenBranch.cn}${x.hiddenBranch.el.cn}。`
      + (x.flyGeneratesHidden ? '飞神生伏神（易出）。' : '')
      + (x.flyControlsHidden ? '飞神克伏神（难出）。' : '')
      + (x.hiddenControlsFly ? '伏神克飞神（能出）。' : '')
      + (x.hiddenBranch.el.gi === x.flyingBranch.el.gi ? '飞伏比和（看日月扶不扶）。' : '')
      + ((x.hiddenBranch.el.gi + 1) % 5 === x.flyingBranch.el.gi ? '伏神生飞神（泄气，难出）。' : ''))
      .join('\n')
      + '\n- 起卦当天还要看：飞神逢空、发动、被日冲开，伏神都更容易出；伏神自己旬空、入墓、休囚，则伏而不出。'
    : '- 五类六亲俱全，无伏神。';

  const gs = b.guashen;
  const guashen = gs.onBoard
    ? `卦身 **${gs.branch.cn}**，上卦于第 ${gs.lines.join('、')} 爻。`
    : `卦身 **${gs.branch.cn}**，不上卦（这只说明没有哪一爻带它，见 [[月卦身]]）。`;

  const sanhe = b.sanhe.length
    ? b.sanhe.map((s) => `- 卦中 ${s.branches.map((x) => x.cn).join('')}（第 ${s.lines.join('、')} 爻）为${s.type === 'full' ? '三合' : '半合'}${s.element.cn}局`
      + (s.missing ? `，缺 ${s.missing.cn}` : '') + '。静卦不成局，须有爻发动或日月补足，见 [[三合局]]。').join('\n')
    : '- 无。';

  const special = [];
  if (b.ben.clash) special.push('[[六冲卦]]：主散、主急、主近。');
  if (b.ben.combine) special.push('[[六合卦]]：主聚、主成、主缓。');
  if (b.ben.series.idx === 6) special.push('游魂卦：心神不定、在外未归、事多反复。');
  if (b.ben.series.idx === 7) special.push('归魂卦：回归本位、归家、事有着落而难远图。');

  return `---
aliases: [第${h.no}卦, ${EN[h.pat]}]
tags: [${tags.join(', ')}]
卦序: ${h.no}
上卦: ${h.up}
下卦: ${h.lo}
宫: ${palace}
宫五行: ${b.ben.palace.element.cn}
世系: ${b.ben.series.cn}
世爻: ${w + 1}
应爻: ${r + 1}
六冲: ${b.ben.clash}
六合: ${b.ben.combine}
---

# ${h.no} · ${h.name}

${TRI_SYM[h.up]}${TRI_SYM[h.lo]} 上${h.up}下${h.lo} —— ${TRI_NATURE[h.up]}在上，${TRI_NATURE[h.lo]}在下。英文界面名：*${EN[h.pat]}*。

${GEN_NOTE}

## 装卦（纳甲）

[[八宫与世应|${b.ben.palace.cn}]]（${b.ben.palace.element.cn}）· ${b.ben.series.cn}卦 · 世在${POS[w]}爻、应在${POS[r]}爻

| 爻位 | 爻 | 纳甲 | [[六亲]] | 世应 | 爻位关系 |
|---|---|---|---|---|---|
${rows.join('\n')}

- 世应关系：世 ${world.branch.cn}${world.element.cn} 对 应 ${resp.branch.cn}${resp.element.cn} —— ${brRel(world.branch, resp.branch)}。见 [[世应]]。
- [[六神]]、[[旬空]]、[[旺衰]]随起卦之日而变，不在此表；起卦时看排盘。

## 伏神

${hidden}

见 [[伏神与飞神]]。

## 卦身与合局

${guashen}

${sanhe}

## 卦间关系

- 互卦：${link(hu)}（二三四爻为下、三四五爻为上，事情内部的过程，见 [[互卦·错卦·综卦]]）
- 错卦：${link(cuo)}（六爻全反）
- 综卦：${link(zong)}（上下颠倒，换个立场看同一件事）
${special.length ? '\n## 卦性\n\n' + special.map((s) => '- ' + s).join('\n') + '\n' : ''}
## 卦义

> [!warning] 卦辞、爻辞、象传待从校勘本录入
> 不要凭记忆补写 —— 记错一个字的「经云」比空着更坏，站点解读也遵守同一条铁律（见 [[解读铁律]]）。
> 卦义先从上下卦推：${TRI_NATURE[h.up]}（${h.up}）在上、${TRI_NATURE[h.lo]}（${h.lo}）在下，两个象叠在一起做什么，就是这一卦的意思。见 [[卦义从上下卦推]]。

## 我的笔记

-
`;
}

const hexes = Object.values(byPattern).sort((a, b) => a.no - b.no);
for (const h of hexes) put(`${HEX_DIR}/${h.name}.md`, hexNote(h));

/* index: King Wen order, and the eight-palace grid */
{
  const rows = hexes.map((h) => {
    const b = board(h.pat);
    const flags = [b.ben.clash && '六冲', b.ben.combine && '六合'].filter(Boolean).join(' ');
    return `| ${h.no} | ${link(h)} | ${TRI_SYM[h.up]}${h.up}/${TRI_SYM[h.lo]}${h.lo} | ${b.ben.palace.cn} | ${b.ben.series.cn} | ${b.ben.worldLi + 1} | ${flags} |`;
  });
  const grid = Object.entries(PALACES).map(([p, names]) => {
    const el = board(hexes.find((h) => h.name === names[0]).pat).ben.palace.element.cn;
    return `| **${p}宫**（${el}） | ${names.map((n) => `[[${n}]]`).join(' | ')} |`;
  });
  put(`${HEX_DIR}/六十四卦索引.md`, `---
tags: [索引, 卦]
---

# 六十四卦索引

${GEN_NOTE}

## 八宫卦表

世系从左到右：本宫（世六）· 一世 · 二世 · 三世 · 四世 · 五世 · 游魂（世四）· 归魂（世三）。见 [[八宫与世应]]。

| 宫 | 本宫 | 一世 | 二世 | 三世 | 四世 | 五世 | 游魂 | 归魂 |
|---|---|---|---|---|---|---|---|---|
${grid.join('\n')}

## 六冲卦与六合卦

- [[六冲卦]]：${SIX_CLASH.map((n) => `[[${n}]]`).join('、')}
- [[六合卦]]：${SIX_COMBINE.map((n) => `[[${n}]]`).join('、')}

## 卦序

| 序 | 卦 | 上/下 | 宫 | 世系 | 世 | 卦性 |
|---|---|---|---|---|---|---|
${rows.join('\n')}
`);
}

/* ── 08 类象库 ───────────────────────────────────────────────────────────── */
const KIND = {
  liuqin: { dir: '六亲', prefix: '六亲·', hub: '[[六亲]]' },
  position: { dir: '世应', prefix: '爻位·', hub: '[[世应]]' },
  branch: { dir: '地支', prefix: '地支·', hub: '[[天干地支]]' },
  element: { dir: '五行', prefix: '五行·', hub: '[[五行生克]]' },
  spirit: { dir: '六神', prefix: '六神·', hub: '[[六神]]' },
  trigram: { dir: '八卦', prefix: '八卦·', hub: '[[八卦]]' }
};
const noteName = (sym) => KIND[LEI.symbols[sym].kind].prefix + sym;
const BR_EL_CN = { 子: '水', 丑: '土', 寅: '木', 卯: '木', 辰: '土', 巳: '火', 午: '火', 未: '土', 申: '金', 酉: '金', 戌: '土', 亥: '水' };
const TRI_EL = { 乾: '金', 兑: '金', 离: '火', 震: '木', 巽: '木', 坎: '水', 艮: '土', 坤: '土' };

const XIANG_NOTE = '> [!info] 本页由 `scripts/build-knowledge-vault.mjs` 从 `assets/xiangshu/lei-xiang.json` 生成 —— 就是站点里点开取象标记时弹出的那份类象。\n'
  + '> 要增删类象，改 JSON 再重跑脚本，网站和知识库一起变。';

function xiangNote(sym) {
  const s = LEI.symbols[sym];
  const k = KIND[s.kind];
  const links = [];
  if (s.kind === 'branch') links.push(`五行属 [[五行·${BR_EL_CN[sym]}]]`);
  if (s.kind === 'trigram') links.push(`五行属 [[五行·${TRI_EL[sym]}]]`, `本宫八卦见 [[${KW.find((x) => x[1] === sym && x[2] === sym)[0]}]]`);
  if (s.kind === 'liuqin') {
    const R = LEI.relations;
    const feeds = R.sheng.find((p) => p[0] === sym)[1], fedBy = R.sheng.find((p) => p[1] === sym)[0];
    const ctl = R.ke.find((p) => p[0] === sym)[1], ctlBy = R.ke.find((p) => p[1] === sym)[0];
    links.push(`生 [[六亲·${feeds}]]，被 [[六亲·${fedBy}]] 所生`, `克 [[六亲·${ctl}]]，被 [[六亲·${ctlBy}]] 所克`);
  }
  const cats = s.cats.map((c) => `### ${c.zh}（${c.en}）\n\n${c.items.zh.map((z, i) => `- ${z} —— *${c.items.en[i] || ''}*`).join('\n')}`).join('\n\n');
  const acts = s.acts ? `## 动词象意\n\n这股力量**做**什么：${s.acts.zh.join('、')}。\n\n*${s.acts.en.join(', ')}*` : '';
  return `---
aliases: [${sym}象]
tags: [类象, 类象/${k.dir}]
符号: ${sym}
英文: ${s.en}
---

# ${sym} 的类象

${k.hub} · ${s.en}${links.length ? '\n\n' + links.map((l) => '- ' + l).join('\n') : ''}

${XIANG_NOTE}

## 一个象，很多东西

解读里只点**其中一件**，而且点的是提问人生活里认得出来的那一件（见 [[取象标记]]）。

${cats}

${acts}
`;
}
for (const sym of Object.keys(LEI.symbols)) put(`${XIANG_DIR}/${noteName(sym)}.md`, xiangNote(sym));

{
  const groups = Object.entries(KIND).map(([kind, k]) => {
    const syms = Object.keys(LEI.symbols).filter((s) => LEI.symbols[s].kind === kind);
    return `## ${k.dir}\n\n${syms.map((s) => `[[${noteName(s)}|${s}]]`).join(' · ')}`;
  });
  put(`${XIANG_DIR}/类象索引.md`, `---
tags: [索引, 类象]
---

# 类象索引

${XIANG_NOTE}

站点认得 ${Object.keys(LEI.symbols).length} 个符号。下面这些**不是**象，是盘的状态，不能指向别的东西，所以不进类象库：
${LEI.notSymbols.join('、')}。

${groups.join('\n\n')}
`);
}

/* ── write or check ──────────────────────────────────────────────────────── */
const check = process.argv.includes('--check');
const stale = [];
for (const [rel, body] of files) {
  const abs = path.join(VAULT, rel);
  const have = fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null;
  if (have === body) continue;
  stale.push(rel);
  if (!check) { fs.mkdirSync(path.dirname(abs), { recursive: true }); fs.writeFileSync(abs, body); }
}
// a generated note whose source vanished is stale too
for (const dir of [HEX_DIR, XIANG_DIR]) {
  const abs = path.join(VAULT, dir);
  if (!fs.existsSync(abs)) continue;
  for (const f of fs.readdirSync(abs)) {
    const rel = `${dir}/${f}`;
    if (f.endsWith('.md') && !files.has(rel)) {
      stale.push(rel + ' (orphan)');
      if (!check) fs.unlinkSync(path.join(abs, f));
    }
  }
}

export const generated = files;
if (check) {
  if (stale.length) { console.error('knowledge vault is stale:\n  ' + stale.join('\n  ') + '\nrun: node scripts/build-knowledge-vault.mjs'); process.exit(1); }
  console.log(`knowledge vault OK — ${files.size} generated notes current`);
} else {
  console.log(`knowledge vault — ${files.size} generated notes, ${stale.length} written`);
}
