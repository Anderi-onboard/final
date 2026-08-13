#!/usr/bin/env node
/* eval/run-eval.js — regression harness for prompt-engine.js.
   Run after ANY edit to prompt-engine.js (a new route, a reworded segment,
   a Gate pattern change) to confirm nothing broke.

   Usage:
     node eval/run-eval.js               # Gate only (offline, free, always runs)
     OPENROUTER_API_KEY=sk-or-... node eval/run-eval.js   # also checks Router accuracy (costs a few Haiku calls)

   This is the harness item #7 from the production-readiness review asked
   for: "build 50 tricky test questions (crisis, minor, stocks, weather,
   ex), re-run after every prompt-engine.js change, keep Gate/Router
   accuracy ≥ 95%." Starter corpus is in eval/cases.json — extend it as you
   find real failure cases. */
"use strict";
const path = require("path");
const fs = require("fs");

global.window = {};
require(path.join(__dirname, "..", "prompt-engine.js"));
const PE = global.window.BWPromptEngine;

const cases = JSON.parse(fs.readFileSync(path.join(__dirname, "cases.json"), "utf8"));

function runGate() {
  console.log("── Gate (offline, code-only — no API calls) ──");
  let pass = 0, fail = 0;
  cases.gate.forEach((c) => {
    const got = PE.gate(c.q);
    const ok = got === c.expect;
    ok ? pass++ : fail++;
    console.log((ok ? "✓" : "✗") + "  expect=" + c.expect.padEnd(12) + " got=" + got.padEnd(12) + " \"" + c.q.slice(0, 50) + "\"");
  });
  const pct = Math.round((pass / (pass + fail)) * 100);
  console.log("Gate: " + pass + "/" + (pass + fail) + " (" + pct + "%)\n");
  return { pass, fail, pct };
}

async function runRouter() {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    console.log("── Router (skipped — set OPENROUTER_API_KEY to check classification accuracy against real Haiku) ──\n");
    return null;
  }
  console.log("── Router (live, calls Haiku for each case) ──");
  // ROUTER_SYSTEM is private inside prompt-engine.js (not exported) — kept
  // in sync by hand; see prompt-inspector.html's ROUTER_SYSTEM_DISPLAY for
  // the same duplication and why it exists.
  const ROUTER_SYSTEM = [
    "You are a question classifier for an I Ching consultation system. Given a user's question, output ONLY one of these category labels (nothing else):",
    "- relationship (love, marriage, breakup, \"does she like me\", person dynamics, intimacy)",
    "- timing (when, how long, what age, what year, application period)",
    "- wealth (money, career, business, promotion, job)",
    "- appearance (what do they look like, attractiveness, character traits, personality)",
    "- future_unseen (future partner not yet met, future children, distant future scenarios)",
    "- choice (A or B, which should I choose, comparing options)",
    "- general (health, decisions, travel, lost items, yes/no, everything else)",
    "",
    "Output the single word category only."
  ].join("\n");

  let pass = 0, fail = 0;
  for (const c of cases.router) {
    const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer " + key },
      body: JSON.stringify({
        model: "anthropic/claude-haiku-4.5", max_tokens: 20,
        messages: [{ role: "system", content: ROUTER_SYSTEM }, { role: "user", content: c.q }]
      })
    });
    const data = await resp.json();
    const choice = (data.choices || [])[0] || {};
    const text = (choice.message && choice.message.content) || "";
    const got = text.trim().toLowerCase().replace(/[^a-z_]/g, "");
    const ok = got === c.expect;
    ok ? pass++ : fail++;
    console.log((ok ? "✓" : "✗") + "  expect=" + c.expect.padEnd(14) + " got=" + got.padEnd(14) + " \"" + c.q.slice(0, 45) + "\"");
  }
  const pct = Math.round((pass / (pass + fail)) * 100);
  console.log("Router: " + pass + "/" + (pass + fail) + " (" + pct + "%)\n");
  return { pass, fail, pct };
}

(async () => {
  const gate = runGate();
  const router = await runRouter();

  const THRESHOLD = 95;
  let failed = gate.pct < 100; // Gate is deterministic code — anything short of 100% is a regression
  if (router && router.pct < THRESHOLD) failed = true;

  console.log(failed ? ("FAIL — Gate must be 100%" + (router ? ", Router must be ≥" + THRESHOLD + "%" : "")) : "PASS");
  process.exit(failed ? 1 : 0);
})();
