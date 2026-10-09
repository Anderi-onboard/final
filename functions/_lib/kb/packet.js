/* 卦况包 (casting packet) — everything the program knows about a casting
   ────────────────────────────────────────────────────────────────────────
   PURE. Takes the board from BWLiuYao.computeBoard() and returns one plain
   object holding every board fact a reading could cite: 卦名 (both
   hexagrams), 八宫, 世应, 六亲, 六神, 旬空, 月建/日辰 relations per line,
   动变与进退, 伏神, 格局flags, and the feature tokens the knowledge base
   matches against.

   Nothing here is a judgment. 用神 choice, 旺衰 weighing and every reading
   decision belong to the model stages downstream; this packet only says what
   the board is, in the book's own terms.

   Book sources (增删卜易, 民国三十年锦章书局版, 原文 only):
     卦名  八宫卦吊 · 八宫章
     进退  进神退神章
     六亲  六亲歌章 · 动变章 (变爻六亲按本卦宫推)
*/
import { boardFeatures } from './features.js';

// Trigram → the word that opens a hexagram's name (上卦, then 下卦).
export const NATURE = {
  Heaven: '天', Earth: '地', Thunder: '雷', Wind: '风',
  Water: '水', Fire: '火', Mountain: '山', Lake: '泽'
};

/* 八宫卦吊, 增删卜易 卷一, in the book's own order: eight palaces, eight
   hexagrams each (纯卦, 一世…五世, 游魂, 归魂). The names are the book's text,
   not derived: 地天泰 is not "地" + "天" + anything a rule would produce.
   Position in this list is what ties a name to its bit pattern (below). */
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
   turned. Checked against the book's list in tests/kb-packet.mjs. */
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

/* 进神 / 退神, from 进神退神章. The book lists eight of each. Written out
   by branch name so the table can be checked against the text line by line.
   ⚠️ The engine's transform.jinTui carries only four of each (it misses the
   丑辰未戌 group), so this packet does not read that field. */
const ADVANCE = { 亥: '子', 寅: '卯', 巳: '午', 申: '酉', 丑: '辰', 辰: '未', 未: '戌', 戌: '丑' };
const RETREAT = { 子: '亥', 卯: '寅', 午: '巳', 酉: '申', 辰: '丑', 未: '辰', 戌: '未', 丑: '戌' };

export function jinTuiOf(fromBranch, toBranch) {
  if (ADVANCE[fromBranch] === toBranch) return '进神';
  if (RETREAT[fromBranch] === toBranch) return '退神';
  return null;
}

function bitsOf(lines) {
  return lines.map((l) => (l.yang ? '1' : '0')).join('');
}

function intOf(lines) {
  return lines.reduce((n, l, i) => n | ((l.yang ? 1 : 0) << i), 0);
}

// Month- and day-branch relations, kept as a list of present flags only.
const MONTH_FLAGS = ['monthClash', 'monthCombine', 'monthGenerates', 'monthControls', 'monthTomb'];
const DAY_FLAGS = ['dayClash', 'dayCombine', 'dayGenerates', 'dayControls', 'dayTomb'];

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
  const bianInt = intOf(bianLines);
  const benName = nameOfBits(benInt);
  if (!benName) throw new Error(`no 八宫 name for bits ${benInt}`);

  const lines = Array.from(board.lines, (l) => {
    const pos = l.idx + 1;
    const hiddenHere = Array.from(board.hidden || []).filter((h) => h.position === pos);
    const t = l.transform;
    return {
      pos,
      yang: !!l.yang,
      moving: !!l.moving,
      label: `${l.relative.cn}${l.stem.cn}${l.branch.cn}${l.element.cn}`,
      stem: l.stem.cn,
      branch: l.branch.cn,
      element: l.element.cn,
      relative: l.relative.key,
      spirit: l.spirit.cn,
      void: !!l.void,
      wangShuai: l.wangShuai.cn,
      month: MONTH_FLAGS.filter((f) => l[f]),
      day: DAY_FLAGS.filter((f) => l[f]),
      fuyin: !!l.fuyin,
      fanyin: !!l.fanyin,
      hidden: Array.from(hiddenHere, (h) => ({
        relative: h.relative.key,
        branch: h.hiddenBranch.cn,
        flyBranch: h.flyingBranch.cn,
        flyRelative: h.flyingRelative.key
      })),
      transform: t && l.moving ? {
        stem: t.stem.cn,
        branch: t.branch.cn,
        relative: t.relative.key,
        jinTui: jinTuiOf(l.branch.cn, t.branch.cn),
        backToTomb: !!t.backToTomb,
        backToVoid: !!t.backToVoid,
        clashBen: !!t.clashBen,
        combineBen: !!t.combineBen,
        feedsBen: !!t.feedsBen,
        controlsBen: !!t.controlsBen
      } : null
    };
  });

  return {
    time: {
      day: meta.dayPillar ? `${meta.dayPillar.stem.cn}${meta.dayPillar.branch.cn}` : null,
      month: meta.monthBranch ? meta.monthBranch.cn : null,
      xunkong: Array.from(meta.xunkong || [], (b) => b.cn)
    },
    ben: {
      bits: bitsOf(benLines),
      name: benName,
      upper: board.ben.upper.cn,
      lower: board.ben.lower.cn,
      palace: board.ben.palace.cn,
      palaceElement: board.ben.palace.element.cn,
      world: board.ben.worldLi + 1,
      ying: board.ben.respLi + 1,
      series: board.ben.series.cn
    },
    bian: board.bian ? {
      bits: bitsOf(bianLines),
      name: nameOfBits(bianInt),
      palace: board.bian.palace.cn
    } : null,
    moving: Array.from(board.moving || [], (i) => i + 1),
    hexFlags: {
      clash: !!board.ben.clash,
      combine: !!board.ben.combine,
      fuyin: lines.some((l) => l.fuyin),
      fanyin: lines.some((l) => l.fanyin)
    },
    lines,
    // The same tokens the knowledge base matches on. Computed here so the packet
    // and the matcher can never disagree about what the board contains.
    tokens: boardFeatures(board, opts)
  };
}
