/* Exact feature retrieval over knowledge-base entries
   ────────────────────────────────────────────────────────────────────────
   PURE. An entry applies to a board when every token in `when` is among the
   board's feature tokens, and no token in `unless` is. Nothing is scored by
   similarity: a hit is fully explained by the tokens it matched.

   Ranking: more specific first (longer `when`), then id, so output is stable.
   `limit` caps how many entries reach the synthesis stage.
*/

export const LICENSE_OK = 'public-domain';

/* Structural checks only. Returns a list of problems; empty means valid. */
export function validateEntry(e) {
  const errs = [];
  if (!e || typeof e !== 'object') return ['entry is not an object'];
  if (typeof e.id !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(e.id)) {
    errs.push('id must be a lowercase slug');
  }
  if (!e.source || typeof e.source.book !== 'string' || !e.source.book) {
    errs.push('source.book missing');
  }
  if (!e.source || typeof e.source.chapter !== 'string' || !e.source.chapter) {
    errs.push('source.chapter missing');
  }
  if (!e.source || e.source.license !== LICENSE_OK) {
    errs.push(`source.license must be "${LICENSE_OK}"`);
  }
  if (typeof e.text_zh !== 'string' || !e.text_zh.trim()) {
    errs.push('text_zh (verbatim original) missing');
  }
  if (!Array.isArray(e.when) || e.when.length === 0) {
    errs.push('when must be a non-empty array');
  } else if (!e.when.every((t) => typeof t === 'string' && t.length > 0)) {
    errs.push('when must contain only non-empty strings');
  }
  if (e.unless !== undefined && !(Array.isArray(e.unless) && e.unless.every((t) => typeof t === 'string'))) {
    errs.push('unless, when present, must be an array of strings');
  }
  return errs;
}

export function retrieve(features, entries, { limit = 12 } = {}) {
  const have = new Set(features);
  const hits = [];
  for (const e of entries) {
    if (!e.when.every((t) => have.has(t))) continue;
    if ((e.unless || []).some((t) => have.has(t))) continue;
    hits.push({ entry: e, matched: e.when.slice() });
  }
  hits.sort((a, b) =>
    b.entry.when.length - a.entry.when.length ||
    (a.entry.id < b.entry.id ? -1 : a.entry.id > b.entry.id ? 1 : 0));
  return hits.slice(0, limit);
}

/* Coverage ledger: where every feature token went.
   retrieve() answers "which entries fire". The ledger answers the opposite
   question, which is the one that stops facts being dropped silently: for each
   token the board emitted, either some entry cites it, or it is listed as
   unplaced. Nothing is limited here (retrieve's `limit` is for prompt size, not
   for coverage), and nothing is scored.

   Invariant (tested): placed + unplaced === the feature tokens, exactly. */
export function ledger(features, entries) {
  const byToken = new Map();
  for (const t of features) byToken.set(t, []);
  for (const e of entries) {
    if (!e.when.every((t) => byToken.has(t))) continue;
    if ((e.unless || []).some((t) => byToken.has(t))) continue;
    for (const t of e.when) byToken.get(t).push(e.id);
  }
  const placed = {};
  const unplaced = [];
  for (const [t, ids] of byToken) {
    if (ids.length) placed[t] = ids.sort();
    else unplaced.push(t);
  }
  return { placed, unplaced: unplaced.sort(), total: byToken.size };
}
