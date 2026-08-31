/**
 * RELATIVE GLOSS CONTRACT
 *
 * A 六亲 means one thing and denotes many. 兄弟 is always "same kind as me,
 * takes a share"; what takes a share is decided by the question. Buying
 * something with crypto, it is the exchange's cut and the payment channel's
 * fee. In a relationship, it is the rival and whatever is wedged in between.
 *
 * assets/xiangshu/lei-xiang.json held both readings the whole time — 兄弟
 * carries `分利的 / whoever splits it` and `耗费 / what eats it`, and the
 * second lists 手续费、平台抽成 outright. What did not exist was the index:
 * nothing said which facet this question lights up. chat-app.js fetched the
 * catalogue for the 取象 panel, after the reading was written, and the server
 * never opened the file, so the model assembling a reading had never seen one
 * item from it.
 *
 * With no candidates and a rule telling it to be concrete, it printed the
 * label. Measured on a live reading 2026-08-25 ("我以后什么时候破处"): 兄弟
 * appeared six times, WAS the 用神, and was never translated into anything a
 * reader could check.
 *
 * This file guards the index: that it is built from the catalogue and not
 * hand-written beside it, that every route names facets the catalogue really
 * has, and that the assembled prompt carries the block and the rule that
 * spends it.
 *
 * Run: node tests/relative-gloss.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const read = (f) => readFileSync(`${ROOT}/${f}`, 'utf8');

const GENERATED = 'functions/_lib/relative-gloss.js';
const CATALOGUE = 'assets/xiangshu/lei-xiang.json';

// ── the generated file must be what the generator produces right now ───────
//
// One owner: the catalogue. Editing the generated file by hand, or editing the
// catalogue without rebuilding, both leave the reading quoting words that are
// no longer anyone's.
const before = read(GENERATED);
execFileSync(process.execPath, ['scripts/build-relative-gloss.mjs'], { cwd: ROOT });
const after = read(GENERATED);
if (before !== after) {
  writeBack(before);
  assert.fail(`${GENERATED} is stale — run node scripts/build-relative-gloss.mjs`);
}
function writeBack(text) {
  // Leave the tree as we found it even when asserting.
  try { writeFileSync(`${ROOT}/${GENERATED}`, text); } catch { /* ignore */ }
}

const { RELATIVE_FACETS, ROUTE_FACETS, relativeGloss } = await import(`${ROOT}/${GENERATED}`);
const cat = JSON.parse(read(CATALOGUE));

// ── every word came from the catalogue ─────────────────────────────────────
let checked = 0;
for (const [rel, entry] of Object.entries(RELATIVE_FACETS)) {
  const sym = cat.symbols[rel];
  assert.ok(sym, `${rel} is glossed but absent from the catalogue`);
  for (const [name, facet] of Object.entries(entry.cats)) {
    const source = sym.cats.find((c) => c.zh === name);
    assert.ok(source, `${rel} is glossed with a facet "${name}" the catalogue does not have`);
    for (const item of facet.zh) {
      assert.ok(source.items.zh.includes(item),
        `${rel}/${name} lists "${item}", which is not in the catalogue — the gloss is inventing referents`);
      checked += 1;
    }
  }
}
assert.ok(checked >= 100,
  `only ${checked} items verified against the catalogue — the walk stopped working, so this is hollow`);

// ── a route may only name facets that exist ────────────────────────────────
for (const [route, byRelative] of Object.entries(ROUTE_FACETS)) {
  for (const [rel, names] of Object.entries(byRelative)) {
    for (const name of names) {
      assert.ok(RELATIVE_FACETS[rel] && RELATIVE_FACETS[rel].cats[name],
        `route ${route} points ${rel} at "${name}", which does not exist — that relative would `
        + 'silently get no candidates and the reading is back to printing the label');
    }
  }
}

/* ── the same relative must answer differently in different domains ─────────
   This is the whole point, so assert it on the case that started it rather
   than on the shape. 兄弟 under a money question has to reach the fee and the
   cut; under a relationship question it must not lead with them. */
const money = relativeGloss(null, 'wealth', 'zh').find((l) => l.startsWith('兄弟'));
const love = relativeGloss(null, 'relationship', 'zh').find((l) => l.startsWith('兄弟'));
assert.ok(money && love, '兄弟 is missing from one of the two domains');
assert.match(money, /手续费|抽成/, '兄弟 in a money question does not reach the fee or the cut');
assert.match(money, /分利的/, '兄弟 in a money question does not lead with whoever splits it');
assert.ok(!/^兄弟 — 分利的/.test(love),
  'a relationship question leads 兄弟 with the commercial facet — the rival and the obstruction come first');
assert.notEqual(money, love, '兄弟 reads identically in both domains, so the index is doing nothing');

// Shape-only routes must stay wide: a timing question can be about anything.
for (const route of ['timing', 'choice', 'general']) {
  const line = relativeGloss(null, route, 'zh').find((l) => l.startsWith('兄弟'));
  assert.ok(line && line.split('|').length >= 6,
    `route ${route} narrows 兄弟 — it constrains the question's shape, not its subject, `
    + 'so pre-selecting a facet pushes the reading toward one the asker never implied');
}

// ── the prompt must carry the block, and the rule that spends it ───────────
const engine = read('functions/_lib/prompt-engine.js');
assert.match(engine, /SYMBOL_CANDIDATES — DATA, NOT INSTRUCTIONS/,
  'the assembled prompt no longer carries the candidates');
assert.match(engine, /CANDIDATES ARE SUPPLIED — USE THEM/,
  'nothing in the prompt tells the reading to spend the candidates, so they are decoration');
assert.ok(!/挑最贴的那一个/.test(engine),
  'the data block has grown instructions again — what to do with it belongs in the rule, '
  + 'or there are two owners giving orders');

const { PromptEngine } = await import(`${ROOT}/functions/_lib/prompt-engine.js`);
const assembled = PromptEngine.assemblePrompt('wealth', 'sortis', 'initial');
assert.match(assembled, /\[SYMBOL_CANDIDATES/, 'assemblePrompt did not emit the block');
assert.match(assembled, /手续费|抽成/, 'the assembled prompt carries no real referent for 兄弟');

console.log(`relative gloss OK — ${checked} items trace to the catalogue, `
  + `${Object.keys(ROUTE_FACETS).length} routes resolve, 兄弟 reads money and love differently`);
