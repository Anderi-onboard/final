#!/usr/bin/env node
/* ComfyUI 那套节点的 node 侧 —— **唯一**碰盘和提示词的地方。
   ────────────────────────────────────────────────────────────────────────
   Comfy 的节点是 Python,而盘(`liuyao-*.js`)和提示词(`functions/_lib/nodes/`)
   是 JS。两条路可走,而其中一条是错的:

     ✗ 把引擎和提示词照抄一份 Python  → **第二张要同步的名单**。本仓库为这件事
       付过三次学费(方法页的减半规则、触控热区、天际线那张表),而这一次代价
       更重:两份会各自跑出一篇**看起来都正常**的解读,没有任何东西会报错。
     ✓ Python 只做画布,盘和提示词从这里出,而这里 import 的是**仓库里那几个真文件**。

   所以这个进程存在的全部理由是:让 Python 够得着 `buildNode`。它自己不写
   任何一句提示词 —— `tests/comfy-bridge.mjs` 钉着这一条(它拿 prompts.js 里
   每一站的头一句去扫 tools/comfy/,扫到就红)。

   协议:argv[2] 是命令,stdin 一段 JSON,stdout 一段 JSON。
     board    {seed, db, gender}                    → 盘面那一半(没有模型)
     station  {station, body, dry, conn, model, …}  → 建提示词,然后(除非 dry)调模型
     models   {conn}                                → 端点上有哪些模型
*/
import { buildNode } from "../../functions/_lib/nodes/fill.js";
import { M1, M2, M3, M4 } from "../../functions/_lib/nodes/prompts.js";
import { material, tok } from "../lab/board.mjs";
import { Local } from "../lab/client.mjs";

const TEMPLATE = { m1: M1, m2: M2, m3: M3, m4: M4 };

/* 这一站的提示词**真正读了哪几个槽**。
   ⭐ 这是一面镜子,不是第二张名单:它是从模板本身量出来的,模板改了它跟着改。
      M4 的槽里没有 `board` —— 那条「盘只发给 M3,不发给 M4」的规矩因此在
      画布上**看得见**,而规矩本身仍然只写在 `fill.js` 一处。
      要是哪天 fill.js 真的给 M4 发盘了,这里会立刻多出一个 board,
      不需要谁记得回来改这个文件。 */
function slotsOf(station) {
  const t = TEMPLATE[station] || "";
  return [...new Set(t.match(/\{\{[a-z]+\}\}/g) || [])].map((x) => x.slice(2, -2));
}

async function readStdin() {
  let s = "";
  for await (const c of process.stdin) s += c;
  return s;
}

const CMD = {
  /* 盘面那一半 —— 投掷、排盘、取用神、裁决梯、feature、关系,**全是代码,没有模型**。
     ⚠️ 用神要 M1 的 `db`,所以图上 M1 在起卦**前面**。少了它用神退回世爻,
        那是一副和真跑时不一样的盘,而它照样能跑完四站。 */
  board(req) {
    const m = material({
      seed: req.seed === "random" ? "random" : Number(req.seed) || 1,
      db: String(req.db || ""),
      gender: String(req.gender || "")
    });
    const verdict = (m.ladder.match(/裁决:(.*)/) || [])[1] || "?";
    return {
      spec: { raw: m.spec.raw, changeIdx: m.spec.changeIdx },
      features: m.features,
      featureWhy: m.featureWhy,
      subject: m.subject,
      ladder: m.ladder,
      relations: m.relations,
      boardText: m.boardText,
      verdict,
      summary: [
        `投掷 ${m.spec.raw.join(" ")}   动爻 ${m.spec.changeIdx.map((i) => i + 1).join(",") || "无"}`,
        `用神 ${m.subject.key} ← ${m.subject.source}`,
        `     ${m.subject.why || ""}`,
        `裁决 ${verdict}`,
        `feature ${m.features.length} 个:`,
        "  " + (m.features.join(" ") || "(无)"),
        "",
        m.ladder
      ].join("\n")
    };
  },

  /* 一站。`buildNode` 是上线那一份 —— 这里不复制它的任何一个 `.replace()`。 */
  async station(req) {
    const station = String(req.station || "");
    const built = buildNode(station, req.body || {});
    if (!built) return { error: `buildNode('${station}') 回了 null —— 站名只能是 m1/m2/m3/m4` };

    const left = [...new Set(built.system.match(/\{\{[a-z]+\}\}/g) || [])];
    const out = {
      system: built.system,
      user: built.userOverride || String(req.body?.question || ""),
      sysTok: tok(built.system),
      slots: slotsOf(station),
      left: left.map((x) => x.slice(2, -2)),
      meta: built.meta || null
    };
    if (req.dry) return { ...out, text: "", dry: true };

    const conn = req.conn || {};
    const client = new Local({
      base: conn.base || "http://localhost:11434/v1",
      key: conn.key || "local",
      timeout: Number(conn.timeout) || 600000
    });
    if (!req.model) return { error: "这一站没填模型名 —— 节点上的 model 是空的" };
    const r = await client.chat({
      model: String(req.model),
      system: built.system,
      user: out.user,
      temperature: Number(req.temperature) || 0,
      max_tokens: Number(req.max_tokens) || 1024
    });
    return { ...out, text: r.text, ms: r.ms, usage: r.usage, finish: r.finish };
  },

  async models(req) {
    const conn = req.conn || {};
    const client = new Local({ base: conn.base, key: conn.key, timeout: 15000 });
    return { models: await client.models() };
  }
};

const cmd = process.argv[2];
if (!CMD[cmd]) {
  process.stdout.write(JSON.stringify({ error: `没有这个命令:${cmd}(只有 board / station / models)` }));
  process.exit(1);
}
try {
  const raw = await readStdin();
  const res = await CMD[cmd](raw.trim() ? JSON.parse(raw) : {});
  process.stdout.write(JSON.stringify(res));
} catch (e) {
  /* ⚠️ 错误要**两边都写**:stdout 的 JSON 给 Python 抛成节点报错(用户在画布上看),
     stderr 给 ComfyUI 的控制台(带堆栈,排查用)。只写一边的话,总有一边
     只看到「节点失败」四个字。 */
  process.stdout.write(JSON.stringify({ error: String(e && e.message || e) }));
  process.stderr.write(String(e && e.stack || e) + "\n");
  process.exit(1);
}
