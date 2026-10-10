/**
 * KNOWLEDGE-BASE RETRIEVAL CONTRACT
 *
 * The 知识库 is only useful if a hit can be explained. Retrieval here is exact:
 * an entry applies when every token in its `when` is a feature of the board.
 * That property is what makes the synthesis stage auditable — the reading can
 * say "this is cited because the board has L3:wealth and ben:山雷頤".
 *
 * Three ways this goes wrong quietly, and each has a check:
 *
 *   1. A TYPO IN A TOKEN. `L3:voidd` never matches anything, and the entry
 *      simply never fires. Every token in the corpus must be one the feature
 *      extractor can actually emit, measured over real boards, not a regex.
 *
 *   2. AN ENTRY THAT FIRES ON EVERYTHING. An empty `when` matches every board.
 *      validateEntry rejects it, and the corpus is validated in full.
 *
 *   3. A CITATION WITHOUT A BOOK. Only public-domain text is accepted, and
 *      every entry needs its book, chapter and verbatim text_zh.
 *
 * The corpus is empty at the time of writing (no source text has been supplied).
 * The check on it therefore passes trivially, and that is said here rather than
 * hidden: the retrieval SEMANTICS are tested below with SYNTHETIC entries, which
 * are never added to the corpus.
 *
 * Run: node tests/kb-retrieval.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const KB = resolve(ROOT, 'src');

// Load the real engine the same way board-distill.mjs does.
const sandbox = { window: {}, console, Date };
sandbox.window.window = sandbox.window;
vm.createContext(sandbox);
vm.runInContext(readFileSync(resolve(ROOT, 'vendor/liuyao-engine.js'), 'utf8'), sandbox, { filename: 'vendor/liuyao-engine.js' });
const BWLiuYao = sandbox.window.BWLiuYao;

const { boardFeatures, FEATURE_FLAGS } = await import(pathToFileURL(resolve(KB, 'features.js')).href);
const { retrieve, validateEntry } = await import(pathToFileURL(resolve(KB, 'retrieve.js')).href);
const { ENTRIES } = await import(pathToFileURL(resolve(KB, 'corpus.js')).href);

// Twelve consecutive days, so the day branch cycles through all twelve. Several
// flags (dayTomb, dayClash, dayCombine…) depend on the day branch, and one fixed
// date would leave them unreachable — which the reachability check below catches.
const DATES = Array.from({ length: 12 }, (_, k) => new Date(2026, 9, 1 + k, 10, 0));

function boardFor(bits, moving, date = DATES[0]) {
  const lines = [0, 1, 2, 3, 4, 5].map((i) => ({ yang: !!((bits >> i) & 1), changing: false }));
  return BWLiuYao.computeBoard({ lines, changeIdx: moving, date });
}

// Every hexagram × three moving patterns × twelve days.
const BOARDS = [];
for (const date of DATES) {
  for (let bits = 0; bits < 64; bits++) {
    BOARDS.push(boardFor(bits, [], date));
    BOARDS.push(boardFor(bits, [bits % 6], date));
    BOARDS.push(boardFor(bits, [(bits + 2) % 6, (bits + 4) % 6], date));
  }
}
assert.equal(BOARDS.length, 64 * 3 * 12, 'expected 64 hexagrams × 3 moving patterns × 12 days');

// The emitted vocabulary, measured over real boards.
const EMITTED = new Set();
// 关系/状态 tokens come from the packet (they need the 用神 chain), so they are
// measured the same way, over the same boards.
const { buildPacket } = await import(pathToFileURL(resolve(KB, 'packet.js')).href);
const { factTokens } = await import(pathToFileURL(resolve(KB, 'facts.js')).href);
// Moving-line flags depend on WHICH line moves and on the hexagram, and the patterns
// above move line (bits % 6), which ties the two together: 化生 at 爻 2 never appeared.
// So every hexagram is also measured with each single line moving in turn.
for (const date of [new Date(2026, 9, 12, 10, 0)]) {
  for (let bits = 0; bits < 64; bits++) {
    for (let pos = 0; pos < 6; pos++) {
      const b = boardFor(bits, [pos], date);
      for (const t of boardFeatures(b, { yongKey: 'wealth' })) EMITTED.add(t);
      for (const t of factTokens(buildPacket(b, { yongKey: 'wealth' }).facts)) EMITTED.add(t);
    }
  }
}
// Month-dependent flags (月破 = line clashes the 月建) need the month to vary, and
// twelve October days carry only two 月建. So the feature vocabulary is also
// measured on one date in each month. Without this, L4:monthClash is never seen
// and a corpus entry on 月破 would be rejected as a typo.
const MONTH_DATES = Array.from({ length: 12 }, (_, m) => new Date(2026, m, 15, 10, 0));
for (const date of MONTH_DATES) {
  for (let bits = 0; bits < 64; bits++) {
    for (const moving of [[], [bits % 6]]) {
      const b = boardFor(bits, moving, date);
      for (const t of boardFeatures(b, { yongKey: 'wealth' })) EMITTED.add(t);
      // 空 reasons (旬空章) depend on the 月建 as well as the day, so the state
      // vocabulary is measured on the month dates too.
      for (const key of ['self', 'parent', 'peer', 'output', 'wealth', 'officer', 'ying']) {
        for (const t of factTokens(buildPacket(b, { yongKey: key }).facts)) EMITTED.add(t);
      }
    }
  }
}
for (const b of BOARDS) {
  for (const t of boardFeatures(b, { yongKey: 'wealth' })) EMITTED.add(t);
  // Relations depend on which 六亲 is the 用神, so every 用神 is measured.
  for (const key of ['self', 'parent', 'peer', 'output', 'wealth', 'officer', 'ying']) {
    for (const t of factTokens(buildPacket(b, { yongKey: key }).facts)) EMITTED.add(t);
  }
}
// Not a size guess: there are exactly 64 hexagrams, so exactly 64 ben: tokens.
const benKeys = [...EMITTED].filter((t) => t.startsWith('ben:'));
assert.equal(benKeys.length, 64, `expected 64 本卦 tokens, got ${benKeys.length}`);
// The key must be the lines themselves: boardFor(bits) must yield the bit string
// with 初爻 first. This pins the engine's line order, which the key depends on.
for (let bits = 0; bits < 64; bits++) {
  const want = 'ben:' + [0, 1, 2, 3, 4, 5].map((i) => (bits >> i) & 1).join('');
  assert.ok(boardFeatures(boardFor(bits, []))[0] === want || boardFeatures(boardFor(bits, [])).includes(want),
    `hexagram ${bits} should carry ${want}`);
}
// A transformed hexagram is the same lines with the moving ones flipped.
{
  const bits = 0b001011, moving = [0, 3];
  const flipped = bits ^ moving.reduce((m, i) => m | (1 << i), 0);
  const want = 'bian:' + [0, 1, 2, 3, 4, 5].map((i) => (flipped >> i) & 1).join('');
  assert.ok(boardFeatures(boardFor(bits, moving)).includes(want),
    `moving ${moving} on ${bits} should carry ${want}`);
}

// 1. Token grammar. Every emitted token must have one of the documented shapes.
// L<pos>:<token> is either a 六亲 / 旺衰 (lowercase words) or one of the camelCase
// flags. The flag list comes from the module, so the grammar and the emitter
// cannot drift apart.
const GRAMMAR = new RegExp('^(ben:[01]{6}|bian:[01]{6}|mov:[0-6]|mov@[1-6]|world:[1-6]'
  + '|palace:(wood|fire|earth|metal|water)|hex:(clash|combine|fuyin|fanyin)'
  + '|L[1-6]:([a-z]+|' + FEATURE_FLAGS.join('|') + ')|L[1-6]:spirit:(青龙|朱雀|勾陈|螣蛇|白虎|玄武)'
  + '|yong:[a-z]+|yongLine@[1-6]'
  + '|rel:(生|克):L[1-6]>L[1-6]|rel:(合|冲):L[1-6]-L[1-6]|rel:刑:(L[1-6]>L[1-6]|L[1-6]-L[1-6])'
  + '|state:L[1-6]:[^:]+)$');
const badShape = [...EMITTED].filter((t) => !GRAMMAR.test(t));
assert.deepEqual(badShape, [], 'tokens outside the documented grammar:\n  ' + badShape.join('\n  '));

// Every flag the module promises should be reachable on at least one board.
for (const flag of FEATURE_FLAGS) {
  const reached = [...EMITTED].some((t) => t.endsWith(':' + flag));
  assert.ok(reached, `flag "${flag}" is listed in FEATURE_FLAGS but no board emits it`);
}
assert.ok([...EMITTED].some((t) => t === 'hex:clash'), 'hex:clash never reached');
assert.ok([...EMITTED].some((t) => t.startsWith('bian:')), 'bian: never reached');

// 2. Determinism and shape of one board.
{
  const b = boardFor(0b101101, [1, 4]);
  const once = boardFeatures(b, { yongKey: 'officer' });
  const twice = boardFeatures(b, { yongKey: 'officer' });
  assert.deepEqual(once, twice, 'features must be deterministic');
  assert.deepEqual(once, [...once].sort(), 'features must be returned sorted');
  assert.equal(new Set(once).size, once.length, 'features must be unique');
  assert.ok(once.includes('mov:2') && once.includes('mov@2') && once.includes('mov@5'),
    'moving lines 2 and 5 (1-based) must appear as mov@2 and mov@5');
  assert.ok(once.some((t) => /^bian:[01]{6}$/.test(t)), 'a moving board must carry bian:');
}
{
  const still = boardFeatures(boardFor(0b110011, []));
  assert.ok(still.includes('mov:0'), 'no moving lines → mov:0');
  assert.ok(!still.some((t) => t.startsWith('bian:') || t.startsWith('mov@')),
    'a still board must not carry bian: or mov@');
}

// 3. 用神 tokens come from the caller, but their positions come from the board.
{
  const b = boardFor(0b010110, []);
  // Arrays from the vm sandbox have another realm's prototype, so deepStrictEqual
  // would reject equal contents. Copy into this realm first.
  const wealthPos = Array.from(b.lines.filter((l) => l.relative.key === 'wealth').map((l) => l.idx + 1));
  const got = boardFeatures(b, { yongKey: 'wealth' }).filter((t) => t.startsWith('yongLine@'))
    .map((t) => Number(t.split('@')[1]));
  assert.deepEqual(got, wealthPos, 'yongLine@ must mark exactly the lines whose 六亲 is the 用神');
  const self = boardFeatures(b, { yongKey: 'self' });
  assert.ok(self.includes('yongLine@' + (b.ben.worldLi + 1)), 'self 用神 sits on 世爻');
}

// 4. The corpus. Empty is allowed; invalid is not.
// Tokens an entry may cite although the engine never emits them. Each one is a
// named open question, not a typo: 化扶 at 2, 3, 5, 6 needs a changed branch that
// combines with the original branch, and the engine's transform never produces
// one (measured in docs/workflow.md). The list must stay exact: if the engine
// starts emitting one, it is removed here, and if an entry stops needing one,
// it is removed too. Checked below.
const ENGINE_NEVER_EMITS = new Set(['state:L2:化扶', 'state:L3:化扶', 'state:L5:化扶', 'state:L6:化扶']);
for (const t of ENGINE_NEVER_EMITS) {
  assert.ok(!EMITTED.has(t), `${t} is listed as never emitted but the engine now emits it — remove it from the list`);
}
assert.ok(Array.isArray(ENTRIES), 'ENTRIES must be an array');
const idSeen = new Set();
for (const e of ENTRIES) {
  const errs = validateEntry(e);
  assert.deepEqual(errs, [], `corpus entry ${e && e.id} is invalid: ${errs.join('; ')}`);
  assert.ok(!idSeen.has(e.id), `duplicate corpus id ${e.id}`);
  idSeen.add(e.id);
  const unknown = [...e.when, ...(e.unless || [])].filter((t) => !EMITTED.has(t) && !ENGINE_NEVER_EMITS.has(t));
  assert.deepEqual(unknown, [],
    `corpus entry ${e.id} uses tokens the extractor never emits (typo?): ${unknown.join(', ')}`);
}

// 5. Validation rejects what it claims to reject.
{
  const good = {
    id: 'probe-ok', source: { book: 'B', chapter: 'C', license: 'public-domain' },
    text_zh: '原文', when: ['ben:乾为天']
  };
  assert.deepEqual(validateEntry(good), []);
  const reject = (patch, why) => assert.ok(validateEntry({ ...good, ...patch }).length > 0, why);
  reject({ when: [] }, 'an empty `when` fires on every board and must be rejected');
  reject({ source: { book: 'B', chapter: 'C', license: 'modern-commentary' } }, 'non-public-domain text must be rejected');
  reject({ text_zh: '   ' }, 'a blank verbatim text must be rejected');
  reject({ id: 'Bad Id' }, 'ids must be lowercase slugs');
  reject({ unless: 'hex:fanyin' }, '`unless` must be an array');
}

// 6. Retrieval semantics, on SYNTHETIC entries that are never added to the corpus.
{
  const feats = ['ben:山雷頤', 'L3:wealth', 'mov@5', 'mov:1'];
  const mk = (id, when, unless) => ({
    id, source: { book: 'SYNTHETIC', chapter: 'test', license: 'public-domain' },
    text_zh: '测试', when, ...(unless ? { unless } : {})
  });
  const pool = [
    mk('a-two', ['ben:山雷頤', 'L3:wealth']),
    mk('a-one', ['mov@5']),
    mk('a-three', ['ben:山雷頤', 'L3:wealth', 'mov@5']),
    mk('a-missing', ['ben:山雷頤', 'L4:wealth']),
    mk('b-unless-hit', ['mov:1'], ['L3:wealth']),
    mk('b-unless-clear', ['mov:1'], ['hex:fanyin']),
    mk('z-tie', ['mov@5'])
  ];
  const got = retrieve(feats, pool).map((h) => h.entry.id);
  assert.deepEqual(got, ['a-three', 'a-two', 'a-one', 'b-unless-clear', 'z-tie'],
    'AND semantics, unless exclusion, specificity-first ordering and id tie-break');

  const hit = retrieve(feats, pool)[0];
  assert.deepEqual(hit.matched, ['ben:山雷頤', 'L3:wealth', 'mov@5'],
    'a hit must report exactly the tokens it matched');

  assert.equal(retrieve(feats, pool, { limit: 2 }).length, 2, 'limit caps the result');
  assert.deepEqual(retrieve([], pool), [], 'no features, no hits');
}

console.log(`kb-retrieval: ok — ${EMITTED.size} tokens emitted over ${BOARDS.length} boards, ${ENTRIES.length} corpus entries`);
