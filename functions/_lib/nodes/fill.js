/* 四个节点的槽填充。服务端 only。
   ────────────────────────────────────────────────────────────────────────
   `prompts.js` 是提示词,这里是把 {{槽}} 换成真东西。分成两个文件是因为它们
   **改的理由不一样**:提示词改的是「这一站做什么」,填充改的是「材料从哪来」。

   ⚠️ 一条硬规矩:**槽里只放原文和程序算出来的事实,不放分数**。
      检索分数(9.271、weight=4)是程序侧的东西 —— 模型看见分数就会开始引用分数,
      而读解读的人不知道 9.271 是什么。分数留在日志里,不进提示词。

   ⚠️ 第二条:**M1 的提示词里不出现任何 feature id**。M1 写中文 flags,
      翻成 id 在 `liuyao-features.js` 里做,一处。id 是程序侧的地址。
*/
import { M1, M2, M3, M4, MARK } from "./prompts.js";
import { retrieve, selectCards, librariesForModel, cardsForModel } from "../doctrine/rag/retrieve.js";

const s = (v, max) => String(v == null ? "" : v).slice(0, max || 4000);

/* M1 那四到五行 → 结构。解析宽松:小模型偶尔多一个空格、少一个等号,
   为此整站退回兜底不值得 —— 拿不到的那一项留空,由下游决定它缺不缺得起。 */
export function parseM1(text) {
  const out = { lang: "", db: "", ask: "", hurt: "0", more: "", flags: "" };
  for (const line of String(text || "").split(/\r?\n/)) {
    const m = line.match(/^\s*(lang|db|ask|hurt|more|flags)\s*[=:]\s*(.*)$/i);
    if (m) out[m[1].toLowerCase()] = m[2].trim();
  }
  return out;
}

/* M1 的领域和意图就是 M3 检索 CLASS 卡的钥匙 —— 见 retrieve.js 头注 ①。
   拿原问题去撞,中文短语的 use_when 永远命中不了。 */
function intentOf(m1) {
  return [m1.db, m1.ask, m1.more, m1.flags].filter(Boolean).join(" ");
}

export function buildNode(node, body) {
  const m1 = parseM1(body.m1 || "");
  const features = Array.isArray(body.features) ? body.features.map(String) : [];
  const question = s(body.question, 2000);

  if (node === "m1") {
    return { system: M1, userOverride: question };
  }

  const hit = retrieve({ question, intent: intentOf(m1), features, limit: 6 });

  if (node === "m2") {
    return {
      system: M2
        .replace("{{features}}", features.join(" ") || "(无)")
        .replace("{{ask}}", m1.ask || question)
        .replace("{{libraries}}", librariesForModel(hit.libraries)),
      userOverride: "选库。",
      meta: { libraries: hit.libraries.map((l) => ({ id: l.id, score: l.score, why: l.why })) }
    };
  }

  if (node === "m3") {
    /* M2 挑了哪些库,就只开哪些库的卡 —— 两级收窄在这一行。M2 没答就退回
       检索自己排的前几个库,而不是把 29 张卡全开。 */
    const picked = String(body.m2 || "").match(/lib\s*=\s*([A-Z-]+)/g) || [];
    const ids = picked.map((x) => x.replace(/^lib\s*=\s*/, ""));
    const libs = ids.length ? hit.libraries.filter((l) => ids.includes(l.id)) : hit.libraries;
    /* ⚠️ **先收窄再取前 N,不能反过来。** 第一版是「全局取前 6,再筛掉不属于
       M2 选中的库的」—— 于是 M2 挑了两个库,而全局前 6 被别的库的卡占满,
       交集只剩 1 张。实测就是这样:开的卡 = JM-VB-001,一张。
       两级收窄的意思就是**第二级只在第一级开的那几个库里排序**,
       不是在全体里排完再过滤。而且它不报错 —— M3 照样有卡可读,只是少了五张。 */
    const open = selectCards({
      question, intent: intentOf(m1), features, libraries: libs, limit: 6
    });
    return {
      system: M3
        .replace("{{cards}}", cardsForModel(open))
        /* ⚠️ 盘只发给 M3,不发给 M4。M4 拿的是 M3 的 `程=` 那一层 ——
           两站都发就是**两个真相源**,而谁赢由模型当时的心情决定。
           CLAUDE.md §7.5 那条「两张名单」已经付过三次学费。 */
        .replace("{{board}}", s(body.board, 12000) || "(盘未算出)")
        .replace("{{ladder}}", s(body.ladder, 6000) || "(裁决梯未运行)")
        .replace("{{relations}}", s(body.relations, 6000) || "(关系未算)")
        .replace("{{ask}}", m1.ask || question),
      userOverride: "取证。",
      meta: { cards: open.map((c) => ({ id: c.id, score: c.score, why: c.why })) }
    };
  }

  if (node === "m4") {
    return {
      system: M4
        .replace("{{question}}", question)
        .replace(/\{\{lang\}\}/g, m1.lang || "Chinese")
        .replace("{{hurt}}", m1.hurt || "0")
        .replace("{{ladder}}", s(body.ladder, 6000) || "(裁决梯未运行)")
        .replace("{{evidence}}", s(body.m3, 8000) || "(上一站没交材料)")
        .replace("{{relations}}", s(body.relations, 6000) || "(关系未算)")
        .replace("{{mark}}", MARK)
        .replace("{{voice}}", VOICE),
      userOverride: "讲给他听。"
    };
  }
  return null;
}

/* ⚠️ 这一段从老提示词那 14,861 字符的 `voice` 里挑出来,272 tok。
   留下的是**一条验收线加四个对照** —— `prompts.js` 头注自己写着「十行规矩不如
   一个靶子」,当时只用在 M2 的「路」上;voice 照同一条办。 */
export const VOICE = `验收线只有一条:**任何一句承重的话剪下来,不看上文,他知道你在说什么吗?**

✗ 动的是她,静的是你          ✓ 张罗你们俩这些事的,一直是她
✗ 劲从地基上来                ✓ 你们过得下去,靠的是把日子过好,不是靠还剩多少新鲜感
✗ 她的在意从嘴上来            ✓ 她关心你的样子,就是唠叨你
✗ 麻烦的是它坏起来不好发现     ✓ 麻烦的是,关系坏了你不容易发现

合格的那句永远更短、词都是本来的意思、说的是谁做了什么。

四个位置各站一个真东西:动词是真动作、名词是已经说出口的那个东西、
主语是真在动的那个、句子要落地(说出下文,不停在标签上)。
别背例子,背这一问:**具体是什么动作、谁在做、然后呢?**`;
