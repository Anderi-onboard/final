#!/usr/bin/env node
/* Bump the build tag everywhere, in one step, from whatever it currently is.
   ─────────────────────────────────────────────────────────────────────────
   Run: node scripts/bump-build.mjs        (add --check to only report)

   WHY THIS IS A SCRIPT. Bumping by hand means typing the OLD tag, and a bump
   keyed to a value you typed does nothing at all when the file holds a
   different one — silently, with a zero exit code. Both known failures are
   that same mistake:

     · index.html sat at 20260815e while 144 other tags moved to 20260815q,
       because a tag arriving from another session's merge was never the value
       being replaced. The deployed page and the deployed version.json then
       disagreed, chat-app.js blocked every cast, and reloading served the same
       mismatched pair. Casting was dead in production.

     · Four builds in a row were "bumped" from a tag that had never been
       written, because the first bump was chained behind a failing test and
       never ran. Every later bump searched for a value that did not exist and
       replaced nothing. Four commits claimed build tags the repo never had,
       the ?v= tags never moved, and returning browsers kept their cached JS
       while the commit log said otherwise.

   Neither is caught by reading the diff — the sed reports success either way.
   So the old tag is never named here: it is read from version.json, and the
   replacement matches ANY tag by pattern. tests/build-tag.mjs then proves the
   whole tree agrees. */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const TAG = /\b2026[01][0-9][0-3][0-9][a-z]\b/g;
const SKIP = new Set(['node_modules', '.git', 'tests', 'scripts', 'copywriting']);
const EXT = /\.(html|js|json|css)$/;
const check = process.argv.includes('--check');

const current = JSON.parse(readFileSync(join(ROOT, 'version.json'), 'utf8')).v;
if (!/^2026[01][0-9][0-3][0-9][a-z]$/.test(current)) {
  console.error(`version.json carries a malformed tag: ${current}`);
  process.exit(1);
}

/* Today's date with suffix "a"; if that collides with the tag already in use,
   walk the suffix forward. A tag must never repeat — a browser holding a
   cached file stamped with it would never re-fetch. */
const now = new Date();
const today = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
let next = `${today}a`;
if (current.slice(0, 8) === today) {
  const c = current.charCodeAt(8);
  if (c >= 122) { console.error(`ran out of suffixes for ${today} — the last is ${current}`); process.exit(1); }
  next = `${today}${String.fromCharCode(c + 1)}`;
}

const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name) || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (EXT.test(name) && name !== 'package-lock.json') files.push(p);
  }
})(ROOT);

let total = 0;
const touched = [];
for (const p of files) {
  const src = readFileSync(p, 'utf8');
  const hits = src.match(TAG);
  if (!hits) continue;
  total += hits.length;
  touched.push([relative(ROOT, p), hits.length]);
  if (!check) writeFileSync(p, src.replace(TAG, next));
}

if (!total) {
  console.error('no build tags found — nothing to bump, which is itself the bug');
  process.exit(1);
}
for (const [f, n] of touched.sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(3)}  ${f}`);
console.log(check
  ? `\n${current} — ${total} tags across ${touched.length} files (--check, nothing written)`
  : `\n${current} → ${next} — ${total} tags across ${touched.length} files`);
console.log('now run: node --test tests/*.mjs');
