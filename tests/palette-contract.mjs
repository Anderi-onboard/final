import assert from "node:assert/strict";
import fs from "node:fs";

const groups = JSON.parse(fs.readFileSync("assets/palettes/color-groups.json", "utf8"));
const background = fs.readFileSync("assets/backgrounds/mountain-range.js", "utf8");

assert.ok(Array.isArray(groups) && groups.length > 0, "palette catalogue must contain groups");
assert.equal(new Set(groups.map((group) => group.id)).size, groups.length, "palette ids must be unique");

for (const group of groups) {
  assert.match(group.id, /^\d{3}$/, `invalid palette id: ${group.id}`);
  assert.equal(group.rows?.length, 10, `${group.id} must expose ten ridge colours`);
  group.rows.forEach((hex) => assert.match(hex, /^#[0-9A-F]{6}$/i));
  assert.match(group.backgrounds?.sky || "", /^#[0-9A-F]{6}$/i, `${group.id} missing sky`);
  assert.match(group.backgrounds?.water || "", /^#[0-9A-F]{6}$/i, `${group.id} missing water`);
}

/* A segment is a contiguous id block (001–030 近白段 … 181–213 自定义). The
   palette manager relies on it, and buildPaletteSchedule now orders by segment,
   so a group filed under the wrong segment moves in the cycle, not just in the
   list. Catching it here is cheaper than noticing the background plays the
   wrong sequence. */
const segmentRuns = [];
for (const group of groups) {
  const last = segmentRuns[segmentRuns.length - 1];
  if (!last || last.seg !== group.seg) segmentRuns.push({ seg: group.seg, from: group.id, to: group.id });
  else last.to = group.id;
}
assert.equal(
  segmentRuns.length,
  new Set(groups.map((group) => group.seg)).size,
  `each segment must be one contiguous id block, got ${segmentRuns.map((run) => `${run.seg}:${run.from}-${run.to}`).join(" ")}`
);

/* Play order is a per-visitor shuffle, so there is no fixed sequence to assert.
   What must hold is that it is SEEDED and that the seed persists: an unseeded
   shuffle reorders the background on every navigation, which reads as a fault
   rather than as design. These three assertions pin that down. */
assert.match(background, /function mulberry32/, "schedule must use a seeded PRNG, not Math.random() per call");
assert.match(
  background,
  /sessionStorage\.setItem\(seedKey/,
  "the shuffle seed must persist in sessionStorage or every navigation reshuffles"
);
assert.match(
  background,
  /buildPaletteSchedule\(groups, seed\)/,
  "the seed must reach buildPaletteSchedule"
);

/* The opening bias: a visitor should land inside 自定义 or 蓝靛段, and BOTH
   halves must still be shuffled. A head that is not shuffled would put every
   first-time visitor on the same group again, which is the thing the shuffle
   replaced. */
assert.match(background, /var OPENING_SEGMENTS = \["自定义", "蓝靛段"\]/,
  "the cycle must open inside 自定义 or 蓝靛段");
assert.match(background, /shuffle\(pref\); shuffle\(rest\);/,
  "both pools must be shuffled, not just one");
/* The preferred groups must be SPREAD, not stacked at the front. Concatenating
   the two pools ran all 33 in the first eight minutes and none in the
   remaining twenty, so anyone arriving later — or reloading a tab whose clock
   was already running — saw none of them. */
assert.ok(!/shuffle\(pref\)\.concat\(shuffle\(rest\)\)/.test(background),
  "preferred groups must be distributed through the cycle, not concatenated ahead of it");
assert.match(background, /acc \+= pref\.length/,
  "the schedule must interleave the two pools evenly (Bresenham over pref/rest)");
assert.match(background, /if \(s === 0\) takePref = true/,
  "slot 0 must still open on a preferred group");
for (const seg of ["自定义", "蓝靛段"]) {
  assert.ok(groups.some((group) => group.seg === seg),
    `OPENING_SEGMENTS names ${seg} but the catalogue has no such segment`);
}

/* The saturation gate must not silently lock the owner's own groups out of the
   opening. At 0.23 it kept 15 of the 34 custom groups from ever opening — 44%
   of the segment — which is a decision about their curated data, not a tuning
   knob. Assert the requirement (every custom group can open) rather than the
   number, so the threshold can still be raised deliberately for the other
   segments without quietly re-excluding these. */
const gate = Number((background.match(/var OPENING_MIN_SATURATION = ([\d.]+)/) || [])[1]);
assert.ok(Number.isFinite(gate), "OPENING_MIN_SATURATION must be a number");

/* The ceiling must have ONE definition. It used to be typed twice — in
   applyPalette and again inside onScreenSaturation — so raising one left the
   gate measuring on the old scale and the change looked like it did nothing. */
const ceiling = Number((background.match(/var RIDGE_MAX_SATURATION = ([\d.]+)/) || [])[1]);
assert.ok(Number.isFinite(ceiling), "RIDGE_MAX_SATURATION must be a named constant");
assert.ok(!/Math\.min\(s, \.?\d/.test(background),
  "onScreenSaturation must clamp with RIDGE_MAX_SATURATION, not a second copy of the number");

/* Fidelity mode paints the cards unchanged, so the gate must measure the card
   and not a clamp nobody applies. Mirroring the flag here is the whole point:
   when the two disagree, the opening is chosen on a scale the screen never
   uses — which is exactly the bug that made raising the ceiling look like a
   no-op. */
const fidelity = /var PALETTE_FIDELITY = true/.test(background);
assert.match(background, /PALETTE_FIDELITY \? s : Math\.min\(s, RIDGE_MAX_SATURATION\)/,
  "onScreenSaturation must follow PALETTE_FIDELITY, or the gate scores groups the screen never shows");
assert.match(background, /return PALETTE_FIDELITY \? hex : mutedHex\(/,
  "toned() must be the single place fidelity is decided");

const onScreen = (group) => {
  let total = 0;
  for (const hex of group.rows) {
    const n = parseInt(hex.slice(1), 16);
    const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
    let s = 0;
    if (max !== min) s = l > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min);
    total += fidelity ? s : Math.min(s, ceiling);
  }
  return total / group.rows.length;
};

/* The gate may keep out groups that are colourless on their own card, but it
   must never quietly grow into the owner's curated segment again — it once
   held 15 of 34 out. These three have card saturation under a third of the
   ceiling; anything beyond them has to be a deliberate, named decision. */
const custom = groups.filter((group) => group.seg === "自定义");
const locked = custom.filter((group) => onScreen(group) < gate).map((group) => group.id).sort();
assert.deepEqual(locked, ["193", "194", "195"],
  `OPENING_MIN_SATURATION=${gate} now locks ${locked.length}/${custom.length} custom groups out of`
  + ` the opening (${locked.join(" ") || "none"}). Expected only 193 194 195 — the colourless cards.`
  + ` If this is intended, change the expectation here and say why.`);

/* Fisher–Yates over a copy is a permutation: assert the shuffle cannot drop or
   duplicate a group, since a silent drop would simply retire a palette. */
const shuffleSrc = background.match(/function buildPaletteSchedule[\s\S]*?\n  \}\n/)?.[0] ?? "";
assert.match(shuffleSrc, /groups\.slice\(\)/, "shuffle must copy, never reorder the caller's array");
assert.match(background, /for \(var i = list\.length - 1; i > 0; i--\)/, "shuffle must be a full Fisher–Yates pass");

assert.match(background, /class=\"fill l/, "palette ridge fills must be rendered");
/* ⚠️ The water PLANE is no longer painted — its top edge was a wave so shallow
   it drew a straight horizontal slab in a cool hue across ten arc-edged ridges,
   and it read as a band laid over the picture. What this contract protects is
   that the water COLOUR is still published: the block routes take it as a hue
   candidate, so dropping the token would quietly narrow their palette. */
assert.match(background, /--bw-palette-water/, "palette water role must still be published");
assert.doesNotMatch(background, /class="mtn-water"/,
  "the water plane is deliberately not painted — it was the one straight-edged layer");
assert.match(background, /transition:fill 1\.5s/, "palette fills must interpolate for 1.5s");
/* The cascade must exist and must stay short. 400ms spread twelve 1.5s fill
   transitions over six seconds, so the range repainted continuously for six
   seconds out of every fifteen: 12 long tasks, 1422ms, felt as a stutter on
   every palette change. 120ms measured 1 task and 71ms. Collapsing it to zero
   is worse again (7 tasks, 542ms) because every plane then repaints in one
   frame — so assert a real, small gap rather than a specific number. */
const stagger = Number((background.match(/queuePaletteLayer\(\(index \+ 1\) \* (\d+)/) || [])[1]);
assert.ok(Number.isFinite(stagger) && stagger > 0 && stagger <= 200,
  `ridge colours must cascade, and the cascade must fit inside the transition:`
  + ` expected a stagger in (0, 200]ms, got ${stagger}`);
/* ⚠️ A RANGE, not the number. This asserted `= 15000` exactly, so raising the
   dwell — which the owner asked for, and which makes the expensive moment three
   times rarer — failed the suite and taught the next person to edit the test
   rather than read it. The same fix the motif-count assertion already got.

   What actually has to hold: a group is held long enough that the 1.5s
   crossfade is a small part of what you see (so the page is a landscape, not a
   slideshow), and short enough that a visit shows more than one card. */
const dwell = Number((background.match(/paletteDwellMs = (\d+)/) || [])[1]);
assert.ok(Number.isFinite(dwell) && dwell >= 10000 && dwell <= 120000,
  `a group must be held for between 10s and 2min, got ${dwell}ms`);
assert.ok(dwell >= 10 * 1500,
  `the 1.5s crossfade must be a small part of the dwell, got ${dwell}ms`);

for (let index = 1; index <= 10; index += 1) {
  assert.ok(background.includes(`--bw-palette-${index}`), `missing ridge token ${index}`);
}

console.log(`palette contract OK — ${groups.length} groups, 10 ridges + sky + water, 1.5s/0.4s transition`);
