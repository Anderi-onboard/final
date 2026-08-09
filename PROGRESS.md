# BourneWise — 进度与修改历史 (Progress & Change Log)

> 本文件追踪开发进度、修改历史，以及**待完成的任务**。
> 当前阶段：**字体已锁定为仅 BioRhyme / Spinnaker / Pacifico 三种，禁止出现任何其他字体**。
> 其余美术（排版比例、留白、卦象对齐）仍在后期集中处理之列。

最后更新：2026-08-08

---

## ✅ Claude 最新分支整合 + Creem Test Mode 加固（2026-08-08）

- ✅ 初始页轮换主标题改为相对整个可用画布（视口减去侧栏）水平、垂直双向
  精确居中，不再被顶栏或输入栏高度推偏；实测 1440×900 中心 `(852, 450)`，
  390×844 中心 `(195, 422)`，两端横向溢出均为 0。
- ✅ Creem 交接文档扩展为 8 个产品逐字段填写表，包含名称、描述、计费类型、
  周期、美元/美分价格、feature 文案、税务字段、成功页和 Cloudflare 变量映射。
- ✅ Pricing 前端不拆成四张订阅卡：Pro / Premium 各保留一张，并使用原生可
  勾选的 `Annually` 复选框切换月付/年付价格、units、按钮文案与 Creem SKU；
  手机端实测无横向溢出。
- ✅ 账单邮件交给 Merchant of Record：Pricing 明示 Creem 会在每次成功付款后
  自动发送收据与 Portal 链接；Settings 将入口命名为 `Receipts & billing`，
  支付成功提示明确邮件已发送；8 个产品增加统一 Private Note 填写模板。
- ✅ 补齐 `refund.created` / `dispute.created`：按退款比例撤回相应购买点数，
  余额永不低于 0，事件 ID 幂等防止重复撤回；退款 checkout metadata 也可正确
  找回所属 BourneWise 用户。
- ✅ 从 `origin/claude/bournewise-handoff-priorities-19xcmh` 建立
  `codex/creem-integration`：保留 Claude 的 8 项提示词/追问改进，同时恢复
  本地已完成的主页精确居中、右上角 Plans、紧凑 Pricing 和品牌副主题。
- ✅ Claude 体验改动已纳入：关闭 Opus 5 extended thinking、修复数字卦号、
  取消僵硬九字段输出、按用户语言回答、区分板面证据与生活推断、动态追问、
  跨对话携带上下文、亲密关系问题不再拒判用神。
- ✅ Creem 产品矩阵统一为 8 项：Pro/Premium 月付与年付 + 7,500 / 15,000 /
  30,000 / 75,000 四档点数包；修复 `pack4500` 与价格页 `pack7500` 的致命错配。
- ✅ 取消订阅接口显式发送 `{ mode: "scheduled", onExecute: "cancel" }`，保证
  产品内文案所说的“当前周期末取消”与 Creem API 行为一致。
- ✅ 余额扣减与发点改为 D1 条件算术更新 + 事务批处理，避免并发请求覆盖余额。
- ✅ 删除浏览器可直接调用的 `/api/account/grant`、`/plan`、`/spend` 演示接口；
  生产余额现在只能由已签名的 Creem webhook 或服务端 AI 结算改变。
- ✅ 按量计费改为“预留公开上限 → 实际 token 结算 → 自动返还差额”；前端只在
  完成时刷新一次余额，不显示中途跳动，同时堵住 1 点余额调用完整 Opus 的漏洞。
- ✅ Pricing / Settings / Terms / Refunds 对齐同一计费说明、同一支持邮箱；移除
  不存在的 App Store / Google Play 退款路径。
- ✅ 手机端输入框改为两层布局：问题独占整行，方法和发送键留在底部，解决
  placeholder 被压成窄列和空输入框出现内部滚动的问题。
- ✅ 全站文案包从最终源码重新生成；审计结果 `STALE: 0`。
- ⚠️ Creem 当前禁止 metaphysical / fortune-telling / spiritual outcome
  services。代码可继续接 Test Mode，但 Live 审核前必须把真实产品流程发给
  Creem support 并取得书面 eligibility 确认；严禁通过隐去 I Ching 流程规避。

---

## ✅ 已完成 — 应期公历化:TIMING REFERENCE(2026-07-18)

外国用户看不懂「寅月/申日」;且分支时间是循环的,本就该给出多个可能时点。

- ✅ `liuyao-ai.js` 新增 `timingReference(board)`:**JS 确定性计算**(不让模型做
  日期数学)——12 分支月的下一个节气窗(公历区间+年份,过期自动滚到明年)+
  12 分支日的下两次出现日期(起卦日支推算,12 天一循环)。注入 buildMessages
  的板面事实与 schema 之间(路由管线的 schema 裁剪点之前,两条路径都能吃到)。
- ✅ `prompt-engine.js` deploy_voice 新增 TIMING LANDS ON A CALENDAR 铁律:
  凡以分支表达应期,必须引用参照表给出公历日期,并因循环给出 2–3 个最近
  可能(先分支日、后分支月窗);裸分支名作应期视为缺陷。分支名保留作风味。
- ✅ 旧 JSON 路径 schema 的 timing 字段提示同步(带公历示例)。
- ✅ 验证:浏览器实测 2026-07-18(日支巳)——次日午=Jul 19、巳日+12=Jul 30、
  未月当前窗 2026、已过午月滚 2027,全部正确;Gate eval 14/14 PASS。
- 版本:liuyao-ai.js / prompt-engine.js → `?v=20260718a`。

---

## ✅ 已完成 — 追问/新卦语义判定(Sonnet 5,2026-07-17,同日第四轮)

原判定纯结构化(同对话+同方法=一律追问),不理解语义——同一 thread 里问全新
问题会被错当追问、按旧卦解读。现改为:

- ✅ `detectIntent()`(chat-app.js):同对话再发消息时,先用 **Sonnet 5**
  (role:utility 不计费、走限流)做一次单词分类——上一卦问题+判词摘录+新消息
  → FOLLOWUP / NEW。4 秒超时或任何失败**默认 FOLLOWUP**(更便宜、最不惊吓)。
- ✅ NEW → **不赶用户去左上角**:直接在当前对话里重新起卦(上下文经 history
  完整继承),卦象上方插 `.recast-note` 一行说明,把「新问题=整卦价 / 同卦
  追问=按量封顶半价」的规则在扣费发生的那一刻讲清(中英按提问语言)。
- ✅ 服务端 `ALLOWED` 加 `anthropic/claude-sonnet-5`(含 `claude-sonnet-5` /
  `sonnet-5` 别名),分类调用显式指定该模型。
- ✅ 实现方式:send(text, decided) 递归重入——检测期间 busy+禁发送,决策后
  带参重入,余额检查按最终档位重算。缓存版本 chat-app → `?v=20260717d`。
- 设计取舍:检测失败宁可偏向追问(用户少花钱),绝不静默把追问判成全价新卦。

---

## ✅ 已完成 — Creem 支付接入(代码侧,2026-07-17,同日第三轮)

- ✅ **POST /api/checkout**(`functions/api/checkout.js`):按 sku(pro/premium/
  packNNNN)映射 env 里的 Creem product id,创建托管 checkout(metadata 带
  userId+sku),返回跳转 URL。未配 `CREEM_API_KEY` 时返回 503——pricing 页
  既有的演示回退继续生效,站点不因未配置而破。key 前缀 `creem_test_` 自动
  切 test-api 域。
- ✅ **POST /api/billing/webhook**(`functions/api/billing/[[path]].js`):
  HMAC-SHA256 验签(constant-time 比较)→ `billing_events` 幂等(重放永不
  重复发点)→ 事件处理:checkout.completed(充值包发点/订阅记 plan 不发点)、
  subscription.active/paid(paid 是唯一月度发点事件,按 PLAN_GRANT)、
  scheduled_cancel(标记 canceling,plan 保留到期末)、canceled/expired
  (降级 free,已发点数保留)。无 metadata 的续费经 `subscriptions` 表反查。
- ✅ **产品内取消**(Creem 审核硬性要求):POST /api/billing/cancel 调
  `/v1/subscriptions/{id}/cancel`;settings 新增「Your subscription」行
  (Cancel + Billing portal 按钮,canceling 态提示保留到期末)。另有
  GET /api/billing/status、POST /api/billing/portal。
- ✅ 成功回跳:checkout success_url → `settings.html?billing=success`,
  toast + 延迟 hydrate 拉新 plan。
- ✅ 数据层:生产 D1 已存在通用 `billing_events`/`subscriptions` 表(7/12 版
  后端遗产),直接复用(provider='creem');schema.sql 补齐两表定义;db.js 新增
  recordBillingEvent/upsertSubscription/getSubscriptionBy*/setPlanQuiet
  (webhook 流发点与 plan 解耦,杜绝 setPlan 附带 grant 的双发)。
- ✅ 验证:9 项 webhook 仿真全过——坏签名 400、pack 发点、事件重放不重复、
  订阅 checkout 不发点、paid 发月度点、paid 重放不重复、无 metadata 续费
  反查、canceled 降级留点、ledger reason 审计正确。
- ⏳ **待用户在 Creem 后台完成**(代码已就绪):注册→建 8 个产品(Pro/Premium
  月付与年付共 4 个订阅、4 个 pack)→ Developers 拿 API key + webhook secret →
  webhook URL 填 `https://bournewise.com/api/billing/webhook` → 8+2 个 env
  填进 Pages(见 .dev.vars.example)→ 重新部署 → test 模式走通后切 live 申请
  上线审核。

---

## ✅ 已完成 — 体验四连修 + Creem 合规补缺(2026-07-17,同日第二轮)

用户反馈:①多设备多分辨率可视化不佳;②某些页面背景动效缺失(体感);
③聊天要 typewriter 打字机流式;④滑动不丝滑、字体未以正式字体首屏出现。
另:Creem 商户审核缺支持邮箱可见性与首页法务链接。

- ✅ **Typewriter**:`chat-app.js` 新增 `makeTypewriter()`——rAF 逐字符追赶
  网络缓冲(积压 ~0.4s 内清空)、markdown 预览节流 66ms、复用既有
  `.reading-streaming::after` 光标;起卦与追问两条流程统一接入;流式完成后
  直接落定结构化判词,不再二次逐词动画。独立行为测试:渐进采样 15 个
  不同长度、单调递增、markdown 结构成立、finish 回调正确。
- ✅ **响应式**:360/768/1440/2560 四档 Playwright 审计。修复:terms/privacy
  的 `.toc::before{inset:-40px}` 玻璃光晕手机端撑出视口(20px)→ 小屏收窄
  -12px;pricing 的 `.plan/.topup/.ledgerstrip::before` 同因(22px/10px)→
  520/860 断点分档收窄;pricing 手机端 nav CTA 缩排;全部卫星页
  `html{overflow-x:clip}` 兜底(装饰出血不再产生横向滑动)。复测 9 页
  横向滑动全部锁定。
- ✅ **滑动丝滑**:about 深屏 `scroll-snap y mandatory + snap-stop:always` →
  `proximity`(不再逐屏强吸);全站 backdrop-filter 模糊半径下调 ~40%
  (22→13/20→12/18→11/16→10/12→9/11→8),玻璃观感保留、滚动合成开销大降。
- ✅ **背景动效**:审计证实 9 页 × 4 分辨率 mtn-bg 全部在动——"缺失"实为
  透明度过低的体感问题;terms/privacy/refund .42→.58、settings .5→.62。
- ✅ **字体首屏**:全站补 BioRhyme-700 preload;新增 fonts-wait 门控
  (`document.fonts.ready` 前 body 隐藏,900ms 兜底)——首屏一次性以正式
  字体出现,无回退字体闪替。
- ✅ **Creem 合规**:index 新增常显 `.site-foot`(Support 邮箱 +
  Terms/Privacy/Refunds/Pricing 链接,空状态固定底部);about 页脚补邮箱
  与 Refunds 链接。
- 缓存版本:chat-app.js → `?v=20260717b`。

---

## ✅ 已完成 — 计费重构:预扣-实结 + 断流止损 + 同卦追问（2026-07-17）

用户反馈四连:①输出有时中断;②中断后只能全价重新起卦;③无法追问上一卦;
④因此定价与判定机制需要重构。方向拍板:**维持现有利润,按实际消耗计费**。

- ✅ **新起卦价格不变**(Stria 300 / Sortis 1500)——现有利润完全不动。
- ✅ **断流按实结算**:`functions/api/claude.js` 流式路径重写为手动泵
  (`pumpAndSettle`,挂 `waitUntil`,客户端断开也能结算)。捕获 OpenRouter 的
  `finish_reason` + `usage`(请求带 `usage:{include:true}`);流没走到
  `stop/end_turn/length` 即视为截断 → 只按实际输出计费、其余点数当场退回,
  并在尾部 `bw_meta` 事件带 `{incomplete, charged, unitsRemaining}`。
  客户端 toast 改为「只收已生成部分,发送"继续"可在同卦接着解读」。
- ✅ **同卦追问(mode:"followup")**:同一对话里已有本方法的卦 → 再发消息
  不再重新起卦,复用原 board(Stria 从 spec 重算)+ 最近 3 轮 history,
  计费按实际 token 计量、**封顶半价**(150/750,`FOLLOW_COST`),结算退差。
  追问跳过 QC(流式本就不重写)。UI 无卦象动画,直接流式作答。
- ✅ **费率表** `functions/_lib/db.js` `METERING`:按「典型整卦 ≈ 一口价」锚定
  (stria 15/160 per-1K in/out,sortis 75/800),即每 token 毛利率与现价一致;
  调价只改这一处。`unitsForUsage()` 有 minCharge 下限与 cap 上限,无 usage 时
  按字符数/4 兜底估算。
- ✅ 判定链:`mode` 判定(followup 必须登录;Sortis 追问仍需 Pro)→
  预扣(reserve)→ 生成 → 实结(settle)→ 退差,账单 reason 区分
  `cast:*` / `follow:*` / `refund:truncated` / `refund:follow_settle`。
- ✅ 验证:计费数学 node 单测(典型卦=一口价、断流退差、封顶、下限)+
  流式泵仿真测试(完整流不误判 / 断流标记 incomplete / 无尾空行的最终
  usage 记录正确解析)全部通过;改动文件 `node --check` 通过。
- ⏳ 待观察:Stria 追问因输入(system+board+history)占比高,常触到 150 封顶
  ——体感即「追问=半价」;若要更便宜需给 system 上 prompt cache 或降追问输入
  费率,属后续调优,改 `METERING` 常量即可。

---

## ✅ 已完成 — 部署交接：D1 建库、about.html 重做上线、AI 代理切到 OpenRouter（2026-07-10）

- ✅ 建了生产 D1 数据库 `bournewise`，`wrangler.toml` 填入真实 `database_id`，
  `schema.sql` 已对远程库执行（`users`/`ledger`/`castings`/`rate_limits` 四表就绪）。
- ✅ 落地了 about.html 的视觉重做（去侧边栏、山脉背景贴边铺满、新配色、环境动效层），
  并随第五轮性能优化一起上线（含此前仓库缺失的 `assets/fonts/` 自托管字体）。
- ✅ `functions/api/claude.js` 从直连 Anthropic 改为经 **OpenRouter** 调用 Claude
  模型：请求体从 Anthropic 原生 `/v1/messages` 形状改为 OpenAI 兼容的
  `/chat/completions` 形状（`system` 并入 `messages`，非流式响应从
  `choices[0].message.content` 取文本）；流式路径把 OpenRouter 的
  `choices[].delta.content` 分片重新编码成客户端 `prompt-router.js` 已经在解析的
  Anthropic 风格 `content_block_delta` 事件，**前端解析逻辑完全没动**。环境变量
  从 `ANTHROPIC_API_KEY` 改名为 `OPENROUTER_API_KEY`；模型 id 换成 OpenRouter 的
  vendor-prefixed slug（如 `anthropic/claude-sonnet-4.6`），旧的 Anthropic 原生 id
  仍保留在 `ALLOWED` 别名表里做兼容。`eval/run-eval.js` 的 Router 校验同步改造。
- ✅ 部署到独立 Pages 项目 `bournewise-static`，自定义域名 `bournewise.com` 已从旧
  项目（`bournewise-vite`）迁移过来（DNS CNAME 指向 + HTTPS 证书均已生效）。旧项目
  保留未删，可随时回滚。

## ✅ 已完成 — 全站性能优化：毛玻璃逐帧动画下线（2026-07-06，第五轮）

用户反馈"效果满意但太卡"。定位到两类主因并修复，视觉效果保持不变：

- ✅ **毛玻璃"呼吸"动画是头号元凶**：全站 9 处 organic* keyframes（index 的
  ledger/side-foot/thread、pricing 的 pill/plan/topup、settings panel、
  privacy/terms toc、login card、sidebar.js）在逐帧连续动画 `border-radius`
  **和 `backdrop-filter: blur()` 的模糊半径本身**。这两个属性无法走合成器，
  等于每个玻璃元素每帧都在主线程重算样式并以不同核宽重跑背景模糊。已全部
  改为静态值（取 0% 关键帧，即原动画的基准帧）：羽化 mask 宽达 56–150px，
  圆角 ±4px、模糊 ±5px 的摆动本来就在视觉上不可分辨，肉眼零损失。同时给
  玻璃层加 `transform:translateZ(0)` 独立合成层，隔离重绘。
- ✅ **山脉背景：等高线不再陪跑重栅格化**：mountain-range.js 里每条山脊的
  填色 `<use>` 与 5–18 条描边等高线原来同在一个动画组——每 4 秒的调色板
  step 跳变会连带全部 ~100 条描边路径重新栅格化。现拆成两个同步 flow 组：
  填色层照常跳变，等高线层栅格化一次后永久缓存。
- ✅ **山脉调色板 timing 修正（第六轮追加）**：原 `steps(72)` 是按关键帧区间
  生效的——每个 4s 区间又被切成 72 小步，实际填色每 ~55ms 跳一次：巨幅山体
  每秒重栅格化 ~18 次（性能大头），且大部分时刻显示两套调色板的浏览器混
  色（发灰、"不宏伟"）。改为 `steps(1,jump-end)`：每个色标整段保持、边界干
  净跳变，4 秒才重栅格化一次。另增 `--mtn-phase`（默认 -148s）：刷新不再
  从最惨白的春季奶油色 0% 起步，而是落在浓郁的秋季 rust & amber 段；宿主
  可在 .mtn-bg 上覆写。
- ✅ 附带：composer 玻璃提升为独立合成层；claude-mark 呼吸动画加
  `will-change:transform,filter` 走合成器；清理 reduced-motion 里针对已删
  动画的圆角覆写；删除 pricing 三张卡的死 stagger delay。
- 保留未动：山脉 translate3d 流动（合成器动画）、fill steps(72)（本来就是
  4s 一跳非逐帧）、bgDrift steps(44)、打字机 placeholder——均非逐帧主线程负担。
- ⏸️ 若低端核显仍嫌重，下一档是调低 .thread 大面积模糊半径或减少山脊层数
  ——两者都会改变视觉，未动。

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

---

## ✅ 已完成 — 用户引导教程 guide.html（2026-07-19）

**目标**:留住用户 + 教育用户 + 绑定品牌价值。首次访客 5 分钟看完即上手。

新增 `guide.html`,完全沿用 about.html 的 "Paper" 滚动模板(mountain-range 山峦 hero、
scroll-snap 全屏翻页、玻璃卡片、per-page 颜色场、IntersectionObserver rise 动画、
BioRhyme + Spinnaker + Fraunces 斜体 gild + terracotta)。五页:

- **Hero** — "How to ask, and how to read what comes back"。
- **01 选择工具** — Stria 64(from 300)/ Sortis 6(from 1,500)/ Units 计费说明
  (按实际消耗计费、同线程追问更便宜、开局 500 免费)。
- **02 如何问卦** — 4 条习惯:问真正困扰你的、说清楚再给点上下文、问"动向/抉择"
  而非固定事实、诚心一卦别反复重卜。
- **03 卦象指向什么 + 如何解读** — 卦是"力的地图"非判决;一卦多解、多向参考;
  模糊性正是它对复杂人生的诚实(多样性/多向性)。
- **04 唯一铁律 + Claude 的角色** — 印章「卦后并非万事大吉 · 仍需努力,自强不息」;
  卦由确定性引擎起(旧逻辑不动),Claude 只"落字"、始终服从卦象、不为讨好而改写。
  古法结构 + 现代之声,分工透明。

导航接入:index 顶栏("How it works")+ 页脚 + 空状态问候语下方 `.greet-guide` 首访引导;
about 与 pricing 的 nav / 页脚均加入 "How it works" 链接。

已用 Playwright 在 1280 桌面与 390 移动分辨率逐页截图核验:布局正常、字体正确、
无 console/page error;修正印章一处 HTML 实体笔误(卵→卦)。

### 改版 — guide 改成 Payoneer 式分步向导(2026-07-19)

按要求把 guide 从"滚动翻页"改成**一步一屏的注册引导**:
- **左上角圆形进度环**(SVG dial):中心显示"第 N / 共 5",terracotta 弧随步数填充;
  下方另有一条细线性进度条做二次读数。
- 一次只显示一屏,底部「继续」推进(最后一步文案变为 "Bring your question" → 进入 app);
  "Back" 回退、底部圆点 rail 可点跳。
- 支持键盘(← / → / Enter / Space / Home / End)与移动端左右滑动手势;`#N` 深链直达某步。
- 每屏不滚动整页,内容超高时仅在本屏内滚动;`prefers-reduced-motion` 关闭动效。
- 五步内容不变(欢迎 / 选工具 / 如何问 / 卦象指向 / 唯一铁律+Claude 角色)。
- 已用 Playwright 逐步点击核验:dial 1/5→5/5、进度 20%→100%、标题与终步 CTA 均正确,
  桌面 1280 与移动 390 均正常,零 console/page error。

---

## ✅ 已完成 — 解读质量整改:七条病根(2026-07-19)

用户实测反馈的具体病症(SaaS 问卦 +「以后能住麓湖吗」),全部落到 prompt 层修复:

1. **开头必须是完整净结论**(`verdict_first` 重写):先按问题本身的措辞和时间跨度复述
   问题;给出唯一净判断(成/不成/有条件成/时机未到但底子在),条件当句讲清;2-3 条
   大白话决定性理由;**反跷跷板铁律**——混合信号只在开头权衡一次,全文保持同一方向,
   「看起来能成…其实难…也许又能」直接判死;「空而有气填实就能动」这类话只允许以
   翻译+落结论的形态出现。
2. **新增 `clarity_rules` 段**(七条路由全部挂载):
   - ① SO-WHAT 测试:任何机制话(木局在动/自己还没到位)必须当句落到「对你这件事
     意味着什么」,未到位要说清在哪方面未到位、什么算到位;
   - ② 指代映射:兄弟爻等承重角色必须列 2-4 个现实可能(竞品/合伙人/渠道/自己分心),
     每个「可能」配确认条件,并给出不管是哪个都成立的影响面(抽的是钱/时间/用户/心力、
     是主要矛盾还是次要摩擦),「是哪个」放到结尾问用户;
   - ③ 时间跨度:先定问题问的是近期/年内/「以后」,结论和应期必须落在同一跨度;
     「以后」类问题禁止用本月日期或「现在行不通」作答,应期用地支**年**(寅年→2034)。
3. **删掉 72 小时行动块**(`density` TEST 3 重写 + deploy_voice 禁词):行动项改为可选、
   必须卦上有据;编凑出来的 to-do 列表明令禁止。
4. **结尾双拍**(output_sortis 新增第 7 节 / output_stria 收口改写):(a) 1-2 句重申与
   开头同向的结论;(b) 对悬而未决的指代,提 2-3 个一句话能答的针对性问题,说明在本线程
   补答即可比对细化、无需重新起卦。
5. **QC 清单同步重写**:问题按原时间跨度作答、净结论无跷跷板且首尾一致、SO-WHAT、
   指代映射、无 72 小时块、结尾重申+提问,全部入检。
6. **liuyao-ai.js TIMING REFERENCE 增加地支年表**(每支未来两个年份,注明立春分界),
   RULE 改为按问题跨度选尺度;JSON schema timing 字段提示同步。
7. **lang_zh 收紧**:中文解读禁止夹带英文过程词(verdict/yongshen 等,实测曾漏出)。

**真实验证**(非空跑):用生产同构管线组装 system+board,真实调用 OpenRouter
Opus 4.8 出两份完整解读(约 $0.15/份):
- 「我以后能住麓湖吗?我才大一」→ 开头即按「以后」定轴、按年读;净判「底子在,
  成得起来,要换一次轨」;应期 2028(申年,恰逢毕业)转轨、2031-32(亥子年)见果,
  无本月日期;兄弟爻列三个现实可能+影响;结尾重申结论+2 个针对性问题。九条投诉全过。
- 「我的SaaS能成吗」→ 净判一次成型全文不摇摆;三条大白话理由;木局金局全部落地;
  止损点卦上有据(六冲死穴=留存);结尾重申+3 问。唯一缺陷「verdict」漏词已回补规则。

版本:liuyao-ai.js / prompt-engine.js → ?v=20260719a。

### 补丁 — 带期限问题的结论绑定(2026-07-19)

新病例:「大学毕业前能创业成功吗」→ 第一句光秃秃「不成」,正文却「底子过硬」「后有转机」,
读者视角自相矛盾。修复(prompt-engine.js → ?v=20260719b):
- **DEADLINE-BOUNDED VERDICT**:带硬右边界的问题(毕业前/年底前/X岁前),结论必须绑定
  该窗口(「毕业前:成不了」),且若卦显示期限后落地,两截必须一口气说完(「期限内成不了;
  但事是活的,落地在X」),禁止把转机埋在后文。
- **POSITIVES TAKE A POSITION**:负面结论之后出现的每个好信号,必须当句摆明与结论的关系
  ——「为什么仍翻不了盘」或「期限后的本钱」,不许悬空。
- CLARITY ③ 增加 bounded-window 跨度;QC 清单第 1/2 条同步。
- 真实 Opus 4.8 验证(同款问题):开头即「毕业前这两年——成不了。但这事本身没死,落地
  窗口在毕业后 2028 申年前后。这两个话得连在一起听」;「底子过硬」被明确摆位。通过。

### 补丁 2 — 结论词正负由整条时间线决定(2026-07-19)

再报病例:开放式「能否创业成功」→ 先「不成」,后文又摆能成日期。病根:模型用**当下
卦面状态**选结论词,把落地窗口当补充贴后面。修复(prompt-engine.js → ?v=20260719c):
- **VERDICT POLARITY 决策程序**(动笔前必跑):卦上任何位置存在落地窗口 → 结论词只能
  是「能成」(限定:但不在眼下/要过坎/落地在X);「时机未到但底子在」只是「能成」的
  限定语,不是第三种极性。整个跨度无落地窗口 → 「不成」,且全文禁止出现成功日期。
- **硬规则**:「不成」+成功日期永不共存;唯一例外是带期限问题,且必须一口气写成
  「期限内不成(这事本身能成,落地在期限后的X)」。
- **发稿自检**:结论句与时间句并排读,极性不一致→改结论句。
- QC 第 2 条改为 POLARITY CHECK,违反即 FAIL。
- 真实 Opus 4.8 验证(开放式同题):判「不成,结构性,不是时机问题」,全文零日期,
  木局金局逐一摆位「没一个是来救钱的」,首尾同极性。通过。

### 补丁 3 — 过期标签页守卫(2026-07-20)

实锤病因:用户贴回的「不成+能成日期+72小时块」劣质输出,是**部署前就打开的旧标签页**
在用内存里的旧 prompt 引擎起卦(72小时块在 v-a 已禁,只有旧代码会生成)。HTML 本身
no-cache,刷新即新;但长开标签页永远不刷新。修复:
- 新增 `version.json`({"v":"20260720a"})+ index.html 内联 `window.BW_BUILD`。
- chat-app.js `send()` 拆为 preflight + `sendNow()`:起卦前(60s 节流、1.5s 超时、
  网络失败放行)比对 version.json;不一致 → 拦截并 toast「网站刚更新过——刷新页面
  后再起卦(这一卦未计费)」;preflight 闩防止校验窗口内双击双发。
- **今后每次部署必须同步 bump `window.BW_BUILD` 与 `version.json`。**
- 用用户原卦(天山遁→观,2026-07-19 甲午日未月,三四爻动)在当前规则下真跑 Opus:
  判词一次成型(「不成——盘里没有落地窗口」)、正确解出伏财寅木「伏而不出」、
  零日期零72小时块、结尾重申+3问。同卦新旧对比即是修复的直接证据。

---

## ✅ 已完成 — 六项界面与体验反馈(2026-07-20)

1. **首页问候语下的引导链接+墨线图形删除**(渲染成横贯页面的黑色笔刷,丑),改为
   **漫画式悬浮窗** `.guide-coach`(仿 signin-coach:白底墨框、硬阴影、上指箭头指向
   顶栏 How it works)。首次访问显示;点击→guide 并记 `bw:guideVisited`;×关闭记
   `bw:guideCoachDismissed`;点过 How it works 链接同样视为已访问。
2. **guide.html 去 AI 味重排版**:玻璃卡片 box + svg 图标全部移除,换编辑式排版
   (`.entries`/`.habit`:1.5px 墨色顶规则线、悬挂标题、Spinnaker 字距价格、Fraunces
   斜体 "Reach for it when…" 注、大号悬挂数字)。五步逐屏截图核验。
3. **背景动效 8 套配色**:mountain-range.js 从 5 套扩到 8 套(新增 Rose Dawn 玫瑰、
   Sage Valley 苔绿、Desert Night 沙靛),按暖冷交错排序,200s 一轮 → 每套 ~25s
   (原 40s),HOLD 0.6%。诊断确认原动画本就在跑(10 条 running),「不变」是
   40s×连续冷色系的感知问题。
4. **解读中断自动续写**:主卦输出中断(bw_meta incomplete、按实际计费退回其余)时,
   不再只 toast 让用户手发「继续」——自动以 followup 在**同一卦**上续写(700ms 后
   auto-send「继续」),每次中断只自动续一次;续写再中断则回落为提示,防循环。
5. **追问 vs 新卦误判**(「我什么时候第一次」→「我什么时候谈恋爱」被硬解同卦同用神):
   detectIntent 提示词改为按「同一件事」判定,写入正反判例,拿不准偏 NEW;
   prompt-engine §MOVE 同步改为两步测试(先判同事,不同事→温和引导新起一卦,
   绝不把旧用神硬套新事)。
6. 版本:BW_BUILD/version.json/chat-app/prompt-engine → 20260720b;
   mountain-range.js ?v= 全站九个页面统一 bump。

<!-- deploy-kick: GitHub 503 window likely dropped the Pages webhook for 0068837 -->

### 恢复 — 72 套季节配色轮转(2026-07-20)

用户指出曾有近百套配色的版本。考古:144 套品牌系统(b968c05 前)→ 36 套用户参考配色
(b968c05)→ 72 套(cb56e83)→ 季节化排序+手工撞色(c85912a)→ 第五轮性能优化时
被压成 5 套(f53f43b)。现将 c85912a 的 72 套 10 阶色标**原样**移植回当前性能架构
(hold-then-blend 防逐帧重绘、填充/等高线分层缓存):
- 10 条 keyframes 各 72 个色标,春10→夏16→秋34→冬12 按年序轮转;
- 周期 1440s(每套 ~20s,交叉渐变 ~1s,HOLD 0.07%);随机相位范围同步扩到 1440s;
- Playwright 四相位采样验证:春(钢蓝)/夏(皇家蓝奶油)/秋(藏青)/冬(靛黑)四色
  截然不同,动画 running。
- mountain-range.js ?v → 20260720c(九页),BW_BUILD/version.json → 20260720c。

### 微调 — 取消排卦图悬停背景变色(2026-07-20)

`.lyc-line:hover / .lyc-line.hot` 的灰底移除:行悬停仍驱动下方读爻面板、干支联动的
terracotta 文字强调与键盘焦点框保留,只有底色不再变。liuyao-chart.js → ?v=20260720d。

---

## ✅ 已完成 — 交互手感第一档(2026-07-20)

参照 Linear/Vercel/Stripe/Rauno 工艺派做法,不动艺术风格:
1. **动效令牌** `tokens/motion.css`:三曲线(--ease-out/--ease-in-out/--ease-spring)+
   三时长(120/240/480ms),挂进 styles.css(全站 ?v=20260720e);装饰性动画不动,
   交互层今后统一引用。
2. **按压态** `.pressable`:按下 scale(.97)、120ms 回弹(prefers-reduced-motion 关闭);
   已挂 index 八个核心控件(发送/方法chip/新问卦/充值/侧栏开关/两个coach/账户栏)+
   guide 向导三键。
3. **草稿持久化**:composer 按会话存 localStorage;刷新/切换会话/被拦(版本过期、
   点数不足)都不丢字;仅在卦真正提交时清除;提交 handler 不再预清空输入框。
4. **点数不足就地反馈**:不再瞬间跳转定价页——顶部点数 chip、侧栏余额、Add units
   按钮原地脉冲两下(terracotta)+ 双语 toast 指路;服务端 402 同样触发脉冲。
Playwright 验证:令牌解析、草稿跨刷新往返、pressable 挂载、脉冲动画名,全过,零报错。
版本:chat-app → 20260720e,BW_BUILD/version.json → 20260720e。

### 第二档 — 交互手感(2026-07-20)

1. **聊天玻璃去黄**:`.main::before` 的暖黄渐变(244,233,210)换成中性纸白雾
   (248,246,242,浓度减半、saturate 1.04)——用户截图反馈的「悬停区域发黄」即此面板;
   模糊保留(72 色山峦上的文字可读性靠它)。
2. **等待呼吸**:起卦等待期 send 按钮 1.7s 呼吸(opacity 1→.45),界面「在想」而非「死了」。
3. **键盘一等公民**:`/` 聚焦输入框、`n` 新问卦(输入状态自动忽略;Esc 关弹层已有)。
4. **阅读进度线**:thread 顶部 2px terracotta 细线,溢出 240px 才出现,rAF 跟随滚动,
   MutationObserver 覆盖流式增长。
5. **跨页过渡**:`@view-transition{navigation:auto}` 全站渐变翻页(渐进增强)。
版本:styles/motion → f,chat-app → 20260720f,BW_BUILD/version.json → 20260720f。

### 第三档 — 交互手感(2026-07-20)

1. **hover/touch 预取**(ds-base.js,全站):指针在内部页面链接停留 65ms 即注入
   `<link rel="prefetch">`,触屏 touchstart 立即预取;按 URL 幂等、上限 8、Save-Data/2G
   跳过;纯增强,失败静默。
2. **复制解读**:每篇解读末尾加 Copy 按钮(委托点击 → clipboard,回退 execCommand,
   「Copied/已复制」确认态);.rd-actions 淡入。
3. **触屏 44px 硬化**:`@media (pointer:coarse)` 给 ×关闭/删除/退出/发送等小图标控件
   补足 44×44 隐形点击区(::after,不改视觉大小),WCAG 2.5.5。
版本:ds-base/styles/motion/chat-app → 20260720g,BW_BUILD/version.json → 20260720g。
Playwright 验证:prefetch link 正确注入、复制往返成功(剪贴板=解读文本+done态)。

### 病根修复 — 聊天玻璃面板泛黄(2026-07-20)

用户两次反馈面板发黄未除。真因两处:(1) 上次去黄只改了无前缀 `backdrop-filter`,
而 Chromium/Edge 实际生效的 `-webkit-backdrop-filter` 仍是 `saturate(1.2)`——在给背后
暖色山峦**加饱和**染黄;(2) 中性薄纱太淡压不住背后 72 色轮转里的暖色系。
修复:两个前缀统一为 `blur(13px) saturate(.62)`(**去饱和**,任何配色背后都不吃色),
中性纸纱提到 ~.5。Playwright 钉最暖相位采样面板内部:RGB(234,234,234)、R−B=0、
饱和度 0.000,确认无色偏。BW_BUILD/version.json → 20260720h。

### 上下文修复 — 「再起一卦」承接主题(2026-07-20)

病例:聊某事时说「应该再起一卦」(未强调针对此事),分流器判 NEW(对,要新卦),
但传给模型的问题就是「应该再起一卦」——无主语 → general → 世爻 → 对用户本人做分析。
修:新增 bareRecast() 检测无自带主语的重起指令(再起/重新起/换一卦/cast again…,
剥离指令+中英填充词后残余≤3 字即判定);命中且线程有上一问时:
- 强制 decided="new"(用户要新卦象),跳过分流器;
- castQ 继承上一条真实问题作为新卦主题,传入 sortisReading/routedReading/askOracle;
- recast-note 改为「已就同一件事重新起了一卦:「<上一问>」」,承接透明。
history 仍带最近三轮,模型既得主题又得上下文。bareRecast 单测 11/12(中文全过)。
版本:chat-app → 20260720i,BW_BUILD/version.json → 20260720i。

### 上下文修复 2 — 重卜承接上文 + 禁念路由(2026-07-20)

病例:带论述的重卜消息「…等我创业赚钱就不一样…再起卦看看」被判普通新问,
模型开口念「这回起卦是新问」,让用户觉得没记得在聊同一件事。修:
- chat-app.js:抽 RECAST_RE/hasRecast();任何重卜指令(即便带大段论述)强制新卦象、
  跳过分流器(不会被降级成同盘追问);前端提示条对带论述重卜改为「已顺着这件事重新
  起了一卦」,不再说「新问题」。
- prompt-engine.js deploy_voice:新增「禁念路由」——不得把这一轮标注为新问/追问/
  这回起卦…(机器判断,念出来即破坏连续感);新增 CONTINUITY——有上文时必须接住:
  点名上一卦结论、用户新补的论据/反驳,正面权衡,别当第一次起卦。
真实 Opus 验证(带「上一卦说你漏财」历史 + 反驳性重卜):输出零「新问」念白、
开头即「这一卦几乎把上一卦结论又端上来…你觉得钱不会少,卦面看到进得来留不住」,
正面接住反驳。版本:chat-app/prompt-engine → 20260720j。

### 上下文修复 3 — 禁捏造卦象重复 + 禁说教(2026-07-20)

病例:第三次起卦(未济→鼎,本是不同卦)模型却说「又是这盘/同一个结构第三次冒出来/
牌面钉这儿不肯换,说明你还没听进去」——捏造卦象重复 + 反过来教训用户「不听劝」,
且不正面回答其合理论据。根因:上版 continuity 里「同一结构复现可当信号」被滥用。
修(prompt-engine.js,?v=20260720k):
- 删掉「复现可当信号」;deploy_voice 新增 READ-THIS-FIGURE:每卦独立随机,除非后端卦名
  逐字一致,否则禁称「又是这盘/同一个卦」(未济/鼎/蛊是三个不同卦,谎称重复=捏造);
- 新增 NEVER-SCOLD:重卜/反驳是正当付费行为,禁说「没听进去/否认/执迷」,禁拿「又问」
  当把柄;有论据必须当真掂量、该认的认、从本卦给真答案,engage≠说教;
- anti_failure 增 ANTI-CONDESCENSION + ANTI-FABRICATED-RECURRENCE 生成后自检。
真实 Opus 验证(不同卦名 + 反驳性重卜历史):零「又是这盘」、零说教、精准接住论据
(「你自控这条我信,不拿它说事儿……问题出在钱这条线本身」)。版本 → 20260720k。

### 四项 — 重卜高温/防截断/乐观暖语气/活人感(2026-07-20)

1. **重卜 temperature 拉满**:backend 接收 body.temperature(clamp 0–1)透传 OpenRouter;
   prompt-router makeComplete/makeStreamComplete + interpret 透传;chat-app 检测 recastReq
   → castTemp=1,重卜时模型跑热,「再起卦」真给新draw,不再近似复读。
2. **输出中断修复**:clampTokens 上限 8192→16384;主读调用 max_tokens 8192→12000
   (整篇 Sortis 4000–6000 CJK 字曾撞 8192 截断)。真实 12k 调用 finish_reason=stop 完整收尾。
   auto-continue 仍兜底。
3. **语气转乐观暖**(ux_core ① 重写 OPTIMISTIC FRAME):先把好处讲透讲足、坏处作
   友好提醒项+给出路,绝不渲染厄运;honesty floor 不谎报信号(死爻仍点破,乐观在框架
   与能量,不在说谎);答案是「此路不通」时立刻转向「但这条路开着」并把笔墨放在开口处。
   QC 第7条同步。
4. **恢复活人感**(deploy_voice 新增 ALIVE/WARM/PLAYFUL):像个来劲的朋友,轻松、有幽默、
   有个性、会对你的话作真人反应;读起来像和站你这边的高人聊天,不是风控报告;像合规
   备忘就判失败重写。真实验证:开头「先把话放桌上」、插话「我说得直白点你别急」,先整段
   讲透好处再软提醒风险。版本 → 20260720l。

### 病根终结 — 玻璃面板泛黄(saturate 0)(2026-07-20)

saturate(.62) 对最浓的暖色配色仍压不干净(62% 的浓琥珀=仍发黄;上次采样相位偏淡才误判
中性)。改 `saturate(0)`(完全去色)——背后 72 套任意配色都被压成灰度,颜色一丝上不来;
面板底色只由固定暖白纸纱决定。全周期 1440s 逐相位扫描:最坏暖色偏移 R−B=2(223,223,221),
肉眼中性。BW_BUILD/version.json → 20260720m。

### 语气回归 — 找回旧版纯文字提示词的暖厚质感(2026-07-20)

用户贴出旧版(纯文字提示词)满意的输出,指出现版模块化提示词丢了那种暖、厚、把卦象
逐条翻译成现实可查变量的质感——「体验极差」的根源;唯一要去掉的是催促性收尾
(「今天问得尽兴了/这个收尾」)。修(prompt-engine.js,?v=20260720n):
- clarity_rules ④ SYMBOL→REALITY:真实领域问题必须把每个承重爻翻译成具体可查的现实变量
  (含「去查什么」),范本=澳门录取那段;只映射真机制、不编假数据。
- deploy_voice 新增 RICH&VIVID&MOVING(有画面、有温度、成一整块暖文、要打动人)+
  PURELY-CARE-NO-NUDGE(禁一切催促/收尾/管教用户的话:今天问得尽兴了/这个收尾/该歇了/
  改天再来…;但保留把一天的卦串成对「你这个人」的洞察这种好东西)。
- QC 第12条加禁催促收尾,新增第13条 WARM/RICH/GROUNDED。
真实 Opus 验证(女儿澳门艺考录取):卦象逐条落到录取线/校考/候补等可查变量、暖、
乐观但诚实、结尾让家长去核数据、零催促收尾。版本 → 20260720n。

### 解读骨架按范本重写 — 流动暖文(2026-07-20)

用户上传满意范本(纯文字提示词时代),指出现版模块化的 8 层临床模板把「人味」切没了
(「像个人机」)。据范本把 output_sortis/output_stria 从「带标签分层模板」改成流动暖文骨架
(暖中文小标题,非临床英文):① 铺垫拉近 ② 卦盘块 ③ 判词 ④ 逐条(第一步…翻译成人话,
走遍盘上每条承重爻) ⑤ 收口一句 ⑥ 取象(人/关系问,4-6 条从高到低) ⑦ 畅想(必留、
最丰厚、3-4 个场景电影感,~1000-1500 字,不受 no-padding 约束) ⑧ 卦里的老话(合则引)
⑨ 我有几分把握(分档+追问)。字数 Sortis 5000-6000、Stria 2000-3000;含发稿前逐信号自检。
deploy_voice 把置信度标题改为自然中文口吻。真实 Opus 迭代:质感完全回到范本(暖开场
「十八岁就在想陪你到白头的那个人,这问得一点都不早,反倒挺动人」+ 逐条落地 + 三幕电影感
畅想),长度 2981→4038 字爬升;仍略短于 5-6k(密度禁水导致单盘诚实信息量的自然上限),
留待线上实测再定是否续推。版本 → 20260720o。
