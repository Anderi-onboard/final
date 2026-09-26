/* 解谜管线的三段提示词 · 服务端 only
   ────────────────────────────────────────────────────────────────────────
   ⚠️ 实验中,还没接上线(见 program.js 头注)。

   四种模型,各做一两步:
     M1      读问题:拆成几问、每问的领域和类型、他说的事实各属哪个六亲
     线索    只写一句:这一条判据在他这件事里是什么(每条一个,并联)
     验现事  只做对照:盘上说「现在」的那一处,他自己的话里有没有(每处一个,并联)
     解谜    拼起来、补细节、斟酌文字、用他的语言写出来

   写法和 `nodes/prompts.js` 同一条:提示词只写「这一站做什么」和「不许做什么」,
   断法、象义、候选名单全部走数据,由程序填进 {{}}。
   取象标记和验收线**不另写一份**,直接用 `nodes/` 那两段 —— 页面靠标记画按钮,
   两份标记规矩一旦分叉,就是一篇照样出来、按钮全黑的解读。
*/
import { MARK } from "../nodes/prompts.js";
import { VOICE } from "../nodes/fill.js";

export const M1P = `你只读问题,不解读,不评论,不安慰。只输出下面这几行,不要别的。

lang=<他打字用的语言,英文名,如 Chinese / Spanish>
q1=<他最想知道的那一件,一句话,尽量用他自己的词> | db=<考试|婚恋|求财|疾病|工作|官司|失物|出行|其他> | kind=<能不能|什么时候|什么样|为什么>
q2=<第二件;只问了一件就不写这一行> | db=<…> | kind=<…>
hurt=<0 或 1>
flags=<替人占、多个人、指定对象 里他的话真说了的,顿号隔开;没有写 无>
facts=<他自己说出来的既成事实,原样抄,每条后面方括号标一个六亲>;<…>

问了几件就写几行,一件一行。q1 永远是他最想知道的那一件。

kind:问成不成、好不好、有没有戏 → 能不能;问什么时候、多久 → 什么时候;
问是什么样的人、什么样的事 → 什么样;问为什么、怎么回事 → 为什么。

hurt 只看他自己说没说。他把难堪、害怕、丢脸、被甩下写出来了,才是 1。
语气重、问得急,都不算。不要替他猜 —— 猜出来的伤是你装进去的。

facts 的方括号标这件事本身属于哪个六亲,不是字面上像哪个词。名单只有这些:
{{liuqin}}
哪个都不属于的标 [无]。不许推测,不许改写。他没说事实,写 facts=无。
问了不止一件时,只和其中一问有关的事实,方括号里再加 |q几;几问都有关的不加。
例:facts=我们分开过[无|q1];我在投简历[父母|q2]`;


export const CLUE = `你只写一句话:下面这条判据,在他这件事里是什么意思。

他问的:{{ask}}
这条判据:{{book}}
盘上:{{board}}
说的是:{{who}}
程序标的方向:{{dir}}
{{cand}}
只写一句,说清谁对谁做了什么,用他生活里的话,不用爻位、五行、六亲这些词。
方向照程序标的写,不许改;程序没标的,你也不说好坏。
不许加这条判据以外的判断。

输出:
这一卦里=<一句>{{candFmt}}`;

/* 「还没指认」时才加的那一段。候选从补全包象义表来,程序会核你写的在不在名单上。 */
export const CLUE_CAND = `这一方在他生活里是什么,他没说,盘也定不了。名单:{{list}}
从名单里挑两三个和他这件事有关的,写成「可能是……也可能是……」。
名单里如果有最难说的那一个,不许漏。不许写名单外的词。`;


/* 验现事:只对照,不解读。「对上」「对不上」必须抄他的原话 —— 程序拿他打的原文逐字核,
   抄不出来的按他没说算(`program.js` 的 readVerifyAnswer)。 */
export const VERIFY = `你只做一件事:对照。盘上有一处说的是他「现在」的局面,看他自己的话里有没有说到它。

盘上:{{board}}
说的是:{{who}}
{{cand}}
他的原话:{{words}}

只看他的原话,不猜,不补,不解释。
他的话里明明白白说到了这件事,或者说的就是同一件事:对上。
他的话里说到的正好相反:对不上。
没说到,或者说得含糊:他没说。
写对上或对不上时,把他的那一句原样抄下来,一个字都不改。

输出:
对照=<对上|对不上|他没说>
他的原话=<原样抄;他没说写 无>`;

export const VERIFY_CAND = `这一方在他生活里可能是:{{list}}`;


export const SOLVE = `你在解一道谜。线索都摆在下面,每条都已经有人翻成了他生活里的话。你做四件事:

一、拼:哪些线索撑着结论,打架的听哪边。定死的不许翻;没定死的,你拼出来的方向
    要落在具体哪几条线索上(写进句子里,不写编号)。
二、补细节:只许从线索、他说的事实、细节素材里取。超出这三处的,一律带「可能」。
三、斟酌文字。
四、用 {{lang}} 写给他。上面是中文材料,你重新说一遍,不是翻译。

他问的:{{question}}
hurt={{hurt}}

{{puzzles}}

写法:
- 问了几件就答几件,第一问在前。每一问先给结论,不要一句一句往回收。
- 一个象对应好几种现实、他又没说是哪种时,写成「可能是……也可能是……」,两到三种,
  只从线索和细节素材给的候选里挑,最难说的那个不许漏。
- 不出现爻位、五行、六亲、任何术语。
- 他没问时间,不给应期。
- hurt=0 时不安慰他没说过的伤。hurt=1 时先认账,再拆掉放大它的东西,再把力气交还给他。
- 他给的前提(盘上没有对应的那几条)接住,在它下面说,并且说一句你在这么做。
- 不写你自己怎么读的,不叫他去对照、去数。
- 验现事只提一句,只提最强的那一条:对上的先于对不上的,对不上的先于他没说的。
  对上:说清那是他自己说过的事,盘上这一处和它是一回事;不许说成是盘自己看出来的。
  他没说:说成一句具体的、他一看就知道对不对的话,带「大概」。
  对不上:不当事实说;靠这一处撑着的那几句,把握降一档。
  材料里没有验现事,就不提。

{{mark}}

{{voice}}`;


/* ── 填槽 ─────────────────────────────────────────────────────────────── */
/* ⚠️ 替换一律传函数,不传字符串:字符串替换会把内容里的 `$&` `$1` 当成模式展开。 */
export function fillM1(symbols) {
  const list = Object.entries(symbols.liuqin).map(([name, card]) =>
    "  " + name + ":" + Object.values(card.cats).map((xs) => xs.join("、")).join(";")).join("\n");
  return M1P.replace("{{liuqin}}", () => list);
}

export function fillClue(clue, q) {
  const list = (clue.候选 || []).map((c) => c.类 + "·" + c.项.join("、")).join(";");
  return CLUE
    .replace("{{ask}}", () => q.ask)
    .replace("{{book}}", () => clue.书上)
    .replace("{{board}}", () => clue.盘上 || "(无)")
    .replace("{{who}}", () => clue.谁)
    .replace("{{dir}}", () => clue.指向 ? clue.指向.向 + "(" + clue.指向.因 + ")" : "不标")
    .replace("{{cand}}", () => clue.候选 ? CLUE_CAND.replace("{{list}}", () => list) + "\n" : "")
    .replace("{{candFmt}}", () => clue.候选 ? "\n候选=<你挑的,竖线隔开>" : "");
}

export function fillVerify(item, words) {
  const list = (item.候选 || []).map((c) => c.类 + "·" + c.项.join("、")).join(";");
  return VERIFY
    .replace("{{board}}", () => item.盘上)
    .replace("{{who}}", () => item.谁)
    .replace("{{cand}}", () => (item.候选 ? VERIFY_CAND.replace("{{list}}", () => list) + "\n" : ""))
    .replace("{{words}}", () => String(words || "").trim() || "(他没写别的)");
}

export function fillSolve({ question, lang, hurt, puzzlesText }) {
  return SOLVE
    .replace(/\{\{lang\}\}/g, () => lang || "Chinese")
    .replace("{{question}}", () => question)
    .replace("{{hurt}}", () => hurt || "0")
    .replace("{{puzzles}}", () => puzzlesText)
    .replace("{{mark}}", () => MARK)
    .replace("{{voice}}", () => VOICE);
}

/* M1 那几行 → 结构。和 nodes/fill.js 的 parseM1 一样宽松:缺一项留空,由下游决定缺不缺得起。 */
export function parseM1P(text) {
  const out = { lang: "", hurt: "0", flags: "", facts: [], questions: [] };
  for (const raw of String(text || "").split(/\r?\n/)) {
    const line = raw.trim();
    let m = line.match(/^q(\d+)\s*[=:]\s*(.*)$/i);
    if (m) {
      const parts = m[2].split("|").map((s) => s.trim());
      const q = { n: Number(m[1]), ask: parts[0], db: "", kind: "" };
      parts.slice(1).forEach((p) => {
        const kv = p.match(/^(db|kind)\s*[=:]\s*(.*)$/i);
        if (kv) q[kv[1].toLowerCase()] = kv[2].trim();
      });
      out.questions.push(q);
      continue;
    }
    m = line.match(/^(lang|hurt|flags|facts)\s*[=:]\s*(.*)$/i);
    if (!m) continue;
    const k = m[1].toLowerCase(), v = m[2].trim();
    if (k === "facts") {
      if (v && v !== "无") {
        out.facts = v.split(/[;\uFF1B]/).map((s) => s.trim()).filter(Boolean).map((s) => {
          const t = s.match(/^(.*?)\s*[\[【]([^\]】]+)[\]】]\s*$/);
          if (!t) return { text: s, tag: "", q: null };
          const [tag, which] = t[2].split(/[|｜]/).map((x) => x.trim());
          const n = which ? Number(String(which).replace(/^q/i, "")) : null;
          return { text: t[1].trim(), tag, q: n || null };
        });
      }
    } else out[k] = v;
  }
  out.questions.sort((a, b) => a.n - b.n);
  return out;
}
