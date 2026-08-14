// The tone deck: every prompt segment that governs how a reading SOUNDS, plus
// the code-level checks and the strings the app renders without the model.
// Generated from source — a hand-copied version of this would be wrong within a
// day, which is the whole reason the other decks are generated too.
import { readFileSync, writeFileSync } from 'node:fs';

const REPO = '/home/user/final/';
global.window = global;
const { PromptEngine } = await import(REPO + 'functions/_lib/prompt-engine.js');
globalThis.window = globalThis.window || {};
window.BWPromptEngine = PromptEngine;
await import(REPO + 'copy.js');
const S = global.window.BWPromptEngine.SEGMENTS;
const C = global.window.BWCopy;
const src = readFileSync(REPO + 'functions/_lib/prompt-engine.js', 'utf8');

// What each tone segment is responsible for, in the order they reach the model.
const VOICE = [
  ['role_sortis', '谁在说话（Sortis）', '声音的底子。人物、他知道什么、遇到坏消息怎么办、被顶撞怎么办、怎么断句。几乎全是描写，不是禁令。'],
  ['role_stria', '谁在说话（Stria）', '同一个人，读更轻的盘。深浅不同，声音相同。'],
  ['stance', '⭐ 自己的看法 —— 唯一的生成器', '**先有判断,再有文字。** 其余全部段落都是过滤器,只会做减法:'
    + '能拦住坏句子,产不出好句子。没有这一站,管道就是「盘面事实 → 约束 → 文字」,'
    + '出来的东西满足每一条规则而中心是空的 —— 「读起来像念书」「句子没有中心」是这么来的,'
    + '是结构决定的,不是措辞问题。四步:我到底怎么看 · 有多确定、哪一处会塌 · '
    + '他最该带走哪一件 · 我对这事什么感觉。然后从那句话开始写。'],
  ['voice', '语气总核 —— 唯一一处', '**「每句话要有中心」**:动词是真动作、名词是真事物、主语是真的在动的那个、句子要落地。'
    + '外加归属(这一盘这个人)、力度(断言 vs 推测)、说一次、写实物不写评论、真关心是什么样、语气基调。'
    + '这一段替掉了原先的 how_to_use / concrete_verbs / density 三条检验 / clarity ① / growth 的写法段与语气段 —— '
    + '它们本来就是同一条规则,被五次不同的纠正各写了一遍。'],
  ['inference_traps', '断言的力度', '盘面事实用肯定语气，伸进对方生活的推测说"可能" · 卦义与这一盘的状态不许互相顶替。'],
  ['verdict_first', '判词', '前置、不摇摆、先说好处再说障碍和出路。'],
  ['clarity_rules', '每段都要过的三条', '清晰度检验。'],
  ['density', '密度契约', 'SWAP 检验 · 孤儿断言 · 每句必须带新信息 · 禁语。'],
  ['ux_core', '整体温度', '乐观框架与交互语气。'],
  ['anti_failure', '两头的失真', '反甜话 · 反居高临下 · 反铁口 · 置信度分级。'],
  ['growth', '成长那一层', '真关心怎么做 · 条件链语气 · 不讲大道理 · 开了门要走进去 · 写事不写评论 · 说一次 · 一句一件事。只管这一层，主解读语气不归它。'],
  ['output_sortis', '结构与篇幅', '篇幅、标题从内容长出来、无缝、术语。死板感多半出在这里。'],
  ['route_intimacy', '房事题材的分寸', '读性情节奏，不写行为目录；不给人打分。'],
  ['route_appearance', '长相题材', '不给人打分，只说吸引力落在哪。'],
  ['safety', '收尾与底线', '§SAFE：交还决定权 · 反恐吓营销 · 反依赖。'],
  ['deploy_voice', '客户端输出', '禁用词 · 把握段怎么写 · 不许催收尾。'],
  ['lang_zh', '中文', '语种与术语。'],
  ['lang_en', 'English', '语种与术语。']
];

// The regex checks, pulled straight out of the file so the list cannot drift.
const CHECKS = [
  ['COMFORT', '裸安慰', '没有盘面依据的宽心话。带依据出现时放行——查的是锚定，不是词。'],
  ['SERMON', '讲大道理', '主语变成"人生 / 每个人 / 我们都"。'],
  ['MIND_READ', '替人改目标', '"你真正想要的其实是…"。反问句照拦——判词不因为加了问号就不是判词。'],
  ['PERFORMED', '表演', '表演理解或克制："我知道你一定…" / "我不替你说"。'],
  ['CHARGED', '把差口子记到人头上', '"还需要你去落实"。说事情还差什么，不说人还欠什么。'],
  ['CHEER', '空喊', '"加油，你一定可以的"。"你能做成"放行，"你一定可以"拦——差一个词。'],
  ['TYPE_CLAIM', '开了门不走进去', '提了一类人却说不出代价。'],
  ['INVENTED_PAST', '编陌生人的来历', '"多半是见过另一头的人"。'],
  ['REFUSAL', '假托读不出来', '拿"方法读不出来"去干"我不想答"的活。'],
  ['YONGSHEN_NAMED', '没点用神', '每篇必须说清读的是哪个用神、为什么是它。']
];

const out = [];
out.push('# BourneWise · 语气与用语的全部来源');
out.push('');
out.push('> 由 `copywriting/generate-voice-deck.mjs` 从 `functions/_lib/prompt-engine.js` 与 `copy.js` 生成。');
out.push('> 手抄一份很快就会跟代码对不上，所以不要手抄——改代码，重新生成。');
out.push('');
out.push('生成时间：' + new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC');
out.push('');

let voiceTotal = 0, all = 0;
for (const k of Object.keys(S)) all += S[k].length;
for (const [k] of VOICE) if (S[k]) voiceTotal += S[k].length;

out.push('## 一览');
out.push('');
out.push('| 段名 | 字数 | 管什么 |');
out.push('|---|---:|---|');
for (const [k, title, what] of VOICE) {
  if (!S[k]) continue;
  out.push('| `' + k + '` · ' + title + ' | ' + S[k].length.toLocaleString() + ' | ' + what + ' |');
}
out.push('');
out.push('语气相关合计 **' + voiceTotal.toLocaleString() + ' 字**，占全部 SEGMENTS（' +
  all.toLocaleString() + '）的 **' + (voiceTotal / all * 100).toFixed(0) + '%**。');
out.push('');
out.push('---');
out.push('');
out.push('## 全文');
out.push('');

for (const [k, title, what] of VOICE) {
  if (!S[k]) continue;
  out.push('### `' + k + '` — ' + title);
  out.push('');
  out.push('*' + what + '*  ·  ' + S[k].length.toLocaleString() + ' 字');
  out.push('');
  out.push('```');
  out.push(S[k]);
  out.push('```');
  out.push('');
}

out.push('---');
out.push('');
out.push('## 代码级检查（`checkReadability`）');
out.push('');
out.push('跑在代码里，零成本，跟模型当时怎么想无关。只拦假货——拦不出好的。');
out.push('');
out.push('| 检查器 | 拦什么 | 说明 |');
out.push('|---|---|---|');
for (const [name, short, note] of CHECKS) {
  out.push('| `' + name + '` | ' + short + ' | ' + note + ' |');
}
out.push('');
out.push('另有 `ANCHORED` / `REAL_LIMIT` / `COST_NAMED` 三个是**豁免条件**，不单独判错——');
out.push('它们的作用是让「顺其自然」带着盘面依据出现时能放行。');
out.push('');
out.push('正则原文：');
out.push('');
out.push('```js');
for (const [name] of CHECKS.concat([['ANCHORED'], ['REAL_LIMIT'], ['COST_NAMED']])) {
  const m = src.match(new RegExp('  var ' + name + ' = (/[\\s\\S]*?/[a-z]*);'));
  if (m) out.push('var ' + name + ' = ' + m[1].replace(/\s+/g, ' ') + ';');
}
out.push('```');
out.push('');
out.push('---');
out.push('');
out.push('## 不经模型的（`copy.js`，程序直接渲染）');
out.push('');
out.push('模型写不到、也改不了的部分。');
out.push('');
out.push('**每篇解读末尾的提醒**（' + C.readingFooter.zh.length + ' 字 / ' + C.readingFooter.en.length + ' chars）');
out.push('');
out.push('```');
out.push(C.readingFooter.zh);
out.push('');
out.push(C.readingFooter.en);
out.push('```');
out.push('');
out.push('**追问按键那一圈**');
out.push('');
out.push('```');
for (const lang of ['zh', 'en']) {
  const L = C.followUp.panel[lang];
  out.push('[' + lang + '] ' + L.kicker('Sortis 6'));
  out.push('     ' + L.headSortis);
  out.push('     ' + L.hint);
  out.push('     ' + L.note(780));
  out.push('');
}
out.push('```');
out.push('');
out.push('**出错时说什么**（每一条都要交代有没有扣钱）');
out.push('');
out.push('```');
for (const [k, v] of Object.entries(C.errors)) out.push(k.padEnd(18) + v);
out.push('```');

writeFileSync(REPO + 'copywriting/BOURNEWISE_VOICE_DECK.md', out.join('\n'));
console.log('voice deck written · ' + out.join('\n').length.toLocaleString() + ' chars · ' +
  VOICE.filter(v => S[v[0]]).length + ' segments + ' + CHECKS.length + ' checks');
