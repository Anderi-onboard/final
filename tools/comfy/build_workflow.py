# -*- coding: utf-8 -*-
"""从节点定义**生成**那张图,而不是手写一份。

    python3 tools/comfy/build_workflow.py          # 生成
    python3 tools/comfy/build_workflow.py --check   # 只校验,不写(CI / 改完自查)

⭐ 为什么生成:手写的 workflow JSON 是**第二张要同步的名单** —— 插口名、控件顺序、
   插口类型在 `nodes.py` 里改一个,手写的那份就悄悄错位,而它报出来的是
   「widget 值对不上」这种跟原因毫无关系的话。这里的 JSON 从 `INPUT_TYPES` /
   `RETURN_TYPES` 推出来,**推不出来就报错**,所以它不可能和节点定义不一致。

⚠️ 它**没有在真的 ComfyUI 里打开过**(这台机器上没有)。校验的是结构:
   节点类型存在、插口名存在、每条连线两头的类型相同、控件值个数对得上。
   这几样正是手写最容易错的地方,但它不等于「在 ComfyUI 里跑通了」。
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from comfy.nodes import NODE_CLASS_MAPPINGS  # noqa: E402

OUT_DIR = Path(__file__).resolve().parent / "workflows"
WIDGET_TYPES = ("STRING", "INT", "FLOAT", "BOOLEAN")

# 变体 = 同一张图,只改控件默认值。图的**结构**只有一份 —— 第二张手摆的图
# 就是第二张要同步的名单。
# 覆盖值的键:「控件名」改所有节点上的那个控件;「@节点标签」只改那一个节点。
SAMPLE_ASK = "我和她还有可能复合吗?今年能换到更好的工作吗?我最近在投简历"
SAMPLE_M1 = "\n".join([
    "lang=Chinese",
    "q1=我和她还有可能复合吗 | db=婚恋 | kind=能不能",
    "q2=今年能换到更好的工作吗 | db=工作 | kind=什么时候",
    "hurt=0",
    "flags=无",
    "facts=我最近在投简历[父母|q2]",
])
VARIANTS = {
    # 跑:接上本地模型,四站真跑。
    "bournewise-4node.json": ("4node", {}),
    # 只看提示词:一个模型都不用下,打开就能读每一站的 system 全文。
    # 改提示词时先开这张,看槽填对没有。
    "bournewise-4node-dry.json": ("4node", {"dry": True}),
    # 解谜管线:程序出题 → 每条线索一个模型(一条一条跑)→ 验现事 → 解谜。
    "bournewise-puzzle.json": ("puzzle", {"@问题": {"question": SAMPLE_ASK}}),
    # 解谜管线只看提示词:M1 钉住一段示范答案,后面每一站只建提示词 —— 一个模型都不用下,
    # 出题那一步(纯代码)照样真跑,所以题面、每条线索的提示词、解谜拿到的材料全看得见。
    "bournewise-puzzle-dry.json": ("puzzle", {"dry": True, "@问题": {"question": SAMPLE_ASK},
                                              "@M1": {"pin": SAMPLE_M1}}),
}


def spec(key):
    """一个节点的插口和控件 —— 顺序就是 ComfyUI 读 widgets_values 的顺序。"""
    cls = NODE_CLASS_MAPPINGS[key]
    d = cls.INPUT_TYPES()
    links, widgets = [], []
    for scope in ("required", "optional"):
        for name, decl in (d.get(scope) or {}).items():
            t = decl[0]
            o = decl[1] if len(decl) > 1 else {}
            if isinstance(t, list):                       # combo
                widgets.append([name, t[0] if t else ""])
            elif t in WIDGET_TYPES and not o.get("forceInput"):
                widgets.append([name, o.get("default", "" if t == "STRING" else 0)])
                # seed 这类控件,前端会在它后面**再插一个**「生成后怎么办」的控件。
                # 漏掉它,后面每一个控件值都会错位一格。
                if o.get("control_after_generate"):
                    widgets.append([name + "__control", "fixed"])
            else:
                links.append([name, t])
    outs = list(zip(getattr(cls, "RETURN_NAMES", None) or cls.RETURN_TYPES, cls.RETURN_TYPES))
    return links, widgets, outs


def required_links(key):
    """必填的连线插口。optional 的可以不接(起卦的 M1、解谜的验现事)。"""
    d = NODE_CLASS_MAPPINGS[key].INPUT_TYPES()
    return {n for n, decl in (d.get("required") or {}).items()
            if not isinstance(decl[0], list) and decl[0] not in WIDGET_TYPES}


# ── 图一:四站 ──────────────────────────────────────────────────────────────
PLACED = [
    ("端点", "BWEndpoint", (40, 40)),
    ("问题", "BWAsk", (40, 360)),
    ("M1", "BWM1", (450, 40)),
    ("起卦", "BWCast", (900, 40)),
    ("看盘", "BWShow", (900, 470)),
    # ── 下面这一列全是代码,一个模型都不用。**新架构能不能看懂,看的就是这一列。**
    #    盘 → 四张表 → 判据。判据只拿表判,拿不到盘 —— 四张表够不够用,
    #    只有在求值器除了它什么都看不见的时候才证明得了。
    ("四张表", "BWTables", (40, 700)),
    ("看表", "BWShow", (450, 700)),
    ("判据", "BWCriteria", (40, 1060)),
    ("看判据", "BWShow", (450, 1060)),
    ("应期", "BWTiming", (40, 1420)),
    ("看应期", "BWShow", (450, 1420)),
    ("M2", "BWM2", (1340, 40)),
    ("M3", "BWM3", (1340, 430)),
    ("看M3", "BWShow", (1800, 430)),
    # 模型到底拿到了什么、检索拉了什么 —— 按槽拆开,不是一大块 system。
    ("看M3喂料", "BWShow", (1800, 700)),
    ("M4", "BWM4", (1340, 900)),
    ("解读", "BWShow", (1800, 900)),
]

WIRES = [
    (("端点", "端点"), ("M1", "端点")),
    (("端点", "端点"), ("M2", "端点")),
    (("端点", "端点"), ("M3", "端点")),
    (("端点", "端点"), ("M4", "端点")),
    (("问题", "问题"), ("M1", "问题")),
    (("问题", "问题"), ("起卦", "问题")),
    (("问题", "问题"), ("M2", "问题")),
    (("问题", "问题"), ("M3", "问题")),
    (("问题", "问题"), ("M4", "问题")),
    # 用神由 M1 的 db= 定 —— 所以起卦在 M1 **后面**。这条连线就是那句话。
    (("M1", "M1"), ("起卦", "M1")),
    (("M1", "M1"), ("M2", "M1")),
    (("M1", "M1"), ("M3", "M1")),
    (("M1", "M1"), ("M4", "M1")),
    (("起卦", "盘"), ("M2", "盘")),
    (("起卦", "盘"), ("M3", "盘")),
    (("起卦", "盘"), ("M4", "盘")),
    (("起卦", "盘面"), ("看盘", "文字")),
    # 盘 → 四张表 → 看;盘 → 判据 → 看。两条都不经过任何模型。
    (("起卦", "盘"), ("四张表", "盘")),
    (("四张表", "表"), ("看表", "文字")),
    (("起卦", "盘"), ("判据", "盘")),
    (("判据", "判据"), ("看判据", "文字")),
    (("起卦", "盘"), ("应期", "盘")),
    (("应期", "应期"), ("看应期", "文字")),
    # 两级收窄:M2 挑的库 → M3 只看得见那几个库的卡。
    (("M2", "M2"), ("M3", "M2")),
    (("M3", "M3"), ("M4", "M3")),
    (("M3", "原文"), ("看M3", "文字")),
    (("M3", "喂料"), ("看M3喂料", "文字")),
    (("M4", "解读"), ("解读", "文字")),
]


# ── 图二:解谜 ──────────────────────────────────────────────────────────────
# 从左到右就是管线:读问题 → 出题(无模型)→ 线索(逐条)→ 验现事(逐条)→ 解谜。
# 每一步下面挂一个「看」,把它交出去的东西原样显示。
PUZZLE_PLACED = [
    ("端点", "BWEndpoint", (40, 40)),
    ("问题", "BWAsk", (40, 380)),
    ("M1", "BWPuzzleM1", (480, 40)),
    ("看M1", "BWShow", (480, 460)),
    ("出题", "BWPuzzleBuild", (920, 40)),
    ("看题面", "BWShow", (920, 360)),
    ("线索", "BWPuzzleClues", (1360, 40)),
    ("看线索", "BWShow", (1360, 460)),
    ("验现事", "BWPuzzleVerify", (1800, 40)),
    ("看验现事", "BWShow", (1800, 460)),
    ("解谜", "BWPuzzleSolve", (2240, 40)),
    ("解读", "BWShow", (2240, 520)),
    ("看材料", "BWShow", (2680, 40)),
]

PUZZLE_WIRES = [
    (("端点", "端点"), ("M1", "端点")),
    (("端点", "端点"), ("线索", "端点")),
    (("端点", "端点"), ("验现事", "端点")),
    (("端点", "端点"), ("解谜", "端点")),
    (("问题", "问题"), ("M1", "问题")),
    (("问题", "问题"), ("出题", "问题")),
    (("M1", "M1"), ("出题", "M1")),
    (("M1", "原文"), ("看M1", "文字")),
    (("出题", "题"), ("线索", "题")),
    (("出题", "题"), ("验现事", "题")),
    (("出题", "题"), ("解谜", "题")),
    (("出题", "题面"), ("看题面", "文字")),
    (("线索", "线索答案"), ("解谜", "线索答案")),
    (("线索", "原文"), ("看线索", "文字")),
    (("验现事", "验现事"), ("解谜", "验现事")),
    (("验现事", "原文"), ("看验现事", "文字")),
    (("解谜", "解读"), ("解读", "文字")),
    (("解谜", "材料"), ("看材料", "文字")),
]

GRAPHS = {"4node": (PLACED, WIRES), "puzzle": (PUZZLE_PLACED, PUZZLE_WIRES)}


def build(graph="4node", overrides=None):
    PLACED, WIRES = GRAPHS[graph]
    overrides = dict(overrides or {})
    by_node = {k[1:]: v for k, v in overrides.items() if k.startswith("@")}
    overrides = {k: v for k, v in overrides.items() if not k.startswith("@")}
    nodes, by_label, problems = [], {}, []
    for lab in by_node:
        if lab not in [x[0] for x in PLACED]:
            problems.append("变体里的「@%s」在这张图上没有这个节点" % lab)
    for i, (label, key, pos) in enumerate(PLACED):
        if key not in NODE_CLASS_MAPPINGS:
            problems.append("没有这个节点类型:%s" % key)
            continue
        links, widgets, outs = spec(key)
        nid = i + 1
        by_label[label] = {
            "id": nid,
            "inputs": [n for n, _ in links],
            "intypes": dict(links),
            "outputs": [n for n, _ in outs],
            "outtypes": dict(outs),
        }
        nodes.append({
            "id": nid, "type": key, "pos": list(pos), "size": [400, 60 + 34 * (len(links) + len(widgets))],
            "flags": {}, "order": i, "mode": 0,
            "inputs": [{"name": n, "type": t, "link": None} for n, t in links],
            "outputs": [{"name": n, "type": t, "links": [], "slot_index": k}
                        for k, (n, t) in enumerate(outs)],
            "properties": {"Node name for S&R": key},
            # 变体只改控件**默认值**,不改结构。名字对不上时报错,不静默忽略 ——
            # 一个拼错的变体键会让「dry 那张图」变成和「跑」那张一模一样,
            # 而它打开时看着完全正常,只是会去调模型。
            "widgets_values": [by_node.get(label, {}).get(n, overrides.get(n, v)) for n, v in widgets],
        })
        for k in by_node.get(label, {}):
            if k not in [n for n, _ in widgets]:
                problems.append("变体里给「%s」的控件「%s」,这个节点上没有" % (label, k))
        for k in overrides:
            if k not in [n for n, _ in widgets] and not any(
                    k in [n for n, _ in spec(kk)[1]] for kk in NODE_CLASS_MAPPINGS):
                problems.append("变体里的控件名「%s」在任何节点上都不存在" % k)

    links = []
    for lid, ((fl, fo), (tl, ti)) in enumerate(WIRES, start=1):
        a, b = by_label.get(fl), by_label.get(tl)
        if not a or not b:
            problems.append("连线指向不存在的节点:%s → %s" % (fl, tl))
            continue
        if fo not in a["outputs"]:
            problems.append("%s 没有叫「%s」的输出(有的是:%s)" % (fl, fo, " ".join(a["outputs"])))
            continue
        if ti not in b["inputs"]:
            problems.append("%s 没有叫「%s」的输入(有的是:%s)" % (tl, ti, " ".join(b["inputs"])))
            continue
        ft, tt = a["outtypes"][fo], b["intypes"][ti]
        if ft != tt:
            problems.append("类型对不上:%s.%s 是 %s,%s.%s 要 %s" % (fl, fo, ft, tl, ti, tt))
            continue
        fi, tidx = a["outputs"].index(fo), b["inputs"].index(ti)
        links.append([lid, a["id"], fi, b["id"], tidx, ft])
        nodes[a["id"] - 1]["outputs"][fi]["links"].append(lid)
        nodes[b["id"] - 1]["inputs"][tidx]["link"] = lid

    # 每个必填插口都得接上 —— 一张少接一条线的图,打开时报的是「缺输入」,
    # 而人会先怀疑节点坏了。必填与否从 INPUT_TYPES 读,不在这里写名单。
    for label, key, _ in PLACED:
        n = by_label.get(label)
        if not n:
            continue
        need = required_links(key)
        for slot in nodes[n["id"] - 1]["inputs"]:
            if slot["link"] is None and slot["name"] in need:
                problems.append("%s 的输入「%s」没接线" % (label, slot["name"]))

    wf = {
        "last_node_id": len(nodes), "last_link_id": len(links),
        "nodes": nodes, "links": links, "groups": [], "config": {},
        "extra": {"bournewise": "由 tools/comfy/build_workflow.py 从节点定义生成,不要手改"},
        "version": 0.4,
    }
    return wf, problems


if __name__ == "__main__":
    check = "--check" in sys.argv
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for name, (graph, overrides) in VARIANTS.items():
        wf, problems = build(graph, overrides)
        if problems:
            print("✗ %s 和节点定义对不上:" % name)
            for p in problems:
                print("   " + p)
            sys.exit(1)
        out = OUT_DIR / name
        body = json.dumps(wf, ensure_ascii=False, indent=2) + "\n"
        if check:
            cur = out.read_text(encoding="utf-8") if out.exists() else ""
            if cur != body:
                print("✗ %s 和节点定义不同步 —— 重新生成:python3 tools/comfy/build_workflow.py" % name)
                sys.exit(1)
            print("ok   %s 同步(%d 节点 / %d 线)" % (name, len(wf["nodes"]), len(wf["links"])))
        else:
            out.write_text(body, encoding="utf-8")
            print("写了 workflows/%s —— %d 节点 / %d 线,每条线两头类型都对上了"
                  % (name, len(wf["nodes"]), len(wf["links"])))
