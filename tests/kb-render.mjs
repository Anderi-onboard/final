/**
 * PACKET → MODEL TEXT CONTRACT
 *
 * Three things the model depends on, each checked on real boards:
 *
 *   1. FORMAT. Every packet has the shape in schema.js: exact keys, the right
 *      types, nothing missing, nothing extra.
 *
 *   2. NOTHING DROPPED. The renderer is wrapped in a read-recording proxy. Every
 *      property the packet holds must be read while rendering, or be on the
 *      allow-list below with a reason. A fact the program computed but never
 *      wrote into the text is a fact the model cannot use, and that fails here.
 *
 *   3. PARTITION. The text is written in sections, each citing the book's
 *      chapters, and the 书中明言不取 section is always present so the model is
 *      told what not to use.
 *
 * Run: node tests/kb-render.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const KB = resolve(ROOT, 'functions/_lib/kb');

const sandbox = { window: {}, console, Date };
sandbox.window.window = sandbox.window;
vm.createContext(sandbox);
vm.runInContext(readFileSync(resolve(ROOT, 'liuyao-engine.js'), 'utf8'), sandbox, { filename: 'liuyao-engine.js' });
const BWLiuYao = sandbox.window.BWLiuYao;

const { buildPacket } = await import(pathToFileURL(resolve(KB, 'packet.js')).href);
const { renderPacket, propertyPaths } = await import(pathToFileURL(resolve(KB, 'render.js')).href);
const { validatePacket } = await import(pathToFileURL(resolve(KB, 'schema.js')).href);
const { boardFeatures } = await import(pathToFileURL(resolve(KB, 'features.js')).href);

/* Fields that are deliberately not written into the text. Each is either a
   machine index (the text uses the Chinese name next to it) or is checked by
   another contract. Nothing else may be left out. */
const ALLOW_UNREAD = new Map([
  ['schema', 'version number, not a fact of the casting'],
  ['tokens', 'checked against boardFeatures() below, not written as prose'],
  ['time.dayStem', 'machine index; the text uses the 干支 name beside it'],
  ['lines[].stemIdx', 'machine index; the text uses the stem name'],
  ['lines[].branchBi', 'machine index; the text uses the branch name'],
  ['lines[].elementGi', 'machine index; the text uses the element name'],
  ['lines[].transform.branchBi', 'machine index; the text uses the branch name'],
  ['lines[].hidden[].el', 'machine index; the text uses the hidden branch name']
]);

const DATE = new Date(2026, 9, 8, 10, 0);
function packetFor(bits, moving, yongKey) {
  const lines = [0, 1, 2, 3, 4, 5].map((i) => ({ yang: !!((bits >> i) & 1), changing: false }));
  const b = BWLiuYao.computeBoard({ lines, changeIdx: moving, date: DATE });
  return { p: buildPacket(b, yongKey ? { yongKey } : {}), board: b };
}

// A spread of boards: every hexagram, still and moving, with and without a 用神.
const cases = [];
for (let bits = 0; bits < 64; bits++) {
  for (const mv of [[], [bits % 6], [(bits + 1) % 6, (bits + 3) % 6]]) {
    for (const yk of [undefined, 'wealth', 'self']) cases.push([bits, mv, yk]);
  }
}

let rendered = 0;
for (const [bits, mv, yk] of cases) {
  const { p, board } = packetFor(bits, mv, yk);

  // 1. format
  const shapeErrors = validatePacket(p);
  assert.deepEqual(shapeErrors, [], `shape of ${p.ben.name} ${mv} ${yk}: ${shapeErrors.slice(0, 3).join('; ')}`);

  // 2. nothing dropped
  const { used, text, sections } = renderPacket(p);
  const unread = [...propertyPaths(p)].filter((path) => !used.has(path) && !ALLOW_UNREAD.has(path));
  assert.deepEqual(unread, [],
    `${p.ben.name} ${JSON.stringify(mv)} ${yk ?? '-'}: packet fields never written into the text:\n  ${unread.join('\n  ')}`);

  // 2b. the tokens the packet carries are the matcher's tokens
  assert.deepEqual(p.tokens, boardFeatures(board, yk ? { yongKey: yk } : {}), 'tokens must match the matcher');

  // 3. partition: the fixed sections are always there, in order, each cited
  const ids = sections.map((s) => s.id);
  const fixed = ['time', 'ben', 'lines', 'bian', 'rel', 'shensha', 'excluded'];
  assert.deepEqual(ids.filter((id) => id !== 'yong'), fixed, 'the fixed sections are always present, in order');
  assert.equal(ids.includes('yong'), !!yk, 'the 用神 section appears exactly when a 用神 was given');
  for (const s of sections) {
    assert.ok(s.source.length > 0, `section ${s.id} must cite its chapters`);
    assert.ok(s.lines.length > 0, `section ${s.id} must not be empty`);
  }
  assert.ok(text.includes('【书中明言不取，不得使用】'), 'the 不取 section is always in the text');
  assert.equal(sections.find((s) => s.id === 'lines').lines.length, 6, 'six lines, each written out');
  rendered++;
}

// 4. The text itself. A spot check on the 水火既济 example from the 占卦法章.
{
  const { p } = packetFor(0b010101, [2, 3, 4]);
  const { text } = renderPacket(p);
  assert.ok(text.includes('本卦 水火既济'), 'the 本卦 is named');
  assert.ok(text.includes('变卦 震为雷'), 'the 变卦 is named');
  assert.ok(text.includes('动爻：第3爻、第4爻、第5爻。'), 'the moving lines are listed');
  assert.ok(text.includes('【六爻（由初至上）】'), 'the six-line section has its heading');
}

console.log(`kb-render: ok — ${rendered} packets: shape valid, every field written into the text (allow-list: ${ALLOW_UNREAD.size} machine indices), sections in order`);
