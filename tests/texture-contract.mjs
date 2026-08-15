import assert from "node:assert/strict";
import fs from "node:fs";

const css = fs.readFileSync("tokens/luxury-glass.css", "utf8");

assert.doesNotMatch(css, /--lq-size-[xy]/, "texture scale must use one square-grid token");
assert.match(
  css,
  /background-size:\s*var\(--lq-size,\s*28px\)\s+var\(--lq-size,\s*28px\)/,
  "text-page texture must render on a square grid",
);
assert.match(css, /background-size:\s*24px\s+24px/, "app texture must use a square repeat");
assert.match(css, /background:\s*var\(--lq-outline\)[^;]*\/\s*30px\s+30px\s+repeat/, "site texture must use a square repeat");

console.log("texture contract OK — connected-coin repeats are square at every route scale");
