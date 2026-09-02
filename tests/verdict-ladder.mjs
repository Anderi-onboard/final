/**
 * VERDICT LADDER CONTRACT
 *
 * 《增删卜易》断卦裁决梯,执行在代码里而不是提示词里。
 *
 * 为什么这条契约值钱,一句话就能说清:**那副断错的盘,梯子在第 3 步直断凶。**
 *
 *   山风蛊 → 火地晋,申月癸酉日,动爻 2/3/4,问「明天考科目一能过吗」
 *   第 2 爻 父母亥水 化巳火 —— 水绝于巳,**化绝**
 *   §3 大凶败局:用神动化回头克 / 化鬼 / 化绝 / 化墓 / 化退,为大凶败局
 *
 * 化绝是一次查表。不需要分量、不需要语气、不需要模型。而上线的那篇解读说
 * 「能过」,提到了亥水化巳火、把它读成仇神关系,漏掉了更硬的那一条。
 *
 * 这就是这个模块存在的全部理由:一套两个内行会算出同一个答案的判据,交给
 * 模型每卦重推一遍,就会在某一卦上漏掉其中一条,而且漏了没有任何东西会响。
 *
 * 钉住的四件事:
 *  ① 梯子按 1→5 的顺序走,而且第 1–3 步是**否决项**(命中即定案,不进第 4 步称重)
 *  ② 那副盘必须在第 3 步定凶,理由必须点到「化绝」和第 2 爻
 *  ③ 「未定」必须和「判定」长得不一样 —— decidedAt 为 null 时不许冒出一个吉凶
 *  ④ §4「变爻仅能作用于本位动爻」:变爻不许进别的爻的生克计数
 *
 * Run: node tests/verdict-ladder.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const sandbox = { console: { log() {}, warn() {}, error() {} }, Math, JSON, Object, Array,
  String, Number, Error, Date, RegExp, Set, Map, parseInt, parseFloat, isNaN };
sandbox.window = sandbox;
sandbox.self = sandbox;
vm.createContext(sandbox);
for (const f of ['liuyao-engine.js', 'liuyao-ai.js', 'liuyao-verdict.js']) {
  vm.runInContext(readFileSync(`${ROOT}/${f}`, 'utf8'), sandbox, { filename: f });
}
const AI = sandbox.BWLiuYaoAI;
const V = sandbox.BWVerdict;
assert.equal(typeof V?.judge, 'function', 'BWVerdict.judge is gone — the ladder is not being executed at all');

const EXAM = '我明天考科目一能过吗';
function judge(lines, changeIdx, dayGanzhi, question = EXAM) {
  const board = sandbox.BWLiuYao.computeBoard({ lines, changeIdx, dayGanzhi });
  const subject = AI.subjectKey(question);
  const roles = AI.deriveRoles(board, subject.key);
  return { board, verdict: V.judge(board, roles, subject) };
}

/* ── ① 那副盘:第 3 步,化绝,直断凶 ────────────────────────────────────
   这是验收线。dayGanzhi 9 = 癸酉,盘本身的起卦日 —— 不钉住它,今天的日辰
   会算出另一副盘,而这条契约就在核一个不存在的东西。 */
const SHIPPED = [{ yang: false }, { yang: true }, { yang: true },
                 { yang: false }, { yang: false }, { yang: true }];
const bad = judge(SHIPPED, [1, 2, 3], 9);

assert.equal(bad.board.meta.dayPillar.stem.cn + bad.board.meta.dayPillar.branch.cn, '癸酉',
  'fixture invariant: 这副盘的起卦日是癸酉,日辰变了整条断法就不是同一件事');
assert.equal(bad.verdict.primary.decidedAt, 3,
  `断错的那副盘定案在第 ${bad.verdict.primary.decidedAt} 步,应该是第 3 步。`
  + '第 3 步是否决项(用神动化回头克/鬼/绝/墓/退),它不需要称重就能定案 —— '
  + '而上线的解读在这一步之后还写了「能过」。');
assert.equal(bad.verdict.primary.tone, '凶', '第 3 步命中却没有定凶');
assert.equal(bad.verdict.verdict, '凶', '分梯定了凶,总判没跟上');

const step3 = bad.verdict.primary.steps.find((s) => s.step === 3);
assert.ok(step3 && step3.fired, '第 3 步没有命中');
assert.match(step3.why, /化绝/,
  `第 3 步命中的理由是「${step3.why}」,里面没有「化绝」。亥水化巳火、水绝于巳,`
  + '这是判定的全部依据;报不出依据的判定和猜没有区别');
assert.match(step3.why, /第2爻/, '第 3 步没有点出是哪一爻');
// Array.from: 这个数组是在 vm realm 里造的,带的是那个 realm 的 Array 原型,
// deepStrictEqual 会因为原型不同而判不等 —— 本会话第二次栽在这上面。
assert.deepEqual(Array.from(step3.lines), [2], '第 3 步没有把爻号交出来给下游引用');

/* 定案之后仍然要把后面几步算完并报出来 —— 定案是"够了",不是"别看了"。
   模型写字的时候仍然需要第 4 步的计数和第 5 步的应期。 */
assert.ok(bad.verdict.primary.steps.some((s) => s.step === 4),
  '第 3 步定案之后第 4 步就不算了 —— 那样解读里就没有生克对比可写');

/* ── ② 梯子的形状 ────────────────────────────────────────────────────── */
const order = Array.from(bad.verdict.primary.steps, (s) => s.step).filter((s) => typeof s === 'number');
assert.deepEqual(order, [1, 2, 3, 4, 5],
  `裁决梯走成了 ${order.join('→')}。顺序就是判据本身:卦变回头克在有根之前,`
  + '有根在动化之前,称重排最后 —— 换了顺序就是换了断法');
for (const s of bad.verdict.primary.steps) {
  assert.ok(s.rule && s.why, `第 ${s.step} 步没有 rule 或 why —— 一步不报依据,整条梯子就只是个结论`);
}

/* 防空转:梯子必须真的评估了这么多条,而不是因为某个字段名改了就全部落空。 */
const evaluated = bad.verdict.primary.steps.length + (bad.verdict.second?.steps.length || 0);
assert.ok(evaluated >= 10,
  `两个用神一共只评估了 ${evaluated} 步 —— 梯子在空转,而空转的测试比没有测试更坏`);

/* ── ③ 「未定」不许长得像「判定」 ──────────────────────────────────────
   地天泰 → 地泽临,戊寅日:前三步一个否决项都不命中。这时候模块必须说
   「未定」,不许自己凑一个吉凶出来 —— 称重归模型。 */
const open = judge([{ yang: true }, { yang: true }, { yang: true },
                    { yang: false }, { yang: false }, { yang: false }], [2], 14);
assert.equal(open.board.meta.dayPillar.stem.cn + open.board.meta.dayPillar.branch.cn, '戊寅',
  'fixture invariant: 这副盘钉在戊寅日');
assert.equal(open.verdict.primary.decidedAt, null,
  '前三步无否决项,却给出了定案步数');
assert.equal(open.verdict.primary.decisive, false, '未定的分梯报成了 decisive');
assert.match(open.verdict.verdict, /未定/,
  `总判是「${open.verdict.verdict}」。前三步没有否决项时,模块只有计数没有结论,`
  + '硬凑一个吉凶就是拿确定性的外形去包一个判断 —— 那正是这套东西要消灭的东西');

/* 用神不上卦时,第 2 步只读得到世爻。不说出来,读的人会以为用神也过了这一关。 */
const openStep2 = open.verdict.primary.steps.find((s) => s.step === 2);
assert.match(openStep2.why, /用神不上卦/,
  '用神伏藏,第 2 步却没有声明它只读到了世爻 —— 静默的默认和一个判定长得一样');
assert.ok(open.verdict.hiddenYong && /出伏/.test(open.verdict.hiddenYong.why),
  '用神伏藏时没有把出伏那一档单独交出来');

/* 月破的救必须具名。这一处是判据冲突裁下来的(临日建算不算"生助"),
   所以它尤其不许静默 —— 下一个人要能看见是哪一条救了它,才谈得上推翻。 */
const rescue = open.verdict.second.steps.find((s) => s.step === 5);
assert.match(rescue.why, /月破而有救\(临日建\)/,
  `官鬼寅木在申月是月破、而戊寅日正是它自己,「临日建者不破」。第 5 步报的是「${rescue.why}」。`
  + '救与不救必须写出是哪一条救的,否则这条裁决就没法被推翻');

/* ── ④ 变爻只作用于本位动爻 ────────────────────────────────────────────
   §4 写死的:变爻仅能作用于本位动爻,不能生克他爻。所以生克计数里只许出现
   动爻本身的五行,变爻的五行不许进去。 */
const tally = bad.verdict.primary.steps.find((s) => s.step === 4).tally;
const movingIdx = bad.board.lines.filter((l) => l.moving).map((l) => l.idx + 1);
for (const n of [...tally.feed, ...tally.hit, ...tally.drain]) {
  assert.ok(movingIdx.includes(n),
    `生克计数里出现了第 ${n} 爻,而它不是动爻(动爻是 ${movingIdx.join('、')})。`
    + '静爻不能克动爻,§4 写死了');
}

/* 上面那条查的是"只有动爻进计数",而 §4 真正说的是**变爻不作用于他爻**,
   两件事不一样 —— 第一版就只写了上面那条,把变爻的五行混进计数并不会触发它,
   植入验证当场是绿的。真正能咬住这条规则的是:**一爻不许同时落进两个桶**。
   这副盘正好构造得出来:第 4 爻妻财戌土发动、化酉金,对用神水来说
   戌土是克、酉金是生 —— 变爻一旦漏进来,第 4 爻就会同时出现在 hit 和 feed。 */
const buckets = { feed: tally.feed, hit: tally.hit, drain: tally.drain };
const seenLine = {};
for (const name of Object.keys(buckets)) {
  for (const n of buckets[name]) {
    assert.ok(!seenLine[n],
      `第 ${n} 爻同时落进 ${seenLine[n]} 和 ${name}。一爻只有一个五行,`
      + '两头都占说明它的变爻也被算进了对用神的生克 —— §4:变爻仅能作用于本位动爻。');
    seenLine[n] = name;
  }
}
const four = bad.board.lines[3];
assert.ok(four.moving && four.transform,
  'fixture invariant: 第 4 爻要是发动的,否则上面那条查不到东西');
assert.ok(tally.hit.includes(4) && !tally.feed.includes(4),
  `第 4 爻妻财戌土(化酉金)应当只算作克用神水。现在 hit=${tally.hit}、feed=${tally.feed} —— `
  + '它的变爻酉金生水,漏进来就会让它两头都占');

assert.ok(tally.feed.length + tally.hit.length + tally.drain.length > 0,
  '三爻发动而生克计数全空 —— 计数在空转');

/* ── ⑤ 世爻就是用神那一爻时,不许数两遍 ────────────────────────────────
   山风蛊的世在第 3 爻,而第 3 爻正是第二用神官鬼酉金。数两遍会让同一条证据
   读起来像两条,而"同一件事说两遍不会变成两件事"是这一轮反复付过学费的。 */
const secStep2 = bad.verdict.second.steps.find((s) => s.step === 2);
const mentions = (secStep2.why.match(/第3爻/g) || []).length;
assert.equal(mentions, 1,
  `第二用神的第 2 步把第 3 爻数了 ${mentions} 遍。世爻和用神落在同一爻时要去重`);

console.log('verdict ladder OK — 断错的那副盘在第 3 步「化绝」直断凶,'
  + `梯子 1→5 有序共 ${evaluated} 步,未定不冒充判定,变爻不越位,世用同爻不重复计数`);
