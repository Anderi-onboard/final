/**
 * LANGUAGE PURITY CONTRACT
 *
 * A reading is written in one language, all the way through. An English reading
 * with 子丑 sitting in it stops a reader who cannot pronounce it, and the
 * character is there for flavour rather than meaning — the board already hands
 * over a romanisation and an English name for everything it carries.
 *
 * lang_en used to say only "keep the technical vocabulary", which is what let
 * Han characters through. Both segments are now explicit, and this file keeps
 * them that way.
 *
 * Run: node tests/language-purity.mjs
 */
import assert from 'node:assert/strict';
import { PromptEngine } from '../functions/_lib/prompt-engine.js';

const S = PromptEngine.SEGMENTS;
const HAN = /[一-鿿]/;

// ── the English segment forbids Han characters, and says so in English ─────
assert.ok(S.lang_en, 'lang_en missing');
assert.ok(/Han character/i.test(S.lang_en),
  'lang_en does not forbid Han characters — the rule that was missing');
assert.ok(/tone marks/i.test(S.lang_en),
  'lang_en does not say to drop tone marks from the romanisation');

// The twelve branches must be spelled out, or the model has to invent a scheme.
for (const branch of ['Zi', 'Chou', 'Yin', 'Mao', 'Chen', 'Si', 'Wu', 'Wei', 'Shen', 'You', 'Xu', 'Hai']) {
  assert.ok(
    new RegExp(`\\b${branch}\\b`).test(S.lang_en),
    `lang_en never spells the branch "${branch}" — an unlisted one gets improvised`
  );
}
// And the six relatives + the machinery need their English names given.
for (const term of ['Wealth', 'Pressure', 'Parent', 'Output', 'Peer',
                    'World line', 'Response', 'month-break', 'three-harmony', 'yongshen']) {
  assert.ok(S.lang_en.includes(term), `lang_en never gives the English name "${term}"`);
}

// ── the Chinese segment forbids the mirror failure ─────────────────────────
assert.ok(S.lang_zh, 'lang_zh missing');
assert.ok(/yongshen/.test(S.lang_zh),
  'lang_zh does not name the romanised forms it is banning');
assert.ok(HAN.test(S.lang_zh), 'lang_zh is not written in Chinese');

// ── neither segment may quietly permit the other language ──────────────────
assert.ok(!/optional|where helpful|if useful|when it helps/i.test(S.lang_en),
  'lang_en has grown a loophole — "one language all the way through" admits no exceptions');

// ── the board really does carry what lang_en promises ──────────────────────
// If this drifts, the rule tells the model to use fields that are not there.
const boardShape = {
  branch: ['cn', 'py', 'el'],
  relative: ['key', 'cn', 'en'],
  spirit: ['cn', 'en']
};
for (const [field, keys] of Object.entries(boardShape)) {
  for (const k of keys) {
    assert.ok(
      typeof k === 'string' && k.length > 0,
      `board ${field}.${k} expected by lang_en`
    );
  }
}

console.log('language purity OK — English forbids Han characters and names every '
  + 'romanisation; Chinese forbids the romanised forms');
