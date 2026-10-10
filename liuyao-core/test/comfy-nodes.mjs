/**
 * COMFY NODES CONTRACT — the Python node package, run through python3
 * The checks themselves are in comfy/test_nodes.py; this file makes them part of `node scripts/run-tests.mjs`.
 */
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const run = spawnSync('python3', [resolve(ROOT, 'comfy', 'test_nodes.py')], { encoding: 'utf8' });
assert.equal(run.status, 0, run.stderr || run.stdout);
console.log(run.stdout.trim());
