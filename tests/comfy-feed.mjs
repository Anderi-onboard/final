/* 契约:每一站到底把什么喂给了模型。
   ────────────────────────────────────────────────────────────────────────
   一站的 system 是一大块文字。`dry` 能把它整个打出来,但看不出哪一段是哪个槽
   来的 —— 于是一句错的断语没法追回它的来源。`bridge.mjs` 的 `slotFill()`
   把它按槽拆开,这个文件钉它不许拆错。

   拆错的方式不报错:填进去的内容里正好含有模板的下一段字面,`indexOf` 就切早了,
   后面每一个槽都错位一格。错位的对照表比没有对照表更糟,它会把人指向错的那一段。

   ⚠️⚠️ **「拼回去一样」证明不了切法唯一 —— 第一版就是这么漏的。**
   模板 `头{{a}}中间{{b}}尾` 对上 `头中间X中间Y尾`,`a="" b="X中间Y"` 和
   `a="中间X" b="Y"` 两种切法都能原样拼回去,只有一种是真的,而那一关两种都过。
   这在真模板上确实发生:M2 的 `{{ask}}` 和 `{{libraries}}` 之间只隔一个换行对,
   而它在填好的正文里出现十几次。

   所以 `slotFill` 做两件事,这个文件两件都钉:
     一、拼回去必须一字不差(挡真错位)
     二、边界定不下来的槽标 `ambiguous`(挡歧义),由显示的那一方说出来
   **该给的照给,说不准的说出来。** 整个作废会把 M2 那张表全扔掉,而其中大部分
   是对的;不声不响地挑一种才是那个坏结果。
*/
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { material, tok } from "../tools/lab/board.mjs";
import { buildNode } from "../functions/_lib/nodes/fill.js";
import { M1, M2, M3, M4 } from "../functions/_lib/nodes/prompts.js";

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const src = readFileSync(ROOT + "/tools/comfy/bridge.mjs", "utf8");

/* ⚠️ 从 bridge.mjs **切出**那个函数来测,不是在这里抄一份。
   抄一份就是第二张名单:bridge 改了这里不动,而两份都跑得通。 */
const cut = src.match(/function slotFill\([\s\S]*?\n\}/);
assert.ok(cut, "bridge.mjs 里找不到 slotFill —— 这条契约在测一个不存在的函数");
const slotFill = new Function("return " + cut[0])();

const TEMPLATE = { m1: M1, m2: M2, m3: M3, m4: M4 };
const m = material({ seed: 1, db: "婚恋", gender: "m" });
const body = {
  question: "我和她还有可能吗",
  features: m.features,
  board: m.boardText,
  ladder: m.ladder,
  relations: m.relations,
  m1: "lang=zh\ndb=婚恋\nask=还有可能吗\nhurt=2\nflags=\nfacts=",
  m2: "lib=TECH-SYMBOLIC\nlib=TECH-RELATION-FLOW",
  m3: "程=第6爻化墓"
};

let totalSlots = 0, stationsWithSlots = 0, sawAmbiguous = 0;
for (const st of ["m1", "m2", "m3", "m4"]) {
  const built = buildNode(st, body);
  assert.ok(built && built.system, `buildNode('${st}') 没有建出 system`);
  const fill = slotFill(TEMPLATE[st], built.system);

  /* 拼回去必须**一个字符都不差**。 */
  assert.ok(fill !== null,
    `${st} 的槽拼不回原文 —— 模板和填好的 system 对不上,不是歧义问题。`);
  const back = TEMPLATE[st].split(/(\{\{[a-z]+\}\})/).reduce((acc, p, i, arr) => {
    if (!/^\{\{[a-z]+\}\}$/.test(p)) return acc + p;
    const used = arr.slice(0, i).filter((x) => /^\{\{[a-z]+\}\}$/.test(x)).length;
    return acc + fill[used].text;
  }, "");
  assert.equal(back, built.system,
    `${st} 的槽拆开再拼回去,和填好的 system 不一样 —— 对照表是错位的`);

  /* 槽名必须和模板里的一致,顺序也一致(同一个槽出现两次就该出现两条)。 */
  const want = (TEMPLATE[st].match(/\{\{[a-z]+\}\}/g) || []).map((x) => x.slice(2, -2));
  assert.deepEqual(fill.map((f) => f.slot), want,
    `${st} 拆出来的槽和模板里的对不上`);
  totalSlots += fill.length;
  sawAmbiguous += fill.filter((f) => f.ambiguous).length;
  if (fill.length) stationsWithSlots++;

  /* 每一格的 tok 要和它自己的文本对得上 —— 表里的数字和下面的全文是同一样东西。 */
  for (const f of fill) {
    assert.equal(f.tok !== undefined ? f.tok : tok(f.text), tok(f.text),
      `${st} 的 {{${f.slot}}} 报的 tok 和它的文本对不上`);
  }
}
assert.ok(totalSlots >= 15, `四站一共只拆出 ${totalSlots} 个槽 —— 正则失配了,这条在空转`);
/* ⚠️ 真模板上确实有边界定不下来的槽(M2 的 {{ask}} 后面只隔一个 `\n\n`,
   而它在填好的正文里出现十几次)。这条钉住那个标记不是摆设 —— 它要是从来
   不亮,说明判定写错了,而对照表会一直显得每一格都板上钉钉。 */
assert.ok(sawAmbiguous > 0,
  "四站没有一个槽被标成 ambiguous —— 判定失效了。M2 的 {{ask}} 和 {{libraries}} "
  + "之间只隔一个换行对,那个边界本来就定不下来");
assert.ok(stationsWithSlots >= 3, "只有不到三站有槽 —— 模板读错了");

/* ── 错位必须被挡住,而不是悄悄给一份错的 ─────────────────────────────
   造一个「填进去的内容含有下一段字面」的例子,slotFill 必须返回 null。 */
{
  const tpl = "头{{a}}中间{{b}}尾";
  assert.deepEqual(slotFill(tpl, "头X中间Y尾").map((f) => f.slot), ["a", "b"], "正常情形该拆得开");

  /* 真错位必须作废,这两条各打一个守卫:
     前者打「字面必须从当前位置开始」,后者打「收尾的字面找不到」。
     ⚠️ 上一版没有这两条,于是把守卫整个拿掉,契约照样绿 —— 因为真模板上
        字面本来就对得上,变异是个空操作。**一个打不到目标的用例,绿比红更糟。** */
  assert.equal(slotFill("头{{a}}尾", "XX头A尾"), null,
    "填好的正文开头就和模板对不上,却没有作废 —— 那说明字面没有在被核对");
  assert.equal(slotFill("头{{a}}尾", "头A"), null,
    "收尾的字面根本不在正文里,却没有作废");
  /* ⚠️ `slotFill` 里的三道守卫(字面必须从当前位置开始、走完要正好到结尾、
     拼回去一字不差)**互相兜底**:单独拿掉任何一道,另外两道还挡得住,
     所以单点变异验不出红。实测三道一起拿掉才红。
     记在这里,是因为下一个人按「植一个违规看它红不红」的惯例来验这一段时,
     会得到 exit=0,然后以为这几条断言是摆设 —— 它们不是,是被守卫的冗余挡住了。 */
  /* a 填进去的内容里带了「中间」两个字。这时有**两种**切法都能原样拼回去:
       a=""     b="X中间Y"
       a="中间X" b="Y"
     只有一种是真的,而「拼回去一样」两种都过 —— 所以必须返回 null。
     ⚠️ 这一条是 slotFill 第一版真的漏掉的:它只做了拼回去那一关。 */
  const amb = slotFill(tpl, "头中间X中间Y尾");
  assert.ok(amb && amb[0].ambiguous === true,
    "有两种切法都能拼回去时,slotFill 没有把那个槽标成 ambiguous。\n"
    + "  → 「拼回去一样」证明不了切法唯一。分隔的那段字面在正文里不止出现一次时,\n"
    + "    边界就是定不下来的。不声不响地挑一种,会把人指向错的那一段。");
  /* 反过来:唯一的切法不许被误标。 */
  const uniq = slotFill(tpl, "头AAA中间BBB尾");
  assert.deepEqual(uniq.map((f) => f.text), ["AAA", "BBB"], "唯一的切法拆错了");
  assert.ok(uniq.every((f) => !f.ambiguous),
    "边界唯一的槽被标成了 ambiguous —— 那等于每个槽都挂着一句免责声明,提示就没用了");

  /* ⚠️ **歧义要往后传一格。** 一个槽的尾边界不确定,下一个槽的头边界就是同一条线。
     实测 M4:`{{mark}}` 被切成 33 字(真值 637)并标了记号,而多出来那 600 字
     全落进 `{{voice}}`,后者的尾边界唯一,于是**没有记号** —— 读的人会信它。 */
  const chain = slotFill("头{{a}}中间{{b}}尾{{c}}末", "头中间X中间Y尾Z末");
  assert.ok(chain && chain[0].ambiguous && chain[1].ambiguous,
    "a 的边界不确定,而它后面的 b 没被标上 —— 歧义没有往后传。\n"
    + "  → b 的头边界就是 a 的尾边界,同一条线。只标前一个,后一个看起来是可信的。");
}

/* ── 节点那一侧:喂料必须是一个真的输出,而不是塞进「注」里 ─────────────
   注是一行摘要,喂料是几千 tok 的全文。塞在一起的话,注就没法看了,
   而人会转去看 system 全文 —— 那正是拆开槽要解决的问题。 */
const nodes = readFileSync(ROOT + "/tools/comfy/nodes.py", "utf8");
for (const cls of ["BWM1", "BWM2", "BWM3", "BWM4"]) {
  const body2 = nodes.slice(nodes.indexOf("class " + cls),
    nodes.indexOf("class ", nodes.indexOf("class " + cls) + 6));
  assert.ok(/RETURN_NAMES\s*=\s*\([^)]*"喂料"/.test(body2),
    `${cls} 没有「喂料」这个输出 —— 模型拿到了什么就只能靠读一整块 system`);
}
assert.ok(/def _feed\(/.test(nodes), "nodes.py 里没有 _feed");
assert.ok(/拉取/.test(nodes), "_feed 没有报「拉取了什么」—— 开了哪几张卡是检索的唯一可见处");

/* ── 声明了几个输出,`go` 就得真的返回几个 ─────────────────────────────
   ⚠️⚠️ 上面那几条只查了 `RETURN_NAMES` 里有没有「喂料」—— **那是声明,不是行为**。
   给四站加输出时,`BWM2.go` 的 `return` 没跟上,它在画布上一跑就
   `ValueError: too many values to unpack`,而这个契约当时是绿的。
   ⭐ 所以这里**真的把节点调一遍**,数返回的个数。别数源码里的逗号:
      `BWM1` 的返回里那个字典自带逗号,数出来是 5 个,而实际是 4 个。 */
{
  const py = `
import sys; sys.path.insert(0, ${JSON.stringify(ROOT + "/tools")})
from comfy.nodes import BWAsk, BWCast, NODE_CLASS_MAPPINGS as M
ask,_ = BWAsk().go("我和她还有可能吗", "", "男 m")
board,_ = BWCast().go(ask, 1, "婚恋")
m1 = {"text":"lang=zh\\ndb=婚恋\\nask=X\\nhurt=0\\nflags=\\nfacts=","parsed":{"db":"婚恋","gender":"m"}}
conn = {"base":"http://127.0.0.1:1/v1","key":"x","timeout":1000}
calls = {
 "BWM1": lambda c: c().go(conn, ask, "none", 0.0, 512, True, ""),
 "BWM2": lambda c: c().go(conn, ask, board, m1, "none", 0.0, 512, True, ""),
 "BWM3": lambda c: c().go(conn, ask, board, m1, {"text":"lib=TECH-SYMBOLIC"}, "none", 0.0, 512, True, ""),
 "BWM4": lambda c: c().go(conn, ask, board, m1, {"text":"程=X"}, "none", 0.0, 512, True, ""),
}
for k, f in calls.items():
    print("%s %d %d" % (k, len(M[k].RETURN_TYPES), len(f(M[k]))))
`;
  const r = spawnSync("python3", ["-c", py], { encoding: "utf8", cwd: ROOT });
  assert.equal(r.status, 0,
    "四站的节点跑不起来(dry,不调模型):\n" + (r.stderr || "").trim().slice(-900));
  const rows = r.stdout.trim().split("\n").filter(Boolean);
  assert.equal(rows.length, 4, `只跑起来 ${rows.length} 站 —— 这条在空转`);
  for (const row of rows) {
    const [name, want, got] = row.split(" ");
    assert.equal(got, want,
      `${name} 声明了 ${want} 个输出,go 实际返回 ${got} 个。\n`
      + "  → 在 ComfyUI 里这一站一跑就 ValueError,而只查 RETURN_NAMES 的断言是绿的。");
  }
}

console.log(`ok   comfy-feed — 四站共 ${totalSlots} 个槽拆开且拼得回去,`
  + `其中 ${sawAmbiguous} 个边界定不下来、已标出,四站都有「喂料」输出`);
