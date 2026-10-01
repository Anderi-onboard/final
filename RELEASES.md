# BourneWise release provenance

This file records the source lineage of production releases. Cloudflare builds
pull-request branches as previews and deploys `main` to the public site. The
`production` branch is an append-only verified mirror and rollback anchor:
release merges keep their parents, and it must never be squashed, rebased, or
force-pushed.

## 20260914a — 断卦从提示词搬进代码,盘面事实开始能路由到断法库

- Production target: `main` via pull request #82
- Verified mirror: `production` after public deployment
- Working branch: `claude/bournewise-handoff-priorities-19xcmh`
- Build tag: `20260914a`(16 个文件 + `version.json`,`tests/build-tag.mjs` 钉着)
- Preview: `claude-bournewise-handoff-pr.bournewise.pages.dev`
- 契约:**33 条全过**(新增 6 条:`board-payload` `board-facts` `flow-segment`
  `yongshen-assignment` `verdict-ladder` `feature-vocab`)

起因是一副断错的盘。有人问「我明天考科目一能过吗」,解读答「能过」,答得很硬,
还专门写了一段说三条理由互相独立。他没过。

查完之后每一条缺陷都在**序列化层**,一条都不在提示词里。规则是对的,模型也照做了 ——
它照着一副**缺事实、而且自相矛盾**的盘做的。这一版就是按这个分的组。

### 一 · 盘发出去的时候少了东西

- `bada0fb` — 月建按**五行**发,`"monthElement":"Metal"` 留下申和酉两种可能。
  月是申,解读说酉月,而它半个判断建立在「月建日辰全都是金」上。月破的定义是冲月建,
  所以月建错一格,月破就从寅挪到卯,和爻上已经算对的标记**无声地打架**。
- `85691d9` — 四处生克源头的头两处(月/日的**生**与**克**)被 `distill()` 静默丢掉。
  六爻里四爻丢了时钟关系,第 5 爻发出去时 flags 是**空字符串** —— 读起来是「这条爻没有性质」。
- `7e42b92` `5331be7` — 引擎**从来没算过爻与爻之间的关系**。《增删卜易》速断十二条里
  六条因此算不出来。新增 `liuyao-relations.js`:爻爻生克、合冲刑害、日月岁时、世应、
  三合三会、局对爻、相生链、真假空破、暗动/日破。速断十二条从 5/12 变成 12/12 可计算。
- `7350d90` — 关系不再按「类型」平铺,改成**按到用神的距离排,一行一条,带箭头**。
  依据是量过的三篇:GSM-IC(arXiv 2302.00093)、GSM-DC(2505.18761)、
  Lost in the Middle(2307.03172)。13 条爻爻生克里曾有 9 条自己标着「静爻,不作用」——
  把明确不成立的关系标好标签送进模型,正是 GSM-IC 量的那个构造。

### 二 · 用神是一个写死的字符串

- `7e4c794` — `chat-app.js` 传 `category:"general"`,于是**每一篇解读读的都是世爻**,
  不管问的是什么。`CATEGORY_YONGSHEN` 二十八个 key 有二十五个够不到,包括 `exam:"parent"`——
  对的答案在代码里,一次都没被选中过。现在从问题的措辞取,并**报出它是匹配还是兜底**:
  一个和决定长得一模一样的默认值,就是这件事活了这么久的原因。
- `bbef4db` — 有些事类取两个用神。考试是官鬼(名额)加父母(卷子),任一为凶则事不成。
  提示词头部说了「BOTH are 用神」,而 `deriveRoles` 只认一个锚,把第二个用第一个的格子
  标成了「Support」。**那不是遗漏,是矛盾,而数据赢过散文。**

### 三 · 断法执行在提示词里,不在代码里

- `61a072f` — 《增删卜易》五级裁决梯落成 `liuyao-verdict.js`:卦变回头克 → 用神/世爻
  有根 → 动化凶 → 生克力量对比 → 假空假破应期。前三步命中即定案,第四步只出计数。
  ⭐ 那副断错的盘差别就在这:老的让模型自己推「亥水化巳火是什么」,它推成了仇神关系;
  现在直接给它「第 3 步命中:化绝」—— 查表查出来的,不需要判断。
- `3025afa` `99a26ba` — 断法库开张。条目**只有三格**:`id` / `原文` / `机器值`。
  判据是:模型拿着原文能自己得出的,不写。第一版每条十二格,九格是手写模型本来就会做的事。
- `a2f133e` `ce7ed39` — 断法分区表(`functions/_lib/doctrine/INDEX.md`),111 条规则对着
  代码点名:**约 118 条,实现 20 条(17%)**。两个大洞是 SOP-3(这一笔生克算不算数)和
  SOP-5(什么时候应验),48 条实现 6 条。并写清 `<序>` 是编号不是顺序 —— 三种求值方式
  (顺序 / 或 / 查表)互斥,走错一种给出的是**看起来完全正常的错答案**。

### 四 · 盘面事实开始能路由到断法库

- `cfe3e97` — 新增 `liuyao-features.js`:把引擎算出来的状态翻译成那批两级 RAG 的检索键。
  清点 35 个 feature —— **29 个引擎已经算了只差换名字,5 个是 M1 的活,1 个是判断不是
  事实,真缺 0 个**。映射**只在这一处**;配 `tests/feature-vocab.mjs`,因为卡里引用了一个
  永远不会被发出的 id,那张卡就是**不可达的,而不可达不报错**。四种植入的违规逐一验过会红。
- 三件明知故犯,写在文件里没有悄悄处理:`SIX_RELATIVE`/`SIX_SPIRIT`/`LINE_POSITION`/
  `HEXAGRAM_IMAGE` 对任何盘都成立,所以 TECH-SYMBOLIC 每卦都被选中 —— 那是 RAG 那侧的
  键设计问题,**照实发,不替别人的键悄悄加阈值**;`TARGET_*` 只对用神爻发;
  `MULTIPLE_PLAUSIBLE_INTERPRETATIONS` 不发,拿判断当检索键等于让路由去猜结论。

### 五 · 解读自己的规矩

- `d573da1` — 篇幅下限撤掉。上限 08-19 撤的,理由是同一条的两头:**一个数字分不出
  「这盘本来就没什么好说的」和「漏写了一段」**,在前一种情况下它买到的只有注水。
- `316c6aa` — `inference_traps` 13,400 → 11,525,21 条规则一条没少,按它们所属的三种
  失败形式重组,每种带自己的检查 —— 于是没被人列举过的陷阱也被它的**形式**接住。
- `95a86b3` `2ec539f` `6d8cc48` — 新增 `SEGMENTS.flow`。两处修正留在历史里:第六条曾经
  用一对 ✗/✓ **换掉了论点**而不是重排它;六个 ✓ 例子全建在占位词上(这一段/这条线/能成),
  过不了 `voice` 自己的验收线 —— 判词单拿出来、不看上文也要能看懂。
- `79c2ec4` — `checkBoardFacts` 之前唯一的规则是一条英文正则,而解读跟着提问人的语言走,
  所以它**一次都没匹配过**。现在按小句扫冲的说法:中文把两个地支放在动词前面的次数,
  至少和放在两边一样多。
- `fc05fef` — `temperature` / `top_p` / `top_k` 在 Opus 5 系上已移除,原生 API 返回 400。
  我们经 OpenRouter 大概是被静默丢弃 —— **这个杠杆已经空转了一段时间,没人发现。**

### 六 · 没做,而且是知道没做的

- **`main` 上还没有这条链路。** `liuyao-relations.js` / `liuyao-verdict.js` /
  `liuyao-features.js` 都只在这个分支上 —— 线上真实用户起的那一卦里,它们不存在。
- **端到端的前后对比没有。** Cloudflare 预览环境没有 `OPENROUTER_API_KEY`,
  `/api/claude` 在那儿返回 503。这一版的每一处都只在离线验过:
  **没有任何东西证明解读变好了,只证明了它读的那副盘现在是对的、是全的。**
- **四个节点没接线。** `functions/_lib/nodes/prompts.js` 被 0 个文件引用。
- **SOP-3 / SOP-5 那 46 条判据还没打标。** 提示词写好了(`artifacts/打标-*.md`),没跑。

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
