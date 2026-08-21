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

/* The recovered reference palettes open the cycle and hand over to 蓝靛段.
   Without this the runtime silently falls back to alphabetical segment order. */
const scheduleOrder = background.match(/var segmentOrder = \[([^\]]+)\]/);
assert.ok(scheduleOrder, "buildPaletteSchedule must declare an explicit segmentOrder");
const declared = scheduleOrder[1].match(/"([^"]+)"/g).map((s) => s.slice(1, -1));
assert.deepEqual(declared.slice(0, 2), ["自定义", "蓝靛段"], "cycle must open on 自定义 then 蓝靛段");
for (const seg of new Set(groups.map((group) => group.seg))) {
  assert.ok(declared.includes(seg), `segment ${seg} exists in the catalogue but is missing from segmentOrder`);
}

assert.match(background, /class=\"fill l/, "palette ridge fills must be rendered");
assert.match(background, /class=\"mtn-water\"/, "palette water role must be rendered");
assert.match(background, /transition:fill 1\.5s/, "palette fills must interpolate for 1.5s");
assert.match(background, /\(index \+ 1\) \* 400/, "ridge colours must remain staggered by 400ms");
assert.match(background, /paletteDwellMs = 15000/, "groups must dwell for 15 seconds");

for (let index = 1; index <= 10; index += 1) {
  assert.ok(background.includes(`--bw-palette-${index}`), `missing ridge token ${index}`);
}

console.log(`palette contract OK — ${groups.length} groups, 10 ridges + sky + water, 1.5s/0.4s transition`);
