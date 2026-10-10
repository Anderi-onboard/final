"""Writes liuyao-reading.json: the 看卦 workflow in ComfyUI's own (UI) format.

    python3 comfy/build_workflow.py > comfy/liuyao-reading.json

The test runs it and compares the output with the committed file.

Seven nodes in a chain: config → cast → understand → packet → retrieve →
claims → synth. The config feeds the three model stages. Node type names match
NODE_CLASS_MAPPINGS in comfyui-liuyao/nodes.py.
"""
import json
import sys

NODE_W, NODE_H, GAP = 480, 320, 60


def build():
    nodes = []
    links = []
    next_link = [1]

    def node(nid, typ, x, y, inputs, outputs, widgets):
        nodes.append({
            "id": nid, "type": typ, "pos": [x, y], "size": [NODE_W, NODE_H],
            "flags": {}, "order": nid, "mode": 0,
            "inputs": [{"name": n, "type": "STRING", "link": None, "widget": {"name": n}} for n in inputs],
            "outputs": [{"name": n, "type": "STRING", "links": [], "slot_index": i}
                        for i, n in enumerate(outputs)],
            "properties": {"Node name for S&R": typ},
            "widgets_values": widgets,
        })

    def connect(origin, oslot, target, tslot):
        lid = next_link[0]
        next_link[0] += 1
        o = nodes[origin - 1]
        t = nodes[target - 1]
        o["outputs"][oslot]["links"].append(lid)
        t["inputs"][tslot]["link"] = lid
        links.append([lid, origin, oslot, target, tslot, "STRING"])

    col = lambda i: 40 + i * (NODE_W + GAP)  # noqa: E731
    row_top, row_low = 40, 40 + NODE_H + GAP

    node(1, "LiuyaoConfig", col(0), row_low, [], ["config", "display"],
         ["mock", "", "", ""])
    node(2, "LiuyaoCast", col(0), row_top, [], ["state", "display"],
         ["这个月的求财能不能成", "1,2,3,0,3,2", "2026-10-08"])
    node(3, "LiuyaoUnderstand", col(1), row_top, ["state", "config"], ["state", "display"], [])
    node(4, "LiuyaoPacket", col(2), row_top, ["state"], ["state", "display"], [])
    node(5, "LiuyaoRetrieve", col(3), row_top, ["state"], ["state", "display"], [])
    node(6, "LiuyaoClaims", col(4), row_top, ["state", "config"], ["state", "display"], [])
    node(7, "LiuyaoSynth", col(5), row_top, ["state", "config"], ["state", "display"], [])

    connect(2, 0, 3, 0)   # cast.state      → understand.state
    connect(1, 0, 3, 1)   # config          → understand.config
    connect(3, 0, 4, 0)   # understand.state → packet.state
    connect(4, 0, 5, 0)   # packet.state     → retrieve.state
    connect(5, 0, 6, 0)   # retrieve.state   → claims.state
    connect(1, 0, 6, 1)   # config           → claims.config
    connect(6, 0, 7, 0)   # claims.state     → synth.state
    connect(1, 0, 7, 1)   # config           → synth.config

    return {
        "last_node_id": len(nodes),
        "last_link_id": next_link[0] - 1,
        "nodes": nodes,
        "links": links,
        "groups": [],
        "config": {},
        "extra": {"ds": {"scale": 0.6, "offset": [0, 0]}},
        "version": 0.4,
    }


if __name__ == "__main__":
    sys.stdout.write(json.dumps(build(), ensure_ascii=False, indent=2) + "\n")
