# BourneWise release provenance

This file records the source lineage of production releases. Cloudflare builds
pull-request branches as previews and deploys `main` to the public site. The
`production` branch is an append-only verified mirror and rollback anchor:
release merges keep their parents, and it must never be squashed, rebased, or
force-pushed.

## 20260824a — Failure copy says what failed; contracts re-enforced

- Production target: `main` via pull request
- Verified mirror: `production` — **not updated**, still at `a4c4ec8` (20260815i)
- Diagnosis behind it: a live cast failed showing "The reading didn't make it
  through… check the balance above rather than assuming a refund." That is the
  catch-all branch of `castFail`, which handled only 401/402/503/timeout. The
  proxy also answers **400, 429 and 500**, so all three rendered a billing
  question. `chat-app.js` had **zero console calls**, so the status was
  discarded — the failure left no trace anywhere.
- What shipped:
  - `failureCopy()` — one status→copy mapping, used by both the cast and
    follow-up renderers. New branches for 429 (`tooFast`) and 400
    (`badRequest`). 500 deliberately keeps the mid-stream copy: a server-side
    failure may still have delivered tokens.
  - `logFailure()` — one `console.warn` with status, message and build.
  - `castFailed` / `answerFailed` rewritten and de-duplicated. They lived in
    `copy.js` **and** hardcoded in `chat-app.js` with different wording; the
    hardcoded pair was what rendered, so the deck recorded a sentence the site
    never showed. `chat-app.js` now reads `copy.js` like every other string.
  - `copy.js` `signInToCast` still promised "1,500 units on us" after the
    welcome became one reading. Fixed.
  - Restored from `refs/pull/60/head`: `.github/workflows/contracts.yml`,
    `scripts/run-contracts.mjs`, `tests/font-lock.mjs`, the full `npm test`.
    Another session had force-pushed the branch to main's history, discarding
    them; `npm test` was back to 3 of 21.
- Verification:
  - 21/21 contracts pass
  - `upstream-error` rewritten around the shared mapper and verified against 4
    planted regressions (drop the 429 branch, drop 400, revert 503 to the
    catch-all, re-hardcode the follow-up copy) — each turns it red
  - `stream-recovery` mid-stream copy count 4 → 2, asserting single ownership
  - `font-lock` widened for `.bk-brand` (the blocks-route wordmark)
  - copy-deck audit 81 stale → 0
  - build tag `20260822j → 20260824a`, 155 tags across 16 files
  - production API confirmed healthy during diagnosis: same question, 200 OK,
    87 events, 2,349 chars, 65s

## 20260821l — The interface stops describing its own machinery

- Production target: `main` via pull request
- Verified mirror: `production` after public deployment
- Working branch: `claude/final-saas-promotion-7nxvjo`

### Copy
- `3a2c0ba` — `copy.js` opens with its own rule: a reader has a balance and asks
  questions, and does not have "reservations", "settlements" or "metering".
  Checked against the site, pricing's 60px section heading read **Transparent
  token metering** — a word its own file bans, in the second-largest type on the
  site. Rewritten to the standard §6 already sets for readings, which is not
  ornament: the better line is shorter, every word means what it usually means,
  and it says who did what.

  | before | after |
  |---|---|
  | Transparent token metering | The arithmetic, in the open |
  | Choose a balance that fits. | Nothing is held back, and nothing is cut off. |
  | The casting engine creates a fixed hexagram. Claude Opus 5 interprets it against the context you provide. | Six lines are cast by a fixed procedure, and Claude reads them against what you wrote. It explains the figure; it never picks it. |

  The pricing headline is the billing model said once: nothing is reserved on
  entry, and `chargeUnits()` has no balance guard, so a reading that has begun
  finishes and bills even into the negative. Both halves are literally true.

- `d5ae355` — the six rotating display lines stopped being instructions. They
  had been imperatives at 68px ("Describe the situation and ask one specific
  question"), which is form-field help text at display size. The instruction
  already exists in the composer's own placeholder, where someone is about to
  type.

### Palette
- `d5ae355` — the opening bias now filters by measured on-screen saturation,
  not segment name. 自定义 averages .219 after the clamp — second lowest on the
  site, spanning .096 to .260 — so "open inside 自定义" landed on a washed-out
  group about half the time, which is why the first version looked like it had
  done nothing. 33 groups clear .23; 16/16 fresh visitors opened at ≥.232,
  mean .251, on 16 distinct groups.

### Interface
- `d5ae355` — the carry menu scrolls, and the eight-casting cap is gone with it.
  Bottom fade is driven by the scroll measurement, so it never implies history
  that is not there.
- `d5ae355` — glow extended to every display line and loud numeral on the glass
  routes, through the same two tokens.

### Verification
- 19/19 contract tests
- ten pages load clean, no JavaScript errors, no missing assets
- all six display lines sit in three or four lines at 1440
- build tag `20260821l` across every asset reference and `version.json`


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
