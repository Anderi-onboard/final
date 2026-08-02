# BourneWise — Cloudflare deploy

A self-contained static build of the BourneWise paper-site, ready to deploy on
**Cloudflare Pages**. Every page, stylesheet, font reference and script resolves
relative to this folder — there are no `../../` references to the design-system
project anymore.

## What's here

```
index.html          ← the app (landing = chat empty-state, inline conversation)
about.html  pricing.html  login.html  settings.html
privacy.html  terms.html  refund.html  404.html
styles.css          ← design-system entry (@imports tokens/*)
tokens/*.css         ← colors, fonts, typography, spacing, paper skin
assets/             ← mountain backdrop, paper textures, Claude mark
*.js                ← app logic (chat-app, liuyao-*, casting-figure, sidebar, …)
ds-base.js          ← loads styles.css + wires window.claude → /api/claude
functions/api/claude.js  ← the AI proxy (Cloudflare Pages Function)
wrangler.toml       ← Pages config (local dev + deploy)
.dev.vars.example   ← copy to .dev.vars for local keys (gitignored)
```

## Local development

```bash
npm install
cp .dev.vars.example .dev.vars   # add your OPENROUTER_API_KEY (optional)
npm run dev:fn                    # site + /api/claude function on :3000
# or, static only (no backend): npm run dev
```

## Backend (the AI proxy)

One Function, `functions/api/claude.js`, serves the whole backend:

- `POST /api/claude` — the browser sends *intent* (`product` / `role`) and the
  proxy picks the model server-side, so model choice + cost control live in one
  place. The Anthropic key never reaches the client.
  - `product: "stria"`  → **Opus 5** (primary-hexagram analysis)
  - `product: "sortis"` → **Opus 5** (moving-line and transformed-hexagram analysis)
  - `role: "router" | "qc"` → **Haiku 4.5** (cheap classify / quality-control)
  - an explicit `model` is honoured only if allow-listed (`opus`/`sonnet`/`haiku`)
- `GET /api/claude` — health probe: confirms the route is live and whether the
  key is set (without leaking it). Useful to verify wiring before spending units.

The Sortis pipeline is **Gate → Route → focused prompt → QC pass** (with one
retry on QC failure); Stria runs a single Opus pass. The configured
`anthropic/claude-opus-5` slug is a provisional offline target: verify and
replace it with the provider's official public model ID before enabling the API.
If the key is missing or a call fails, the front-end falls back to its
deterministic Liu Yao reading, so the site never breaks.

## Accounts, ledger & history (D1)

Real, cross-device persistence lives in **Cloudflare D1**, served by two
catch-all Functions:

- `functions/api/auth/[[path]].js` — `POST /api/auth/dev` (real persisted
  email sign-in), Google OAuth (`GET /api/auth/google` + `/google/callback`,
  active only when `GOOGLE_CLIENT_ID/SECRET` are set), `POST /api/auth/signout`.
- `functions/api/account/[[path]].js` — `GET /me`, `POST /spend`, `POST /grant`,
  `POST /plan`, and `GET/POST/DELETE /castings`. Sessions are stateless signed
  cookies (`SESSION_SECRET`); the server owns the unit balance (anti-tamper) and
  records every movement in an append-only `ledger` table.

The front-end (`account.js`) hydrates from `GET /me` on load and mirrors writes
optimistically, reconciling to the server's authoritative balance. **Guests and
key-less / DB-less deploys keep working entirely on `localStorage`** — the
account API returns `501` and the app falls back silently.

Setup:
```bash
npx wrangler d1 create bournewise          # paste database_id into wrangler.toml
npx wrangler d1 execute bournewise --local  --file=./schema.sql
npx wrangler d1 execute bournewise --remote --file=./schema.sql
# set SESSION_SECRET (and optional GOOGLE_CLIENT_ID/SECRET) in .dev.vars / Pages env
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

To get live, written readings from Claude (via OpenRouter):
1. In your Pages project → **Settings → Environment variables**, add a secret:
   - `OPENROUTER_API_KEY` = your OpenRouter API key
   - (optional) `STRIA_MODEL` — prepared to default to `anthropic/claude-opus-5`
   - (optional) `SORTIS_MODEL` — prepared to default to `anthropic/claude-opus-5`
   - (optional) `UTILITY_MODEL` — defaults to `anthropic/claude-haiku-4.5`
   - (optional) `CLAUDE_MAX_TOKENS` — defaults to `1024`
2. Redeploy. The browser calls `/api/claude`, which the bundled
   `functions/api/claude.js` proxies to OpenRouter with your key kept server-side.

If the key is missing or the call fails, the front-end silently uses the mock
reading, so the site never breaks.

> **Cost note:** every casting that reaches the AI makes one Anthropic API call
> billed to your key. The deterministic mock is free. Consider rate-limiting
> `/api/claude` if you expose this publicly.
