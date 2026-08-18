/* Palette editor: find what is still sitting in a browser's localStorage.
   ─────────────────────────────────────────────────────────────────────────
   Paste this whole file into the DevTools console of the page you edited on.

   WHY THIS EXISTS. palette-guide.html and palette-overview.html do not write
   to disk. They layer three things over the committed catalogue, all of them
   in localStorage:

     bw-custom-palettes-v2   groups you ADDED        (v1 key is read once and
                                                      migrated: bw-custom-palettes-v1)
     bw-deleted-palette-ids-v1  groups you DELETED
     bw-palette-overrides-v1    per-group EDITS layered over the file
     bw-colour-library-v1       saved swatches
     bw-palette-autosave-v1     the autosave toggle

   So the editor can show you a palette that is genuinely yours and genuinely
   different from assets/palettes/color-groups.json, with nothing wrong on
   either side. Work that was never exported lives only here.

   WHERE TO RUN IT. localStorage is scoped per ORIGIN, and the port is part of
   the origin. http://localhost:8000, http://localhost:5500, file:// and
   https://bournewise.com each have their own separate store. Editing on one
   and looking on another shows you nothing — which reads exactly like the work
   is gone. Open the same host AND port you edited on. If you do not remember
   it, try the ports your usual server picks (8000, 8080, 5500, 3000, 5173)
   and run this on each; it is read-only and safe to run anywhere.
*/
(async function paletteAudit() {
  const KEYS = {
    added: 'bw-custom-palettes-v2',
    addedLegacy: 'bw-custom-palettes-v1',
    deleted: 'bw-deleted-palette-ids-v1',
    overrides: 'bw-palette-overrides-v1',
    library: 'bw-colour-library-v1',
    autosave: 'bw-palette-autosave-v1'
  };

  const raw = {};
  for (const [name, key] of Object.entries(KEYS)) raw[name] = localStorage.getItem(key);

  const parse = (s, fallback) => { try { return JSON.parse(s); } catch (e) { return fallback; } };
  const added = parse(raw.added, null) || parse(raw.addedLegacy, []) || [];
  const deleted = parse(raw.deleted, []) || [];
  const overrides = parse(raw.overrides, {}) || {};
  const library = parse(raw.library, []) || [];

  console.log('%cPalette localStorage audit', 'font:600 14px system-ui');
  console.log('origin:', location.origin || location.href);

  const present = Object.entries(KEYS).filter(([n]) => raw[n] != null);
  if (!present.length) {
    console.warn('Nothing stored on THIS origin. localStorage is per host:port — '
      + 'if you edited on a different port, open that one and run this again.');
    return;
  }
  console.table(present.map(([name, key]) => ({
    key, bytes: raw[name].length,
    entries: Array.isArray(parse(raw[name], null)) ? parse(raw[name], []).length
      : (typeof parse(raw[name], null) === 'object' && parse(raw[name], null)
        ? Object.keys(parse(raw[name], {})).length : '—')
  })));

  console.log(`added ${added.length} · deleted ${deleted.length} · `
    + `overridden ${Object.keys(overrides).length} · library ${library.length}`);
  if (added.length) console.log('  added ids   :', added.map((g) => g && g.id).join(', '));
  if (deleted.length) console.log('  deleted ids :', deleted.join(', '));
  if (Object.keys(overrides).length) console.log('  edited ids  :', Object.keys(overrides).join(', '));

  // ── compare against the committed catalogue ──────────────────────────────
  let file = null;
  for (const url of ['./assets/palettes/color-groups.json',
                     '/assets/palettes/color-groups.json',
                     'https://bournewise.com/assets/palettes/color-groups.json']) {
    try {
      const r = await fetch(url, { cache: 'no-store' });
      if (r.ok) { file = await r.json(); break; }
    } catch (e) { /* try the next one */ }
  }
  if (!Array.isArray(file)) {
    console.warn('Could not load color-groups.json from this page — the comparison below is skipped. '
      + 'The stored data above is still complete.');
    return;
  }

  const byId = new Map(file.map((g) => [g.id, g]));
  const merged = file
    .filter((g) => !deleted.includes(g.id))
    .map((g) => (overrides[g.id] ? { ...g, ...overrides[g.id] } : g))
    .concat(added);

  console.log(`file ${file.length} groups → editor shows ${merged.length}`);

  // Which overrides actually differ from the file, field by field. An override
  // recorded but identical to the file is not lost work.
  const realEdits = [];
  for (const [id, patch] of Object.entries(overrides)) {
    const base = byId.get(id);
    if (!base) { realEdits.push({ id, note: 'no such group in the file' }); continue; }
    const fields = Object.keys(patch).filter((f) => JSON.stringify(patch[f]) !== JSON.stringify(base[f]));
    if (fields.length) realEdits.push({ id, name: base.name, changed: fields.join(', ') });
  }
  if (realEdits.length) { console.log('edits that differ from the file:'); console.table(realEdits); }
  else console.log('no override differs from the committed file — nothing unexported in the edits.');

  // ── hand the merged catalogue back ───────────────────────────────────────
  window.__bwPalette = { added, deleted, overrides, library, file, merged };
  const json = JSON.stringify(merged, null, 1);
  console.log(`window.__bwPalette holds everything. To save the merged catalogue (${json.length} bytes):`);
  console.log('  copy(JSON.stringify(window.__bwPalette.merged, null, 1))');
  console.log('Then replace assets/palettes/color-groups.json with the clipboard contents.');
})();
