# BourneWise — Cloudflare deploy

A self-contained static build of the BourneWise paper-site, ready to deploy on
**Cloudflare Pages**. Every page, stylesheet, font reference and script resolves
relative to this folder — there are no `../../` references to the design-system
project anymore.

## What's here

```
index.html          ← the app (landing = chat empty-state, inline conversation)
about.html  pricing.html  login.html  settings.html
privacy.html  terms.html  refund.html  404.html  chat.html (legacy redirect)
styles.css          ← design-system entry (@imports tokens/*)
tokens/*.css         ← colors, fonts, typography, spacing, paper skin
assets/             ← mountain backdrop, paper textures, Claude mark
*.js                ← app logic (chat-app, liuyao-*, casting-figure, sidebar, …)
ds-base.js          ← loads styles.css + wires window.claude → /api/claude
functions/api/claude.js  ← optional Cloudflare Pages Function (the AI proxy)
```

## Deploy (two ways)

**A. Dashboard (drag-and-drop or Git)**
1. Cloudflare dashboard → Workers & Pages → Create → Pages.
2. Either connect your Git repo (set **build output directory** to this folder)
   or upload this folder directly.
3. No build command needed — it's already static.

**B. Wrangler CLI**
```bash
npx wrangler pages deploy .      # run from inside this folder
```

`404.html` is served automatically for unknown paths.

## Turning on the live AI reading (optional)

Out of the box the site works with **no key** — readings fall back to a built-in
deterministic interpretation of the Liu Yao board (real structure, generic prose).

To get live, written readings from Claude:
1. In your Pages project → **Settings → Environment variables**, add a secret:
   - `ANTHROPIC_API_KEY` = your Anthropic API key
   - (optional) `CLAUDE_MODEL` — defaults to `claude-haiku-4-5`
   - (optional) `CLAUDE_MAX_TOKENS` — defaults to `1024`
2. Redeploy. The browser calls `/api/claude`, which the bundled
   `functions/api/claude.js` proxies to Anthropic with your key kept server-side.

If the key is missing or the call fails, the front-end silently uses the mock
reading, so the site never breaks.

> **Cost note:** every casting that reaches the AI makes one Anthropic API call
> billed to your key. The deterministic mock is free. Consider rate-limiting
> `/api/claude` if you expose this publicly.
