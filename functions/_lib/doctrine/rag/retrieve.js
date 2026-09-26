/* 两级 RAG 的检索。`query_36_rags.py` 的移植,带着那几个已经查实的修正。
   ────────────────────────────────────────────────────────────────────────
   两级:
     ① 选库 —— 盘面 feature + 问题领域 撞 11 个库 → library_id[]
     ② 选卡 —— **只在选中的库的子卡里**比。父库没选中,子卡根本不在候选池里,
        这一条就是两级真正收窄的地方,不是修辞。

   移植时修掉的(每一条都在那个 zip 上实测过):

   ⚠️ ① **检索词不能只有原问题。** CLASS 卡的 use_when 是中文短语(「第三方感情」
        「关系稳定性」),而 feature 名是英文、会原样进 query —— 于是 TECH 卡稳赢、
        CLASS 卡稳输。实测第三方感情那个用例,讲第三方感情的那张卡排第 7(0.292);
        把 M1 的结构化输出(领域 + 意图)一并当检索词后,同一张卡排第 1。
        所以 `intent` 是一个独立入参,不是可选的装饰。

   ⚠️ ② **`base_weight` 原脚本一次都没读。** 26 张卡权重实际分布 1–5,而排序纯靠
        n-gram 相似度(实测 5.394/5.113/4.831,12% 以内,基本是噪声)。
        现在计入,但**门控在「真的命中 use_when」上** —— 无条件加的话,一张权重 5
        的卡什么都没命中也会浮到顶上,而 n-gram 常常只有 ~1.0,权重会直接压过它。

   ⚠️ ③ 三个分数**不同量纲**(feature +4 / use_when +3 / weight 1–5 / 相似度 0–10
        但实际常在 0–1.5),混在一个 score 里加。这一条**没改** —— 要改得先定
        「一次 feature 命中值几分」,那是 owner 的判断,不是我的。分数照发,
        并且把每一项的来源写进 `why`,好让人看出是谁把它顶上去的。
*/
import { RAG } from "./data.js";

/* ── M1 的 `db` 枚举 → 库自己的 `domains` 词 ─────────────────────────────
   ⚠️⚠️ **这不是 `domains` 的拷贝,是两套词表之间的对照。**
      `domains`(感情/婚姻/恋爱/经营/财运)是那批原始 RAG 自己的说法,
      `data.js` 的头注写着它是逐字抽出来、一个字没改写的;
      `db`(婚恋/求财/考试…)是 `prompts.js:31` 里 M1 的枚举,是我们定的。
      两边的词本来就对不上,而这份对照在今天的仓库里**哪儿都没有**。

   ⚠️ 没有这个对照会怎样(实测):选库是**子串包含**,于是九个 db 取值里
      **只有「考试」**字面命中它的库。`db=婚恋` 打不开感情库、`db=求财` 打不开
      生意库 —— 真实问题只能救回一部分,8 个案例里 3 个一个 CLASS 库都没开。
      M1 花了一次模型调用算出来的分类,到这里没能可靠地用上。

   ⚠️ **没有库的那几个也要写出来,写成空数组。** 漏写和「本来就还没有这个库」
      在代码里长得一模一样,而契约要分得出这两种 —— 前者是 bug,后者是待办。 */
export const DB_DOMAINS = {
  考试: ["考试"],
  婚恋: ["感情", "婚姻"],
  求财: ["经营", "财运"],
  疾病: [],     // 还没有这个事体库
  工作: [],
  官司: [],
  失物: [],
  出行: [],
  其他: []      // 兜底,本来就不该锁定任何事体库
};

/* 归一化:只留字母数字和汉字。和 python 版 `normalize()` 同一条规则。 */
function norm(s) {
  return String(s == null ? "" : s).replace(/[^0-9a-zA-Z㐀-鿿]+/g, "").toLowerCase();
}

/* 2-gram + 3-gram 计数。和 python 版 `grams()` 同一条规则。 */
function grams(s) {
  const v = norm(s), out = new Map();
  for (const size of [2, 3]) {
    for (let i = 0; i + size <= v.length; i++) {
      const g = v.slice(i, i + size);
      out.set(g, (out.get(g) || 0) + 1);
    }
  }
  return out;
}

function similarity(query, content) {
  const L = grams(query), R = grams(content);
  let total = 0, hit = 0;
  for (const [g, n] of L) { total += n; hit += Math.min(n, R.get(g) || 0); }
  return total ? hit / total : 0;
}

/* 库的可检索正文:名字 + 用途 + 它的条件。原脚本比的是 SQLite 里那段 markdown,
   这里比的是同样那几项拼起来的字符串 —— 少了 markdown 的标题符号,分数会略有出入,
   但两级的**选择**由 feature/domain 命中决定,相似度只在同分时做区分。 */
function libText(l) {
  return [l.name, l.purpose, ...(l.features || []), ...(l.domains || []), ...(l.intents || [])].join(" ");
}
function cardText(c) {
  return [c.title, c.rule, c.risk, ...(c.use || []), ...(c.src || []).map((s) => s.q || "")].join(" ");
}

/* ── ① 选库 ───────────────────────────────────────────────────────────── */
export function selectLibraries({ question = "", intent = "", db = "", features = [], limit = 6 } = {}) {
  const have = new Set((features || []).map((f) => String(f).toUpperCase()));
  const text = norm(question + " " + intent);
  /* `db` 是按键取的,不是子串撞的。查不到就是空集合 —— 不回落到模糊匹配,
     那样一个拼错的 db 会看起来像「这卦没有事体库」。 */
  const wantDomain = new Set(DB_DOMAINS[String(db).trim()] || []);
  const rows = RAG.libs.map((l) => {
    let score = similarity(question + " " + intent, libText(l)) * 10;
    const why = [];
    /* ⭐ **必开(hard)和加分(soft)是两件事。**
       《增删卜易》那句「知道动变及卦之六冲…再看何为旬空、月破…即知决断祸福」
       说的是:盘上出现了空破动变,对应的理法就该调,这里没有「挑一挑」的余地。
       事体库同理 —— 问的是什么,由 M1 的 db 锁定,不该再判一次。
       所以这两类命中把库标成**必开**,它们不受 `limit` 削。
       剩下的相似度只负责在软的那一截里排序。 */
    let hard = false;
    for (const f of l.features || []) {
      if (have.has(String(f).toUpperCase())) { hard = true; score += 4; why.push("feature:" + f); }
    }
    for (const w of l.domains || []) {
      if (wantDomain.has(w)) { hard = true; score += 4; why.push("db:" + db + "→" + w); }
    }
    /* 意图词仍按文本撞:「什么时候」「应期」这类是他打的字,不是枚举。 */
    for (const w of [...(l.domains || []), ...(l.intents || [])]) {
      if (norm(w) && text.includes(norm(w))) { score += 4; why.push("text:" + w); }
    }
    return { id: l.id, name: l.name, children: l.children || [],
             score: +score.toFixed(4), hard: hard, why: [...new Set(why)] };
  });
  rows.sort((a, b) => (b.score - a.score) || a.id.localeCompare(b.id));
  /* ⚠️ **必开的不进 limit。** 实测:11 个库里最多 6 个得分 > 0,而 limit 正好是 6 ——
     今天不削,是因为它恰好卡在天花板上。db 路由一修,CLASS 库开始得分,
     第 7 个就出来了,那时候 limit 会开始削掉盘面**确实成立**的理法库,
     而少了一个库,M3 再也看不到那个库的卡,照样交得出材料。 */
  const hard = rows.filter((r) => r.hard);
  const soft = rows.filter((r) => !r.hard && r.score > 0);
  return hard.concat(soft).slice(0, Math.max(limit, hard.length));
}

/* ── ② 选卡 —— 只在选中的库的子卡里 ──────────────────────────────────── */
export function selectCards({ question = "", intent = "", features = [], libraries = [], limit = 8 } = {}) {
  const open = new Set();
  for (const l of libraries) for (const c of l.children || []) open.add(c);
  /* ⚠️ intent 在这里是承重的,见文件头 ①。 */
  const query = [question, intent, (features || []).join(" ")].join(" ");
  const q = norm(query);

  const rows = RAG.cards.filter((c) => open.has(c.id)).map((c) => {
    let score = similarity(query, cardText(c)) * 10;
    const why = [];
    let hits = 0;
    for (const u of c.use || []) {
      if (norm(u) && q.includes(norm(u))) { score += 3; hits++; why.push("use:" + u); }
    }
    if (hits) { score += Number(c.w || 0); why.push("weight:" + c.w); }
    return {
      id: c.id, lib: c.lib, title: c.title, kind: c.kind,
      rule: c.rule, risk: c.risk, src: c.src || [], doctrineId: c.doctrineId || null,
      weight: c.w, score: +score.toFixed(4), why
    };
  });
  rows.sort((a, b) => (b.score - a.score) || a.id.localeCompare(b.id));
  return rows.slice(0, limit);
}

/* 一次走完两级。M2 拿 libraries,M3 拿 cards。 */
export function retrieve(opts = {}) {
  const libraries = selectLibraries(opts);
  const cards = selectCards({ ...opts, libraries });
  return { libraries, cards };
}

/* 发给模型的文本。⚠️ 只发原文和它的出处 —— 分数、权重、命中理由都是程序侧的东西,
   模型看见分数就会开始引用分数,而读解读的人不知道 9.271 是什么。 */
export function librariesForModel(libraries) {
  return RAG.libs
    .map((l) => {
      const cond = [
        (l.features || []).length ? "盘上:" + l.features.join(" ") : "",
        (l.domains || []).length ? "领域:" + l.domains.join(" ") : "",
        (l.intents || []).length ? "他在问:" + l.intents.join(" ") : ""
      ].filter(Boolean).join(" · ");
      return `[${l.id}] ${l.name} —— ${l.purpose}\n  该选它的条件:${cond || "无"}`;
    })
    .join("\n\n");
}

export function cardsForModel(cards) {
  return cards
    .map((c) => {
      const src = (c.src || [])
        .map((s) => `    出处 ${s.v} ${s.t}\n    「${s.q}」`)
        .join("\n");
      return `[${c.id}] ${c.title}\n  ${c.rule}`
        + (c.risk ? `\n  风险:${c.risk}` : "")
        + (src ? `\n${src}` : "");
    })
    .join("\n\n");
}
