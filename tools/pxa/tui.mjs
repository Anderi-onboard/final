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

export function openDoc(doc, name, path = null) {
  const a = decode(doc);
  const churn = [0];
  for (let t = 1; t < a.frames.length; t++) {
    let n = 0;
    for (let i = 0; i < a.frames[t].length; i++) if (a.frames[t][i] !== a.frames[t - 1][i]) n++;
    churn.push(n);
  }
  return {
    name, doc, a, churn, path,
    rgb: paletteRGB(a.palette),
    // zoom 0 means "fit": grow to the largest whole multiple the window holds.
    // A viewer that opens at 1× on a big terminal is showing a postage stamp
    // and making the reader do arithmetic to find the zoom key.
    frame: 0, playing: true, zoom: 0, acc: 0,
    bytes: JSON.stringify(doc).length,
    message: '',
    /* ── editing ──────────────────────────────────────────────────────────
       ⭐ The three edits worth having here are the three a person can only
       judge by LOOKING: is that colour right, does the loop start in the right
       place, does it end in the right place. Anything that needs precision —
       moving a cell, redrawing a shape — belongs in an image editor, and
       pretending otherwise would produce a bad one of those.
       `sel` is the selected palette slot (-1 = none), `typing` is a hex being
       entered, `in`/`out` are the trim points, `undo` holds whole palettes
       because a palette is tiny and a partial undo is worse than none. */
    sel: -1, typing: null, in: 0, out: a.frames.length - 1,
    undo: [], dirty: false, saved: null, confirmQuit: false
  };
}

/** A palette entry as it should appear on screen. */
function entryLabel(e) { return e === '-' ? 'transparent' : e; }

/** Snapshot for undo. Cheap: a palette and two integers. */
function mark(st) {
  st.undo.push({ palette: st.a.palette.slice(), in: st.in, out: st.out });
  if (st.undo.length > 64) st.undo.shift();
  st.dirty = true;
}

/** Rebuild the derived colour table after a palette edit. */
function repalette(st) { st.rgb = paletteRGB(st.a.palette); }

/** Rotating slots, in the order `r` cycles them. */
const ROTATING = ['@1', '@2', '@3', '@4', '@5', '@6', '@7', '@8', '@9', '@10',
  '@sky', '@water', '@gem', '@cloudbody', '@ink-sky', '@ink-ridge'];

/**
 * Apply the edits and hand back a document ready to write.
 * ⚠️ Trim is applied by RE-ENCODING the kept frames, not by slicing the string
 * array. Frame `in` is almost always a delta frame, and a delta with no
 * keyframe in front of it decodes to nothing — the codec is right to throw, and
 * a "save" that writes a file which will not open is the worst kind of save.
 */
export function editedDoc(st) {
  const kept = st.a.frames.slice(st.in, st.out + 1);
  return encode(kept, { w: st.a.w, h: st.a.h, fps: st.a.fps, palette: st.a.palette });
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
  { keys: [' '], hint: 'space', short: 'play', label: 'play / pause', drop: 2 },
  { keys: ['left', 'right'], hint: '←→', short: 'frame', label: 'step one frame', drop: 3 },
  { keys: ['+', '=', '-', '_'], hint: '+−', short: 'zoom', label: 'zoom in / out', drop: 4 },
  { keys: ['f'], hint: 'f', short: 'fit', label: 'fit to the window', drop: 5 },
  { keys: ['home'], hint: null, label: 'back to frame 1', drop: 99 },
  { keys: ['p'], hint: 'p', short: 'slot', label: 'pick the next palette slot', drop: 6 },
  { keys: ['c'], hint: null, label: 'type a hex colour for the picked slot', drop: 99 },
  { keys: ['r'], hint: null, label: 'cycle the picked slot through the rotating vars', drop: 99 },
  { keys: ['['], hint: '[]', short: 'trim', label: 'trim the loop to start / end here', drop: 7 },
  { keys: [']'], hint: null, label: 'trim the loop to end here', drop: 99 },
  { keys: ['\\'], hint: null, label: 'clear the trim', drop: 99 },
  { keys: ['u'], hint: null, label: 'undo the last edit', drop: 99 },
  { keys: ['w'], hint: 'w', short: 'write', label: 'write the edits back to the file', drop: 8 },
  { keys: ['q', '\x03', '\x1b'], hint: 'q', short: 'quit', label: 'quit (also Esc, Ctrl-C)', drop: 1 }
];

/** The key table as `pxa help tui` prints it. */
/** Printable name for a key the footer has no short hint for. */
const KEY_NAME = { ' ': 'space', '\r': 'enter', '\x1b': 'esc', '\x03': 'ctrl-c', left: '←', right: '→' };
export function keyHelp() {
  const shown = KEYS.map((k) => k.hint || KEY_NAME[k.keys[0]] || k.keys[0]);
  const w = Math.max(...shown.map((x) => x.length));
  return KEYS.map((k, i) => `  ${shown[i].padEnd(w + 3)}${k.label}`).join('\n');
}

export function handleKey(st, key) {
  const n = st.a.frames.length;

  /* ⭐ Typing a colour swallows every key until Enter or Escape. A modal state
     that does not visibly own the keyboard is how someone types "c00" and
     finds they have stepped a frame and quit. The status line says so while
     this is on. */
  if (st.typing !== null) {
    if (key === '\r' || key === '\n') {
      const hex = st.typing.replace(/^#/, '');
      if (/^[0-9a-f]{6}$/i.test(hex) || /^[0-9a-f]{3}$/i.test(hex)) {
        const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
        mark(st);
        st.a.palette[st.sel] = `#${full.toLowerCase()}`;
        repalette(st);
        st.message = `slot ${st.sel} → #${full.toLowerCase()}`;
      } else if (st.typing === '' || st.typing === '-') {
        mark(st);
        st.a.palette[st.sel] = '-';
        repalette(st);
        st.message = `slot ${st.sel} → transparent`;
      } else {
        // ⚠️ Say what was wrong with it. "invalid" makes the reader guess
        // whether the problem was the #, the length, or the letters.
        st.message = `"${st.typing}" is not a colour — 6 hex digits (e7c86a), 3 (ec6), or empty for transparent`;
      }
      st.typing = null;
      return true;
    }
    if (key === '\x1b') { st.typing = null; st.message = 'cancelled'; return true; }
    if (key === '\x7f' || key === '\b') { st.typing = st.typing.slice(0, -1); return true; }
    if (key === '\x03') return false;
    if (/^[0-9a-fA-F#-]$/.test(key) && st.typing.length < 7) st.typing += key;
    return true;
  }

  // Anything other than a second q means they carried on, so the warning is
  // spent. Leaving it armed would turn a later, deliberate q into a silent one.
  if (key !== 'q' && st.confirmQuit) { st.confirmQuit = false; st.message = ''; }

  switch (key) {
    // Escape steps back out of a selection before it quits — a key that means
    // two things must do the reversible one first.
    case '\x1b': if (st.sel >= 0) { st.sel = -1; st.message = ''; return true; } return false;
    /* ⚠️ Unsaved edits are not thrown away in silence. One more q does it, so
       nobody is trapped — but the only warning a person gets about losing work
       must come BEFORE they lose it, not in the shape of a file that turns out
       to be unchanged. Ctrl-C is exempt: that key means "stop now" everywhere
       else and re-teaching it here would be its own surprise. */
    case 'q':
      if (st.dirty && !st.confirmQuit) {
        st.confirmQuit = true;
        st.message = 'unsaved edits — w to write them, q again to discard';
        return true;
      }
      return false;
    case '\x03': return false;
    case ' ': st.playing = !st.playing; st.message = st.playing ? '' : 'paused'; break;
    case 'right': st.playing = false; st.frame = (st.frame + 1) % n; break;
    case 'left': st.playing = false; st.frame = (st.frame - 1 + n) % n; break;
    case 'home': st.frame = 0; break;
    // +/- start from whatever is on screen, so the first press is always a
    // visible step rather than a jump back to 1×.
    case '+': case '=': st.zoom = Math.min(12, (st.shown || 1) + 1); break;
    case '-': case '_': st.zoom = Math.max(1, (st.shown || 1) - 1); break;
    case 'f': st.zoom = 0; st.message = 'fit'; break;

    case 'p':
      st.sel = (st.sel + 1) % st.a.palette.length;
      st.message = `slot ${st.sel}: ${entryLabel(st.a.palette[st.sel])}`;
      break;
    case 'c':
      if (st.sel < 0) { st.message = 'pick a slot first — press p'; break; }
      st.typing = '';
      break;
    case 'r': {
      if (st.sel < 0) { st.message = 'pick a slot first — press p'; break; }
      const cur = ROTATING.indexOf(st.a.palette[st.sel]);
      mark(st);
      st.a.palette[st.sel] = ROTATING[(cur + 1) % ROTATING.length];
      repalette(st);
      st.message = `slot ${st.sel} → ${st.a.palette[st.sel]} (follows the page's colour group)`;
      break;
    }
    case '[':
      mark(st);
      st.in = st.frame;
      if (st.out < st.in) st.out = n - 1;
      st.message = `loop starts at frame ${st.in + 1}`;
      break;
    case ']':
      mark(st);
      st.out = st.frame;
      if (st.in > st.out) st.in = 0;
      st.message = `loop ends at frame ${st.out + 1}`;
      break;
    case '\\':
      mark(st); st.in = 0; st.out = n - 1; st.message = 'trim cleared';
      break;
    case 'u': {
      const u = st.undo.pop();
      if (!u) { st.message = 'nothing to undo'; break; }
      st.a.palette = u.palette; st.in = u.in; st.out = u.out;
      repalette(st);
      st.dirty = st.undo.length > 0;
      st.message = 'undone';
      break;
    }
    case 'w': {
      if (!st.dirty) { st.message = 'nothing changed'; break; }
      try {
        st.saved = editedDoc(st);
        writeFileSync(st.path, JSON.stringify(st.saved));
        st.bytes = JSON.stringify(st.saved).length;
        /* The undo stack is NOT cleared. Saving is not a decision to keep the
           edit forever — someone writes it, looks at the result, and wants the
           previous colour back. `dirty` is what tracks unsaved changes. */
        st.dirty = false;
        st.doc = st.saved;
        st.message = `written to ${st.name} — ${st.a.frames.length === st.out - st.in + 1 ? '' : ''}`
          + `${st.out - st.in + 1} frames, ${st.a.palette.length} colours`;
      } catch (e) {
        // A failed write must not look like a successful one.
        st.message = `could not write: ${e.message}`;
      }
      break;
    }
    default: break;
  }
  // Stepping outside the trimmed range is confusing while trimming, so the
  // player wraps within it.
  if (st.playing || key === 'left' || key === 'right') {
    if (st.frame > st.out) st.frame = st.in;
    if (st.frame < st.in) st.frame = st.out;
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
  const trimmed = st.in > 0 || st.out < a.frames.length - 1;
  const frameLabel = `${DIM}frame${RESET}    ${pad(`${st.frame + 1}/${a.frames.length}`, 8)}`
    + (trimmed ? `${ACCENT}loop ${st.in + 1}-${st.out + 1}${RESET}  ` : '');
  const max = Math.max(1, ...st.churn);
  /* ⭐ The sparkline is where the trim has to be visible: frames outside it are
     drawn as a low rule rather than their real height, so the kept range reads
     as a shape and not as two numbers somewhere else on the screen. */
  const spark = st.churn.map((c, i) => {
    const inRange = i >= st.in && i <= st.out;
    const ch = inRange ? SPARK[Math.min(7, Math.round((c / max) * 7))] : '\u2581';
    if (i === st.frame) return `${ACCENT}${ch}${RESET}`;
    return inRange ? `${DIM}${ch}${RESET}` : `${DIM}\x1b[2m${ch}${RESET}`;
  }).join('');

  let sw = '';
  st.rgb.forEach((c, i) => {
    /* ⚠️ The selection is drawn with BRACKETS, not with a background colour.
       Marking the picked swatch by tinting it changes the one thing the reader
       is looking at to judge the colour. */
    const body = c ? `${fg(c)}██${RESET}` : `${DIM}··${RESET}`;
    sw += i === st.sel ? `${ACCENT}[${RESET}${body}${ACCENT}]${RESET}` : ` ${body} `;
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
     Only the ones with a hint appear; the rest work without taking a slot.
     ⚠️ The short form is a FIELD, not a lookup keyed on the long label. It was
     a lookup, and adding keys whose labels were not in it silently put whole
     sentences in the footer — which pushed the line past the width and made the
     "written to <file>" confirmation the thing that got dropped. */
  const allKeys = KEYS.filter((k) => k.hint).map((k) => [
    k.hint,
    k.keys[0] === ' ' && st.playing ? 'pause' : (k.short || k.label),
    /* ⭐ `w` is the FIRST hint to go when nothing has been edited and nearly the
       last once something has. A fixed order had it dropping before "fit" at
       ordinary widths, so the one key that keeps your work was the one key not
       on screen at the moment you had work to keep. */
    k.keys[0] === 'w' ? (st.dirty ? 1.5 : 8) : k.drop
  ]);
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
    [`${DIM}palette${RESET}  ${sw}`
      + (st.sel >= 0 ? `${ACCENT}   ${st.sel} ${entryLabel(a.palette[st.sel])}${RESET}`
        : (rotating ? `${DIM}   ${rotating} rotating${RESET}` : '')), 4],
    [`${DIM}coded${RESET}    ${DIM}${s.coded} B of ${s.raw} · ${s.frames - s.keyframes} delta`, 5],
    ['', 7],
    /* ⚠️ While a colour is being typed the hints are REPLACED, not decorated.
       A modal state that leaves the normal hints on screen is how someone
       types "c00" and wonders why the frame stepped: the keys really do mean
       something else now, so the screen has to say only that. */
    [st.typing !== null
      ? `${ACCENT}colour${RESET} #${st.typing}${ACCENT}▁${RESET}   ${DIM}enter to set · esc to cancel · `
        + `empty for transparent${RESET}`
      /* ⚠️ When both do not fit, the MESSAGE wins and the hints go. The hints
         are always true and always available; the message is the only report
         of something that just happened — and the first casualty of the old
         rule was "written to <file>", the confirmation for the one action that
         touches the disk. A save with no confirmation is how you find out by
         reopening the file. */
      : (st.message && visibleWidth(hintLine(keys)) + 5 + visibleWidth(st.message) > cols)
        ? clipVisible(`${ACCENT}${st.message}${RESET}`, cols)
        : hintLine(keys) + (st.message ? `${DIM}     ${st.message}${RESET}` : ''), 1]
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
  const artAll = canvasLines(a.frames[st.frame], a.w, a.h, st.rgb, zoom);
  const art = artAll.slice(0, maxRows);
  // How much of the picture is actually on screen, in CELLS of the source.
  const visCols = Math.min(a.w, Math.floor(cols / zoom));
  const visRows = Math.min(a.h, art.length * 2 / zoom | 0);
  const shownCells = visCols * visRows, totalCells = a.w * a.h;

  /* The zoom is only known after the canvas is sized, so the coded row's copy
     of it is written now rather than left one redraw behind. */
  const coded = foot.findIndex((f) => f[1] === 5);
  if (coded >= 0) {
    foot[coded][0] = `${DIM}coded${RESET}    ${DIM}${s.coded} B of ${s.raw} · ${s.frames - s.keyframes} delta`
      + `${trimmed ? ` · ${st.out - st.in + 1} kept` : ''} · zoom ${zoom}×${st.zoom === 0 ? ' fit' : ''}`
      /* ⚠️ Say when the picture is CROPPED. At 1× a 320-cell-wide clip in an
         80-column window shows a quarter of itself, and the word "fit" beside
         it reads as "this is all of it, sized to the window". The whole claim
         of this screen is that you can answer "did this encode right" by
         looking — a screen that shows a corner without saying so is worse than
         one that shows nothing, because the reader believes it. */
      + (shownCells < totalCells
        ? `${RESET}${ACCENT}  showing ${visCols}×${visRows} of ${a.w}×${a.h}${RESET}`
        : RESET);
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
    // ⚠️ Wrap inside the trim, not around the whole clip: a trim you cannot see
    // play is a number, not an edit, and the only way to judge a loop point is
    // to watch it come round.
    st.frame = st.frame >= st.out ? st.in : st.frame + 1;
    draw();
  }, period);
  draw();
}

/* ── entry ───────────────────────────────────────────────────────────────── */

export function cmdTui(target) {
  /* One reader for every command — see doc.mjs. This used to have its own,
     with its own wording for the same four failures. */
  const doc = readDoc(target, 'tui');
  const path = resolve(target);
  run(openDoc(doc, basename(path), path));
}

void writeFileSync; void readdirSync; void join; void encode;
