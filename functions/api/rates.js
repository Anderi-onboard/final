// functions/api/rates.js — GET /api/rates
//
// The one place the site learns what things cost. Rates used to live in three
// places at once: the constants in _lib/db.js, the printed numbers in
// pricing.html, and a mirrored table in account.js. They drifted the moment the
// billing rates changed, and the pricing page went on advertising a rate card
// the server no longer used. Serving them from the code that actually bills
// means that can't happen again — the page renders whatever the meter charges.
//
// Public and cacheable: nothing here is per-user.

import {
  MODEL_RATES, METHOD_COST, FOLLOW_COST, PLAN_GRANT, PACKS,
  UNIT_PRICE_USD, ANNUAL_MONTHS, estimateTokens, SIGNUP_FREE_READINGS
} from '../_lib/db.js';
import { PromptEngine } from '../_lib/prompt-engine.js';

// The typical input size used to be two numbers typed into this file — 17,885
// tokens for Sortis, 15,119 for Stria. The prompt then grew and they did not:
// measured against the assembled stack they were 49% and 56% low, so every
// estimate the pricing page showed was about half the real charge.
//
// So they are measured here instead, at request time, from the same assembler
// the reading itself runs through and with the same token estimator the biller
// uses. There is nothing left to keep in sync.
const CJK_RE = /[　-〿㐀-䶿一-鿿豈-﫿＀-￯]/g;
function tokensOf(text) {
  const s = String(text || '');
  const cjk = (s.match(CJK_RE) || []).length;
  return estimateTokens(s.length, cjk);
}

// The turn carries the computed board and the question on top of the system
// prompt. Measured from a real Sortis casting (the serialised board is ~10.6k
// characters, almost all Latin, ≈3,200 tokens); it barely varies, because a
// board is a board. Rounded up so a quoted estimate errs high rather than low.
const TURN_TOKENS = 3300;

// What a finished reading runs to, from the length rule in the output segment:
// Sortis 3000-4000 CJK characters, Stria 1500-2500. Taken at the top of each
// range — an estimate that reads low is the one that makes a reader feel
// overcharged when the real bill lands.
const OUTPUT_CHARS = { sortis: 4000, stria: 2500 };

// A follow-up carries the same board and the conversation so far, and answers
// in 300-6000 characters, sized by the question. Input therefore
// dominates it even more than it dominates a first reading, which is why a
// Stria follow-up can cost more than a Stria cast. History allowance is one
// prior reading at the length above.
const FOLLOWUP_OUTPUT_CHARS = 1500;

// Which model each product runs on, mirroring resolveModel() in claude.js so a
// reader sees the rate that will actually be applied to their reading.
function modelFor(env, product) {
  const pick = product === 'sortis' ? env.SORTIS_MODEL : env.STRIA_MODEL;
  return String(pick || 'anthropic/claude-opus-5');
}

export function onRequestGet({ env }) {
  const products = {};
  for (const product of ['stria', 'sortis']) {
    const model = modelFor(env, product);
    const rate = MODEL_RATES[model] || MODEL_RATES['anthropic/claude-opus-5'];
    // 'general' is the route with no focus segment — the floor every reading
    // clears. A routed reading adds one or two segments on top.
    const inTok = tokensOf(PromptEngine.assemblePrompt('general', product, 'initial')) + TURN_TOKENS;
    const outTok = estimateTokens(OUTPUT_CHARS[product], OUTPUT_CHARS[product]);
    const followInTok = tokensOf(PromptEngine.assemblePrompt('general', product, 'followup'))
      + TURN_TOKENS + estimateTokens(OUTPUT_CHARS[product], OUTPUT_CHARS[product]);
    const followOutTok = estimateTokens(FOLLOWUP_OUTPUT_CHARS, FOLLOWUP_OUTPUT_CHARS);
    const units = (i, o) => Math.ceil((i / 1000) * rate.in + (o / 1000) * rate.out);
    products[product] = {
      model,
      unitsPer1kInput: rate.in,
      unitsPer1kOutput: rate.out,
      // Both derived, so nothing in this payload can disagree with anything
      // else in it. METHOD_COST / FOLLOW_COST stay in db.js as the offline
      // fallback for anything that cannot reach the engine.
      typical: units(inTok, outTok),
      typicalFollowUp: units(followInTok, followOutTok),
      typicalFollowUpInputTokens: followInTok,
      // Input is thousands of tokens before the reader types a word: the prompt
      // carries the method's whole instruction stack plus the computed figure.
      typicalInputTokens: inTok,
      typicalOutputTokens: outTok,
      typicalUnits: units(inTok, outTok)
    };
  }

  return json({
    unitPriceUsd: UNIT_PRICE_USD,
    unitsPerUsd: Math.round(1 / UNIT_PRICE_USD),
    plans: {
      // The free tier is no longer a balance. It is one complete reading —
      // whatever that reading turns out to cost — and then top-ups.
      free: { usd: 0, units: PLAN_GRANT.free, freeReadings: SIGNUP_FREE_READINGS },
      pro: { usd: 19, units: PLAN_GRANT.pro, annualUsd: 190, annualUnits: PLAN_GRANT.pro * ANNUAL_MONTHS },
      premium: { usd: 29, units: PLAN_GRANT.premium, annualUsd: 290, annualUnits: PLAN_GRANT.premium * ANNUAL_MONTHS }
    },
    packs: PACKS,
    products
  });
}

function json(obj) {
  return new Response(JSON.stringify(obj), {
    headers: {
      'content-type': 'application/json',
      'cache-control': 'public, max-age=300',
      // Intentionally open: this is the public price list — no credentials, no
      // user data, nothing to authorise. The other API routes are same-origin.
      'access-control-allow-origin': '*'
    }
  });
}
