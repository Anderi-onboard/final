# -*- coding: utf-8 -*-
"""BourneWise 四节点 · ComfyUI 节点包。

装法(**软链,不要复制**):
    ln -s /你的路径/final/tools/comfy ~/ComfyUI/custom_nodes/bournewise

复制一份进 custom_nodes 就是又一张要同步的名单:盘和提示词还在仓库里改,
而 Comfy 上跑的是那天复制过去的那一份 —— 两边都不会报错。
"""

from .nodes import NODE_CLASS_MAPPINGS, NODE_DISPLAY_NAME_MAPPINGS

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS"]
