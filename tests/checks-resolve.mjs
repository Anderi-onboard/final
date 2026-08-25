/**
 * BROWSER CHECKS RESOLVE CONTRACT
 *
 * prompt-checks.js runs in the browser on every reading. It referenced
 * thirteen names — YONGSHEN_NAMED, REFUSAL, REAL_LIMIT, checkGrowthAnchored
 * and the ten patterns that function uses — that were only ever defined in
 * functions/_lib/prompt-engine.js. When the checks were split out of the
 * engine, the code moved and the constants did not.
 *
 * So checkReadability() threw ReferenceError on its second line, on EVERY
 * reading. The throw landed in routedReading's catch and became an error
 * object with no HTTP status, which castFail rendered through its catch-all:
 * a reading that had streamed to completion was replaced by a note about the
 * reader's balance, and the text was deleted. Measured on production
 * 2026-08-24 — the shipped file used four such names and defined none.
 *
 * Nothing caught it. Every other contract reads these files as text and
 * asserts on what they say; none of them ever ran the code. A module that
 * throws on line two passes a grep for the rule it is supposed to enforce.
 *
 * This one executes it.
 *
 * Run: node tests/checks-resolve.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');

// ── it has to load and expose its three functions ──────────────────────────
const sandbox = { console: { log() {}, warn() {}, error() {} }, Math, JSON, Object, Array, String, Number, Error, Date, RegExp, Set, Map };
sandbox.window = sandbox;
sandbox.self = sandbox;
vm.createContext(sandbox);
vm.runInContext(readFileSync(`${ROOT}/prompt-checks.js`, 'utf8'), sandbox, { filename: 'prompt-checks.js' });

const PC = sandbox.BWPromptChecks;
assert.ok(PC, 'prompt-checks.js published nothing');
for (const fn of ['checkReadability', 'checkBoardFacts', 'boardCarries']) {
  assert.equal(typeof PC[fn], 'function', `${fn} is not exported`);
}

/* ── and every branch has to survive being taken ───────────────────────────
   A ReferenceError only fires on the line that reaches the missing name, so
   readings must be long enough and varied enough to walk the guards: the
   用神 check needs 200+ characters, and checkGrowthAnchored splits on
   paragraphs and sentences before testing ten patterns. */
const board = { lines: [], moving: [] };
const samples = [
  ['empty', ''],
  ['short', '动的是官鬼。'],
  ['long zh', '用神妻财持世,动的偏偏是官鬼 —— 所以卡你的不是能力,是审批那一关。'.repeat(8)],
  ['long en', 'The Wealth line is the one to read here, and it is the line that moves. '.repeat(8)],
  ['refusal', '这个卦答不了这件事。'.repeat(30)],
  ['refusal with a real limit', '没有对应的用神,这不是起卦能定的事。'.repeat(30)],
  ['multi-paragraph', ['第一段说清楚用神是谁。', '', '第二段翻译成能查的东西。', '', '第三段给出路。'].join('\n').repeat(12)]
];
for (const [label, text] of samples) {
  const readability = PC.checkReadability(text);   // throws if a name is unresolved
  assert.ok(readability && typeof readability.ok === 'boolean',
    `checkReadability returned no verdict for ${label}`);
  assert.ok(Array.isArray(readability.issues), `checkReadability gave no issues array for ${label}`);
  const facts = PC.checkBoardFacts(text, board);
  assert.ok(facts && typeof facts.ok === 'boolean', `checkBoardFacts returned no verdict for ${label}`);
}

/* ── static sweep, so a NEW dangling reference fails here too ──────────────
   Executing the samples above proves the paths they walk. This catches a name
   added later on a branch no sample happens to reach. */
const source = readFileSync(`${ROOT}/prompt-checks.js`, 'utf8');
const code = source
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/^\s*\/\/.*$/gm, ' ')
  .replace(/(['"`])(?:\\.|(?!\1).)*\1/g, ' "" ')
  .replace(/\/(?![*/])(?:\\.|\[(?:\\.|[^\]])*\]|[^/\n\\])+\/[gimsuy]*/g, ' /re/ ');

const declared = new Set([...source.matchAll(/(?:var|const|let|function)\s+([A-Za-z_$][\w$]*)/g)].map((m) => m[1]));
const GLOBALS = new Set(['window', 'self', 'console', 'Math', 'JSON', 'Object', 'Array', 'String',
  'Number', 'Boolean', 'Error', 'Date', 'RegExp', 'Set', 'Map', 'parseInt', 'parseFloat',
  'isNaN', 'isFinite', 'undefined', 'NaN', 'Infinity', 'arguments', 'this']);

const dangling = new Set();
for (const m of code.matchAll(/\b([A-Z][A-Z0-9_]{2,})\b/g)) {
  if (!declared.has(m[1]) && !GLOBALS.has(m[1])) dangling.add(m[1]);
}
assert.deepEqual([...dangling].sort(), [],
  'prompt-checks.js uses SHOUTING_CASE names it never declares — they lived in '
  + 'functions/_lib/prompt-engine.js, and the browser has no access to that file');

// Anti-vacuity: if the sweep stops seeing constants, it stopped working.
const seen = [...code.matchAll(/\b([A-Z][A-Z0-9_]{2,})\b/g)].length;
assert.ok(seen >= 10,
  `only ${seen} constant references parsed — the scrubber ate the code, so this sweep is hollow`);


/* ── a checker must not be able to destroy the reading it checks ───────────
   Declaring the constants fixed one instance. The shape was the real fault:
   these run after the text has streamed and after pumpAndSettle has billed
   for it, and their verdicts are telemetry — prompt-router says so itself,
   "surfaced as telemetry, never acted on". A bare call let any throw inside a
   checker take the whole reading down through routedReading's catch. */
const router = readFileSync(`${ROOT}/prompt-router.js`, 'utf8');
assert.match(router, /function safeCheck\(/,
  'prompt-router has no guard around the post-generation checks');
for (const call of ['checkBoardFacts', 'checkReadability']) {
  assert.ok(new RegExp(`safeCheck\\("${call}"`).test(router),
    `${call} is called without safeCheck — a fault in it kills a paid reading`);
  assert.ok(!new RegExp(`var \\w+ = PC\\.${call} \\?`).test(router),
    `${call} still has a bare call path that can throw into routedReading's catch`);
}

console.log(`browser checks resolve OK — ${samples.length} readings walked every guard without a `
  + `ReferenceError, and all ${declared.size} names resolve locally`);
