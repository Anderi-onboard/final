// Check every block in the site-copy deck against the file it claims to come
// from. A block is stale when its text no longer appears anywhere in that file.
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const at = file => resolve(REPO, file);
const deck = readFileSync(at('copywriting/BOURNEWISE_ALL_SITE_COPY.md'), 'utf8');

const blocks = [];
const re = /^@@ (\S+)\n<!-- source: ([^|]+)\| kind: ([^>]*?)-->\n([\s\S]*?)(?=\n@@ |\n## |\n*$)/gm;
let m;
while ((m = re.exec(deck))) {
  blocks.push({ id: m[1], source: m[2].trim(), kind: m[3].trim(), text: m[4].trim() });
}

const cache = new Map();
function fileText(path) {
  const file = path.split(':')[0].trim();
  if (!cache.has(file)) {
    cache.set(file, existsSync(at(file)) ? readFileSync(at(file), 'utf8') : null);
  }
  return cache.get(file);
}

// Compare loosely: HTML entities, curly quotes and whitespace differ between the
// deck and source without the copy having actually changed.
const norm = s => s
  .replace(/&mdash;/g, '—').replace(/&middot;/g, '·').replace(/&amp;/g, '&')
  .replace(/&hellip;/g, '…').replace(/&rarr;/g, '→').replace(/&times;/g, '×')
  .replace(/&nbsp;/g, ' ')
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/[’‘]/g, "'").replace(/[“”]/g, '"')
  .replace(/\s+/g, ' ').trim().toLowerCase();

let ok = 0, stale = [], missingFile = 0, skipped = 0;
for (const b of blocks) {
  const src = fileText(b.source);
  if (src === null) { missingFile++; continue; }
  if (b.source.startsWith('copy.js') || b.kind === 'template') { skipped++; continue; }
  if (!b.text || b.text.length < 4) { skipped++; continue; }
  // placeholders can't be matched literally
  const probe = norm(b.text).split(/\{\{[a-z]+\}\}/i)[0].trim();
  if (probe.length < 8) { skipped++; continue; }
  if (norm(src).includes(probe)) ok++;
  else stale.push(b);
}

console.log(`blocks:        ${blocks.length}`);
console.log(`still present: ${ok}`);
console.log(`STALE:         ${stale.length}`);
console.log(`unmatchable:   ${skipped}  (too short / placeholder-led)`);
console.log(`missing file:  ${missingFile}\n`);

const bySource = {};
for (const s of stale) {
  const f = s.source.split(':')[0].trim();
  (bySource[f] = bySource[f] || []).push(s);
}
console.log('stale by file:');
for (const [f, list] of Object.entries(bySource).sort((a, b) => b[1].length - a[1].length)) {
  console.log(`  ${f.padEnd(22)} ${list.length}`);
}
console.log('\nfirst 12 stale blocks:');
for (const s of stale.slice(0, 12)) {
  console.log(`  ${s.id}  [${s.source}]`);
  console.log(`     "${s.text.replace(/\n/g, ' ').slice(0, 110)}"`);
}
