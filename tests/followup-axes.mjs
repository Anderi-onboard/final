/**
 * FOLLOW-UP AXES CONTRACT
 *
 * The old follow-up chips asked for more of the reading just given — "what is
 * the weakest assumption", "where is the leverage". A reading that did its job
 * has already answered those, so the better the first reading, the emptier the
 * chip. That is the mechanism behind "a complete first answer kills the reason
 * to follow up".
 *
 * The axes are a different question of the SAME board, on the axes a first
 * reading is deliberately kept off (output_sortis: do not hand someone timing
 * machinery when they did not ask when). Each routes into a segment set that
 * already exists.
 *
 * Run: node tests/followup-axes.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PromptEngine } from '../functions/_lib/prompt-engine.js';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const checks = readFileSync(`${ROOT}/prompt-checks.js`, 'utf8');
const chat = readFileSync(`${ROOT}/chat-app.js`, 'utf8');
const css = readFileSync(`${ROOT}/index.html`, 'utf8');

// Load the browser module the way the browser does.
const win = {};
new Function('window', checks)(win);
const AXES = win.BWPromptChecks && win.BWPromptChecks.FOLLOWUP_AXES;
assert.ok(AXES, 'FOLLOWUP_AXES is not exported to the browser');

for (const product of ['sortis', 'stria']) {
  const list = AXES[product];
  assert.ok(Array.isArray(list) && list.length >= 4, `${product} needs a usable set of axes`);
  const keys = new Set();
  for (const a of list) {
    assert.ok(a.key && a.label && a.q, `${product}: an axis is missing key/label/question`);
    assert.ok(!keys.has(a.key), `${product}: duplicate axis "${a.key}"`);
    keys.add(a.key);
    // An axis has to be a QUESTION the reader could have typed, because that is
    // what the chip puts in the composer.
    assert.ok(a.q.length > 30, `${product}.${a.key}: the question is too thin to route on`);
  }
  // The axes that make this work are the ones a first reading may not cover.
  for (const required of ['timing', 'other', 'imagery']) {
    assert.ok(keys.has(required), `${product} is missing the "${required}" axis`);
  }
  assert.ok(keys.has('review'), `${product} is missing the come-back-later axis`);
}

// Sortis carries the quantity method, so it gets that axis; Stria does not.
assert.ok(AXES.sortis.some((a) => a.key === 'quantity'),
  'Sortis should offer the quantity axis — 河图 numbers are part of its method');

// ── each axis must land on a route that exists ─────────────────────────────
for (const route of ['timing', 'relationship', 'appearance']) {
  assert.ok(PromptEngine.ROUTES[route], `route "${route}" is gone — an axis routes into nothing`);
}

// ── no prompt text leaked into the browser with them ───────────────────────
assert.ok(!/SEGMENTS/.test(checks), 'prompt-checks.js references SEGMENTS');
assert.ok(!/\bbuild:\s*function/.test(checks), 'prompt-checks.js has gained a prompt builder');

// ── the chips are wired and reachable ──────────────────────────────────────
assert.ok(/closest\("\.rd-axis"\)/.test(chat),
  'the click handler does not match .rd-axis — the chips render but do nothing');
assert.ok(/data-prompt="' \+ esc\(a\.q\)/.test(chat),
  'an axis chip does not carry its question');
assert.ok(/\.rd-axis\{/.test(css), 'the axis chips have no styles');
assert.ok(/\.rd-axis:focus-visible/.test(css), 'the axis chips have no visible focus state');

// ── an axis fills the composer, it does not send ───────────────────────────
// The reader edits and spends deliberately; that rule predates this panel.
const handler = chat.slice(chat.indexOf('closest(".rd-axis")'), chat.indexOf('closest(".rd-axis")') + 700);
assert.ok(/promptInput\.value = prompt\.getAttribute\("data-prompt"\)/.test(handler),
  'an axis chip must fill the composer rather than sending a metered request on click');

console.log(`follow-up axes OK — ${AXES.sortis.length} sortis / ${AXES.stria.length} stria, `
  + 'all routed, all wired, none of them send on click');
