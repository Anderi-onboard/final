/**
 * RATE CARD CONTRACT
 *
 * /api/rates is the one place the site learns what things cost, so a number
 * that is wrong here is wrong on the pricing page and in the composer hint.
 *
 * It used to carry its own hardcoded token counts — 17,885 for Sortis, 15,119
 * for Stria. The prompt then grew and they did not: measured against the
 * assembled stack they were 49% and 56% low, so every estimate shown to a
 * reader was roughly half the real charge. Nothing failed; the page just
 * quietly lied.
 *
 * The figures are derived now. This file checks that they still are, and that
 * they still track the prompt.
 *
 * Run: node tests/rates-contract.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { onRequestGet } from '../functions/api/rates.js';
import { PromptEngine } from '../functions/_lib/prompt-engine.js';
import { MODEL_RATES, METHOD_COST, FOLLOW_COST, estimateTokens } from '../functions/_lib/db.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(resolve(ROOT, 'functions/api/rates.js'), 'utf8');

// ── nothing is typed in ────────────────────────────────────────────────────
assert.ok(/PromptEngine\.assemblePrompt\(/.test(src),
  'rates.js no longer measures the assembled prompt — the figures can drift again');
assert.ok(/estimateTokens/.test(src),
  'rates.js is not using the biller\'s own token estimator');
for (const stale of ['17885', '15119', '17.885', '15.119']) {
  assert.ok(!src.includes(stale), `rates.js still carries the hardcoded count ${stale}`);
}

const data = await onRequestGet({ env: {} }).json();

for (const product of ['sortis', 'stria']) {
  const p = data.products[product];
  assert.ok(p, `${product} missing from the rate card`);

  // ── the input figure tracks the real prompt ──────────────────────────────
  const promptTokens = (() => {
    const s = PromptEngine.assemblePrompt('general', product, 'initial');
    const cjk = (s.match(/[　-〿㐀-䶿一-鿿豈-﫿＀-￯]/g) || []).length;
    return estimateTokens(s.length, cjk);
  })();
  assert.ok(
    p.typicalInputTokens > promptTokens,
    `${product}: typicalInputTokens (${p.typicalInputTokens}) is below the system prompt alone `
    + `(${promptTokens}) — the turn payload has gone missing`
  );
  assert.ok(
    p.typicalInputTokens < promptTokens * 1.6,
    `${product}: typicalInputTokens (${p.typicalInputTokens}) is far above the prompt `
    + `(${promptTokens}) — the turn allowance has run away`
  );

  // ── units are arithmetic on the model's own rate, not a stored number ────
  const rate = MODEL_RATES[p.model];
  const expected = Math.ceil((p.typicalInputTokens / 1000) * rate.in
    + (p.typicalOutputTokens / 1000) * rate.out);
  assert.equal(p.typicalUnits, expected,
    `${product}: typicalUnits does not equal its own inputs times the model rate`);

  // ── one payload, one answer ──────────────────────────────────────────────
  assert.equal(p.typical, p.typicalUnits,
    `${product}: the card shows two different "typical" numbers`);

  // ── a follow-up is input-dominated, so it is not trivially cheap ─────────
  assert.ok(p.typicalFollowUp > p.typicalUnits * 0.4,
    `${product}: the follow-up estimate (${p.typicalFollowUp}) is implausibly low against `
    + `a full reading (${p.typicalUnits}) — a follow-up carries the same board and history`);
}

// ── the offline fallbacks are in the same world as the derived figures ─────
for (const product of ['sortis', 'stria']) {
  const live = data.products[product].typicalUnits;
  const drift = Math.abs(METHOD_COST[product] - live) / live;
  assert.ok(drift < 0.25,
    `METHOD_COST.${product} (${METHOD_COST[product]}) has drifted ${Math.round(drift * 100)}% `
    + `from the derived figure (${live}) — re-snapshot it or stop shipping it`);
  assert.ok(FOLLOW_COST[product] > 0, `FOLLOW_COST.${product} is missing`);
}

console.log('rate card OK — figures derived from the assembled prompt, '
  + `sortis ≈ ${data.products.sortis.typicalUnits} units, `
  + `stria ≈ ${data.products.stria.typicalUnits} units, fallbacks within 25%`);
