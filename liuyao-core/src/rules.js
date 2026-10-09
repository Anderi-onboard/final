/* 增删卜易 · 排盘与格局的数表（纯数据，逐条注明出处）
   ────────────────────────────────────────────────────────────────────────
   Every table here is copied from the book's own text, and each one names the
   chapter it came from. Indices: branch 子0 丑1 寅2 卯3 辰4 巳5 午6 未7 申8 酉9
   戌10 亥11; element 木0 火1 土2 金3 水4 (same order as liuyao-engine.js);
   trigram tb 坤0 震1 坎2 兑3 艮4 离5 巽6 乾7 (bit 0 = bottom line).

   Where the engine and the book disagree, the book wins here and the
   disagreement is recorded beside the table.
*/

export const BRANCH_CN = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
export const ELEMENT_CN = ['木', '火', '土', '金', '水'];

/* 浑天甲子 · 装卦地支 (浑天甲子章)
   Lines 1–3 are the inner trigram, 4–6 the outer. Keyed by trigram tb. */
export const HUNTIAN = {
  7: { inner: [0, 2, 4],  outer: [6, 8, 10] }, // 乾: 子寅辰 / 午申戌
  2: { inner: [2, 4, 6],  outer: [8, 10, 0] }, // 坎: 寅辰午 / 申戌子
  4: { inner: [4, 6, 8],  outer: [10, 0, 2] }, // 艮: 辰午申 / 戌子寅
  1: { inner: [0, 2, 4],  outer: [6, 8, 10] }, // 震: 子寅辰 / 午申戌
  6: { inner: [1, 11, 9], outer: [7, 5, 3] },  // 巽: 丑亥酉 / 未巳卯
  5: { inner: [3, 1, 11], outer: [9, 7, 5] },  // 离: 卯丑亥 / 酉未巳
  0: { inner: [7, 5, 3],  outer: [1, 11, 9] }, // 坤: 未巳卯 / 丑亥酉
  3: { inner: [5, 3, 1],  outer: [11, 9, 7] }  // 兑: 巳卯丑 / 亥酉未
};

/* 世应 by 八宫 stage (世应章): 纯卦 6, 一世…五世 1…5, 游魂 4 (世退), 归魂 3 (世退).
   Engine stages match this; tests/kb-rules.mjs pins it. */
export const WORLD_BY_STAGE = [6, 1, 2, 3, 4, 5, 4, 3];

/* 生旺墓绝 (生旺墓绝章), by element index. Only these four are used by the book:
   "长生、沐浴、冠带、临官、帝旺、衰、病、死、墓、绝、胎、养余得验者，只验生旺墓绝". */
export const LIFE_STAGE = {
  long:  [11, 2, 8, 5, 8],  // 木亥 火寅 土申 金巳 水申  (木0 火1 土2 金3 水4)
  peak:  [3, 6, 0, 9, 0],   // 木卯 火午 土子 金酉 水子
  tomb:  [7, 10, 4, 1, 4],  // 木未 火戌 土辰 金丑 水辰
  dead:  [8, 11, 5, 2, 5]   // 木申 火亥 土巳 金寅 水巳
};
// NOTE: the engine's EL_TOMB and EL_DEAD give 土 as 戌 and 亥. The book says
// 水、土 share 辰 (墓) and 巳 (绝). Packet uses LIFE_STAGE; the engine's values
// feed only backToTomb and the day/month tomb flags, which the packet no longer reads.

/* 六冲 (六冲章): 子午 丑未 寅申 卯酉 辰戌 巳亥 — each branch's opposite is +6. */
export const brClash = (a, b) => (a + 6) % 12 === b;

/* 六合 (六合章): 子丑 寅亥 卯戌 辰酉 巳申 午未. */
export const BR_COMBINE = { 0: 1, 1: 0, 2: 11, 11: 2, 3: 10, 10: 3, 4: 9, 9: 4, 5: 8, 8: 5, 6: 7, 7: 6 };
export const brCombine = (a, b) => BR_COMBINE[a] === b;

/* 三合 (三合章): 申子辰 水局, 巳酉丑 金局, 寅午戌 火局, 亥卯未 木局. */
export const SANHE = [
  { branches: [8, 0, 4], element: 4, cn: '水局' },
  { branches: [5, 9, 1], element: 3, cn: '金局' },
  { branches: [2, 6, 10], element: 1, cn: '火局' },
  { branches: [11, 3, 7], element: 0, cn: '木局' }
];

/* 三刑 (三刑章), exactly as the book states it:
   "寅刑巳，巳刑申，申刑寅，子刑卯，卯刑子。丑戌相刑，戌未相刑。
    又云：辰午酉亥，谓之自刑。"
   ⚠️ The book does not list 未刑丑. The usual three-punishment set has it.
   This table follows the book; the owner should say whether to add it. */
export const XING_PAIRS = [
  [2, 5], [5, 8], [8, 2], [0, 3], [3, 0], [1, 10], [10, 1], [10, 7], [7, 10]
];
export const XING_SELF = [4, 6, 9, 11]; // 辰午酉亥

/* 驿马 (星煞章): 申子辰→寅, 巳酉丑→亥, 寅午戌→申, 亥卯未→巳. Keyed by 日支. */
export const YIMA = { 8: 2, 0: 2, 4: 2, 5: 11, 9: 11, 1: 11, 2: 8, 6: 8, 10: 8, 11: 5, 3: 5, 7: 5 };

/* 禄神 (星煞章): by 日干 → 地支. 甲寅 乙卯 丙戊巳 丁己午 庚申 辛酉 壬亥 癸子. */
export const LUSHEN = [2, 3, 5, 6, 5, 6, 8, 9, 11, 0];

/* 太乙贵人 (星煞章): 甲戊庚牛羊 乙己鼠猴乡 丙丁猪鸡位 壬癸兔蛇藏 六辛逢马虎.
   Keyed by 日干 → the two branches that count as 贵人. */
export const TAIYI = [
  [1, 7],   // 甲 牛羊
  [0, 8],   // 乙 鼠猴
  [11, 9],  // 丙 猪鸡
  [11, 9],  // 丁 猪鸡
  [1, 7],   // 戊 牛羊
  [0, 8],   // 己 鼠猴
  [1, 7],   // 庚 牛羊
  [6, 2],   // 辛 马虎
  [3, 5],   // 壬 兔蛇
  [3, 5]    // 癸 兔蛇
];

/* 天喜 (星煞章): 春戌 夏丑 秋辰 冬未.春 = 正二三月 (寅卯辰), by 月建. */
export const TIANXI_BY_MONTH = [
  /* 子 */ 7, /* 丑 */ 7, /* 寅 */ 10, /* 卯 */ 10, /* 辰 */ 10, /* 巳 */ 1,
  /* 午 */ 1, /* 未 */ 1, /* 申 */ 4, /* 酉 */ 4, /* 戌 */ 4, /* 亥 */ 7
];

/* 真空 (旬空章): "春土、夏金、秋是木，三冬逢火是真空" — keyed by 月建 branch. */
export const TRUE_VOID_ELEMENT_BY_MONTH = [
  1, 1, 2, 2, 2, 3, 3, 3, 0, 0, 0, 1  // 子 丑 寅 卯 辰 巳 午 未 申 酉 戌 亥 → element
];

/* 进神 / 退神 (进神退神章): eight of each, as the book lists them. */
export const ADVANCE = { 11: 0, 2: 3, 5: 6, 8: 9, 1: 4, 4: 7, 7: 10, 10: 1 };
export const RETREAT = { 0: 11, 3: 2, 6: 5, 9: 8, 4: 1, 7: 4, 10: 7, 1: 10 };

/* 五行 of each branch (engine order). 子水 丑土 寅木 卯木 辰土 巳火 午火 未土 申金 酉金 戌土 亥水. */
export const BR_EL = [4, 2, 0, 0, 2, 1, 1, 2, 3, 3, 2, 4];

/* 六冲卦 names (六冲章): the eight pure hexagrams plus 天雷无妄 and 雷天大壮. */
export const SIX_CLASH_NAMES = [
  '乾为天', '兑为泽', '离为火', '震为雷', '巽为风', '坎为水', '艮为山', '坤为地', '天雷无妄', '雷天大壮'
];

/* 旺相休囚死 by rank (四时旺相章 + 月将章): 旺 4 · 相 3 · 休 2 · 囚 1 · 死 0. */
export function wangRank(e, m) {
  if (e === m) return 4;
  if (e === (m + 1) % 5) return 3;
  if (e === (m + 4) % 5) return 2;
  if (e === (m + 3) % 5) return 1;
  return 0;
}

/* 六亲 of `other` as seen from `self` (六亲歌章): 生我 父母, 我生 子孙,
   我克 妻财, 克我 官鬼, 比和 兄弟. Same mapping as the engine's relativeKey. */
export function relOf(self, other) {
  if (other === self) return 'peer';
  if ((other + 1) % 5 === self) return 'parent';
  if ((self + 1) % 5 === other) return 'output';
  if ((self + 2) % 5 === other) return 'wealth';
  return 'officer';
}

/* 生旺墓绝 stage of element e sitting on branch b (生旺墓绝章). */
export function stageOf(e, b) {
  if (LIFE_STAGE.long[e] === b) return '长生';
  if (LIFE_STAGE.peak[e] === b) return '旺';
  if (LIFE_STAGE.tomb[e] === b) return '墓';
  if (LIFE_STAGE.dead[e] === b) return '绝';
  return null;
}

/* ── 候选神煞（非原书取法，待用户判断）────────────────────────────────
   增删卜易星煞章只验四种（贵人、禄神、驿马、天喜）。下面四种原书没有完整
   取法，取法来自网络上的八字通行口诀，未经六爻原书证实。它们只进卦况包的
   `candidates` 段，明确标注“待判断”，不产生检索 token，不入断语，直到
   用户逐条确认。
   原书若有一句可用的（如文昌丁日酉），也单列标出，注明只有一例。 */
export const STEM_CN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];

// 三合局：由地支下标找它所在的三合局名（子=0 … 亥=11）。
export const TRIAD_OF_BI = {
  8: '申子辰', 0: '申子辰', 4: '申子辰',
  2: '寅午戌', 6: '寅午戌', 10: '寅午戌',
  11: '亥卯未', 3: '亥卯未', 7: '亥卯未',
  5: '巳酉丑', 9: '巳酉丑', 1: '巳酉丑'
};

export const CANDIDATE_RULES = [
  { key: '桃花', keyFrom: 'day-branch', targetKind: 'branch',
    table: { '申子辰': '酉', '寅午戌': '卯', '亥卯未': '子', '巳酉丑': '午' },
    source: '八字通行口诀（网络，非增删卜易）' },
  { key: '劫煞', keyFrom: 'day-branch', targetKind: 'branch',
    table: { '申子辰': '巳', '亥卯未': '申', '寅午戌': '亥', '巳酉丑': '寅' },
    source: '八字通行口诀（网络，非增删卜易）；增删卜易 L11255 另有“劫煞者乃兄弟之爻”一句，未涉取法' },
  { key: '月德', keyFrom: 'month-branch', targetKind: 'stem',
    table: { '寅午戌': '丙', '申子辰': '壬', '亥卯未': '甲', '巳酉丑': '庚' },
    source: '通行三合取法（网络，非增删卜易）' },
  { key: '文昌', keyFrom: 'day-stem', targetKind: 'branch', partial: true,
    table: { '丁': '酉' },
    source: '增删卜易 L11077 一例（丁日以酉为文昌）；其余日干原书未给' }
];
