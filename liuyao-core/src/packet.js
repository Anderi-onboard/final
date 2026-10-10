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

/* 卦变 verdict (卦变生克墓绝章 L2060–2091). The book classifies a moving line by
   the relation between its own element (我) and its changed element (变):
     变生 (变生我)   化生 → 吉        L2070 “巽木变坎水，谓之化生…即以吉断”
     变克 (变克我)   化克 → 凶推      L2077 “震木变乾金，谓之化克…即以凶推”
                                      L2062 “凡遇卦化克者，不论用神之衰旺，皆以凶推”
     我克变         化去 → 不凶      L2084 “兑金变震木，谓之化去…不为凶也”
   Not judged, because the book names them but gives no verdict: 比和, 变墓, 变绝,
   and 我生变 (not in the list at all). Kept as `verdict: null` with a reason.
   OPEN ⚠: L2091 names 震木变兑金 “化来，他来克我，回头之克…诸占大凶”. It is the
   same relation as 化克 (变克我), so the book's 凶 vs 大凶 needs a stated test,
   which the book does not give. The 化克 verdict is kept as 凶 and flagged.
   L2189 (李我平): “此书只以回头克者为凶” — corroborates that 变克我 is the 凶 case. */
const CHANGE_RULES = {
  化生: { verdict: '吉', regardlessOfYong: false, source: 'L2070' },
  化克: { verdict: '凶', regardlessOfYong: true, source: 'L2062, L2077',
    open: '化来（L2091，诸占大凶）与化克同为变克我，原文未给区分标准' },
  化去: { verdict: '不凶', regardlessOfYong: false, source: 'L2084' }
};

function changeVerdictOf(el, tEl) {
  const rel = relOf(el, tEl);
  if (rel === 'parent') return { relation: '化生', ...CHANGE_RULES.化生, open: null };
  if (rel === 'officer') return { relation: '化克', ...CHANGE_RULES.化克 };
  if (rel === 'wealth') return { relation: '化去', ...CHANGE_RULES.化去, open: null };
  const reason = rel === 'peer' ? '比和：原文名目列出，未给判定'
    : '我生变：原文未列此种卦变';
  return { relation: rel === 'peer' ? '比和' : '我生变', verdict: null, regardlessOfYong: false, source: null, open: reason };
}

/* 忌神 verdict (用神章 L593, L598). Two lists, split by whether the 忌神 overcomes
   the 用神 (克害用神):
     有力 (动而克害用神): five reasons, 诸占大凶 — L593.
     无力 (动不克用神):   seven reasons, 诸占化凶为吉 — L598.
   Because the split is on whether it controls the 用神, the two lists cannot both
   hold for one line, and the order question does not arise. Open ⚠:
     · L598 says "忌神虽动" but its first reason lists 休囚不动; both are kept.
     · 化散 (L598 #6) has no field in the packet; not judged.
     · 用神要有气 (L598 按) is a precondition the book states; not applied here. */
const JI_RULES = {
  // 有力 (L593)
  '忌神旺相，或遇日月动爻生扶，或临日月': { cls: '自身/日月', side: '有力', source: 'L593',
    test: (l, c) => l.wangShuai.rank >= 3 || l.toDay === 'parent' || l.toMonth === 'parent' || c.movingGen || l.branchBi === c.dayBi || l.branchBi === c.monthBi },
  '忌神动，化回头生、化进神': { cls: '变', side: '有力', source: 'L593',
    test: (l) => l.moving && !!l.transform && (l.transform.backToSheng || l.transform.jinTui === '进神') },
  '忌神旺动，临空、化空': { cls: '空', side: '有力', source: 'L593',
    test: (l) => l.moving && l.wangShuai.rank === 4 && (l.void || (!!l.transform && l.transform.backToVoid)) },
  '忌神长生帝旺于日辰': { cls: '日辰', side: '有力', source: 'L593',
    test: (l) => l.dayStage === '长生' || l.dayStage === '旺' },
  '忌神与仇神同动': { cls: '动', side: '有力', source: 'L593',
    test: (l, c) => l.moving && c.chouMoving },
  // 无力 (L598)
  '忌神休囚不动，动而休囚被日月动爻克': { cls: '自身/日月', side: '无力', source: 'L598',
    test: (l) => l.wangShuai.rank <= 2 && (!l.moving || l.toDay === 'officer' || l.toMonth === 'officer') },
  '忌神静，临空破': { cls: '空破', side: '无力', source: 'L598',
    test: (l) => !l.moving && (l.void || l.monthBreak) },
  '忌神入三墓': { cls: '墓', side: '无力', source: 'L598',
    test: (l) => l.tombs.day || l.tombs.moving || l.tombs.change },
  '忌神衰，动化退神': { cls: '变', side: '无力', source: 'L598',
    test: (l) => l.wangShuai.rank <= 2 && l.moving && !!l.transform && l.transform.jinTui === '退神' },
  '忌神衰而又绝': { cls: '生旺墓绝', side: '无力', source: 'L598',
    test: (l) => l.wangShuai.rank <= 2 && l.dayStage === '绝' },
  '忌神动，化绝、化克、化破': { cls: '变', side: '无力', source: 'L598',
    test: (l) => l.moving && (l.changeStage === '绝' || (!!l.transform && (l.transform.backToKe || l.transform.clashBen))) },
  '忌神与元神同动': { cls: '动', side: '无力', source: 'L598',
    test: (l, c) => l.moving && c.yuanMoving }
};

/* A 忌神 line: its verdict and the reasons that hold. `c` carries what the rules need
   from outside the line: the 用神 elements, the 元神 and 仇神 movement, the day/month. */
function jiVerdictOf(l, c) {
  // Five-element cycles (木0 火1 土2 金3 水4): a generates b when (a+1)%5 === b; controls when (a+2)%5 === b.
  const controlsYong = c.yongEls.some((ye) => (l.elementGi + 2) % 5 === ye);
  // 有力 is the moving 忌神 that overcomes the 用神 (L593). 无力 is the 忌神 that does not (L598).
  const side = controlsYong ? '有力' : '无力';
  const ctx = {
    ...c,
    movingGen: c.movers.some((m) => (m.el + 1) % 5 === l.elementGi),   // a moving line generates this line
    dayBi: c.dayBi, monthBi: c.monthBi
  };
  const rules = [];
  if (side === '有力' && !l.moving) {
    return { pos: l.pos, controlsYong, moving: l.moving, verdict: '未论', rules, note: '静忌神克用神，原文未列为有力' };
  }
  for (const [text, r] of Object.entries(JI_RULES)) {
    if (r.side !== side) continue;
    if (r.test(l, ctx)) rules.push({ text, cls: r.cls, verdict: side === '有力' ? 'strong' : 'weak', decisive: false, source: r.source });
  }
  return { pos: l.pos, controlsYong, moving: l.moving, verdict: rules.length ? side : '未论', rules, note: null };
}

/* 无用之元神 (用神章 L585–589): six reasons a 元神 cannot give life to the 用神
   even though it shows (见生不生). The book's wording: "元神休囚不动，或动而休囚，又被伤克" etc.
   Where a reason is about the 变 (化退, 化绝, 化克, 化破, 化散) or the 墓, it is checked
   for structure only (transform and stage fields). OPEN ⚠: the 无用 and 有力 lists can
   both hold for one 元神 (e.g. 休囚 but 得日月生); the book gives no order between them. */
const YUAN_USELESS = {
  '元神休囚不动，或动而休囚又被伤克': { cls: '自身/克', test: (l, c) => l.wangShuai.rank <= 2 && (!l.moving || c.controlled) },
  '元神休囚又逢旬空月破': { cls: '空破', test: (l) => l.wangShuai.rank <= 2 && (l.void || l.monthBreak) },
  '元神休囚动化退神': { cls: '变', test: (l) => l.wangShuai.rank <= 2 && l.moving && !!l.transform && l.transform.jinTui === '退神' },
  '元神衰而又绝': { cls: '生旺墓绝', test: (l) => l.wangShuai.rank <= 2 && l.dayStage === '绝' },
  '元神入三墓': { cls: '墓', test: (l) => l.tombs.day || l.tombs.moving || l.tombs.change },
  '元神休囚动而化绝、化克、化破、化散': { cls: '变', test: (l) => l.wangShuai.rank <= 2 && l.moving && (l.changeStage === '绝' || (!!l.transform && (l.transform.backToKe || l.transform.clashBen))) }
};

/* 进神 / 退神 judgement (动变章 L4057–4060, 野鹤曰). A moving line's change is either a
   进神 or a 退神 (fixed by the branch pair, jinTuiOf). The book gives four ways for each,
   and they are kept apart, because the same condition (旺相化旺相) means 进 under 进神
   and 退 under 退神.
     进: 动旺相化旺相 → 乘势而进; 动休囚化休囚 → 待时而进;
         动爻变爻有一值休囚 → 亦得旺相之日而进; 有一值空破 → 待填实之日而进.
     退: 动旺相化旺相 → 退 (但有日月动爻生扶、占近事则得时而不退 — OPEN ⚠ exception, flagged);
         动休囚化休囚 → 及时而退; 动爻变爻有一旺相 → 待休囚之时而退;
         有一逢空破 → 待填实之日而退.
   “旺相” = wangRank >= 3 for the line and for the change, in the month; “空破” = 旬空 or
   月破 (the branch clashes the 月建). */
function jinTuiVerdictOf(l, c) {
  if (!l.transform || !l.moving) return null;
  const tj = l.transform.jinTui;
  if (tj !== '进神' && tj !== '退神') return { side: null, verdict: '未论', rules: [] };
  const lStrong = l.wangShuai.rank >= 3, tStrong = c.tRank >= 3;
  const lBroken = l.void || l.monthBreak, tBroken = c.tVoid || c.tBreak;
  const rules = [];
  const fire = (text, source, code) => rules.push({ code, text, cls: text.startsWith('动爻变爻') ? '变' : '自身', decisive: false, source });
  if (tj === '进神') {
    if (lStrong && tStrong) fire('动旺相化旺相：乘势而进', 'L4057', '进1');
    if (!lStrong && !tStrong) fire('动休囚化休囚：待时而进', 'L4057', '进2');
    if (!lStrong || !tStrong) fire('动爻变爻有一值休囚：亦得旺相之日而进', 'L4057', '进3');
    if (lBroken || tBroken) fire('动爻变爻有一值空破：待填实之日而进', 'L4057', '进4');
    return { side: '进', verdict: rules.length ? '进' : '未论', rules };
  }
  if (lStrong && tStrong) fire('动旺相化旺相：退（有日月动爻生扶、占近事则不退，⚠未入判定）', 'L4059', '退1');
  if (!lStrong && !tStrong) fire('动休囚化休囚：及时而退', 'L4059', '退2');
  if (lStrong || tStrong) fire('动爻变爻有一旺相：待休囚之时而退', 'L4059', '退3');
  if (lBroken || tBroken) fire('动爻变爻有一逢空破：待填实之日而退', 'L4059', '退4');
  return { side: '退', verdict: rules.length ? '退' : '未论', rules };
}

/* 空 verdict (旬空章 L2546, 野鹤曰). Every reason the book gives is a row here,
   with the MECHANISM it works through and the DIRECTION it pushes:
     自身  the line's own strength (气)            旺, 有气不动
     动    the line itself moves (脱空)            动, 动而化空
     外力  support from outside the line           日建生扶, 动爻生扶, 值月建
     隐    the hidden (伏) line, not the visible  伏而旺相, 伏而被克
     破    月建 clash (月破)                        月破
     真空  the seasonal element is empty           真空
   A row marked `source: 'not in L2546'` is not in that clause; it is kept because
   the earlier code used it, and it is flagged for the owner to confirm.

   Judgement rule (the order the owner must confirm; the book gives none):
     1. any `decisive` row fires  → void   (月破, 真空: the book states them outright)
     2. else any row that pushes "不为空" fires → not void
     3. else → void. */
const VOID_RULES = {
  '旺不为空': { cls: '自身', verdict: 'notVoid', source: 'L2546' },
  '有气不动，为空': { cls: '自身', verdict: 'void', source: 'L2546' },
  '动不为空': { cls: '动', verdict: 'notVoid', source: 'L2546' },
  '动而化空，不为空': { cls: '动', verdict: 'notVoid', source: 'L2546' },
  '日建生扶，不为空': { cls: '外力', verdict: 'notVoid', source: 'L2546' },
  '动爻生扶，不为空': { cls: '外力', verdict: 'notVoid', source: 'L2546' },
  '伏而旺相，不为空': { cls: '隐', verdict: 'notVoid', source: 'L2546' },
  '伏而被克，为空': { cls: '隐', verdict: 'void', source: 'L2546' },
  '月破，为空': { cls: '破', verdict: 'void', decisive: true, source: 'L2546' },
  '真空，为空': { cls: '真空', verdict: 'void', decisive: true, source: 'L2546' },
  '值月建，逢空不空': { cls: '外力', verdict: 'notVoid', source: 'not in L2546' }
};

/* 伏神出伏 (飞伏神章 L3010–3025). The book gives six reasons a hidden line is
   USEFUL (有用，虽曰不现，亦如现矣) and five reasons it NEVER comes out (终不能出).
   Each reason is a row, with its mechanism and its source:
     有用  L3010:  日月生伏 (日月) · 伏旺相 (自身) · 飞神生伏 (飞) · 动爻生伏 (动)
                   日月动爻冲克飞神 (日月) · 飞神空破休囚墓绝 (飞)
     无用  L3018:  伏休囚无气 (自身) · 伏被日月冲克 (日月) · 伏被旺相飞神克 (飞)
                   伏墓绝于日月飞爻 (日月/飞) · 伏休囚值旬空月破 (空破)
   Judgement rule (OPEN ⚠: the book gives no order between the two lists): a 无用
   reason is decisive, since the book says 终不能出 outright; else any 有用 reason
   gives 可出; else the book says nothing and the verdict is 未论.
   Undecided thresholds, flagged: 休囚无气 is taken as rank <= 1 (囚 or 死); 墓绝 is
   taken from stageOf (墓 or 绝). */
const EMERGE_RULES = {
  '伏得日月生': { cls: '日月', verdict: 'emerges', source: 'L3010' },
  '伏旺相': { cls: '自身', verdict: 'emerges', source: 'L3010' },
  '伏得飞神生': { cls: '飞', verdict: 'emerges', source: 'L3010' },
  '伏得动爻生': { cls: '动', verdict: 'emerges', source: 'L3010' },
  '伏得日月动爻冲克飞神': { cls: '日月', verdict: 'emerges', source: 'L3010' },
  '伏得飞神空破休囚墓绝': { cls: '飞', verdict: 'emerges', source: 'L3010' },
  '伏休囚无气': { cls: '自身', verdict: 'never', decisive: true, source: 'L3018' },
  '伏被日月冲克': { cls: '日月', verdict: 'never', decisive: true, source: 'L3018' },
  '伏被旺相飞神克': { cls: '飞', verdict: 'never', decisive: true, source: 'L3018' },
  '伏墓绝于日月飞爻': { cls: '日月/飞', verdict: 'never', decisive: true, source: 'L3018' },
  '伏休囚值旬空月破': { cls: '空破', verdict: 'never', decisive: true, source: 'L3018' }
};

function emergenceOf(ctx) {
  const { hEl, hRank, hBi, fEl, fRank, fBi, dayBi, monthBi, dayEl, monthEl, flyVoid, moving } = ctx;
  const CTRL_E = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };
  const GEN_E = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
  const NAME = ['木', '火', '土', '金', '水'];
  const h = NAME[hEl], f = NAME[fEl], d = NAME[dayEl], m = NAME[monthEl];
  const fired = [];
  const fire = (text) => fired.push({ text, decisive: false, ...EMERGE_RULES[text] });
  const dayMonthGen = GEN_E[d] === h || GEN_E[m] === h;
  if (dayMonthGen) fire('伏得日月生');
  if (hRank >= 3) fire('伏旺相');
  if (GEN_E[f] === h) fire('伏得飞神生');
  if (moving.some((x) => GEN_E[NAME[x.el]] === h)) fire('伏得动爻生');   // movers carry element indices
  if (brClash(dayBi, fBi) || brClash(monthBi, fBi) || CTRL_E[d] === f || CTRL_E[m] === f) fire('伏得日月动爻冲克飞神');
  if (flyVoid || brClash(fBi, monthBi) || brClash(fBi, dayBi) || fRank <= 2 || [stageOf(fEl, dayBi), stageOf(fEl, monthBi)].some((st) => st === '墓' || st === '绝')) fire('伏得飞神空破休囚墓绝');
  if (hRank <= 1) fire('伏休囚无气');
  if (brClash(hBi, dayBi) || brClash(hBi, monthBi) || CTRL_E[d] === h || CTRL_E[m] === h) fire('伏被日月冲克');
  if (CTRL_E[f] === h && fRank >= 3) fire('伏被旺相飞神克');
  if ([stageOf(hEl, dayBi), stageOf(hEl, monthBi), stageOf(hEl, fBi)].some((st) => st === '墓' || st === '绝')) fire('伏墓绝于日月飞爻');
  if (hRank <= 2 && ctx.xunSet.has(hBi) && brClash(hBi, monthBi)) fire('伏休囚值旬空月破');
  let verdict;
  if (fired.some((r) => r.decisive)) verdict = '终不出';
  else if (fired.some((r) => r.verdict === 'emerges')) verdict = '可出';
  else verdict = '未论';
  return { verdict, rules: fired };
}

function voidVerdict(xunSet, line, monthBi, monthEl, dayEl, hidden, movers) {
  if (!xunSet.has(line.bi)) return { inXunkong: false, verdict: null, rules: [] };
  const fired = [];
  const fire = (text) => fired.push({ text, decisive: false, ...VOID_RULES[text] });
  if (line.wang === 4) fire('旺不为空');
  if (!line.moving && line.wang >= 2) fire('有气不动，为空');
  if (line.moving) fire('动不为空');
  if (line.moving && line.transform && xunSet.has(line.transform.bi)) fire('动而化空，不为空');
  // 外力: the day, or a moving line other than this one, generates the line's element.
  if (relOf(line.el, dayEl) === 'parent') fire('日建生扶，不为空');
  if (movers.some((m) => m.pos !== line.pos && relOf(line.el, m.el) === 'parent')) fire('动爻生扶，不为空');
  if (line.bi === monthBi) fire('值月建，逢空不空');
  for (const h of hidden) {
    if (wangRank(h.el, monthEl) >= 3) fire('伏而旺相，不为空');
    if (h.flyControlsHidden) fire('伏而被克，为空');
  }
  if (brClash(line.bi, monthBi)) fire('月破，为空');
  if (line.el === TRUE_VOID_ELEMENT_BY_MONTH[monthBi]) fire('真空，为空');
  let verdict;
  if (fired.some((r) => r.decisive)) verdict = 'void';
  else if (fired.some((r) => r.verdict === 'notVoid')) verdict = 'notVoid';
  else verdict = 'void';
  return { inXunkong: true, verdict, rules: fired };
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
  // Moving lines and their elements, for 动爻生扶 (旬空章 L2546).
  const movingEls = Array.from(board.lines).filter((l) => l.moving).map((l) => ({ pos: pos1(l.idx), el: BR_EL[l.branch.bi] }));
  const palaceEl = board.ben.palace.element.gi;

  // ── lines ───────────────────────────────────────────────────────────────
  // The engine numbers hidden positions from 0 (L[pi]); packet lines are numbered from 1.
  const hiddenAt = (p) => Array.from(board.hidden || []).filter((h) => h.position === p - 1);
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
      hiddenControlsFly: !!h.hiddenControlsFly,
      // 日月如天 (L878): the day and the month act on a hidden line too.
      toDay: relOf(h.hiddenBranch.el.gi, dayEl),
      toMonth: relOf(h.hiddenBranch.el.gi, monthEl),
      // 伏神出伏 (飞伏神章 L3010, L3018)
      emergence: emergenceOf({
        hEl: h.hiddenBranch.el.gi, hBi: BRANCH_CN.indexOf(h.hiddenBranch.cn),
        hRank: wangRank(h.hiddenBranch.el.gi, monthEl),
        fBi: BRANCH_CN.indexOf(h.flyingBranch.cn),
        fEl: BR_EL[BRANCH_CN.indexOf(h.flyingBranch.cn)],
        fRank: wangRank(BR_EL[BRANCH_CN.indexOf(h.flyingBranch.cn)], monthEl),
        dayBi, monthBi, dayEl, monthEl, xunSet, moving: movingEls,
        flyVoid: xunSet.has(BRANCH_CN.indexOf(h.flyingBranch.cn))
      })
    }));
    const wang = wangRank(el, monthEl);
    const line = { bi, el, moving, wang };
    const dayStage = stageOf(el, dayBi);
    const changeStage = moving ? stageOf(el, tBi) : null;
    // 日月如天 (L878): the day and the month act on the changed line as well.
    const changeToDay = moving && t ? relOf(tEl, dayEl) : null;
    const changeToMonth = moving && t ? relOf(tEl, monthEl) : null;
    const changeVerdict = moving && t ? changeVerdictOf(el, tEl) : null;
    const v = voidVerdict(xunSet, { ...line, pos, transform: t ? { bi: tBi } : null }, monthBi, monthEl, dayEl, hidden, movingEls);
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
      voidRules: v.rules,
      changeVerdict,
      // 进神/退神 (动变章 L4057–4060)
      jinTuiVerdict: jinTuiVerdictOf(
        { moving, transform: t && moving ? { jinTui: jinTuiOf(l.branch.cn, t.branch.cn) } : null, wangShuai: { rank: wang }, void: xunSet.has(bi), monthBreak: brClash(bi, monthBi) },
        t && moving ? { tRank: wangRank(tEl, monthEl), tVoid: xunSet.has(tBi), tBreak: brClash(tBi, monthBi) } : {}
      ),
      dayStage,                          // 长生 / 旺 / 墓 / 绝 by the 日辰 (生旺墓绝章)
      changeStage,                       // the same, for the 变爻's branch on this line's element
      changeToDay,                       // 变爻 vs 日辰 and 月建, in 六亲 terms (L878)
      changeToMonth,
      // 诸爻皆不能伤日月 (L878, 黄金策 “爻伤日，徒受其名”): a line that controls the day
      // or the month has no effect on it. Kept as a flag, so the reading can say so.
      dayHarmed: relOf(dayEl, el) === 'officer',
      monthHarmed: relOf(monthEl, el) === 'officer',
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
        // 六合章 L1330: 动与动爻相合 = 合好 (both moving); one moving = 合绊.
        const type = a.moving && b.moving ? '合好' : '合绊';
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
    // 六合章 L1330: 静而逢合 (日月) → 合起; 动而逢合 → 合绊; 动与动爻相合 → 合好.
    // L1324: 爻与爻合 needs both lines moving ("但有一爻不动，亦不为合").
    if (!l.moving && withMoonDay) kinds.push('合起');
    if (l.moving && (withMoonDay || paired.length)) kinds.push('合绊');
    if (l.moving && paired.some((h) => lines[(h.a === l.pos ? h.b : h.a) - 1].moving)) kinds.push('合好');
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
      // 三合章 (L1460): which of the four forms, from which lines move. Written out below.
      const all = parts.flat();
      const benMoving = all.filter((m) => m.from === 'ben' && m.moving);
      const benStatic = all.filter((m) => m.from === 'ben' && !m.moving);
      const bian = all.filter((m) => m.from === 'bian');
      const movingPos = (pp) => benMoving.some((m) => m.pos === pp);
      let form = null;
      // Order as the book lists them: 形一 and 形二 are about the moving 本爻; 形三 and 形四
      // need the 变爻 that completes the 局 to come from the named moving lines.
      if (benMoving.length === 3) form = 1;                                   // 一卦之内，三爻动而合局
      else if (benMoving.length === 2 && benStatic.length === 1) form = 2;    // 两爻动，一爻不动，亦成合局
      else if (bian.length >= 1 && movingPos(1) && movingPos(3) && bian.every((m) => m.pos === 1 || m.pos === 3)) form = 3;   // 内卦初、三爻动，变出成局
      else if (bian.length >= 1 && movingPos(4) && movingPos(6) && bian.every((m) => m.pos === 4 || m.pos === 6)) form = 4;   // 外卦四、六爻动，变出成局
      // 局 and the 世: 局生世 吉 (利于我), 局克世 凶推, 世在局内 (L1460 “尤要世爻在局为美”).
      const worldLine = lines[board.ben.worldLi];   // the 世 line (0-indexed)
      let worldRel = null;
      if (worldLine) {
        if (g.branches.includes(worldLine.branchBi)) worldRel = '世在局内';
        else if (relOf(worldLine.elementGi, g.element) === 'parent') worldRel = '局生世';
        else if (relOf(worldLine.elementGi, g.element) === 'officer') worldRel = '局克世';
      }
      sanhe.push({ cn: g.cn, parts, form, worldRel });   // cn already names the 五行 (水局 …)
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
      // 用神章 L543: 元神旺相，或临日月，或得日月动爻生扶 (日 and 月 both act, L878).
      if (l.wangShuai.rank >= 3 || l.branchBi === monthBi || l.branchBi === dayBi) f.push('旺相或临日月');
      if (l.toDay === 'parent' || l.toMonth === 'parent') f.push('日月动爻生扶');
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
      yuan: {
        lines: yuanLines,
        factors: yuanLines.map((pos) => ({ pos, factors: factorsFor(pos) })),
        // 无用之元神 (用神章 L585): reasons it cannot give life, though it shows.
        useless: yuanLines.map((pos) => {
          const l = lines[pos - 1];
          const el = l.elementGi;
          const controlled = movingEls.some((m) => (m.el + 2) % 5 === el) || (dayEl + 2) % 5 === el || (monthEl + 2) % 5 === el;
          const rules = Object.entries(YUAN_USELESS).filter(([, r]) => r.test(l, { controlled }))
            .map(([text, r]) => ({ text, cls: r.cls, verdict: 'never', decisive: false, source: 'L585' }));
          return { pos, verdict: rules.length ? '无用' : '未论', rules };
        })
      },
      ji: {
        lines: jiLines,
        // 用神章 L593 (有力之忌神：动而克害用神) and L598 (无力之忌神：动不克用神).
        judgement: jiLines.map((pos) => jiVerdictOf(lines[pos - 1], {
          yongEls: yongLines.map((p) => lines[p - 1].elementGi),
          yuanMoving: yuanLines.some((p) => lines[p - 1].moving),
          chouMoving: chouLines.some((p) => lines[p - 1].moving),
          movers: movingEls,
          dayBi, monthBi
        }))
      },
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

