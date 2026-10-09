/* 卦况包 (casting packet) — every fact of a casting that the book's rules
   compute, in the book's own terms, for the model stages to read.
   ────────────────────────────────────────────────────────────────────────
   PURE. Input: the board from BWLiuYao.computeBoard(). Output: one plain
   object. No judgment is made here: 旺衰 weighing, 用神 choice, 应期 and the
   reading itself belong to the model stages. A fact is included when the book
   states the rule that produces it, and the rule's chapter is named in
   `sources` so the model can be shown the rule text next to the fact.

   Where this module departs from the engine it says so inline. The book is
   the authority; the engine has three known gaps (进退 table, 土's 墓/绝, and
   the 变卦 tomb flags), and this packet computes those from rules.js instead.
*/
import { classifyFacts, factTokens } from './facts.js';
import { boardFeatures } from './features.js';
import {
  BRANCH_CN, ELEMENT_CN, BR_EL, HUNTIAN, SANHE, XING_PAIRS,
  XING_SELF, YIMA, LUSHEN, TAIYI, TIANXI_BY_MONTH, TRUE_VOID_ELEMENT_BY_MONTH,
  STEM_CN, TRIAD_OF_BI, CANDIDATE_RULES,
  ADVANCE, RETREAT, SIX_CLASH_NAMES, brClash, brCombine, wangRank, relOf, stageOf
} from './rules.js';

export const PACKET_SCHEMA = 2;

// Trigram → the word that opens a hexagram's name (上卦, then 下卦).
export const NATURE = {
  Heaven: '天', Earth: '地', Thunder: '雷', Wind: '风',
  Water: '水', Fire: '火', Mountain: '山', Lake: '泽'
};

/* 八宫卦吊, 增删卜易 卷一, in the book's own order: eight palaces, eight
   hexagrams each (纯卦, 一世…五世, 游魂, 归魂). The names are the book's text,
   not derived: 地天泰 is not "地" + "天" + anything a rule would produce. */
const PALACE_ORDER = [7, 2, 4, 1, 6, 5, 0, 3]; // 乾 坎 艮 震 巽 离 坤 兑 (trigram tb)
const BOOK_NAMES = [
  '乾为天', '天风姤', '天山遁', '天地否', '风地观', '山地剥', '火地晋', '火天大有',
  '坎为水', '水泽节', '水雷屯', '水火既济', '泽火革', '雷火丰', '地火明夷', '地水师',
  '艮为山', '山火贲', '山天大畜', '山泽损', '火泽睽', '天泽履', '风泽中孚', '风山渐',
  '震为雷', '雷地豫', '雷水解', '雷风恒', '地风升', '水风井', '泽风大过', '泽雷随',
  '巽为风', '风天小畜', '风火家人', '风雷益', '天雷无妄', '火雷噬嗑', '山雷颐', '山风蛊',
  '离为火', '火山旅', '火风鼎', '火水未济', '山水蒙', '风水涣', '天水讼', '天火同人',
  '坤为地', '地雷复', '地泽临', '地天泰', '雷天大壮', '泽天夬', '水天需', '水地比',
  '兑为泽', '泽水困', '泽地萃', '泽山咸', '水山蹇', '地山谦', '雷山小过', '雷泽归妹'
];

/* Bit pattern of the k-th hexagram in a palace (k = 0..7), by the 八宫 rule:
   纯卦 is the palace trigram on both halves; 一世…五世 turn lines 1…k
   cumulatively; 游魂 is 五世 with line 4 turned; 归魂 is 游魂 with lines 1–3
   turned. tests/kb-packet.mjs checks the result against the book's list. */
function palaceBits(palaceTb, k) {
  const lines = [0, 1, 2, 3, 4, 5].map((i) => (palaceTb >> (i % 3)) & 1);
  const turn = (i) => { lines[i] ^= 1; };
  for (let i = 0; i < Math.min(k, 5); i++) turn(i);
  if (k === 6) turn(3);
  if (k === 7) { turn(3); turn(0); turn(1); turn(2); }
  return lines.reduce((n, b, i) => n | (b << i), 0);
}

const NAME_BY_BITS = new Map();
PALACE_ORDER.forEach((tb, p) => {
  for (let k = 0; k < 8; k++) NAME_BY_BITS.set(palaceBits(tb, k), BOOK_NAMES[p * 8 + k]);
});
if (NAME_BY_BITS.size !== 64) throw new Error('八宫 table does not cover 64 hexagrams');

export function nameOfBits(bits) {
  return NAME_BY_BITS.get(bits);
}

/* 进神 / 退神 (进神退神章), from rules.js. */
export function jinTuiOf(fromBranch, toBranch) {
  const a = BRANCH_CN.indexOf(fromBranch), b = BRANCH_CN.indexOf(toBranch);
  if (ADVANCE[a] === b) return '进神';
  if (RETREAT[a] === b) return '退神';
  return null;
}

function bitsOf(lines) { return lines.map((l) => (l.yang ? '1' : '0')).join(''); }
function intOf(lines) { return lines.reduce((n, l, i) => n | ((l.yang ? 1 : 0) << i), 0); }
const pos1 = (i) => i + 1;

/* 空 verdict (旬空章, 野鹤曰). The book lists what makes a 旬空 line void and what
   makes it not void, without an order between them. The order used here, which
   the owner should confirm:
     1. 月破 or 真空 → void (the book states both outright).
     2. otherwise, any "不为空" condition → not void.
     3. otherwise → void. */
function voidVerdict(xunSet, line, monthBi, monthEl, dayEl, hidden) {
  if (!xunSet.has(line.bi)) return { inXunkong: false, verdict: null, notVoid: [], voidBy: [] };
  const notVoid = [];
  const voidBy = [];
  if (line.wang === 4) notVoid.push('旺不为空');
  if (line.moving) notVoid.push('动不为空');
  if (line.moving && line.transform && xunSet.has(line.transform.bi)) notVoid.push('动而化空，不为空');
  for (const h of hidden) {
    if (wangRank(h.el, monthEl) >= 3) notVoid.push('伏而旺相，不为空');
    if (h.flyControlsHidden) voidBy.push('伏而被克，为空');
  }
  if (relOf(line.el, dayEl) === 'parent') notVoid.push('日建生扶，不为空');
  if (line.bi === monthBi) notVoid.push('值月建，逢空不空');
  if (brClash(line.bi, monthBi)) voidBy.push('月破，为空');
  if (!line.moving && line.wang >= 2) voidBy.push('有气不动，为空');
  const trueVoidNow = line.el === TRUE_VOID_ELEMENT_BY_MONTH[monthBi];
  if (trueVoidNow) voidBy.push('真空，为空');
  let verdict;
  if (voidBy.some((t) => t.startsWith('月破') || t.startsWith('真空'))) verdict = 'void';
  else if (notVoid.length) verdict = 'notVoid';
  else verdict = 'void';
  return { inXunkong: true, verdict, notVoid, voidBy };
}

export function buildPacket(board, opts = {}) {
  if (!board || !Array.isArray(board.lines) || board.lines.length !== 6) {
    throw new Error('buildPacket: expected a computed board with six lines');
  }
  const meta = board.meta;
  // Arrays built from the board are copied with Array.from. A board computed
  // inside a vm sandbox has arrays from another realm, and their .map/.filter
  // results keep that realm, which breaks deepStrictEqual on the packet.
  const benLines = Array.from(board.lines, (l) => ({ yang: l.yang, moving: !!l.moving }));
  const bianLines = Array.from(benLines, (l) => ({ yang: l.moving ? !l.yang : l.yang }));
  const benInt = intOf(benLines);
  const benName = nameOfBits(benInt);
  if (!benName) throw new Error(`no 八宫 name for bits ${benInt}`);
  const bianName = board.bian ? nameOfBits(intOf(bianLines)) : null;

  const dayStem = meta.dayPillar.stem.idx;
  const dayBi = meta.dayPillar.branch.bi;
  const dayEl = BR_EL[dayBi];
  const monthBi = meta.monthBranch.bi;
  const monthEl = BR_EL[monthBi];
  const xunSet = new Set(Array.from(meta.xunkong || [], (b) => b.bi));
  const movingPos = Array.from(board.lines).filter((l) => l.moving).map((l) => pos1(l.idx));
  const palaceEl = board.ben.palace.element.gi;

  // ── lines ───────────────────────────────────────────────────────────────
  const hiddenAt = (p) => Array.from(board.hidden || []).filter((h) => h.position === p);
  const lines = Array.from(board.lines, (l) => {
    const pos = pos1(l.idx);
    const bi = l.branch.bi;
    const el = BR_EL[bi];
    const moving = !!l.moving;
    const t = l.transform;
    const tBi = t ? t.branch.bi : null;
    const tEl = t ? BR_EL[tBi] : null;
    const hidden = hiddenAt(pos).map((h) => ({
      relative: h.relative.key,
      branch: h.hiddenBranch.cn,
      el: h.hiddenBranch.el.gi,
      flyBranch: h.flyingBranch.cn,
      flyRelative: h.flyingRelative.key,
      flyGeneratesHidden: !!h.flyGeneratesHidden,
      flyControlsHidden: !!h.flyControlsHidden,
      hiddenControlsFly: !!h.hiddenControlsFly
    }));
    const wang = wangRank(el, monthEl);
    const line = { bi, el, moving, wang };
    const dayStage = stageOf(el, dayBi);
    const changeStage = moving ? stageOf(el, tBi) : null;
    const v = voidVerdict(xunSet, { ...line, transform: t ? { bi: tBi } : null }, monthBi, monthEl, dayEl, hidden);
    return {
      pos,
      yang: !!l.yang,
      moving,
      stem: l.stem.cn,
      stemIdx: l.stem.idx,
      branch: l.branch.cn,
      branchBi: bi,
      element: ELEMENT_CN[el],
      elementGi: el,
      relative: l.relative.key,
      spirit: l.spirit.cn,
      wangShuai: { cn: l.wangShuai.cn, rank: wang },
      monthRank: bi === monthBi ? '月建' : el === monthEl ? '同五行次之' : null,
      toMonth: relOf(el, monthEl),       // how the 月建 stands to this line (六亲 terms)
      toDay: relOf(el, dayEl),           // how the 日辰 stands to this line
      monthBreak: brClash(bi, monthBi),  // 月建冲爻 = 月破 (月破章)
      monthCombine: brCombine(bi, monthBi),
      dayClash: brClash(bi, dayBi),
      dayCombine: brCombine(bi, dayBi),
      trueVoid: el === TRUE_VOID_ELEMENT_BY_MONTH[monthBi],
      fuYin: moving && t ? tBi === bi : false,        // 爻伏吟: 变爻 keeps the branch (反伏章)
      fanYin: moving && t ? brClash(tBi, bi) : false, // 爻反吟: 变爻 clashes the branch
      void: xunSet.has(bi),
      voidVerdict: v.verdict,
      voidNotVoidBy: v.notVoid,
      voidBy: v.voidBy,
      dayStage,                          // 长生 / 旺 / 墓 / 绝 by the 日辰 (生旺墓绝章)
      changeStage,                       // the same, for the 变爻's branch on this line's element
      tombs: {                           // 三墓 (随鬼入墓章: 日墓、动墓、化墓)
        day: dayStage === '墓',
        moving: moving && stageOf(el, bi) === '墓',
        change: changeStage === '墓'
      },
      hidden,
      transform: t && moving ? {
        stem: t.stem.cn,
        branch: t.branch.cn,
        branchBi: tBi,
        element: ELEMENT_CN[tEl],
        relative: relOf(palaceEl, tEl),  // 变爻 six-relative is read from the 本卦 palace (动变章)
        jinTui: jinTuiOf(l.branch.cn, t.branch.cn),
        backToTomb: changeStage === '墓',
        backToVoid: xunSet.has(tBi),
        backToSheng: relOf(el, tEl) === 'parent',   // 回头生: change generates original
        backToKe: relOf(el, tEl) === 'officer',     // 回头克: change controls original
        clashBen: brClash(bi, tBi),
        combineBen: brCombine(bi, tBi)
      } : null
    };
  });

  // ── hexagram-level ─────────────────────────────────────────────────────
  const hexClash = SIX_CLASH_NAMES.includes(benName);
  // 六合卦 (六合章): 内外六爻自相和合 — every line pairs with the one three places on.
  const hexCombine = [0, 1, 2].every((i) => brCombine(lines[i].branchBi, lines[i + 3].branchBi));
  const bianClash = bianName ? SIX_CLASH_NAMES.includes(bianName) : false;
  const bianCombine = bianLines.length && board.bian
    ? [0, 1, 2].every((i) => {
      const a = lines[i].moving ? lines[i].transform.branchBi : lines[i].branchBi;
      const b = lines[i + 3].moving ? lines[i + 3].transform.branchBi : lines[i + 3].branchBi;
      return brCombine(a, b);
    })
    : false;
  // 六冲卦变六合 etc. (六冲章 四五, 六合章 五六): the book's named transitions.
  const hexTransitions = [];
  if (hexCombine && bianClash) hexTransitions.push('六合卦变六冲');
  if (hexClash && bianClash) hexTransitions.push('六冲卦变六冲');
  if (hexClash && bianCombine) hexTransitions.push('六冲卦变六合');
  if (hexCombine && bianCombine) hexTransitions.push('六合卦变六合');
  // 反吟 at the hexagram level (反伏章): the 变 trigram is the complement of the 本 trigram
  // (all three lines turned). 伏吟: the 变卦 keeps every line's element (地爻五行不变).
  const tbOf = (x) => x.tb;
  const complement = (tb) => 7 - tb;
  const trigramFanYin = board.bian ? {
    lower: tbOf(board.bian.lower) === complement(tbOf(board.ben.lower)),
    upper: tbOf(board.bian.upper) === complement(tbOf(board.ben.upper))
  } : null;
  const hexFuYin = !!board.bian && lines.some((l) => l.moving)
    && lines.every((l) => (l.moving ? BR_EL[l.transform.branchBi] : l.elementGi) === l.elementGi);

  // ── relations among the lines (冲 · 合 · 刑 · 三合) ────────────────────
  const chong = [];
  const he = [];
  const xing = [];
  for (let i = 0; i < 6; i++) {
    for (let j = i + 1; j < 6; j++) {
      const a = lines[i], b = lines[j];
      if (brClash(a.branchBi, b.branchBi)) {
        chong.push({ a: a.pos, b: b.pos, moving: [a.moving, b.moving] });
      }
      if (brCombine(a.branchBi, b.branchBi)) {
        const type = a.moving || b.moving ? '合绊' : '合好';
        he.push({ a: a.pos, b: b.pos, type });
      }
    }
  }
  for (const a of lines) {
    for (const b of lines) {
      if (a.pos !== b.pos && XING_PAIRS.some(([x, y]) => x === a.branchBi && y === b.branchBi)) {
        xing.push({ from: a.pos, to: b.pos, self: null });
      }
    }
    if (XING_SELF.includes(a.branchBi)) {
      for (const b of lines) {
        if (b.pos > a.pos && b.branchBi === a.branchBi) xing.push({ from: null, to: null, self: [a.pos, b.pos] });
      }
    }
  }

  // 五行 relations between every pair of lines (五行相生章, 五行相克章, 动静生克章).
  const elements = [];
  for (const a of lines) {
    for (const b of lines) {
      if (a.pos === b.pos) continue;
      elements.push({ from: a.pos, to: b.pos, rel: relOf(a.elementGi, b.elementGi), moving: [a.moving, b.moving] });
    }
  }
  // 六合章: 合起 (静而逢合), 合绊 (动而逢合), 合好 (爻与爻合), 化扶 (爻动化合).
  for (const l of lines) {
    const kinds = [];
    const paired = he.filter((h) => h.a === l.pos || h.b === l.pos);
    const withMoonDay = l.monthCombine || l.dayCombine;
    if (!l.moving && (withMoonDay || paired.some((h) => lines[(h.a === l.pos ? h.b : h.a) - 1].moving))) kinds.push('合起');
    if (l.moving && (withMoonDay || paired.length)) kinds.push('合绊');
    if (paired.some((h) => h.type === '合好')) kinds.push('合好');
    if (l.moving && l.transform && l.transform.combineBen) kinds.push('化扶');
    l.heKinds = kinds;
    // 六冲章: 日月冲爻, 动爻变冲, 冲 between lines.
    l.chongKinds = [];
    if (l.dayClash) l.chongKinds.push('日冲');
    if (l.monthBreak) l.chongKinds.push('月冲');
    if (l.moving && l.transform && l.transform.clashBen) l.chongKinds.push('动爻变冲');
    if (chong.some((c) => c.a === l.pos || c.b === l.pos)) l.chongKinds.push('爻与爻冲');
  }

  // 三合 (三合章): a 局 counts when its three branches are all present on the
  // board, counting 变爻 branches and the 日辰/月建 as members.
  const members = (bi) => {
    const out = [];
    for (const l of lines) {
      if (l.branchBi === bi) out.push({ pos: l.pos, from: 'ben', moving: l.moving });
      if (l.moving && l.transform && l.transform.branchBi === bi) out.push({ pos: l.pos, from: 'bian', moving: true });
    }
    if (dayBi === bi) out.push({ pos: null, from: 'day', moving: false });
    if (monthBi === bi) out.push({ pos: null, from: 'month', moving: false });
    return out;
  };
  const sanhe = [];
  for (const g of SANHE) {
    const parts = g.branches.map(members);
    if (parts.every((p) => p.length > 0)) {
      sanhe.push({ cn: g.cn, parts });   // cn already names the 五行 (水局 …)
    }
  }

  // 暗动 / 日破 / 冲空即起 / 冲合即开 / 动散, per book sentence.
  const inHe = new Set(he.flatMap((h) => [h.a, h.b]));
  const dayEffects = lines.map((l) => {
    const effects = [];
    if (!l.moving && l.dayClash) effects.push(l.wangShuai.rank >= 3 ? '暗动' : '日破');
    if (l.void && l.dayClash) effects.push('冲空即起');
    if ((l.monthCombine || l.dayCombine || inHe.has(l.pos)) && l.dayClash) effects.push('冲合即开');
    if (l.moving && (l.dayClash || chong.some((c) => c.moving[0] && c.moving[1] && (c.a === l.pos || c.b === l.pos)))) {
      effects.push('动散候选');
    }
    return { pos: l.pos, effects };
  });

  // ── 神煞: the four the book tests (星煞章). ──────────────────────────
  const onLines = (bi) => lines.filter((l) => l.branchBi === bi).map((l) => l.pos);
  const shensha = {
    taiyi: { branches: TAIYI[dayStem].map((b) => BRANCH_CN[b]), lines: TAIYI[dayStem].flatMap(onLines) },
    lu: { branch: BRANCH_CN[LUSHEN[dayStem]], lines: onLines(LUSHEN[dayStem]) },
    yima: { branch: BRANCH_CN[YIMA[dayBi]], lines: onLines(YIMA[dayBi]) },
    tianxi: { branch: BRANCH_CN[TIANXI_BY_MONTH[monthBi]], lines: onLines(TIANXI_BY_MONTH[monthBi]) }
  };

  // ── 候选神煞: not from the book's own tests; flagged 待判断, never tokens. ─
  const candidates = CANDIDATE_RULES.map((rule) => {
    const key = rule.keyFrom === 'day-stem' ? STEM_CN[dayStem]
      : TRIAD_OF_BI[rule.keyFrom === 'month-branch' ? monthBi : dayBi];
    const target = rule.table[key] ?? null;
    let hit = [];
    if (target && rule.targetKind === 'branch') {
      hit = onLines(BRANCH_CN.indexOf(target));
    } else if (target && rule.targetKind === 'stem') {
      const si = STEM_CN.indexOf(target);
      hit = lines.filter((l) => l.stemIdx === si).map((l) => l.pos);
    }
    return {
      key: rule.key,
      basis: { 'day-branch': '日支', 'month-branch': '月支', 'day-stem': '日干' }[rule.keyFrom],
      target,
      targetKind: rule.targetKind,
      lines: hit,
      partial: !!rule.partial,
      source: rule.source,
      status: '待判断'
    };
  });

  // ── 独发 / 独静 (独发章) ─────────────────────────────────────────────────
  const movingCount = movingPos.length;
  const solo = movingCount === 1 ? '独发' : movingCount === 5 ? '独静' : null;

  // ── 用神 (用神章 · 元神忌神仇神 · 两现 · 飞伏神章) ───────────────────────
  let yong = null;
  if (opts.yongKey) {
    const key = opts.yongKey;
    // 自占 → 世爻; 占朋友、外人 → 应爻 (用神章); otherwise the six-relative.
    const yongLines = key === 'self'
      ? [pos1(board.ben.worldLi)]
      : key === 'ying'
        ? [pos1(board.ben.respLi)]
        : lines.filter((l) => l.relative === key).map((l) => l.pos);
    // The 用神's element is fixed by the palace, present or not (用神章: 六亲 by 本宫).
    const yongEl = key === 'self'
      ? lines[board.ben.worldLi].elementGi
      : key === 'ying'
        ? lines[board.ben.respLi].elementGi
        : [0, 1, 2, 3, 4].find((e) => relOf(palaceEl, e) === key);
    const absent = yongLines.length === 0;
    const yuanEl = yongEl === undefined ? undefined : (yongEl + 4) % 5;   // generates 用神
    const jiEl = yongEl === undefined ? undefined : (yongEl + 3) % 5;     // controls 用神
    const chouEl = yuanEl === undefined ? undefined : (yuanEl + 3) % 5;   // controls 元神
    const pick = (el) => (el === undefined ? [] : lines.filter((l) => l.elementGi === el).map((l) => l.pos));
    const yuanLines = pick(yuanEl);
    const jiLines = pick(jiEl);
    const chouLines = pick(chouEl);
    const factorsFor = (pos) => {
      const l = lines[pos - 1];
      const f = [];
      if (l.wangShuai.rank >= 3 || l.branchBi === monthBi || l.branchBi === dayBi || l.toDay === 'parent') f.push('旺相或临日月或日辰生扶');
      if (l.moving && l.transform && (l.transform.backToSheng || l.transform.jinTui === '进神')) f.push('化回头生或化进神');
      if (l.dayStage === '长生' || l.dayStage === '旺') f.push('日辰长生帝旺');
      if (l.moving && jiLines.some((p) => lines[p - 1].moving)) f.push('与忌神同动');
      if (l.moving && l.wangShuai.rank === 4 && (l.void || (l.transform && l.transform.backToVoid))) f.push('旺动临空化空');
      return f;
    };
    // 本宫首卦 = the palace's pure hexagram (飞伏神章: 用神不现 → 本宫首卦寻之).
    const pal = HUNTIAN[board.ben.palace.tb];
    const pureBranches = [...pal.inner, ...pal.outer];
    const pureLines = pureBranches.map((bi, i) => ({ pos: i + 1, branch: BRANCH_CN[bi], relative: relOf(palaceEl, BR_EL[bi]) }));
    const palaceFirst = {
      palace: board.ben.palace.cn,
      lines: pureLines,
      yongPos: pureLines.filter((x) => x.relative === key).map((x) => x.pos)
    };
    yong = {
      key,
      lines: yongLines,
      absent,
      liangXian: yongLines.length >= 2,
      fallback: absent ? { day: BRANCH_CN[dayBi], month: BRANCH_CN[monthBi], palaceFirst } : null,
      yuan: { lines: yuanLines, factors: yuanLines.map((pos) => ({ pos, factors: factorsFor(pos) })) },
      ji: { lines: jiLines },
      chou: { lines: chouLines }
    };
  }

  // ── per-line marks: what each 爻位 is, in every rule that names it ──────────
  // 世应 (世应章), 用神 role (用神章, 用神、元神、忌神、仇神章), 刑 · 合 · 冲 partners,
  // 三合 membership (三合章), 神煞 hits (星煞章), 暗动 · 日破 · 冲空 · 冲合 · 动散 (暗动章, 动散章).
  const roleOf = (pos) => {
    if (!yong) return null;
    if (yong.lines.includes(pos)) return '用神';
    if (yong.yuan.lines.includes(pos)) return '元神';
    if (yong.ji.lines.includes(pos)) return '忌神';
    if (yong.chou.lines.includes(pos)) return '仇神';
    return null;
  };
  const shenshaNames = [
    ['太乙贵人', shensha.taiyi.lines], ['禄神', shensha.lu.lines],
    ['驿马', shensha.yima.lines], ['天喜', shensha.tianxi.lines]
  ];
  for (const l of lines) {
    const pos = l.pos;
    l.world = pos === board.ben.worldLi + 1;
    l.ying = pos === board.ben.respLi + 1;
    l.yongRole = roleOf(pos);
    l.shensha = shenshaNames.filter(([, ps]) => ps.includes(pos)).map(([n]) => n);
    // A pair can be listed in both directions (子刑卯 and 卯刑子); each partner once.
    const unique = (xs) => Array.from(new Set(xs)).sort((a, b) => a - b);
    l.xingWith = unique(xing.filter((x) => x.self ? x.self.includes(pos) : (x.from === pos || x.to === pos))
      .map((x) => (x.self ? x.self.find((q) => q !== pos) : x.from === pos ? x.to : x.from)));
    l.heWith = unique(he.filter((h) => h.a === pos || h.b === pos).map((h) => (h.a === pos ? h.b : h.a)));
    l.chongWith = unique(chong.filter((c) => c.a === pos || c.b === pos).map((c) => (c.a === pos ? c.b : c.a)));
    l.sanheGroups = sanhe.filter((g) => g.parts.some((part) => part.some((m) => m.pos === pos))).map((g) => g.cn);
    const eff = dayEffects.find((d) => d.pos === pos);
    l.dayEffects = eff ? eff.effects : [];
  }

  const bianBlock = board.bian ? {
    bits: bitsOf(bianLines),
    name: bianName,
    palace: board.bian.palace.cn,
    // 变生 when the 变 palace generates the 本 palace (parent), 比和 when peer,
    // 变克 when the 变 palace controls the 本 palace (officer). Other directions
    // are not named in the book.
    bianVsBen: (() => {
      const r = relOf(palaceEl, board.bian.palace.element.gi);
      return r === 'parent' ? '变生' : r === 'peer' ? '变比和' : r === 'officer' ? '变克' : '本生变或本克变';
    })()
  } : null;

  const out = {
    schema: PACKET_SCHEMA,
    time: {
      date: meta.date,
      day: `${meta.dayPillar.stem.cn}${meta.dayPillar.branch.cn}`,
      dayStem,
      dayBranch: BRANCH_CN[dayBi],
      month: meta.monthBranch.cn,
      monthBranch: BRANCH_CN[monthBi],
      xunkong: Array.from(meta.xunkong || [], (b) => b.cn)
    },
    ben: {
      bits: bitsOf(benLines),
      name: benName,
      upper: board.ben.upper.cn,
      lower: board.ben.lower.cn,
      palace: board.ben.palace.cn,
      palaceElement: ELEMENT_CN[palaceEl],
      series: board.ben.series.cn,
      world: board.ben.worldLi + 1,
      ying: board.ben.respLi + 1
    },
    bian: bianBlock,
    moving: movingPos,
    solo,
    hexFlags: {
      clash: hexClash,
      combine: hexCombine,
      bianClash,
      bianCombine,
      transitions: hexTransitions,
      trigramFanYin,
      fuYin: hexFuYin
    },
    relations: { chong, he, xing, sanhe, dayEffects, elements },
    shensha,
    candidates,
    lines,
    yong,
    // The tokens the knowledge base matches on: the board's features plus the
    // 关系/状态 tokens from facts.js (set just below).
    tokens: []
  };
  // 关系 / 状态 split (facts.js). Computed from the packet itself, so it cannot disagree with it.
  out.facts = classifyFacts(out);
  out.tokens = [...new Set([...boardFeatures(board, opts), ...factTokens(out.facts)])].sort();
  return out;
}

