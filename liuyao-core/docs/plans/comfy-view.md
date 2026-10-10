# 计划：把看卦流水线放进 ComfyUI，逐站可见

目标：在 ComfyUI 画布上，每个阶段一个节点，节点里直接显示 **提示词（system / user）、
输入、模型原始输出、程序判定**。流水线逻辑只写一份（`src/pipeline/`），ComfyUI 只是外壳。

规则：未勾选 = 未做；勾选前必须有测试或实测证据。⚠ = 需要用户判断或尚未验证的地方。

| # | 事项 | 做法 | 证据 | 状态 |
|---|---|---|---|---|
| 1 | 把阶段函数抽成 `src/pipeline/stages.js` | `askJSON`、理解、用神/排盘、检索、断法、综合各一个函数；`run.js` 改为调用它们 | `test/pipeline.mjs` 全部通过（行为不变）；`PipelineError` 一并搬入 | [x] |
| 2 | 演示模型移入 `pipeline/llm.js` 的 `createDemoLLM` | 原来只在 `cli.js` 里；断法站改为按 entryId 回应，使演示能走到综合 | `src/cli.js --mock` 跑完，12 条断法全部采用 | [x] |
| 3 | 桥接 `comfy/bridge.mjs` | 一个入口：`{stage, state, config}` → `{state, display}`；六个站（起卦、理解、排盘·用神、检索、断法、综合）加配置节点 | `test/comfy-bridge.mjs` | [x] |
| 4 | 桥接结果与 `runReading` 一致 | 同一卦、同一问题、同一演示模型，逐站拼起来的综合结果 = `runReading` 的结果 | `test/comfy-bridge.mjs` 第 1 段；变异检查：删掉输出标记则红 | [x] |
| 5 | Python 节点包 `comfy/comfyui-liuyao/` | 每站一个节点；节点调用 `node bridge.mjs`；错误直接抛到节点上 | `comfy/test_nodes.py`（经 `test/comfy-nodes.mjs` 进入总测试） | [x] |
| 6 | 工作流文件 `comfy/liuyao-reading.json` | 由 `comfy/build_workflow.py` 生成（UI 格式，可直接拖进画布） | `test/comfy-workflow.mjs`：与生成结果一致、节点已注册、连线两端一致、按连线跑通 = `runReading` | [x] |
| 7 | 显示格式：提示词、输入、输出分段 | 每个 LLM 站显示 `=== 系统提示 ===`、`=== 用户输入 ===`、`=== 模型输出 ===`、`=== 程序判定 ===` | 桥接测试与 `test_nodes.py` 检查四段都在 | [x] |
| 8 | 一键换真模型 | 配置节点 `mode=openrouter`，读环境变量 `OPENROUTER_API_KEY`；未设 key 时报错而不是静默演示 | `test/comfy-bridge.mjs` 第 5 段；`test_nodes.py` 缺 key 用例 | [x] |
| 9 | 节点不被缓存 | 所有节点 `IS_CHANGED` 返回 NaN，每次重跑 | `comfy/test_nodes.py` | [x] |
| 10 | 打包发给用户 | `comfy/` 整个目录（含 README、工作流 JSON）打 zip | 文件列表 | [ ] |
| 11 | ⚠ 未在真实 ComfyUI 里加载运行 | 本机没有 ComfyUI；节点的 UI 显示（`ui.text`）和 UI 格式连线只能按文档和结构测试 | — | [ ] ⚠ |
| 12 | ⚠ 演示模式的输出是占位，不是解读 | 只为验证连线和显示；要看真解读须配 key | — | [ ] ⚠ |
| 13 | ⚠ 依赖 Node 22 与本仓库路径 | 节点通过环境变量 `LIUYAO_CORE` 找到 `liuyao-core`，需先设置 | — | [ ] ⚠ |
