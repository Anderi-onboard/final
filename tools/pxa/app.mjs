/**
 * pxa.exe — the whole toolchain in one file, no Node and no ffmpeg installed.
 *
 * Three ways in, because a packaged tool gets used three ways:
 *
 *   double-click            starts the studio and opens a browser
 *   drop a VIDEO on it      same, with the clip already loading in the page
 *   drop a FOLDER on it     encodes the PNG frames inside and writes the
 *                           .pxa.json next to it
 *   pxa encode … / inspect … / preview …    the ordinary command line
 *
 * ⭐ The studio is how this ships without ffmpeg. A browser already contains a
 * video decoder; bundling a second one would add ~70MB and a licence question
 * to a tool whose actual work is a few hundred lines of arithmetic. So the exe
 * serves the page and hands the file over, and the decode happens in the
 * engine the machine already has.
 *
 * ⚠️ Everything served here is EMBEDDED at build time, not read from disk —
 * a compiled binary has no source tree beside it. That is also why cli.mjs
 * keeps its usage text in a constant instead of reading its own file.
 *
 * Build (from Linux, macOS or Windows — bun cross-compiles):
 *   bun build --compile --target=bun-windows-x64 tools/pxa/app.mjs --outfile pxa.exe
 * See tools/pxa/build-exe.mjs for every target at once.
 */
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { statSync, readFileSync } from 'node:fs';
import { resolve, basename, extname } from 'node:path';
import { main as runCommand, USAGE } from './cli.mjs';

import studioHtml from '../pxa-studio.html' with { type: 'text' };
import fontsCss from '../../tokens/fonts.css' with { type: 'text' };
/* ⚠️⚠️ These three come from a STAGING COPY, and that is not tidiness — it is
   the only thing that works. cli.mjs imports pxa-codec.mjs and ingest.mjs as
   MODULES; the browser needs the same files as TEXT to serve them. A bundler
   keys by resolved path and keeps one representation per file, so importing
   either path as text silently shadows the module and every named export
   vanishes at build time ("No matching export for decode"). Changing the
   loader to `type: "file"` does not help — the key is the path, not the
   loader. A distinct path is the fix.
   `tools/pxa/.web/` is created by build-exe.mjs and deleted afterwards, so a
   bare `bun build` on this file fails loudly rather than producing a binary
   that serves nothing. */
import codecJs from './.web/pxa-codec.mjs' with { type: 'text' };
import playerJs from './.web/pxa.js' with { type: 'text' };
import ingestJs from './.web/ingest.mjs' with { type: 'text' };
import fontBio from '../../assets/fonts/BioRhyme.woff2' with { type: 'file' };
import fontSpin from '../../assets/fonts/Spinnaker-400.woff2' with { type: 'file' };
import fontPac from '../../assets/fonts/Pacifico-400.woff2' with { type: 'file' };

const JS = 'text/javascript; charset=utf-8';
const TEXT = {
  '/tools/pxa-studio.html': ['text/html; charset=utf-8', studioHtml],
  '/tokens/fonts.css': ['text/css; charset=utf-8', fontsCss],
  '/assets/pxa-codec.mjs': [JS, codecJs],
  '/assets/pxa.js': [JS, playerJs],
  '/tools/pxa/ingest.mjs': [JS, ingestJs]
};
const FILES = {
  '/assets/fonts/BioRhyme.woff2': ['font/woff2', fontBio],
  '/assets/fonts/Spinnaker-400.woff2': ['font/woff2', fontSpin],
  '/assets/fonts/Pacifico-400.woff2': ['font/woff2', fontPac]
};
const MIME = {
  '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.mov': 'video/quicktime',
  '.webm': 'video/webm', '.mkv': 'video/x-matroska',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp'
};

function openBrowser(url, done) {
  const [file, args] = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]]
    : process.platform === 'darwin' ? ['open', [url]]
      : ['xdg-open', [url]];
  let child;
  try {
    child = spawn(file, args, { detached: true, stdio: 'ignore' });
  } catch (e) {
    done(false, e.message);
    return;
  }
  /* ⚠️ The try/catch is not the guard — an unlaunchable command reports through
     an asynchronous 'error' EVENT, not a throw, and a ChildProcess 'error' with
     no listener is an uncaught exception that takes the whole process down.
     Measured on a headless box with no xdg-open: the studio printed its URL,
     then died a tick later. Windows never shows this, because `cmd` is always
     there — so the crash lives exactly where nobody would look for it. */
  child.once('error', (e) => done(false, e.message));
  child.once('spawn', () => { child.unref(); done(true); });
}

/** Wait for a keypress so a double-clicked console window does not vanish
 *  before anyone reads it. Only when a terminal is actually attached — in a
 *  pipe or a CI job this must not hang. */
function hold(message = '\nPress Enter to close.') {
  if (!process.stdin.isTTY) return;
  process.stdout.write(message + '\n');
  try {
    process.stdin.setRawMode?.(true);
    process.stdin.resume();
    process.stdin.once('data', () => process.exit(0));
  } catch {
    process.exit(0);
  }
}

function serve(handOver, { port = 7391, open = true } = {}) {
  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const path = url.pathname === '/' ? '/tools/pxa-studio.html' : url.pathname;

    if (path === '/input' && handOver) {
      let body;
      try { body = readFileSync(handOver.path); }
      catch (e) { res.writeHead(404).end(String(e.message)); return; }
      res.writeHead(200, { 'content-type': handOver.type, 'content-length': body.length });
      res.end(body);
      return;
    }
    if (TEXT[path]) {
      const [type, body] = TEXT[path];
      res.writeHead(200, { 'content-type': type, 'cache-control': 'no-store' });
      res.end(body);
      return;
    }
    if (FILES[path]) {
      // Embedded with `type: "file"`, so the import is a path the runtime can
      // read back out of the binary itself.
      const [type, from] = FILES[path];
      res.writeHead(200, { 'content-type': type, 'cache-control': 'no-store' });
      res.end(readFileSync(from));
      return;
    }
    res.writeHead(404, { 'content-type': 'text/plain' }).end('not found');
  });

  server.on('error', (e) => {
    if (e.code === 'EADDRINUSE' && port < 7400) { serve(handOver, { port: port + 1, open }); return; }
    console.error(`pxa: could not start the studio — ${e.message}`);
    hold();
  });

  server.listen(port, '127.0.0.1', () => {
    let url = `http://127.0.0.1:${port}/tools/pxa-studio.html`;
    if (handOver) url += `?src=/input&name=${encodeURIComponent(handOver.name)}`;
    console.log(`\npxa studio  →  ${url}`);
    if (handOver) console.log(`handing over  ${handOver.name}`);
    console.log('\nEverything runs on this machine; nothing is uploaded.');
    console.log('Close this window when you are done.\n');
    if (open) {
      openBrowser(url, (ok, why) => {
        if (!ok) console.log(`(could not open a browser — paste the address above)  ${why || ''}`);
      });
    }
  });
}

/* ── dispatch ──────────────────────────────────────────────────────────── */

const args = process.argv.slice(2);
const first = args[0];

if (first === 'studio' || args.length === 0) {
  const target = args[1] ? resolve(args[1]) : null;
  serve(target ? { path: target, name: basename(target), type: MIME[extname(target).toLowerCase()] || 'application/octet-stream' } : null);
} else if (first === '--help' || first === '-h' || first === 'help') {
  console.log(USAGE);
  console.log('\n  pxa studio [file]   open the browser studio, optionally with a clip loaded');
  console.log('  pxa                 same as `pxa studio`');
  console.log('\nOr drop a video or a folder of PNG frames straight onto the executable.');
  hold();
} else if (runCommand(args)) {
  // An explicit subcommand: ran to completion, say nothing more.
} else {
  /* Not a subcommand — this is a path, which means someone dropped something
     on the executable. A folder of frames is work we can do right here; a
     video needs a decoder, and the browser has one. */
  let stat = null;
  const target = resolve(first);
  try { stat = statSync(target); } catch { /* not a path either */ }

  if (!stat) {
    console.error(`pxa: "${first}" is not a command and not a file or folder.\n`);
    console.error(USAGE);
    hold();
  } else if (stat.isDirectory()) {
    const out = target.replace(/[\\/]+$/, '') + '.pxa.json';
    console.log(`pxa: encoding the PNG frames in ${target}\n`);
    try {
      runCommand(['encode', target, '-o', out, ...args.slice(1)]);
      console.log(`\nwrote ${out}`);
      console.log('Open it in the studio to check every size before you ship it.');
    } catch (e) {
      console.error(`\npxa: ${e.message}`);
    }
    hold();
  } else {
    serve({ path: target, name: basename(target), type: MIME[extname(target).toLowerCase()] || 'application/octet-stream' });
  }
}
