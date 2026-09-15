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

OUT = Path(__file__).resolve().parent / "workflows" / "bournewise-4node.json"
WIDGET_TYPES = ("STRING", "INT", "FLOAT", "BOOLEAN")


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


# ── 图 ──────────────────────────────────────────────────────────────────────
PLACED = [
    ("端点", "BWEndpoint", (40, 40)),
    ("问题", "BWAsk", (40, 360)),
    ("M1", "BWM1", (450, 40)),
    ("起卦", "BWCast", (900, 40)),
    ("看盘", "BWShow", (900, 470)),
    ("M2", "BWM2", (1340, 40)),
    ("M3", "BWM3", (1340, 430)),
    ("看M3", "BWShow", (1800, 430)),
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
    # 两级收窄:M2 挑的库 → M3 只看得见那几个库的卡。
    (("M2", "M2"), ("M3", "M2")),
    (("M3", "M3"), ("M4", "M3")),
    (("M3", "原文"), ("看M3", "文字")),
    (("M4", "解读"), ("解读", "文字")),
]


def build():
    nodes, by_label, problems = [], {}, []
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
            "widgets_values": [v for _, v in widgets],
        })

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
    # 而人会先怀疑节点坏了。
    for label, key, _ in PLACED:
        n = by_label.get(label)
        if not n:
            continue
        for slot in nodes[n["id"] - 1]["inputs"]:
            if slot["link"] is None and slot["name"] != "M1":   # 起卦的 M1 是 optional
                problems.append("%s 的输入「%s」没接线" % (label, slot["name"]))

    wf = {
        "last_node_id": len(nodes), "last_link_id": len(links),
        "nodes": nodes, "links": links, "groups": [], "config": {},
        "extra": {"bournewise": "由 tools/comfy/build_workflow.py 从节点定义生成,不要手改"},
        "version": 0.4,
    }
    return wf, problems


if __name__ == "__main__":
    wf, problems = build()
    if problems:
        print("✗ 图和节点定义对不上:")
        for p in problems:
            print("   " + p)
        sys.exit(1)
    check = "--check" in sys.argv
    body = json.dumps(wf, ensure_ascii=False, indent=2) + "\n"
    if check:
        cur = OUT.read_text(encoding="utf-8") if OUT.exists() else ""
        if cur != body:
            print("✗ %s 和节点定义不同步 —— 重新生成:python3 tools/comfy/build_workflow.py" % OUT.name)
            sys.exit(1)
        print("ok   %s 和节点定义同步(%d 个节点 / %d 条线)" % (OUT.name, len(wf["nodes"]), len(wf["links"])))
    else:
        OUT.parent.mkdir(parents=True, exist_ok=True)
        OUT.write_text(body, encoding="utf-8")
        print("写了 %s —— %d 个节点 / %d 条线,每条线两头类型都对上了"
              % (OUT.relative_to(Path(__file__).resolve().parents[2]), len(wf["nodes"]), len(wf["links"])))
