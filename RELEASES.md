# BourneWise release provenance

This file records the source lineage of production releases. Cloudflare builds
pull-request branches as previews and deploys `main` to the public site. The
`production` branch is an append-only verified mirror and rollback anchor:
release merges keep their parents, and it must never be squashed, rebased, or
force-pushed.

## 20260821j — Readable at last: contrast, frame rate, and the opening colour

- Production target: `main` via pull request
- Verified mirror: `production` after public deployment
- Working branch: `claude/final-saas-promotion-7nxvjo`

### Visibility
- `3194920` — rendered contrast, measured from the text's own Range rather than
  its element box, then fixed at the rule that actually owns each colour:

  | | before | after |
  |---|---|---|
  | `.hero-copy small` | 2.69:1 | 5.04:1 |
  | `.nav .ghost` | 3.11:1 | 5.10:1 |
  | `.eyebrow` | 3.14:1 | 5.77:1 |
  | `.plan .desc` | 4.23:1 | 6.35:1 |
  | the four primary buttons | **2.31:1** | **4.52:1** |

  `.eyebrow` measured 4.85:1 nominally and 3.14:1 rendered — WCAG's ratio
  assumes a solid stroke, and at 10px with .13em tracking only ~18% of the
  glyph box carries full-strength colour. Weight, not colour, was the lever.

  `--soft-peach-accent` reunified with `colors.css`'s `--terracotta`:
  luxury-glass had been holding a lighter `#DE795D`, so the documented value
  never rendered on a glass route.

### Performance
- `7641d63` — ridges hold still, clouds drift. 21 → 55 fps on the app route.
  The cost is binary rather than proportional: any drifting ridge invalidates
  every `backdrop-filter` region above it, so two moving planes cost the same
  as ten. Clouds are small and clipped, and cost nothing measurable.
  Removed the 10-plane/6-cloud declarations that the profile block below them
  had been overriding unconditionally — the file declared sixteen animations
  while running five.

### Palette
- `7641d63` — the per-visitor shuffle now opens inside `自定义` or `蓝靛段`.
  Both halves are shuffled, so a visitor lands on the strongest colour without
  landing where the last visitor did. 14/14 fresh sessions opened in those
  segments, split 11/3 (their size ratio), across 11 distinct groups.

### Verification
- 19/19 contract tests, including the new `private-files` and
  `style-ownership` guards
- ten pages load clean, no JavaScript errors, no missing assets
- build tag `20260821j` across every asset reference and `version.json`
- contrast re-measured across multiple palette seeds, not a single group


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
