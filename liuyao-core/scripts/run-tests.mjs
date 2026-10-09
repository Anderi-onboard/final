/* Runs every contract in test/. Discovery is by directory listing, so a new
   contract is picked up without being registered anywhere. */
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const files = readdirSync(resolve(ROOT, 'test')).filter((f) => f.endsWith('.mjs')).sort();
if (files.length === 0) {
  console.error('no contracts found in test/ — refusing to report a pass');
  process.exit(1);
}
const failed = [];
for (const file of files) {
  const run = spawnSync(process.execPath, [`test/${file}`], { cwd: ROOT, encoding: 'utf8' });
  if (run.status === 0) {
    const last = run.stdout.trim().split('\n').pop() || '';
    process.stdout.write(`  ok   ${file}  ${last}\n`);
  } else {
    failed.push(file);
    process.stdout.write(`  FAIL ${file}\n${run.stderr || run.stdout}\n`);
  }
}
console.log(failed.length ? `${failed.length} contract(s) failed` : `all ${files.length} contracts pass`);
process.exit(failed.length ? 1 : 0);
