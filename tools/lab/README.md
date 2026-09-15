# 本地方案 —— 整站在本地跑,接本地大模型

**和线上的差别只有两样,都在 `.dev.vars` 里:上游端点、模型名。代码一行不改。**

浏览器 → `/api/claude` → `guardRequest`(计费闸 / 免费额度)→ 危机闸 →
`buildNode`(M1–M4)→ 上游模型 → SSE → 前端渲染象标记和追问面板 ——
跑的是 `wrangler pages dev`,也就是真的 Pages Functions,不是任何一个替身。

```bash
cp .dev.vars.example .dev.vars     # 改里面两行:端点 + 模型名
npm install
npm run local                      # → http://localhost:8788
```

`npm run local` 起之前先查三件**否则会在很晚才炸**的事:
`.dev.vars` 齐不齐 · 本地端点通不通、上面有没有你点名的模型 · 本地 D1 建过表没有。

## 起本地模型

任何讲 OpenAI `/v1/chat/completions` 的都行:

| | 命令 | `MODEL_BASE_URL` |
|---|---|---|
| Ollama | `ollama serve` | `http://localhost:11434/v1` |
| LM Studio | 开 Local Server | `http://localhost:1234/v1` |
| llama.cpp | `llama-server -m x.gguf` | `http://localhost:8080/v1` |
| vLLM | `vllm serve …` | `http://localhost:8000/v1` |

`.dev.vars` 里**分站配模型** —— 这就是拆四站的理由:

```ini
SORTIS_MODEL=qwen2.5:32b     # M4 写解读
UTILITY_MODEL=qwen2.5:7b     # M1 分类 / M2 选库 / M3 取证
LIVE_MODEL=on                # 不设就是离线模式(罐头解读、不计费)
```

⚠️ `LIVE_MODEL` 不是 `on` 时站点跑**离线模式** —— 返回罐头解读、不调模型、不计费。
那是线上的默认,不是 bug。

## 不下模型也能先验接线

```bash
node tools/lab/fake-model.mjs      # 假端点,:11434,每站答那一站的格式
```

**接线坏没坏和模型好不好是两件事。** 真模型要下几十个 G,而整条路 ——
计费闸、免费额度、危机闸、buildNode、SSE、前端 —— 用它几秒就能走一遍。
它还会**拒收 OpenRouter 的扩展字段**(`reasoning` / `usage`),真的 llama.cpp 和
vLLM 也会;不拒的话那条门控永远测不到,会一路绿到你换上真端点的那一天。

实测这条路跑通时:
```
M1/M2/M3 → fake-small(UTILITY_MODEL)· 非流式 · 不动账本
M4       → fake-big  (SORTIS_MODEL) · SSE   · charged 15 · unitsRemaining 4985
「我不想活了」→ 危机硬停,不调模型、不计费
第二次起卦 → insufficient units / TOPUP_REQUIRED(第一次把免费解读花掉了)
```

## 本地账号和点数

首卦免费,之后要点数。本地直接改库:

```bash
node_modules/.bin/wrangler d1 execute bournewise --local -y \
  --command "UPDATE users SET units=100000 WHERE email='你的邮箱'"
```

看它现在指着哪个上游:`curl http://localhost:8788/api/claude`

---

# 单站调试台 `tools/lab/run.mjs`

整站跑起来之后,**调某一站的提示词**用这个 —— 它不经过服务端,直接
`buildNode` + 本地模型,所以一次只重跑一站。

```bash
① node tools/lab/run.mjs --model qwen2.5:7b --q "…" --save
② 改 functions/_lib/nodes/prompts.js 里 M3 那一段
③ node tools/lab/run.mjs --only m3 --from tools/lab/runs/最新那个.json
```

③ 里 M1/M2 的输出从文件读,**不重新调模型**。盘一样、上游答案一样,
变的只有你刚改的那一段。

⚠️ **不钉住上游,你分不清这次答得不一样是因为提示词改了,还是因为 M1 这次答得不一样。**
小模型在同一个提示词上本来就会飘,这是调提示词最容易骗过自己的地方。
`--temp` 默认 0,同一条理由。

| | |
|---|---|
| `--base` | 端点,默认 `http://localhost:11434/v1`(或 `LAB_BASE`) |
| `--model` | 全局,或分站 `m1=…` |
| `--seed` | 投掷种子,默认 `1`(**同一副盘**);`--seed random` 才真摇 |
| `--q` `--facts` `--gender` | 问题 / 他说的既成事实 / `m`\|`f` |
| `--db` | **旁路**:M1 没跑时给用神一个领域。**线上没有这个旁路** |
| `--only` `--from` | 只跑某一站 / 上游从这个 run 文件读 |
| `--dry` `--raw` `--save` `--list` | 不调模型 / 打全文 / 存 / 列模型 |

**盘那一半没有模型** —— 投掷、排盘、取用神、裁决梯、feature、关系全是
`liuyao-*.js` 算的。`--seed` 一样,盘就一定一样。模型答错时先看盘对不对。

## 每一站在看什么

| 站 | 它该做的 | 出了问题先看 |
|---|---|---|
| **M1** | `lang/db/ask/hurt/[more]/flags/facts` | `db=` 错 → 整盘用神就错;`facts=` 漏抄 → 下游只能猜 |
| **M2** | `lib=…` 每行一个 | 硬凑(提示词写着「一个都不选也可以」) |
| **M3** | `程/法/实/推` + `撑/驳/救/缺` + `链=` | **链接不上行号**;用了条件不成立的卡 |
| **M4** | 解读本身 | 出现术语;漏 `{词\|符号}` → 页面上象按钮全黑 |

⚠️ **M3 只看得见 M2 开的那几个库的卡**(收窄在 `fill.js`)。M2 少选一个库,
M3 就再也看不到那个库的卡,**而它照样有卡可读、照样交得出材料**。
