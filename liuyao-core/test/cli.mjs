/**
 * COMMAND-LINE CONTRACT — the demo runs end to end, and refuses to run without a model
 * Run: node test/cli.mjs
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cli = resolve(ROOT, 'src/cli.js');

const demo = spawnSync(process.execPath, [cli, '--question', '这个月的求财能不能成', '--throws', '1,2,3,0,3,2', '--date', '2026-10-08', '--mock'], { encoding: 'utf8', env: { ...process.env, OPENROUTER_API_KEY: '' } });
assert.equal(demo.status, 0, demo.stderr);
assert.match(demo.stdout, /起卦：单阳 拆阴 重阳动 交阴动 重阳动 拆阴/);
assert.match(demo.stdout, /本卦 水火既济/);
assert.match(demo.stdout, /【六爻（由初至上）】/);
assert.match(demo.stdout, /演示模式/, 'the demo says it is a placeholder');

const noKey = spawnSync(process.execPath, [cli, '--question', 'x', '--throws', '1,2,3,0,3,2'], { encoding: 'utf8', env: { ...process.env, OPENROUTER_API_KEY: '' } });
assert.equal(noKey.status, 1);
assert.match(noKey.stderr, /OPENROUTER_API_KEY/);

const usage = spawnSync(process.execPath, [cli], { encoding: 'utf8' });
assert.equal(usage.status, 2);

console.log('cli: ok — demo prints the casting, packet and placeholder; refuses to run without a key; usage on no question');
