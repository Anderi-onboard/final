# BourneWise release provenance

This file records the source lineage of production releases. Cloudflare builds
pull-request branches as previews and deploys `main` to the public site. The
`production` branch is an append-only verified mirror and rollback anchor:
release merges keep their parents, and it must never be squashed, rebased, or
force-pushed.

## 20260821e — Two material routes, one type voice, first reading free

- Production target: `main` via pull request #61
- Verified mirror: `production` after public deployment
- Working branch: `claude/final-saas-promotion-7nxvjo` (32 commits, 59 files)
- Base: merged `origin/main` at `41200ba` before release, so the 114-group
  catalogue and the 取象 reading feature ship intact alongside this work.

### Visual lineage
- `03b9881` — generated mark system; About rebuilt as flat blocks
- `345dd80` — the Sortis brush extracted into a site-wide rule; contours stop
  running parallel to the ridge
- `1e0ddf4` — the method page gets woven weight, a light in the type, and
  cards that turn in place
- `e295269` — the real brand mark replaces a generic dot ring; 4 motifs → 7
- `cc49c53` — type scale collapsed onto three per-family ladders
- `ace9abd` — the woven weight goes site-wide; the glow stays on colour

### Functional lineage
- `4868668` — palette order becomes a per-visitor seeded shuffle
- `ace9abd` — free tier aligned to the server: one whole reading, zero units
- `5477f28` / `e25968d` — one element, one stylesheet; pricing carriers unified

### Provenance and process
- `a6de659` — ARCHITECTURE.md; palette recovery archive recovered from the
  codex branch and verified colour-for-colour against the live catalogue
- `d4069d7` — the 180-group archive restored after the merge dropped it
  silently; multi-agent protocol written
- `5e26473` — OVERVIEW.md

### Verification
- 17/17 contract tests pass, including `build-tag`, `palette-contract`
  (shuffle seeded + persisted + full permutation) and `free-reading-contract`
- ten pages load with no JavaScript errors and no missing assets
- no horizontal scroll at 390px; the flagged overflows measure identical to
  before this branch, so they predate it
- build tag `20260821e` across every asset reference and `version.json`
- palette clamping re-measured on the 114-group catalogue: ridge saturation
  .599 → .242, sky spread 31/255 (2.4× the 180-group era)


## 20260815e — Lianqian production baseline

- Production target: `main` via pull request
- Verified mirror: `production`
- Integration branch: `codex-creem-integration`
- Visual lineage:
  - `aa49ba2` — replace Baoxianghua with the section-aware Lianqian texture system
  - `d1eac52` — remove Baoxianghua runtime hooks and public composition entry point
- Claude functional lineage:
  - `f246ce8` — preserve partial readings after a cut stream
  - `3401472` — send intent and follow-up prompts as user turns
  - `f761def` — route follow-ups by method
  - `2bc99e8` — derive rate-card figures from the assembled prompt
- Verification:
  - primary pages load Lianqian assets and expose zero Baoxianghua runtime rules
  - JavaScript syntax checks pass
  - billing, copy, request, stream recovery, prompt secrecy, prompt coverage,
    session, and rate-card contracts pass

The integration branch is previewed before merge. Once its pull request lands
in `main`, Cloudflare promotes the same traceable commit graph to the public
site; `production` retains the verified release point for audit and rollback.

## 20260815i — Square Lianqian grid and restored palette field

- Production target: `main` via pull request #56
- Verified mirror: `production` after public deployment
- Integration branch: `codex-creem-integration`
- Visual lineage:
  - `73e5af5` — compact, seamless Lianqian texture assets
  - `14204b5` — restore all ten animated ridge colours plus sky and water
  - current release — render every connected-coin texture on a square grid
- Functional lineage: unchanged from the `20260815e` baseline
- Verification:
  - 180 palette groups retain ten ridge colours plus sky and water
  - Lianqian repeats compute to equal horizontal and vertical CSS dimensions
  - billing, palette, texture, and copy contracts pass
  - local About and app routes render without console errors or horizontal overflow
