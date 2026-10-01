/* 契约:解谜管线在 ComfyUI 上真跑得通 —— 经过真的 Python 节点、真的桥、一个假端点。
   ────────────────────────────────────────────────────────────────────────
   owner 的用法:ComfyUI 里接本地 Qwen3.8(Unsloth 起的 OpenAI 兼容端点),
   **并联的那两步(线索、验现事)一条一条跑**。这条钉的是:

     ① 五个节点首尾接得上,每个节点返回的个数就是它声明的个数
        (声明 3 个、返回 4 个,在 ComfyUI 里一跑就 ValueError,而只查声明的断言是绿的)。
     ② 线索一条一次调用,条数 = 题面里的条数;钉住的那一条原样用,不调模型。
     ③ 验现事交回来的「对上」必须抄得出他的原话(假端点答「他没说」,这里只核接线)。
     ④ 思考开关:不选就**一个字段都不多发**;选了才发 chat_template_kwargs.reasoning_effort。
        本地端点有的对不认识的字段回 400 —— 默认多发一个,整条管线在那台机器上就起不来。
     ⑤ Qwen3.x 写在 <think> 里的思考被剥掉:思考里也会出现「q1=」「这一卦里=」,
        不剥的话下游按行解析,读到的是它想过又否掉的那一版。
*/
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { stripThink } from "../tools/lab/client.mjs";

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");

/* ⑤ */
assert.equal(stripThink("<think>q1=想过的\n</think>\nq1=真的"), "q1=真的");
assert.equal(stripThink("想了半天 q1=不算\n</think>\n\nq1=真的"), "q1=真的", "只有闭合那一半的思考没剥干净");
assert.equal(stripThink("<think>被 max_tokens 截在思考中途 q1=不算"), "", "截断在思考里的输出被当成了答案");
assert.equal(stripThink("q1=没有思考"), "q1=没有思考");

/* 起一个假端点 */
async function fake() {
  for (let tries = 0; tries < 5; tries++) {
    const port = 20000 + Math.floor(Math.random() * 30000);
    const p = spawn(process.execPath, [ROOT + "/tools/lab/fake-model.mjs", String(port)], { stdio: ["ignore", "pipe", "pipe"] });
    let log = "";
    const up = await new Promise((res) => {
      const t = setTimeout(() => res(false), 5000);
      p.stdout.on("data", (d) => { log += d; if (/假模型端点/.test(log)) { clearTimeout(t); res(true); } });
      p.on("exit", () => { clearTimeout(t); res(false); });
    });
    if (up) return { port, proc: p, log: () => log };
    p.kill();
  }
  throw new Error("假端点起不来");
}

const PY = (base, reasoning) => `
import sys, json, importlib.util as u
spec = u.spec_from_file_location("bwnodes", ${JSON.stringify(ROOT + "/tools/comfy/nodes.py")})
N = u.module_from_spec(spec); spec.loader.exec_module(N)
M = N.NODE_CLASS_MAPPINGS
out = {}
def call(name, *a):
    r = M[name]().go(*a)
    assert len(r) == len(M[name].RETURN_TYPES), "%s 声明 %d 个输出,go 返回 %d 个" % (name, len(M[name].RETURN_TYPES), len(r))
    return r
conn, note = M["BWEndpoint"]().go(${JSON.stringify(base)}, "local", 30, ${JSON.stringify(reasoning)})
out["endpoint"] = note
ask, _ = call("BWAsk", "我和她还有可能复合吗", "", "男 m")
m1, m1raw, m1note = call("BWPuzzleM1", conn, ask, "", 0.0, 512, False, "")
out["m1"] = m1raw
puz, flow = call("BWPuzzleBuild", ask, m1, 1, "2026-09-23T12:00:00Z")
out["clues"] = [c["编号"] for c in puz["clues"]]
out["checks"] = [c["编号"] for c in puz["checks"]]
first = out["clues"][0]
ans, raw, note = call("BWPuzzleClues", conn, puz, "", 0.0, 256, False, "[%s]\\n这一卦里=钉住的这一句" % first)
out["answers"] = ans
out["clueNote"] = note
ver, vraw, vnote = call("BWPuzzleVerify", conn, puz, "", 0.0, 256, False, "")
out["verify"] = ver
text, snote, material = call("BWPuzzleSolve", conn, puz, ans, "", 0.0, 4096, False, ver, "")
out["reading"] = text
out["material"] = material
print(json.dumps(out, ensure_ascii=False))
`;

/* ⚠️ spawnSync 期间这个进程的事件循环是停着的,假端点写到管道里的日志要等它回来才读得到 ——
   不等一下就去数,数到的是 0,而那看起来像「一次都没调模型」。 */
const settle = () => new Promise((r) => setTimeout(r, 400));

const f = await fake();
try {
  const base = `http://127.0.0.1:${f.port}/v1`;
  const runA = spawnSync("python3", ["-c", PY(base, "不发(按启动参数)")], { encoding: "utf8", cwd: ROOT, timeout: 120000 });
  assert.equal(runA.status, 0, "解谜那五个节点接不起来:\n" + (runA.stderr || "").trim().slice(-1500));
  const a = JSON.parse(runA.stdout.trim().split("\n").pop());
  await settle();

  /* ① ② */
  assert.ok(/q1=/.test(a.m1), "M1 节点没交出 q1= 那一行");
  assert.ok(a.clues.length >= 2, `只出了 ${a.clues.length} 条线索 —— 这条在空转`);
  assert.deepEqual(Object.keys(a.answers).sort(), [...a.clues].sort(), "线索答案和题面里的线索对不上 —— 有一条没跑");
  assert.equal(a.answers[a.clues[0]].句, "钉住的这一句", "钉住的那一条没有原样用");
  for (const [k, v] of Object.entries(a.answers)) {
    assert.deepEqual(v.problems, [], `[${k}] 交回来的答案过不了程序那一关:${v.problems}`);
  }
  const calledClues = (f.log().match(/ pz_clue /g) || []).length;
  assert.equal(calledClues, a.clues.length - 1, `线索调了 ${calledClues} 次模型,应当是 ${a.clues.length - 1} 次(一条钉住)`);
  /* ③ */
  for (const [k, v] of Object.entries(a.verify)) {
    assert.equal(v.对照, "他没说", `[${k}] 假端点答的是「他没说」,节点交出来的是「${v.对照}」`);
  }
  assert.equal(Object.keys(a.verify).length, a.checks.length, "验现事有几处就该对照几处");
  /* 解谜拿到的材料里:第一问、线索、钉住的那一句都在 */
  assert.ok(/【第1问】/.test(a.material) && /钉住的这一句/.test(a.material), "解谜拿到的材料里没有题和线索答案");
  assert.ok(/\{[^{}|]+\|[^{}|]+\}/.test(a.reading), "解读里没有取象标记 —— 页面上的象按钮会全黑");
  /* ④ 不选思考:一个字段都不多发 */
  assert.ok(!/ctk=/.test(f.log()), "没选思考,请求里却带了 chat_template_kwargs —— 有的本地端点会因此 400");

  const runB = spawnSync("python3", ["-c", PY(base, "none")], { encoding: "utf8", cwd: ROOT, timeout: 120000 });
  assert.equal(runB.status, 0, "思考=none 时接不起来:\n" + (runB.stderr || "").trim().slice(-1500));
  await settle();
  assert.ok(/ctk=\{"reasoning_effort":"none"\}/.test(f.log()), "选了思考=none,请求里却没有 reasoning_effort");

  console.log(`ok   comfy-puzzle — 五个解谜节点接一个假端点真跑:线索 ${a.clues.length} 条一条一条调、`
    + `钉住的那条原样用,验现事 ${a.checks.length} 处,思考开关不选就一个字段都不多发`);
} finally {
  f.proc.kill();
}
