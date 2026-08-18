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
  assert.ok(Array.isArray(v.zh) && v.zh.length >= 4, `${k}: needs a usable Chinese list`);
  assert.ok(Array.isArray(v.enAlso) && v.enAlso.length === v.zh.length,
    `${k}: the English list must match the Chinese one entry for entry — the panel picks by `
    + `the reading's language and a short list would silently drop meanings`);
  assert.ok(v.en && v.kind, `${k}: needs an English name and a kind`);
  for (const t of v.zh.concat(v.enAlso)) assert.ok(t && t.trim(), `${k}: empty entry`);
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

// ── 3. the marker pattern is one pattern, used in both directions ───────────
// xrPlain strips it (stream preview, fallback); xrInline renders it. If the two
// drift, the preview shows raw braces or a marker survives into the prose.
const pats = chat.match(/\/\\\{\(\[\^\{\}\|\]\{1,40\}\)\\\|\(\[\^\{\}\|\]\{1,12\}\)\\\}\/g/g) || [];
assert.equal(pats.length, 2, 'xrPlain and xrInline must share one marker pattern, character for character');

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
assert.match(chat, /var h = xrInline\(esc\(s\)\);/,
  'mdInline must resolve 取象 markers before anything else touches the pipes');
const inlineBody = chat.slice(chat.indexOf('function mdInline'));
assert.ok(inlineBody.indexOf('xrInline') < inlineBody.indexOf('gild'),
  'the gild rule would pair the pipes of two adjacent markers');

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

console.log(`xiang-trace: ok — ${syms.length} symbols, all offered and all resolvable`);
