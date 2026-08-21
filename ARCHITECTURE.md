# ARCHITECTURE — BourneWise 仓库结构

> 本文管 **仓库**:分支归属、文件权属、发布路径、以及冲突怎么裁。
> `CLAUDE.md` 管 **代码**:设计法则、语气、性能红线。两份都是权威,不重叠。
> 冲突时:本文 > CLAUDE.md > 代码注释;但**任何一份与代码不符,都以代码为准并回来改文档**。
>
> 建档日期 2026-08-21。建档原因:三个 agent 在同一个仓库上并行推了两周,
> 出现了两份互不知情的 114 组色卡、两套针对同一批页面的相反材质系统、
> 以及一条"以谁为准"没人写下来过的模糊地带。

---

## 1 · 谁在推,推到哪

仓库里有**三个执行者**,git 作者名不能直接对应到人:

| 作者名 | 实际是谁 | 说明 |
|---|---|---|
| `Claude` | Claude Code 会话 | 每个会话一条 `claude/*` 分支 |
| `808andrei909` | owner 本机 git(codex CLI 提交) | 推 `codex*` 分支 |
| `Anderi-onboard` | owner 的 GitHub 账号 | 网页端合并提交、PR 操作 |

⚠️ **`808andrei909` 和 `Anderi-onboard` 是同一个人的两个身份**,不是两个贡献者。
按作者名统计分支归属会得到错的结论。

### 分支表(2026-08-21 实测)

| 分支 | 落后/领先 main | 角色 | 状态 |
|---|---|---|---|
| **`main`** | — | **生产**,Cloudflare 自动部署 | 唯一真相 |
| `production` | 37 / 1 | 已验证版本的**回滚锚点** | 停在 08-15,**不是日常入口** |
| `claude/final-saas-promotion-7nxvjo` | 0 / 28 | 本会话工作分支 → PR #61 | 已合 main,可合并 |
| `claude/bournewise-handoff-priorities-19xcmh` | 0 / 1 | 仅一条 RELEASES 记录 | 待合或丢弃 |
| `claude/repo-hygiene-audit` | 37 / 1 | 分支卫生审计文档 | **文档未进 main** |
| `claude/texture-and-craft-audit` | 37 / 1 | 纹理审计文档 | **文档未进 main** |
| `codex-creem-integration` | 38 / 1 | codex 工作分支 | 基线陈旧,见 §2 |
| `codex` | 77 / 90 | 07-28 遗留 | **死分支** |
| 其余 7 条 `claude/session-*` 等 | 77 / 27–101 | 6–7 周前的历史会话 | **死分支** |

### 规矩

1. **`main` 是唯一发布源。** 任何人(含 Claude / codex)**不得直接 push `main`**,只走 PR。
2. **一个会话一条分支。** 不同会话不得共用工作分支。
3. **开工前 `git fetch origin main` 并从最新 `origin/main` 分叉;提交前再合一次。**
   codex 这次的 `ad42888` 就是**基于 6 天前的基线**推的,落后 38 个提交,
   于是重做了一遍 main 上已经做完的事(见 §2)。这条不是形式主义,是这次全部返工的根因。
4. **`production` 用普通 merge commit 镜像,不得 squash / rebase / force-push。**
5. **死分支不要复活**,需要里面的东西就 cherry-pick 单个文件。

---

## 2 · 已裁决的矛盾

这一节记录**两个执行者对同一问题给出相反答案**的地方,以及裁决理由。
以后遇到同类问题,按同样的理由裁。

### ① 色组 id:数字重编 vs 保留管理器 id —— **裁定:数字重编(main)**

两边**颜色完全一致**:81 个共有 id 的 `rows` 逐一相同,33 组自定义的 `rows` 集合相同,
`seg` 33/33 相同,名称 32/33 相同。**唯一分歧是 id 命名。**

| | main (`eb102de`) | codex (`ad42888`) |
|---|---|---|
| 自定义组 id | 重编为 `181–213` | 保留 `CMSPYGJAT` 等管理器 id |
| `palette-contract` | 保持 `/^\d{3}$/` | 放宽为 `/^(?:\d{3}\|C[A-Z0-9]+)$/` |

**裁定理由**:main 还加了「每个段必须是连续 id 区块」的断言,`CMSPYGJAT` 永远满足不了。
段序、段区间、以及色卡管理器都依赖 id 可排序。**两条不能共存,连续区间的价值更高。**
原始管理器 id 已记录在 CLAUDE.md §11,没有信息丢失。

### ② 三条内容路由的材质:生成式母题 vs 光栅纹理 —— **裁定:生成式(本分支)**

codex 的 `tokens/document-pages.css`(613 行,新增)和本分支的
`blocks.css` / `method.css` / `legal.css` **针对完全相同的三条路由**
(`about` / `guide` / `legal`),用**相反的材质系统**:

| | codex `document-pages.css` | 本分支 `blocks.css` 等 |
|---|---|---|
| 底 | `--soft-peach-cream #FFE096` 锁死 `!important` | `--bk-*` 色块调色板 |
| 纹样 | `.lq-texture-layer` 光栅贴图 | `marks.js` 参数生成,走 `currentColor` |

**裁定理由**:CLAUDE.md 已写明 Soft Peach 锁死是全站发黄的病根
(实测面板合成色 |R−B| 均值 68 / 最大 89),且**CSS `url()` 里的贴图读不到色组变量,
114 组配色下必然撞色**。

⚠️ **但这不是 codex 的错。** 论证这两条的 `AUDIT-20260816.md` **只存在于本分支**,
main 上没有,所以 codex 无从知道。**这才是真正要修的东西**:见 §5 第 1 条。

### ③ `window.BW_BUILD`:字面量 vs 推导 —— **裁定:推导**

main 的 `tests/build-tag.mjs` 要求 `BW_BUILD` 是字面量并与 `version.json` 相等;
本分支改成从页面自己的 `?v=` 标签推导。

**裁定理由**:字面量是**第二个手工维护的标签**,它已经漂过一次(落后两个版本,
导致每个新会话都被判为过期)。**推导让"不一致"从构造上不可能发生**,比"用测试抓不一致"强。
测试已更新为两种写法都接受,推导形式只断言推导存在(运行时计算的值,比对字面量没有意义)。

### ④ CLAUDE.md 里两条**代码从未实现**的规范 —— **已删除**

- 「撞色偏置:对比带与主色相 HSV 距离 > 40° 优先入池」
- 「近白 / 彩色 1:1 交替」

两次核对(08-20、08-21)`buildPaletteSchedule` 里都**没有任何相关逻辑**。
按 CLAUDE.md 自己的规矩(以代码为准)删除。
**教训:规范写了但没实现,比没写更糟 —— 下一个人会以为它在跑,并在它之上做决定。**

---

## 3 · 文件权属

判断一个文件能不能改、改哪里,先看它属于哪一类。

### A. 权威源(手写,唯一真相)

| 文件 | 管什么 |
|---|---|
| `CLAUDE.md` | 设计法则 / 语气 / 性能红线 |
| `ARCHITECTURE.md` | 本文:仓库结构 |
| `assets/palettes/color-groups.json` | **114 组色卡** —— 由 `palette-guide.html` 管理器整体替换,**不是打补丁** |
| `account.js` | 账户 / 点数 / 历史的**单一数据源**(`BWAccount`) |
| `functions/_lib/prompt-engine.js` | 解读语气引擎(**服务端**,08-14 安全审计后移入) |
| `tokens/*.css` | 设计令牌与各路由样式 |
| `version.json` + 全站 `?v=` | 构建标签,**必须同步** |

### B. 生成物(不要手改,改生成器)

| 文件 | 生成器 |
|---|---|
| `copywriting/*_DECK.md` | `copywriting/generate-*-deck.mjs`(且已 gitignore) |
| 色块路由的全部图案 / 山景 / 标记 | `assets/marks.js` → `assets/blocks.js` |
| `artifacts/*` | 恢复与 QA 产物,只读留档 |

#### 色卡溯源档(`artifacts/palette-*`,08-21 从 codex 分支取回)

owner 在本机改的色卡曾经找不到,由 codex 从
`Chrome Default/Local Storage/leveldb` 恢复。**这是 114 这个数字的唯一来源证明**,
已核对:恢复档 114 组与线上 `color-groups.json` **颜色集合逐一相同**。

| 文件 | 内容 |
|---|---|
| `palette-recovery-full-2026-08-12.json` | 完整快照:官方 180 → 删 99 → 留 81(**其中 24 组被 owner 改过**)+ 自定义 33 = **114** |
| `palette-recovery-latest-2026-08-13.json` | 08-13 替换自定义清单后的状态(自定义 1 组,合计 82) |
| `palette-cache-history.json` / `palette-chrome-cache-history.json` | 管理器缓存变更史 |
| `color-groups-recovered-114.json` | 恢复出的目录,保留原管理器 id |

⚠️ **不要用这些文件覆盖 `color-groups.json`** —— 它们保留的是管理器 id(`CMSPYGJAT`),
线上用的是重编后的 `181–213`(§2①)。它们的用途是**溯源和对账**,不是发布源。

### C. 已死(存在但没有任何代码引用 —— 不要在上面加功能)

| 文件 | 状态 |
|---|---|
| `liuyao-chart.js` | 只 publish 一个没人调用的全局;script 标签已移除,文件保留 |
| 色卡的 `pattern` / `harmony` / `families` / `breaks` 字段 | **实测引用 0 次**,纯管理器元数据 |
| `functions/**/lemonsqueezy*` | 支付已改 Creem,**不要用它** |
| `assets/fonts/Fraunces-*`、`BioRhyme-400/700/800` | 违禁字体 / 已被可变字体取代 |

### D. 必须挡在公网外(`_redirects`)

`PROGRESS.md` · `AUDIT-*.md` · `CLAUDE.md` · `RELEASES.md` · `copywriting/*` ·
`eval/*` · `tests/*` · `scripts/*` · `artifacts/*` · `tools/*` ·
`palette-guide.html` · `palette-overview.html` · `baoxianghua-compositions.html`

⚠️ **新增本文件后,`ARCHITECTURE.md` 也必须加进这份名单**(已加)。
判据很简单:**它是不是一张"这个站哪里薄弱"的地图?** 是就挡掉。

---

## 4 · 发布路径

```
claude/* 或 codex-*  ──PR──▶  main  ──自动部署──▶  生产
                                │
                                └──普通 merge──▶  production(回滚锚点)
```

每次改 HTML / CSS / JS **必须**:

1. 全站 `?v=` 与 `version.json` bump 到**同一个新标签**(`tests/build-tag.mjs` 守着)
2. `for t in tests/*.mjs; do node "$t"; done` —— **17/17 通过**
3. 改布局就量几何、改动画就采样;**截图前禁用缓存**
4. 发布记录写入 `RELEASES.md`:构建标签、视觉来源提交、功能提交、验证证据

### 现有测试(17 条,全部必须绿)

`billing-contract` · `board-distill` · `build-tag` · `followup-axes` ·
`free-reading-contract` · `language-purity` · `palette-contract` · `prompt-coverage` ·
`prompt-secrecy` · `rates-contract` · `request-contract` · `session-contract` ·
`stream-recovery` · `texture-contract` · `token-cap` · `upstream-error` · `xiang-trace`

---

## 5 · 待办(按优先级)

1. ⭐ **把 `AUDIT-20260816.md` 合进 `main`。**
   §2② 那次返工的**唯一根因**是这份文档只在一条分支上。
   **裁决理由必须和被裁决的代码住在一起**,否则下一个 agent 会再做一次同样的事。
   `claude/repo-hygiene-audit` 和 `claude/texture-and-craft-audit` 同理 —— 两份审计都没进 main。
2. **`production` 落后 main 37 个提交**,停在 08-15。作为回滚锚点它现在指向的是一个很旧的版本。
3. **决定 `codex-creem-integration` 怎么处理。** 它只有 1 个独有提交,里面有两样值得留的:
   - ✅ `artifacts/palette-recovery-*.json` —— **08-21 已取回**(见 §3),溯源已核对
   - ⬜ `chooseUiAccent()` —— 用实测对比度挑 UI 强调色,比写死 `gems[0]` 好,**尚未取**
   其余(`document-pages.css`、id 放宽)按 §2 已裁掉。**取完第二样即可归档该分支。**
4. **清理 9 条死分支**(落后 77 个提交、6–7 周未动)。
5. **CLAUDE.md §2 架构图过期**:它把 `styles.css` 和 `prompt-engine.js` 列在仓库根目录,
   两个都已不在那里(前者不存在,后者在 `functions/_lib/`)。
6. **21 个元素被 3–4 个样式表同时上色**(login `.card`、settings `.panel` 被四个)。
   这是每一次"改了没效果"的根源。
7. 约 47 处裸 hex 待清(`refinement.css` / `poster-pages.css` / `luxury-glass.css`)。

---

## 6 · 给下一个 agent 的三条

1. **开工前先 `git fetch origin main` 看别人做了什么。** 这次两个 114 组色卡、
   两套相反的路由材质,全部出自"没看最新 main 就开工"。
2. **"改了没效果"永远先量 `getComputedStyle`,不要加大数值。**
   历史上每一次都是另一个样式表在抢同一个元素,不是数值不够。
3. **文档和它裁决的代码必须一起进 main。** 留在分支上的结论等于没有结论。
