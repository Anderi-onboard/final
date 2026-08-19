/**
 * 取象溯源 CONTRACT
 *
 * A reading translates a symbol into one concrete noun — 官鬼 becomes 审批那一关
 * — and marks where it did so: {审批那一关|官鬼}. The reader sees the noun,
 * underlined; clicking it shows what else that symbol covers.
 *
 * The split is the whole point. The model writes only the PAIRING, about four
 * tokens; every list comes from assets/xiangshu/lei-xiang.json. Generating the
 * lists instead would cost hundreds of tokens a reading, produce a different
 * list each time, and be unverifiable. So the two halves have to stay in step,
 * and that is what most of this file checks: a symbol the prompt teaches but
 * the catalogue lacks becomes an underline that does nothing.
 *
 * Run: node tests/xiang-trace.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => readFileSync(resolve(ROOT, f), 'utf8');

const cat = JSON.parse(read('assets/xiangshu/lei-xiang.json'));
const chat = read('chat-app.js');
const css = read('tokens/refinement.css');
const { PromptEngine } = await import('../functions/_lib/prompt-engine.js');
const seg = PromptEngine.SEGMENTS.xiang_chain;

// ── 1. the catalogue is complete and usable in both languages ──────────────
const syms = Object.keys(cat.symbols);
assert.ok(syms.length >= 36, `catalogue holds only ${syms.length} symbols`);
for (const [k, v] of Object.entries(cat.symbols)) {
  /* TWO LEVELS, kept apart. A symbol runs in several 象 (父母 → 文书, 房产,
     长辈…), and each 象 is itself a family of concrete things (文书 → 合同,
     证书, 执照, 批文…). Flattened into one comma-list the distinction vanishes,
     and a reader meeting 文书 in the conclusion reads it as 证书 and stops. */
  assert.ok(Array.isArray(v.cats) && v.cats.length >= 2,
    `${k}: needs at least two 象 — one branch is not a family`);
  assert.ok(v.en && v.kind && v.id, `${k}: needs an English name, a kind and an id`);
  for (const c of v.cats) {
    assert.ok(c.zh && c.en, `${k}: an 象 needs both names`);
    assert.ok(c.items && Array.isArray(c.items.zh) && c.items.zh.length >= 3,
      `${k}·${c.zh}: an 象 with no concrete things under it is the flat list again`);
    assert.equal(c.items.en.length, c.items.zh.length,
      `${k}·${c.zh}: the English items must match entry for entry — the panel picks by the `
      + `reading's language and a short list would silently drop meanings`);
    for (const t of c.items.zh.concat(c.items.en)) assert.ok(t && t.trim(), `${k}·${c.zh}: empty entry`);
    // An 象 must not simply restate the symbol, and an item must not restate its 象.
    assert.notEqual(c.zh, k, `${k}: an 象 named after the symbol says nothing`);
    assert.ok(!c.items.zh.includes(c.zh), `${k}·${c.zh}: lists itself as one of its own instances`);
  }
}
for (const [alias, target] of Object.entries(cat.aliases)) {
  assert.ok(cat.symbols[target], `alias ${alias} → ${target}, which is not in the catalogue`);
}

// Every group the prompt offers the model must be represented.
for (const [kind, least] of [['liuqin', 5], ['branch', 12], ['element', 5], ['spirit', 6], ['trigram', 8], ['position', 2]]) {
  const n = syms.filter((s) => cat.symbols[s].kind === kind).length;
  assert.ok(n >= least, `only ${n} ${kind} entries, expected at least ${least}`);
}

// ── 2. THE JOIN: every symbol the prompt names is one the browser can resolve ─
// This is the assertion the whole feature rests on. A symbol taught but not
// stocked renders as a word with an underline that opens nothing.
// Forward: every symbol the model is shown in an example must resolve. These
// are the literal marks it will imitate, so an unstocked one here is a dud
// underline shipped by design.
const examples = [...seg.matchAll(/\{([^{}|]{1,40})\|([^{}|]{1,12})\}/g)]
  .map((m) => m[2])
  .filter((s, i, a) => !s.includes('符号'))
  // the ✗ table marks symbols with themselves on purpose; those are counter-examples
  .filter((s) => true);
assert.ok(examples.length >= 3, `the segment shows only ${examples.length} worked examples`);
for (const s of examples) {
  assert.ok(cat.symbols[s] || cat.aliases[s],
    `an example marks "${s}", which the catalogue has no entry for — that underline opens nothing`);
}

// Backward: every symbol in the catalogue must be offered to the model. The
// groups are written as unseparated runs (子丑寅卯…) that wrap across lines, so
// compare against the whitespace-stripped segment.
const flat = seg.replace(/\s+/g, '');
const missing = syms.filter((s) => !flat.includes(s));
assert.deepEqual(missing, [],
  `stocked but never offered to the model: ${missing.join(', ')} — the catalogue entry is dead weight`);

/* ── 2b. a mark must be a TRANSLATION, not a term wearing a pipe ────────────
   The first live reading with markers on produced 69 marks, 67 of them
   circular — {妻财|妻财}, {巳火|巳}, {山|艮}. Clicking 妻财 to be told 妻财 can
   mean money teaches nothing, and a page of underlines gets none of them
   clicked. The prompt forbids it; xrUseful() is the backstop, because a
   regression costs the reader, not us. */
assert.match(chat, /function xrUseful\(word, sym\)/, 'the circular-mark guard exists');
const useful = (word, sym) => {
  if (word === sym) return false;
  if (word.length <= 3 && word.indexOf(sym) !== -1) return false;
  return true;
};
for (const [w, s] of [['妻财', '妻财'], ['巳火', '巳'], ['父母', '父母'], ['子水', '子'], ['戌土', '戌'], ['申', '申']]) {
  assert.equal(useful(w, s), false, `{${w}|${s}} is circular and must render as plain text`);
}
for (const [w, s] of [['审批那一关', '官鬼'], ['你做出来的那个东西', '巳'], ['那份还没签的合同', '父母']]) {
  assert.equal(useful(w, s), true, `{${w}|${s}} is a real translation and must stay clickable`);
}
// The prompt has to show the failure, not just the success — the model reached
// for the terms when it was given only correct examples plus a symbol list.
assert.match(seg, /左边永远不许是术语/, 'the prompt names the one way this goes wrong');
assert.match(seg, /\{妻财\\\|妻财\}/, 'and shows it as a worked wrong example');
assert.match(seg, /从没听过六爻的人/, 'and gives a one-line test for whether a mark earned itself');
/* The biggest source of missed marks is a translation written as a parenthetical
   gloss — 上艮(山,挡在前头不动的那件事). The work is done; it just never became a
   mark, and the gloss does the catalogue's job in prose instead. */
assert.match(seg, /你写在括号里的那句解释,就是标记/,
  'the prompt must catch the parenthetical gloss — it is where marks go missing');

// ── 3. the marker pattern is one pattern, used in both directions ───────────
// xrPlain strips it (stream preview, fallback); xrInline renders it. If the two
// drift, the preview shows raw braces or a marker survives into the prose.
const pats = chat.match(/\/\\\{\(\[\^\{\}\|\]\{1,40\}\)\\\|\(\[\^\{\}\|\]\{1,12\}\)\\\}\/g/g) || [];
assert.equal(pats.length, 3,
  'xrPlain (strip), xrInline (render) and xrReset (seed) must share ONE marker pattern, '
  + 'character for character — if they drift the preview shows raw braces, or a mark renders '
  + 'without having claimed its symbol');

const RE = /\{([^{}|]{1,40})\|([^{}|]{1,12})\}/g;
const strip = (s) => s.replace(RE, '$1');
assert.equal(strip('动的偏偏是{审批那一关|官鬼} —— 所以卡你的不是能力。'),
  '动的偏偏是审批那一关 —— 所以卡你的不是能力。');
assert.equal(strip('{她|妻财}张罗,{他|官鬼}点头'), '她张罗,他点头');
// Prose braces that are not markers survive untouched rather than eating text.
assert.equal(strip('用 {} 表示空集'), '用 {} 表示空集');

// ── 4. markers are rendered BEFORE |gild| ──────────────────────────────────
// gild matches /\|([^|]+)\|/ — two pipes. Two markers on one line offer it the
// pipe of the first and the pipe of the second, and it would swallow the span
// between them, destroying both.
// Order: marks own the braces, so they resolve first; the parse path then
// scans what is left; bold/italic/gild come last and use * and |, neither of
// which appears in the HTML the first two emit.
assert.match(chat, /var h = xrAuto\(xrInline\(esc\(s\)\)\);/,
  'mdInline must resolve marks, then auto-match, before anything touches the pipes');
const inlineBody = chat.slice(chat.indexOf('function mdInline'));
// anchor on the gild REPLACEMENT, not the word — it appears in a comment above
const gildAt = inlineBody.indexOf('class="gild');
assert.ok(gildAt > 0, 'the gild rule is still in mdInline');
assert.ok(inlineBody.indexOf('xrInline') < gildAt,
  'the gild rule would pair the pipes of two adjacent markers');
assert.ok(inlineBody.indexOf('xrAuto') < gildAt,
  'auto-matching must finish before gild rewrites the string');

// ── 5. the stream preview and Copy never leak the machinery ────────────────
assert.match(chat, /return xrPlain\(value\)/,
  'the streaming preview must strip markers first — the pipe strip below it would '
  + 'otherwise leave "{审批那一关官鬼}" on screen for the length of the stream');
assert.match(chat, /!el\.classList\.contains\("xr-panel"\)/,
  'Copy must skip open panels, or a symbol catalogue lands in the middle of the prose');

// ── 6. click opens it; hover only offers it ────────────────────────────────
// CLAUDE.md §4: the casting figure has no pointer interaction and gains none.
// This lives in the prose, and it must not become a hover tooltip either.
assert.match(chat, /closest\("button\.xr"\)/, 'the panel opens from a click, delegated');
assert.doesNotMatch(chat, /mouseenter[\s\S]{0,120}xr\b/, 'no hover-opened readout');
assert.doesNotMatch(chat, /class="xr"[^>]*title=/, 'no tooltip title attribute');
const figure = read('casting-figure.js');
assert.doesNotMatch(figure, /\bxr\b|lei-xiang/, 'the casting figure stays out of this entirely');

// ── 7. house style ─────────────────────────────────────────────────────────
const block = css.slice(css.indexOf('/* ── 取象溯源'));
assert.doesNotMatch(block, /#[0-9a-fA-F]{3,8}\b/, 'components reference semantic aliases, never bare hex');
assert.match(block, /prefers-reduced-motion/, 'the reveal must respect reduced motion');
assert.match(block, /columns:/, 'the list reads as a field, not a column to walk down');
assert.doesNotMatch(block, /text-transform:\s*uppercase/, 'labels stay sentence case');

// ── 8. the prompt asks for a chain, and does not ask for a box ─────────────
assert.ok(PromptEngine.SEGMENTS.xiang_chain, 'the segment exists');
assert.match(seg, /\{实际的词\|符号\}/, 'the syntax is stated literally, once');
assert.match(seg, /8 到 20/, 'the mark count is bounded — a fully underlined page gets clicked nowhere');
// output_sortis forbids labelled boxes; a "生克分析" section would contradict it.
assert.match(seg, /不是要你另起一段/, 'the chain must be the walk itself, not a new section');

/* ── 9. the parse path ──────────────────────────────────────────────────────
   Everywhere the reading writes a symbol outright — 妻财, 官鬼, 巳火 — is
   recoverable from the text with no model help and no tokens. Only translated
   nouns need a mark. Splitting it this way also removes the model as a single
   point of failure: the first run with marks enabled produced six.

   Precision over recall is the whole discipline. A bare 木火土金水 appears inside
   ordinary words, and an underline on 离开 pointing at the Fire trigram is worse
   than a symbol left unannotated. */
const M = cat.matching;
assert.ok(M && M.direct.length >= 20, 'the matcher needs a direct-match list');
for (let i = 1; i < M.direct.length; i++) {
  assert.ok(M.direct[i - 1].length >= M.direct[i].length,
    `direct terms must be longest-first, or 子 matches inside 子孙: "${M.direct[i - 1]}" before "${M.direct[i]}"`);
}
assert.ok(M.direct.every((t) => t.length >= 2), 'single characters never match unconditionally');
assert.deepEqual(M.skipStandalone.slice().sort(), ['土', '水', '木', '火', '金'].sort(),
  'bare elements are never matched — they live inside ordinary words');
assert.ok(M.branchSuffix.includes('日') && M.branchSuffix.includes('月'),
  'a lone branch counts only before 日/月/年');
// 艮上震下 — the standard way a reading writes a figure's construction puts
// 上/下 AFTER the trigram; 上艮下震 puts it before. Both positions count, or
// half the trigrams in every board layout go unannotated.
assert.ok(M.trigramSuffix.includes('卦') && M.trigramSuffix.includes('宫'),
  'a lone trigram counts beside 卦/宫');
assert.ok(M.trigramSuffix.includes('上') && M.trigramSuffix.includes('下')
  && M.trigramPrefix.includes('上') && M.trigramPrefix.includes('下'),
  'both 艮上震下 and 上艮下震 are written; 上/下 must count on either side');
for (const c of Object.values(cat.compounds)) {
  assert.ok(M.direct.includes(c), `compound ${c} must be matchable — readings write branches that way`);
}
assert.match(chat, /function xrScanText/, 'the scanner exists');
assert.match(chat, /function xrAuto/, 'and only touches text between tags');

// ── 10. the 数字集 ─────────────────────────────────────────────────────────
const ids = Object.values(cat.symbols).map((v) => v.id);
assert.equal(new Set(ids).size, ids.length, "catalogue ids must be unique — they are the set's alphabet");
assert.ok(ids.every((n) => Number.isInteger(n) && n > 0), 'ids are positive integers');
assert.match(chat, /data-xiang="/, 'the reading publishes the set of symbols it touched');
assert.match(chat, /hit\.entry\.cats/, 'the panel reads the two-level shape');
assert.match(chat, /class="xr-cat"/, 'the first level is the 象 row');
assert.match(chat, /c\.items\.zh : c\.items\.en/, 'the second level opens one 象 into its concrete things');
assert.doesNotMatch(chat, /entry\.enAlso/, 'the old flat shape is gone from the renderer');
assert.match(chat, /function xrHits\(\)/, 'built from what was actually annotated, not from what was searched for');

// ── 11. a mark beats an auto-match for the same symbol ─────────────────────
// A mark carries a translation; an auto-match carries only the term. Before the
// seed, a reading holding both annotated 兄弟 three times.
assert.match(chat, /function xrReset\(text\)/, 'the seen-set is seeded from the marks before rendering');
assert.match(chat, /xrReset\(text\);/, 'and mdReading passes the reading in');

// ── 12. states are not 象 ──────────────────────────────────────────────────
// 旬空 has no 类象: it is a condition of a line, not something the line stands
// for. A live reading marked {假空|旬空}, which could only ever open nothing.
for (const t of cat.notSymbols) {
  assert.ok(!cat.symbols[t], `${t} is a state, not a symbol, and must not be stocked`);
  assert.ok(!M.direct.includes(t), `${t} must not be matchable`);
}
assert.ok(cat.notSymbols.includes('旬空') && cat.notSymbols.includes('用神'),
  'the state list covers what readings actually say');
assert.match(seg, /术语的状态\(旬空、月破、假空、发动\)也不要标/, 'and the prompt says so too');

/* ── 13. 动词象意 live in the closing chain, and NOWHERE else ───────────────
   Owner's placement rule, and it is right: a verb list hung under each of
   twenty annotated nouns is noise twenty times over, and a verb only means
   anything once you can see what it acts on. The closing 串联 is also the part
   a reader actually reaches for. So the per-noun panel shows 象 → concrete
   things, and the chain shows what each force DOES. */
for (const [k, v] of Object.entries(cat.symbols)) {
  assert.ok(v.acts && Array.isArray(v.acts.zh) && v.acts.zh.length >= 3,
    `${k}: needs its 动词象意 — what this force does`);
  assert.equal(v.acts.en.length, v.acts.zh.length, `${k}: acts must match entry for entry`);
  for (const t of v.acts.zh.concat(v.acts.en)) assert.ok(t && t.trim(), `${k}: empty act`);
}
// The panel builder must not reach for acts; the chain builder must.
const panelSrc = chat.slice(chat.indexOf('var cats = hit.entry.cats'), chat.indexOf('host.parentNode.insertBefore(p'));
assert.ok(panelSrc.length > 200, 'located the panel builder');
assert.doesNotMatch(panelSrc, /\bacts\b/,
  'the per-noun panel must not show 动词象意 — they belong only in the closing chain');
const chainSrc = chat.slice(chat.indexOf('function xrChain'), chat.indexOf('function xrAuto'));
assert.match(chainSrc, /\.acts\[/, 'the closing chain is where the verbs are shown');
assert.match(chat, /xrChain\(msg\.text\)/, 'and it is rendered into the reading');
// Before the disclaimer, which stays last.
assert.ok(chat.indexOf('xrChain(msg.text)') < chat.indexOf('readingFootnote(msg.text)'),
  'the chain goes above the disclaimer, not after it');

// ── 14. the ring is a legend, not a finding ────────────────────────────────
// 生克 between the six relatives is fixed by the method and identical on every
// board. Ten edge chips read as a discovery about THIS casting; two cycle lines
// read as the legend it is.
assert.ok(cat.relations && cat.relations.sheng.length === 5 && cat.relations.ke.length === 5,
  'both relations are five-cycles over the five relatives');
const ring = ['父母', '兄弟', '子孙', '妻财', '官鬼'];
for (const rel of ['sheng', 'ke']) {
  const from = cat.relations[rel].map((p) => p[0]).sort();
  const to = cat.relations[rel].map((p) => p[1]).sort();
  assert.deepEqual(from, ring.slice().sort(), `${rel}: every relative feeds exactly once`);
  assert.deepEqual(to, ring.slice().sort(), `${rel}: every relative is fed exactly once`);
}
assert.match(chainSrc, /function chain\(pairs/, 'runs are walked, not emitted edge by edge');
assert.match(chainSrc, /present\.length < 2/, 'one relative is not a chain and renders nothing');
assert.match(chainSrc, /固定的关系/, 'and the lead says outright that the ring is fixed');

const nCat = Object.values(cat.symbols).reduce((n, v) => n + v.cats.length, 0);
const nItem = Object.values(cat.symbols).reduce((n, v) => n + v.cats.reduce((m, c) => m + c.items.zh.length, 0), 0);
const nAct = Object.values(cat.symbols).reduce((n, v) => n + v.acts.zh.length, 0);
console.log(`xiang-trace: ok — ${syms.length} symbols · ${nCat} 象 · ${nItem} things · ${nAct} 动词象意`);
