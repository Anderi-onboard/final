// ds-base.js — Cloudflare build. Loads the BourneWise design system stylesheet
// (now sitting next to the pages at the deploy root) and wires window.claude
// to the optional /api/claude Pages Function so the AI reading works in prod.
(() => {
  const base = '.';

  /* ── hover / touch prefetch (quicklink pattern) ──
     When the pointer settles on an internal page link — or a touch begins —
     prefetch that page so the click resolves instantly. Idempotent per URL,
     capped, and skipped on Save-Data / slow connections. Pure enhancement:
     failure is silent and never blocks navigation. */
  (function () {
    try {
      var conn = navigator.connection;
      if (conn && (conn.saveData || /2g/.test(conn.effectiveType || ''))) return;
    } catch (e) {}
    var done = {}, count = 0, MAX = 8, timer = null;
    function prefetch(url) {
      if (!url || done[url] || count >= MAX) return;
      done[url] = 1; count++;
      var l = document.createElement('link');
      l.rel = 'prefetch'; l.href = url; l.as = 'document';
      document.head.appendChild(l);
    }
    function candidate(e) {
      var a = e.target && e.target.closest && e.target.closest('a[href]');
      if (!a) return null;
      if (a.target === '_blank' || a.hasAttribute('download')) return null;
      var href = a.getAttribute('href') || '';
      if (!/\.html($|[?#])|^\.?\/?[a-z0-9-]+$/i.test(href)) {
        // only same-origin document links (relative .html or clean paths)
        if (a.origin !== location.origin) return null;
      }
      if (a.origin && a.origin !== location.origin) return null;
      if (/^(mailto:|tel:|#)/.test(href)) return null;
      return a.href;
    }
    document.addEventListener('pointerover', function (e) {
      var url = candidate(e);
      if (!url) return;
      clearTimeout(timer);
      timer = setTimeout(function () { prefetch(url); }, 65);
    }, { passive: true });
    document.addEventListener('pointerout', function () { clearTimeout(timer); }, { passive: true });
    document.addEventListener('touchstart', function (e) {
      var url = candidate(e); if (url) prefetch(url);
    }, { passive: true });
  })();
  /* Fallback for a host page that ships no design-system <link> of its own.
     The token files are linked directly — never @import-chained behind one
     entry sheet, which serialises CSSOM construction and delays first paint.
     The guard is FUNCTIONAL, not a href string match: pages carry a ?v= build
     tag on their links, so comparing hrefs never matched and this injected a
     second, untagged copy of the whole design system on every page load. */
  (function () {
    const present = getComputedStyle(document.documentElement)
      .getPropertyValue('--font-serif').trim();
    if (present) return;                     // tokens already linked — nothing to do
    for (const t of ['fonts', 'colors', 'typography', 'spacing', 'paper', 'motion']) {
      const l = document.createElement('link');
      l.rel = 'stylesheet'; l.href = base + '/tokens/' + t + '.css';
      document.head.appendChild(l);
    }
  })();
  window.__dsBase = base;
  document.documentElement.style.setProperty('--ds-base', `url("${base}")`);

  // ── Claude bridge ────────────────────────────────────────────────────────
  // The app calls window.claude.complete(promptString) OR
  // window.claude.complete({ messages, ...intent }) and expects a Promise<string>.
  // Here we forward that to the /api/claude Pages Function (functions/api/claude.js),
  // which holds the secret OPENROUTER_API_KEY. If the Function isn't deployed (or
  // errors), the call rejects and the app falls back to its deterministic mock
  // reading — so a key-less static deploy still works, just without live prose.
  if (!window.claude) {
    window.claude = {
      complete(input) {
        const payload = (typeof input === 'string')
          ? { messages: [{ role: 'user', content: input }] }
          : { messages: input.messages };
        // The proxy assembles the system prompt from intent, so every field it
        // builds from has to be forwarded — a dropped one degrades silently
        // into a well-formed prompt with nothing in it. `system` is never sent:
        // /api/claude rejects a client-supplied one.
        if (typeof input === 'object' && input) {
          for (const k of ['product', 'role', 'model', 'max_tokens', 'mode', 'temperature',
                           'question', 'reading', 'methodLabel', 'lastQuestion', 'lastReading']) {
            if (input[k] != null) payload[k] = input[k];
          }
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
