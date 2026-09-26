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
import { readFileSync, readdirSync, statSync, mkdtempSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
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
/* 探针 = 每个 `export const X = \`` 之后的头一行。从提示词文件身上取,
   所以提示词改了探针跟着改 —— 写死几句话的话,改一次提示词这条就变成空话。
   两份:四站(nodes/prompts.js)和解谜(puzzle/prompts.js)。 */
const probes = [];
for (const file of ["functions/_lib/nodes/prompts.js", "functions/_lib/puzzle/prompts.js"]) {
  for (const m of read(file).matchAll(/export const ([A-Z0-9_]+)\s*=\s*`([^\n]{12,})/g)) {
    probes.push([m[1], m[2].trim()]);
  }
}
assert.ok(probes.length >= 9,
  `只取到 ${probes.length} 个探针(应 ≥9:M1–M4 + MARK + 解谜那四段)—— 正则失配了,这一格在空转`);

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

/* ── ③ 每一张图都和节点定义对得上 ─────────────────────────────────────── */
const declared = new Set(
  [...nodesPy.matchAll(/^\s{4}"(\w+)":\s*\w+,$/gm)].map((m) => m[1])
);
assert.ok(declared.size >= 13,
  `从 nodes.py 只解析到 ${declared.size} 个节点类型(应 ≥13)—— 正则失配了,这一格在空转`);
const WORKFLOWS = readdirSync(path.join(ROOT, "tools/comfy/workflows")).filter((f) => f.endsWith(".json"));
assert.ok(WORKFLOWS.length >= 4, `workflows/ 里只有 ${WORKFLOWS.length} 张图(应 ≥4:四站、四站 dry、解谜、解谜 dry)`);
/* 每条管线的每一站都得在它那张图上 —— 少一站的图仍然打得开、仍然出得来一篇东西。 */
const MUST = {
  "bournewise-4node": ["BWM1", "BWM2", "BWM3", "BWM4", "BWCast"],
  "bournewise-puzzle": ["BWPuzzleM1", "BWPuzzleBuild", "BWPuzzleClues", "BWPuzzleVerify", "BWPuzzleSolve"]
};
let wf = null;
for (const name of WORKFLOWS) {
  const w = JSON.parse(read("tools/comfy/workflows/" + name));
  if (name === "bournewise-4node.json") wf = w;
  assert.ok(w.nodes.length >= 8 && w.links.length >= 15,
    `${name} 只有 ${w.nodes.length} 个节点 / ${w.links.length} 条线 —— 它缩水了`);
  const byId = new Map(w.nodes.map((n) => [n.id, n]));
  for (const n of w.nodes) {
    assert.ok(declared.has(n.type),
      `${name} 用了 nodes.py 没有的节点类型「${n.type}」—— 打开时是「节点缺失」,而原因在另一个文件里`);
  }
  for (const [lid, from, fromSlot, to, toSlot, type] of w.links) {
    const a = byId.get(from), b = byId.get(to);
    assert.ok(a && b, `${name} 第 ${lid} 条线指向不存在的节点(${from} → ${to})`);
    const out = a.outputs[fromSlot], inp = b.inputs[toSlot];
    assert.ok(out && inp, `${name} 第 ${lid} 条线接在不存在的插口上(${a.type}[${fromSlot}] → ${b.type}[${toSlot}])`);
    assert.equal(out.type, type, `${name} 第 ${lid} 条线的类型 ${type} 和 ${a.type}.${out.name}(${out.type})对不上`);
    assert.equal(inp.type, type, `${name} 第 ${lid} 条线的类型 ${type} 和 ${b.type}.${inp.name}(${inp.type})对不上`);
    assert.ok((out.links || []).includes(lid), `${name}:${a.type}.${out.name} 没记住第 ${lid} 条线`);
    assert.equal(inp.link, lid, `${name}:${b.type}.${inp.name} 没记住第 ${lid} 条线`);
  }
  const family = Object.keys(MUST).find((k) => name.startsWith(k));
  assert.ok(family, `${name} 不属于任何一条管线 —— 新加的图要在这里登记它必须有哪几站`);
  for (const t of MUST[family]) {
    assert.ok(w.nodes.some((n) => n.type === t), `${name} 上没有 ${t} —— 少一站的管线照样跑得出东西`);
  }
}
assert.ok(wf, "四站那张图不见了");

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

/* ── ⑤ 那个能下载的包,得能在没有仓库的地方自己跑起来 ─────────────────────
   ⭐ 这一格不扫源码,它**把包铺到系统临时目录里,然后在那儿真跑一次**。
      理由是这个包唯一承重的性质就是「自带全部依赖」,而那件事看源码看不出来:
      少带一个文件时,`pack.mjs` 一声不吭,`nodes.py` 一声不吭,
      **只有用户那台机器会炸**。临时目录在仓库外面,相对 import 够不到仓库,
      所以跑通了就是真的跑通了。 */
const { stage } = await import("../tools/comfy/pack.mjs");
const tmp = mkdtempSync(path.join(tmpdir(), "bw-pack-"));
try {
  const { root, files: packed } = stage(tmp);
  assert.ok(!root.startsWith(ROOT.replace(/\/$/, "")),
    `包铺在了仓库里面(${root})—— 那它够得着仓库,这一格证明不了任何事`);
  assert.ok(packed.length >= 18, `包里只有 ${packed.length} 个文件 —— 闭包算漏了`);
  for (const must of ["functions/_lib/nodes/prompts.js", "functions/_lib/doctrine/rag/data.js",
                      "liuyao-engine.js", "liuyao-ai.js", "tools/lab/board.mjs"]) {
    assert.ok(packed.includes(must), `包里没有 ${must} —— 它会在用户那台机器上才炸`);
  }
  /* MANIFEST 的哈希必须真的对得上源文件。对不上的话「可以查」就是一句空话。 */
  const man = JSON.parse(readFileSync(path.join(root, "MANIFEST.json"), "utf8"));
  assert.equal(Object.keys(man.files).length, packed.length, "MANIFEST 记的文件数和实际打进去的对不上");
  for (const f of packed) {
    const want = createHash("sha256").update(readFileSync(path.join(ROOT, f))).digest("hex");
    assert.equal(man.files[f], want, `MANIFEST 里 ${f} 的哈希和仓库里的对不上`);
    assert.equal(createHash("sha256").update(readFileSync(path.join(root, "repo", f))).digest("hex"), want,
      `包里的 ${f} 和仓库里的不是同一份 —— 打包时改写过它,那它就会开始漂`);
  }
  /* 真跑一次:盘那一半不需要模型,所以这一格不碰网络。 */
  const r = spawnSync(process.execPath,
    [path.join(root, "repo/tools/comfy/bridge.mjs"), "board"],
    { input: JSON.stringify({ seed: 1, db: "婚恋", gender: "m" }), encoding: "utf8" });
  assert.equal(r.status, 0,
    "包在仓库外面跑不起来 —— 它不是自带依赖的:\n" + String(r.stderr).trim().slice(-800));
  const out = JSON.parse(r.stdout);
  assert.ok(Array.isArray(out.features) && out.features.length >= 10,
    `包跑出来只有 ${out.features?.length} 个 feature —— 引擎没装全`);
  assert.ok(out.boardText && out.ladder && out.relations, "包跑出来的盘缺了 boardText/ladder/relations");
  /* 解谜那一条的出题(纯代码)在包里也要能跑 —— 它 fs 读补全包,闭包看不见那几份 */
  const pz = spawnSync(process.execPath,
    [path.join(root, "repo/tools/comfy/bridge.mjs"), "pz_build"],
    { input: JSON.stringify({ seed: 1, gender: "m", date: "2026-09-23T12:00:00Z", question: "我和她还有可能复合吗",
                              m1: "lang=Chinese\nq1=我和她还有可能复合吗 | db=婚恋 | kind=能不能\nhurt=0\nflags=无\nfacts=无" }),
      encoding: "utf8" });
  assert.equal(pz.status, 0, "包里的解谜出题跑不起来:\n" + String(pz.stderr).trim().slice(-800));
  const pzo = JSON.parse(pz.stdout);
  assert.ok(pzo.clues && pzo.clues.length >= 2, `包里出题只出了 ${pzo.clues && pzo.clues.length} 条线索 —— 判据或补全包没装全`);
  /* 「浏览模板」用的那几张图:顶层 example_workflows/ 里的每一份都要和仓库里的那张字节一致 */
  const copies = man.copies || {};
  assert.ok(Object.keys(copies).length >= 4, `example_workflows 只有 ${Object.keys(copies).length} 张图(应 ≥4)`);
  for (const [to, from] of Object.entries(copies)) {
    assert.equal(createHash("sha256").update(readFileSync(path.join(root, to))).digest("hex"),
      createHash("sha256").update(readFileSync(path.join(ROOT, from))).digest("hex"),
      `${to} 和 ${from} 不是同一份 —— 用户从模板里打开的图就不是仓库里那张`);
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

/* ── ⑥ 自带 node 的那一版:解开就能用,而且用的就是包里那个 node ──────────────
   Windows 上的用户多半没装 node,也不会装(owner:「这边实在不会下」)。所以 win-x64 那一版
   把官方 node.exe 放进 bournewise-comfy/node/,nodes.py 在打包的目录结构里先找它。
   这里拿一个转发给当前 node 的小脚本冒充那个二进制(几十字节,不用把 100MB 拷来拷去),
   然后**在包里真跑一次**:nodes.py 挑中的必须是包里那个,而且经它跑得通。 */
const tmp2 = mkdtempSync(path.join(tmpdir(), "bw-pack-node-"));
try {
  const fakeNode = path.join(tmp2, "node");
  writeFileSync(fakeNode, `#!/bin/sh\nexec "${process.execPath}" "$@"\n`, { mode: 0o755 });
  /* 校验和对不上就不打 —— 一个来路说不清的 exe 不许进别人的 ComfyUI */
  const badSums = path.join(tmp2, "SHASUMS256.txt");
  writeFileSync(badSums, "0".repeat(64) + "  win-x64/node.exe\n");
  assert.throws(() => stage(path.join(tmp2, "bad"), { node: fakeNode, nodeSums: badSums }), /对不上/,
    "node 的校验和对不上,包照样打出来了");

  const { root: r2, bundledNode } = stage(path.join(tmp2, "ok"), { node: fakeNode });
  assert.ok(bundledNode && bundledNode.file === "node/node.xz", "自带的 node 没以 .xz 进包,或者 MANIFEST 没记");
  assert.ok(!existsSync(path.join(r2, "node/node")), "包里已经有解开的 node —— 那就不是压缩过的那一版");
  const man2 = JSON.parse(readFileSync(path.join(r2, "MANIFEST.json"), "utf8"));
  assert.equal(man2.bundledNode.sha256, createHash("sha256").update(readFileSync(fakeNode)).digest("hex"),
    "MANIFEST 记的是解开之后那个 node 的哈希,和原件对不上");
  const env = { ...process.env };
  delete env.BW_NODE_BIN; delete env.BOURNEWISE_ROOT;
  const py = spawnSync("python3", ["-c", `
import json, importlib.util as u
s = u.spec_from_file_location("bwn", ${JSON.stringify(path.join(r2, "repo/tools/comfy/nodes.py"))})
N = u.module_from_spec(s); s.loader.exec_module(N)
b = N._bridge("board", {"seed": 1, "db": "婚恋", "gender": "m"})
print(json.dumps({"bin": N._node_bin(), "features": len(b["features"])}))
`], { encoding: "utf8", env });
  assert.equal(py.status, 0, "包里的 nodes.py 经自带的 node 跑不起来:\n" + (py.stderr || "").trim().slice(-800));
  const got = JSON.parse(py.stdout.trim().split("\n").pop());
  assert.equal(got.bin, path.join(r2, "node", "node"), `nodes.py 挑的 node 是 ${got.bin},不是包里自带的那个`);
  assert.ok(got.features >= 10, "经自带的 node 跑出来的盘不完整");
  assert.equal(createHash("sha256").update(readFileSync(path.join(r2, "node/node"))).digest("hex"), man2.bundledNode.sha256,
    "第一次用时解开的 node 和原件不是同一份");
  /* 解开之后被篡改(或者压缩包下载坏了):解开前的校验必须拦下 —— 删掉解开的那份,换一个坏的 .xz 再来 */
  rmSync(path.join(r2, "node/node"));
  writeFileSync(path.join(r2, "node/node.xz"), spawnSync("xz", ["-c"], { input: "#!/bin/sh\nexit 0\n" }).stdout);
  const bad = spawnSync("python3", ["-c", `
import importlib.util as u
s = u.spec_from_file_location("bwn", ${JSON.stringify(path.join(r2, "repo/tools/comfy/nodes.py"))})
N = u.module_from_spec(s); s.loader.exec_module(N)
N._bundled_node()
`], { encoding: "utf8", env });
  assert.notEqual(bad.status, 0, "一个校验和对不上的 node 被解开并用上了");
  assert.ok(/对不上/.test(bad.stderr), "校验和不对时报的不是校验和的事:\n" + bad.stderr.slice(-400));
  assert.ok(!existsSync(path.join(r2, "node/node")), "校验和不对的 node 还是被留在了包里");
} finally {
  rmSync(tmp2, { recursive: true, force: true });
}

console.log(`ok   comfy-pack — 桥接真文件,${files.length} 个文件里 0 处提示词正文,`
  + `${WORKFLOWS.length} 张图每条线都对得上,改一站只重跑一站,`
  + "包在仓库外能自己跑起来且字节一致,自带 node 的那一版用的就是包里那个 node");
