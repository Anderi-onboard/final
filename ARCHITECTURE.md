# ARCHITECTURE — BourneWise 仓库结构

> 本文管 **仓库**:分支归属、文件权属、发布路径、以及冲突怎么裁。
> `OVERVIEW.md` 管 **系统**:这是什么程序、技术规格、怎么运转 —— 第一次接触先读它。
> `CLAUDE.md` 管 **代码**:设计法则、语气、性能红线。三份都是权威,不重叠。
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

| 分支 | 角色 | 状态(08-21 收盘) |
|---|---|---|
| **`main`** | **生产**,Cloudflare 自动部署 | 唯一真相。已发布 `20260821f` |
| `production` | 已验证版本的**回滚锚点** | ⚠️ **落后 main 73 个提交**,停在 08-15 —— 它现在指向一个很旧的版本,见 §5-2 |
| `claude/final-saas-promotion-7nxvjo` | 本会话工作分支 | PR #61、#62 均已合入 main |
| `claude/repo-hygiene-audit` | 分支卫生审计 | ✅ 结论已并入 §2.5 B / B.1 / C,**可删** |
| `claude/texture-and-craft-audit` | 纹理审计 | ✅ 零独有提交,**可删** |
| `claude/bournewise-handoff-priorities-19xcmh` | 仅一条 RELEASES 记录 | 待合或丢弃 |
| `codex-creem-integration` | codex 工作分支 | 基线陈旧(见 §1.5)。⚠️ 08-24 核对:`chooseUiAccent()` **在这条分支里并不存在**,这条待办从写下起就是空的。分支仍有 26 个文件的独有内容,归档前得先看那些 |
| `codex` | 07-28 遗留 | **死分支,而且有害** —— 它就是 §2.5 B.1 那个 ref 前缀坑本身 |
| 其余 7 条 `claude/session-*` 等 | 6–7 周前的历史会话 | **死分支** |

---

## 1.5 · 仲裁规则(先读这条,其余都从它推出来)

> **以最新为准 —— 但"最新"指 `main` 上的最新,不是任何分支上时间戳最新的那个提交。**

判断哪个版本算数,看的是**基线**,不是时间戳:

- 从最新 `origin/main` 分叉、做完再合回来的提交 —— 它是**后继**,它算数。
- 从一个陈旧基线上推出来的提交 —— 它是**分叉**,时间戳再新也不算数。
  它没有看见 main 上已经发生的事,所以它"改"的是一个已经不存在的版本。

**当前的具体裁定:codex 的 `ad42888`(08-21)不算最新。**
它推的时间比 main 的 `eb102de`(08-20)晚一天,但它的基线是 08-15、落后 38 个提交。
它不是在 main 之后,它是在 main 旁边。**所以 §2 里凡是它和 main 冲突的地方,一律 main 赢** ——
不是因为 main 更好,是因为它根本没参与那场对话。

⚠️ **这不是在怪 codex。** 一个 agent 只能看见它基线上的东西。
**规则的意义是让"看不见"不再发生**,见 §2.5 的协议。

### 分支规矩

1. **`main` 是唯一发布源。** 任何人(含 Claude / codex)**不得直接 push `main`**,只走 PR。
2. **一个会话一条分支。** 不同会话不得共用工作分支。
3. **开工前 `git fetch origin main` 并从最新 `origin/main` 分叉;提交前再合一次。**
   这条不是形式主义,是这次全部返工的根因。
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

## 2.5 · 多 agent 协作协议

这一节是**可执行的**。每条都对应一个真实出过的事故,不是通用建议。

### A · 开工前(四条命令,不许跳)

```bash
git fetch origin main
git log --oneline -15 origin/main          # 别人这两周做了什么
git rev-list --count HEAD..origin/main     # 我落后多少 —— 不是 0 就先合
cat ARCHITECTURE.md CLAUDE.md              # 已裁决的事不要重裁
```

**落后 `origin/main` 超过 0 个提交就先合,再开工。** 落后 38 个提交时开工的代价这次量到了:
613 行 `document-pages.css` + 一整套 id 方案,全部作废,因为 main 上已经有了答案。

### B · 认领(开工第一件事,写进 PR 描述)

**声明你要碰哪些文件。** 不需要锁,需要的是**可见**。
两个 agent 同时重建同一条路由,是因为谁都不知道对方在做。

| 表面 | 一次只应有一个 agent | 理由 |
|---|---|---|
| `tokens/*.css` 的某一条路由 | 是 | 材质系统整体一致,拆着做必然打架 |
| `assets/palettes/color-groups.json` | 是 | 整体替换语义,合并没有意义 |
| `assets/backgrounds/mountain-range.js` | 是 | 引擎 |
| `functions/**` | 是 | 计费与提示词,错了要花钱 |
| 单个页面的内容文案 | 否 | 可并行 |

**按领域的主责**(来自 `claude/repo-hygiene-audit`,08-16。那次审计统计了 8-10 到 8-15 的
72 个提交:**十个 HTML 各被改了 40+ 次,纹理系统 5 天里被推翻 6 轮**
「纸纹 → 强化 → 关闭 → 宝相花 → 莲芡 → 退役 → 再修」。
**原因不是谁做错了,是没人知道哪块归谁。**):

| 区域 | 主责 | 其他会话动之前 |
|---|---|---|
| `tokens/*.css` · `assets/textures/` · `assets/palettes/` · `assets/backgrounds/` | 视觉会话 | 先在 PR 里说明 |
| `prompt-*.js` · `liuyao-ai.js` · `eval/` | 解读会话 | 先在 PR 里说明 |
| `functions/` · `schema.sql` · 计费 | 后端会话 | 先在 PR 里说明 |
| `*.html` 的结构与文案 | 谁开工谁认领,**PR 标题写明动了哪几页** | — |

**同一个视觉决定(纹理、配色、字体)只能有一个来源。** 拿不准就问 owner,不要各改各的 ——
互相覆盖的代价远高于等一次确认。

### B.1 · ⚠️ 分支名不能是另一条分支的前缀

git 的 ref 是文件系统路径,同一个名字**不能既是文件又是目录**。仓库里存在分支 `codex` 时,
`codex/creem-integration` 永远创建不了:

```
fatal: cannot lock ref 'refs/heads/codex/creem-integration':
       'refs/heads/codex' exists; cannot create 'refs/heads/codex/creem-integration'
```

**8-10 到 8-15 那几天"云端和本地不同步"的全部原因就是这个**:codex 本地一直用
`codex/creem-integration`,推不上去,于是远端改叫 `codex-creem-integration` ——
本地和远端从此指向两条不同的分支,`git pull` 拉回来的不是自己刚推的东西。

- 用 `claude/xxx` / `codex/xxx` 这种带斜杠的命名时,**不得同时存在裸的 `claude` / `codex` 分支**。
  ⚠️ 仓库里**现在仍有一条裸 `codex` 分支**(07-28,落后 77 个提交),它就是那个坑本身。
- push 被拒时先看错误是不是 `cannot lock ref`。**是的话去删掉冲突的父级分支,不要改名绕过** ——
  改名会制造两条同名不同物的分支,比原问题更难查。

### C · 提交前

```bash
git fetch origin main
git rebase origin/main        # 分支还没推过 → rebase
git merge  origin/main        # 分支已推过 / 已开 PR → merge
for t in tests/*.mjs; do node "$t" || echo "FAIL $t"; done   # 必须全绿
```

**rebase 还是 merge,看这条分支有没有被别人看见过:**
- **没推过、没开 PR** → `rebase`,历史干净,不留无意义的合并点。
- **已推过或已开 PR** → `merge`。rebase 会改写已发布的提交,必须 force-push,
  而 PR 上的评审、行号、CI 记录会全部错位。这时"干净的历史"是拿别人的上下文换来的。

⚠️ **`claude/repo-hygiene-audit` 那条只写了「用 rebase」,照做会砸掉已开的 PR。**
真正要避免的不是 merge 这个动作,是它下面那件事:**同一条分支活五天、往里灌四次 `main`,
同一批冲突被重解四次**(8-14 一天出现 5 个 merge commit,两个标题就在处理冲突后果)。
**解法是分支不过夜,不是换命令。**

构建标签全站 + `version.json` bump 到同一个新值(`tests/build-tag.mjs` 守着)。

### D · 合并时的三个机械陷阱(三个都踩过)

1. ⚠️ **`git checkout --ours -- <file>` 取的是整个文件,不是那个冲突块。**
   它会把对方在**同一文件里已经干净合并**的改动一起丢掉。
   这次第一遍就这样弄丢了 main 的 `segmentOrder`。
   **要么逐块解,要么先确认对方在该文件里零实质改动。**

2. ⚠️ **删除会静默合并。** 你的分支删了某文件、对方没碰它 → git 判定"删除"胜出,**不报冲突**。
   这次 `color-groups-180.json` 就是这么丢的 —— 而且我上一轮刚说过要留它。
   **合并后必须跑这条对账:**
   ```bash
   comm -23 <(git ls-tree -r --name-only origin/main | sort) \
            <(git ls-tree -r --name-only HEAD | sort)
   ```
   列出来的每个文件都要能说出"我是有意删的,理由是 X"。说不出就是丢了。

3. ⚠️ **冲突块里绝大多数是构建标签,少数是真内容。** 先分类再动手:
   把两侧的标签正规化后比对,相同的机械解决,不同的逐个读。
   这次 30 个块里 23 个是纯标签 —— 不分类就会把 7 个真冲突淹在噪音里。

### E · 交接:**裁决必须和它裁的代码一起进 `main`**

**留在分支上的结论等于没有结论。**

`AUDIT-20260816.md` 论证了光栅纹理为什么在 114 组配色下必然撞色 —— 它只在一条分支上,
main 上没有。于是 codex 在六天后又建了一套光栅纹理系统。**它不是没读文档,是文档不在它能看到的地方。**

所以:**任何 `*.md` 的裁决、审计、规范,和它约束的代码走同一个 PR。**
不允许"代码先进 main,文档留在分支上以后再说"。

### F · 分歧仲裁

两个 agent 给出相反方案时,按顺序问:

1. **谁的基线更新?** 陈旧基线上的方案直接出局(§1.5)。
2. **有没有测试或实测数字支持?** 有的赢。「我觉得更好看」不构成理由。
3. **哪个能让另一个的不变量继续成立?** 例:数字 id 能保住"段是连续区间",管理器 id 不能。
4. **仍然平手 → 停下来问 owner,不要自己选一个然后往下做。**

裁完**写进 §2**,连同理由。理由比结论重要 —— 下一次是新情况,能复用的是理由。

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

1. ✅ **审计文档已进 `main`(08-21)。** `AUDIT-20260816.md` 随 PR #61 上线;
   `claude/repo-hygiene-audit` 的分支卫生结论已并入本文 §2.5 B / B.1 / C;
   `claude/texture-and-craft-audit` 零独有提交,可归档。**两条分支现在都可以删。**
   原文如下,留作为什么要这么做的记录:
   ⭐ **把 `AUDIT-20260816.md` 合进 `main`。**
   §2② 那次返工的**唯一根因**是这份文档只在一条分支上。
   **裁决理由必须和被裁决的代码住在一起**,否则下一个 agent 会再做一次同样的事。
   `claude/repo-hygiene-audit` 和 `claude/texture-and-craft-audit` 同理 —— 两份审计都没进 main。
2. **`production` 落后 main 37 个提交**,停在 08-15。作为回滚锚点它现在指向的是一个很旧的版本。
3. **决定 `codex-creem-integration` 怎么处理。** 它只有 1 个独有提交,里面有两样值得留的:
   - ✅ `artifacts/palette-recovery-*.json` —— **08-21 已取回**(见 §3),溯源已核对
   - ❌ `chooseUiAccent()` —— **这个函数不存在。** 08-24 在 `codex-creem-integration` 和 `codex`
     两条分支里都 grep 过,零命中;main 里也没有。这条待办挂了几天,指向的是一个从未被写出来的东西。
     ⚠️ 教训和别处一样:**待办里写别的分支有什么,要先去那条分支上确认。** 转述会变成事实。
     真要这个能力,是重新写一个,不是"取过来"
   其余(`document-pages.css`、id 放宽)按 §2 已裁掉。**取完第二样即可归档该分支。**
4. **清理 9 条死分支**(落后 77 个提交、6–7 周未动)。
5. **CLAUDE.md §2 架构图过期**:它把 `styles.css` 和 `prompt-engine.js` 列在仓库根目录,
   两个都已不在那里(前者不存在,后者在 `functions/_lib/`)。
6. **样式表归属:已量化并钉住,退役待做。**(08-21 更新,原记"21 个元素",实测是 **35 个**)
   `luxury-glass.css` 才是玻璃路由的实际所有者(127 胜 / refinement 61 胜),
   而 CLAUDE.md 说玻璃定义在 refinement —— **文档指错了家,所以改了没效果**。
   它 495 个「选择器×属性」里 **372 个(75%)从不获胜**,但**不能机械删除**:
   测量看不到交互后才存在的浮层与 `:hover/:focus/:active`。
   `tests/style-ownership.mjs` 已上:两张遗留表只许变小,路由的样式表集合不许再加,
   色块路由不许沾这三张表。**下一步是逐状态截图核对后分批退役**,
   目标是 `legal.css` 那个形状:一条路由一张表,20 胜 0 负。
7. 约 **9 处**真正裸写的颜色声明待清(`luxury-glass.css` 7 / `refinement.css` 2)。原来记的 47 处里,大部分是 `var(--token, #hex)` 兜底值和令牌定义 —— 都是合法写法;`poster-pages.css` 整份退役后又去掉一批。

---

## 5.5 · 解读管道待办(2026-09-01,一次会话累积)

起因是一卦断错:「我明天考科目一能过吗」判「能过」,实际未过。查下来根因不在提示词,
在 `chat-app.js` 写死的 `category:"general"` —— 用神恒为世爻,与所问何事无关(已修,见
`tests/yongshen-assignment.mjs`)。以下是这轮查出来、尚未做的事。

### A · 只有 owner 能做(挡着后面全部)

1. ⭐ **预览环境配 `OPENROUTER_API_KEY`**。D1 绑定与 `SESSION_SECRET` 已配好,
   `register` 返回 200,`/api/claude` 仍 503。
   `npx wrangler pages secret put OPENROUTER_API_KEY --project-name bournewise --env preview`
   **在此之前,所有提示词改动只在离线层面验证过** —— 没有任何东西能证明它们让解读变好。
2. **吊销那个贴进对话的 Cloudflare API token**(`cfat_Wb1q…`)。
3. **预览的 D1 目前指着生产库** `2f7b49f1-…`。任何分支的预览部署都能注册账号、花钱、写真实账本。
   要隔开:`wrangler d1 create bournewise-preview` + `d1 execute --remote --file=./schema.sql`,
   把新 id 给下一个会话改绑定。(这轮验证已往生产库写了若干 `cfg*@example.com` 测试账号。)
4. **裁决:卦身与六神留不留。** 《增删卜易》主张整个剔除(只保留贵人/禄神/驿马/天喜四种星煞,
   且必须附和用神旺相);我们现在是降权保留。删掉会明显改变解读质感。
5. **PR #82 未合。** CI 全绿,无冲突。

### B · Opus 5 专属,来自 `claude-api` 技能(2026-09-01 核对)

⚠️ 我们走 OpenRouter 不是 Anthropic 原生 API,参数级差异可能被上游吸收;**模型行为层面照样成立**。

6. ⭐ **`voice` 段里有一条 don't-reason 规则,删掉。** Opus 5 关掉 thinking 有两个故障模式
   (工具调用写进可见正文、`<thinking>` 标签漏进回复),而官方明写
   「delete any don't-think/don't-reason rule (it makes tag leakage worse)」。
   我们同时做了这两件加剧泄漏的事。**这条现在就能做,零风险。**
7. **thinking 由 disabled 改成 adaptive + `output_config.effort: medium`。**
   `claude.js:209` 那段注释里的测量是真的(thinking 吃掉 9–11k 预算、截断、账单翻倍),
   但关掉是被劝阻的解法;推荐解法是保持 adaptive 而降 effort。要回路才能量。
8. **`temperature` 在 Opus 5 上已移除**(原生 API 返回 400)。而「再起一卦」正发 `temperature≈1`
   (`chat-app.js:1280` → `claude.js:225`),CLAUDE.md §6 也写着「temperature 拉满」。
   **那个杠杆不存在了** —— 重摇的新鲜感实际只来自新的硬币投掷。代码和 §6 都要改。
9. **`output_config.effort`** 我们完全没用,默认 `high`。缓存之后的第一位成本杠杆。
10. **Mid-conversation system messages**(Opus 5 支持,无 beta):追问把
    `{role:"system"}` 追加进 `messages[]`,而不是重发整份系统提示词(现在 85,453 字符)。
    保住缓存前缀,且是防注入的操作者通道。
11. **Fast mode**(仅 Opus 5/4.8,$10/$50,输出 2.5×)。一卦现在要 79 秒。
12. **上下文是 1M 不是 200k。** 31.7k 只占 3% —— 成本论点成立,"上下文压力"论点不成立。

### C · 缓存(占首卦成本 56%、追问 73%)

13. `prompt-engine.js:53` 声称「each segment is static → prompt caching applies」,
    **全仓库没有一处 `cache_control`**。渲染顺序 `tools → system → messages`,最多 4 个断点,
    最小可缓存前缀 512–4096 token(我们远超)。用 `usage.cache_read_input_tokens` 验证。
14. **选 TTL 之前先量 D1 里的追问间隔分布。** 5 分钟档一次会话降 33%,
    1 小时档在只追问一次时**净亏**。

### D · 评估(所有后续路线的共同前置)

15. ⭐ **卦例评估集。** `eval/cases.json` 只测路由分类,解读质量一个字不测。
    《增删卜易》体例记结果,是天然的标注数据。打标规范 v2 在 scratchpad,
    分工是:廉价模型只照抄,引擎补齐在场信号,**权重由「在场集 − 引用集 + 明确降权」算出来**,
    不由模型总结(v1 让模型判断,产出是机械总结)。
16. **噪声底线**:同一副盘同一版本跑两遍差多少。不知道这个数,任何前后对比都读不了。
17. **判词方向核对**(Turpin 风险)。让模型写出用神指派,不保证判词由它决定 ——
    CoT 会系统性误报真实推理。需要外部核对:判词极性 vs 用神状态,不一致就报。
18. 有了 15/16 才谈得上 DSPy(它唯一的前置条件就是指标)。

### E · 前端遗留

19. `xrMaybe()` 三处:chip 取每个 facet 第一项读起来像随机词表;排序用类象库顺序而非路由顺序
    (感情问题会冒出「竞品」);`{子水|子}` 这类循环标记仍在,`xiang-trace` 抓不到。
20. `production` 镜像落后 main 很多。

---

## 6 · 给下一个 agent 的四条

1. **开工前先 `git fetch origin main` 看别人做了什么。** 这次两个 114 组色卡、
   两套相反的路由材质,全部出自"没看最新 main 就开工"。
2. **合并后跑一次文件对账**(§2.5 D-2)。删除不报冲突,会静默生效 ——
   本文作者就在写这份文档的同一次合并里丢掉了 `color-groups-180.json`,
   而且是在上一轮刚说过"要留着它"之后。**说过要留,不等于留住了;要量。**
3. **"改了没效果"永远先量 `getComputedStyle`,不要加大数值。**
   历史上每一次都是另一个样式表在抢同一个元素,不是数值不够。
4. **文档和它裁决的代码必须一起进 main。** 留在分支上的结论等于没有结论。
