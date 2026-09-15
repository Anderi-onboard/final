# 本地调试台 —— 用本地大模型跑四节点,一站一站调

调的是**上线那份提示词**(`functions/_lib/nodes/prompts.js` + `fill.js` 的真 `buildNode`),
不是它的复制品。抄一份到这里,你调的就是调试台。

## 起本地服务

任何讲 OpenAI `/v1/chat/completions` 的都行:

| | 命令 | 端点 |
|---|---|---|
| Ollama | `ollama serve` | `http://localhost:11434/v1` |
| LM Studio | 开 Local Server | `http://localhost:1234/v1` |
| llama.cpp | `llama-server -m x.gguf` | `http://localhost:8080/v1` |
| vLLM | `vllm serve …` | `http://localhost:8000/v1` |

```bash
node tools/lab/run.mjs --list                 # 看端点上有哪些模型
```

## 跑一遍

```bash
node tools/lab/run.mjs \
  --model qwen2.5:7b \
  --q "我和她还有可能吗 会在一起并肩作战吗" \
  --facts "她是大学生;学医;现在在忙学业" \
  --gender m --seed 23 --save
```

**分站配模型** —— 这是拆成四站的全部理由,M1 是四行分类、M2 是选几个库,小模型就够:

```bash
  --model m1=qwen2.5:3b --model m2=qwen2.5:3b \
  --model m3=qwen2.5:14b --model m4=qwen2.5:32b
```

## ⭐ 调一站的工作流

**这是这个工具存在的全部理由。**

```bash
# ① 跑一整遍,存下来
node tools/lab/run.mjs --model qwen2.5:7b --q "…" --save
#    → 存了 tools/lab/runs/2026-09-15T....json

# ② 改 functions/_lib/nodes/prompts.js 里 M3 那一段

# ③ 只重跑 M3,上游钉住
node tools/lab/run.mjs --only m3 --from tools/lab/runs/2026-09-15T....json --model qwen2.5:14b
```

③ 里 M1/M2 的输出从文件读,**不重新调模型**。盘一样、上游答案一样,
变的只有你刚改的那一段。

⚠️ **不钉住上游,你分不清这次答得不一样是因为提示词改了,还是因为 M1 这次答得不一样。**
小模型在同一个提示词上本来就会飘,这是调提示词时最容易骗过自己的地方。

⚠️ **`--temp` 默认 0,调提示词时别动它。** 温度 >0 时你在调噪声。

## 参数

| | |
|---|---|
| `--base` | 端点,默认 `http://localhost:11434/v1`(或 `LAB_BASE`) |
| `--model` | 全局,或分站 `m1=…`(或 `LAB_MODEL`) |
| `--seed` | 投掷种子,默认 `1`(**同一副盘**);`--seed random` 才真摇 |
| `--q` `--facts` `--gender` | 问题 / 他说的既成事实 / `m`\|`f` |
| `--db` | **旁路**:M1 没跑时给用神一个领域。线上没有这个旁路 |
| `--only` `--from` | 只跑某一站 / 上游从这个 run 文件读 |
| `--dry` | 只打印提示词,不调模型 |
| `--raw` | 连 system 全文 + 裁决梯 + 关系一起打印 |
| `--save` | 存进 `tools/lab/runs/` |
| `--temp` `--timeout` | 默认 `0` / `300000`ms(本地首次加载权重很慢) |

## 每一站在看什么

| 站 | 它该做的 | 出了问题先看 |
|---|---|---|
| **M1** | 四到六行:`lang/db/ask/hurt/[more]/flags/facts` | `db=` 错 → 整盘用神就错;`facts=` 漏抄 → 下游只能猜 |
| **M2** | `lib=…` 每行一个 | 硬凑(提示词写着「一个都不选也可以」) |
| **M3** | `程/法/实/推` 四层 + `撑/驳/救/缺` + `链=` | **链接不上行号**;用了条件不成立的卡 |
| **M4** | 解读本身 | 出现术语;漏 `{词\|符号}` 标记 → 页面上象按钮全黑 |

⚠️ **M3 只看得见 M2 开的那几个库的卡** —— 收窄在 `fill.js` 里。
M2 少选一个库,M3 就再也看不到那个库的卡,**而它照样有卡可读、照样交得出材料**。

## 盘那一半没有模型

投掷、排盘、取用神、裁决梯、feature、关系 —— 全是 `liuyao-*.js` 算的,
调试台只是把它们装进 node 沙箱跑。所以 `--seed` 一样,盘就一定一样,
**和模型无关**。模型答错时,先看盘对不对,再看提示词。
