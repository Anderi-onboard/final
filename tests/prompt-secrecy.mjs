/**
 * PROMPT SECRECY CONTRACT
 *
 * The instruction stack is the product. It used to sit at the web root and load
 * via <script src="./prompt-engine.js">, which meant two failures at once:
 *
 *   1. every segment was readable by anyone at /prompt-engine.js, and
 *   2. the browser assembled the system prompt and POSTed it up for the API to
 *      forward verbatim — so any account could substitute its own and run it on
 *      the owner's key with iron_laws, the priority ladder, the crisis ladder
 *      and the minor protections all stripped out.
 *
 * The engine now lives in functions/_lib/, which Cloudflare Pages does not
 * route, and /api/claude refuses a client-supplied `system` outright.
 *
 * This file keeps it that way. The regression is a one-line mistake — a script
 * tag, an import from a file under the web root, a convenience re-export — and
 * it would not be visible in the UI or in any other test.
 *
 * Run: node tests/prompt-secrecy.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/* What Pages actually serves is what git carries: the deploy is a checkout, so
   an untracked or gitignored file on this machine never reaches production.
   Scanning the working tree instead would fail on local scratch — and, worse,
   would PASS for a tracked leak that happened to be absent locally.
   functions/ is excluded because Pages compiles it rather than serving it. */
// functions/ is compiled rather than served; the rest are development
// directories that _redirects 404s. Both are verified below, so this list
// cannot be used to quietly hide a leak from the scan.
const DEV_DIRS = ['functions/', 'eval/', 'tests/', 'scripts/', 'copywriting/', 'artifacts/'];

const tracked = execFileSync('git', ['-C', ROOT, 'ls-files'], { encoding: 'utf8' })
  .split('\n')
  .filter(Boolean)
  .filter((f) => !DEV_DIRS.some((d) => f.startsWith(d)));

const servedText = tracked
  .filter((f) => ['.js', '.html', '.css', '.json', '.txt', '.md'].includes(extname(f)))
  .filter((f) => existsSync(join(ROOT, f)))
  .map((f) => [f, readFileSync(join(ROOT, f), 'utf8')]);

// ── 1. the engine itself is not in the served tree ─────────────────────────
assert.ok(
  !existsSync(join(ROOT, 'prompt-engine.js')),
  'prompt-engine.js is back at the web root — it would be served at /prompt-engine.js'
);
assert.ok(
  existsSync(join(ROOT, 'functions/_lib/prompt-engine.js')),
  'functions/_lib/prompt-engine.js is missing'
);

// ── 2. nothing served references it ────────────────────────────────────────
for (const [name, body] of servedText) {
  assert.ok(
    !/<script[^>]+prompt-engine\.js/.test(body),
    `${name} loads prompt-engine.js in a <script> tag`
  );
  assert.ok(
    !/\bwindow\.BWPromptEngine\b/.test(body),
    `${name} reaches for window.BWPromptEngine, which no longer exists in the browser`
  );
  assert.ok(
    !/from\s+['"][^'"]*_lib\/prompt-engine/.test(body),
    `${name} imports the server-side engine`
  );
}

// ── 3. no segment text leaked into anything served ─────────────────────────
// Sampled from across the stack rather than one segment, so a partial copy is
// caught as surely as a whole one.
const CANARIES = [
  'HOW THIS SOUNDS',                  // voice
  'INFERENCE TRAPS',                  // inference_traps
  'IRON LAWS',                        // iron_laws
  'PRIORITY LADDER',                  // priority_ladder
  'YOUR OWN READ COMES FIRST',        // stance
  'CORE METHOD: Liu Yao Six Steps',   // sortis_method
  'DEPLOYMENT VOICE',                 // deploy_voice
  'You are a question classifier',    // ROUTER_SYSTEM
  'You are a quality checker'         // QC_SYSTEM
];
for (const [name, body] of servedText) {
  for (const canary of CANARIES) {
    assert.ok(
      !body.includes(canary),
      `${name} contains prompt text ("${canary}") — that text is served to every visitor`
    );
  }
}

// ── 4. the API refuses a client-supplied system prompt ─────────────────────
const claude = readFileSync(join(ROOT, 'functions/api/claude.js'), 'utf8');
assert.ok(
  /CLIENT_SYSTEM_REJECTED/.test(claude),
  '/api/claude no longer rejects a client-supplied system prompt'
);
assert.ok(
  !/content:\s*body\.system/.test(claude),
  '/api/claude is forwarding body.system to the model again'
);
assert.ok(
  /buildSystem\(/.test(claude),
  '/api/claude is not assembling the system prompt server-side'
);

// ── 5. the client-safe module really is prompt-free ────────────────────────
const checks = readFileSync(join(ROOT, 'prompt-checks.js'), 'utf8');
assert.ok(!/\bSEGMENTS\b/.test(checks), 'prompt-checks.js references SEGMENTS');
assert.ok(!/\bbuild:\s*function/.test(checks), 'prompt-checks.js has gained a prompt builder');

// ── 6. every dev directory excluded above is actually blocked from the web ──
const redirects = readFileSync(join(ROOT, '_redirects'), 'utf8');
for (const dir of DEV_DIRS) {
  if (dir === 'functions/') continue;          // Pages never routes functions/
  assert.ok(
    new RegExp('^/' + dir.replace('/', '') + '/\\*\\s', 'm').test(redirects),
    `${dir} is skipped by this scan but has no _redirects rule — it would be served`
  );
}

console.log(`prompt secrecy OK — ${servedText.length} served files scanned, `
  + `${CANARIES.length} canaries clean, API assembles server-side`);
