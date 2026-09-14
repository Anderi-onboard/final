/**
 * TERMINAL UI CONTRACT
 *
 * A TUI is normally checked by a person looking at a terminal, which means it
 * is normally not checked at all. This one can be: `render()` is a pure
 * function of (state, columns, rows) returning a string, and every layout
 * decision, escape sequence and truncation happens inside it. The terminal I/O
 * only writes what it returns. That separation is the reason this file can run
 * on a machine with no TTY.
 *
 * What is pinned:
 *  · no line is wider than the terminal, measured in VISIBLE characters — an
 *    escape sequence costs zero columns, and counting it would make every
 *    coloured line wrap one screen-width early.
 *  · clipping never severs an escape sequence. Half of a colour code is not a
 *    cosmetic problem: the terminal keeps the last colour it understood and
 *    every line after it comes out wrong.
 *  · the alternate screen is always restored. A TUI that exits leaving the
 *    terminal in raw mode with the cursor hidden is the one failure a user
 *    cannot work around, and it happens on the paths nobody tests — SIGINT,
 *    SIGTERM, an uncaught throw.
 *  · zoom is a whole multiple. A pixel drawn 2.5 cells wide is two cells here
 *    and three there, and a picture whose own pixels are different sizes reads
 *    as broken rather than as small.
 *
 * Run: node tests/pxa-tui.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { encode } from '../assets/pxa-codec.mjs';
import { render, handleKey, openDoc, canvasLines, fitZoom, visibleWidth } from '../tools/pxa/tui.mjs';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
let checks = 0;
const ok = (cond, msg) => { checks++; assert.ok(cond, msg); };

/* A small animation with a transparent entry and a rotating slot, so the two
   palette forms that are not literal colours are both exercised. */
const W = 20, H = 12, N = 6;
const grids = Array.from({ length: N }, (_, t) => {
  const g = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    g[y * W + x] = y < 3 ? 0 : ((x + t) % 7 === 0 ? 3 : (y < 7 ? 1 : 2));
  }
  return g;
});
const doc = encode(grids, { w: W, h: H, fps: 10, palette: ['-', '#2b3a55', '#5f8a6a', '@3'] });

/* ── layout ─────────────────────────────────────────────────────────────── */

for (const [cols, rows] of [[80, 24], [40, 20], [200, 60], [24, 12], [120, 40], [80, 12], [60, 9], [100, 7]]) {
  const st = openDoc(doc, 'fixture.pxa.json');
  const out = render(st, cols, rows);
  const lines = out.split('\n');

  ok(lines.length <= rows,
    `render produced ${lines.length} lines for a ${cols}x${rows} terminal — the surplus scrolls the screen `
    + `and the header walks off the top on every redraw`);

  const wide = lines.map((l, i) => [i, visibleWidth(l.replace(/\x1b\[K/g, ''))]).filter(([, w]) => w > cols);
  assert.deepEqual(wide, [],
    `at ${cols}x${rows} these lines exceed the terminal width (line, visible chars): ${JSON.stringify(wide)}. `
    + `Width must be measured in VISIBLE characters — an escape sequence occupies no columns, and counting `
    + `its bytes would wrap every coloured line a screen-width early.`);

  /* ⚠️ Checking only that a line ENDS cleanly is not enough: the clipper appends
     a reset, so a sequence severed in the middle is followed by a well-formed
     one and the line passes. Strip every complete SGR sequence and assert no
     lone ESC survives anywhere. */
  for (const l of lines) {
    const residue = l.replace(/\x1b\[[0-9;]*[mK]/g, '');
    ok(!residue.includes('\x1b'),
      `a line carries a severed escape sequence at ${cols}x${rows}. The terminal then holds the last colour `
      + `it understood and everything after this line is painted in it.`);
  }

  /* ⚠️⚠️ The footer must survive every size. The canvas is the only thing that
     grows, so if its row budget is a hand-written constant rather than the
     measured height of what is drawn below it, the picture quietly eats the key
     hints and the whole screen scrolls on each redraw. Asserting the LAST line
     is the hints line catches that at every size, including the ones where the
     canvas would rather have the room. */
  const plain = lines.map((l) => l.replace(/\x1b\[[0-9;]*[mK]/g, ''));
  ok(plain[plain.length - 1].includes('quit'),
    `at ${cols}x${rows} the last line is ${JSON.stringify(plain[plain.length - 1].slice(0, 40))}, not the key `
    + `hints. The canvas row budget must be derived from the footer's measured height — a constant reserve `
    + `drifts the moment a line is added below the picture.`);
  ok(plain.some((l) => l.startsWith('frame')) && plain.some((l) => l.startsWith('palette')),
    `at ${cols}x${rows} the frame or palette row was dropped`);

  /* ⚠️ The sparkline's bars sit on the bottom of their cells and the palette
     swatches fill theirs; on adjacent rows the two read as one smeared band.
     They must not be neighbours. */
  const fi = plain.findIndex((l) => l.startsWith('frame'));
  const pi = plain.findIndex((l) => l.startsWith('palette'));
  ok(pi - fi >= 2,
    `at ${cols}x${rows} the frame strip and the palette swatches are on adjacent rows (${fi} and ${pi}). `
    + `Low sparkline bars and full-height swatches touch across that boundary and read as one band.`);

  /* ⚠️ And the opposite failure, which "nothing is too wide" cannot see: a
     clipper that counts BYTES instead of visible characters makes every
     coloured line far too SHORT, cutting the picture off mid-row while every
     width assertion passes. The canvas must come through at its full width. */
  const canvasRow = lines.find((l) => l.includes('▀'));
  if (canvasRow) {
    ok(visibleWidth(canvasRow.replace(/\x1b\[K/g, '')) === W * st.shown,
      `at ${cols}x${rows} a canvas row came through ${visibleWidth(canvasRow.replace(/\x1b\[K/g, ''))} cells `
      + `wide, expected ${W * st.shown} (${W} cells at ${st.shown}x). Width has to be counted in VISIBLE `
      + `characters in both directions — an escape sequence occupies no columns, so counting its bytes `
      + `truncates the picture while every "is it too wide" check stays green.`);
  }
}

/* ── canvas geometry ────────────────────────────────────────────────────── */

for (const z of [1, 2, 3]) {
  const st = openDoc(doc, 'x');
  const art = canvasLines(st.a.frames[0], W, H, st.rgb, z);
  ok(art.length === Math.ceil(H * z / 2),
    `at zoom ${z} the canvas is ${art.length} rows, expected ${Math.ceil(H * z / 2)} — one terminal row `
    + `carries exactly two pixel rows, and any other ratio means the picture is being resampled`);
  ok(visibleWidth(art[0]) === W * z,
    `at zoom ${z} a canvas row is ${visibleWidth(art[0])} cells wide, expected ${W * z}`);
}

ok(canvasLines(grids[0], W, H, openDoc(doc, 'x').rgb, 1)[0].includes(' '),
  'a transparent palette entry is not being drawn as blank. It must leave the terminal\'s own ground '
  + 'showing; painting it any colour invents one the asset does not carry.');

/* ── zoom fits, in whole multiples ──────────────────────────────────────── */

ok(fitZoom(20, 12, 200, 60) > 1, 'fitZoom does not grow to fill a large terminal — it opens at 1x and makes '
  + 'the reader hunt for the zoom key on a screen with room to spare');
for (const [cols, rows] of [[80, 24], [200, 60], [41, 13], [21, 7]]) {
  const z = fitZoom(20, 12, cols, rows);
  ok(Number.isInteger(z) && z >= 1, `fitZoom returned ${z}`);
  ok(20 * z <= cols && Math.ceil(12 * z / 2) <= rows,
    `fitZoom(${cols},${rows}) returned ${z}, which does not fit`);
}

/* ── keys ───────────────────────────────────────────────────────────────── */

const st = openDoc(doc, 'x');
ok(st.playing === true, 'a viewer must open playing — a still first frame looks like a broken animation');
handleKey(st, ' ');
ok(st.playing === false, 'space did not pause');
handleKey(st, 'right');
ok(st.frame === 1 && st.playing === false, 'stepping must move one frame and must not resume playback');
handleKey(st, 'left'); handleKey(st, 'left');
ok(st.frame === N - 1, `stepping back past zero must wrap, got ${st.frame}`);
render(st, 80, 24);
const shown = st.shown;
handleKey(st, '+');
ok(st.zoom === shown + 1,
  `+ set zoom to ${st.zoom} from a displayed ${shown}. It must step from what is ON SCREEN: starting from a `
  + `stored 0 ("fit") would jump the picture back to 1x on the first press.`);
ok(handleKey(st, 'q') === false, 'q must end the session');
ok(handleKey(st, '\x03') === false, 'ctrl-c must end the session');

/* ── the terminal must be given back ────────────────────────────────────── */

const src = readFileSync(`${ROOT}/tools/pxa/tui.mjs`, 'utf8');
/* ⚠️ These search the SOURCE TEXT, where an escape is the four characters
   \x1b — not the ESC byte. A regex containing a real ESC matches nothing here
   and the assertion passes for free on a file that never restores anything. */
ok(src.includes('\\x1b[?1049h') && src.includes('\\x1b[?1049l'),
  'the alternate screen is entered but never left, or never entered at all');
ok(/setRawMode\(false\)/.test(src), 'raw mode is never released — the shell afterwards eats every keystroke');
ok(src.includes('\\x1b[?25h'), 'the cursor is hidden and never shown again');
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  ok(src.includes(sig), `no ${sig} handler — the terminal is left in raw mode on the most ordinary way to quit`);
}
ok(/process\.on\('exit'/.test(src), 'no exit handler, so a throw anywhere leaves the terminal unusable');
ok(/if \(!out\.isTTY\)/.test(src),
  'the runner does not check for a TTY. Piped into a file or a pipeline it would sit in an input loop '
  + 'forever with nobody able to see or end it.');

/* ── cropping is stated, not implied ────────────────────────────────────── */

/* ⚠️ A 320-cell-wide clip in an 80-column window shows a quarter of itself, and
   the status line said "zoom 1× fit" — which reads as "all of it, sized to the
   window". The entire claim of this screen is that you can answer "did this
   encode right" by looking at it; showing a corner without saying so is worse
   than showing nothing, because the reader believes it. */
{
  const big = openDoc(encode(Array.from({ length: 3 }, () => {
    const g = new Uint8Array(320 * 200); for (let i = 0; i < g.length; i++) g[i] = 1 + (i % 3); return g;
  }), { w: 320, h: 200, fps: 12, palette: ['-', '#101520', '#3d6b52', '#e7c86a'] }), 'big.pxa.json');
  const plainOf = (o) => o.split('\n').map((l) => l.replace(/\x1b\[[0-9;]*m/g, '').replace(/\x1b\[K/g, ''));
  const cropped = plainOf(render(big, 80, 24)).find((l) => l.startsWith('coded')) || '';
  ok(/showing\s+\d+×\d+\s+of\s+320×200/.test(cropped),
    `a picture too large for the window does not say it is cropped. Status line: ${JSON.stringify(cropped)}`);

  const small = openDoc(encode(Array.from({ length: 3 }, () => {
    const g = new Uint8Array(12 * 8); for (let i = 0; i < g.length; i++) g[i] = 1 + (i % 3); return g;
  }), { w: 12, h: 8, fps: 12, palette: ['-', '#101520', '#3d6b52', '#e7c86a'] }), 'small.pxa.json');
  const whole = plainOf(render(small, 80, 24)).find((l) => l.startsWith('coded')) || '';
  ok(!/showing/.test(whole),
    `a picture that fits claims to be cropped, which would teach the reader to ignore the warning. `
    + `Status line: ${JSON.stringify(whole)}`);
}

assert.ok(checks >= 24, `only ${checks} assertions ran — this contract is not exercising the interface`);
console.log(`pxa tui OK — ${checks} assertions; ${W}x${H}x${N} laid out at 5 terminal sizes, `
  + `zoom fits in whole multiples, terminal restored on exit and on three signals`);
