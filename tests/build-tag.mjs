/**
 * BUILD TAG CONTRACT
 *
 * chat-app.js blocks a cast when the build stamp the page loaded does not match
 * the one version.json serves — a tab left open across a deploy would otherwise
 * keep casting with the old rules. The guard is right, and it has a failure mode
 * that takes the product down completely: if the DEPLOYED page and the DEPLOYED
 * version.json disagree, every cast is blocked and reloading cannot fix it,
 * because the reload serves the same mismatched pair.
 *
 * That happened. index.html sat at 20260815e while the other 144 tags moved to
 * 20260815q, because each bump replaced one specific old value and a tag
 * arriving from another session's merge was never that value. Nothing failed
 * locally; casting was simply dead in production.
 *
 * Bump with a pattern that matches ANY tag, never a specific old one.
 *
 * Run: node tests/build-tag.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const TAG = /\b2026[01][0-9][0-3][0-9][a-z]\b/g;

const version = JSON.parse(readFileSync(`${ROOT}/version.json`, 'utf8')).v;
assert.ok(/^2026[01][0-9][0-3][0-9][a-z]$/.test(version), `version.json carries a malformed tag: ${version}`);

// Every tag in every served HTML and JSON must be the one version.json serves.
const files = readdirSync(ROOT).filter((f) => /\.(html|json)$/.test(f) && f !== 'package-lock.json');
const offenders = [];
for (const f of files) {
  const body = readFileSync(`${ROOT}/${f}`, 'utf8');
  for (const found of body.match(TAG) || []) {
    if (found !== version) offenders.push(`${f}: ${found}`);
  }
}
assert.deepEqual(offenders, [],
  `these carry a tag that is not version.json's ${version} — a page stamped differently from `
  + `version.json blocks every cast, and reloading serves the same mismatch:\n  ` + offenders.join('\n  '));

/* Cache-busting tags live inside JS files too, and those are the ones that rot
   silently: mountain-range.js pinned the palette catalogue at ?v=20260815i
   while the rest of the site moved on, so a browser that had already fetched
   color-groups.json would keep the stale copy through every palette change.
   Nothing breaks — the old file still parses — which is exactly why nobody
   notices. Scan every served JS for a ?v= that is not the current tag. */
const jsFiles = [];
(function walk(dir) {
  for (const entry of readdirSync(`${ROOT}/${dir}`, { withFileTypes: true })) {
    if (['node_modules', '.git', 'tests', 'scripts', 'eval', 'functions', 'copywriting', 'artifacts'].includes(entry.name)) continue;
    const rel = dir ? `${dir}/${entry.name}` : entry.name;
    if (entry.isDirectory()) walk(rel);
    else if (entry.name.endsWith('.js')) jsFiles.push(rel);
  }
})('');

const jsOffenders = [];
for (const f of jsFiles) {
  for (const m of readFileSync(`${ROOT}/${f}`, 'utf8').matchAll(/\?v=(2026[01][0-9][0-3][0-9][a-z])/g)) {
    if (m[1] !== version) jsOffenders.push(`${f}: ?v=${m[1]}`);
  }
}
assert.deepEqual(jsOffenders, [],
  `these JS files request an asset at a stale cache tag, so the browser keeps serving the old `
  + `copy after the asset changes:\n  ` + jsOffenders.join('\n  '));

// index.html's stamp is the one the guard actually compares, so pin it by name.
const index = readFileSync(`${ROOT}/index.html`, 'utf8');
const stamp = index.match(/BW_BUILD\s*=\s*"([^"]+)"/);
assert.ok(stamp, 'index.html no longer stamps window.BW_BUILD — the stale-tab guard cannot run');
assert.equal(stamp[1], version,
  `index.html stamps ${stamp[1]} but version.json serves ${version} — casting is blocked in production`);

// And the guard has to still be there, or none of this matters.
const chat = readFileSync(`${ROOT}/chat-app.js`, 'utf8');
assert.ok(/j\.v !== window\.BW_BUILD/.test(chat), 'the stale-tab guard is gone');

console.log(`build tag OK — ${files.length} files all stamped ${version}, index.html matches version.json`);
