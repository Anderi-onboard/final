/**
 * FONT LOCK CONTRACT
 *
 * Three families, self-hosted, and that is the whole set. CLAUDE.md §3 states
 * it as a hard rule, and the rule kept losing anyway: Lora, Fraunces, Inter,
 * Rubik, IBM Plex, Sawarabi and Bree Serif each shipped at some point and each
 * had to be hunted back out. A font is the easiest thing in the world for an
 * agent to add — one declaration, looks fine locally, nothing fails.
 *
 * That is exactly why prose could not hold it. This file can: adding a fourth
 * family now turns the suite red, and removing the lock means deleting this
 * test, which is visible in the diff and has to be argued for.
 *
 * Run: node tests/font-lock.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const SKIP = new Set(['node_modules', '.git', 'copywriting', 'artifacts', 'tests', 'scripts']);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name) || name.startsWith('.')) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (['.html', '.css', '.js'].includes(extname(name))) out.push(path);
  }
  return out;
}
const files = walk(ROOT);
const rel = (path) => path.slice(ROOT.length + 1);

// CSS inside a JS string arrives with escaped quotes (font-family:\'BioRhyme\').
// Unescape first or the declaration parses as a lone backslash.
const cssText = (path) => readFileSync(path, 'utf8').replace(/\\(['"])/g, '$1');

// ── the set is exactly three, self-hosted ──────────────────────────────────
const woff2 = readdirSync(join(ROOT, 'assets/fonts')).filter((f) => f.endsWith('.woff2')).sort();
assert.deepEqual(woff2, ['BioRhyme.woff2', 'Pacifico-400.woff2', 'Spinnaker-400.woff2'],
  `assets/fonts must hold exactly the three locked families, found: ${woff2.join(', ')}`);

// ── the real gate: a self-hosted family needs an @font-face ────────────────
//
// An earlier version of this file allow-listed every acceptable family name and
// flagged the rest. That was the wrong invariant twice over: it fired on the
// CJK and system fallbacks the three families genuinely need (Noto Serif SC,
// Songti SC, Georgia), and it would still have missed a fourth webfont added
// under a name nobody thought to ban.
//
// A webfont cannot render without being declared. Counting @font-face blocks
// gates the thing that actually matters, and generic fallbacks stay free.
const faces = [];
for (const path of files) {
  for (const m of cssText(path).matchAll(/@font-face\s*{[^}]*font-family\s*:\s*['"]?([^'";}]+)/gi)) {
    faces.push({ file: rel(path), family: m[1].trim() });
  }
}
assert.deepEqual(
  faces.map((f) => f.family).sort(),
  ['BioRhyme', 'Pacifico', 'Spinnaker'],
  `exactly three @font-face declarations are allowed, found: ${faces.map((f) => `${f.family} (${f.file})`).join(', ')}`
);

// ── the deleted families stay deleted ──────────────────────────────────────
//
// Each of these shipped once and had to be hunted back out. Named individually
// so a failure says which ghost returned rather than "a font is wrong".
const BANNED = ['inter', 'lora', 'fraunces', 'rubik', 'ibm plex', 'sawarabi', 'bree serif'];
const DECLARES_FAMILY = /(?:font-family|--font[a-z-]*)\s*:\s*([^;}\n]+)/gi;

// Values are read out of HTML attributes too, where the declaration ends at the
// closing quote rather than a semicolon — cut there or the match swallows markup.
const familyNames = (text) => {
  const out = [];
  for (const m of text.matchAll(DECLARES_FAMILY)) {
    for (const raw of m[1].split(',')) {
      const name = raw.trim().replace(/^['"]+/, '').split(/["'<>]/)[0]
        .replace(/\s*\)\s*$/, '').replace(/\s*!important$/, '').trim().toLowerCase();
      if (name && !name.startsWith('var(') && !name.startsWith('--')) out.push(name);
    }
  }
  return out;
};

let parsed = 0;
for (const ghost of BANNED) {
  const found = files.filter((path) => {
    const names = familyNames(cssText(path));
    parsed += names.length;
    return names.some((name) => name === ghost || name.startsWith(`${ghost} `));
  });
  assert.deepEqual(found.map(rel), [], `${ghost} was deleted before and is back`);
}

// Guard against the guard going hollow. An earlier revision excluded quotes from
// the capture class, so every quoted family — which is all of them — parsed to
// nothing and this file passed by reading no data at all.
assert.ok(parsed / BANNED.length >= 30,
  `only ${Math.round(parsed / BANNED.length)} font names parsed — the declaration `
  + 'regex has stopped matching, so this file is passing without checking anything');

// ── nothing is fetched from a font host ────────────────────────────────────
//
// The three are self-hosted on purpose: a CDN font is a third party watching
// every page load, and it renders nothing until the network agrees.
const REMOTE = /fonts\.googleapis\.com|fonts\.gstatic\.com|use\.typekit|fonts\.bunny|cdn\.jsdelivr[^\n]*font/i;
const remote = files.filter((path) => REMOTE.test(cssText(path)));
assert.deepEqual(remote.map(rel), [], 'fonts must stay self-hosted in assets/fonts');

// ── Pacifico is the wordmark and the method chip, nowhere else ─────────────
// The selector is often a line or two above the declaration, so walk back to
// the start of the rule block rather than reading a single line.
// Any class whose name contains "brand" counts as the wordmark: the two routes
// prefix it differently (.brand on glass, .bk-brand on the blocks route), and
// pinning the exact class list means this fails on a rename rather than on a
// real violation.
const WORDMARK = /\.[a-z-]*brand[a-z-]*\b|\.wordmark\b|\.stria\b/;
const brandUse = [];
for (const path of files) {
  const text = cssText(path);
  for (const m of text.matchAll(/font-family\s*:\s*var\(--font-brand/g)) {
    const blockStart = Math.max(
      text.lastIndexOf('}', m.index), text.lastIndexOf('{', m.index - 1),
      text.lastIndexOf(';', m.index - 1)
    );
    const selector = text.slice(Math.max(0, blockStart - 200), m.index);
    if (WORDMARK.test(selector)) continue;
    brandUse.push(`${rel(path)}: …${selector.trim().split('\n').pop().slice(-60)}`);
  }
}
assert.deepEqual(brandUse, [],
  'Pacifico (--font-brand) is for the wordmark and the Stria method chip only');

console.log(`font lock OK — 3 self-hosted families across ${files.length} files, `
  + 'no banned family, no remote host, Pacifico confined to wordmark + chip');

// ── the reading is set in a site face, and Chinese in one named face ───────
//
// Owner, 2026-09-02: body text uses the sans the site already wears, and
// Chinese uses 华文中宋. Both are the silent kind of rule — get them wrong and
// the page still renders, in whatever the browser reached for.
//
// This is what was actually there: the reading — the product itself — was set
// in `ui-serif, Georgia, "Iowan Old Style", …`, a generic system serif, while
// every other page on the site was in one of the three locked families. It had
// been that way long enough that nobody noticed the one page that matters was
// typeset by accident.
const typography = cssText(join(ROOT, 'tokens/typography.css'));
const app = cssText(join(ROOT, 'index.html'));

assert.match(typography, /--font-zh:\s*"STZhongsong",\s*"华文中宋"/,
  'the Chinese face is named, and named FIRST in its own token');

// ⚠️ THE PUNCTUATION RULE. Whichever family leads a stack supplies every
// codepoint it has, ASCII marks included. So a Chinese paragraph set with the
// Latin face first takes its comma from Spinnaker and its 。from the Song face
// — two weights, two baselines, one sentence. Leading with the Song face is
// what makes the paragraph read as a single typeface, and it is the whole
// mechanism behind "标点符号也要统一成相应字体样式".
assert.match(app, /\.reading-body:lang\(zh\)\s*\{\s*--read:\s*var\(--font-zh\)/,
  'a Chinese reading leads with the Song face, so its ASCII punctuation and Latin ' +
  'runs come from the same family as its characters');
assert.match(app, /--read:"Spinnaker",var\(--font-zh\)/,
  'and everything else leads with Spinnaker, with the Song face behind it for CJK');
assert.doesNotMatch(app, /--read:ui-serif/,
  'the reading is never handed back to the browser default serif');

// The switch is an attribute the app has to write, or the :lang() rule matches
// nothing and the whole mechanism is inert while looking correct in the file.
const chatjs = cssText(join(ROOT, 'chat-app.js'));
// ⚠️ BOTH render paths, counted rather than matched. verdictHTML has two: the
// prose reading (the real one) and the structured/legacy branch. A bare match
// passes as long as EITHER carries the attribute — checked by removing the one
// that matters, and the assertion stayed green because the other one answered
// for it. A rule that is half-connected is the failure this repo keeps paying
// for; counting is what tells the two apart.
const stamps = (chatjs.match(/class="reading-body" lang="' \+ \(isZh\(/g) || []).length;
assert.equal(stamps, 2,
  'both reading render paths stamp lang from their own text — the prose path and ' +
  'the structured one; found ' + stamps);
