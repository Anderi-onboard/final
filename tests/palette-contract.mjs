import assert from "node:assert/strict";
import fs from "node:fs";

const groups = JSON.parse(fs.readFileSync("assets/palettes/color-groups.json", "utf8"));
const background = fs.readFileSync("assets/backgrounds/mountain-range.js", "utf8");

assert.ok(Array.isArray(groups) && groups.length > 0, "palette catalogue must contain groups");
assert.equal(new Set(groups.map((group) => group.id)).size, groups.length, "palette ids must be unique");

for (const group of groups) {
  assert.match(group.id, /^(?:\d{3}|C[A-Z0-9]+)$/, `invalid palette id: ${group.id}`);
  assert.equal(group.rows?.length, 10, `${group.id} must expose ten ridge colours`);
  group.rows.forEach((hex) => assert.match(hex, /^#[0-9A-F]{6}$/i));
  assert.match(group.backgrounds?.sky || "", /^#[0-9A-F]{6}$/i, `${group.id} missing sky`);
  assert.match(group.backgrounds?.water || "", /^#[0-9A-F]{6}$/i, `${group.id} missing water`);
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
