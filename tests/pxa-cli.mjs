/**
 * CLI ERGONOMICS CONTRACT
 *
 * ⭐ An error message is part of the interface. These are not cosmetic checks:
 * each one was a real way the tool wasted someone's time, found by running it
 * the way a first-time user would.
 *
 *   - A mistyped command printed exactly what NO arguments printed, so someone
 *     who typed `encoed` got the same wall of text as someone browsing, and had
 *     to spot their own typo inside it.
 *   - A mistyped FILENAME came back as a Node stack trace ending in
 *     `binding.readFileUtf8` — the tool's own internals, shown to someone who
 *     simply typed the wrong name.
 *   - Two commands read .pxa files through two different code paths with
 *     different wording and different coverage. This repo has paid for a second
 *     list to keep in step more than once; that is why the reader is one module
 *     and why that is asserted here rather than remembered.
 *
 * ⚠️ These assert on what the user SEES, by running the CLI as a subprocess.
 * Checking that a string exists in the source proves nothing about whether it
 * reaches anyone — a message behind a branch that never runs still greps fine.
 *
 * Run: node tests/pxa-cli.mjs
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { USAGE, USAGE_FULL, HELP } from '../tools/pxa/cli.mjs';
import { encode } from '../assets/pxa-codec.mjs';
import { KEYS, keyHelp, handleKey, openDoc, render } from '../tools/pxa/tui.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const CLI = join(root, 'tools/pxa/cli.mjs');
let checks = 0;
const ok = (cond, msg) => { checks++; assert.ok(cond, msg); };

/** Run the CLI and capture what the user actually sees — BOTH streams.
 *  ⚠️ execFileSync returns stdout only, so an earlier version of this helper
 *  reported every command's progress output as empty and made a working
 *  command look silent. */
function run(...args) {
  const r = spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8' });
  return { code: r.status ?? 1, out: r.stdout || '', err: r.stderr || '' };
}

const COMMANDS = ['encode', 'inspect', 'preview', 'tui', 'gif', 'sheet'];

/* ── 1. every command is reachable from the first screen ────────────────── */

for (const c of COMMANDS) {
  ok(USAGE.includes(`pxa ${c}`), `\`${c}\` is missing from the short usage — a command nobody can find `
    + `does not exist. Every command must be on the first screen.`);
  ok(HELP[c] && HELP[c].length > 80, `\`pxa help ${c}\` has no real text. Detail belongs behind the `
    + `per-command help, but it has to be THERE, not deleted on the way.`);
}
ok(USAGE.split('\n').length <= 24,
  `the short usage is ${USAGE.split('\n').length} lines. Running \`pxa\` with nothing is someone asking `
  + `"what is this"; fifty lines of option prose buries the handful of commands that are the answer. `
  + `The long text belongs behind \`pxa help\`, not deleted — assert both.`);
ok(USAGE_FULL.split('\n').length > USAGE.split('\n').length,
  'the full help is no longer than the short one, so the detail was dropped rather than moved');

/* ── 2. a typo says so, before the usage ────────────────────────────────── */

const typo = run('encoed', 'frames', '-o', 'x.json');
ok(typo.code !== 0, 'a mistyped command exits 0');
const firstLine = typo.err.trim().split('\n')[0];
ok(/encoed/.test(firstLine),
  `the first thing printed for a mistyped command is "${firstLine}" — it does not name what was wrong. `
  + `Printing the same usage text as a bare invocation makes the user find their own typo inside it.`);
ok(/encode/.test(firstLine),
  `a near-miss command does not suggest the real one. "${firstLine}"`);
ok(typo.err.includes('pxa encode'), 'the usage is not shown after the correction — say what was wrong AND what is available');

const nonsense = run('zzzzzzzz');
ok(/zzzzzzzz/.test(nonsense.err.split('\n')[0]) && !/did you mean/.test(nonsense.err.split('\n')[0]),
  'a command nothing like a real one still gets a "did you mean" guess. A wrong suggestion is worse than '
  + 'none: it sends the reader off to try it.');

/* ── 3. file problems read as sentences, not stack traces ───────────────── */

const tmp = mkdtempSync(join(tmpdir(), 'pxa-cli-'));
writeFileSync(join(tmp, 'plain.json'), '{"hello":1}');
writeFileSync(join(tmp, 'notjson.txt'), '# not json at all');

const cases = [
  ['a missing file', ['inspect', join(tmp, 'nope.pxa.json')], /no such file/i],
  ['a folder', ['inspect', tmp], /folder/i],
  ['JSON that is not a .pxa', ['inspect', join(tmp, 'plain.json')], /not a \.pxa/i],
  ['a file that is not JSON', ['inspect', join(tmp, 'notjson.txt')], /not a \.pxa|not even JSON/i],
  ['no filename at all', ['inspect'], /which file/i]
];
for (const [what, args, want] of cases) {
  const r = run(...args);
  ok(r.code !== 0, `${what} exits 0`);
  ok(want.test(r.err), `${what} does not explain itself. Got: ${JSON.stringify(r.err.slice(0, 160))}`);
  ok(r.err.startsWith('pxa:'),
    `${what} does not speak as pxa. Got: ${JSON.stringify(r.err.slice(0, 80))}`);
  ok(!/\bat \S+ \(node:|node:internal|node:fs:\d/.test(r.err),
    `${what} prints a Node stack trace. The tool's internals are not an error message — this exact failure `
    + `showed \`binding.readFileUtf8\` to anyone who mistyped a filename. Got: ${JSON.stringify(r.err.slice(0, 200))}`);
}

/* ── 4. ONE reader, not one per command ─────────────────────────────────── */

/* Every command that opens a .pxa must go through doc.mjs. Two readers means
   two sets of messages, and they drift — they already had. */
const dir = join(root, 'tools/pxa');
const offenders = [];
for (const f of readdirSync(dir).filter((f) => f.endsWith('.mjs') && f !== 'doc.mjs')) {
  const src = readFileSync(join(dir, f), 'utf8');
  // `encode` legitimately reads PNGs and app.mjs serves static files; what must
  // not exist twice is parsing a .pxa document.
  if (/JSON\.parse\(\s*readFileSync/.test(src)) offenders.push(f);
}
ok(offenders.length === 0,
  `${offenders.join(', ')} parse a .pxa document directly instead of going through doc.mjs. One reader, or `
  + `the four failure messages drift apart — they already did once, and the copy without the careful `
  + `wording is the one the user hit.`);

/* Anti-vacuity: the check above is a regex over source, so prove it can fire. */
ok(/JSON\.parse\(\s*readFileSync/.test('JSON.parse(readFileSync(p, "utf8"))'),
  'the duplicate-reader pattern does not match its own example — this scan would pass by failing to match');

/* And prove every command really is routed through it, by behaviour: they must
   all give the SAME message for the same missing file. */
const msgs = new Set();
for (const c of ['inspect', 'tui', 'gif', 'sheet', 'preview']) {
  const r = run(c, join(tmp, 'nope.pxa.json'), '-o', join(tmp, 'out'));
  msgs.add(r.err.trim().split('\n')[0]);
}
ok(msgs.size === 1,
  `the same missing file produces ${msgs.size} different messages depending on the command: `
  + `${[...msgs].map((m) => JSON.stringify(m)).join(' vs ')}. That is what two readers looks like from outside.`);

/* ── 5. help is reachable the ways people try ───────────────────────────── */

for (const args of [['help'], ['--help'], ['-h']]) {
  const r = run(...args);
  ok(r.code === 0 && (r.out + r.err).includes('pxa encode'),
    `\`pxa ${args.join(' ')}\` does not print help`);
}
for (const c of COMMANDS) {
  const a = run('help', c), b = run(c, '--help');
  ok(a.code === 0 && a.out.trim().length > 80, `\`pxa help ${c}\` printed nothing useful`);
  ok(b.code === 0 && b.out.trim() === a.out.trim(),
    `\`pxa ${c} --help\` does not match \`pxa help ${c}\`. Both are how people ask; one answer.`);
}
const badTopic = run('help', 'gifs');
ok(/gifs/.test(badTopic.err) && /gif/.test(badTopic.err), '`pxa help gifs` does not point at `gif`');

/* ── 6. every command actually RUNS ─────────────────────────────────────── */

/* ⚠️ Sections 1-5 only ever drive failures, and a contract that exercises only
   the error paths will watch you break the success path. It did: a refactor of
   the file reader left `inspect` referring to a variable that no longer
   existed, every error message stayed perfect, and the command threw a
   ReferenceError on the first file it was given. Run each one for real. */
const W2 = 12, H2 = 8;
const frames2 = Array.from({ length: 6 }, (_, t) => {
  const g = new Uint8Array(W2 * H2);
  for (let i = 0; i < g.length; i++) g[i] = 1 + ((i + t) % 3);
  return g;
});
const clip = join(tmp, 'clip.pxa.json');
writeFileSync(clip, JSON.stringify(encode(frames2, {
  w: W2, h: H2, fps: 10, palette: ['-', '#101520', '#3d6b52', '#e7c86a']
})));

const runs = [
  ['inspect', ['inspect', clip], /grid\s+12 x 8/],
  ['gif', ['gif', clip, '-o', join(tmp, 'o.gif')], /wrote/],
  ['sheet', ['sheet', clip, '-o', join(tmp, 'o.png')], /wrote/],
  ['preview', ['preview', clip, '-o', join(tmp, 'prev')], /\S/]
];
for (const [what, args, want] of runs) {
  const r = run(...args);
  ok(r.code === 0,
    `\`pxa ${what}\` failed on a valid file (exit ${r.code}). `
    + `${JSON.stringify((r.err || r.out).slice(0, 240))}`);
  ok(want.test(r.out + r.err), `\`pxa ${what}\` ran but printed nothing recognisable: `
    + `${JSON.stringify((r.out + r.err).slice(0, 200))}`);
  ok(!/ReferenceError|TypeError|is not defined|undefined is not/.test(r.err),
    `\`pxa ${what}\` threw a JavaScript error while succeeding-ish: ${JSON.stringify(r.err.slice(0, 240))}`);
}
ok(readdirSync(join(tmp, 'prev')).filter((f) => f.endsWith('.png')).length === frames2.length,
  'preview did not write one PNG per frame');

/* ⭐ Which stream: `inspect` IS the output, so it goes to stdout and can be
   piped; everything else reports progress about a file it wrote, which goes to
   stderr so a redirect captures the artefact's log without mixing it into data.
   Asserted so it stays a decision rather than becoming an accident. */
ok(run('inspect', clip).out.includes('grid') && run('inspect', clip).err === '',
  '`pxa inspect` must write its report to stdout — it is the output, and people pipe it');
const gifRun = run('gif', clip, '-o', join(tmp, 'o2.gif'));
ok(gifRun.err.includes('wrote') && gifRun.out === '',
  '`pxa gif` must report on stderr — it produces a FILE, and stdout is for data');

/* ── 7. the documented keys are the keys that work ──────────────────────── */

/* ⚠️ Found by reading the screen next to the help: `pxa help tui` listed four
   keys that were never implemented (`.` `,` `g` `p`) and left out one that was
   (`home`), because the help lived in cli.mjs and the handler in tui.mjs. Three
   places had to agree — footer, help, handler — and nothing made them. */
const doc2 = JSON.parse(readFileSync(clip, 'utf8'));
/* Each key is pressed from the SAME known state — mid-clip, zoomed, playing —
   so that every documented key has somewhere to move. Driving one shared state
   through the whole list lets a key saturate against the previous key's effect
   and look broken when it is fine. */
const freshState = () => {
  const st = openDoc(doc2, 'clip.pxa.json');
  render(st, 80, 24);          // populates `shown`, which +/- step from
  st.frame = 2; st.zoom = 3; st.playing = true;
  render(st, 80, 24);
  return st;
};
/* ⚠️ EVERY piece of state a key can touch, not the three the viewer had before
   editing existed. A snapshot that watches only frame/zoom/playing declares
   every palette and trim key dead — which is the same failure this check was
   written to catch, pointed at itself. */
const snap = (st) => JSON.stringify({
  f: st.frame, z: st.zoom, p: st.playing, sel: st.sel, typing: st.typing,
  in: st.in, out: st.out, pal: st.a.palette, msg: st.message
});
for (const k of KEYS) {
  for (const key of k.keys) {
    const st = freshState();
    const before = snap(st);
    const cont = handleKey(st, key);
    const after = snap(st);
    ok(cont === false || before !== after,
      `the key ${JSON.stringify(key)} is documented as "${k.label}" but pressing it changes nothing. `
      + `A key list that documents keys the handler does not accept is worse than no list: it sends `
      + `the reader off to press something that is not there.`);
  }
}
/* ⚠️ And the other direction, which the first version of this check missed:
   deleting `home` from the table left every assertion green, because nothing
   walked from the HANDLER back to the table. A key that works and is documented
   nowhere is the same defect seen from the other side — it is how `home` came
   to be undocumented in the first place. */
const handlerSrc = readFileSync(join(root, 'tools/pxa/tui.mjs'), 'utf8');
const body = handlerSrc.slice(handlerSrc.indexOf('export function handleKey'),
  handlerSrc.indexOf('/* ── render'));
const cased = [...body.matchAll(/case\s+'((?:\\.|[^'\\])*)'/g)]
  .map((m) => m[1].replace(/\\x([0-9a-f]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
                  .replace(/\\\\/g, '\\'));
ok(cased.length >= 10,
  `only ${cased.length} case labels found in handleKey — the scan is not matching, so this check would `
  + `pass by finding nothing`);
const tabled = new Set(KEYS.flatMap((k) => k.keys));
for (const c of cased) {
  ok(tabled.has(c),
    `handleKey accepts ${JSON.stringify(c)} but KEYS does not list it, so it appears in no help and no `
    + `footer. A key that works and is documented nowhere is the same drift as one documented and not `
    + `implemented — this is exactly how \`home\` went missing from the help.`);
}

/* Anti-vacuity: a key that is NOT in the table must fail this same test, or the
   check above would pass for any string at all. */
{
  const st = freshState();
  const before = snap(st);
  const cont = handleKey(st, 'Z');
  ok(cont !== false && before === snap(st),
    'an undocumented key changes state, so the "does this key do anything" check cannot fail');
}
const st2 = freshState();
const help = run('help', 'tui').out;
for (const k of KEYS) {
  ok(help.includes(k.label),
    `\`pxa help tui\` does not mention "${k.label}". The key table is one list (tui.mjs KEYS) precisely `
    + `so the help cannot describe a different program than the one that runs.`);
}
const footer = render(st2, 100, 24).split('\n').filter((l) => l.trim()).pop();
for (const k of KEYS.filter((x) => x.hint)) {
  ok(footer.includes(k.hint), `the on-screen footer is missing "${k.hint}" at a width that fits everything`);
}
ok(!/[.,]\s+step|toggle the cell grid|\bpalette\b.*\bkey\b/.test(help),
  'the tui help still describes keys that were removed');
// Anti-vacuity: the loop above must have had something to check.
ok(KEYS.length >= 5 && KEYS.every((k) => k.keys.length >= 1), 'the key table is empty or malformed');

assert.ok(checks >= 45, `only ${checks} assertions ran — this contract is not exercising the CLI`);
console.log(`pxa cli OK — ${checks} assertions; ${COMMANDS.length} commands all on the first screen `
  + `(${USAGE.split('\n').length} lines) and all documented, ${cases.length} file failures read as sentences `
  + `with no stack traces, one reader behind all of them, and ${runs.length} commands run for real `
  + `on a valid file; ${KEYS.length} documented keys verified against the handler and `
  + `${cased.length} handler cases verified against the table`);
