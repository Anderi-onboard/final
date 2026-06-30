# BourneWise — 进度与修改历史 (Progress & Change Log)

> 本文件追踪开发进度、修改历史，以及**待完成的任务**。
> 当前阶段：**美术/视觉修改已冻结**，优先处理页面布局凌乱问题（见下方 TODO）。

最后更新：2026-06-29

---

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
