# BourneWise — 进度与修改历史 (Progress & Change Log)

> 本文件追踪开发进度、修改历史，以及**待完成的任务**。
> 当前阶段：**字体已锁定为仅 BioRhyme / Spinnaker / Pacifico 三种，禁止出现任何其他字体**。
> 其余美术（排版比例、留白、卦象对齐）仍在后期集中处理之列。

最后更新：2026-07-10

---

## ✅ 已完成 — 部署交接：D1 建库、about.html 重做上线、AI 代理切到 OpenRouter（2026-07-10）

- ✅ 建了生产 D1 数据库 `bournewise`，`wrangler.toml` 填入真实 `database_id`，
  `schema.sql` 已对远程库执行（`users`/`ledger`/`castings`/`rate_limits` 四表就绪）。
- ✅ 落地了 about.html 的视觉重做（去侧边栏、山脉背景贴边铺满、新配色、环境动效层）。
- ✅ `functions/api/claude.js` 从直连 Anthropic 改为经 **OpenRouter** 调用 Claude
  模型：请求体从 Anthropic 原生 `/v1/messages` 形状改为 OpenAI 兼容的
  `/chat/completions` 形状（`system` 并入 `messages`，非流式响应从
  `choices[0].message.content` 取文本）；流式路径把 OpenRouter 的
  `choices[].delta.content` 分片重新编码成客户端 `prompt-router.js` 已经在解析的
  Anthropic 风格 `content_block_delta` 事件，**前端解析逻辑完全没动**。环境变量
  从 `ANTHROPIC_API_KEY` 改名为 `OPENROUTER_API_KEY`；模型 id 换成 OpenRouter 的
  vendor-prefixed slug（如 `anthropic/claude-sonnet-4.6`），旧的 Anthropic 原生 id
  仍保留在 `ALLOWED` 别名表里做兼容。`eval/run-eval.js` 的 Router 校验同步改造。

## ✅ 已完成 — 生产就绪审查修复：API 防刷、多轮记忆、Gate 正则 bug、Eval 库（2026-07-03，第四轮）

针对用户提出的 7 点生产就绪审查逐条核实后落地的修复（非全部照单全收，先对照真实代码验证再动手）：

- ✅ **API 盗刷漏洞已关闭**：`/api/claude` 新增 `guardRequest()`，在生成调用内联做
  会话校验 + 服务端权威计费 + 限流。Sortis（Opus）此前完全靠前端信任，现在
  未登录/非 Pro-Premium 一律拒绝；扣费改为"先扣后退款"原子模式，失败自动退回。
  匿名 Stria 访客仍可免登录试用（保留产品设计），但新增按 IP 的窗口限流兜底
  （`functions/_lib/db.js` 新增 `bumpRateLimit()`，`schema.sql` 新增 `rate_limits` 表）。
  过程中发现并修复了两处会让新网关形同虚设的隐藏 bug：`ds-base.js` 与
  `prompt-router.js` 的 fetch 调用都缺了 `credentials: 'same-origin'`，会话
  cookie 从未真正发出去；`account.js` 里原有的客户端 `/api/account/spend` 调用
  会与新的服务端扣费重复扣款，已移除，改为从服务端响应里回写权威余额。
- ✅ **多轮对话失忆已修复**：`chat-app.js` 新增 `buildHistory()`，追问时把最近
  几轮对话（截断长度）拼进 `messages`，而不是只发当次问题；`prompt-router.js`
  的 `interpretWithRouter()` 相应支持 `history` 参数（含 QC 重试路径）。用
  Playwright 浏览器测试验证了追问请求里确实带上了首轮问题 + 助手回复。
- ✅ **发现并修复 Gate 正则的真实生产 bug**：JS 正则 `\b`（单词边界）只认
  ASCII `\w`，永远不会在中文字符两侧命中——原 `CRISIS_PATTERNS` /
  `MINOR_PATTERNS` 把中文关键词包在 `\b(...)~\b` 里，等于中文一侧的危机/未成年
  检测从写下那天起就从未真正生效过（这个 bug 早于本轮会话就存在）。已拆分：
  中文词改为不加边界的子串匹配，英文词保留 `\b`。另外补上两个 eval 跑出来的
  真实缺口：`jump off` 未覆盖 `jumping off` 变形；中文有"14岁+喜欢"组合判断，
  英文原来完全没有对应的"15 year old + crush"逻辑，已补上。
- ✅ **新建 Eval 回归库**（用户 7 点审查里的第 7 条）：`eval/cases.json`（Gate
  14 例 + Router 10 例）+ `eval/run-eval.js`（可执行，离线跑 Gate，
  有 `ANTHROPIC_API_KEY` 时额外跑真实 Haiku 校验 Router）。修复后
  `node eval/run-eval.js` → Gate 14/14 (100%)。以后改 `prompt-engine.js`
  必须先跑这个脚本。
- ⏸️ **尚未处理**（已评估为有效但范围较大，待排优先级）：流式 SSE 输出
  （降低串行三段管线的感知延迟）、QC 阶段对照原始卦盘 JSON 做幻觉抵抗正则
  校验、i18n 从硬编码 zh/en 改为 Router 阶段动态语言检测。
- ⏸️ **待办**：两份 prompt-inspector Artifact（中英文）里嵌的 `CRISIS_PATTERNS`
  / `MINOR_PATTERNS` 还是本轮修复前的旧版，需要手动同步。


## 当前状态总览

| 模块 | 状态 | 验证 |
|------|------|------|
| 计费体系（Free/Pro/Premium，单位制） | ✅ 完成 | — |
| 单一数据源架构（account.js / BWAccount） | ✅ 完成 | 无重复逻辑 |
| 排盘引擎（六爻 liuyao-engine） | ✅ 正确 | 自测 12/12 + 集成测试 |
| AI 后端代理（模型路由 stria→Sonnet / sortis→Opus） | ✅ 完成 | 调用序列验证 |
| 模块化 prompt 管线（Gate→Route→Prompt→QC） | ✅ 修复并跑通 | 修了静默退回 legacy 的 bug |
| 账户后端（D1 + 会话 + OAuth + 账本 + 历史） | ✅ 完成 | 后端单测 17/17 |
| 前端同步层（hydrate / spend 镜像 / 历史同步） | ✅ 完成 | 浏览器集成测试通过 |
| **聊天页排版/对齐** | ⚠️ **凌乱，待重做** | 见 TODO |
| 真实支付（Stripe） | ⛔ 未做（stub） | — |

---

## ✅ 已完成 — 字体强制锁定为三种 + 撤回过度实验（2026-06-30, 第三轮）

按用户反馈执行：

- ✅ **全站字体只保留 BioRhyme（衬线/标题）/ Spinnaker（无衬线/正文/UI）/
  Pacifico（品牌）**。扫描并重写了 12 个文件里的所有 `font-family` 声明——
  不允许出现 Inter、Lora、Fraunces、Rubik、IBM Plex Mono、Sawarabi Mincho、
  Bree Serif 等任何其他字体。`tokens/paper.css`、`tokens/typography.css`、
  `tokens/fonts.css` 三处字体变量定义同步收口，`<link>` 字体加载精简到一行。
- ✅ **撤回空状态留白实验**：问候语挪回原来的垂直居中位置（不再贴底），
  logo mark 尺寸复原。用户反馈"这样反而更空"——已撤回，改为下方"留白建议"清单。
- ✅ **山脉背景调回克制**：透明度 .92→.72 复原，drift 变化范围加宽但配色仍在
  纸感暖调内，不鲜艳、不喧宾夺主。
- ⏸️ **Claude 字体系统（Inter/Lora）已作废** —— 用户明确要求改用品牌三字体，
  上一轮的 Inter/Lora 方案不再采用。

> 事故记录：本轮开始时容器重启，本地 git 分支曾错误回退到旧提交（`befbf10`），
> 与远程 `098f8dc` 不一致。已通过 `git fetch` + `git reset --hard origin/...`
> 校正到远程最新状态后再继续，未丢失已推送的工作。

### 💡 留白问题的创造性建议（未采纳任何一条，留给你选）

问候语贴底 + composer 的方案已撤回。以下是几个不同方向，供挑选或组合：

1. **卦象常驻空状态**：空状态背景里浮现一个极淡、缓慢呼吸动画的静态卦象轮廓
   （比如坤卦六道虚线），作为品牌视觉锚点，而不是纯文字+山脉。
2. **最近历史卡片化**：把左侧"Recent inquiries"改造成空状态主区域里的几张
   小卡片（3 条最近提问的摘要+日期），横向排开在问候语下方——把留白变成"继续
   上次对话"的入口，兼顾老用户召回。
3. **每日一问/灵感签**：空状态中央放一条每次刷新都换的精选问题范式（不是
   4 个 chip 全部铺开，而是单条大字展示，点击即用），配合已有的打字机效果
   input placeholder，减少视觉元素但增加互动感。
4. **不对称构图**：问候语不必居中，可以左对齐贴齐 composer 的左边缘，右侧
   留给山脉延展——制造"留白是构图的一部分"而非"内容不够撑场"的观感。
5. **缩小整体留白区**：不动内容位置，而是给 `.thread` 一个更保守的
   `min-height`（比如根据视口高度打个折扣），让空状态整体更紧凑，composer
   离顶部内容更近，物理上减少留白面积。

---

## 修改历史 (Change Log)

按提交倒序，最新在上。

| Commit | 内容 |
|--------|------|
| `4489d4d` | 真实账户后端：D1 持久化、签名会话、OAuth、账本、历史；前端同步层 |
| `fd47e60` | 后端完善：按意图路由模型、修复 Sortis 管线静默退回 bug、本地 dev 配置 |
| `c765b64` | 聊天布局向 Claude 比例对齐；修复空状态示例 chip 不显示 |
| `befbf10` | 聊天排版改为 Claude 式层次（Lora 正文 / BioRhyme 标题 / Spinnaker 标签） |
| `7cc6397` | 加 package.json + dev 脚本 |
| `6273acc` | UX 优化：修空状态、清字体臃肿、单条投卦删除 |
| `42b4c91` | 修正全站旧套餐名与旧单位成本 |
| `50ac007` | 状态集中到 BWAccount，消除跨文件重复 |
| `e24036f` | 计费重设计：Free/Pro $19/Premium $29，Sortis 300→1500u |
| `7324007` | 模块化 prompt 架构 |

---

## ⚠️ 美术/视觉修改 — 已冻结 (FROZEN)

以下视觉改动**暂停**，等布局问题理清后再统一处理。已落地但未定稿的部分：

- 字体分工：Pacifico（品牌/方法chip）/ Spinnaker（小标签）/ BioRhyme（标题）/ Lora（正文）
- 对话列居中（740px）
- 空状态：问候语 + 示例 chip + 介绍流

---

## 🔴 TODO — 页面凌乱问题（优先）

阅读页（投卦结果）布局**不整齐**，具体问题：

1. **卦象与正文不对齐**：六爻卦象（Resource Earth … SELF/RESP）水平居中浮在上方，
   而 "The reading" 标题和正文却靠左贴边（~480px）——两者没有共享同一条左边缘，
   视觉上图浮文贴，很散。
2. **卦象横向铺得太开**：左侧五行标签 + 中间卦线 + 最右 SELF/RESP 标记，跨度过大，
   中间留白突兀。
3. **卦象上下留白过多**：上卦符号、下卦符号、卦名之间空隙大，整块显得松散。
4. **顶栏标题截断**：对话标题 "Should I take the new role, or stay where …" 生硬截断。
5. **落地页顶栏营销文字（claude-note）偏大**：占顶栏中右，挤。
6. **空状态信息偏多**：问候语 + 4 个 chip + 滚动介绍流，略拥挤，需取舍。

### 建议方向（待确认）
- 统一阅读区为**单一左对齐列**，卦象作为该列内的居中卡片块（明确边界），
  或卦象也左对齐到正文边缘。
- 收紧卦象的横向跨度与上下留白。
- 顶栏标题加省略容器 + tooltip；营销文案缩小或移走。
- 空状态二选一：示例 chip **或** 介绍流，不要同时全亮。

---

## ✅ 已完成 — Claude 字体系统 + 美术修正（2026-06-30, 第二轮）

按用户反馈修正：

- ✅ **背景跟山脉联动**：恢复 bgDrift 跟 mountain-range 的暖/冷/暮相位漂移
  （之前被我锁成纯暖米色，破坏了联动）。暖色基调保留。
- ✅ **品牌粗体**：Pacifico 是单字重，`font-weight:700` 无效 → 加大到 20px +
  `-webkit-text-stroke` 还原粗体感。
- ✅ **空状态留白**：问候语从垂直居中改为靠近输入框（flex-end），与 composer
  成组，消除中间大空隙。Logo mark 缩小到 34px 配合更小的问候语。
- ✅ **Claude 字体系统**（大部分字体 + 比例）：
  - Claude 真用字 Styrene(UI)/Tiempos(正文) 是专有字体；用最接近的免费替代：
    **Inter**(sans) + **Lora**(serif)，品牌保留 **Pacifico**。
  - index 里所有 Spinnaker/BioRhyme/Sawarabi 内联字 → Inter(UI) 或 Lora(标题/正文)。
  - 比例收敛到 Claude 尺度：问候语 54px→clamp(26,38)、阅读标题 25→22px、weight 调轻。

> 待确认：Lora 作为 Tiempos 替代 OK 吗?想要更接近可换 Newsreader / Source Serif。
> 已知（非本次引入）：routed Sortis 主提示返回散文;若线上仍出 JSON 需在 routed
> 路径加 JSON 解析（mock 测试假象，真 key 下应为散文）。

---

## ✅ 已完成 — 美术对齐到目标设计（2026-06-30）

按用户提供的设计稿（Design System 工具里的 index）对齐空状态美术：

- ✅ 背景改暖米色（#F2EDE7，bgDrift 全部暖调；之前是偏冷的 #ECF1F6）
- ✅ 山脉背景更饱和鲜明（opacity .72 → .92）
- ✅ 删掉示例 chips —— 空状态只剩问候语 + 输入框
- ✅ 保留品牌 Pacifico 粗体、顶栏 Claude 说明、轮播 prompt 文案
- ✅ 清掉随之失效的 chips / stream / tok 死 CSS 与 JS

> 教训：之前把 `__om-edit-overrides`（设计工具的视觉编辑层）当遗留垃圾删掉，
> 导致美术偏离设计稿。后续改 index 视觉前要先对照设计稿。

---

## ✅ 已完成 — 信息架构整顿（2026-06-30）

**决策**：不要 app 内升级弹窗；走定价页。index.html 改为纯 app（极简空状态），
保留顶栏 Claude 说明。

- ✅ 删除升级弹窗 `#plansOverlay`，所有升级/加点数入口 → `pricing.html`
  （`openPlans()` 改为跳转）。消除了弹窗与定价页的重复购买 UI。
- ✅ 删除空状态的轮播营销流（What BourneWise does / 方法介绍 / 隐私）。
  空状态现在只剩：问候语 + 示例 chip + 输入框（Claude 式）。
- ✅ **保留**顶栏 "All information…Claude Opus 4.8…" 说明（按要求）。
- ✅ 删除死页 `chat.html`（旧重定向，无内部引用）。

> 仍待办：定价页卡片改为从 `BWAccount.PLANS` 渲染（目前仍硬编码），购买统一走
> `BWAccount.setPlan/addUnits`——数据单一源化。pricing.html 自己那套内联购买 JS
> 待收敛。

---

## 待办（非美术）

- [ ] Stripe 真实支付（checkout + webhook → 自动发点数/改套餐），替换 `/plan`、`/grant` 的 stub
- [ ] 部署配置：`wrangler d1 create` 填 database_id、跑 schema.sql、设 SESSION_SECRET
- [ ] （可选）真实 Google OAuth：设 GOOGLE_CLIENT_ID/SECRET，login 的 google 按钮指向 `/api/auth/google`
