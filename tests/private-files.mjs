/* The internal files must not be reachable on the public site.
 *
 * This test exists because the previous guard never ran. `_redirects` listed
 * every one of these paths and Cloudflare Pages served them anyway: a static
 * asset wins, and `_redirects` is only consulted when nothing matches. The two
 * entries that did 404 were the two whose files are not deployed — so the
 * blocklist passed exactly where it was not needed, which is why looking at it
 * never revealed anything.
 *
 * So this does not read the middleware's source and decide whether it looks
 * right. It imports the real onRequest and sends real paths through it. A
 * guard is only worth what it does when called.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { onRequest } from '../functions/_middleware.js';

const root = new URL('../', import.meta.url);
const NEXT = Symbol('next');

/* Minimal stand-in for the Pages context: next() marks "handed to the asset
   pipeline", and ASSETS.fetch stands in for the 404 page lookup. */
async function visit(path) {
  const ctx = {
    request: new Request('https://bournewise.com' + path),
    next: async () => NEXT,
    env: { ASSETS: { fetch: async () => new Response('<!doctype html>404', { status: 200 }) } }
  };
  const out = await onRequest(ctx);
  return out === NEXT ? 'pass' : out.status;
}

/* Files that exist in the deployed tree and must be denied. Every one of these
   answered 200 with its real content in production before the middleware. */
const PRIVATE = [
  '/PROGRESS.md', '/CLAUDE.md', '/ARCHITECTURE.md', '/OVERVIEW.md', '/RELEASES.md',
  '/AUDIT-20260816.md', '/BRAND_VOICE.md', '/schema.sql', '/package.json',
  '/palette-guide.html', '/palette-overview.html', '/baoxianghua-compositions.html',
  '/tests/palette-contract.mjs', '/tests/prompt-secrecy.mjs', '/scripts/dump-prompt.mjs',
  '/tools/palette-atlas.html', '/tools/palette-contrast.html',
  '/artifacts/palette-cache-history.json', '/eval/run-eval.js',
  '/copywriting/BOURNEWISE_VOICE_DECK.md', '/qa/palette-editor-tool.png'
];

const leaked = [];
for (const p of PRIVATE) {
  const r = await visit(p);
  if (r !== 404) leaked.push(`${p} -> ${r}`);
}
assert.deepEqual(leaked, [],
  'these internal paths are still reachable:\n  ' + leaked.join('\n  '));

/* The site itself must still be served. A blocklist that swallows the product
   is the other way this goes wrong, and it would be caught by nothing else
   here — every other test reads files off disk. */
const PUBLIC = [
  '/', '/index.html', '/pricing.html', '/about.html', '/guide.html', '/login.html',
  '/settings.html', '/terms.html', '/privacy.html', '/refund.html', '/404.html',
  '/version.json', '/assets/weave.js', '/assets/marks.js', '/assets/blocks.js',
  '/assets/palettes/color-groups.json', '/assets/backgrounds/mountain-range.js',
  '/tokens/refinement.css', '/tokens/blocks.css', '/chat-app.js', '/account.js',
  '/api/claude', '/api/account/me', '/assets/fonts/BioRhyme.woff2'
];

const blocked = [];
for (const p of PUBLIC) {
  const r = await visit(p);
  if (r !== 'pass') blocked.push(`${p} -> ${r}`);
}
assert.deepEqual(blocked, [],
  'these public paths are being denied:\n  ' + blocked.join('\n  '));

/* Keep _redirects in step. It cannot enforce this on its own — that is the
   whole finding — but two lists that disagree mean the next reader trusts the
   one that does nothing. */
const redirects = fs.readFileSync(new URL('_redirects', root), 'utf8');
const drifted = ['/PROGRESS.md', '/CLAUDE.md', '/ARCHITECTURE.md', '/OVERVIEW.md', '/RELEASES.md']
  .filter((p) => !redirects.includes(p));
assert.deepEqual(drifted, [],
  '_redirects has drifted from the middleware blocklist:\n  ' + drifted.join('\n  '));

console.log(`private files OK — ${PRIVATE.length} internal paths denied, ${PUBLIC.length} public paths served`);
