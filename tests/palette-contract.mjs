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
const onScreen = (group) => {
  let total = 0;
  for (const hex of group.rows) {
    const n = parseInt(hex.slice(1), 16);
    const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
    let s = 0;
    if (max !== min) s = l > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min);
    total += Math.min(s, 0.26);          /* the same ceiling applyPalette uses */
  }
  return total / group.rows.length;
};
const custom = groups.filter((group) => group.seg === "自定义");
const locked = custom.filter((group) => onScreen(group) < gate);
assert.deepEqual(locked.map((group) => group.id), [],
  `OPENING_MIN_SATURATION=${gate} locks ${locked.length}/${custom.length} custom groups out of the`
  + ` opening: ${locked.map((group) => group.id).join(" ")}`);

/* Fisher–Yates over a copy is a permutation: assert the shuffle cannot drop or
   duplicate a group, since a silent drop would simply retire a palette. */
const shuffleSrc = background.match(/function buildPaletteSchedule[\s\S]*?\n  \}\n/)?.[0] ?? "";
assert.match(shuffleSrc, /groups\.slice\(\)/, "shuffle must copy, never reorder the caller's array");
assert.match(background, /for \(var i = list\.length - 1; i > 0; i--\)/, "shuffle must be a full Fisher–Yates pass");

assert.match(background, /class=\"fill l/, "palette ridge fills must be rendered");
assert.match(background, /class=\"mtn-water\"/, "palette water role must be rendered");
assert.match(background, /transition:fill 1\.5s/, "palette fills must interpolate for 1.5s");
assert.match(background, /\(index \+ 1\) \* 400/, "ridge colours must remain staggered by 400ms");
assert.match(background, /paletteDwellMs = 15000/, "groups must dwell for 15 seconds");

for (let index = 1; index <= 10; index += 1) {
  assert.ok(background.includes(`--bw-palette-${index}`), `missing ridge token ${index}`);
}

console.log(`palette contract OK — ${groups.length} groups, 10 ridges + sky + water, 1.5s/0.4s transition`);
