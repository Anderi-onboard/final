/* The legacy stylesheets may shrink. They may not grow.
 *
 * Measured 2026-08-21 across index/pricing/settings/login/404 at 1440 and 390,
 * counting which sheet's rule actually wins each (element, property) contest:
 *
 *   luxury-glass.css   127 wins   438 losses
 *   refinement.css      61 wins   247 losses
 *   content-pages.css   20 wins   110 losses
 *   legal.css           20 wins     0 losses   ← what one owner looks like
 *   page <style>         0 wins   103 losses   ← never applies, on any of them
 *
 * So the documented owner is not the real owner. CLAUDE.md says the glass
 * material is defined in tokens/refinement.css; on the glass routes
 * luxury-glass.css beats it roughly two to one, largely through 112
 * !important declarations. Editing the documented home and seeing nothing
 * change is not a mystery — it is this.
 *
 * Of luxury-glass.css's 495 selector x property declarations, 123 win
 * somewhere and 372 (75%) never win on any page at either viewport.
 *
 * ⚠️ That does NOT make the 372 safe to delete mechanically. The measurement
 * only sees elements with a box: .method-menu, .carry-menu, .toast, .modal and
 * .account-menu do not exist until something is clicked, and no probe here
 * covers :hover, :focus or :active. Retiring them needs a screenshot-verified
 * pass, state by state, not a script.
 *
 * What this test does is stop the hole getting deeper: the two legacy sheets
 * are being retired, so they may only get smaller, and the glass routes may
 * not take on another stylesheet. legal.css is the finished shape to copy —
 * one route, one sheet, no contest.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (p) => fs.readFileSync(new URL(p, root), 'utf8');
const lines = (s) => s.split('\n').length;
const importants = (s) => (s.match(/!important/g) || []).length;

/* Baselines taken 2026-08-21. Lower these when you retire something; never
   raise them. A raise means the legacy layer grew, which is the one direction
   that is not allowed. */
const BASELINE = {
  /* 602/112 -> 516/92 on 2026-08-22: the shared misted material, its heavier
     second plane, the hover weight, and nine page-scoped duplicates were
     retired after a before/after capture across seventeen states on the five
     routes that load this file showed no change to any background, shadow,
     backdrop-filter, border, radius or colour. */
  'tokens/luxury-glass.css':  { lines: 517, importants: 92 },
  'tokens/content-pages.css': { lines: 536, importants: 40 }
};

const grew = [];
for (const [file, base] of Object.entries(BASELINE)) {
  const src = read(file);
  const l = lines(src), i = importants(src);
  if (l > base.lines) grew.push(`${file}: ${l} lines > baseline ${base.lines}`);
  if (i > base.importants) grew.push(`${file}: ${i} !important > baseline ${base.importants}`);
}
assert.deepEqual(grew, [],
  'a stylesheet being retired has grown instead:\n  ' + grew.join('\n  ')
  + '\n  Put the rule in its owning sheet (refinement.css for glass chrome,'
  + '\n  blocks/method/legal.css for the block routes) rather than here.');

/* The glass routes' stylesheet set is fixed. Adding a fourth sheet to a route
   that already has three competing for the same elements is how 35 elements
   ended up with three or more owners. */
const EXPECTED = {
  'index.html':    ['fonts','colors','typography','spacing','paper','motion','refinement','luxury-glass'],
  'pricing.html':  ['fonts','colors','typography','spacing','paper','motion','refinement','content-pages','poster-pages','luxury-glass'],
  'settings.html': ['fonts','colors','typography','spacing','paper','motion','refinement','content-pages','luxury-glass'],
  'login.html':    ['fonts','colors','typography','spacing','paper','motion','refinement','content-pages','luxury-glass'],
  '404.html':      ['fonts','colors','typography','spacing','paper','motion','refinement','content-pages','luxury-glass'],
  /* The block routes are the target state: no legacy sheets at all. */
  'about.html':    ['fonts','colors','typography','spacing','paper','motion','refinement','blocks'],
  'guide.html':    ['fonts','colors','typography','spacing','paper','motion','refinement','blocks','method'],
  'terms.html':    ['fonts','colors','typography','spacing','paper','motion','refinement','blocks','legal'],
  'privacy.html':  ['fonts','colors','typography','spacing','paper','motion','refinement','blocks','legal'],
  'refund.html':   ['fonts','colors','typography','spacing','paper','motion','refinement','blocks','legal']
};

const drifted = [];
for (const [page, expected] of Object.entries(EXPECTED)) {
  const html = read(page);
  const got = [...new Set([...html.matchAll(/tokens\/([a-z-]+)\.css/g)].map((m) => m[1]))];
  const extra = got.filter((s) => !expected.includes(s));
  const missing = expected.filter((s) => !got.includes(s));
  if (extra.length) drifted.push(`${page}: unexpected sheet(s) ${extra.join(', ')}`);
  if (missing.length) drifted.push(`${page}: lost sheet(s) ${missing.join(', ')}`);
}
assert.deepEqual(drifted, [],
  'a route\'s stylesheet set changed:\n  ' + drifted.join('\n  '));

/* The block routes must stay clean — this is the shape the glass routes are
   being moved toward, and it is the only evidence that the target is
   reachable. */
for (const page of ['about.html', 'guide.html', 'terms.html', 'privacy.html', 'refund.html']) {
  const html = read(page);
  for (const legacy of ['luxury-glass', 'content-pages', 'poster-pages']) {
    assert.ok(!html.includes(`tokens/${legacy}.css`),
      `${page} must not load ${legacy}.css — the block routes are single-owner by design`);
  }
}

console.log('style ownership OK — legacy sheets not growing, 10 routes hold their stylesheet set');
