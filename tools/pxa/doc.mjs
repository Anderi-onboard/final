/**
 * Opening a .pxa file, and saying something useful when that fails.
 *
 * ⚠️ This lives in its own module because there were TWO of these — cli.mjs
 * parsed the file for `inspect`/`gif`/`sheet`/`preview` and tui.mjs parsed it
 * again for `tui` — with different wording and different coverage. One of them
 * reported a missing file as a Node stack trace ending in
 * `binding.readFileUtf8`. An error message is part of the interface, and two
 * copies of an interface drift: this repo has paid for a second list to keep in
 * step more than once.
 */
import { readFileSync, statSync } from 'node:fs';

/**
 * → the parsed document, or exits with a message a person can act on.
 * `cmd` is only used to make the message say the right command name.
 */
export function readDoc(path, cmd = 'inspect') {
  const fail = (msg) => { console.error(`pxa: ${msg}`); process.exit(1); };
  if (!path) fail(`which file? usage: pxa ${cmd} <file.pxa.json>`);

  const st = statSync(path, { throwIfNoEntry: false });
  if (!st) fail(`no such file: ${path}`);
  if (st.isDirectory()) {
    // A directory is the RIGHT argument for `encode` and the wrong one here, so
    // the message is the next command rather than a complaint.
    fail(`${path} is a folder. Encode it first, then open what that writes:\n`
      + `  pxa encode ${path} -o out.pxa.json\n  pxa ${cmd} out.pxa.json`);
  }

  let text;
  try { text = readFileSync(path, 'utf8'); }
  catch (e) { fail(`cannot read ${path}: ${e.message}`); }

  let doc;
  try { doc = JSON.parse(text); }
  catch {
    fail(`${path} is not a .pxa file — it is not even JSON.\n`
      + `  A video or a folder of PNGs has to go through \`pxa encode\` first.`);
  }
  if (!doc || doc.pxa !== 1) {
    fail(`${path} is JSON, but not a .pxa document (it has no "pxa": 1).\n`
      + `  \`pxa encode\` writes these.`);
  }
  return doc;
}
