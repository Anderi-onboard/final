# 计划：直接接 Anthropic API，用自己的 key 与额度

| # | 事项 | 做法 | 证据 | 状态 |
|---|---|---|---|---|
| 1 | 适配器 `createAnthropicLLM` | `POST /v1/messages`，key 只放在 `x-api-key` 头；每个阶段用自己配置的模型名；文本块按顺序拼接 | `test/anthropic-adapter.mjs`（假的 fetch，无网络） | [x] |
| 2 | 失败不泄露 key | 错误只含状态码和 API 的 message | 同上，第 3 段 | [x] |
| 3 | 桥接 `mode: anthropic` | 缺 `ANTHROPIC_API_KEY` 报错，指名变量 | 同上，第 6 段 | [x] |
| 4 | 本地命令 `--anthropic` | 三种模式互斥；不给模式时按 OpenRouter → Anthropic → 演示 的顺序选；缺模型名时退出码 2 | 手动运行：互斥退出 2，缺模型名退出 2 | [x] |
| 5 | ComfyUI 配置节点加 `anthropic` 选项 | 报错文字指名对应的 key 变量 | `comfy/test_nodes.py`（只测了 mock 路径，anthropic 分支未在 ComfyUI 内运行） | [x] |
| 6 | 模型名不写进仓库 | 模型名只从环境变量读取；代码、注释、示例里都没有具体型号 | `grep` 检查：无匹配 | [x] |
| 7 | `.env.example` 给出字段 | `ANTHROPIC_API_KEY`、`ANTHROPIC_MODEL`，可按阶段覆盖 | 文件 | [x] |
| 8 | ⚠ 未用真实 key 调用过 | 开发环境没有 key，没有请求真实 API；需要你用自己的 key 运行一次 | — | [ ] ⚠ |
| 9 | ⚠ 提示词按演示输出的结构写，真实模型可能输出不合格 | 程序会重问一次，仍不合格则在该站停止并显示原因，不会悄悄跳过 | — | [ ] ⚠ |
