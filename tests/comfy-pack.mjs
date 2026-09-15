/* 契约:Comfy 那套节点是画布,不是第二份产品。
   ────────────────────────────────────────────────────────────────────────
   ComfyUI 的节点是 Python,而盘(`liuyao-*.js`)和提示词(`functions/_lib/nodes/`)
   是 JS。把它们抄一份 Python 是这件事**唯一**会犯的大错,而且它的失败方式是最贵的那种:
   两份各自跑得出一篇**看起来都正常**的解读,没有任何东西会报错 ——
   你在画布上调好的提示词,线上根本没在跑。

   本仓库为「两张要同步的名单」已经付过三次学费(方法页的减半规则、触控热区、
   `[data-horizon]` 那张表)。这条钉的就是不许有第四张:

     ① `bridge.mjs` 必须 import 仓库里那几个**真文件**。
     ② `tools/comfy/` 底下**一个字的提示词都不许出现** —— 探针是从 `prompts.js`
        自己身上取的,所以提示词改了探针跟着改,不会过期。
     ③ 那张 workflow JSON 必须和节点定义**结构一致**:节点类型存在、
        每条连线两头的类型相同、端点确实有那个插口。
        它是 `build_workflow.py` 生成的 —— 手改一笔,这里就红。

   ⚠️ 防空转:每一格都有下限断言。探针一个都取不到时,②「扫不到 = 通过」
      会以全绿的样子失效,而那正是 `font-lock.mjs` 第一版栽过的坑。
*/
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const read = (p) => readFileSync(path.join(ROOT, p), "utf8");

const bridge = read("tools/comfy/bridge.mjs");
const nodesPy = read("tools/comfy/nodes.py");
assert.ok(nodesPy.length > 6000, `nodes.py 只有 ${nodesPy.length} 字符 —— 这条契约在空转`);

/* ── ① 桥接的是真文件 ───────────────────────────────────────────────────── */
for (const [what, spec] of [
  ["填槽 / buildNode", '"../../functions/_lib/nodes/fill.js"'],
  ["提示词模板", '"../../functions/_lib/nodes/prompts.js"'],
  ["盘(浏览器引擎)", '"../lab/board.mjs"'],
  ["模型客户端", '"../lab/client.mjs"']
]) {
  assert.ok(bridge.includes("from " + spec),
    `bridge.mjs 不再从仓库 import「${what}」(${spec})—— 那它跑的就不是上线那一份了`);
}
/* Python 侧只许经这一个进程够着 JS。它自己去 import/exec 就是在绕开这条路。 */
assert.ok(/subprocess\.run\(\s*\[\s*_node_bin\(\)\s*,\s*str\(BRIDGE\)/.test(nodesPy),
  "nodes.py 不再经 bridge.mjs 调 node —— Python 一旦自己算盘或自己拼提示词,就是第二份产品");

/* ── ② 提示词一个字都不许落在 tools/comfy/ ─────────────────────────────── */
const prompts = read("functions/_lib/nodes/prompts.js");
/* 探针 = 每个 `export const X = \`` 之后的头一行。从 prompts.js 身上取,
   所以提示词改了探针跟着改 —— 写死几句话的话,改一次提示词这条就变成空话。 */
const probes = [];
for (const m of prompts.matchAll(/export const ([A-Z0-9_]+)\s*=\s*`([^\n]{12,})/g)) {
  probes.push([m[1], m[2].trim()]);
}
assert.ok(probes.length >= 5,
  `只从 prompts.js 取到 ${probes.length} 个探针(应 ≥5:M1–M4 + MARK)—— 正则失配了,这一格在空转`);

const files = [];
(function walk(dir) {
  for (const e of readdirSync(path.join(ROOT, dir))) {
    const rel = dir + "/" + e;
    if (statSync(path.join(ROOT, rel)).isDirectory()) walk(rel);
    else files.push(rel);
  }
})("tools/comfy");
assert.ok(files.length >= 5, `tools/comfy 只有 ${files.length} 个文件 —— 目录扫描坏了`);

for (const f of files) {
  const src = read(f);
  for (const [name, probe] of probes) {
    assert.ok(!src.includes(probe),
      `${f} 里出现了 ${name} 的提示词正文(「${probe.slice(0, 24)}…」)——\n`
      + "  提示词只许住在 functions/_lib/nodes/prompts.js。抄一份到画布这边,\n"
      + "  你调的就是画布,不是产品,而两边都不会报错。");
  }
}

/* ── ③ 那张图和节点定义对得上 ───────────────────────────────────────────── */
const wf = JSON.parse(read("tools/comfy/workflows/bournewise-4node.json"));
const declared = new Set(
  [...nodesPy.matchAll(/^\s{4}"(\w+)":\s*\w+,$/gm)].map((m) => m[1])
);
assert.ok(declared.size >= 8,
  `从 nodes.py 只解析到 ${declared.size} 个节点类型(应 ≥8)—— 正则失配了,这一格在空转`);
assert.ok(wf.nodes.length >= 8 && wf.links.length >= 15,
  `图只有 ${wf.nodes.length} 个节点 / ${wf.links.length} 条线 —— 它缩水了`);

const byId = new Map(wf.nodes.map((n) => [n.id, n]));
for (const n of wf.nodes) {
  assert.ok(declared.has(n.type),
    `图里用了 nodes.py 没有的节点类型「${n.type}」—— 打开时是「节点缺失」,而原因在另一个文件里`);
}
for (const [lid, from, fromSlot, to, toSlot, type] of wf.links) {
  const a = byId.get(from), b = byId.get(to);
  assert.ok(a && b, `第 ${lid} 条线指向不存在的节点(${from} → ${to})`);
  const out = a.outputs[fromSlot], inp = b.inputs[toSlot];
  assert.ok(out && inp, `第 ${lid} 条线接在不存在的插口上(${a.type}[${fromSlot}] → ${b.type}[${toSlot}])`);
  assert.equal(out.type, type, `第 ${lid} 条线的类型 ${type} 和 ${a.type}.${out.name}(${out.type})对不上`);
  assert.equal(inp.type, type, `第 ${lid} 条线的类型 ${type} 和 ${b.type}.${inp.name}(${inp.type})对不上`);
  assert.ok((out.links || []).includes(lid), `${a.type}.${out.name} 没记住第 ${lid} 条线`);
  assert.equal(inp.link, lid, `${b.type}.${inp.name} 没记住第 ${lid} 条线`);
}
/* 四站都得在图上 —— 少一站的图仍然打得开、仍然出得来一篇东西。 */
for (const t of ["BWM1", "BWM2", "BWM3", "BWM4", "BWCast"]) {
  assert.ok(wf.nodes.some((n) => n.type === t), `图上没有 ${t} —— 少一站的管线照样跑得出东西`);
}

/* ── ④ 「改一站只重跑一站」不许退化成「全站都不重跑」 ───────────────────── */
/* IS_CHANGED 没了的话,改完提示词 Comfy 会**拿缓存里的旧答案给你看** ——
   你会对着上一版的输出调这一版。这是「绿色比红色更糟」的那种失败。 */
/* ⚠️ 必须钉在**四站共用的那个类**里,不能裸扫整份文件:`BWEndpoint` 自己也有一个
   `IS_CHANGED`,于是裸的 /def IS_CHANGED/ 会匹配到它 —— 植入检查当场抓到这条:
   我把四站的那个改名之后,**测试照样绿**。和 M3 那两条 `/他没说/`、`/链=/`
   是同一个形状:**断言打中了别的东西,看起来却像在查它。** */
const station = nodesPy.slice(nodesPy.indexOf("class _Station:"),
  nodesPy.indexOf("\ndef _common("));
assert.ok(station.length > 400, "切不出 _Station 那个类 —— 这一格在空转");
assert.ok(/def IS_CHANGED/.test(station) && /_prompt_hash\(cls\.STATION\)/.test(station),
  "四站的 IS_CHANGED 没了 —— 改完 prompts.js,Comfy 会把缓存里的旧答案当成新结果给你看");
assert.ok(/parts\.append\(b if b is not None else src\)/.test(nodesPy),
  "按站切提示词的那一步不再回落到整份文件 —— 切不出来时就该**多**重跑几站,"
  + "少重跑一站等于拿旧答案骗自己");

console.log(`ok   comfy-pack — 桥接真文件,${files.length} 个文件里 0 处提示词正文,`
  + `图 ${wf.nodes.length} 节点 / ${wf.links.length} 线全部对得上,改一站只重跑一站`);
