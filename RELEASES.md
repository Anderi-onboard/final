# BourneWise release provenance

This file records the source lineage of production releases. Cloudflare builds
pull-request branches as previews and deploys `main` to the public site. The
`production` branch is an append-only verified mirror and rollback anchor:
release merges keep their parents, and it must never be squashed, rebased, or
force-pushed.

## 20260831c — The block routes become a place: two hues, a day, and weather

- Production target: `main` via pull request
- Verified mirror: `production` after public deployment
- Working branch: `claude/final-saas-promotion-7nxvjo`
- Build tag: `20260831c` (14 files + `version.json`, checked by `tests/build-tag.mjs`)
- Preview: `claude-final-saas-promotion.bournewise.pages.dev`

This release is almost entirely the two block routes — `about.html` and
`guide.html`. About was rebuilt from rounded floating cards onto the route's own
flush-square material; the method page's card interaction was repaired; and the
palette work underneath both turned out to rest on a false premise.

### Colour: a step index is not a hue
- `7af7e70` — every block role named a palette step, and a fixed step is not a
  fixed hue. Measured over the whole catalogue: adjacent steps differ by ~6° of
  hue (3↔4 is 6°, 6↔7 is 6°), and **any fixed trio of steps has a median
  smallest hue gap of 5°, under 15° in 104 of 114 groups** — which is why three
  deep blocks came out the same brown. The cards are not short of colour: the
  median card spans **172°**. `publishHues()` now picks per group — the most
  saturated entry, then the one furthest from it in hue — and publishes
  `--bw-hue-a/b`. That pair measures **161° median, under 15° in 3 groups**.
  Two, not four: a greedy four-hue pick measures 7° median and fails in 87
  groups. Page hue span across the six colour-carrying fills: **min 62°, median
  161°, 0 groups under 20°.**

### The marks get a background of their own
- `b4131af` — "每个板块要有背景" had been read as a gradient on each block and
  was wrong. Fills are flat again (**0 gradient backgrounds page-wide**); the
  background belongs to the mark — the same path drawn three times, each outer
  copy a wide round-joined stroke, so each mark sits in two rings of its own
  outline. Rings take clay's and ochre's hue but not their lightness, pinned to
  a band on the ink's side of the fill.
- `3b426cd`, `be85aaf` — ring strokes 9/4 → 15/7, and the crossfade selector is
  `svg *`: each path sets its own fill, so a transition on the `<svg>` never
  reached them and marks snapped while their blocks faded.

### A day, a night, and weather
- `be85aaf` — the banded sky is gone. One flat field, one body, and the two
  horizon blocks are opposite halves of one day, trading places on every turn of
  the palette clock; the body walks east to west across successive turns off the
  engine's raw slot count. Sun and moon are the catalogue's own motifs.
- `3b426cd` — clouds drift while the ridges hold still, which is the home page's
  split and was measured there: **3 drifting ridge planes = 21fps against 55fps
  with ridges stopped**. It is the same cloud — `mountain-range.js` publishes
  its path as `window.BWRange`. Transform only; both routes still **60fps**.

### The catalogue grows, and the fields get a centre
- `be85aaf` — 30 → **42 motifs**, added as structures the set did not have
  rather than new names for bands it already had. Same grammar with no
  exemptions; `tests/marks-form.mjs` rejected four passes (out of field, 1.14%
  self-similarity, crossing centrelines, too little ink, a turn at r15) and each
  was a real drawing error.
- `be85aaf` — every field now has one subject on a 2×2 of the lattice with a
  ring of branches around it, and the lattice carries a small cyclic
  displacement so it stops reading as ruled paper.

### The method page's card interaction
- `417f718` — four faults, all structural. The two-wide halving rule had been
  applied to `.mt-display` and nothing else, so widgets on wide cards drew at
  double — step 05's cost figure at **124.6px**, pushed off its own panel. The
  doubling now lives in one variable (`--mt-u`). Controls wore the glass route's
  translucency and are flat opaque fields with hard edges. The outgoing face was
  not fading at all (`visibility` was not in the transition list) — a hard cut
  followed by a fade-in, the actual stutter — and a 300ms lock silently dropped
  the second click.
- `417f718` — **the sweep was not testing any of it**: a shut card's work face is
  `visibility:hidden`, so `blocksweep.mjs` had been measuring the page as loaded
  and never saw a widget. It opens the five cards first now, and immediately
  found 5 element classes below AA, worst **2.51:1**.

### Verification
- `tests/` — **21/21**.
- `blocksweep.mjs` (analytic, ink against carrier) — **clear across 114 groups ×
  2 routes**, with the method page's step cards opened.
- `blockpix.mjs` (composited pixels, glyph-run sampling, full-page) — **clear,
  8 groups × 2 routes**.
- `overlapmoving.mjs` — **0 overlapping mark pairs** sampled across the
  animation cycle.
- one-layer check — no carrier holds both contour art and marks.
- deck coverage — **42/42 motifs dealt** on About.
- `fps.mjs` (after warm-up) — **60fps both routes**.
- interaction — click, typing inside a card, and the keyboard toggle all intact;
  day/night confirmed to swap and the celestial body to walk west over six
  turns; cloud position sampled moving; `prefers-reduced-motion` reports
  `animationName: none`.

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
