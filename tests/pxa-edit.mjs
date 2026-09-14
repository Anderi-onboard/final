/**
 * EDITING CONTRACT — the TUI writes files, so it has to be right about it
 *
 * ⭐ Three edits are worth having in a terminal, and they are exactly the three
 * a person can only judge by LOOKING: is that colour right, does the loop start
 * in the right place, does it end in the right place. Anything needing
 * precision belongs in an image editor.
 *
 * ⚠️ The load-bearing one is the SAVE. Trimming by slicing the encoded string
 * array is the obvious implementation and it produces a file that will not
 * open: frame `in` is almost always a delta frame, and a delta with no
 * keyframe in front of it decodes to nothing. A save that writes an
 * unopenable file is the worst kind of save, because the editor still looks
 * like it worked — so this contract re-reads and re-decodes everything it
 * writes rather than checking the bytes changed.
 *
 * Run: node tests/pxa-edit.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { encode, decode } from '../assets/pxa-codec.mjs';
import { openDoc, handleKey, editedDoc, render } from '../tools/pxa/tui.mjs';

let checks = 0;
const ok = (cond, msg) => { checks++; assert.ok(cond, msg); };

const W = 10, H = 6, N = 12;
const PAL = ['-', '#101520', '#3d6b52', '#e7c86a'];
const frames = Array.from({ length: N }, (_, t) => {
  const g = new Uint8Array(W * H);
  for (let i = 0; i < g.length; i++) g[i] = 1 + ((i + t) % 3);
  return g;
});
const tmp = mkdtempSync(join(tmpdir(), 'pxa-edit-'));
const path = join(tmp, 'clip.pxa.json');
const fresh = () => {
  writeFileSync(path, JSON.stringify(encode(frames, { w: W, h: H, fps: 12, palette: PAL })));
  return openDoc(JSON.parse(readFileSync(path, 'utf8')), 'clip.pxa.json', path);
};
const type = (st, s) => { for (const ch of s) handleKey(st, ch); };

/* ── 1. a typed colour reaches the file ─────────────────────────────────── */

{
  const st = fresh();
  handleKey(st, 'p');
  ok(st.sel === 0, `the first p should pick slot 0, picked ${st.sel}`);
  handleKey(st, 'p'); handleKey(st, 'p');              // → slot 2
  ok(st.sel === 2, `three presses of p should reach slot 2, reached ${st.sel}`);
  handleKey(st, 'c');
  ok(st.typing === '', 'c did not enter colour entry');
  type(st, 'f033ab');
  ok(st.typing === 'f033ab', `the typed text is ${JSON.stringify(st.typing)}`);
  handleKey(st, '\r');
  ok(st.a.palette[2] === '#f033ab', `palette slot 2 is ${st.a.palette[2]}`);
  ok(st.dirty, 'an edit did not mark the document dirty, so `w` would refuse to write it');

  handleKey(st, 'w');
  const back = decode(JSON.parse(readFileSync(path, 'utf8')));
  ok(back.palette[2] === '#f033ab',
    `the edit did not reach the file: slot 2 is ${back.palette[2]}. The editor showed the new colour `
    + `and wrote the old one, which is the failure you only find by reopening.`);
  ok(!st.dirty, 'the document is still dirty after a successful write');
}

/* ── 2. a three-digit colour, and transparency ──────────────────────────── */

{
  const st = fresh();
  handleKey(st, 'p'); handleKey(st, 'p');
  const slot = st.sel;
  handleKey(st, 'c'); type(st, 'ec6'); handleKey(st, '\r');
  ok(st.a.palette[slot] === '#eecc66', `#ec6 should expand to #eecc66, got ${st.a.palette[slot]}`);

  handleKey(st, 'c'); handleKey(st, '\r');             // empty = transparent
  ok(st.a.palette[slot] === '-', `an empty entry should mean transparent, got ${st.a.palette[slot]}`);
}

/* ── 3. a bad colour changes nothing and SAYS why ───────────────────────── */

{
  const st = fresh();
  handleKey(st, 'p'); handleKey(st, 'p');
  const was = st.a.palette[st.sel];
  handleKey(st, 'c'); type(st, 'ff'); handleKey(st, '\r');
  ok(st.a.palette[st.sel] === was, `a two-digit colour was accepted: slot is now ${st.a.palette[st.sel]}`);
  ok(/not a colour/.test(st.message) && /6 hex digits|transparent/.test(st.message),
    `a rejected colour must say what would be accepted. Message: ${JSON.stringify(st.message)}`);
  ok(!st.dirty, 'a rejected colour marked the document dirty');
}

/* ── 4. colour entry OWNS the keyboard ──────────────────────────────────── */

/* ⚠️ Someone typing "c00" must not find they have stepped a frame and quit.
   Every key that means something else outside this mode has to be swallowed. */
{
  const st = fresh();
  handleKey(st, 'p'); handleKey(st, 'c');
  const f0 = st.frame, z0 = st.zoom, p0 = st.playing;
  for (const k of ['f', 'q', 'p', 'w', 'u', '[', ']', 'right', 'left', ' ', 'home']) {
    ok(handleKey(st, k) !== false,
      `${JSON.stringify(k)} quit the program while a colour was being typed`);
  }
  ok(st.frame === f0 && st.zoom === z0 && st.playing === p0,
    'keys typed into the colour field also drove the player');
  handleKey(st, '\x1b');
  ok(st.typing === null, 'escape did not leave colour entry');
  ok(!st.dirty, 'a cancelled colour was applied anyway');

  // ...and Ctrl-C still works, because a mode you cannot leave is a trap.
  const st2 = fresh();
  handleKey(st2, 'p'); handleKey(st2, 'c');
  ok(handleKey(st2, '\x03') === false, 'Ctrl-C does not quit from colour entry — that is a trap');
}

/* ── 5. escape steps out before it quits ────────────────────────────────── */

{
  const st = fresh();
  handleKey(st, 'p');
  ok(handleKey(st, '\x1b') !== false && st.sel === -1,
    'escape quit instead of clearing the selection — a key meaning two things must do the '
    + 'reversible one first');
  ok(handleKey(st, '\x1b') === false, 'escape with nothing selected must quit');
}

/* ── 6. trimming produces a file that OPENS ─────────────────────────────── */

{
  const st = fresh();
  st.frame = 4; handleKey(st, '[');
  st.frame = 8; handleKey(st, ']');
  ok(st.in === 4 && st.out === 8, `trim is ${st.in}-${st.out}`);

  const out = editedDoc(st);
  let back;
  assert.doesNotThrow(() => { back = decode(out); },
    'the trimmed document does not decode. Frame `in` is almost always a delta frame, and a delta with '
    + 'no keyframe in front of it decodes to nothing — slicing the encoded string array produces exactly '
    + 'this, and the editor still looks like it worked.');
  checks++;
  ok(back.frames.length === 5, `trimmed to ${back.frames.length} frames, expected 5`);
  ok(out.frames[0].startsWith('K'),
    'the first frame of a trimmed clip is not a keyframe, so it has nothing to delta against');

  // The kept frames must be the ORIGINAL ones, not re-derived approximations.
  let wrong = 0;
  for (let t = 0; t < 5; t++) for (let i = 0; i < W * H; i++) {
    if (back.frames[t][i] !== frames[4 + t][i]) wrong++;
  }
  ok(wrong === 0, `${wrong} cells changed while trimming — a trim must not touch the pixels`);

  handleKey(st, 'w');
  const reread = decode(JSON.parse(readFileSync(path, 'utf8')));
  ok(reread.frames.length === 5, `the written file has ${reread.frames.length} frames, expected 5`);
}

/* ── 7. crossed trim points are repaired, not stored ────────────────────── */

{
  const st = fresh();
  /* ⚠️ The points have to actually CROSS. Setting `in` high while `out` is
     still the last frame never triggers the repair, and the first version of
     this check passed with the repair deleted. */
  st.frame = 2; handleKey(st, ']');       // out = 2
  st.frame = 8; handleKey(st, '[');       // in = 8, now past out
  ok(st.out >= st.in, `in=${st.in} out=${st.out} — the loop would be empty`);
  ok(editedDoc(st).frames.length >= 1, 'a loop starting after it ends produced no frames');

  const st2 = fresh();
  st2.frame = 8; handleKey(st2, '[');     // in = 8
  st2.frame = 2; handleKey(st2, ']');     // out = 2, now before in
  ok(st2.out >= st2.in, `in=${st2.in} out=${st2.out} — the loop would be empty`);
  ok(editedDoc(st2).frames.length >= 1, 'a loop ending before it starts produced no frames');
  ok(editedDoc(st).frames.length >= 1, 'a crossed trim produced a clip with no frames');
  handleKey(st, '\\');
  ok(st.in === 0 && st.out === N - 1, `clearing the trim gave ${st.in}-${st.out}`);
}

/* ── 8. undo goes back, including past a save ───────────────────────────── */

{
  const st = fresh();
  const original = st.a.palette.slice();
  handleKey(st, 'p'); handleKey(st, 'c'); type(st, 'f033ab'); handleKey(st, '\r');
  st.frame = 3; handleKey(st, '[');
  handleKey(st, 'w');
  handleKey(st, 'u');
  ok(st.in === 0, `undo after a save did not restore the trim (in=${st.in}). Saving is not a decision to `
    + `keep the edit forever: someone writes it, looks at the result and wants the previous value back.`);
  handleKey(st, 'u');
  ok(st.a.palette.join() === original.join(),
    `undo did not restore the palette: ${st.a.palette.join()} vs ${original.join()}`);
  handleKey(st, 'u');
  ok(/nothing to undo/.test(st.message), `undo past the start says ${JSON.stringify(st.message)}`);
}

/* ── 9. the rotating slots are real tokens ──────────────────────────────── */

{
  const st = fresh();
  handleKey(st, 'p'); handleKey(st, 'p'); handleKey(st, 'r');
  const slot = st.sel;
  ok(/^@/.test(st.a.palette[slot]), `r gave ${st.a.palette[slot]}, expected a rotating slot`);
  const seen = new Set([st.a.palette[slot]]);
  for (let i = 0; i < 20; i++) { handleKey(st, 'r'); seen.add(st.a.palette[slot]); }
  ok(seen.size >= 10, `r only reaches ${seen.size} rotating slots`);
  assert.doesNotThrow(() => decode(editedDoc(st)),
    'a document using rotating slots does not decode after editing');
  checks++;
}

/* ── 10. nothing is written when nothing changed ────────────────────────── */

{
  const st = fresh();
  const before = readFileSync(path, 'utf8');
  handleKey(st, 'w');
  ok(readFileSync(path, 'utf8') === before, 'the file was rewritten though nothing had been edited');
  ok(/nothing changed/.test(st.message), `w with no edits says ${JSON.stringify(st.message)}`);
}

/* ── 11. the edit is VISIBLE, or it is not an interface ─────────────────── */

const plainOf = (o) => o.split('\n').map((l) => l.replace(/\x1b\[[0-9;]*m/g, '').replace(/\x1b\[K/g, ''));
{
  const st = fresh();
  handleKey(st, 'p'); handleKey(st, 'p'); handleKey(st, 'p');
  const sel = plainOf(render(st, 90, 24)).find((l) => l.startsWith('palette')) || '';
  ok(/\[/.test(sel) && sel.includes(st.a.palette[st.sel]),
    `the picked slot is not marked on screen and its value is not shown. Palette row: ${JSON.stringify(sel)}`);

  handleKey(st, 'c');
  const typing = plainOf(render(st, 90, 24)).pop() || '';
  ok(/colour/.test(typing) && /esc/.test(typing),
    `colour entry does not announce itself, so the keyboard changes meaning silently. Last row: `
    + `${JSON.stringify(typing)}`);
  ok(!/q quit/.test(typing),
    'the normal key hints are still shown during colour entry, so the screen is describing keys that '
    + 'now do something else');
  handleKey(st, '\x1b');

  st.frame = 3; handleKey(st, '[');
  st.frame = 7; handleKey(st, ']');
  const rows = plainOf(render(st, 90, 24));
  ok(rows.some((l) => /loop 4-8/.test(l)), 'the trim is not stated anywhere on screen');
}

/* ── 12. the save confirmation is never the thing that gets dropped ─────── */

/* ⚠️ This is a real regression, not a hypothetical: adding editing keys made
   the hint line longer, the hint line was preferred to the message, and the
   confirmation for the one action that touches the disk vanished at ordinary
   terminal widths. */
for (const cols of [70, 84, 100, 120, 160]) {
  const st = fresh();
  handleKey(st, 'p'); handleKey(st, 'c'); type(st, 'f033ab'); handleKey(st, '\r');
  handleKey(st, 'w');
  const rows = plainOf(render(st, cols, 24));
  ok(rows.some((l) => /written to/.test(l)),
    `at ${cols} columns the save confirmation is not on screen. The hints are always true and always `
    + `available; the message is the only report that something just happened, so when both do not fit `
    + `the message has to win.`);
  ok(!rows.some((l) => l.length > cols), `a row is wider than ${cols} columns after the message`);
}

/* ── 13. unsaved work is not thrown away in silence ─────────────────────── */

{
  const st = fresh();
  ok(handleKey(st, 'q') === false, 'q must quit immediately when nothing has been edited');
}
{
  const st = fresh();
  handleKey(st, 'p'); handleKey(st, 'c'); type(st, 'f033ab'); handleKey(st, '\r');
  ok(handleKey(st, 'q') !== false,
    'q discarded unsaved edits without a word. The only warning a person gets about losing work has to '
    + 'come before they lose it, not in the shape of a file that turns out to be unchanged.');
  ok(/unsaved/.test(st.message) && /\bw\b/.test(st.message) && /again/.test(st.message),
    `the warning must say how to save AND how to leave anyway. Got ${JSON.stringify(st.message)}`);
  ok(handleKey(st, 'q') === false, 'a second q must quit — a warning you cannot get past is a trap');
}
{
  // ⚠️ ...and it must re-arm. A warning left standing turns a later deliberate
  // q into a silent one, which is the very failure this prevents.
  const st = fresh();
  handleKey(st, 'p'); handleKey(st, 'c'); type(st, 'f033ab'); handleKey(st, '\r');
  handleKey(st, 'q');
  handleKey(st, 'right');
  ok(handleKey(st, 'q') !== false, 'the unsaved warning did not re-arm after carrying on working');
}
{
  const st = fresh();
  handleKey(st, 'p'); handleKey(st, 'c'); type(st, 'f033ab'); handleKey(st, '\r');
  handleKey(st, 'w');
  ok(handleKey(st, 'q') === false, 'q still warns after the edits were written');
}
{
  // Ctrl-C means "stop now" everywhere else; re-teaching it here is its own surprise.
  const st = fresh();
  handleKey(st, 'p'); handleKey(st, 'c'); type(st, 'f033ab'); handleKey(st, '\r');
  ok(handleKey(st, '\x03') === false, 'Ctrl-C should stop immediately, as it does everywhere else');
}

/* ── 14. the way to keep your work is on screen when you have work ──────── */

{
  const clean = plainOf(render(fresh(), 88, 24)).pop() || '';
  const st = fresh();
  handleKey(st, 'p'); handleKey(st, 'c'); type(st, 'f033ab'); handleKey(st, '\r');
  st.message = '';
  const dirty = plainOf(render(st, 88, 24)).pop() || '';
  ok(/w write/.test(dirty),
    `the save key is not in the hints once there are unsaved edits. A fixed drop order had it going `
    + `before "fit", so the one key that keeps your work was the one key missing at the moment you had `
    + `work to keep. Hints: ${JSON.stringify(dirty)}`);
  ok(/q quit/.test(dirty), 'the quit hint was displaced — the way out is never the thing that goes');
  ok(!/w write/.test(clean) || clean.length < 60,
    'the save hint takes a slot even with nothing to save, crowding out keys that are always useful');
}

assert.ok(checks >= 45, `only ${checks} assertions ran — this contract is not exercising the editor`);
console.log(`pxa edit OK — ${checks} assertions; colours typed and written through a real file, trims `
  + `re-encoded so they decode, undo past a save, the save confirmation visible at 5 widths, and `
  + `unsaved work never discarded without a warning`);
