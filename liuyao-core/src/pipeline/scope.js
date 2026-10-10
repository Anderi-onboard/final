/* Scope: what one casting can answer.

   增删卜易 gives a rule for questions that climb a ladder — 小考 (县考、府考、道考)
   and 会试 / 鼎甲: each level is asked with its own casting, and one casting that
   answers one level does not answer the next (求名章 L9916; 功名到何品级章 L11010).

   The program decides this from the question, not from a model. The model is told
   the rule (NOTICE.LADDER) and keeps reading the board for the current level; the
   program writes the next steps, so they are not left to the model's wording.
*/

// Anything graded: exams, ranks, contests, awards. 用神章 L433: 占功名 uses 官鬼.
export const LADDER_RE = /(哪个地步|哪一级|哪一步|哪个层次|哪一层|能到哪|能走到哪|走多远|打到哪|考到哪|能到几|几品|品级|能否晋级|能晋级|晋级|最后能|最终能|名次|几等|等级|级别|获奖|拿奖|入围|能(?:否)?进(?:决赛|复赛|前)|决赛|复赛|初赛|鼎甲)/;

export const LADDER_SOURCES = [
  { where: '卷三·求名章', line: 'L9916', text: '小考须先占县考，再占府考，再占道考，俱吉方许' },
  { where: '卷三·功名到何品级章', line: 'L11010', text: '又因占会试……能鼎甲否？余曰：须再占一卦' }
];

// The chain the book names. Anything else is not in the book, so the program does not guess it.
const CHAINS = [['县考', '府考', '道考']];

export function detectLadder(question) {
  const q = String(question || '');
  const words = [...new Set((q.match(new RegExp(LADDER_RE.source, 'g')) || []))];
  if (words.length === 0) return { ladder: false, words: [], levelNow: null, levelNext: null, sources: [] };

  // "已过校赛" → the level already passed (a premise from the question, not from the board).
  const passed = /已过([一-龥]{1,4})/.exec(q);
  const levelNow = passed ? passed[1] : null;

  let levelNext = null;
  for (const chain of CHAINS) {
    const i = chain.findIndex((x) => q.includes(x));
    if (i >= 0 && i + 1 < chain.length) levelNext = chain[i + 1];
  }
  return { ladder: true, words, levelNow, levelNext, sources: LADDER_SOURCES };
}

export const SUBJECT_NOTE =
  '功名、等级、名次一类，用神是官鬼（用神章 L433：占功名，皆以官鬼爻为用神）。程序已把对象定为官鬼，不再以世为用神。';

export const NOTICE_LADDER =
  '问的是一连串的级别。增删卜易的做法是：每一级各起一卦（求名章 L9916；功名到何品级章 L11010）。' +
  '一卦只就它所见的当前这一级说话，不得推断下一级、最终名次或能否走到某一级。' +
  '同样的道理适用于一切有梯度的事（考试、比赛、评选）：每一个梯度都是一次独立的功名，要各起一卦。' +
  '盘上与本级有关的信号（世、应、日月、动变、元神、忌神等）照常解读。';

/* The next steps are written by the program. They say what this casting answers and
   how to go on: a new casting for the next level, or a follow-up on this one. */
export function buildNextStep(scope) {
  if (!scope || !scope.ladder) return null;
  const now = scope.levelNow
    ? `${scope.levelNow}之后的那一级（已过的是${scope.levelNow}）`
    : '当前这一级';
  const lines = [
    `本卦只回答：${now}。`,
    scope.levelNext
      ? `下一级：${scope.levelNext}。要问它，请新起一卦。`
      : '下一级的名称程序不知道，需要你告诉我：要问下一级，请新起一卦，并在问题里写清它的名称。',
    '要问下一级：新起一卦（不要用追问代替）。' +
      '  命令：node scripts/session.mjs start --question "……（写清下一级的名称）"',
    '要在这一卦上继续问当前这一级的细节（时间、对方、取象等）：追问，沿用同一卦，不起新卦。' +
      '  命令：node scripts/session.mjs follow <本次目录> --question "……"'
  ];
  return {
    levelNow: scope.levelNow,
    levelNext: scope.levelNext,
    needsLevelName: !scope.levelNext,
    lines
  };
}
