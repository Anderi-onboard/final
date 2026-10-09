/* Prompt builders. Each returns { system, user }. The packet text is the
   program's own account of the casting (render.js); no model re-derives it. */

const JSON_ONLY = '只输出一个 JSON 对象，不要任何其他文字，不要代码块标记。';

export function understandPrompt({ question, previousAnswer = null }) {
  const system = [
    '你是六爻解读流水线的第一站：理解提问人究竟在问什么。你不起卦、不排盘、不断卦。',
    '要做的事：复述需求；判断问题属于哪一门类；指出谁是对象（自己、父母、兄弟、子女、配偶、财物、官府功名、朋友外人、宅舍、文书）；',
    '区分“问题本身带来的前提”和“盘面能给的东西”——盘不含时态，前提只能记录，不能当作盘给的；',
    '列出情境中可能涉及的因素；判断语气；推测可能的心理，但必须写“可能”；判断是否危机（risk: crisis）；',
    '判断是否需要程序额外处理（同一件事今日重复问 → recastNotice；缺信息 → clarify）。',
    JSON_ONLY
  ].join('\n');
  const parts = [`提问：${question}`];
  if (previousAnswer) parts.push(`（这是对同一卦的追问。上一次的结论摘要：${previousAnswer}）`);
  return { system, user: parts.join('\n') };
}

export function claimPrompt({ entry, packetText, understanding }) {
  const system = [
    '你是六爻解读流水线的断法站。下面给出一条书中的断法原句，以及这一卦的盘面事实（由程序给出）。',
    '依葫芦画瓢：照原句的断法，去看这一卦哪几爻符合原句的条件，并把它与提问人的处境联系起来。',
    '规则：只能引用给出的这一条原句；不得引用未给出的书中内容；断语必须落在具体爻位上；',
    '联系现实时只能说“可能对应”，并说明对应的依据；若这一条在本卦上不成立，就如实说不成立。',
    JSON_ONLY
  ].join('\n');
  const user = [
    `书中原句（${entry.source.book}·${entry.source.chapter}）：${entry.text_zh}`,
    entry.claim ? `原句的白话：${entry.claim}` : '',
    `entryId 必须填：${entry.id}`,
    '',
    '盘面（程序给出）：',
    packetText,
    '',
    `提问人的情况：${understanding.restated}（门类：${understanding.category}）`,
    `可能涉及的因素：${understanding.factorsToCheck.join('；') || '无'}`
  ].filter((x) => x !== '').join('\n');
  return { system, user };
}

export function synthPrompt({ question, understanding, claims, packetText, notices, retrieved, rejected }) {
  const system = [
    '你是六爻解读流水线的汇总站。前面的站已经给出：提问人的需求、盘面事实、依书中断语得出的各条论断。',
    '你要做四件事：',
    '1. 逐项核对：提问的每一部分是否得到回答（answered、unansweredParts）；',
    '2. 检查逻辑：论断之间是否自相矛盾；是否有论断只凭缺席（某信号不上卦）立论；是否把前提当成盘给的结论；与现实处境是否合理；',
    '3. 给出置信度 low / mid / high，并说明哪一处最可能塌；',
    '4. 写给提问人的回答（answer）：先说判断，再说依据，分级确定与推测；不要罗列规则，不要写“按书中某条”之类的作业过程。',
    '如果没有可用的断语，只能陈述盘面事实，并把推断标为推断。',
    JSON_ONLY
  ].join('\n');
  const claimText = claims.length
    ? claims.map((c, i) => `${i + 1}. [${c.entryId}] ${c.claim}（依据爻位：${c.lines.join('、') || '无'}；现实：${c.realWorld}；置信：${c.confidence}）`).join('\n')
    : '（没有可用的断语）';
  const user = [
    `提问：${question}`,
    `需求：${understanding.restated}`,
    '',
    '盘面：',
    packetText,
    '',
    '论断：',
    claimText,
    rejected.length ? `\n程序已丢弃的论断（不得使用）：${rejected.map((r) => r.reason).join('；')}` : '',
    notices.length ? `\n程序提示：\n- ${notices.join('\n- ')}` : '',
    retrieved.length ? '' : '\n（知识库无匹配条目）'
  ].filter((x) => x !== '').join('\n');
  return { system, user };
}
