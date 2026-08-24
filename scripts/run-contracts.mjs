/* Run every contract in tests/, plus the copy-deck audit.
   Discovery is by directory listing on purpose: package.json used to name the
   files one by one, and it named three of seventeen. build-tag, prompt-secrecy,
   free-reading and eleven others existed and were never run — the rules were
   guarded on paper and unguarded in fact. A new contract is now picked up by
   existing, not by someone remembering to register it. */
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const files = readdirSync(resolve(ROOT, 'tests')).filter((f) => f.endsWith('.mjs')).sort();

if (files.length < 15) {
  console.error(`only ${files.length} contracts found — tests/ looks wrong, refusing to report a pass`);
  process.exit(1);
}

const failed = [];
for (const file of files) {
  const run = spawnSync(process.execPath, ['--no-warnings', `tests/${file}`], { cwd: ROOT, encoding: 'utf8' });
  const name = file.replace('.mjs', '');
  if (run.status === 0) {
    console.log(`  ok   ${name}`);
  } else {
    failed.push(name);
    console.log(`  FAIL ${name}`);
    const why = (run.stderr || run.stdout || '').split('\n')
      .find((line) => /AssertionError|Error:/.test(line));
    if (why) console.log(`       ${why.trim().slice(0, 150)}`);
  }
}

// The copy deck is a generated artefact; a stale block means the deck and the
// site disagree about what the product says.
const audit = spawnSync(process.execPath, ['copywriting/audit-copy-deck.mjs'], { cwd: ROOT, encoding: 'utf8' });
const stale = /STALE:\s*(\d+)/.exec(audit.stdout || '');
if (audit.status !== 0 || !stale) {
  failed.push('copy-deck audit');
  console.log('  FAIL copy-deck audit');
} else if (Number(stale[1]) > 0) {
  failed.push(`copy-deck audit (${stale[1]} stale)`);
  console.log(`  FAIL copy-deck audit — ${stale[1]} stale blocks; run node copywriting/generate-copy-deck.mjs`);
} else {
  console.log('  ok   copy-deck audit');
}

console.log('');
if (failed.length) {
  console.error(`${failed.length} of ${files.length + 1} contracts failed: ${failed.join(', ')}`);
  process.exit(1);
}
console.log(`all ${files.length + 1} contracts pass`);
