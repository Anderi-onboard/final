/* The Obsidian vault in knowledge/ must stay true to the engine, stay
 * navigable, and stay off the public site.
 *
 * Three ways it goes wrong, none of them visible in the UI:
 *
 *   1. Drift. 07 卦库 and 08 类象库 are generated from liuyao-engine.js and
 *      assets/xiangshu/lei-xiang.json. Change either without re-running the
 *      generator and the vault quietly disagrees with the board a reader is
 *      shown — someone checking a reading against it is told the board is
 *      wrong when the notes are.
 *   2. Dead links. A [[link]] to a note that does not exist renders as a
 *      greyed-out stub in Obsidian and as nothing at all here. A knowledge
 *      base whose cross-references rot is a pile of files.
 *   3. Exposure. The vault explains how a reading is reasoned — the same
 *      material as the prompt stack, which is the product. It lives inside the
 *      served tree, so only functions/_middleware.js keeps it private.
 *
 * Run: node tests/knowledge-vault.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { onRequest } from '../functions/_middleware.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VAULT = path.join(ROOT, 'knowledge');

// ── 1. generated notes are current ──────────────────────────────────────────
const gen = spawnSync(process.execPath, ['scripts/build-knowledge-vault.mjs', '--check'], { cwd: ROOT, encoding: 'utf8' });
assert.equal(gen.status, 0, (gen.stderr || gen.stdout).trim());

// ── 2. every [[link]] resolves ──────────────────────────────────────────────
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (e.name.startsWith('.')) return [];
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}
const notes = walk(VAULT).filter((f) => f.endsWith('.md'));
const names = new Set(notes.map((f) => path.basename(f, '.md')));

/* Obsidian resolves a link by file name; an alias in front matter only helps
   autocomplete, so [[alias]] with no such file is a dead link there too. */
const dead = [];
let linkCount = 0;
for (const file of notes) {
  const body = fs.readFileSync(file, 'utf8').replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
  for (const m of body.matchAll(/\[\[([^\]]+)\]\]/g)) {
    const target = m[1].split('|')[0].split('#')[0].trim();
    if (!target) continue;                 // an empty [[ ]] placeholder in a template
    linkCount++;
    if (!names.has(target)) dead.push(`${path.relative(VAULT, file)} → [[${target}]]`);
  }
}
/* Guard against a pass that measured nothing: a broken glob or regex would
   report zero dead links over zero links. */
assert.ok(notes.length >= 150, `only ${notes.length} notes found under knowledge/ — the walk looks wrong`);
assert.ok(linkCount >= 800, `only ${linkCount} links found — the link pattern looks wrong`);
assert.deepEqual(dead, [], 'dead links in the vault:\n  ' + dead.join('\n  '));

// ── 3. the vault is not served ──────────────────────────────────────────────
const NEXT = Symbol('next');
async function visit(p) {
  const out = await onRequest({
    request: new Request('https://bournewise.com' + p),
    next: async () => NEXT,
    env: { ASSETS: { fetch: async () => new Response('404', { status: 200 }) } }
  });
  return out === NEXT ? 'pass' : out.status;
}
for (const p of ['/knowledge/', '/knowledge/00 导览/首页.md', '/knowledge/03 断法/用神.md', '/knowledge/.obsidian/app.json']) {
  assert.equal(await visit(p), 404, `${p} is reachable on the public site`);
}
const redirects = fs.readFileSync(path.join(ROOT, '_redirects'), 'utf8');
assert.match(redirects, /^\/knowledge\/\*\s/m, '_redirects has no rule for /knowledge/* — it has drifted from the middleware');

console.log(`knowledge vault OK — ${notes.length} notes, ${linkCount} links resolve, /knowledge denied`);
