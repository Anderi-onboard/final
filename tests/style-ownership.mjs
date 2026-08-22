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
 * ⭐ Retired in two rounds on 2026-08-22, taking luxury-glass.css from 602/112
 * to 394/47. Round one removed the shared misted material after a rule-level
 * A/B inside a single page load, re-run under every medium the sheet declares;
 * round two removed 29 rules scoped to about/guide/legal, which do not load
 * this sheet at all. Both were confirmed by a before/after computed-style
 * capture across seventeen states, against a measured noise floor.
 *
 * ⚠️ Do NOT retire by deleting whatever "never wins" in a statistic. The
 * rule-level probe called login's .tab.on dead; the capture caught it winning,
 * and deleting it dropped the active tab to 76% white with no shadow. The
 * visible before/after difference decides, not the probe.
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
  /* 602/112 -> 517/92 -> 394/47 on 2026-08-22. First the shared misted
     material, its heavier second plane, the hover weight and nine page-scoped
     duplicates; then 29 rules scoped to about/guide/legal, which do not load
     this sheet at all, so none of them could ever match. Both rounds verified
     by before/after capture across seventeen states. */
  'tokens/luxury-glass.css':  { lines: 394, importants: 47 },
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
  /* poster-pages.css is gone from here (2026-08-22). Pricing was the only
     route still loading it, and of its 121 rules exactly one could match on
     pricing — the rest are scoped to about/guide/legal, which load
     blocks/method/legal.css instead. That one rule now lives in
     refinement.css; removing the link changed nothing at 1440 or 390. */
  'pricing.html':  ['fonts','colors','typography','spacing','paper','motion','refinement','content-pages','luxury-glass'],
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
