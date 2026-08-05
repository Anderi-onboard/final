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
  UNIT_PRICE_USD, ANNUAL_MONTHS
} from '../_lib/db.js';

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
    products[product] = {
      model,
      unitsPer1kInput: rate.in,
      unitsPer1kOutput: rate.out,
      reserve: METHOD_COST[product],
      followUpReserve: FOLLOW_COST[product],
      // Measured, so an estimate on the pricing page matches the real bill:
      // the prompt carries the method's instructions plus the computed figure,
      // which is why input is thousands of tokens before the reader types a word.
      typicalInputTokens: product === 'sortis' ? 13540 : 11260,
      typicalOutputTokens: product === 'sortis' ? 4345 : 2554,
      typicalUnits: Math.ceil(
        (product === 'sortis' ? 13.54 : 11.26) * rate.in +
        (product === 'sortis' ? 4.345 : 2.554) * rate.out
      )
    };
  }

  return json({
    unitPriceUsd: UNIT_PRICE_USD,
    unitsPerUsd: Math.round(1 / UNIT_PRICE_USD),
    plans: {
      free: { usd: 0, units: PLAN_GRANT.free },
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
      'access-control-allow-origin': '*'
    }
  });
}
