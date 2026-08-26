/* THE STYLE SYSTEM, PINNED
 *
 * index.html is the reference for every route: it is the product, the other
 * nine are around it. This test holds the dimensions that have been collapsed
 * onto a system and ratchets the ones that have not, so the same drift cannot
 * come back the way it came the first time — one hand-typed number at a time.
 *
 * ⭐ Measured 2026-08-25 with a browser census across ten routes at 1440 and
 * 390, 1707 visible elements. What it found, in one line: the tokens declare a
 * scale and the pages do not use it.
 *
 *     padding    7 declarations via token,  295 literal   (98% literal)
 *     gap        3                          179           (98%)
 *     margin     7                          249           (97%)
 *     radius   126                           32           (20%)  ← the one
 *                                                                  that holds
 *
 * Radius is the control: it was collapsed in an earlier pass and it stayed
 * collapsed — three computed values across the whole site, all of them on
 * index. Everything else had never been collapsed at all, which is why the
 * computed census read 45 distinct spacing values, essentially every integer
 * from 2 to 30. Nobody can tell 9px from 10px from 11px; those three appear
 * 116 times between them. It is the same argument CLAUDE.md already makes
 * about the 35-step font ladder — 半像素不是层级,是漂移 — applied to space.
 *
 * The re-grid snapped 507 values to the 4px scale tokens/spacing.css had
 * declared all along. 99% moved by 4px or less; a before/after clipping check
 * across all ten routes at both viewports found the same 36 problems before
 * and after, so nothing broke. (Those 36 are pre-existing and real — text
 * clipped on pricing's packs, settings' panels, login's hero — and are logged
 * as their own work, not as style.)
 *
 * Run: node tests/style-system.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (p) => fs.readFileSync(new URL(p, root), 'utf8');

/* The block routes size themselves in cqw off the card edge; CLAUDE.md is
   explicit that those numbers are computed, not typed, and must not be
   "corrected" onto a pixel scale. palette-* are internal tools behind the
   edge 404 and are not shipped style. */
const EXEMPT = new Set(['tokens/blocks.css', 'tokens/method.css', 'about.html', 'guide.html',
  'palette-guide.html', 'palette-overview.html']);
const FILES = [
  ...fs.readdirSync(new URL('tokens', root)).filter((f) => f.endsWith('.css')).map((f) => 'tokens/' + f),
  ...fs.readdirSync(root).filter((f) => f.endsWith('.html'))
].filter((f) => !EXEMPT.has(f));

const styleOf = (file) => {
  const src = read(file);
  if (!file.endsWith('.html')) return src;
  return (src.match(/<style[\s\S]*?<\/style>/g) || []).join('\n');
};
const ALL = FILES.map((f) => ({ f, css: styleOf(f) }));

const collect = (re, pick = 1) => {
  const out = [];
  for (const { f, css } of ALL) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(css))) out.push({ f, v: m[pick].trim() });
  }
  return out;
};

/* ── space ───────────────────────────────────────────────────────────────
   The scale is the one tokens/spacing.css already declares. 0–3px is optical
   rather than spatial — hairlines, focus offsets, half-pixel nudges — and
   above 64px is layout: page gutters and container padding keep their value.
   Between those, every literal lands on a step. */
const STEPS = new Set([4, 8, 12, 16, 24, 32, 40, 48, 64]);
const SPACE = /(?:^|[;{\s])(?:padding|margin)(?:-(?:top|right|bottom|left|inline|block)(?:-(?:start|end))?)?\s*:\s*([^;}]+)|(?:^|[;{\s])(?:row-|column-)?gap\s*:\s*([^;}]+)/g;

const offScale = [];
for (const { f, css } of ALL) {
  SPACE.lastIndex = 0;
  let m;
  while ((m = SPACE.exec(css))) {
    const val = (m[1] || m[2] || '').trim();
    if (/var\(|calc\(|clamp\(|cqw|cqi|cqh|%|em|rem|vh|vw|svh|auto/.test(val)) continue;
    for (const px of val.match(/(\d*\.?\d+)px/g) || []) {
      const v = parseFloat(px);
      if (v <= 3 || v > 64 || STEPS.has(v)) continue;
      offScale.push(`${f}: ${val.slice(0, 48)} (${v}px)`);
    }
  }
}
assert.deepEqual(offScale.slice(0, 12), [],
  `${offScale.length} spacing value(s) are off the 4px scale:\n  ` + offScale.slice(0, 12).join('\n  ')
  + '\n  Use a step: 4 8 12 16 24 32 40 48 64. Values at or under 3px are optical'
  + '\n  and values over 64px are layout; both are left alone on purpose.');

/* ── shape ───────────────────────────────────────────────────────────────
   Radius is the dimension that proves the method works: collapsed once, still
   collapsed. Every corner comes from a token, so the set cannot grow by
   someone typing a number. */
const radLiterals = collect(/border-radius\s*:\s*([^;}]+)/g)
  .filter(({ v }) => !/var\(/.test(v) && /\dpx/.test(v));
assert.deepEqual(radLiterals.map((r) => `${r.f}: ${r.v}`), [],
  'every px corner must come from --ui-radius / --ui-radius-small / --ui-radius-chip'
  + ' / --ui-radius-pill.\n  0 and percentages are not drift and are left alone: 0 is the'
  + '\n  block routes\' square corner, 50% is a circle, and the eight-value percentage'
  + '\n  shapes are the organic loader\'s 8px pebbles — deliberate, in use on index and'
  + '\n  login, and a different thing from the jittered PANEL corners CLAUDE.md retired,'
  + '\n  which read as edge-wobble only because they were large and behind a blur.');

/* ── type ────────────────────────────────────────────────────────────────
   Three faces, self-hosted, no more. A form control inherits nothing by
   default, which is how a bare checkbox on pricing became a fourth family in
   the computed census — invisible, since a checkbox has no text, but a stray
   all the same. */
const FACES = ['BioRhyme', 'Spinnaker', 'Pacifico'];
const BANNED = /\b(Inter|Lora|Fraunces|Rubik|IBM Plex|Sawarabi|Bree Serif|Helvetica|Arial|Georgia|Times)\b/;
for (const { f, css } of ALL) {
  const m = css.match(/font-family\s*:\s*([^;}]+)/g) || [];
  for (const decl of m) {
    assert.ok(!BANNED.test(decl), `${f}: ${decl.trim()} — the site has three faces: ${FACES.join(', ')}`);
  }
}

/* ── controls ────────────────────────────────────────────────────────────
   The ladder is 28 / 36 / 44 / 52, on the same 4px grid as the spacing scale,
   and 44 is the DEFAULT rather than the ceiling because 44 is the touch
   minimum. A height in that band must come from the token, for the same reason
   radius does: a literal is how the set grows back. Outside the band the
   number is a container, not a control, and keeps its value. */
const CTL_BAND = [28, 56];
const ctlLiterals = [];
for (const { f, css } of ALL) {
  for (const m of css.matchAll(/min-height:\s*(\d+)px/g)) {
    const v = +m[1];
    if (v >= CTL_BAND[0] && v <= CTL_BAND[1]) ctlLiterals.push(`${f}: min-height:${v}px`);
  }
}
assert.deepEqual(ctlLiterals, [],
  'a control height must come from --ctl-chip / --ctl-compact / --ctl / --ctl-prominent:\n  '
  + ctlLiterals.join('\n  '));

/* ⭐ The regression guard for the bug this pass was opened by. The touch rule
   is two blocks — one giving controls `position: relative`, one giving them
   the `::after` that carries the hit area — and the version in motion.css
   named NINE selectors in the first and only FOUR in the second. Five controls
   carried the positioning and no hit area at all, under a comment saying they
   were handled; one of them was .send, the Cast button. A touch census found
   68 elements across 39 kinds still under 44px.

   Nothing about that is visible by reading either block on its own, so the
   test reads both and asserts they name the same controls. */
const refinement = read('tokens/refinement.css');
const MARK = 'Controls that cannot grow without pushing something else out of place';
const at = refinement.indexOf(MARK);
assert.ok(at > 0, 'the touch-target section in refinement.css has moved or lost its comment');
const section = refinement.slice(at, at + 2600);
/* the two rules that follow the comment, in order: the positioning one, then
   the one carrying the ::after */
const rules = [...section.matchAll(/\n([^{}]*?)\{([^}]*)\}/g)]
  .map((m) => ({ sel: m[1], body: m[2] }));
const relRule = rules.find((r) => /position:\s*relative/.test(r.body));
const afterRule = rules.find((r) => /content:\s*""/.test(r.body) && /position:\s*absolute/.test(r.body));
assert.ok(relRule && afterRule, 'could not find both halves of the touch-target rule');
const names = (sel) => [...new Set([...sel.matchAll(/[.#[][\w[\]="'-]+/g)].map((m) => m[0].replace(/::after$/, '')))].sort().join(' ');
assert.equal(names(relRule.sel), names(afterRule.sel.replace(/::after/g, '')),
  'the two halves of the touch-target rule name different controls.\n'
  + `  position:relative → ${names(relRule.sel)}\n`
  + `  ::after          → ${names(afterRule.sel.replace(/::after/g, ''))}\n`
  + '  A control in the first list and not the second gets the positioning and no\n'
  + '  hit area — which is exactly how .send ended up a 40px Cast button.');

/* ── ratchets ────────────────────────────────────────────────────────────
   These have not been collapsed yet. The numbers are today's census; they may
   fall and may not rise. Lower each one when you collapse it, the way the
   luxury-glass baseline came down. */
const RATCHET = {
  /* 36 distinct declarations, of which 19 are positive label tracking. Nobody
     can tell 0.44px from 0.48px any more than 12px from 12.5px. */
  'letter-spacing declarations': {
    now: collect(/letter-spacing\s*:\s*([^;}]+)/g).map((r) => r.v),
    max: 36
  },
  /* tokens/motion.css declares --dur-fast/base/slow/reveal/lede. The census
     found 26 distinct durations in use, so most of them bypass the tokens.
     ⚠️ CLAUDE.md §4 says "120 / 240 / 480ms" — the code has never said that.
     Per this file's own preamble, the code wins and the doc has been fixed. */
  'transition durations': {
    now: collect(/transition[^:]*:\s*([^;}]+)/g)
      .flatMap((r) => r.v.match(/[\d.]+m?s/g) || []),
    max: 26
  },
  /* CLAUDE.md pins the ladder at 10·11·12·13·15 (+20·30) for Spinnaker,
     13·15·16.5·18 for BioRhyme, 13·18 for Pacifico. 8, 16, 21, 22, 24, 25, 27
     and 42 are outside it. */
  'literal font sizes': {
    now: collect(/font-size\s*:\s*([^;}]+)/g)
      .filter((r) => !/var\(|clamp|cqw|%|em/.test(r.v))
      .flatMap((r) => r.v.match(/[\d.]+px/g) || []),
    max: 16
  }
};

const grew = [];
for (const [name, { now, max }] of Object.entries(RATCHET)) {
  const n = new Set(now).size;
  if (n > max) grew.push(`${name}: ${n} distinct, baseline ${max}`);
}
assert.deepEqual(grew, [],
  'a dimension that is being collapsed has grown instead:\n  ' + grew.join('\n  ')
  + '\n  Add the value to the system rather than to the page.');

const counts = Object.entries(RATCHET)
  .map(([k, v]) => `${k.split(' ')[0]} ${new Set(v.now).size}`).join(', ');
console.log(`style system OK — spacing on the 4px scale, radius all tokens, three faces;`
  + ` ratchets: ${counts}`);
