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
        // forward routing intent so the proxy picks the right model
        if (typeof input === 'object' && input) {
          if (input.product) payload.product = input.product;
          if (input.role) payload.role = input.role;
          if (input.model) payload.model = input.model;
          if (input.max_tokens) payload.max_tokens = input.max_tokens;
        }
        return fetch('/api/claude', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          // credentials required so the session cookie reaches the proxy —
          // without this, functions/api/claude.js can never see who's
          // signed in and Sortis billing/gating silently fails open.
          credentials: 'same-origin',
          body: JSON.stringify(payload)
        }).then((r) => {
          return r.json().catch(() => ({})).then((d) => {
            if (!r.ok) {
              const err = new Error((d && d.error) || ('claude proxy ' + r.status));
              err.status = r.status; err.code = d && d.error;
              throw err;
            }
            return d;
          });
        }).then((d) => {
          if (d && typeof d.text === 'string') {
            // server did the authoritative unit deduction for this call —
            // pull the local ledger back in sync with it (no-op if the
            // account layer or a server balance isn't in play).
            if (typeof d.unitsRemaining === 'number' && window.BWAccount && window.BWAccount.reconcileUnits) {
              window.BWAccount.reconcileUnits({ ok: true, units: d.unitsRemaining });
            }
            return d.text;
          }
          throw new Error('claude proxy: bad response');
        });
      }
    };
  }
})();
