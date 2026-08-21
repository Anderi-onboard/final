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

/* Fisher–Yates over a copy is a permutation: assert the shuffle cannot drop or
   duplicate a group, since a silent drop would simply retire a palette. */
const shuffleSrc = background.match(/function buildPaletteSchedule[\s\S]*?\n  \}/)?.[0] ?? "";
assert.match(shuffleSrc, /groups\.slice\(\)/, "shuffle must copy, never reorder the caller's array");
assert.match(shuffleSrc, /for \(var i = out\.length - 1; i > 0; i--\)/, "shuffle must be a full Fisher–Yates pass");

assert.match(background, /class=\"fill l/, "palette ridge fills must be rendered");
assert.match(background, /class=\"mtn-water\"/, "palette water role must be rendered");
assert.match(background, /transition:fill 1\.5s/, "palette fills must interpolate for 1.5s");
assert.match(background, /\(index \+ 1\) \* 400/, "ridge colours must remain staggered by 400ms");
assert.match(background, /paletteDwellMs = 15000/, "groups must dwell for 15 seconds");

for (let index = 1; index <= 10; index += 1) {
  assert.ok(background.includes(`--bw-palette-${index}`), `missing ridge token ${index}`);
}

console.log(`palette contract OK — ${groups.length} groups, 10 ridges + sky + water, 1.5s/0.4s transition`);
