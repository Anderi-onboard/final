"""Smoke test for the ComfyUI node package, without ComfyUI.

Calls each node's run() in order, as ComfyUI would, in demo mode, and checks
what each node returns to the canvas. Run: python3 comfy/test_nodes.py
Needs node on PATH. Sets LIUYAO_CORE itself (the liuyao-core directory above this file).
"""
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "comfyui-liuyao"))
os.environ["LIUYAO_CORE"] = os.path.dirname(HERE)

import nodes  # noqa: E402

MARKERS = ["=== 系统提示 ===", "=== 用户输入 ===", "=== 模型输出 ===", "=== 程序判定 ==="]


def shown(out):
    """What a node puts on the canvas: its ui text, and its result tuple."""
    assert "ui" in out and "text" in out["ui"], "node shows text on the canvas"
    text = out["ui"]["text"][0]
    assert text and text == out["result"][1], "shown text is the display output"
    return out["result"], text


# Config, cast, then the model and program stages in order.
(config, _), _ = shown(nodes.LiuyaoConfig().run("mock", "", "", ""))
(state, disp_cast), _ = shown(nodes.LiuyaoCast().run("这个月的求财能不能成", "1,2,3,0,3,2", "2026-10-08"))
assert "起卦" in disp_cast and "本卦" in disp_cast

(state, disp_u), _ = shown(nodes.LiuyaoUnderstand().run(state, config))
for m in MARKERS:
    assert m in disp_u, f"understand shows {m}"

(state, disp_p), _ = shown(nodes.LiuyaoPacket().run(state))
assert "用神" in disp_p and "【六爻" in disp_p, "packet shows 用神 and the packet text"

(state, disp_r), _ = shown(nodes.LiuyaoRetrieve().run(state))
assert "检索" in disp_r

(state, disp_c), _ = shown(nodes.LiuyaoClaims().run(state, config))
for m in MARKERS:
    assert m in disp_c, f"claims shows {m}"

(state, disp_s), _ = shown(nodes.LiuyaoSynth().run(state, config))
for m in MARKERS:
    assert m in disp_s, f"synth shows {m}"
assert "回答" in disp_s and "演示模式" in disp_s, "synth shows the answer (demo placeholder, labelled)"

# Nodes are never cached: a reading must run every time.
for cls in [nodes.LiuyaoConfig, nodes.LiuyaoCast, nodes.LiuyaoUnderstand, nodes.LiuyaoSynth]:
    assert math.isnan(cls.IS_CHANGED()), f"{cls.__name__} never reuses a cached result"

# Errors reach the canvas as errors.
saved = os.environ.pop("LIUYAO_CORE")
try:
    nodes.LiuyaoCast().run("q", "", "")
    raise AssertionError("missing LIUYAO_CORE must raise")
except RuntimeError as e:
    assert "LIUYAO_CORE" in str(e)
finally:
    os.environ["LIUYAO_CORE"] = os.path.dirname(HERE)

key = os.environ.pop("OPENROUTER_API_KEY", None)
try:
    cfg = nodes.LiuyaoConfig().run("openrouter", "m", "m", "m")["result"][0]
    nodes.LiuyaoUnderstand().run(state, cfg)
    raise AssertionError("openrouter without a key must raise")
except RuntimeError as e:
    assert "OPENROUTER_API_KEY" in str(e)
finally:
    if key is not None:
        os.environ["OPENROUTER_API_KEY"] = key

print("comfy-nodes: ok — seven nodes run in order in demo mode; each model stage shows prompt/input/output/verdict; no caching; missing LIUYAO_CORE and missing key raise on the canvas")
