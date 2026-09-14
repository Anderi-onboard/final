/**
 * pxa tui — a pixel workstation in the terminal.
 *
 * ⭐ A pixel grid and a terminal grid are the same object, which is why this is
 * the right surface rather than a concession to not having a window. One cell
 * carries two vertical pixels with the upper half block ▀ — foreground paints
 * the top, background the bottom — so a 40×24 animation is 40 columns by 12
 * rows at 1:1, and the terminal's own cell aspect (~1:2) makes those pixels
 * come out square. Nothing is being scaled or approximated.
 *
 * ⚠️ `render()` is a pure function of (state, columns, rows) and returns a
 * string. Every escape sequence, every layout decision, every truncation
 * happens inside it, and the terminal I/O below only writes what it returns.
 * That is not tidiness: a TUI whose drawing is tangled into its input loop can
 * only be checked by a person looking at a terminal, and this one is checked by
 * tests/pxa-tui.mjs on a machine with no TTY at all.
 *
 *   pxa tui <file.pxa.json>     play and inspect an encoded animation
 *   pxa tui <frames-dir>        encode with live parameters, write when happy
 */
import { writeFileSync, readdirSync } from 'node:fs';
import { readDoc } from './doc.mjs';
import { join, basename, resolve } from 'node:path';
import { decode, encode, stats, cssVarFor } from '../../assets/pxa-codec.mjs';

/* ── colour ──────────────────────────────────────────────────────────────
   Truecolor for the canvas, because a palette entry is a literal colour and
   rounding it to 256 would be lying about the asset. The chrome stays in plain
   SGR so the interface is still readable on a terminal that has neither. */
const fg = (c) => `\x1b[38;2;${c[0]};${c[1]};${c[2]}m`;
const bg = (c) => `\x1b[48;2;${c[0]};${c[1]};${c[2]}m`;
const RESET = '\x1b[0m';
const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';
const ACCENT = '\x1b[38;2;214;138;84m';
const OFF = '\x1b[39m\x1b[49m';

const SPARK = '▁▂▃▄▅▆▇█';

/** Visible width, ignoring escape sequences — what a line actually occupies. */
export const visibleWidth = (s) => s.replace(/\x1b\[[0-9;]*m/g, '').length;

function hexToRGB(h) {
  const s = h.replace('#', '');
  if (s.length === 3) return s.split('').map((c) => parseInt(c + c, 16));
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16));
}

/** Palette entries → RGB, with rotating slots shown as a neutral stand-in.
 *  A slot has no colour outside a page that publishes it, and inventing one
 *  would misrepresent the asset — so it is drawn grey and labelled. */
function paletteRGB(palette) {
  return palette.map((e) => {
    if (e === '-') return null;
    if (e[0] === '@') return [96, 100, 112];
    return hexToRGB(e);
  });
}

/* ── canvas ──────────────────────────────────────────────────────────────── */

/**
 * One frame as half-block rows. Colour escapes are emitted only when the pair
 * changes — a 40-wide row is typically a handful of runs rather than 40 escape
 * sequences, which is the difference between a redraw that flickers and one
 * that does not.
 */
export function canvasLines(grid, w, h, rgb, zoom) {
  const lines = [];
  const zh = h * zoom, zw = w * zoom;
  for (let r = 0; r < Math.ceil(zh / 2); r++) {
    let out = '', lastTop = -2, lastBot = -2;
    for (let c = 0; c < zw; c++) {
      const x = (c / zoom) | 0;
      const yT = ((r * 2) / zoom) | 0;
      const yB = ((r * 2 + 1) / zoom) | 0;
      const top = yT < h ? grid[yT * w + x] : -1;
      const bot = yB < h ? grid[yB * w + x] : -1;
      if (top !== lastTop || bot !== lastBot) {
        out += OFF;
        const ct = top >= 0 ? rgb[top] : null;
        const cb = bot >= 0 ? rgb[bot] : null;
        if (ct) out += fg(ct);
        if (cb) out += bg(cb);
        lastTop = top; lastBot = bot;
      }
      // With no colour on either half the cell is the terminal's own ground,
      // which is what a transparent cell should look like.
      out += (top >= 0 && rgb[top]) || (bot >= 0 && rgb[bot]) ? '▀' : ' ';
    }
    lines.push(out + RESET);
  }
  return lines;
}

/* ── state ───────────────────────────────────────────────────────────────── */

export function openDoc(doc, name) {
  const a = decode(doc);
  const churn = [0];
  for (let t = 1; t < a.frames.length; t++) {
    let n = 0;
    for (let i = 0; i < a.frames[t].length; i++) if (a.frames[t][i] !== a.frames[t - 1][i]) n++;
    churn.push(n);
  }
  return {
    name, doc, a, churn,
    rgb: paletteRGB(a.palette),
    // zoom 0 means "fit": grow to the largest whole multiple the window holds.
    // A viewer that opens at 1× on a big terminal is showing a postage stamp
    // and making the reader do arithmetic to find the zoom key.
    frame: 0, playing: true, zoom: 0, acc: 0,
    bytes: JSON.stringify(doc).length,
    message: ''
  };
}

/** Keys are a pure transition so they can be driven from a test. Returns
 *  false when the key means "quit". */
/**
 * ⭐ THE key table. The hint line at the bottom of the screen, `pxa help tui`,
 * and handleKey all have to agree, and they did not: the help documented four
 * keys that were never implemented (`.` `,` `g` `p`) and omitted one that was
 * (`home`), because it was written from memory in a different file. A key list
 * is exactly the kind of second list this repo keeps paying for.
 *
 * `keys` are what handleKey must accept; `hint` is the short label for the
 * footer (null = not shown, it still works); `drop` is how readily the footer
 * gives that hint up when the terminal is narrow — `q quit` has the lowest
 * number because the way out is the last thing to go.
 */
export const KEYS = [
  { keys: [' '], hint: 'space', label: 'play / pause', drop: 2 },
  { keys: ['left', 'right'], hint: '←→', label: 'step one frame', drop: 3 },
  { keys: ['+', '=', '-', '_'], hint: '+−', label: 'zoom in / out', drop: 4 },
  { keys: ['f'], hint: 'f', label: 'fit to the window', drop: 5 },
  { keys: ['home'], hint: null, label: 'back to frame 1', drop: 99 },
  { keys: ['q', '\x03', '\x1b'], hint: 'q', label: 'quit (also Esc, Ctrl-C)', drop: 1 }
];

/** The key table as `pxa help tui` prints it. */
export function keyHelp() {
  const w = Math.max(...KEYS.map((k) => (k.hint || k.keys[0]).length));
  return KEYS.map((k) => `  ${(k.hint || 'home').padEnd(w + 3)}${k.label}`).join('\n');
}

export function handleKey(st, key) {
  const n = st.a.frames.length;
  switch (key) {
    case 'q': case '\x03': case '\x1b': return false;
    case ' ': st.playing = !st.playing; st.message = st.playing ? '' : 'paused'; break;
    case 'right': st.playing = false; st.frame = (st.frame + 1) % n; break;
    case 'left': st.playing = false; st.frame = (st.frame - 1 + n) % n; break;
    case 'home': st.frame = 0; break;
    // +/- start from whatever is on screen, so the first press is always a
    // visible step rather than a jump back to 1×.
    case '+': case '=': st.zoom = Math.min(12, (st.shown || 1) + 1); break;
    case '-': case '_': st.zoom = Math.max(1, (st.shown || 1) - 1); break;
    case 'f': st.zoom = 0; st.message = 'fit'; break;
    default: break;
  }
  return true;
}

/* ── render ──────────────────────────────────────────────────────────────── */

const pad = (s, n) => s + ' '.repeat(Math.max(0, n - visibleWidth(s)));

/** Largest whole multiple that fits. Whole multiples only: a pixel drawn 2.5
 *  cells wide is two cells here and three there, and a picture whose own pixels
 *  are different sizes reads as broken rather than as small. */
export function fitZoom(w, h, cols, maxRows) {
  let z = 1;
  while (z < 12 && w * (z + 1) <= cols && Math.ceil(h * (z + 1) / 2) <= maxRows) z++;
  return z;
}

/**
 * → the whole screen as one string. Nothing outside this function decides what
 * appears. Lines are clipped to `cols` by VISIBLE width, so an escape sequence
 * never counts toward the budget and a coloured line never wraps.
 */
export function render(st, cols, rows) {
  const { a } = st;
  const clip = (s) => (visibleWidth(s) <= cols ? s : clipVisible(s, cols));

  // ── header ──────────────────────────────────────────────────────────────
  const left = `${ACCENT}pxa${RESET}  ${BOLD}${st.name}${RESET}`;
  const right = `${DIM}${a.w}×${a.h} · ${a.frames.length} frames · ${a.fps}fps · ${(st.bytes / 1024).toFixed(1)} KB${RESET}`;
  const gap = cols - visibleWidth(left) - visibleWidth(right);
  const head = [gap > 1 ? left + ' '.repeat(gap) + right : left, ''];

  /* ── footer ───────────────────────────────────────────────────────────────
     ⚠️⚠️ Built BEFORE the canvas, and its length measured rather than assumed.
     This used to reserve a hand-written `chrome = 7` rows, which had to match
     the number of lines actually pushed below the picture — a second list to
     keep in step, and it was already off by one. Add a line of air anywhere
     down here and the canvas overruns it: the picture eats the key hints and
     the screen scrolls on every redraw. Now the only number is `foot.length`,
     which cannot be wrong. */
  const frameLabel = `${DIM}frame${RESET}    ${pad(`${st.frame + 1}/${a.frames.length}`, 8)}`;
  const max = Math.max(1, ...st.churn);
  const spark = st.churn.map((c, i) => {
    const ch = SPARK[Math.min(7, Math.round((c / max) * 7))];
    return i === st.frame ? `${ACCENT}${ch}${RESET}` : `${DIM}${ch}${RESET}`;
  }).join('');

  let sw = '';
  st.rgb.forEach((c, i) => {
    sw += c ? `${fg(c)}██${RESET}` : `${DIM}··${RESET}`;
    if (i < st.rgb.length - 1) sw += ' ';
  });
  const rotating = a.palette.filter((e) => cssVarFor(e)).length;
  const s = stats(st.doc);

  /* ⚠️⚠️ Hints are dropped by priority, never clipped. A narrow terminal used to
     truncate this line from the right, and `q quit` sits on the right — so the
     one key a reader needs when nothing else is working was the FIRST thing to
     disappear. Quit is priority 1 and survives to the last column; the rest go
     in reverse order of how badly they are needed. */
  /* Built from KEYS so the footer cannot drift from what the keys actually do.
     Only the ones with a hint appear; `home` works without taking a slot. */
  const SHORT = { 'play / pause': st.playing ? 'pause' : 'play', 'step one frame': 'frame',
    'zoom in / out': 'zoom', 'fit to the window': 'fit', 'quit (also Esc, Ctrl-C)': 'quit' };
  const allKeys = KEYS.filter((k) => k.hint).map((k) => [k.hint, SHORT[k.label] || k.label, k.drop]);
  const sep = `${DIM}  ·  ${RESET}`;
  const hintLine = (ks) => ks.map(([k, v]) => `${k} ${DIM}${v}${RESET}`).join(sep);
  let keys = allKeys.slice();
  while (keys.length > 1 && visibleWidth(hintLine(keys)) > cols) {
    let worst = 0;
    for (let i = 1; i < keys.length; i++) if (keys[i][2] > keys[worst][2]) worst = i;
    keys.splice(worst, 1);
  }

  /* Each row carries how readily it can be given up. When the window is too
     short for everything, the CANVAS shrinks first and then these go in
     priority order — never the other way round. Truncating the list from the
     end (which is what slicing the assembled screen does) drops the footer,
     and the footer is where the reader is told how to get out. */
  const foot = [
    ['', 9],
    [frameLabel + spark, 3],
    /* ⚠️ A blank line here is load-bearing, not spacing for its own sake. The
       sparkline's low bars sit on the bottom of their cells and the palette
       swatches fill theirs, so on adjacent rows the two read as one smeared
       band — the marks touch and the eye cannot tell which row it is reading. */
    /* ⚠️ 3.5, not 8. This blank is what keeps the sparkline off the swatches,
       so it must outlive the row it protects — giving it a high number let the
       guard be dropped while the thing it guarded stayed, and the two smeared
       back together at exactly the sizes where space was tightest. */
    ['', 3.5],
    [`${DIM}palette${RESET}  ${sw}${rotating ? `${DIM}   ${rotating} rotating${RESET}` : ''}`, 4],
    [`${DIM}coded${RESET}    ${DIM}${s.coded} B of ${s.raw} · ${s.frames - s.keyframes} delta`, 5],
    ['', 7],
    [hintLine(keys) + (st.message && visibleWidth(hintLine(keys)) + 5 + st.message.length <= cols
      ? `${DIM}     ${st.message}${RESET}` : ''), 1]
  ];
  // Shed rows until the chrome alone fits, worst-priority first. The canvas may
  // end up with nothing; a viewer with no picture and working keys is usable,
  // one with a picture and no way out is not.
  while (foot.length > 1 && head.length + foot.length > rows) {
    let worst = 0;
    for (let i = 1; i < foot.length; i++) if (foot[i][1] > foot[worst][1]) worst = i;
    foot.splice(worst, 1);
  }

  // ── canvas, sized by what is actually left ──────────────────────────────
  const maxRows = Math.max(0, rows - head.length - foot.length);
  const fit = fitZoom(a.w, a.h, cols, maxRows);
  let zoom = st.zoom === 0 ? fit : st.zoom;
  while (zoom > 1 && (a.w * zoom > cols || Math.ceil(a.h * zoom / 2) > maxRows)) zoom--;
  st.shown = zoom;
  const art = canvasLines(a.frames[st.frame], a.w, a.h, st.rgb, zoom).slice(0, maxRows);

  /* The zoom is only known after the canvas is sized, so the coded row's copy
     of it is written now rather than left one redraw behind. */
  const coded = foot.findIndex((f) => f[1] === 5);
  if (coded >= 0) {
    foot[coded][0] = `${DIM}coded${RESET}    ${DIM}${s.coded} B of ${s.raw} · ${s.frames - s.keyframes} delta`
      + ` · zoom ${zoom}×${st.zoom === 0 ? ' fit' : ''}${RESET}`;
  }

  return [...head, ...art, ...foot.map((f) => f[0])]
    .map((l) => clip(l) + '\x1b[K').join('\n');
}

/** Clip to a visible-character budget without cutting an escape sequence. */
function clipVisible(s, budget) {
  let out = '', seen = 0, i = 0;
  while (i < s.length && seen < budget) {
    if (s[i] === '\x1b') {
      const m = /^\x1b\[[0-9;]*m/.exec(s.slice(i));
      if (m) { out += m[0]; i += m[0].length; continue; }
    }
    out += s[i]; seen++; i++;
  }
  return out + RESET;
}

/* ── terminal ────────────────────────────────────────────────────────────── */

function readKey(buf) {
  const s = buf.toString('utf8');
  if (s === '\x1b[C') return 'right';
  if (s === '\x1b[D') return 'left';
  if (s === '\x1b[A') return 'up';
  if (s === '\x1b[B') return 'down';
  if (s === '\x1b[H' || s === '\x1b[1~') return 'home';
  return s;
}

export function run(st) {
  const out = process.stdout;
  if (!out.isTTY) {
    // Print one frame and leave rather than sitting in a loop nobody can see.
    out.write(render(st, out.columns || 80, out.rows || 24) + '\n' + RESET);
    return;
  }
  out.write('\x1b[?1049h\x1b[?25l');          // alternate screen, hide cursor
  process.stdin.setRawMode(true);
  process.stdin.resume();

  let alive = true;
  const draw = () => {
    if (!alive) return;
    out.write('\x1b[H' + render(st, out.columns, out.rows) + '\x1b[J');
  };
  const quit = () => {
    if (!alive) return;
    alive = false;
    clearInterval(timer);
    process.stdin.setRawMode(false);
    process.stdin.pause();
    out.write('\x1b[?25h\x1b[?1049l' + RESET);
  };

  process.stdin.on('data', (b) => {
    if (!handleKey(st, readKey(b))) { quit(); process.exit(0); }
    draw();
  });
  out.on('resize', draw);
  // ⚠️ Leaving the alternate screen on is the one failure a TUI must not have:
  // the terminal stays unusable after the process is gone.
  for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, () => { quit(); process.exit(0); });
  process.on('exit', quit);

  const period = 1000 / st.a.fps;
  const timer = setInterval(() => {
    if (!st.playing || st.a.frames.length < 2) return;
    st.frame = (st.frame + 1) % st.a.frames.length;
    draw();
  }, period);
  draw();
}

/* ── entry ───────────────────────────────────────────────────────────────── */

export function cmdTui(target) {
  /* One reader for every command — see doc.mjs. This used to have its own,
     with its own wording for the same four failures. */
  const doc = readDoc(target, 'tui');
  run(openDoc(doc, basename(resolve(target))));
}

void writeFileSync; void readdirSync; void join; void encode;
