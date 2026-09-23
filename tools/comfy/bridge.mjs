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

   解谜管线(实验中,见 functions/_lib/puzzle/):
     pz_m1     {question, pin?, dry, conn, model, …}        → M1 读问题(拆几问、db、kind、事实归属)
     pz_build  {seed, gender, date, m1, question}           → 程序出题(没有模型):线索、验现事、题面
     pz_clue   {clue, q, pin?, dry, conn, model, …}         → 一条线索一个模型,只写一句
     pz_verify {item, words, pin?, dry, conn, model, …}     → 一处验现事一个模型,只做对照
     pz_solve  {question, lang, hurt, puzzles, answers, verify, pin?, dry, conn, model, …} → 解谜
   ⭐ 并联的那两步(线索、验现事)**一条一次调用**:画布那边按顺序一条一条调,
      本地一张卡同时只跑得动一个 —— 并发发过去也只是在服务端排队,还更容易超时。

   模型名留空 = 用端点列出的第一个(Unsloth / llama-server 一次只挂一个模型,名字不用抄)。
   `conn.reasoning` 给了就发 `chat_template_kwargs: {reasoning_effort}`(Qwen3.8 的思考开关);
   不给一个字段都不多发 —— 有的本地端点对不认识的字段回 400。
*/
import { buildNode } from "../../functions/_lib/nodes/fill.js";
import { M1, M2, M3, M4 } from "../../functions/_lib/nodes/prompts.js";
import { material, tok } from "../lab/board.mjs";
import { Local } from "../lab/client.mjs";
import { format as criteriaText } from "../../functions/_lib/doctrine/criteria.js";
import { format as timingText } from "../../functions/_lib/doctrine/timing.js";
import { puzzlesFor, sopSteps } from "../lab/puzzle.mjs";
import { readClueAnswer, readVerifyAnswer, puzzleText } from "../../functions/_lib/puzzle/program.js";
import { fillM1, fillClue, fillVerify, fillSolve, parseM1P } from "../../functions/_lib/puzzle/prompts.js";
import { loadSymbols } from "../../functions/_lib/doctrine/criteria-rules.mjs";

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

/* 每个槽**填进去的到底是什么**。
   做法:把模板按 `{{槽}}` 切开,切出来的字面段在填好的 system 里原样存在,
   所以两段字面之间的那一块就是那个槽的内容。

   ⭐ 为什么要这个:一站的 system 是一大块文字,`dry` 能把它整个打出来,
      但看不出「board 这个槽塞进去的是 3054 tok 的 JSON,而里面 tomb 是 false」。
      不知道哪段字是哪个槽来的,就没法把一个错误的断语追回到它的来源。

   ⚠️⚠️ **有些槽的边界靠字符串定不下来,而「拼回去一样」证明不了它定下来了。**
      模板 `头{{a}}中间{{b}}尾` 对上 `头中间X中间Y尾`:`a="" b="X中间Y"` 和
      `a="中间X" b="Y"` **两种切法都能原样拼回去**,只有一种是真的。
      第一版只做了拼回去那一关,于是两种都过,它挑了一种给出去。

      这在真模板上确实发生:M2 的 `{{ask}}` 和 `{{libraries}}` 之间只隔一个
      `\n\n`,而它在填好的正文里出现 **14 次**。

      做法不是整个作废(那会把 M2 的对照表全扔掉,而其中大部分是对的),
      是**逐槽标出它的边界唯不唯一**:分隔的那段字面在剩下的正文里只出现一次,
      这个槽就是定死的;出现多次就标 `ambiguous`,由显示的那一方说出来。
      **该给的照给,说不准的说出来** —— 不声不响地挑一种才是那个坏结果。 */
function slotFill(template, filled) {
  const parts = String(template).split(/(\{\{[a-z]+\}\})/);
  const isSlot = (p) => /^\{\{[a-z]+\}\}$/.test(p);
  const out = [];
  let pos = 0;
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (isSlot(p)) {
      const next = parts[i + 1];
      let end, ambiguous = false;
      if (next === undefined || next === "") {
        end = filled.length;
      } else {
        end = filled.indexOf(next, pos);
        if (end < 0) return null;
        /* 分隔的那段字面在这个槽之后还出现吗?出现就说明边界不是唯一的。 */
        ambiguous = filled.indexOf(next, end + 1) >= 0;
      }
      out.push({ slot: p.slice(2, -2), text: filled.slice(pos, end), ambiguous: ambiguous });
      pos = end;
    } else {
      if (!filled.startsWith(p, pos)) return null;
      pos += p.length;
    }
  }
  if (pos !== filled.length) return null;
  /* ⚠️⚠️ **歧义要往后传一格。** 一个槽的**尾**边界不确定,下一个槽的**头**
     边界就是同一条线,它的内容跟着不可靠 —— 实测 M4:`{{mark}}` 被切成 33 字
     (真值 637),标了记号;而多出来那 600 字全落进了 `{{voice}}`,
     `{{voice}}` 的尾边界是唯一的,于是它**没有记号**,读的人会信它。
     这正是这个仓库反复付钱的那种「规则只接了一半」。 */
  for (let i = 0; i < out.length - 1; i++) {
    if (out[i].ambiguous) out[i + 1].ambiguous = true;
  }
  /* 拼回去仍然要比一次 —— 它挡不住歧义,但挡得住真错位。 */
  let back = "", k = 0;
  for (const p of parts) back += isSlot(p) ? out[k++].text : p;
  return back === filled ? out : null;
}

/* 一次模型调用。三个节点类型共用:四站、解谜、线索、验现事 —— 端点、模型名、思考开关只在这里解释一次。 */
async function callModel(req, system, user) {
  const conn = req.conn || {};
  const client = new Local({
    base: conn.base || "http://127.0.0.1:8888/v1",
    key: conn.key || "local",
    timeout: Number(conn.timeout) || 600000
  });
  let model = String(req.model || "").trim();
  if (!model) {
    const ms = await client.models();
    if (!ms.length) throw new Error("model 留空,而端点上一个模型都没列出来 —— 模型加载好了吗?");
    model = ms[0];
  }
  const extra = conn.reasoning ? { chat_template_kwargs: { reasoning_effort: String(conn.reasoning) } } : null;
  const r = await client.chat({
    model, system, user,
    temperature: Number(req.temperature) || 0,
    max_tokens: Number(req.max_tokens) || 1024,
    extra
  });
  return { text: r.text, ms: r.ms, usage: r.usage, finish: r.finish, model };
}

/* 解谜那几步共用:钉住 / 只建提示词 / 真调,三选一。 */
async function runOrPin(req, system, user) {
  if (req.pin && String(req.pin).trim()) return { system, text: String(req.pin).trim(), pinned: true };
  if (req.dry) return { system, text: "", dry: true };
  return { system, ...(await callModel(req, system, user)) };
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
      /* 四张表和判据。⭐ **判据是拿 `csv` 判的,不是拿盘判的** ——
         求值器除了这四张表什么都看不见,这是「表够不够用」唯一能证明的形式。 */
      csv: m.csv,
      criteria: m.criteria,
      fights: m.fights,
      criteriaText: criteriaText(m.criteria, m.fights),
      timing: m.timing,
      timingText: timingText(m.timing),
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
    const fill = slotFill(TEMPLATE[station] || "", built.system);
    const out = {
      system: built.system,
      user: built.userOverride || String(req.body?.question || ""),
      sysTok: tok(built.system),
      slots: slotsOf(station),
      left: left.map((x) => x.slice(2, -2)),
      /* 每个槽填了什么、多大。对不齐时是 null —— 节点那边据此说「对不齐」,
         不拿一份可能错位的对照表糊弄过去。 */
      fill: fill && fill.map((f) => ({ slot: f.slot, tok: tok(f.text),
                                        ambiguous: f.ambiguous, text: f.text })),
      meta: built.meta || null
    };
    if (req.dry) return { ...out, text: "", dry: true };

    const r = await callModel(req, built.system, out.user);
    return { ...out, text: r.text, ms: r.ms, usage: r.usage, finish: r.finish, model: r.model };
  },

  /* ── 解谜管线 ─────────────────────────────────────────────────────────── */
  async pz_m1(req) {
    const system = fillM1(loadSymbols());
    const r = await runOrPin(req, system, String(req.question || ""));
    return { ...r, sysTok: tok(system), parsed: parseM1P(r.text) };
  },

  /* 程序出题。⚠️ 没有模型 —— 盘、判据、裁决梯、线索、验现事全是代码。 */
  pz_build(req) {
    const m1 = String(req.m1 || "");
    if (!parseM1P(m1).questions.length) {
      return { error: "M1 的输出里没有 q1= 那一行 —— 出不了题。先看「BW 解谜 M1」的原文。" };
    }
    const date = req.date ? new Date(String(req.date)) : null;
    if (date && isNaN(date.getTime())) return { error: `date「${req.date}」不是日期 —— 留空就是今天` };
    const { parsed, puzzles } = puzzlesFor({
      seed: req.seed === "random" ? "random" : Number(req.seed) || 1,
      gender: String(req.gender || ""),
      date, m1
    });
    const words = String(req.question || "");
    const flow = [];
    const spec = puzzles[0].m.spec;
    flow.push("投掷 " + spec.raw.join(" ") + ";动爻 " + (spec.changeIdx.map((i) => i + 1).join("、") || "无")
      + ";" + puzzles[0].p.摆桌子.本卦 + " 变 " + puzzles[0].p.摆桌子.变卦);
    for (const { m, p } of puzzles) {
      flow.push("");
      flow.push("第" + p.问.n + "问:" + p.问.ask + "(" + p.问.db + "," + p.问.kind + ")");
      sopSteps(m, p).forEach((x) => flow.push(x));
      if (p.打架.length) {
        flow.push("  打架  " + p.打架.map((f) => f.主体 + "第" + f.爻 + "爻 " + f.判.join("/")
          + " → " + (f.胜 ? "取" + f.胜 : "打平")).join(";"));
      }
      flow.push("  线索  " + p.线索.length + " 条:");
      p.线索.forEach((c) => flow.push("    [" + c.编号 + "] " + c.类 + "·" + c.判 + " —— "
        + (c.指向 ? c.指向.向 : "不标") + (c.候选 ? "(未指认,要写候选)" : "")));
      if ((p.验现事 || []).length) {
        flow.push("  验现事 " + p.验现事.length + " 处:");
        p.验现事.forEach((c) => flow.push("    [" + c.编号 + "] " + c.盘上));
      }
    }
    return {
      parsed,
      puzzles: puzzles.map(({ p }) => p),
      clues: puzzles.flatMap(({ p }) => p.线索.map((c) => ({ 编号: c.编号, clue: c, q: p.问 }))),
      checks: puzzles.flatMap(({ p }) => (p.验现事 || []).map((c) => ({ 编号: c.编号, item: c }))),
      words,
      flow: flow.join("\n")
    };
  },

  async pz_clue(req) {
    const system = fillClue(req.clue, req.q);
    const r = await runOrPin(req, system, "写。");
    return { ...r, parsed: r.dry ? null : readClueAnswer(req.clue, r.text) };
  },

  async pz_verify(req) {
    const system = fillVerify(req.item, req.words);
    const r = await runOrPin(req, system, "对照。");
    return { ...r, parsed: r.dry ? null : readVerifyAnswer(req.item, r.text, req.words) };
  },

  async pz_solve(req) {
    const text = (req.puzzles || []).map((p) => puzzleText(p, req.answers || {}, req.verify || {})).join("\n\n");
    const system = fillSolve({ question: String(req.question || ""), lang: req.lang, hurt: req.hurt, puzzlesText: text });
    const r = await runOrPin(req, system, "写给他。");
    return { ...r, material: text, sysTok: tok(system) };
  },

  async models(req) {
    const conn = req.conn || {};
    const client = new Local({ base: conn.base, key: conn.key, timeout: 15000 });
    return { models: await client.models() };
  }
};

const cmd = process.argv[2];
if (!CMD[cmd]) {
  process.stdout.write(JSON.stringify({ error: `没有这个命令:${cmd}(有:${Object.keys(CMD).join(" / ")})` }));
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
