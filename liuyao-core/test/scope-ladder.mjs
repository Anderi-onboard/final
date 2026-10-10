/**
 * SCOPE CONTRACT — a ladder question is answered one level per casting
 *
 * 增删卜易 (求名章 L9916; 功名到何品级章 L11010): each level of a ladder is asked
 * with its own casting. The program detects such questions from the question
 * text, tells the model the rule, and writes the next steps itself: a new casting
 * for the next level, or a follow-up on this casting for the same level.
 * Run: node test/scope-ladder.mjs
 */
import assert from 'node:assert/strict';
import { detectLadder, buildNextStep, NOTICE_LADDER } from '../src/pipeline/scope.js';
import { runStage } from '../comfy/bridge.mjs';
import { createDemoLLM } from '../src/pipeline/llm.js';

// 1. Detection: a ladder question is flagged; an ordinary one is not.
{
  const comp = detectLadder('北京物流设计大赛能打到哪个地步（已过校赛）');
  assert.equal(comp.ladder, true);
  assert.equal(comp.levelNow, '校赛', 'the level already passed is read from the question');
  assert.equal(comp.levelNext, null, 'the next level is not known to the program: it must be asked');
  assert.ok(comp.sources.some((s) => s.line === 'L9916'), 'cites the book line for the rule');

  assert.equal(detectLadder('这个月的求财能不能成').ladder, false);
  assert.equal(detectLadder('我和他能不能走到最后').ladder, false, 'no ladder word: not flagged');
  assert.equal(detectLadder('能否晋级').ladder, true);
  assert.equal(detectLadder('能否进决赛').ladder, true);
}

// 2. The next step is written by the program, and says what each path is.
{
  const ns = buildNextStep(detectLadder('北京物流设计大赛能打到哪个地步（已过校赛）'));
  const text = ns.lines.join('\n');
  assert.equal(ns.needsLevelName, true, 'without a known next level, the reading asks for its name');
  assert.match(text, /新起一卦/);
  assert.match(text, /追问，沿用同一卦/);
  assert.match(text, /session\.mjs start/);
  assert.match(text, /session\.mjs follow/);
  assert.equal(buildNextStep(detectLadder('这个月的求财能不能成')), null, 'no next steps for an ordinary question');
}

// 3. The model is told the rule, and the bridge's understand stage carries it.
{
  const out = await runStage('cast', { question: '北京物流设计大赛能打到哪个地步（已过校赛）', throws: '1,2,3,0,3,2', date: '2026-10-08' }, {});
  const u = await runStage('understand', out.state, { mode: 'mock', llm: createDemoLLM() });
  assert.equal(u.state.scope.ladder, true);
  assert.ok(u.state.notices.includes(NOTICE_LADDER), 'the rule is in the notices the synthesis sees');
}

// 4. The final result carries the scope and the next steps, and the display says they came from the program.
{
  let s = (await runStage('cast', { question: '北京物流设计大赛能打到哪个地步（已过校赛）', throws: '1,2,3,0,3,2', date: '2026-10-08' }, {})).state;
  const cfg = { mode: 'mock', llm: createDemoLLM() };
  s = (await runStage('understand', s, cfg)).state;
  s = (await runStage('packet', s, cfg)).state;
  s = (await runStage('retrieve', s, cfg)).state;
  s = (await runStage('claims', s, cfg)).state;
  const synth = await runStage('synth', s, cfg);
  assert.equal(synth.state.result.scope.ladder, true);
  assert.ok(synth.state.result.nextStep.lines.length >= 4);
  assert.match(synth.display, /下一步（程序写的，不由模型生成）/);
}

console.log('scope-ladder: ok — ladder questions flagged from the text, with book lines cited; next steps written by the program (new casting for the next level, follow-up for this one); the model is told the rule; the next level is asked for when unknown');
