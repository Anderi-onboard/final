#!/usr/bin/env node
/**
 * Package the toolchain as a standalone executable, one per target.
 *
 *   node tools/pxa/build-exe.mjs              # every target
 *   node tools/pxa/build-exe.mjs windows      # just one
 *
 * Bun cross-compiles, so a Windows .exe builds fine from Linux or macOS. It
 * downloads the target runtime on first use.
 *
 * ⚠️ The staging step is load-bearing, not housekeeping. The browser needs
 * pxa-codec.mjs, pxa.js and ingest.mjs as TEXT to serve them, while cli.mjs
 * imports two of them as MODULES. A bundler keeps one representation per
 * resolved path, so a text import of a path that is also a module silently
 * strips every named export — the build fails with "No matching export for
 * decode" and the cause is nowhere near the message. Copying them to a second
 * path is what makes both readings possible.
 */
import { mkdirSync, copyFileSync, rmSync, existsSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const STAGE = resolve(HERE, '.web');
const OUT = resolve(ROOT, 'dist');

const TARGETS = {
  windows: ['bun-windows-x64', 'pxa.exe'],
  linux: ['bun-linux-x64', 'pxa-linux'],
  mac: ['bun-darwin-arm64', 'pxa-macos-arm64'],
  'mac-intel': ['bun-darwin-x64', 'pxa-macos-x64']
};

const want = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const targets = want.length ? want : Object.keys(TARGETS);
for (const t of targets) {
  if (!TARGETS[t]) { console.error(`unknown target "${t}" — pick from: ${Object.keys(TARGETS).join(', ')}`); process.exit(1); }
}

if (!spawnSync('bun', ['--version'], { encoding: 'utf8' }).stdout) {
  console.error('bun is not on PATH. Install it from https://bun.sh — it is the only build dependency,\n'
    + 'and it is needed only to package; everything else in tools/pxa runs on plain node.');
  process.exit(1);
}

rmSync(STAGE, { recursive: true, force: true });
mkdirSync(STAGE, { recursive: true });
for (const [from, to] of [
  ['assets/pxa-codec.mjs', 'pxa-codec.mjs'],
  ['assets/pxa.js', 'pxa.js'],
  ['tools/pxa/ingest.mjs', 'ingest.mjs']
]) copyFileSync(resolve(ROOT, from), resolve(STAGE, to));

mkdirSync(OUT, { recursive: true });
let failed = 0;
try {
  for (const name of targets) {
    const [target, outfile] = TARGETS[name];
    const out = resolve(OUT, outfile);
    process.stdout.write(`building ${name.padEnd(10)} ${target} … `);
    const r = spawnSync('bun', [
      'build', '--compile', `--target=${target}`,
      resolve(HERE, 'app.mjs'), '--outfile', out
    ], { cwd: ROOT, encoding: 'utf8' });
    if (r.status !== 0 || !existsSync(out)) {
      failed++;
      console.log('FAILED');
      console.error((r.stderr || r.stdout || '').trim().split('\n').slice(-8).join('\n'));
      continue;
    }
    console.log(`${(statSync(out).size / 1024 / 1024).toFixed(1)} MB  →  dist/${outfile}`);
  }
} finally {
  // Always clean up: a stale .web/ would let a later build succeed against
  // sources that have since changed, which is the quietest kind of wrong.
  rmSync(STAGE, { recursive: true, force: true });
}
process.exit(failed ? 1 : 0);
