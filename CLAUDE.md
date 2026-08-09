# CLAUDE.md — BourneWise 唯一工作准则

> 🚧 **草稿 —— 正在由 owner 重写定稿。** 但即使是草稿,也比 PROGRESS.md 里那些过期规范可靠:
> 本文件的每条现行规范都对着代码核过。定稿前如与代码冲突,**以代码为准并回来更正本文件**。
>
> **这份文件是唯一权威。** 有多个 Claude Code 会话在同一个仓库上工作。
> 任何风格/规范冲突,以本文件为准;PROGRESS.md 只是历史流水,**不是规范**,不要照它改代码。
> 改动了本文件涉及的规则,必须同步更新本文件。

---

## 1 · 这是什么

BourneWise —— 六爻(Liu Yao)算法 + AI 疗愈决策 SaaS。
纯静态前端 + Cloudflare Pages Functions 后端 + D1 数据库。**没有构建步骤**,HTML/CSS/JS 直接上线。

---

## 2 · 架构地图

```
index.html          应用本体(空状态=落地页,会话=聊天页)
guide.html          长滚动教程   about.html  pricing.html  login.html
settings.html       privacy/terms/refund/404.html
styles.css          只有 @import,指向 tokens/*
tokens/*.css        colors / fonts / typography / spacing / paper / motion
assets/backgrounds/mountain-range.js   动态山脉背景引擎(180 色组)
casting-figure.js   排卦图与排卦动画(BWFigure)
liuyao-engine.js    六爻排盘   liuyao-ai.js  prompt-engine.js  prompt-router.js
chat-app.js         聊天 UI 与投卦流程   account.js  sidebar.js  ds-base.js  ds-motion.js
functions/api/      claude.js(AI 代理) auth/ account/ billing/ checkout.js
schema.sql  wrangler.toml  _headers  _redirects  version.json
```

**单一数据源**:账户/点数/历史一律走 `account.js`(BWAccount),不要在别处复制状态逻辑。

---

## 3 · 设计法则(硬性)

这些原本散在 `tokens/*.css` 注释里,现在收口到这里。**改之前先读**。

### 字体 —— 只有三种,不得新增
| 用途 | 字体 | 变量 |
|---|---|---|
| 标题/衬线 | **BioRhyme**(可变字重 200–800,单文件) | `--font-serif` |
| 正文/UI/标签/CTA | **Spinnaker** | `--font-sans` / `--font-mono` |
| 品牌字标 + Stria method chip **仅此二处** | **Pacifico** | `--font-brand` |

- 禁止出现 Inter、Lora、Fraunces、Rubik、IBM Plex、Sawarabi、Bree Serif 等任何其他字体。
- 字体自托管在 `assets/fonts/`,共 3 个 woff2 文件,不许外链。
- Pacifico 是单字重,`font-weight:700` 无效;要粗用字号 + `-webkit-text-stroke`。

### 颜色
- 组件**只引语义别名**(`--ink` `--dim` `--terracotta` …),**永远不写裸 hex**。
- `--terracotta` = 可点击的东西(CTA、链接)。
- `--prussian` = 每页**最多一个** hero 块。
- `--pine` = 状态徽章/安静强调,**绝不用于 CTA**。

### 排版
- mono/label 类文字**加字距但永不全大写**,一律 sentence case。

### 间距与投影
- 表达层仍使用两种基础圆角令牌;应用 chrome 统一从 `tokens/refinement.css` 的
  `--ui-radius` / `--ui-radius-small` 取值,避免各页继续散落任意圆角。
- 内容板块不投影;只有浮层、composer、当前主套餐等需要表达层级的对象使用
  极轻的 `--ui-shadow`,山脉始终是页面唯一的强视觉层。

### 界面气质
- 方向是 **Apple / OpenAI 式克制的系统界面**,不是照搬任一品牌:大留白、清楚层级、
  中性半透明 chrome、44px 以上触控目标、极少的持续动画。
- 山脉和排卦图负责表达与记忆点;导航、表单、套餐、账户面板必须安静、精确、退后。
- 全站共享的最后一层修饰只写在 `tokens/refinement.css`;页面内 CSS 保留结构和页面
  特性,不得再为同一种按钮/玻璃/导航在每页复制一套新视觉。

---

## 4 · 背景与动效系统

### 山脉背景 `mountain-range.js`
- **180 个色组**,每组 10 阶(浅→深),分 7 段:近白段 30 组,其余 6 段各 25 组。
- 10 层山脊 + `.mtn-sky` 页面场,**全部同步**到一条时间线 —— 任一时刻整座山穿同一套配色,再整体交叉渐变到下一套。
- 周期 **900s**,`HOLD = (100/SEQ.length)*0.7` —— 渐变占每格约 70%,连续变形而非跳变。
- 山脉相位使用 `sessionStorage` 中的会话时钟跨页面连续;禁止每次导航重新随机。
- 禁止整页跨文档 View Transition:它会同时合成两套全屏 SVG 与玻璃层,造成闪帧。
- 线稿入场动画每个浏览会话只播放一次,页面之间切换不重复入场。
- **撞色偏置**:◆ 对比带与主色相 HSV 距离 > 40° 判为撞色组,优先入池;另取 25% 单色组维持安静时刻。
- 序列按 `近白 → 彩色` 1:1 交替。
- 线稿模式 `.mtn-bg.line-art`:填充降到 `opacity:.62`,保留等高线。
- **性能红线**:绝不逐帧动画 `background-color`/`filter`/`backdrop-filter`。用 hold-then-crossfade,只动 transform/opacity。

### 动效令牌 `tokens/motion.css`
- 曲线:`--ease-out` / `--ease-in-out` / `--ease-spring` / `--ease-cinematic`
- 时长:120 / 240 / 480ms;揭示类 `--dur-reveal:900ms`
- `.pressable` 按压态 scale(.97),120ms 回弹
- `[data-reveal]` / `[data-split]`:IntersectionObserver 驱动,加 `.is-in` 触发
- 一律尊重 `prefers-reduced-motion`

### 排卦动画 `casting-figure.js`
- 十二笔(本卦六 + 变卦六)踩**同一条 620ms 心跳**,一气呵成,**中间不分段、不停顿**。
- 倒数第二笔开始注解绽放,与末笔重叠。
- **落定即静止** —— 结束后不得再启动任何循环动画(呼吸/脉动/流动一律禁止)。
- 排卦图上**没有任何鼠标悬停互动**。已彻底移除,不要加回来。
- 不得为逐爻内容生成 hover/tap readout、隐藏 JSON payload、tooltip `title` 或手型/焦点伪交互。

---

## 5 · 后端与模型

- 浏览器只声明**意图**(`product`/`role`),模型由服务端选,key 永不下发。
- 环境变量(Pages → Settings → Environment variables):
  `OPENROUTER_API_KEY` `SESSION_SECRET` `CREEM_API_KEY` `CREEM_WEBHOOK_SECRET`
  `CREEM_PRODUCT_PROMONTHLY` `CREEM_PRODUCT_PROANNUAL`
  `CREEM_PRODUCT_PREMIUMMONTHLY` `CREEM_PRODUCT_PREMIUMANNUAL`
  `CREEM_PRODUCT_PACK7500` `CREEM_PRODUCT_PACK15000`
  `CREEM_PRODUCT_PACK30000` `CREEM_PRODUCT_PACK75000` `STRIA_MODEL` `SORTIS_MODEL`
  `UTILITY_MODEL` `CLAUDE_MAX_TOKENS`,D1 绑定 `DB`。
- **支付是 Creem,不是 Stripe。**
- 无 key / 无 D1 时必须静默降级到本地 guest 模式,**站点永不崩**。

---

## 6 · 解读语气(prompt-engine.js)

- **暖、厚、有人味** —— 像站你这边的高人聊天,不是风控报告/合规备忘。
- **象→实**:每条承重爻必须翻译成具体可查的现实变量(并说"去查什么");只映射真机制,不编数据。
- **乐观但不说谎**:先把好处讲透,坏处作友好提醒并给出路;死爻仍要点破,乐观在框架不在谎报。
- **禁催促收尾**:不许出现"今天问得尽兴了/这个收尾/该歇了/改天再来"这类话。
- 篇幅:Sortis 5000–6000 字,Stria 2000–3000 字。
- 「再起一卦」= 必须真的新卦(temperature 拉满),不得近似复读;且要承接上文主题。

---

## 7 · 工作流(必须遵守)

1. **构建标签**:任何 HTML/CSS/JS 改动,必须把全站 `?v=` 与 `version.json` 一起 bump 到同一个新标签(如 `20260726c`)。漏 bump = 用户看到的还是旧缓存(历史上多次"改了没生效"都是这个原因)。
2. **分支**:在自己的 `claude/session-*` 分支上做,rebase 到最新 `main` 再开 PR。**先 `git fetch origin main`**,另一个会话可能刚推过。
3. **验证要用证据**:改布局就截图/量几何,改动画就采样,不要凭感觉说"修好了"。截图前**禁用缓存**,否则会被旧文件骗。
4. **不要碰**:`PROGRESS.md` 已被 `_redirects` 挡在公网外,保持这样。

---

## 8 · 历史版本的风格与规范(供对照挑选)

下面是各版本出现过的规定,标注了现状。**这一节是给人看的,不是给 Claude 执行的。**

| # | 历史规定 | 出处 | 现状 |
|---|---|---|---|
| 1 | 字体锁三种 BioRhyme/Spinnaker/Pacifico | 06-30 第三轮 | ✅ **现行** |
| 2 | 字体 Inter(UI) + Lora(正文) + Pacifico | 06-30 第二轮 | ❌ **已废**(同日第三轮撤回) |
| 3 | FROZEN 段写"Pacifico/Spinnaker/BioRhyme/**Lora**" | PROGRESS L307 | ⚠️ **过期**,Lora 早删,照做会加回死字体 |
| 4 | guide 用 Fraunces 斜体注 | 07-20 六项②| ❌ **已废**,Fraunces 已删 |
| 5 | 背景 5 套配色 | 第五轮性能优化 | ❌ 被 72 套取代 |
| 6 | 背景 72 套季节配色,周期 1440s | 07-20 恢复 | ❌ 被 **180 组 / 900s** 取代 |
| 7 | 背景 8 套配色,200s | 07-20 六项③ | ❌ 已废 |
| 8 | 历史曾有 144 套品牌色 / 36 套用户参考色 | 考古 b968c05 | 📦 归档 |
| 9 | 玻璃面板 `saturate(0)` 完全去色以除黄 | 07-20 病根终结 | ✅ 仍在 `.main::before` |
| 10 | 玻璃面板 `saturate(.62)` | 07-20 第二档 | ❌ 被 saturate(0) 取代 |
| 11 | Apple 风玻璃 `rgba(255,255,255,.4-.66)` + `blur(22-26px) saturate(180%)` | 你 07-24 要求 | ⚠️ **未落地**,见下方 §9 |
| 12 | 排卦图悬停只去底色、保留读爻联动 | 07-20 微调 | ❌ 被"完全移除悬停"取代(#34) |
| 13 | 空状态 = 问候语 + 示例 chip + 介绍流 | FROZEN L307 | ⚠️ 与"只留问候语+输入框"矛盾 |
| 14 | 空状态只留问候语 + 输入框,删 chips | 06-30 美术对齐 | 大致现行 |
| 15 | 不要 app 内升级弹窗,一律走 pricing 页 | 06-30 信息架构 | ✅ **现行** |
| 16 | 顶栏保留 Claude Opus 说明文字 | 06-30 信息架构 | ⚠️ 手机端已隐藏(挤) |
| 17 | 对话列居中 740px | FROZEN L307 | 大致现行 |
| 18 | 支付走 Stripe | 待办(非美术) | ❌ **已废**,改用 Creem 并已上线 |
| 19 | Google OAuth 可选接入 | 待办 | ❌ 代码未读任何 GOOGLE_* 变量 |
| 20 | 交互手感:pressable / 草稿持久化 / 点数不足就地脉冲 / 键盘 `/`·`n` / 阅读进度线 / hover 预取 / 复制解读 / 触屏 44px | 07-20 三档 | ✅ **现行** |
| 21 | Lenis 平滑滚动 | 我 07-23 加 | ❌ 已废,#31 改回原生滚动 |
| 22 | 解读骨架 9 段流动暖文(铺垫/卦盘/判词/逐条/收口/取象/畅想/老话/把握) | 07-20 范本重写 | ✅ **现行** |

### PROGRESS.md 里那 6 条"页面凌乱"TODO 的现状
1. 卦象与正文不对齐 —— ⚠️ 未处理
2. 卦象横向铺太开 —— ⚠️ 未处理
3. 卦象上下留白过多 —— ⚠️ 未处理
4. 顶栏标题截断 —— ✅ 已解决(手机端隐藏标题,#37)
5. claude-note 偏大挤顶栏 —— ✅ 已解决(≤700px 隐藏)
6. 空状态信息偏多 —— ⚠️ 见上 §13/14 矛盾

---

## 9 · 规范与代码对不上的地方(审计结果)

全站按 §3 逐条量过。**通过**的:字体只有三种、无违禁字体、无外链字体、`--pine` 未用于 CTA、
slab 无投影、构建标签全站一致、Pacifico 仅用于字标+chip。

下面三条是**规范说一套、代码做另一套**,而且都是全站规模 —— 需要你裁决"以谁为准",
我不擅自改(改任何一条都会大面积动到现在的视觉):

| 规范出处 | 规范怎么说 | 代码实际 | 数量 |
|---|---|---|---|
| `tokens/typography.css:37` | mono/label **永不全大写**,一律 sentence case | 全站大量 `text-transform:uppercase`(AVAILABLE UNITS / SCROLL TO BEGIN / SELF·RESP / FREE…) | **45 处** |
| `tokens/spacing.css:17` | 旧规则只有两种圆角:`--radius-blade:0` 与 `--radius-pill:999px` | 现由 `refinement.css` 为应用 chrome 提供两个统一的中间圆角;旧页面内异形值待渐进清理 | 历史债务 |
| `tokens/colors.css:23` | 组件**只引语义别名,永不写裸 hex** | 各页大量裸 hex(`#F2EDE7` `#C9663F` `#3a362f`…) | **156 处** |

**当前裁决**:标签大小写和旧裸色仍按页面渐进清理,不做破坏式全局替换;圆角与层级已由
`refinement.css` 收口。新代码必须遵守上面的现行规则,不得继续增加历史债务。

## 10 · 还需要你拍板的

1. ~~Apple 玻璃 UI 没落地~~ —— ✅ **已重做并验证**。全站暖奶油面(composer / method-menu /
   两个 coach-mark / ledger / side-foot / 账户菜单 / login 卡 / 各内容页 panel)换成中性白玻璃 +
   `saturate(0)`。跨 12 个配色相位采样 composer:改前 R−B **+21~+35**(发黄),改后 **≤11、多数 ≤5**(中性)。
2. **剩下的暖色是 chip 类**:`--chip` = `#DAC7A3`(R−B **+55**),用在「Stria 64」圆片、
   「500 units」余额片、侧栏当前会话高亮。它们不是玻璃面板而是实色品牌元素,
   改动等于动调色板身份 —— 你之前说过"色彩风格沿用现在的版本",所以我没动。要不要一起去暖?
3. **空状态到底要什么**:问候语 + 输入框(现状),还是加回示例 chip / 介绍流?§8 第 13 与 14 条互相矛盾。
4. **卦象排版三连**(§8 末尾 TODO 1–3)要不要这轮处理?
5. **顶栏 Claude 说明文字**:手机端已隐藏,桌面端保留 —— 可以吗?
