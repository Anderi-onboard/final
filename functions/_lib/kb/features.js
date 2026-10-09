/* Board → feature tokens (知识库的检索键)
   ────────────────────────────────────────────────────────────────────────
   PURE. Takes the plain board object that liuyao-engine.js's computeBoard()
   returns and emits a sorted list of discrete tokens describing what the
   board is. Retrieval matches knowledge-base entries against these tokens
   exactly — no embeddings, no fuzzy matching — so every hit can be explained
   by naming the tokens it matched.

   Token grammar (closed; tests/kb-retrieval.mjs checks corpus tokens against
   what this module can actually emit, so a typo fails the build):
     ben:<bits>                 本卦, six 0/1 characters, 初爻 first, 1 = yang
     bian:<bits>                变卦, same encoding (only when a line moves)

   Why bits and not 卦名: the engine does not name hexagrams — `ben.name` is
   whatever the caller passed in, and is null otherwise. A name-keyed index
   would depend on the caller spelling it the same way every time. The bit
   string is computed from the lines themselves, so it cannot disagree with
   the board. Corpus entries may carry the 卦名 in a comment for humans.
     ben:000000 = 坤为地    ben:111111 = 乾为天   (初爻 is the first character)
     mov:<n>                    动爻数 0–6    mov@<pos>     第 pos 爻动 (1 = 初爻)
     world:<pos>                世爻位置      palace:<五行> 卦宫五行 (lowercase)
     hex:clash | hex:combine    本卦六冲/六合  hex:fuyin | hex:fanyin 伏吟/反吟
     L<pos>:<relative>          六亲 (parent|peer|output|wealth|officer)
     L<pos>:<wangshuai>         旺衰 (prosperous|…|dead, lowercase English)
     L<pos>:<flag>              void / dayClash / monthClash / dayCombine /
                                monthCombine / dayGenerates / dayControls /
                                monthGenerates / monthControls / dayTomb / monthTomb
     yong:<key>                 用神六亲 (caller-supplied, e.g. wealth, self)
     yongLine@<pos>             用神所在爻 (a line whose relative matches yong:)

   ⚠️ The yong: tokens come from the CALLER, not the board. Question parsing
   decides what 用神 is; this module only reports where it sits on the board.
*/

import { BR_EL, stageOf } from './rules.js';

const LINE_FLAGS = [
  'void', 'dayClash', 'monthClash', 'dayCombine', 'monthCombine',
  'dayGenerates', 'dayControls', 'monthGenerates', 'monthControls'
];

function lower(s) {
  return String(s || '').toLowerCase();
}

/* @param board  the object returned by BWLiuYao.computeBoard()
   @param opts   { yongKey?: 'self'|'parent'|'peer'|'output'|'wealth'|'officer' } */
export function boardFeatures(board, opts = {}) {
  if (!board || !Array.isArray(board.lines) || board.lines.length !== 6) {
    throw new Error('boardFeatures: expected a computed board with six lines');
  }
  const out = new Set();
  const add = (t) => out.add(t);

  const yangBits = (lines) => lines.map((l) => (l.yang ? '1' : '0')).join('');
  add('ben:' + yangBits(board.lines));

  const moving = board.moving || [];
  add('mov:' + moving.length);
  for (const i of moving) {
    add('mov@' + (i + 1));
  }
  if (moving.length) {
    // A moving line is the one that flips; the transformed hexagram is the
    // same six lines with those flipped, which needs no bian internals.
    const bianBits = board.lines
      .map((l) => (l.moving ? !l.yang : l.yang) ? '1' : '0').join('');
    add('bian:' + bianBits);
  }

  add('world:' + (board.ben.worldLi + 1));
  add('palace:' + lower(board.ben.palace.element.en));

  if (board.ben.clash) add('hex:clash');
  if (board.ben.combine) add('hex:combine');
  if (board.lines.some((l) => l.fuyin)) add('hex:fuyin');
  if (board.lines.some((l) => l.fanyin)) add('hex:fanyin');

  // 墓 comes from the book's 生旺墓绝 table, not the engine's flag: the engine
  // puts 土's tomb on 戌 and the book puts it on 辰.
  const dayBi = board.meta.dayPillar.branch.bi;
  const monthBi = board.meta.monthBranch.bi;
  for (const line of board.lines) {
    const pos = line.idx + 1;
    const el = BR_EL[line.branch.bi];
    add(`L${pos}:${lower(line.relative.key)}`);
    add(`L${pos}:${lower(line.wangShuai.en)}`);
    for (const flag of LINE_FLAGS) {
      if (line[flag]) add(`L${pos}:${flag}`);
    }
    if (stageOf(el, dayBi) === '墓') add(`L${pos}:dayTomb`);
    if (stageOf(el, monthBi) === '墓') add(`L${pos}:monthTomb`);
  }

  if (opts.yongKey) {
    add('yong:' + opts.yongKey);
    const yongPositions = opts.yongKey === 'self'
      ? [board.ben.worldLi + 1]
      : board.lines.filter((l) => l.relative.key === opts.yongKey).map((l) => l.idx + 1);
    for (const pos of yongPositions) add('yongLine@' + pos);
  }

  return [...out].sort();
}

export const FEATURE_FLAGS = [...LINE_FLAGS, 'dayTomb', 'monthTomb'];
