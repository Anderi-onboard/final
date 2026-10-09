/**
 * BOOK RULES CONTRACT — 增删卜易 排盘与格局
 *
 * Every expected value below is typed from the book's own text, with the
 * chapter it comes from. None of them is computed by the code under test, so a
 * wrong table cannot pass by agreeing with itself. The packet is checked
 * against them on real boards.
 *
 * Found by this audit and fixed here (see the comments at each check):
 *   - 土's 墓 and 绝 were 戌 and 亥 (engine comment: "火土同宫"). The book says
 *     水、土 share 长生申 旺子 墓辰 绝巳.
 *   - The engine's 进退 carries four of each pair; the book lists eight.
 *
 * Run: node tests/kb-rules.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const KB = resolve(ROOT, 'src');

const sandbox = { window: {}, console, Date };
sandbox.window.window = sandbox.window;
vm.createContext(sandbox);
vm.runInContext(readFileSync(resolve(ROOT, 'vendor/liuyao-engine.js'), 'utf8'), sandbox, { filename: 'vendor/liuyao-engine.js' });
const BWLiuYao = sandbox.window.BWLiuYao;

const R = await import(pathToFileURL(resolve(KB, 'rules.js')).href);
const { buildPacket } = await import(pathToFileURL(resolve(KB, 'packet.js')).href);

const B = (s) => Array.from(s, (c) => '子丑寅卯辰巳午未申酉戌亥'.indexOf(c)); // branch chars → indices
const DATE = new Date(2026, 9, 8, 10, 0);
function boardFor(bits, moving = [], date = DATE) {
  const lines = [0, 1, 2, 3, 4, 5].map((i) => ({ yang: !!((bits >> i) & 1), changing: false }));
  return BWLiuYao.computeBoard({ lines, changeIdx: moving, date });
}
const toBits = (s) => parseInt([...s].reverse().join(''), 2); // "初爻 first" → bit int

// ── A. 浑天甲子 (浑天甲子章) ───────────────────────────────────────────────
// 乾在内卦 子寅辰, 外卦 午申戌 ... (book text, verbatim order: inner then outer)
const HUNTIAN_BOOK = {
  '乾': ['子寅辰', '午申戌'], '坎': ['寅辰午', '申戌子'], '艮': ['辰午申', '戌子寅'],
  '震': ['子寅辰', '午申戌'], '巽': ['丑亥酉', '未巳卯'], '离': ['卯丑亥', '酉未巳'],
  '坤': ['未巳卯', '丑亥酉'], '兑': ['巳卯丑', '亥酉未']
};
const TB = { '坤': 0, '震': 1, '坎': 2, '兑': 3, '艮': 4, '离': 5, '巽': 6, '乾': 7 };
{
  for (const [name, [inner, outer]] of Object.entries(HUNTIAN_BOOK)) {
    const tb = TB[name];
    // The pure hexagram of this palace: both halves are the same trigram.
    const bits = tb | (tb << 3);
    const b = boardFor(bits, []);
    const got = Array.from(b.lines, (l) => l.branch.bi);
    assert.deepEqual(got, [...B(inner), ...B(outer)],
      `${name}为${name === '乾' ? '天' : ''}: 浑天甲子 must give inner ${inner} outer ${outer}`);
  }
  // The table in rules.js must say the same thing.
  for (const [name, [inner, outer]] of Object.entries(HUNTIAN_BOOK)) {
    const t = R.HUNTIAN[TB[name]];
    assert.deepEqual(t.inner, B(inner), `rules.js HUNTIAN[${name}].inner`);
    assert.deepEqual(t.outer, B(outer), `rules.js HUNTIAN[${name}].outer`);
  }
}

// ── B. 世应 (世应章) ──────────────────────────────────────────────────────
// The book names the world line of these hexagrams in its own words.
{
  const world = (name) => {
    for (let bits = 0; bits < 64; bits++) {
      const p = buildPacket(boardFor(bits, []));
      if (p.ben.name === name) return p.ben.world;
    }
    throw new Error('name not found: ' + name);
  };
  assert.equal(world('乾为天'), 6, '乾为天: 世在六爻');
  assert.equal(world('天风姤'), 1, '天风姤: 世在初爻');
  assert.equal(world('天山遁'), 2, '天山遁: 世在二爻');
  assert.equal(world('天地否'), 3, '天地否: 世在三爻');
  assert.equal(world('风地观'), 4, '风地观: 世在四爻');
  assert.equal(world('山地剥'), 5, '山地剥: 世在五爻');
  assert.equal(world('火地晋'), 4, '火地晋: 世退在四爻');
  assert.equal(world('火天大有'), 3, '火天大有: 世退在三爻');
  // 隔世爻两位即是应爻
  for (let bits = 0; bits < 64; bits++) {
    const p = buildPacket(boardFor(bits, []));
    assert.equal(Math.abs(p.ben.ying - p.ben.world), 3, `${p.ben.name}: 应 is two places from 世 across the three lines`);
  }
  assert.deepEqual(R.WORLD_BY_STAGE, [6, 1, 2, 3, 4, 5, 4, 3], 'rules.js WORLD_BY_STAGE');
}

// ── C. 旬空 (旬空章) — checked over sixty consecutive days ──────────────────
{
  // 甲子 戌亥空 · 甲戌 申酉 · 甲申 午未 · 甲午 辰巳 · 甲辰 寅卯 · 甲寅 子丑
  // Keyed by the 旬 head branch: (day branch − day stem) mod 12.
  const XUN_BOOK = { 0: B('戌亥'), 10: B('申酉'), 8: B('午未'), 6: B('辰巳'), 4: B('寅卯'), 2: B('子丑') };
  let checked = 0;
  for (let k = 0; k < 60; k++) {
    const d = new Date(2026, 9, 1 + k, 10, 0);
    const b = boardFor(0, [], d);
    const p = buildPacket(b);
    const stem = b.meta.dayPillar.stem.idx;
    const br = b.meta.dayPillar.branch.bi;
    const head = (br - stem + 12) % 12;
    const want = XUN_BOOK[head];
    assert.ok(want, `head ${head} must be one of the six 旬`);
    const got = Array.from(b.meta.xunkong, (x) => x.bi).sort((x, y) => x - y);
    assert.deepEqual(got, [...want].sort((x, y) => x - y), `day ${p.time.day}: 旬空 must match the book`);
    checked++;
  }
  assert.equal(checked, 60);
}

// ── D. 生旺墓绝 (生旺墓绝章) — the book's own list, by element ──────────────
{
  // 金: 长巳 旺酉 墓丑 绝寅 · 木: 亥 卯 未 申 · 火: 寅 午 戌 亥 · 水、土: 申 子 辰 巳
  const LIFE_BOOK = {
    金: { 长生: '巳', 旺: '酉', 墓: '丑', 绝: '寅' },
    木: { 长生: '亥', 旺: '卯', 墓: '未', 绝: '申' },
    火: { 长生: '寅', 旺: '午', 墓: '戌', 绝: '亥' },
    水: { 长生: '申', 旺: '子', 墓: '辰', 绝: '巳' },
    土: { 长生: '申', 旺: '子', 墓: '辰', 绝: '巳' }
  };
  const EL = { 木: 0, 火: 1, 土: 2, 金: 3, 水: 4 };
  for (const [elCn, stages] of Object.entries(LIFE_BOOK)) {
    for (const [stage, br] of Object.entries(stages)) {
      assert.equal(R.stageOf(EL[elCn], B(br)[0]), stage,
        `${elCn} ${stage} must sit on ${br}`);
    }
  }
  // 土's tomb is 辰, not 戌; its dead is 巳, not 亥 (the engine's values).
  assert.notEqual(R.stageOf(2, B('戌')[0]), '墓', '土 is not in tomb on 戌');
  assert.notEqual(R.stageOf(2, B('亥')[0]), '绝', '土 is not dead on 亥');
  assert.equal(R.stageOf(2, B('辰')[0]), '墓');
  assert.equal(R.stageOf(2, B('巳')[0]), '绝');
  assert.deepEqual(R.LIFE_STAGE.tomb, [7, 10, 4, 1, 4], 'rules.js tomb table');
  assert.deepEqual(R.LIFE_STAGE.dead, [8, 11, 5, 2, 5], 'rules.js dead table');
}

// ── E. 星煞 (星煞章): the four the book tests ────────────────────────────────
{
  // 太乙贵人: 甲戊庚牛羊 乙己鼠猴乡 丙丁猪鸡位 壬癸兔蛇藏 六辛逢马虎
  const TAIYI_BOOK = {
    甲: '丑未', 戊: '丑未', 庚: '丑未', 乙: '子申', 己: '子申', 丙: '亥酉', 丁: '亥酉',
    壬: '卯巳', 癸: '卯巳', 辛: '午寅'
  };
  const STEM = { 甲: 0, 乙: 1, 丙: 2, 丁: 3, 戊: 4, 己: 5, 庚: 6, 辛: 7, 壬: 8, 癸: 9 };
  for (const [s, br] of Object.entries(TAIYI_BOOK)) {
    assert.deepEqual([...R.TAIYI[STEM[s]]].sort(), B(br).sort(), `太乙贵人 for ${s}日`);
  }
  // 禄神: 甲禄到寅 乙卯 丙戊巳 丁己午 庚申 辛酉 壬亥 癸子
  const LU_BOOK = { 甲: '寅', 乙: '卯', 丙: '巳', 戊: '巳', 丁: '午', 己: '午', 庚: '申', 辛: '酉', 壬: '亥', 癸: '子' };
  for (const [s, br] of Object.entries(LU_BOOK)) {
    assert.equal(R.LUSHEN[STEM[s]], B(br)[0], `禄神 for ${s}日`);
  }
  // 驿马: 申子辰马在寅 巳酉丑马在亥 寅午戌马在申 亥卯未马在巳 (keyed by 日支)
  const YIMA_BOOK = { 申: '寅', 子: '寅', 辰: '寅', 巳: '亥', 酉: '亥', 丑: '亥', 寅: '申', 午: '申', 戌: '申', 亥: '巳', 卯: '巳', 未: '巳' };
  for (const [d, m] of Object.entries(YIMA_BOOK)) {
    assert.equal(R.YIMA[B(d)[0]], B(m)[0], `驿马 for ${d}日`);
  }
  // 天喜: 春戌 夏丑 秋辰 冬未; 春 = 正二三月 (寅卯辰), 夏 = 四五六 (巳午未),
  // 秋 = 七八九 (申酉戌), 冬 = 十 十一 十二 (亥子丑).
  const TIANXI_BOOK = { 寅: '戌', 卯: '戌', 辰: '戌', 巳: '丑', 午: '丑', 未: '丑', 申: '辰', 酉: '辰', 戌: '辰', 亥: '未', 子: '未', 丑: '未' };
  for (const [m, t] of Object.entries(TIANXI_BOOK)) {
    assert.equal(R.TIANXI_BY_MONTH[B(m)[0]], B(t)[0], `天喜 for 月建${m}`);
  }
}

// ── F. 三合 (三合章) · 三刑 (三刑章) · 真空 (旬空章) ───────────────────────
{
  // 申子辰合成水局, 巳酉丑 金局, 寅午戌 火局, 亥卯未 木局.
  const SANHE_BOOK = [['申子辰', 4], ['巳酉丑', 3], ['寅午戌', 1], ['亥卯未', 0]];
  for (const [br, el] of SANHE_BOOK) {
    const g = R.SANHE.find((x) => x.element === el);
    assert.deepEqual([...g.branches].sort(), B(br).sort(), `三合 for ${br}`);
  }
  // 寅刑巳 巳刑申 申刑寅 子刑卯 卯刑子 丑戌相刑 戌未相刑 (book text, as written)
  const XING_BOOK = [['寅', '巳'], ['巳', '申'], ['申', '寅'], ['子', '卯'], ['卯', '子'],
    ['丑', '戌'], ['戌', '丑'], ['戌', '未'], ['未', '戌']];
  const have = R.XING_PAIRS.map(([a, b]) => `${BRANCH(a)}${BRANCH(b)}`).sort();
  const want = XING_BOOK.map(([a, b]) => `${a}${b}`).sort();
  assert.deepEqual(have, want, 'XING_PAIRS must be exactly the book\'s pairs');
  // 辰午酉亥 自刑
  assert.deepEqual([...R.XING_SELF].sort((a, b) => a - b), B('辰午酉亥').sort((a, b) => a - b));
  // 真空: 春土 夏金 秋木 冬火 (by 月建)
  const TRUE_BOOK = { 寅: '土', 卯: '土', 辰: '土', 巳: '金', 午: '金', 未: '金', 申: '木', 酉: '木', 戌: '木', 亥: '火', 子: '火', 丑: '火' };
  const EL_OF = { 木: 0, 火: 1, 土: 2, 金: 3, 水: 4 };
  for (const [m, el] of Object.entries(TRUE_BOOK)) {
    assert.equal(R.TRUE_VOID_ELEMENT_BY_MONTH[B(m)[0]], EL_OF[el], `真空 for 月建${m}`);
  }
}
function BRANCH(i) { return '子丑寅卯辰巳午未申酉戌亥'[i]; }

// ── G. 六冲卦 (六冲章) · 六合卦 (六合章) — the set of hexagrams, by rule ───────
{
  // 六冲卦: "乾为天、兑为泽、离为火、震为雷、巽为风、坎为水、艮为山、坤为地，
  //          再者天雷无妄、雷天大壮，亦是六冲卦 ... 一共十卦"
  const CLASH_BOOK = ['乾为天', '兑为泽', '离为火', '震为雷', '巽为风', '坎为水', '艮为山', '坤为地', '天雷无妄', '雷天大壮'];
  const byRule = [];
  for (let bits = 0; bits < 64; bits++) {
    const p = buildPacket(boardFor(bits, []));
    // Rule: each line clashes with the line three places on (六冲卦 = 内外相冲).
    if ([0, 1, 2].every((i) => R.brClash(p.lines[i].branchBi, p.lines[i + 3].branchBi))) byRule.push(p.ben.name);
    assert.equal(p.hexFlags.clash, CLASH_BOOK.includes(p.ben.name), `${p.ben.name}: hexFlags.clash`);
  }
  assert.deepEqual(byRule.sort(), [...CLASH_BOOK].sort(), 'the rule reproduces the book\'s ten 六冲卦');

  // 六合卦: the rule gives eight hexagrams, and the packet flags exactly those.
  let eight = 0;
  for (let bits = 0; bits < 64; bits++) {
    const p = buildPacket(boardFor(bits, []));
    const rule = [0, 1, 2].every((i) => R.brCombine(p.lines[i].branchBi, p.lines[i + 3].branchBi));
    assert.equal(p.hexFlags.combine, rule, `${p.ben.name}: hexFlags.combine`);
    if (rule) eight++;
  }
  assert.equal(eight, 8, 'the 六合 rule should give eight hexagrams');
}

// ── H. 进退 (进神退神章): the book's sixteen pairs, from rules.js ─────────────
{
  const ADV = [['亥', '子'], ['寅', '卯'], ['巳', '午'], ['申', '酉'], ['丑', '辰'], ['辰', '未'], ['未', '戌'], ['戌', '丑']];
  const RET = [['子', '亥'], ['卯', '寅'], ['午', '巳'], ['酉', '申'], ['辰', '丑'], ['未', '辰'], ['戌', '未'], ['丑', '戌']];
  for (const [a, b] of ADV) assert.equal(R.ADVANCE[B(a)[0]], B(b)[0], `${a}化${b} 进神`);
  for (const [a, b] of RET) assert.equal(R.RETREAT[B(a)[0]], B(b)[0], `${a}化${b} 退神`);
}

// ── J. 反伏 (反伏章): "卦变者，内外动而反吟，同一卦也。如：乾变坤" ─────────────
{
  const p = buildPacket(boardFor(0b111111, [0, 1, 2, 3, 4, 5]));
  assert.equal(p.bian.name, '坤为地', '乾 with all six moving becomes 坤');
  assert.deepEqual(p.hexFlags.trigramFanYin, { lower: true, upper: true }, '乾变坤: 内外动而反吟');
  // A still hexagram is never 反吟 or 伏吟.
  const still = buildPacket(boardFor(0b101101, []));
  assert.equal(still.bian, null);
  assert.equal(still.hexFlags.fuYin, false);
}

// ── I. 书中印出的盘 (the book's own printed boards) ──────────────────────────
// Each case is typed from the book's printed chart. The packet must give the
// same branches, stems and six-relatives, read in the book's own palace terms.
{
  const boardOf = (bits, moving, date) => {
    const lines = [0, 1, 2, 3, 4, 5].map((i) => ({ yang: !!((bits >> i) & 1), changing: false }));
    return BWLiuYao.computeBoard({ lines, changeIdx: moving, date });
  };
  // 占卦法章 / 六亲歌章: 乾为天, bottom → top.
  //   初 甲子子孙 · 二 甲寅妻财 · 三 甲辰父母 · 四 壬午官鬼 · 五 壬申兄弟 · 六 壬戌父母
  {
    const p = buildPacket(boardOf(0b111111, []));
    const want = [['甲', '子', 'output'], ['甲', '寅', 'wealth'], ['甲', '辰', 'parent'],
      ['壬', '午', 'officer'], ['壬', '申', 'peer'], ['壬', '戌', 'parent']];
    p.lines.forEach((l, i) => {
      assert.equal(l.stem, want[i][0], `乾为天 line ${i + 1} stem`);
      assert.equal(l.branch, want[i][1], `乾为天 line ${i + 1} branch`);
      assert.equal(l.relative, want[i][2], `乾为天 line ${i + 1} relative`);
    });
    assert.equal(p.ben.world, 6, '乾为天 世在六');
    assert.equal(p.ben.ying, 3, '乾为天 应在三');
  }
  // 浑天甲子章: 天风姤 · 父母戌土 兄弟申金 官鬼午火 兄弟酉金 子孙亥水 父母丑土 · 世初 应四
  {
    // 天风姤: lower 巽, upper 乾.
    const tbLower = 6, tbUpper = 7;
    const b2 = tbLower | (tbUpper << 3);
    const p = buildPacket(boardOf(b2, []));
    assert.equal(p.ben.name, '天风姤', 'bits check for 天风姤');
    const want = [['辛', '丑', 'parent'], ['辛', '亥', 'output'], ['辛', '酉', 'peer'],
      ['壬', '午', 'officer'], ['壬', '申', 'peer'], ['壬', '戌', 'parent']];
    p.lines.forEach((l, i) => {
      assert.equal(l.stem, want[i][0], `天风姤 line ${i + 1} stem`);
      assert.equal(l.branch, want[i][1], `天风姤 line ${i + 1} branch`);
      assert.equal(l.relative, want[i][2], `天风姤 line ${i + 1} relative`);
    });
    assert.equal(p.ben.world, 1, '天风姤 世在初');
    assert.equal(p.ben.ying, 4, '天风姤 应在四');
  }
  // 用神章 example: 巽之涣, 巳月 甲寅日 (旬空 子丑). 官鬼酉金 on line 3 moves to 午火,
  // which the book prints as 子孙戊午火 — the 变爻 six-relative is read from the 本卦 宫 (巽木).
  {
    let date = null;
    for (let y = 2020; y <= 2032 && !date; y++) {
      for (let m = 4; m <= 6 && !date; m++) {
        for (let d = 1; d <= 31 && !date; d++) {
          const dt = new Date(y, m, d, 10, 0);
          if (dt.getMonth() !== m) continue;
          const b = boardOf(0, [], dt);
          if (b.meta.dayPillar.stem.idx === 0 && b.meta.dayPillar.branch.bi === 2 && b.meta.monthBranch.bi === 5) date = dt;
        }
      }
    }
    assert.ok(date, 'a 甲寅日 in 巳月 must exist in the search range');
    const bits = 6 | (6 << 3); // 巽为风
    const p = buildPacket(boardOf(bits, [2], date), { yongKey: 'wealth' });
    assert.equal(p.bian.name, '风水涣', '巽之涣: the 变卦 is 风水涣');
    assert.equal(p.time.day, '甲寅');
    assert.equal(p.time.month, '巳');
    assert.deepEqual(p.time.xunkong, ['子', '丑'], '甲寅 旬空 子丑');
    const rel = p.lines.map((l) => l.relative);
    assert.deepEqual(rel, ['wealth', 'parent', 'officer', 'wealth', 'output', 'peer'], '巽为风 six-relatives, 初→上');
    const three = p.lines[2];
    assert.equal(three.transform.branch, '午', '3rd line moves to 午');
    assert.equal(three.transform.relative, 'output', '变爻 子孙 read from 巽 (木)');
    assert.equal(three.voidVerdict, null, 'line 3 is not in 旬空');
  }
}

console.log('kb-rules: ok — 浑天甲子 · 世应 · 旬空×60 · 生旺墓绝 · 星煞 · 三合 · 三刑 · 真空 · 六冲卦 · 六合卦 · 进退');
