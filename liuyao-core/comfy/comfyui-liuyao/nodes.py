"""ComfyUI nodes for the 六爻 reading pipeline.

One node per stage. Each node sends {stage, state, config} to comfy/bridge.mjs
(the same stage functions the pipeline uses) and shows the returned display text
on the node: for every model call, the system prompt, the input, the raw output
and the program's verdict; for every program stage, what it decided.

Requires: Node.js 18+ on PATH, and the environment variable LIUYAO_CORE set to
the liuyao-core directory (the one that contains comfy/bridge.mjs).
Real models also need OPENROUTER_API_KEY (mode openrouter) or ANTHROPIC_API_KEY
(mode anthropic) in ComfyUI's environment.
"""
import json
import os
import subprocess

CATEGORY = "六爻/看卦"


def _bridge_path():
    core = os.environ.get("LIUYAO_CORE")
    if not core:
        raise RuntimeError("未设置环境变量 LIUYAO_CORE（指向 liuyao-core 目录，内含 comfy/bridge.mjs）")
    path = os.path.join(core, "comfy", "bridge.mjs")
    if not os.path.isfile(path):
        raise RuntimeError(f"找不到 {path}，检查 LIUYAO_CORE")
    return path


def _call(stage, state=None, config=None):
    payload = json.dumps({"stage": stage, "state": state or {}, "config": config or {}}, ensure_ascii=False)
    proc = subprocess.run(
        ["node", _bridge_path()],
        input=payload.encode("utf-8"),
        capture_output=True,
        timeout=900,
    )
    if proc.returncode != 0:
        raise RuntimeError(f"bridge 异常退出：{proc.stderr.decode('utf-8', 'replace')}")
    out = json.loads(proc.stdout.decode("utf-8"))
    if "error" in out:
        raise RuntimeError(out["error"])
    return out


def _shown(state, display):
    """What a node returns: its outputs, and the text it shows on the node."""
    return {"ui": {"text": [display]}, "result": (json.dumps(state, ensure_ascii=False), display)}


class _Stage:
    CATEGORY = CATEGORY
    RETURN_TYPES = ("STRING", "STRING")
    RETURN_NAMES = ("state", "display")
    FUNCTION = "run"
    OUTPUT_NODE = True

    @classmethod
    def IS_CHANGED(cls, **kwargs):
        # Model calls must run every time; never reuse a cached reading.
        return float("nan")


class LiuyaoConfig:
    CATEGORY = CATEGORY
    RETURN_TYPES = ("STRING", "STRING")
    RETURN_NAMES = ("config", "display")
    FUNCTION = "run"
    OUTPUT_NODE = True

    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {
            "mode": (["mock", "openrouter", "anthropic"], {"default": "mock"}),
            "model_understand": ("STRING", {"default": "", "tooltip": "模型名：openrouter 用 provider/model；anthropic 用你账号可用的模型名。非演示模式必填"}),
            "model_claim": ("STRING", {"default": ""}),
            "model_synth": ("STRING", {"default": ""}),
        }}

    @classmethod
    def IS_CHANGED(cls, **kwargs):
        return float("nan")

    def run(self, mode, model_understand, model_claim, model_synth):
        config = {"mode": mode, "model_understand": model_understand,
                  "model_claim": model_claim, "model_synth": model_synth}
        if mode == "mock":
            note = "mock：演示模式，不调用模型，输出是占位文字，不是解读。"
        else:
            key = {"openrouter": "OPENROUTER_API_KEY", "anthropic": "ANTHROPIC_API_KEY"}[mode]
            note = (f"{mode}：理解={model_understand}　断法={model_claim}　综合={model_synth}"
                    f"（需要环境变量 {key}）")
        display = f"━━ 配置 ━━\n{note}"
        return {"ui": {"text": [display]},
                "result": (json.dumps(config, ensure_ascii=False), display)}


class LiuyaoCast(_Stage):
    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {
            "question": ("STRING", {"multiline": True, "default": "这个月的求财能不能成"}),
            "throws": ("STRING", {"default": "1,2,3,0,3,2",
                                  "tooltip": "六爻由初至上，每爻：0 交 1 单 2 拆 3 重。留空则随机起卦"}),
            "date": ("STRING", {"default": "2026-10-08", "tooltip": "YYYY-MM-DD；留空为今天"}),
        }}

    def run(self, question, throws, date):
        out = _call("cast", {"question": question, "throws": throws, "date": date})
        return _shown(out["state"], out["display"])


def _stage_node(stage_name, needs_config):
    if needs_config:
        required = {
            "state": ("STRING", {"forceInput": True}),
            "config": ("STRING", {"forceInput": True}),
        }
    else:
        required = {"state": ("STRING", {"forceInput": True})}

    class Node(_Stage):
        @classmethod
        def INPUT_TYPES(cls):
            return {"required": dict(required)}

        def run(self, state, config=None):
            out = _call(stage_name, json.loads(state), json.loads(config) if config else {})
            return _shown(out["state"], out["display"])

    return Node


LiuyaoUnderstand = _stage_node("understand", needs_config=True)
LiuyaoPacket = _stage_node("packet", needs_config=False)
LiuyaoRetrieve = _stage_node("retrieve", needs_config=False)
LiuyaoClaims = _stage_node("claims", needs_config=True)
LiuyaoSynth = _stage_node("synth", needs_config=True)

NODE_CLASS_MAPPINGS = {
    "LiuyaoConfig": LiuyaoConfig,
    "LiuyaoCast": LiuyaoCast,
    "LiuyaoUnderstand": LiuyaoUnderstand,
    "LiuyaoPacket": LiuyaoPacket,
    "LiuyaoRetrieve": LiuyaoRetrieve,
    "LiuyaoClaims": LiuyaoClaims,
    "LiuyaoSynth": LiuyaoSynth,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "LiuyaoConfig": "六爻 · 配置",
    "LiuyaoCast": "六爻 1 · 起卦（程序）",
    "LiuyaoUnderstand": "六爻 2 · 理解问题（模型）",
    "LiuyaoPacket": "六爻 3 · 用神与排盘（程序）",
    "LiuyaoRetrieve": "六爻 4 · 检索（程序）",
    "LiuyaoClaims": "六爻 5 · 依书断法（模型）",
    "LiuyaoSynth": "六爻 6 · 综合（模型）",
}
