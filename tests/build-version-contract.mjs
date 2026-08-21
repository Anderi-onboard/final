import assert from "node:assert/strict";
import fs from "node:fs";

const root = new URL("../", import.meta.url);
const html = fs.readFileSync(new URL("index.html", root), "utf8");
const { v: servedVersion } = JSON.parse(
  fs.readFileSync(new URL("version.json", root), "utf8")
);
const buildMatch = html.match(/window\.BW_BUILD\s*=\s*["']([^"']+)["']/);

assert.ok(buildMatch, "index.html must declare window.BW_BUILD");
assert.equal(
  buildMatch[1],
  servedVersion,
  "index.html BW_BUILD must match version.json or casting submissions are blocked as stale"
);

console.log(`build/version contract: PASS (${servedVersion})`);
