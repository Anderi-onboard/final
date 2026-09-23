#!/usr/bin/env node
/* 把这套节点打成一个**自带全部依赖**的包 —— 解开就能用,不需要仓库。
   ────────────────────────────────────────────────────────────────────────
     node tools/comfy/pack.mjs               → dist/bournewise-comfy-<tag>.zip
     node tools/comfy/pack.mjs --stage <dir> → 只铺开,不压缩(契约用这个)

   ⚠️ **一个包就是一份复制品,而这套东西全部的架构前提是「不要复制」。**
      所以这里定了三条,让它是**构建产物**而不是分叉:

     ① **包里每一个文件都和仓库里的字节完全一致。** 一个都不改写路径、
        不改写 import。做法是把仓库的目录结构原样放进 `repo/`,于是
        `nodes.py` 的 `parents[2]`、`bridge.mjs` 的 `../../functions/…`、
        `board.mjs` 的 `ROOT` 全都自动落对 —— 不需要为打包改任何一行。
        唯一新写的文件是最外面那个 5 行的 `__init__.py`。
     ② **文件清单是算出来的,不是写死的。** 顺着 import 走闭包,再把
        `board.mjs` 里那张 vm 加载表**从它自己身上解析出来**。有人给
        `fill.js` 加一个 import、或者往 vm 表里加一个引擎文件,包会自动带上它 ——
        写死名单的话,漏掉的那个文件会让包在**用户那台机器上**才炸。
     ③ **`MANIFEST.json` 记下源提交和每个文件的 sha256。** 包和仓库对不对得上,
        是可以查的,不是靠相信。

   ⚠️ 不许有任何 npm 依赖。包里没有 node_modules,一个 bare import 就是
      「在我这儿好好的」—— 所以下面撞见非内置的裸 import 会直接报错。
*/
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { builtinModules } from "node:module";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const rel = (p) => path.relative(ROOT, p).split(path.sep).join("/");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const sha = (buf) => crypto.createHash("sha256").update(buf).digest("hex");
const BUILTIN = new Set([...builtinModules, ...builtinModules.map((m) => "node:" + m)]);

/* ── 闭包 ────────────────────────────────────────────────────────────────── */
const SEEDS = ["tools/comfy/bridge.mjs", "tools/lab/run.mjs", "tools/lab/fake-model.mjs"];

/* 不经 import 进来的那一半:`board.mjs` 用 vm 把浏览器引擎装进沙箱,文件名写在
   它自己的一个数组里。**从它身上解析**,而不是在这里再抄一份 —— 抄一份就是
   本仓库付过四次学费的那张「第二名单」,而这次的症状是包少带一个引擎文件。 */
function vmFiles() {
  const src = read("tools/lab/board.mjs");
  const block = src.match(/for \(const f of \[([\s\S]*?)\]\)/);
  if (!block) throw new Error("board.mjs 里那张 vm 加载表解析不出来 —— 它的写法变了,包会少带引擎文件");
  const names = [...block[1].matchAll(/"([^"]+\.js)"/g)].map((m) => m[1]);
  if (names.length < 5) throw new Error(`vm 加载表只解析到 ${names.length} 个文件(应 ≥5)—— 正则失配了`);
  return names;
}

const IMPORT_RE = /(?:^|\n)\s*(?:import\s[\s\S]*?from\s*|import\s*|export\s[\s\S]*?from\s*)["']([^"']+)["']/g;

function closure() {
  const seen = new Set();
  let found = 0;
  const walk = (file) => {
    if (seen.has(file)) return;
    seen.add(file);
    const src = read(file);
    for (const m of src.matchAll(IMPORT_RE)) {
      const spec = m[1];
      if (BUILTIN.has(spec)) { found++; continue; }
      if (!spec.startsWith(".")) {
        throw new Error(`${file} 里 import 了 "${spec}" —— 它既不是 node 内置也不是相对路径。`
          + "包里没有 node_modules,一个 npm 依赖会让它在用户那台机器上才炸。");
      }
      found++;
      walk(rel(path.resolve(ROOT, path.dirname(file), spec)));
    }
  };
  SEEDS.forEach(walk);
  vmFiles().forEach((f) => seen.add(f));
  if (found < 8) throw new Error(`只解析到 ${found} 条 import —— 正则失配了,闭包是假的`);
  return [...seen].sort();
}

/* import 之外的东西:Python、图、说明。它们不会被 import 发现。 */
const EXTRA = [
  "tools/comfy/__init__.py",
  "tools/comfy/nodes.py",
  "tools/comfy/build_workflow.py",
  "tools/comfy/README.md",
  "tools/lab/README.md",
  ...fs.readdirSync(path.join(ROOT, "tools/comfy/workflows"))
    .filter((f) => f.endsWith(".json"))
    .map((f) => "tools/comfy/workflows/" + f),
  /* ⚠️ 补全包那 46 条是 `criteria-rules.mjs` 用 **fs** 读的,不是 import 的 ——
     **闭包看不见它们**。判据引擎少了规则不会报语法错,它会老老实实算出
     「0 条判据成立」,而那读起来像「这副盘没什么可说的」。
     按目录扫,不手抄名单:往那个目录里加一份材料,这里自动跟上。 */
  ...fs.readdirSync(path.join(ROOT, "functions/_lib/doctrine/pack-20260914"))
    .map((f) => "functions/_lib/doctrine/pack-20260914/" + f)
];

/* ── 最外面那个 shim —— 包里唯一不是从仓库复制来的文件 ────────────────────
   ⚠️ **不许用 `sys.path` 把 `tools/` 塞进去。** `tools/comfy` 这个目录名叫
      `comfy`,而 ComfyUI 自己的顶层包也叫 `comfy` —— 插到 sys.path 最前面
      会把整个 ComfyUI 的 `comfy` 模块盖掉。按文件路径加载就没有这个问题。 */
const SHIM = `# -*- coding: utf-8 -*-
"""BourneWise · ComfyUI —— 自带依赖的包(四站 + 解谜管线)。

把这个文件夹整个放进 ComfyUI/custom_nodes/,重启 ComfyUI,就有节点了。
除了 node ≥18 要在 PATH 上(盘和提示词在 JS 那边),没有别的依赖。

⚠️ 这里按**文件路径**加载 repo/tools/comfy/nodes.py,而不是把 repo/tools
   插进 sys.path:那个目录叫 comfy,而 ComfyUI 自己的顶层包也叫 comfy,
   插进去会把整个 ComfyUI 的 comfy 模块盖掉。
"""
import importlib.util as _u, pathlib as _p

_f = _p.Path(__file__).resolve().parent / "repo" / "tools" / "comfy" / "nodes.py"
_s = _u.spec_from_file_location("bournewise_comfy_nodes", _f)
_m = _u.module_from_spec(_s)
_s.loader.exec_module(_m)

NODE_CLASS_MAPPINGS = _m.NODE_CLASS_MAPPINGS
NODE_DISPLAY_NAME_MAPPINGS = _m.NODE_DISPLAY_NAME_MAPPINGS
__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS"]
`;

/* ── 铺 ──────────────────────────────────────────────────────────────────── */
export function stage(dest) {
  const files = [...new Set([...closure(), ...EXTRA])].sort();
  const root = path.join(dest, "bournewise-comfy");
  fs.rmSync(root, { recursive: true, force: true });

  const manifest = {};
  for (const f of files) {
    const buf = fs.readFileSync(path.join(ROOT, f));
    const out = path.join(root, "repo", f);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, buf);
    /* ① 逐个复核字节一致 —— 「复制过去了」和「复制对了」是两件事。 */
    if (sha(fs.readFileSync(out)) !== sha(buf)) throw new Error(`${f} 复制后对不上`);
    manifest[f] = sha(buf);
  }

  fs.writeFileSync(path.join(root, "__init__.py"), SHIM);
  /* ⚠️ 文件名用 ASCII。zip 里的中文名靠一个 UTF-8 标志位,Windows 上一部分
     解压工具会把它解成乱码 —— 一份打开就是乱码的说明等于没有说明。 */
  fs.writeFileSync(path.join(root, "README.md"), INSTALL);

  let commit = "(不在 git 工作树里)";
  try {
    commit = execFileSync("git", ["-C", ROOT, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  } catch { /* 包在没有 git 的地方也要打得出来 */ }
  fs.writeFileSync(path.join(root, "MANIFEST.json"), JSON.stringify({
    name: "bournewise-comfy",
    builtAt: new Date().toISOString(),
    sourceCommit: commit,
    note: "repo/ 底下每一个文件都和仓库里的字节完全一致(sha256 见 files)。"
      + "包外只有 __init__.py、README.md 和这个文件是新写的。",
    files: manifest
  }, null, 2) + "\n");

  return { root, files };
}

const INSTALL = `# BourneWise · ComfyUI(自带依赖)

**放进去就能用,不需要 git,不需要这个仓库。**

## 装

把 \`bournewise-comfy\` 这整个文件夹放进 ComfyUI 的 \`custom_nodes/\`:

    ComfyUI/custom_nodes/bournewise-comfy/     ← 就是解开后的这个文件夹

重启 ComfyUI。节点在 \`BourneWise\` 和 \`BourneWise/解谜\` 两个分类下。

**唯一的外部要求:\`node\` ≥ 18 在 PATH 上。** 盘(排盘、用神、裁决梯)和提示词
都在 JS 那边,所以这套节点要 node 来跑它们。ComfyUI 看不见 node 的话,
给 ComfyUI 设一个环境变量 \`BW_NODE_BIN=/绝对路径/node\`。

**没有任何 Python 依赖**,也**没有任何 npm 依赖** —— 包里没有 node_modules,
因为它一个第三方库都不用。

## 四张图(\`repo/tools/comfy/workflows/\`)

| | |
|---|---|
| \`bournewise-puzzle.json\` | **解谜管线**:读问题 → 程序出题 → 每条线索一个模型(一条一条跑)→ 验现事 → 解谜。 |
| \`bournewise-puzzle-dry.json\` | 解谜管线,**一个模型都不用下**:M1 钉住一段示范答案,后面每一站只建提示词。 |
| \`bournewise-4node.json\` | 四站(线上那条)真跑。要一个本地模型端点。 |
| \`bournewise-4node-dry.json\` | **一个模型都不用下** —— 每一站只建提示词、不调模型,把 system 全文打在「注」里。想先看看这套东西在对模型说什么,开这张。 |

## Unsloth + Qwen3.8

    unsloth run --model unsloth/Qwen3.8-27B-GGUF:UD-Q4_K_XL -p 8888 --disable-tools \\
      --chat-template-kwargs '{"reasoning_effort":"none"}'

「BW 端点」填 \`http://127.0.0.1:8888/v1\` 和 Unsloth 在 Settings → API 里给的
\`sk-unsloth-…\`,**模型名全部留空**(留空 = 用端点上列出的第一个)。
Windows PowerShell 里那段 JSON 要写成 \`"{\\"reasoning_effort\\":\\"none\\"}"\`。

拖进画布即可。

## 左下角那一列:盘 → 四张表 → 判据

这一列全是代码,一个模型都不用,端点也不用连。想看懂这套东西在干什么,
从它开始看。

| 节点 | 它给你什么 |
|---|---|
| BW 起卦 | 投掷、排盘、取用神、裁决梯 |
| BW 四张表 | 把盘摊成 CSV。爻是点,爻与爻的关系是边,两者行数不同,所以分四张。 |
| BW 判据 | 《增删卜易》36 条,逐条判。输出是:第 5 爻是进神,依据是它的旺衰旺、化出旺衰旺。 |

**判据节点不下结论。** 它报哪几条成立、各自读的是哪一格,不报忌神能克。
200 副盘实测,能克与不能克同时成立的有 60 副。原书那几条有先后,
而该先后没有写进那 46 条的任何一个字段。在这里输出一个总的真假,
30% 的盘上等于掷硬币,而且掷完看不出来是掷的。轻重交给 M4,依据由这一步给全。

判据只读四张表,读不到盘。表够不够用,只有在求值器除表以外什么都看不见时
才证明得了。

这一步的结果目前没有进 M3 的提示词。M3 需要加一个 \`{{criteria}}\` 槽才吃得到,
那要改产品本身,还没做。

## 先不下模型,验一遍接线

    node repo/tools/lab/fake-model.mjs

它在 :11434 起一个假端点,每一站答那一站的格式(四站和解谜都认)。**接线坏没坏和
模型好不好是两件事** —— 真模型要下几十个 G,而整条路用它几秒就能走一遍。
「BW 端点」填 \`http://localhost:11434/v1\`,模型名留空。

## 换成真模型

任何讲 OpenAI \`/v1/chat/completions\` 的都行:

| | 命令 | 端点 |
|---|---|---|
| Unsloth | \`unsloth run --model … -p 8888\` | \`http://127.0.0.1:8888/v1\` |
| Ollama | \`ollama serve\` | \`http://localhost:11434/v1\` |
| LM Studio | 开 Local Server | \`http://localhost:1234/v1\` |
| llama.cpp | \`llama-server -m x.gguf\` | \`http://localhost:8080/v1\` |
| vLLM | \`vllm serve …\` | \`http://localhost:8000/v1\` |

**分站配模型就是拆四站的理由**:M1/M2/M3 是分类、选库、取证,小模型够用;
M4 要写一整篇,给它大的。

## 包里有什么

\`repo/\` 底下每一个文件都和仓库里**字节完全一致** —— 没有为了打包改写过任何
一行 import 或路径。\`MANIFEST.json\` 记着源提交和每个文件的 sha256,对不对得上
是可以查的,不是靠相信。

    repo/liuyao-*.js                      排盘 / 关系 / 裁决梯 / feature / 取用神
    repo/functions/_lib/nodes/            四站的提示词和填槽(产品用的就是这两个文件)
    repo/functions/_lib/doctrine/rag/     11 个库 / 29 张断法卡
    repo/functions/_lib/doctrine/criteria.js       判据求值(只看 CSV,不下结论)
    repo/functions/_lib/doctrine/pack-20260914/    《增删卜易》46 条,逐条带印刷页码
    repo/tools/comfy/                     节点本体 + 两张图
    repo/tools/lab/                       假端点、单站调试台

包外只有三个文件是新写的:\`__init__.py\`(5 行,加载上面那个 nodes.py)、
这份说明(\`README.md\`)、\`MANIFEST.json\`。

## 怎么调

改 \`repo/functions/_lib/nodes/prompts.js\` 里对应那一段,存盘,在 ComfyUI 里
再跑一次 —— **只有那一站和它下游重跑**,上游和盘原封不动(每一站的提示词
分别取哈希)。所以你分得清"这次答得不一样"是因为提示词改了,而不是因为
上一站这次答得不一样。

⚠️ \`temperature\` 默认 0。不是 0 的时候你在调噪声,不是在调提示词。
`;

/* ── 跑 ──────────────────────────────────────────────────────────────────── */
if (import.meta.url === "file://" + process.argv[1]) {
  const i = process.argv.indexOf("--stage");
  const dest = i >= 0 ? path.resolve(process.argv[i + 1]) : path.join(ROOT, "dist");
  fs.mkdirSync(dest, { recursive: true });
  const { root, files } = stage(dest);
  console.log(`铺开 ${path.relative(ROOT, root) || root} —— ${files.length} 个文件,全部字节一致`);

  if (i < 0) {
    let tag = "dev";
    try { tag = JSON.parse(read("version.json")).v; } catch { /* 没有就叫 dev */ }
    const zip = path.join(dest, `bournewise-comfy-${tag}.zip`);
    fs.rmSync(zip, { force: true });
    execFileSync("zip", ["-rq", zip, "bournewise-comfy"], { cwd: dest });
    const kb = Math.round(fs.statSync(zip).size / 1024);
    console.log(`打包 ${path.relative(ROOT, zip)} —— ${kb}KB`);
  }
}
