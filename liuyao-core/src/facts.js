/* Facts split into 关系 (relations) and 状态 (states)  — step 3 of the pipeline.
   ────────────────────────────────────────────────────────────────────────
   PURE. Takes a packet and sorts every board fact into two kinds:

   关系 (relation): a logical link the reading has to argue through. Only links
     that touch the 用神 chain (用神, 元神, 忌神, 仇神 positions) are relations.
     Example: 兄弟生父母 is a relation when 父母 is the 用神 or on its chain.

   状态 (state): a fact about one line with no logical link needed to state it
     (旺衰, 空, 月破, 动, 有力…). States are cited as facts, not argued.

   Rule the user set: "不需要逻辑联系的就算状态，需要的才算关系".

   ⚠️ 有力 is PROVISIONAL. The user's own experience decides it (2026-10-09
   instruction: “以我经验为准，标记，我看了再说”). The rule written here is a
   placeholder and every 有力 state carries provisional: true until confirmed.

   Tokens (for retrieval later, not yet wired into the matcher):
     rel:生:L<a>>L<b>     a generates b      rel:克:L<a>>L<b>   a controls b
     rel:合:L<a>-L<b>     six-combine        rel:冲:L<a>-L<b>   six-clash
     rel:刑:L<a>>L<b>     directed penalty   rel:刑:L<a>-L<b>   self-penalty
     state:L<pos>:<name>  e.g. state:L3:空, state:L3:有力, state:L2:合起
*/

const ON_CHAIN = (packet) => {
  const y = packet.yong;
  if (!y) return null;
  return new Set([...y.lines, ...y.yuan.lines, ...y.ji.lines, ...y.chou.lines]);
};

const pair = (a, b) => (a < b ? `L${a}-L${b}` : `L${b}-L${a}`);

export function classifyFacts(packet) {
  const chain = ON_CHAIN(packet);
  const relations = [];
  const states = [];

  // Without a 用神 there is no chain, so nothing is a relation: every link
  // is shown as a state-level fact and the reading is told so.
  const touches = (a, b) => chain && (chain.has(a) || chain.has(b));
  const rel = packet.relations;

  for (const c of rel.chong) {
    if (touches(c.a, c.b)) relations.push({ token: `rel:冲:${pair(c.a, c.b)}`, kind: '冲', a: c.a, b: c.b, text: `第${c.a}爻冲第${c.b}爻` });
  }
  for (const h of rel.he) {
    if (touches(h.a, h.b)) relations.push({ token: `rel:合:${pair(h.a, h.b)}`, kind: '合', a: h.a, b: h.b, text: `第${h.a}爻与第${h.b}爻相合（${h.type}）` });
  }
  for (const x of rel.xing) {
    if (x.self) {
      const [a, b] = x.self;
      if (touches(a, b)) relations.push({ token: `rel:刑:${pair(a, b)}`, kind: '刑', a, b, text: `第${a}爻与第${b}爻自刑` });
    } else if (touches(x.from, x.to)) {
      relations.push({ token: `rel:刑:L${x.from}>L${x.to}`, kind: '刑', a: x.from, b: x.to, text: `第${x.from}爻刑第${x.to}爻` });
    }
  }
  // 五行 pairs: 'output' = from generates to (生); 'wealth' = from controls to (克).
  // The other two roles are the same pairs read backwards, so they are not repeated.
  for (const e of rel.elements) {
    if (!touches(e.from, e.to)) continue;
    if (e.rel === 'output') relations.push({ token: `rel:生:L${e.from}>L${e.to}`, kind: '生', a: e.from, b: e.to, text: `第${e.from}爻生第${e.to}爻` });
    if (e.rel === 'wealth') relations.push({ token: `rel:克:L${e.from}>L${e.to}`, kind: '克', a: e.from, b: e.to, text: `第${e.from}爻克第${e.to}爻` });
  }

  // States: one or more per line, never argued, always cited.
  for (const l of packet.lines) {
    const add = (name, extra = {}) => states.push({ token: `state:L${l.pos}:${name}`, pos: l.pos, name, provisional: false, ...extra });
    add(`${l.wangShuai.cn}`);
    if (l.void) add('空');
    if (l.monthBreak) add('月破');
    if (l.dayClash) add('日冲');
    if (l.moving) add('动');
    // ⚠ PROVISIONAL — 旺相 or 日月帮扶 and neither 空 nor 月破. Owner to decide.
    const strong = (l.wangShuai.rank >= 3 || l.toDay === 'parent') && !l.void && !l.monthBreak;
    if (strong) add('有力', { provisional: true });
    // 六合章 L1330: 合起 / 合绊 / 合好 / 化扶 are per-line facts, cited as states.
    for (const k of l.heKinds || []) add(k);
    // 旬空章 L2546: each 空 verdict reason is a state too, named by its clause, so an
    // entry can cite exactly the reason that held (e.g. 动爻生扶，不为空).
    for (const r of l.voidRules || []) add(r.text);
    // 日月如天 (L878): the day and the month acting on the line, and the line
    // harming the day or the month (徒受其名). Stated as facts, not argued.
    if (l.toDay === 'parent') add('日生');
    if (l.toDay === 'officer') add('日克');
    if (l.toMonth === 'parent') add('月生');
    if (l.toMonth === 'officer') add('月克');
    if (l.dayHarmed) add('爻伤日');
    if (l.monthHarmed) add('爻伤月');
    // 忌神吉凶 (用神章 L595, L602): the verdict of a 忌神 line, when a 用神 is given.
    const jj = packet.yong ? packet.yong.ji.judgement.find((j) => j.pos === l.pos) : null;
    if (jj && jj.verdict === '有力') add('忌·有力');
    if (jj && jj.verdict === '无力') add('忌·无力');
    // 伏神出伏 (飞伏神章 L3013, L3020): the verdict of each hidden line, as a state.
    for (const h of l.hidden || []) {
      if (h.emergence.verdict === '可出') add('伏·可出');
      if (h.emergence.verdict === '终不出') add('伏·终不出');
    }
    // 卦变 (卦变生克墓绝章): only a relation with a stated verdict is a state.
    if (l.changeVerdict && l.changeVerdict.verdict) add(`卦变·${l.changeVerdict.relation}`);
  }

  return {
    chain: chain ? [...chain].sort((a, b) => a - b) : null,
    relations,
    states,
    noYong: !chain
  };
}

/* Every token the classification can emit. Used by the grammar test. */
export function factTokens(facts) {
  return [...new Set([...facts.relations.map((r) => r.token), ...facts.states.map((s) => s.token)])].sort();
}
