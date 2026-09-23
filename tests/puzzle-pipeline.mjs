/* 契约:解谜管线里程序出题的那一步(functions/_lib/puzzle/)。
   ────────────────────────────────────────────────────────────────────────
   ⚠️ 实验中,还没接上线。钉的是 owner 已经定下来的几件事,不是提示词措辞:

   ① **每条成立的判据正好变成一条线索。** 「每个模型专门解决一个判据」—— 少一条不报错,
      解谜的人照样拼得出一篇,只是少了一块。在打架里整条输掉的,不单独成线索,
      但必须在「打架」里带着(记冲突)。
   ② **三合、三会成局不当线索断吉凶,进「验现事」。** 裁决梯模块一律判吉;可合的是忌神的五行时,
      坚牢的是伤它的那一方,而这一条仓库里没有原文。owner 定的做法:拿它对他现在的处境,
      单独一个模型对照,**说「对上」必须抄得出他的原话**,抄不出按他没说算。
   ③ **候选只许来自补全包的象义表**,而且程序核模型交回来的候选在不在名单上。
   ④ **事实只落到它所属的那一问。** 「我在投简历」落进感情那一问,会变成「帮着伤她的那一方」。
   ⑤ **用神不上卦时字典里仍然有它**,而且说得出它伏在哪一爻下、压在它上面的是什么。
   ⑥ **应期只在问了时间时进线索**(CLAUDE.md §6:没问时间的人不塞应期)。
*/
import assert from "node:assert/strict";
import { spreadDate } from "../tools/lab/board.mjs";
import { puzzlesFor } from "../tools/lab/puzzle.mjs";
import { loadSymbols } from "../functions/_lib/doctrine/criteria-rules.mjs";
import { readClueAnswer, readVerifyAnswer, flatCandidates } from "../functions/_lib/puzzle/program.js";
import { fillClue, fillVerify, fillSolve, fillM1, parseM1P } from "../functions/_lib/puzzle/prompts.js";
import { puzzleText } from "../functions/_lib/puzzle/program.js";

const M1 = `lang=Chinese
q1=我和她还有可能复合吗 | db=婚恋 | kind=能不能
q2=今年能换到更好的工作吗 | db=工作 | kind=什么时候
hurt=0
flags=无
facts=我们分手半年了[无|q1];我最近在投简历[父母|q2]`;

const symbols = loadSymbols();
const N = 120;
let clues = 0, lostWhole = 0, shapes = 0, hidden = 0, timingIn = 0, candChecked = 0, gatedIn = 0;

for (let s = 1; s <= N; s++) {
  const { parsed, puzzles } = puzzlesFor({ seed: s, gender: "m", date: spreadDate(s), m1: M1 });
  assert.equal(puzzles.length, 2, "两问应当出两道题");

  for (const { m, p } of puzzles) {
    const ids = p.线索.map((c) => c.编号);
    assert.equal(new Set(ids).size, ids.length, `第 ${s} 副盘有重复的线索编号`);
    assert.ok(ids.every((x) => x.startsWith("q" + p.问.n + ".")), "线索编号要带问号,两问的线索放进同一批并联时才分得开");

    /* ① 判据 → 线索 */
    for (const v of m.criteria.filter((x) => x.成立 === true)) {
      const lost = new Set((v.被裁 || []).map((x) => x.爻));
      const alive = v.爻.filter((n) => !lost.has(n));
      const mine = p.线索.filter((c) => c.类 === "判据" && c.id === v.id);
      if (v.爻.length && !alive.length) {
        lostWhole++;
        assert.equal(mine.length, 0, `${v.id} 在所有爻上都输了,却还单独成了线索`);
        assert.ok(p.打架.some((f) => f.败者.includes(v.id)), `${v.id} 输了却不在「打架」里 —— 冲突要记下来`);
      } else {
        clues++;
        assert.equal(mine.length, 1, `${v.id} 成立,却有 ${mine.length} 条线索(应正好 1 条)`);
        assert.deepEqual(mine[0].爻, alive, `${v.id} 的线索爻号应是没输掉的那几爻`);
      }
    }
    /* 裁决梯走过的每一步都成线索 */
    for (const layer of [m.ladderObj.primary, m.ladderObj.second].filter(Boolean)) {
      for (const st of layer.steps.filter((x) => x.fired)) {
        assert.ok(p.线索.some((c) => c.类 === "裁决梯" && c.id.startsWith("SOP-4." + st.step)),
          `裁决梯第 ${st.step} 步开了,却没有线索`);
      }
      if (layer === m.ladderObj.primary && layer.decisive) {
        assert.ok(p.定死的 && p.定死的.吉凶 === layer.tone, "裁决梯定了案,题面上却没有「定死的」");
      }
    }

    /* ② 三合、三会不进线索,进验现事,而且说得出合的是哪一方的五行 */
    assert.ok(!p.线索.some((x) => /三[合会]/.test(x.id)), "三合/三会又进了线索 —— 它没有原文定方向,只拿去验现事");
    const localShapes = ((m.ladderObj && m.ladderObj.shape) || []).filter((x) => /^三[合会]/.test(x.tag));
    assert.equal((p.验现事 || []).length, localShapes.length, "盘上的三合/三会局没有一个不落地地进验现事");
    for (const c of p.验现事 || []) {
      shapes++;
      assert.ok(/在这一问里是/.test(c.盘上), `${c.编号} 没说合的是哪一方的五行`);
      assert.ok(/^q\d+\.验\d+$/.test(c.编号), `验现事编号「${c.编号}」不带问号 —— 两问的放进同一批就分不开`);
      assert.ok(!/\{\{[a-zA-Z]+\}\}/.test(fillVerify(c, "问题")), `${c.编号} 的验现事提示词里还有没填的槽`);
    }

    /* ③ 候选只来自补全包 */
    for (const c of p.线索.filter((x) => x.候选)) {
      const six = (p.谁是谁.roles.find((e) => c.谁.includes(e.角色 + "·" + e.六亲)) || {}).六亲;
      assert.ok(six, `${c.编号} 带了候选,却找不到是哪一方的`);
      assert.deepEqual(flatCandidates(c.候选), flatCandidates(Object.entries(symbols.liuqin[six].cats).map(([类, 项]) => ({ 类, 项 }))),
        `${c.编号} 的候选和补全包里${six}的名单不一致`);
      candChecked++;
    }

    /* ④ 事实只落到它那一问 */
    const facts = p.现实依据.map((f) => f.事实);
    if (p.问.n === 1) assert.ok(!facts.includes("我最近在投简历"), "只属于第 2 问的事实落进了第 1 问");
    if (p.问.n === 2) assert.ok(!facts.includes("我们分手半年了"), "只属于第 1 问的事实落进了第 2 问");

    /* ⑤ 用神伏藏 */
    if (m.ladderObj.hiddenYong) {
      hidden++;
      const yong = p.谁是谁.roles.find((e) => e.角色 === "用神");
      assert.ok(yong && yong.伏 && yong.伏.爻, "用神伏藏,字典里却没有它,或说不出它伏在哪一爻下");
      const c = p.线索.find((x) => x.类 === "伏神");
      assert.ok(c && /压在它上面的是第\d爻/.test(c.盘上), "伏神那条线索没说压在它上面的是谁");
    }
    assert.ok(/^(父母|兄弟|子孙|妻财|官鬼|世爻|\?)$/.test(p.摆桌子.用神),
      `盘面表的用神写成了「${p.摆桌子.用神}」—— 那是程序内部的名字,不是六亲`);

    /* 读法卡按 requires 给:没替人占就没有「替无关第三方起卦时……」那张;用神没伏藏就没有「伏藏」那张 */
    const readers = p.读法卡.map((c) => c.id);
    assert.ok(!readers.includes("JM-REL-001"), "他没替人占,材料里却有「第三方感情占先定位双方角色」那张卡");
    const yongHidden = !!(p.谁是谁.roles.find((e) => e.角色 === "用神") || {}).伏;
    assert.equal(readers.includes("JM-REL-003"), p.问.db === "婚恋" && yongHidden,
      "「伏藏提示关系不显」那张卡给错了:它只该在婚恋这一问、用神伏藏的时候出现");
    if (readers.includes("JM-REL-003")) gatedIn++;

    /* ⑥ 应期只在问了时间时进 */
    const t = p.线索.filter((c) => c.类 === "应期").length;
    if (p.问.kind !== "什么时候") assert.equal(t, 0, "没问时间,线索里却有应期");
    else timingIn += t;

    /* 填出来的提示词不许留空槽 */
    for (const c of p.线索) {
      const txt = fillClue(c, p.问);
      assert.ok(!/\{\{[a-zA-Z]+\}\}/.test(txt), `${c.编号} 的线索提示词里还有没填的槽`);
    }
  }
  if (s === 1) {
    const solve = fillSolve({ question: "q", lang: parsed.lang, hurt: parsed.hurt,
                              puzzlesText: puzzles.map(({ p }) => puzzleText(p, {})).join("\n\n") });
    assert.ok(!/\{\{[a-zA-Z]+\}\}/.test(solve), "解谜提示词里还有没填的槽");
    /* 页面靠 {词|符号} 画按钮;解谜那一段必须带着这个格式,和四节点的 M4 用同一段 */
    assert.ok(/\{实际的词\|符号\}/.test(solve), "解谜提示词里没有取象标记的格式 —— 页面上每一个可点的东西都会黑掉");
    assert.ok(!/\{\{[a-zA-Z]+\}\}/.test(fillM1(symbols)), "M1 提示词里还有没填的槽");
  }
}

/* ③ 程序核候选:名单外的词要被拦下 */
{
  const clue = { 候选: [{ 类: "人", 项: ["朋友", "竞争者"] }] };
  const ok = readClueAnswer(clue, "这一卦里=一句\n候选=朋友|竞争者");
  assert.deepEqual(ok.problems, []);
  const bad = readClueAnswer(clue, "这一卦里=一句\n候选=朋友|情敌");
  assert.ok(bad.problems.some((x) => /不在名单上/.test(x)), "名单外的候选没被拦下");
  const none = readClueAnswer({ 候选: null }, "这一卦里=一句\n候选=朋友");
  assert.ok(none.problems.length, "已经指认的一方又写了候选,没被拦下");
}

/* ② 验现事:说「对上」必须抄得出他的原话 */
{
  const words = "我和她分手半年了,最近她身边的朋友都在劝她回来";
  const ok = readVerifyAnswer({}, "对照=对上\n他的原话=最近她身边的朋友都在劝她回来", words);
  assert.equal(ok.对照, "对上");
  const made = readVerifyAnswer({}, "对照=对上\n他的原话=她的家人都支持我们", words);
  assert.equal(made.对照, "他没说", "抄了一句他没说过的话,仍然算「对上」—— 验现事变成了编");
  assert.ok(made.problems.length, "编出来的原话没报问题");
  const none = readVerifyAnswer({}, "对照=他没说\n他的原话=无", words);
  assert.equal(none.对照, "他没说");
  const junk = readVerifyAnswer({}, "我觉得对得上", words);
  assert.equal(junk.对照, "他没说", "没按格式答,不许当成对上");
}

/* M1 的事实归属解析 */
{
  const p = parseM1P(M1);
  assert.deepEqual(p.facts.map((f) => [f.text, f.tag, f.q]), [["我们分手半年了", "无", 1], ["我最近在投简历", "父母", 2]]);
  assert.deepEqual(p.questions.map((q) => [q.n, q.db, q.kind]), [[1, "婚恋", "能不能"], [2, "工作", "什么时候"]]);
}

assert.ok(clues > N, `只核到 ${clues} 条判据线索 —— 这条在空转`);
assert.ok(lostWhole > 0, "没有一条判据在打架里整条输掉 —— 「输掉的不单独成线索」没测到");
assert.ok(shapes > 0 && hidden > 0 && timingIn > 0 && candChecked > 0 && gatedIn > 0,
  `三合 ${shapes} · 伏藏 ${hidden} · 应期 ${timingIn} · 候选 ${candChecked} · 伏藏卡 ${gatedIn} —— 有一种没撞上,那一条就是空转`);

console.log(`ok   puzzle-pipeline — ${N} 副盘 × 两问:判据线索 ${clues} 条一条不少,整条输掉的 ${lostWhole} 条都记在打架里,`
  + `三合/三会 ${shapes} 处全进验现事,用神伏藏 ${hidden} 次都说得出压在上面的是谁,候选全出自补全包`);
