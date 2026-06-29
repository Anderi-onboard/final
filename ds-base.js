// ds-base.js — Cloudflare build. Loads the BourneWise design system stylesheet
// (now sitting next to the pages at the deploy root) and wires window.claude
// to the optional /api/claude Pages Function so the AI reading works in prod.
(() => {
  const base = '.';
  for (const p of ['styles.css']) {
    const href = base + '/' + p;
    if (document.querySelector('link[rel="stylesheet"][href="' + href + '"]')) continue;
    const l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = href;
    document.head.appendChild(l);
  }
  window.__dsBase = base;
  document.documentElement.style.setProperty('--ds-base', `url("${base}")`);

  // ── Claude bridge ────────────────────────────────────────────────────────
  // The app calls window.claude.complete(promptString) OR
  // window.claude.complete({ system?, messages }) and expects a Promise<string>.
  // Here we forward that to the /api/claude Pages Function (functions/api/claude.js),
  // which holds the secret ANTHROPIC_API_KEY. If the Function isn't deployed (or
  // errors), the call rejects and the app falls back to its deterministic mock
  // reading — so a key-less static deploy still works, just without live prose.
  if (!window.claude) {
    window.claude = {
      complete(input) {
        const payload = (typeof input === 'string')
          ? { messages: [{ role: 'user', content: input }] }
          : { system: input.system, messages: input.messages };
        return fetch('/api/claude', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload)
        }).then((r) => {
          if (!r.ok) throw new Error('claude proxy ' + r.status);
          return r.json();
        }).then((d) => {
          if (d && typeof d.text === 'string') return d.text;
          throw new Error('claude proxy: bad response');
        });
      }
    };
  }
})();
