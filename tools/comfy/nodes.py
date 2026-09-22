# -*- coding: utf-8 -*-
"""BourneWise 四节点 —— ComfyUI 节点。

────────────────────────────────────────────────────────────────────────────
这个文件里**没有提示词,也没有盘**。它只是画布:插口、控件、连线、显示。
盘从 `liuyao-*.js` 出,提示词从 `functions/_lib/nodes/` 出,两样都经
`bridge.mjs` —— 它 import 的是仓库里那几个**真文件**,不是复制品。

⭐ 为什么值得搬到 Comfy 上:**它的执行缓存就是 `--only m3 --from run.json`。**
   改 `prompts.js` 里 M3 那一段、存盘、再跑一次 —— 只有 M3 和它下游重跑,
   M1/M2 和盘原封不动。不需要再手动钉住上游,也就不会忘了钉。
   (`IS_CHANGED` 把每一站的提示词分别取哈希,所以改 M4 不会牵动 M1。)

⚠️ 两条从 `tools/lab/run.mjs` 原样搬过来的规矩,别在画布上把它们绕过去:
   ① **temperature 默认 0。** 不是 0 的时候你在调噪声,不是在调提示词。
   ② **facts 拼进问题里发,不是另开一个字段。** 线上没有那个字段 —— 人就是
      把「她是医学生」打在问题里的,而 M1 的活正是**从他打的字里**把既成事实
      抄出来。单开一个字段直接喂给它,等于替它做了那一步,于是画布上永远
      测不出它会不会漏抄。
"""

import hashlib
import json
import os
import shutil
import subprocess
from pathlib import Path

CATEGORY = "BourneWise"

# ── 找仓库 ──────────────────────────────────────────────────────────────────
# 这个包是**软链**进 ComfyUI/custom_nodes 的(README 里写着),所以 resolve()
# 会落回仓库里,相对 import 才成立。复制一份进去就是又一张要同步的名单。
ROOT = Path(os.environ.get("BOURNEWISE_ROOT") or Path(__file__).resolve().parents[2])
BRIDGE = Path(__file__).resolve().parent / "bridge.mjs"
_PROMPTS = ROOT / "functions" / "_lib" / "nodes" / "prompts.js"
_FILL = ROOT / "functions" / "_lib" / "nodes" / "fill.js"
_RAG = ROOT / "functions" / "_lib" / "doctrine" / "rag"


def _node_bin():
    n = os.environ.get("BW_NODE_BIN") or shutil.which("node")
    if not n:
        raise RuntimeError(
            "PATH 上没有 node。盘和提示词都在 JS 那边,所以这套节点要 node ≥18。\n"
            "装了但 ComfyUI 看不见的话,给 ComfyUI 设一个 BW_NODE_BIN=/绝对路径/node"
        )
    return n


def _bridge(cmd, payload):
    if not _FILL.exists():
        raise RuntimeError(
            "找不到仓库:%s 不存在。\n"
            "这套节点要软链进 ComfyUI,不要复制:\n"
            "  ln -s /你的路径/final/tools/comfy ~/ComfyUI/custom_nodes/bournewise\n"
            "已经复制过来了的话,给 ComfyUI 设 BOURNEWISE_ROOT=/你的路径/final" % _FILL
        )
    p = subprocess.run(
        [_node_bin(), str(BRIDGE), cmd],
        input=json.dumps(payload, ensure_ascii=False),
        capture_output=True, text=True, encoding="utf-8", cwd=str(ROOT),
    )
    out = None
    if p.stdout.strip():
        try:
            out = json.loads(p.stdout)
        except json.JSONDecodeError:
            pass
    if out is None:
        raise RuntimeError(
            "bridge %s 没回 JSON(退出码 %s)——\n%s" % (cmd, p.returncode, (p.stderr or "").strip()[-2000:])
        )
    if out.get("error"):
        raise RuntimeError(out["error"])
    return out


# ── 每一站的提示词哈希 ──────────────────────────────────────────────────────
def _block(src, name):
    """从 prompts.js 里切出 `export const NAME = \\`…\\`` 那一段。

    这些模板里没有 `${}`(prompts.js 为此一直用「」代替反引号),所以扫到第一个
    没被转义的反引号就是结尾。⚠️ **切不出来时回落到整份文件** —— 多重跑几站
    只花时间,少重跑一站会让你对着**上一版提示词的答案**调这一版,
    而那是「绿色比红色更糟」的那种失败。
    """
    key = "export const %s = `" % name
    i = src.find(key)
    if i < 0:
        return None
    j = i + len(key)
    while j < len(src):
        if src[j] == "\\":
            j += 2
            continue
        if src[j] == "`":
            return src[i:j + 1]
        j += 1
    return None


def _read(p):
    try:
        return p.read_text(encoding="utf-8")
    except OSError:
        return ""


_BLOCKS = {"m1": ["M1"], "m2": ["M2"], "m3": ["M3"], "m4": ["M4", "MARK"]}


def _prompt_hash(station):
    src = _read(_PROMPTS)
    parts = []
    for name in _BLOCKS.get(station, []):
        b = _block(src, name)
        parts.append(b if b is not None else src)
    parts.append(_read(_FILL))          # 填槽和 VOICE 都在这儿,每一站都受它影响
    if station in ("m2", "m3"):         # 选库/开卡跟着检索表走
        parts.append(_read(_RAG / "data.js"))
        parts.append(_read(_RAG / "retrieve.js"))
    return hashlib.sha256("\0".join(parts).encode("utf-8")).hexdigest()


# ── 端点 ────────────────────────────────────────────────────────────────────
class BWEndpoint:
    """本地模型端点。Ollama / LM Studio / llama.cpp / vLLM 都讲这一套。"""

    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {
            "base_url": ("STRING", {"default": "http://localhost:11434/v1",
                                    "tooltip": "ollama serve → :11434/v1 · LM Studio → :1234/v1 "
                                               "· llama-server → :8080/v1 · vLLM → :8000/v1"}),
            "api_key": ("STRING", {"default": "local"}),
            "timeout_s": ("INT", {"default": 600, "min": 10, "max": 7200,
                                  "tooltip": "本地大模型第一次加载权重很慢,别设太小"}),
        }}

    RETURN_TYPES = ("BW_CONN", "STRING")
    RETURN_NAMES = ("端点", "端点上有什么")
    FUNCTION = "go"
    CATEGORY = CATEGORY
    DESCRIPTION = "接一个 OpenAI 兼容的本地端点,并把它上面的模型列出来。"

    @classmethod
    def IS_CHANGED(cls, **kw):
        return float("nan")   # 每次都问一遍端点通不通 —— 一次 /models,几毫秒

    def go(self, base_url, api_key, timeout_s):
        conn = {"base": base_url.strip(), "key": api_key.strip(), "timeout": int(timeout_s) * 1000}
        # ⚠️ 端点挂了**不抛** —— 抛在这里整张图都不跑,而你想看的恰恰是「它为什么挂」。
        #    真正要模型的那几站会自己抛,报的是自己那一站的错。
        try:
            ms = _bridge("models", {"conn": conn}).get("models", [])
            note = "%s\n%d 个模型:\n  %s" % (conn["base"], len(ms), "\n  ".join(ms) or "(空)")
        except Exception as e:  # noqa: BLE001
            note = "%s\n⚠️ 连不上:%s" % (conn["base"], e)
        return (conn, note)


# ── 问题 ────────────────────────────────────────────────────────────────────
class BWAsk:
    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {
            "question": ("STRING", {"multiline": True,
                                    "default": "我和她还有可能吗 会在一起并肩作战吗"}),
            "facts": ("STRING", {"multiline": True, "default": "",
                                 "tooltip": "他自己说的既成事实。**会被拼进问题里发给 M1**,"
                                            "不是另开一个字段 —— 线上没有那个字段。"}),
            "gender": (["自动(跟 M1)", "男 m", "女 f"],),
        }}

    RETURN_TYPES = ("BW_ASK", "STRING")
    RETURN_NAMES = ("问题", "M1 收到的原文")
    FUNCTION = "go"
    CATEGORY = CATEGORY
    DESCRIPTION = ("问题 + 他自己说的既成事实。facts 拼进问题里发,不单开字段:"
                   "M1 的活正是从他打的字里把既成事实抄出来(facts= 那一行),"
                   "单喂给它就等于替它做了那一步,于是永远测不出它会不会漏抄。")

    def go(self, question, facts, gender):
        q = question.strip()
        f = facts.strip()
        ask = q + ("。" + f if f else "")
        g = {"男 m": "m", "女 f": "f"}.get(gender, "")
        return ({"question": q, "facts": f, "ask": ask, "gender": g}, ask)


# ── 起卦 ────────────────────────────────────────────────────────────────────
class BWCast:
    """投掷 → 排盘 → 取用神 → 裁决梯 → feature → 关系。**全是代码,没有模型。**"""

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "问题": ("BW_ASK",),
                "seed": ("INT", {"default": 1, "min": 0, "max": 0xFFFFFFFF,
                                 "control_after_generate": True,
                                 "tooltip": "同一个种子 = 同一副盘。调提示词时必须钉住 —— "
                                            "盘一变你就分不清「这次答得不一样」是提示词改了还是卦不同了。"}),
                "db_旁路": ("STRING", {"default": "",
                                     "tooltip": "⚠️ 旁路,线上没有。M1 没接上时给用神一个领域"
                                                "(婚恋/工作/考试/官司/疾病/求财/失物/出行)。"
                                                "接了 M1 就别填 —— db 只该来自 M1。"}),
            },
            "optional": {
                "M1": ("BW_M1", {"tooltip": "⚠️ 接上它。用神由 M1 的 db= 定;不接就退回世爻,"
                                            "而那副盘照样能跑完四站。"}),
            },
        }

    RETURN_TYPES = ("BW_BOARD", "STRING")
    RETURN_NAMES = ("盘", "盘面")
    FUNCTION = "go"
    CATEGORY = CATEGORY
    DESCRIPTION = "这一步没有模型。用神要 M1 的 db=,所以图上 M1 排在起卦前面。"

    def go(self, 问题, seed, db_旁路, M1=None):
        db = ((M1 or {}).get("parsed", {}) or {}).get("db", "") or db_旁路.strip()
        gender = 问题.get("gender") or ((M1 or {}).get("parsed", {}) or {}).get("gender", "")
        b = _bridge("board", {"seed": int(seed), "db": db, "gender": gender})
        head = ""
        if not db:
            head = ("⚠️ 没有 db(M1 没接上或没答)—— 用神退回世爻。"
                    "这副盘和真跑时不是同一副。\n\n")
        return (b, head + b["summary"])


# ── 四站 ────────────────────────────────────────────────────────────────────
def _widgets(default_model, default_max):
    return {
        "model": ("STRING", {"default": default_model,
                             "tooltip": "端点上的模型名(看「端点上有什么」那一格)。"
                                        "分站配模型就是拆四站的理由。"}),
        "temperature": ("FLOAT", {"default": 0.0, "min": 0.0, "max": 2.0, "step": 0.05,
                                  "tooltip": "调提示词时必须是 0,否则你在调噪声。"}),
        "max_tokens": ("INT", {"default": default_max, "min": 64, "max": 32768}),
        "dry": ("BOOLEAN", {"default": False,
                            "tooltip": "只建提示词、不调模型。改完提示词先用它看槽填对没有。"}),
    }


_PIN = {"pin": ("STRING", {"multiline": True, "default": "",
                           "tooltip": "填了就直接用这段当这一站的输出,不调模型。"
                                      "用来试「如果上一站这么答会怎样」。"})}


class _Station:
    """四站共用的执行体。子类只声明插口顺序和默认值。"""

    STATION = ""
    FUNCTION = "go"
    CATEGORY = CATEGORY

    @classmethod
    def IS_CHANGED(cls, **kw):
        # ⭐ 这一行就是「改一站只重跑一站」:按站取提示词哈希,所以改 M4 不牵动 M1。
        return _prompt_hash(cls.STATION)

    @staticmethod
    def _feed(station, r):
        """这一站到底把什么喂给了模型,以及检索拉了什么。

        一站的 system 是一大块文字。`dry` 能把它整个打出来,但看不出哪一段是
        哪个槽来的 —— 于是一句错的断语没法追回它的来源。这里按槽拆开:
        先是一张表(谁多大),再是每个槽的全文。
        """
        out = ["%s 的 system 共 %d tok" % (station.upper(), r.get("sysTok", 0))]
        meta = r.get("meta") or {}
        libs = meta.get("libraries") or []
        cards = meta.get("cards") or []
        if libs or cards:
            out.append("")
            out.append("拉取")
            if libs:
                out.append("  排到的库  " + " ".join(
                    "%s(%.1f)" % (x["id"], x.get("score", 0)) for x in libs))
            if cards:
                out.append("  开的卡    " + " ".join(
                    "%s(%.1f)" % (x["id"], x.get("score", 0)) for x in cards))
        fill = r.get("fill")
        if fill is None:
            out.append("")
            out.append("槽的对照表拼不回原文,不显示 —— 模板和填好的 system 对不上。")
            out.append("一份错位的对照表会把人指向错的那一段,所以整个作废,不猜。")
            return "\n".join(out)
        if not fill:
            out.append("")
            out.append("这一站没有槽:它只看 user 那一条。")
            return "\n".join(out)
        out.append("")
        out.append("槽             tok   头一句")
        for f in fill:
            head = (f["text"] or "").strip().split("\n")[0][:44] or "(空)"
            mark = " ~" if f.get("ambiguous") else "  "
            out.append("  %-13s %5d %s %s" % ("{{%s}}" % f["slot"], f["tok"], mark, head))
        if any(f.get("ambiguous") for f in fill):
            out.append("")
            out.append("带 ~ 的那几个槽,边界靠字符串定不下来:它和下一段之间的分隔"
                       "在正文里不止出现一次,")
            out.append("所以这里按最早的那处切。内容大体是对的,但别拿它去数边界上那几个字。")
        out.append("")
        for f in fill:
            out.append("─── {{%s}}  %d tok ───" % (f["slot"], f["tok"]))
            out.append(f["text"] if f["text"].strip() else "(空)")
            out.append("")
        return "\n".join(out)

    def _run(self, body, 端点, model, temperature, max_tokens, dry, pin=""):
        if pin and pin.strip():
            return pin.strip(), "钉住(没调模型)", "钉住:这一站没有建提示词,所以没有喂料可看。"
        r = _bridge("station", {
            "station": self.STATION, "body": body, "dry": bool(dry),
            "conn": 端点, "model": model.strip(),
            "temperature": float(temperature), "max_tokens": int(max_tokens),
        })
        note = ["system %d tok" % r["sysTok"], "槽:" + (" ".join(r["slots"]) or "(无)")]
        if r.get("left"):
            note.append("⚠️ 没填上的槽:" + " ".join(r["left"]))
        meta = r.get("meta") or {}
        if meta.get("libraries"):
            note.append("排到的库:" + " ".join(x["id"] for x in meta["libraries"]))
        if meta.get("cards"):
            note.append("开的卡:" + " ".join(x["id"] for x in meta["cards"]))
        feed = self._feed(self.STATION, r)
        if r.get("dry"):
            return "", "\n".join(note) + "\n\n─── system ───\n" + r["system"], feed
        note.append("%dms" % r.get("ms", 0))
        u = r.get("usage") or {}
        if u:
            note.append("in %s / out %s" % (u.get("prompt_tokens"), u.get("completion_tokens")))
        if r.get("finish") and r["finish"] != "stop":
            note.append("⚠️ finish=%s(被截断了,调大 max_tokens)" % r["finish"])
        return r["text"], " · ".join(note[:1] + note[2:]) + "\n" + note[1], feed


def _common(问题, 盘, M1):
    """和 run.mjs 的 `common` 一模一样 —— 材料从哪来只写这一处。"""
    return {
        "question": 问题["question"],
        "features": 盘["features"],
        "board": 盘["boardText"],
        "ladder": 盘["ladder"],
        "relations": 盘["relations"],
        "m1": M1["text"],
    }


class BWM1(_Station):
    STATION = "m1"
    RETURN_TYPES = ("BW_M1", "STRING", "STRING", "STRING")
    RETURN_NAMES = ("M1", "原文", "注", "喂料")
    DESCRIPTION = ("读问题 → lang / db / ask / hurt / flags / facts。"
                   "它的 db= 定用神,所以它必须跑在起卦前面。")

    @classmethod
    def INPUT_TYPES(cls):
        return {"required": dict({"端点": ("BW_CONN",), "问题": ("BW_ASK",)},
                                 **_widgets("qwen2.5:7b", 512)),
                "optional": dict(_PIN)}

    def go(self, 端点, 问题, model, temperature, max_tokens, dry, pin=""):
        text, note, feed = self._run({"question": 问题["ask"]}, 端点, model, temperature, max_tokens, dry, pin)
        parsed = {}
        for line in text.splitlines():
            if "=" in line:
                k, _, v = line.partition("=")
                k = k.strip().lower()
                if k in ("lang", "db", "ask", "hurt", "more", "flags", "facts"):
                    parsed[k] = v.strip()
        miss = [k for k in ("lang", "db", "ask", "hurt", "flags", "facts") if k not in parsed]
        if miss and text:
            note += "\n⚠️ 少了这几行:" + " ".join(miss)
        return ({"text": text, "parsed": parsed}, text, note, feed)


class BWM2(_Station):
    STATION = "m2"
    RETURN_TYPES = ("BW_M2", "STRING", "STRING", "STRING")
    RETURN_NAMES = ("M2", "原文", "注", "喂料")
    DESCRIPTION = "选库 —— 两级 RAG 的第一级。它挑了哪几个库,M3 就只看得见那几个库的卡。"

    @classmethod
    def INPUT_TYPES(cls):
        return {"required": dict({"端点": ("BW_CONN",), "问题": ("BW_ASK",),
                                  "盘": ("BW_BOARD",), "M1": ("BW_M1",)},
                                 **_widgets("qwen2.5:7b", 512)),
                "optional": dict(_PIN)}

    def go(self, 端点, 问题, 盘, M1, model, temperature, max_tokens, dry, pin=""):
        text, note, feed = self._run(_common(问题, 盘, M1), 端点, model, temperature, max_tokens, dry, pin)
        return ({"text": text}, text, note, feed)


class BWM3(_Station):
    STATION = "m3"
    RETURN_TYPES = ("BW_M3", "STRING", "STRING", "STRING")
    RETURN_NAMES = ("M3", "原文", "注", "喂料")
    DESCRIPTION = ("取证:把盘变成这一卦的事,出词条。"
                   "⚠️ 它只看得见 M2 开的那几个库的卡 —— M2 少选一个库,"
                   "M3 就再也看不到那个库的卡,而它照样交得出材料。")

    @classmethod
    def INPUT_TYPES(cls):
        return {"required": dict({"端点": ("BW_CONN",), "问题": ("BW_ASK",),
                                  "盘": ("BW_BOARD",), "M1": ("BW_M1",), "M2": ("BW_M2",)},
                                 **_widgets("qwen2.5:7b", 1536)),
                "optional": dict(_PIN)}

    def go(self, 端点, 问题, 盘, M1, M2, model, temperature, max_tokens, dry, pin=""):
        body = dict(_common(问题, 盘, M1), m2=M2["text"])
        text, note, feed = self._run(body, 端点, model, temperature, max_tokens, dry, pin)
        return ({"text": text}, text, note, feed)


class BWM4(_Station):
    STATION = "m4"
    RETURN_TYPES = ("STRING", "STRING", "STRING")
    RETURN_NAMES = ("解读", "注", "喂料")
    DESCRIPTION = ("说话 —— 解读本身。"
                   "它拿的是 M3 的材料,**不是盘**:两站都发盘就是两个真相源,"
                   "而谁赢由模型当时的心情定。看「注」里那行「槽:」—— 里面没有 board。")

    @classmethod
    def INPUT_TYPES(cls):
        return {"required": dict({"端点": ("BW_CONN",), "问题": ("BW_ASK",),
                                  "盘": ("BW_BOARD",), "M1": ("BW_M1",), "M3": ("BW_M3",)},
                                 **_widgets("qwen2.5:32b", 8192)),
                "optional": dict(_PIN)}

    def go(self, 端点, 问题, 盘, M1, M3, model, temperature, max_tokens, dry, pin=""):
        # 盘整个塞进 body,由 `buildNode` 决定哪些进得了 M4 的提示词。
        # ⭐ 在这里挑一遍就是把那条规矩抄成第二份 —— 它只该写在 fill.js 一处。
        body = dict(_common(问题, 盘, M1), m3=M3["text"])
        text, note, feed = self._run(body, 端点, model, temperature, max_tokens, dry, pin)
        return (text, note, feed)


# ── 看 ──────────────────────────────────────────────────────────────────────
class BWTables:
    """四张 CSV 表 —— 判据引擎唯一的输入。**这一步没有模型。**

    ⭐ 为什么是四张不是一张:**爻是点,互动是边,行数不一样。**
       六爻恒 6 行;而爻与爻之间的关系是 C(6,2) 量级、还带方向和「成不成立」。
       把边塞进 6 行的点表里,丢掉的正好是判据要读的那两样。
    """

    TABLES = ["全部", "lines 爻", "edges 边", "clock 钟", "board 盘"]

    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {
            "盘": ("BW_BOARD",),
            "看哪张": (cls.TABLES, {
                "tooltip": "lines=一爻一行(恒 6 行);edges=一条爻爻关系;"
                           "clock=一爻对日月岁时的一条关系;board=整副盘(恒 1 行)。"}),
        }}

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("表",)
    FUNCTION = "go"
    CATEGORY = CATEGORY
    DESCRIPTION = ("把盘摊成四张 CSV。判据靠**查地址**取用 —— 角色定行、格定列,"
                   "不是搜相似。「忌神旺相」读的就是 lines 表 角色=忌神 那一行的 旺衰 格。")

    def go(self, 盘, 看哪张):
        csv = 盘.get("csv") or {}
        key = 看哪张.split(" ")[0]
        if key != "全部":
            return (csv.get(key, "(没有这张表)"),)
        out = []
        for name in ("lines", "edges", "clock", "board"):
            body = csv.get(name, "")
            rows = max(0, len(body.strip().split("\n")) - 1)
            out.append("─── %s(%d 行)───\n%s" % (name, rows, body))
        return ("\n".join(out),)


class BWCriteria:
    """《增删卜易》36 条判据,拿四张表判。**这一步没有模型。**

    ⭐⭐⭐ **它不下结论。** 输出是「这几条成立,各自读的是哪一格」,不是「忌神能克」。
       实测 200 副盘里有 60 副,「能克」和「不能克」**同时成立** —— 书上那几条
       是有先后的,而那个先后没有写在 46 条里的任何一个字段。
       真在这里输出一个总的真假,30% 的盘上那是掷硬币,而且掷完看不出来是掷的。
    """

    VIEW = ["只看成立的", "成立 + 判不了的", "全部 36 条"]

    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {
            "盘": ("BW_BOARD",),
            "看什么": (cls.VIEW, {
                "tooltip": "「判不了的」不是「不成立」:长生十二宫不在仓库、"
                           "「化散」原文没给判法、「近事」来自问题不来自盘。"
                           "把它们当成不成立,会拿到一个看起来完全正常的相反结论。"}),
        }}

    RETURN_TYPES = ("STRING", "STRING")
    RETURN_NAMES = ("判据", "注")
    FUNCTION = "go"
    CATEGORY = CATEGORY
    DESCRIPTION = ("逐爻判,不是整盘判 —— 输出说的是「第 5 爻是进神」,"
                   "不是「这盘有进神」。⚠️ 这一步的结果目前**没有进 M3 的提示词**:"
                   "M3 要多一个 {{criteria}} 槽才吃得到,那是动产品本身。")

    def go(self, 盘, 看什么):
        cs = 盘.get("criteria") or []
        on = [c for c in cs if c["成立"] is True]
        na = [c for c in cs if c["成立"] is None]
        off = [c for c in cs if c["成立"] is False]
        note = "36 条:成立 %d · 不成立 %d · 判不了 %d" % (len(on), len(off), len(na))
        if 看什么 == "只看成立的":
            body = 盘.get("criteriaText", "").split("【判不了的")[0].rstrip()
        elif 看什么 == "成立 + 判不了的":
            body = 盘.get("criteriaText", "")
        else:
            body = 盘.get("criteriaText", "") + "\n\n【不成立的 %d 条】\n" % len(off) + "\n".join(
                "· %s  %s" % (c["id"], c["原文"]) for c in off)
        return (body, note)


class BWShow:
    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {"文字": ("STRING", {"forceInput": True})}}

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("文字",)
    FUNCTION = "go"
    OUTPUT_NODE = True
    CATEGORY = CATEGORY
    DESCRIPTION = "把一段文字显示在节点上,并原样传下去。"

    def go(self, 文字):
        return {"ui": {"text": [文字]}, "result": (文字,)}


NODE_CLASS_MAPPINGS = {
    "BWEndpoint": BWEndpoint,
    "BWAsk": BWAsk,
    "BWCast": BWCast,
    "BWM1": BWM1,
    "BWM2": BWM2,
    "BWM3": BWM3,
    "BWM4": BWM4,
    "BWTables": BWTables,
    "BWCriteria": BWCriteria,
    "BWShow": BWShow,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "BWEndpoint": "BW 端点",
    "BWAsk": "BW 问题",
    "BWCast": "BW 起卦(无模型)",
    "BWM1": "BW M1 读问题",
    "BWM2": "BW M2 选库",
    "BWM3": "BW M3 取证",
    "BWM4": "BW M4 解读",
    "BWTables": "BW 四张表(无模型)",
    "BWCriteria": "BW 判据(无模型)",
    "BWShow": "BW 看",
}
