/* 卦况包 → model text, in sections, each citing its 增删卜易 chapters.
   ────────────────────────────────────────────────────────────────────────
   PURE. The model never sees the packet object; it sees the text this module
   writes. Every field the packet holds must be written somewhere in that text,
   and this module proves it: the packet is wrapped in a read-recording proxy,
   and tests/kb-render.mjs fails if any property of the packet was never read
   while rendering. A fact cannot drop out between the program and the model
   without a test going red.
*/

// Wraps a value so that every property read is recorded as a path such as
// "lines[].transform.jinTui". Array elements are recorded as "[]".
export function track(value, used, path = '') {
  if (value === null || typeof value !== 'object') return value;
  return new Proxy(value, {
    get(target, key, receiver) {
      if (typeof key === 'symbol' || key === 'length') return Reflect.get(target, key, receiver);
      const isIndex = Array.isArray(target) && /^\d+$/.test(key);
      if (isIndex) return track(target[key], used, path + '[]');
      const sub = path ? `${path}.${key}` : key;
      used.add(sub);
      return track(target[key], used, sub);
    }
  });
}

const REL_CN = {
  parent: '生我（父母）', peer: '比和（兄弟）', output: '我生（子孙）',
  wealth: '我克（妻财）', officer: '克我（官鬼）'
};
const relCn = (k) => REL_CN[k] || k;
const listPos = (xs) => (xs.length ? '第' + xs.join('、') + '爻' : '无');

function lineText(l) {
  const parts = [];
  parts.push(`${l.yang ? '阳' : '阴'}${l.moving ? '动' : '静'}`);
  parts.push(l.spirit);
  parts.push(`${relCn(l.relative)} ${l.stem}${l.branch}${l.element}`);
  parts.push(`${l.wangShuai.cn}（${l.wangShuai.rank}）`);
  if (l.monthRank) parts.push(l.monthRank);
  parts.push(`对月建：${relCn(l.toMonth)}`);
  parts.push(`对日辰：${relCn(l.toDay)}`);
  if (l.monthBreak) parts.push('月破');
  if (l.monthCombine) parts.push('月合');
  if (l.dayClash) parts.push('日冲');
  if (l.dayCombine) parts.push('日合');
  if (l.trueVoid) parts.push('真空');
  if (l.void) parts.push('旬空');
  const voidRules = l.voidRules;   // read every time, so the field is always accounted for
  // 卦变 (卦变生克墓绝章): the verdict of a moving line by its change. Shown with its source;
  // an open point is shown as ⚠, not hidden.
  const cv = l.changeVerdict;
  if (cv) {
    const rg = cv.regardlessOfYong ? '，不论用神衰旺' : '';
    const v = `${cv.verdict ?? '未判定'}${rg}`;
    parts.push(`变爻${cv.relation}：${v}（${cv.source ?? cv.open ?? '原文'}）${cv.open && cv.verdict ? `〔⚠ ${cv.open}〕` : ''}`);
  }
  if (l.voidVerdict) {
    // Each reason is shown with its mechanism (自身/动/外力/隐/破/真空) and its source.
    const why = (verdict) => voidRules.filter((r) => r.verdict === verdict || (verdict === 'void' && r.decisive))
      .map((r) => `${r.cls}：${r.text}（${r.source}）`);
    const nv = why('notVoid');
    const vb = voidRules.filter((r) => r.verdict === 'void' && !r.decisive).map((r) => `${r.cls}：${r.text}（${r.source}）`);
    const decisive = voidRules.filter((r) => r.decisive).map((r) => `${r.cls}：${r.text}（${r.source}）`);
    parts.push(`旬空判定：${l.voidVerdict === 'void' ? '为空' : '不为空'}` +
      (nv.length ? `（不空之据：${nv.join('、')}）` : '') +
      (vb.length ? `（空之据：${vb.join('、')}）` : '') +
      (decisive.length ? `（定空之据：${decisive.join('、')}）` : ''));
  }
  const changeStage = l.changeStage;
  if (l.dayStage) parts.push(`日辰上为${l.dayStage}`);
  if (changeStage) parts.push(`变爻上为${changeStage}`);
  const tombs = [];
  if (l.tombs.day) tombs.push('入日墓');
  if (l.tombs.moving) tombs.push('入动墓');
  if (l.tombs.change) tombs.push('化墓');
  if (tombs.length) parts.push(tombs.join('、'));
  if (l.fuYin) parts.push('爻伏吟');
  if (l.fanYin) parts.push('爻反吟');
  for (const h of l.hidden) {
    const flags = [h.flyControlsHidden && '飞克伏', h.flyGeneratesHidden && '飞生伏', h.hiddenControlsFly && '伏克飞']
      .filter(Boolean).join('、');
    parts.push(`伏${relCn(h.relative)}${h.branch}（飞${h.flyBranch}·${relCn(h.flyRelative)}${flags ? '·' + flags : ''}）` +
      `，日辰${relCn(h.toDay)}、月建${relCn(h.toMonth)}`);
    // 伏神出伏 (飞伏神章): the verdict, and each reason that held, with its source.
    const em = h.emergence;
    const why = em.rules.map((r) => `${r.cls}：${r.text}（${r.source}·${r.verdict === 'never' ? '无用' : '有用'}${r.decisive ? '·定' : ''}）`).join('、');
    parts.push(`伏神${em.verdict}${why ? '（' + why + '）' : ''}${em.verdict === '未论' ? '〔原文未论此伏神〕' : ''}`);
  }
  // 日月如天 (L878): the day and month relations of a changed line and of the line itself.
  // 变 kinds (one list, read by every rule about the change; 化冲 is the rules' 化破, ⚠).
  parts.push(l.changeKinds.length ? `变：${l.changeKinds.join('、')}` : '变：无');
  // 有气 (general definition, ⚠ open): shown with the line's 旺衰 so a reader can see it.
  if (l.qi) parts.push('有气');
  else parts.push('无气');
  // 进神/退神 (动变章 L4057–4060): the side and each reason that held.
  const jv = l.jinTuiVerdict;
  if (jv) {
    const why = jv.rules.map((r) => `${r.code} ${r.text}（${r.source}·${r.cls}${r.decisive ? '·定' : ''}）`).join('、');
    parts.push(`${jv.side ?? '非进退'}：${jv.verdict}${why ? '（' + why + '）' : ''}`);
  }
  const cd = l.changeToDay, cm = l.changeToMonth;   // read together, so both are always accounted for
  if (cd) parts.push(`变爻与日辰：${relCn(cd)}，与月建：${relCn(cm)}`);
  if (l.dayHarmed) parts.push('爻伤日：徒受其名（L878）');
  if (l.monthHarmed) parts.push('爻伤月：徒受其名（L878）');
  if (l.heKinds.length) parts.push(l.heKinds.join('、'));
  if (l.chongKinds.length) parts.push(l.chongKinds.join('、'));
  const marks = [];
  if (l.world) marks.push('世');
  if (l.ying) marks.push('应');
  if (l.yongRole) marks.push(`${l.yongRole}（用神章）`);
  if (marks.length) parts.push(marks.join('、'));
  if (l.xingWith.length) parts.push(`刑第${l.xingWith.join('、')}爻`);
  if (l.heWith.length) parts.push(`与第${l.heWith.join('、')}爻相合`);
  if (l.chongWith.length) parts.push(`与第${l.chongWith.join('、')}爻相冲`);
  if (l.sanheGroups.length) parts.push(`入${l.sanheGroups.join('、')}`);
  if (l.dayEffects.length) parts.push(l.dayEffects.join('、'));
  if (l.shensha.length) parts.push(`见${l.shensha.join('、')}`);
  if (l.transform) {
    const t = l.transform;
    const tp = [`变${t.stem}${t.branch}${t.element}（${relCn(t.relative)}，按本卦宫推）`];
    if (t.jinTui) tp.push(t.jinTui);
    if (t.backToTomb) tp.push('回头入墓');
    if (t.backToVoid) tp.push('变入旬空');
    if (t.backToSheng) tp.push('回头生');
    if (t.backToKe) tp.push('回头克');
    if (t.clashBen) tp.push('变冲本爻');
    if (t.combineBen) tp.push('变合本爻');
    parts.push(tp.join('，'));
  }
  return parts.join(' · ');
}

export function renderPacket(packet) {
  const used = new Set();
  const p = track(packet, used);
  const sections = [];
  const sec = (id, title, source, lines) => sections.push({ id, title, source, lines: lines.filter(Boolean) });

  // ── 时令 ──────────────────────────────────────────────────────────────
  const t = p.time;
  sec('time', '时令', ['日辰章', '月将章', '旬空章'], [
    `起卦时间 ${t.date}。日辰 ${t.day}（日支${t.dayBranch}），月建 ${t.month}月（${t.monthBranch}）。`,
    `旬空：${t.xunkong.join('、')}。`
  ]);

  // ── 本卦 ──────────────────────────────────────────────────────────────
  const b = p.ben;
  const benLines = [
    `本卦 ${b.name}（${b.bits}，上卦${b.upper}，下卦${b.lower}，${b.palace}，${b.series}）。`,
    `世在第${b.world}爻，应在第${b.ying}爻。宫五行${b.palaceElement}。`
  ];
  if (p.hexFlags.clash) benLines.push('本卦为六冲卦。');
  if (p.hexFlags.combine) benLines.push('本卦为六合卦。');
  sec('ben', '本卦', ['八宫章', '世应章', '六冲章', '六合章'], benLines);

  // ── 六爻 ──────────────────────────────────────────────────────────────
  sec('lines', '六爻（由初至上）', ['浑天甲子章', '六亲歌章', '六神章', '四时旺相章', '旬空章', '生旺墓绝章', '随鬼入墓章', '飞伏神章', '进神退神章', '动变章'],
    p.lines.map((l) => `第${l.pos}爻 ${lineText(l)}`));

  // ── 动变 ──────────────────────────────────────────────────────────────
  // Every flag is read whether or not there is a 变卦, so a missing 变卦 is
  // stated rather than silently skipped.
  const hx = p.hexFlags;
  const transitions = hx.transitions;
  const tf = hx.trigramFanYin;
  const bianClash = hx.bianClash;
  const bianCombine = hx.bianCombine;
  const bianLines = [];
  if (p.bian) {
    bianLines.push(`变卦 ${p.bian.name}（${p.bian.bits}，${p.bian.palace}）。`);
    // The book names 变生 · 变比和 · 变克 (卦变生克墓绝章). The other direction is
    // not named there, so it is said plainly rather than given a name the book lacks.
    const vb = p.bian.bianVsBen === '本生变或本克变'
      ? '本宫生变宫或克变宫（书未专名此种情形）'
      : p.bian.bianVsBen;
    bianLines.push(`变卦宫与本卦宫：${vb}。`);
    if (transitions.length) bianLines.push(`卦变：${transitions.join('、')}。`);
    if (tf && (tf.lower || tf.upper)) {
      bianLines.push(`卦反吟：${[tf.lower && '内卦', tf.upper && '外卦'].filter(Boolean).join('、')}。`);
    }
    if (bianClash) bianLines.push('变卦为六冲卦。');
    if (bianCombine) bianLines.push('变卦为六合卦。');
  } else {
    bianLines.push('本卦无动爻，无变卦。');
  }
  if (hx.fuYin) bianLines.push('卦伏吟：变卦地爻五行不变。');
  bianLines.push(`动爻：${p.moving.length ? p.moving.map((x) => `第${x}爻`).join('、') : '无'}。`);
  if (p.solo) bianLines.push(`${p.solo}。`);
  sec('bian', '动变', ['动变章', '卦变生克墓绝章', '反伏章', '独发章', '六冲章', '六合章'], bianLines);

  // ── 格局与生克冲合 ─────────────────────────────────────────────────────
  const rel = p.relations;
  const gLines = [];
  const mk = (pos, mv) => `第${pos}爻${mv ? '（动）' : '（静）'}`;
  gLines.push(rel.chong.length ? `冲：${rel.chong.map((c) => `${mk(c.a, c.moving[0])}与${mk(c.b, c.moving[1])}`).join('、')}。` : '冲：无爻与爻相冲。');
  gLines.push(rel.he.length ? `合：${rel.he.map((h) => `第${h.a}爻与第${h.b}爻（${h.type}）`).join('、')}。` : '合：无爻与爻相合。');
  const xingTxt = rel.xing.map((x) => {
    const from = x.from;
    const to = x.to;
    const self = x.self;
    return self ? `第${self[0]}与第${self[1]}爻自刑` : `第${from}爻刑第${to}爻`;
  });
  gLines.push(xingTxt.length ? `刑：${xingTxt.join('、')}。` : '刑：无。');
  const partName = (m) => {
    const base = m.from === 'ben' ? `第${m.pos}爻` : m.from === 'bian' ? `第${m.pos}爻变` : m.from === 'day' ? '日辰' : '月建';
    return m.moving ? base + '（动）' : base;
  };
  gLines.push(rel.sanhe.length
    ? `三合：${rel.sanhe.map((g) => `${g.cn}（${g.parts.map((pt) => pt.map(partName).join('/')).join('、')}；` +
      `${g.form ? '形' + g.form : '四形之外'}，${g.worldRel ?? '世不在局、不生不克'}，三合章 L1460）`).join('；')}。`
    : '三合：无。');
  const eff = rel.dayEffects
    .map((d) => ({ pos: d.pos, effects: d.effects }))
    .filter((d) => d.effects.length)
    .map((d) => `第${d.pos}爻 ${d.effects.join('、')}`);
  gLines.push(eff.length ? `时效：${eff.join('；')}。` : '时效：无暗动、日破、冲空、冲合、动散之象。');
  gLines.push(`五行：${rel.elements.map((e) => `第${e.from}爻${e.moving[0] ? '（动）' : ''}${relCn(e.rel)}第${e.to}爻${e.moving[1] ? '（动）' : ''}`).join('；')}。`);
  sec('rel', '格局与生克冲合', ['三合章', '六合章', '六冲章', '三刑章', '暗动章', '动散章', '日辰章', '月将章', '五行相生章', '五行相克章', '动静生克章', '克处逢生章'], gLines);

  // ── 神煞 ──────────────────────────────────────────────────────────────
  const sh = p.shensha;
  sec('shensha', '神煞（书中独验四种）', ['星煞章'], [
    `太乙贵人（${sh.taiyi.branches.join('、')}）：${listPos(sh.taiyi.lines)}。`,
    `禄神（${sh.lu.branch}）：${listPos(sh.lu.lines)}。`,
    `驿马（${sh.yima.branch}）：${listPos(sh.yima.lines)}。`,
    `天喜（${sh.tianxi.branch}）：${listPos(sh.tianxi.lines)}。`
  ]);

  // ── 关系与状态 (facts.js): 关系 = 触及用神链的逻辑联系；状态 = 不需论证的事实。
  const f = p.facts;
  const factLines = [];
  factLines.push(`用神链：${f.chain ? listPos(f.chain) : '无（未给用神）'}。`);
  if (f.noYong) factLines.push('无用神，用神链不成立：下列关系不计，只列状态。');
  if (f.relations.length) factLines.push(...f.relations.map((r) => `关系：${r.text}。（${r.kind}，第${r.a}、${r.b}爻；${r.token}）`));
  else factLines.push('关系：用神链上无逻辑联系。');
  for (const st of f.states) {
    factLines.push(`状态：第${st.pos}爻${st.name}${st.provisional ? '〔有力为暂定判据，待用户确认〕' : ''}。（${st.token}）`);
  }
  sec('facts', '关系与状态（关系需论证，状态只引用）', ['用神章', '五行相生章', '五行相克章', '六冲章', '六合章'], factLines);

  // ── 候选神煞: 待用户判断。不入断语，不作检索 token。 ─────────────────────
  sec('candidates', '候选神煞（待判断，原书未给完整取法，非本书断语）', ['网络通行取法（非增删卜易）', '增删卜易 L11077'],
    p.candidates.map((c) => c.target
      ? `${c.key}（${c.basis}取${c.target}，${c.targetKind === 'stem' ? '天干' : '地支'}）${c.partial ? '〔原书仅一例〕' : ''}：${listPos(c.lines)}。来源：${c.source}。${c.status}`
      : `${c.key}（${c.basis}）：原书未给此取法。来源：${c.source}。${c.status}`));

  // ── 用神 (only when the question has been classified) ───────────────────
  if (p.yong) {
    const y = p.yong;
    const yl = [`用神：${relCn(y.key)}（${y.key === 'self' ? '以世爻为用神' : '以此六亲为用神'}）。`];
    const yLines = y.lines;
    yl.push(y.absent ? '用神不现于卦。' : `现于${listPos(yLines)}。`);
    if (y.liangXian) yl.push('用神两现。');
    if (y.fallback) {
      const f = y.fallback;
      const pf = f.palaceFirst;
      const pureTxt = pf.lines.map((x) => `第${x.pos}爻${relCn(x.relative)}${x.branch}`).join('、');
      yl.push(`用神不现：书云“日月为用神”，日辰${f.day}、月建${f.month}；又云“于本宫首卦寻之”，本宫${pf.palace}首卦（${pureTxt}），此六亲${listPos(pf.yongPos)}。`);
    }
    yl.push(y.yuan.lines.length ? `元神（生用神）：${listPos(y.yuan.lines)}。` : '元神：无。');
    for (const entry of y.yuan.factors) {
      yl.push(`第${entry.pos}爻元神有力之条：${entry.factors.length ? entry.factors.join('、') : '无'}。`);
    }
    yl.push(y.ji.lines.length ? `忌神（克用神）：${listPos(y.ji.lines)}。` : '忌神：无。');
    // 无用之元神 (用神章 L585): a 元神 that shows but gives no life.
    for (const u of y.yuan.useless) {
      const why = u.rules.map((r) => `${r.cls}：${r.text}（${r.source}·${r.verdict === 'never' ? '无用' : '有用'}${r.decisive ? '·定' : ''}）`).join('、');
      yl.push(`第${u.pos}爻元神${u.verdict}${why ? '：' + why : ''}`);
    }
    // 忌神吉凶 (用神章 L593, L598): 有力 = 动而克用神 (大凶); 无力 = 动不克用神 (化凶为吉).
    for (const j of y.ji.judgement) {
      const why = j.rules.map((r) => `${r.cls}：${r.text}（${r.source}·${r.verdict === 'strong' ? '有力' : '无力'}${r.decisive ? '·定' : ''}）`).join('、');
      yl.push(`第${j.pos}爻忌神${j.verdict}${j.controlsYong ? '（克用神' : '（不克用神'}${j.moving ? '，动' : '，静'}）` +
        `${why ? '：' + why : ''}${j.note ? '〔' + j.note + '〕' : ''}`);
    }
    yl.push(y.chou.lines.length ? `仇神（克元神，又生忌神）：${listPos(y.chou.lines)}。` : '仇神：无。');
    sec('yong', '用神视角（由问题决定）', ['用神章', '用神、元神、忌神、仇神章', '元神、忌神、衰旺章', '两现章', '飞伏神章'], yl);
  }

  // ── 书中不取 ──────────────────────────────────────────────────────────
  sec('excluded', '书中明言不取，不得使用', ['六害章', '星煞章', '卦身', '世身', '本命'], [
    '六害：书云“六害全无应验，删之不录”。',
    '卦身、世身、本命：书云“卦身亦不验，只用世爻”“余试不验而不用”。',
    '星煞：书云“独验贵人、禄神、驿马、天喜”，其余不取。'
  ]);

  const text = sections.map((s) => `【${s.title}】（${s.source.join('、')}）\n${s.lines.join('\n')}`).join('\n\n');
  return { sections, text, used };
}

/* Every property path the packet holds, named the same way `track` names them.
   tests/kb-render.mjs requires each one (bar the allow-list) to appear in `used`. */
export function propertyPaths(obj, prefix = '', out = new Set()) {
  if (obj === null || typeof obj !== 'object') return out;
  if (Array.isArray(obj)) {
    for (const item of obj) propertyPaths(item, prefix + '[]', out);
    return out;
  }
  for (const k of Object.keys(obj)) {
    const sub = prefix ? `${prefix}.${k}` : k;
    out.add(sub);
    propertyPaths(obj[k], sub, out);
  }
  return out;
}

