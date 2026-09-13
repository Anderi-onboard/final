/**
 * PXA PACKAGING CONTRACT
 *
 * The packaged executable serves the studio out of itself, and that creates
 * exactly the failure this repo keeps paying for: TWO LISTS THAT MUST AGREE.
 *
 *   · tools/pxa-studio.html references assets by URL
 *   · tools/pxa/app.mjs embeds a set of files and serves them at those URLs
 *   · tools/pxa/build-exe.mjs stages a third set so the text imports resolve
 *
 * Add one import to the studio and forget the other two, and `npm test` stays
 * green, the page works when served from the repo, and the EXECUTABLE shows a
 * blank screen — a failure that only appears in the artefact nobody runs
 * locally. So the lists are compared here instead of trusted.
 *
 * Run: node tests/pxa-package.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const read = (p) => readFileSync(`${ROOT}/${p}`, 'utf8');

const studio = read('tools/pxa-studio.html');
const app = read('tools/pxa/app.mjs');
const build = read('tools/pxa/build-exe.mjs');
const fonts = read('tokens/fonts.css');

let checks = 0;
const ok = (cond, msg) => { checks++; assert.ok(cond, msg); };

/* ── what the studio asks for ──────────────────────────────────────────── */

// href/src attributes and bare module specifiers, resolved against /tools/.
const wanted = new Set();
for (const m of studio.matchAll(/(?:href|src)="([^"]+)"/g)) wanted.add(m[1]);
for (const m of studio.matchAll(/from\s+'([^']+)'/g)) wanted.add(m[1]);

const resolved = [...wanted]
  .filter((u) => u.startsWith('.'))
  .map((u) => new URL(u, 'http://x/tools/').pathname);

ok(resolved.length >= 4,
  `only found ${resolved.length} asset references in the studio — the scan is not matching, `
  + `and a scan that matches nothing passes every assertion below for free`);

// Fonts are pulled in by fonts.css rather than by the page, so follow it.
for (const m of fonts.matchAll(/url\('([^']+)'\)/g)) {
  resolved.push(new URL(m[1], 'http://x/tokens/').pathname);
}

/* ── what the executable serves ────────────────────────────────────────── */

const served = new Set();
for (const m of app.matchAll(/'(\/[^']+)':\s*\[/g)) served.add(m[1]);
ok(served.size >= 6, `app.mjs appears to serve only ${served.size} paths — the scan is not matching`);

const missing = resolved.filter((p) => !served.has(p));
assert.deepEqual(missing, [],
  `the studio asks for these and the packaged executable does not serve them, so the page is blank `
  + `in the .exe while working fine from the repo:\n  ${missing.join('\n  ')}\n`
  + `Add each to the TEXT or FILES map in tools/pxa/app.mjs (and, if it is also imported as a module `
  + `anywhere, to the staging list in build-exe.mjs — see below).`);

/* ── staging: a file cannot be both a module and a text import ─────────── */

const staged = [...app.matchAll(/from\s+'\.\/\.web\/([^']+)'/g)].map((m) => m[1]);
ok(staged.length >= 3, `app.mjs text-imports only ${staged.length} staged files — the scan is not matching`);

/* Scope the scan to the staging loop. A bare pair-of-strings regex also
   matched build-exe.mjs's TARGETS table (['bun-windows-x64', 'pxa.exe']) and
   reported the executable name as an un-imported staged file — a contract that
   invents findings gets ignored as fast as one that misses them. */
const stagingBlock = build.slice(build.indexOf('for (const [from, to] of ['), build.indexOf(']) copyFileSync'));
const pairs = [...stagingBlock.matchAll(/\['([^']+)',\s*'([^']+)'\]/g)];
const copied = pairs.map((m) => m[2]);
for (const f of staged) {
  ok(copied.includes(f),
    `app.mjs imports './.web/${f}' but build-exe.mjs never copies anything to that name, so the build `
    + `fails with a missing-module error whose cause is nowhere near its message. The staging copy is `
    + `not housekeeping: a bundler keeps one representation per resolved path, so text-importing a file `
    + `that is ALSO imported as a module silently strips its named exports.`);
}
for (const f of copied) {
  ok(staged.includes(f),
    `build-exe.mjs stages "${f}" and nothing imports it — either a dead copy, or an import that was `
    + `meant to be added and was not.`);
}

/* ── the sources the staging copies must exist ─────────────────────────── */

ok(pairs.length >= 3, `the staging scan found ${pairs.length} entries — it is not matching`);
for (const m of pairs) {
  ok(existsSync(`${ROOT}/${m[1]}`), `build-exe.mjs stages ${m[1]}, which does not exist`);
}

/* ── the binary must not be able to read the repo ──────────────────────── */

/* Check the FALLTHROUGH specifically, not just "a 404 appears somewhere" — the
   /input branch has its own 404 and happily satisfied a looser assertion while
   the fallthrough had been replaced with a bare res.end(). */
ok(/res\.writeHead\(404,[^)]*\)\.end\('not found'\)/.test(app),
  'app.mjs no longer ends its request handler with an explicit 404. An embedded server that falls '
  + 'through to anything else would serve the whole machine to whatever can reach the port.');
ok(!/readFileSync\(\s*(?:resolve\()?path/.test(app),
  'app.mjs looks like it reads a request path off disk. It must serve ONLY what is embedded, plus the '
  + 'one file explicitly handed over on the command line.');
ok(/'127\.0\.0\.1'/.test(app),
  'the studio server must bind 127.0.0.1, not every interface — this is someone\'s working machine');

/* ── the CLI must not self-dispatch when imported ──────────────────────── */

const cli = read('tools/pxa/cli.mjs');
ok(/cli\\?\.mjs\$/.test(cli) || /cli\\\\?\.mjs/.test(cli),
  'cli.mjs no longer pins its direct-run guard to its own filename. Inside a compiled binary the '
  + 'bundler rewrites import.meta.url and it compared EQUAL to the executable path, so importing the '
  + 'module ran a command at import time and exited before the app dispatched anything — the '
  + 'folder-drop path was dead in the packaged build and perfect under node.');
ok(/export function main\(/.test(cli) && /export const USAGE/.test(cli),
  'cli.mjs must export main() and USAGE so the packaged app dispatches through the same code rather '
  + 'than growing a second copy of the argument handling');
ok(!/readFileSync\(new URL\(import\.meta\.url\)/.test(cli),
  'cli.mjs reads its own source file. A compiled binary has no source tree beside it — the usage text '
  + 'has to be a constant.');

assert.ok(checks >= 12, `only ${checks} assertions ran — this contract is not exercising the packaging`);
console.log(`pxa packaging OK — ${checks} assertions; studio asks for ${resolved.length} assets, `
  + `the executable serves ${served.size}, ${staged.length} staged`);
