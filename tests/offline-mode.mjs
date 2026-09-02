/**
 * OFFLINE MODE — the API is down and every trigger returns one standard answer.
 *
 * Owner's request, 2026-09-02: take the API offline, and have each trigger
 * return a standard reply containing every web page element.
 *
 * Three of its properties are load-bearing, and all three are the silent kind —
 * break any of them and the site still loads, still answers, still looks right:
 *
 *   1. IT MUST NOT CHARGE. A canned reply is not a reading. claude.js already
 *      says billing a reader for prose they never saw is the one settlement
 *      outcome that cannot be defended; billing them for prose no model wrote
 *      is the same defect with a different cause. The billing gate is skipped
 *      whole rather than run and refunded, because a refunded charge still
 *      leaves a ledger row for a reading that never existed.
 *   2. IT MUST NOT SWALLOW THE CRISIS HARD-STOP. That gate is code, not the
 *      model, so it still runs — handing someone in crisis a sample reading
 *      because the model happens to be switched off is the worst failure this
 *      endpoint has available to it.
 *   3. IT MUST NOT REACH THE NETWORK. Not for the reading, and not for the
 *      router either: buildSystemPrompt takes a completion function and would
 *      otherwise call OpenRouter to route the question before the fixture could
 *      be returned. Offline passes null, which routeQuestion answers locally.
 *
 * And the fixture has to keep doing its job: it exists to light up the page, so
 * every construct the reading renderer understands has to appear in it. That is
 * checked here against the renderer in chat-app.js rather than against a list
 * written down twice — a second list is the thing this repo has paid for
 * repeatedly (the halved cqw rule, the touch targets, the mark fields).
 *
 * Run: node tests/offline-mode.mjs
 */
import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const api = read('functions/api/claude.js');
const chat = read('chat-app.js');
const engine = read('functions/_lib/prompt-engine.js');

/* ── 1 · the switch ──────────────────────────────────────────────────────
   Default offline, re-enabled by an environment variable. The direction
   matters: a missing variable costs nothing, while defaulting to live and
   forgetting to set it is a bill. */
assert.match(api, /function offlineMode\s*\(env\)/, 'offlineMode() exists');
assert.match(
  api,
  /String\(\(env && env\.LIVE_MODEL\) \|\| ''\)\.toLowerCase\(\) !== 'on'/,
  'offline is the DEFAULT and LIVE_MODEL=on is what turns the model back on — ' +
  'if this ever inverts, a deploy silently resumes spend'
);

/* ── 2 · it must not charge ──────────────────────────────────────────────
   The gate that takes money is guardRequest. It has to be behind the offline
   check, not merely followed by a refund. */
assert.match(
  api,
  /if \(db && !offline\) \{\s*\n\s*const gate = await guardRequest\(/,
  'the billing gate is skipped outright when offline'
);
const offlineBlock = api.slice(api.indexOf('if (offline) {'), api.indexOf('if (body.stream === true) return demoStream'));
assert.ok(offlineBlock.length > 40, 'the offline branch was found');
assert.doesNotMatch(offlineBlock, /chargeUnits|chargeUsage|consumeFreeReading/,
  'nothing in the offline branch bills or spends an entitlement');
assert.match(api, /const meta = \{ model: 'offline', charged: 0, offline: true \}/,
  'the stream settles at zero — the client reconciles its balance from this event, ' +
  'so an invented number here would show a reader a balance that never moved');

/* ── 3 · crisis still hard-stops ─────────────────────────────────────────
   Order is the whole property: the crisis return has to come BEFORE the offline
   fixture, or a person in crisis gets a sample reading. */
const iCrisis = api.indexOf("built.route === 'crisis'");
const iOffline = api.indexOf('if (offline) {', iCrisis);
assert.ok(iCrisis > 0, 'the crisis branch exists');
assert.ok(iOffline > iCrisis,
  'the offline fixture is returned AFTER the crisis gate, never instead of it');
assert.match(engine, /CRISIS_PATTERNS\[i\]\.test\(question\)/,
  'crisis is still decided in code, which is why switching the model off cannot disable it');

/* ── 4 · no outbound call ────────────────────────────────────────────────*/
assert.match(
  api,
  /buildSystemPrompt\(question, product, offline \? null : utility, \{ mode \}\)/,
  'offline hands routeQuestion no completion function'
);
assert.match(engine, /if \(!claudeComplete\) return Promise\.resolve\("general"\)/,
  'routeQuestion answers locally when it has none — this is what keeps the assembly offline');

/* ── 5 · the fixture lights up every element ─────────────────────────────
   Read the renderer for what it can produce, then require the fixture to
   contain a trigger for each. The expectations are derived from chat-app.js so
   that a new construct there shows up here as a failure rather than as a
   quietly untested branch. */
const grab = (name) => api.slice(api.indexOf('const ' + name + ' = ['),
  api.indexOf("].join('\\n');", api.indexOf('const ' + name + ' = [')));
const fixture = grab('DEMO_READING_EN');
const fixtureZh = grab('DEMO_READING_ZH');
assert.ok(fixture.length > 500, 'the English preset was found and is not a stub');
assert.ok(fixtureZh.length > 400, 'the Chinese preset was found and is not a stub');

const renders = [
  ['rd-title', /^\s*'# /m, 'a level-1 heading'],
  ['rd-h2', /^\s*'## /m, 'a level-2 heading'],
  ['rd-h3', /^\s*'### /m, 'a level-3 heading'],
  ['rd-list', /^\s*'- /m, 'a list item'],
  ['rd-hr', /^\s*'---',/m, 'a rule'],
  ['<strong>', /\*\*[^*]+\*\*/, 'bold'],
  ['<em>', /(^|[^*])\*[^*\n]+\*(?!\*)/, 'italics'],
  ['gild', /\|[^|]+\|[\s\S]*\|[^|]+\|/, 'two gilded runs, so .gild and .gild.alt both appear']
];
for (const [cls, pattern, what] of renders) {
  assert.ok(chat.includes(cls), `the renderer still produces ${cls}`);
  assert.match(fixture, pattern, `the fixture contains ${what} (renders ${cls})`);
}

/* The 象 marks. Five relatives have to be present, not one: xrChain needs at
   least two before it draws the closing chain, and xrMaybe walks the same five
   to offer the branches the reading did not spend. A fixture with one mark
   tests the button and leaves both panels dark. */
const RELATIVES = ['父母', '兄弟', '子孙', '妻财', '官鬼'];
for (const rel of RELATIVES) {
  for (const [name, text] of [['English', fixture], ['Chinese', fixtureZh]]) {
    assert.ok(
      new RegExp('\\{[^{}|]{1,40}\\|' + rel + '\\}').test(text),
      `the ${name} preset marks ${rel} — all five are needed for the 串联 chain ` +
      'and the unspent-branch panel, and BOTH presets have to carry them or the ' +
      'Chinese preview is missing half the page'
    );
  }
}
assert.match(chat, /var ring = \["父母", "兄弟", "子孙", "妻财", "官鬼"\]/,
  'the chain still walks these five, so the fixture list above is still the right one');

/* ── 6 · the marker is machine-readable, not prose ───────────────────────
   The preset used to open by announcing that the engine was offline. The owner
   asked for it to preview the real thing instead (2026-09-02), so the notice is
   gone from the TEXT — but not from the wire. Every reply, the stream's closing
   event and the status endpoint all still carry `offline: true`, which is what
   makes this a switched-off API rather than a disguised one. Losing that is the
   change that would need arguing for, so it is pinned here. */
assert.match(api, /offline: offlineMode\(env\)/, 'the status endpoint reports it');
assert.match(api, /model: 'offline', offline: true/, 'every JSON reply carries the marker');
assert.match(api, /const meta = \{ model: 'offline', charged: 0, offline: true \}/,
  'and so does the event that closes the stream');

/* ── 6b · the preset follows the question's language ─────────────────────
   A real reading does; a fixture that always answered in English would be the
   one part of the demo that behaves unlike the product, and it is also the only
   way to see the Chinese face set. */
assert.match(api, /built\.lang === 'zh'/, 'the language comes from the same detector a reading uses');
assert.match(api, /zh \? DEMO_READING_ZH : DEMO_READING_EN/, 'and picks the matching preset');
assert.match(api, /zh \? DEMO_FOLLOWUP_ZH : DEMO_FOLLOWUP/, 'the follow-ups follow it too');

/* The Chinese preset is a type specimen as well as a reading: it has to carry
   full-width marks, ASCII marks and a Latin run in the same text, because that
   mixture is exactly what goes wrong when the Latin face leads the stack. */
assert.match(fixtureZh, /[，。、：；「」]/u, 'the Chinese preset uses full-width punctuation');
assert.match(fixtureZh, /[,.:;]/, 'and carries ASCII marks for the comparison');
assert.match(fixtureZh, /[A-Za-z]{4,}/, 'and a Latin run, which the Song face must also set');

/* ── 7 · the utility roles answer in their own shapes ────────────────────
   Each is parsed differently by the client; a fixture that returned prose to
   all of them would leave the follow-up panel on its static fallback and look
   like it worked. */
assert.match(api, /role === 'followup' \|\| role === 'followup_suggest'/, 'follow-up is answered');
assert.match(api, /DEMO_FOLLOWUP/, 'with its own fixture');
assert.match(api, /'Gate \| /, 'in the `Label | question` shape the client parses');
assert.match(chat, /role: "followup"/, 'which is the role the client actually asks for');
assert.match(api, /role === 'intent'[\s\S]{0,400}FOLLOWUP/, 'intent answers in its own vocabulary');
assert.match(api, /role === 'router'[\s\S]{0,200}'general'/, 'the router answers a real route name');

/* ── 8 · the wire format is the real one ─────────────────────────────────
   Same events as the live pump, so this exercises the client's actual stream
   path rather than a second one written for the demo. */
assert.match(api, /type: 'content_block_delta', delta: \{ type: 'text_delta'/,
  'the offline stream emits the same delta records as the live pump');
assert.match(api, /event: bw_meta/, 'and terminates with the same meta event');
assert.match(chat.includes('bw_meta') ? chat : read('prompt-router.js'), /bw_meta/,
  'which is what the client listens for');

console.log('offline-mode: ok — default offline, unbilled, crisis intact, ' +
  `${renders.length} constructs and ${RELATIVES.length} 象 in the fixture`);
