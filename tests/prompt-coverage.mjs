/**
 * PROMPT COVERAGE CONTRACT
 *
 * SEGMENTS.voice was rebuilt on ten grammatical principles so that its rules
 * GENERATE rather than enumerate — a writer holding "does this predicate have
 * fillable arguments?" catches 涵养着 without ever having seen it on a list.
 * The rebuild's precondition, set by the owner, was that no functional part of
 * the previous prompt could be dropped in the process.
 *
 * This file is that precondition, executable. Each entry is a rule that was in
 * the prompt before the rebuild, paired with a distinctive fragment of its
 * current wording. The test asserts the rule is still SOMEWHERE in the assembled
 * stack — either in the rewritten voice core, or in whichever segment now owns
 * it outright after de-duplication (inference_traps, clarity_rules,
 * priority_ladder, stance, density, meta_rules, deploy_voice).
 *
 * If you rewrite a rule, update its fragment here. If a rule genuinely dies,
 * delete its entry deliberately — but a failing assertion means a rule was lost
 * by accident, which is what actually happened repeatedly before this test.
 *
 * Run: node tests/prompt-coverage.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../prompt-engine.js', import.meta.url), 'utf8');

const SEGMENTS = Object.fromEntries(
  [...src.matchAll(/SEGMENTS\.([a-z_0-9]+)\s*=\s*`([\s\S]*?)`;/g)].map(m => [m[1], m[2]])
);
assert.ok(Object.keys(SEGMENTS).length > 25, 'segment extraction failed');

// The prompt is hard-wrapped, so a rule's wording is full of incidental
// newlines. Compare with all whitespace removed.
const flat = s => s.replace(/\s+/g, '');
const HAYSTACK = Object.entries(SEGMENTS).map(([name, body]) => [name, flat(body)]);

function owner(fragment) {
  const needle = flat(fragment);
  return HAYSTACK.filter(([, body]) => body.includes(needle)).map(([name]) => name);
}

/** Rules carried by the voice core before the rebuild. */
const VOICE_RULES = [
  ['read once, do not consult while composing', 'do not consult this page while composing'],
  ['write from the view formed in the stance step', 'from the view you formed in the stance step'],
  ['slack is pacing, vary the length', 'slack is pacing'],
  ['the overriding test', 'knows this material, talking'],
  ['① verb slot names a witnessable action', '你被学业托着'],
  ['① this is not a word list', 'holds space for'],
  ['② referring expression needs a referent', '麻烦的是它坏起来不好发现'],
  ['② the claim must refer to THIS casting', 'its referent was never this casting'],
  ['② claims trace to what the backend gave you', 'a line, a spirit, a transform'],
  ['② a hexagram NAME is not evidence', "what a hexagram's NAME evokes"],
  ['② name candidates with the distinguishing condition', 'hardest one included'],
  ['② no 大道理 — a class is not who asked', '要学会'],
  ['③ only an agent may hold the subject slot', '这种稳坏起来不好发现'],
  ['④ a sentence owes a rheme', '动的偏偏是官鬼'],
  ['④ state-words must land', '未到位 in WHAT'],
  ['④ specificity is the check, no verify-instruction', '去查一下'],
  ['④ vary the landings', 'identically-shaped observations'],
  ['⑤ a metaphor asserts what it connotes', '它自己会回来'],
  ['⑤ run the image against the ASKER situation', "hexagram's classical setting"],
  ['⑥ no directive where a declarative belongs', '你自己数数看'],
  ['⑥ never narrate your own process', '按方法这里我读得轻'],
  ['⑥ never narrate the reading construction', '下面我分三层说'],
  ['⑥ a genuine gap is stated about the MATTER', '盘上没有能定这件事的爻'],
  ['⑥ do not perform understanding', '我知道你一定很难受'],
  ['⑥ do not perform restraint', '我不替你说'],
  ['⑥ never nudge the sitting', '改天再来'],
  ['⑦ board indicative, life-guess hedged', '所以你可能还没有自己的房子'],
  ['⑦ hedging everything is not caution', 'iron-mouth'],
  ['⑦ no invented backstory for strangers', '多半是见过另一头的人'],
  ['⑧ the standalone-comprehensibility acceptance line', 'hand it to someone who has read nothing'],
  ['⑧ a verdict may not lean on your own scaffolding', 'an abstraction that only means anything in position'],
  ['⑧ write the thing, not a remark about it', '代价是实的'],
  ['⑧ put a person doing something at a moment', '你接不上话'],
  ['⑧ describe what is there, not what is missing', '缺少关注'],
  ['⑧ an image can counterfeit the basic level', '账单长什么样'],
  ['⑧ plain words', '这种日子里的人'],
  ['⑧ nobody says 这不是我该说的', '这个我说不好'],
  ['⑨ say the spine before writing', 'you have notes, not a reading'],
  ['⑨ being TRUE is not a reason to include', 'Being TRUE is not a reason'],
  ['⑨ two facts landing one point are one point', '日中则昃'],
  ['⑨ an off-spine fact gets one clause', 'Never a section of its own'],
  ['⑨ restatement is groping, not emphasis', '四句「没有高峰」不是四句话'],
  ['⑨ one thing per sentence', 'One thing per sentence'],
  ['⑨ close by consolidating', 'CLOSE BY CONSOLIDATING'],
  ['⑩ two narrations — do not pick the costly one', '你们分开之后,她遇到了新人'],
  ['⑩ take the stated want at face value', '你要的其实不是这件事成'],
  ['⑩ the gap belongs to the matter, not the person', '还需要你去落实'],
  ['⑩ raise a road and you owe it its shape', '有人一辈子要的就是这个'],
  ['⑩ bad news at full size, then stay', 'BAD NEWS AT FULL SIZE'],
  ['⑩ 能用的胜过深刻的', '能用的胜过深刻的'],
  ['⑩ shame beat 1 — 认账不打折', '处理上有些问题'],
  ['⑩ shame beat 2 — the roster, never an assignment', '看见和记住是两件事'],
  ['⑩ shame beat 2 — never assert 没人知道', '没人知道'],
  ['⑩ shame beat 3 — no absolution', '这不是你的错'],
  ['⑩ 自省但不卑微', '精神胜利'],
  ['⑩ never install the wound', '你怕的其实是这件事让你很没面子'],
  ['⑩ 没人在看你 arriving unbidden', '没人在看你'],
  ['register: the anchor line', 'Nothing comes easy'],
  ['register: the plain indicative', '相信你可以的'],
  ['register: a general truth only as a concession', 'never as the payload'],
  ['warmth is not a performance', 'manufacture delight'],
];

/**
 * Clauses lifted out of OTHER segments during de-duplication. Each had been
 * written two to five times in divergent wordings; each must survive exactly
 * once. These are the entries most likely to be lost silently, because the
 * segment they were deleted from still looks complete without them.
 */
const DEDUPLICATED = [
  ['deploy_voice → voice: no manufactured delight', 'manufacture delight'],
  ['deploy_voice → voice: warmth is accuracy plus staying', 'accuracy plus staying'],
  ['deploy_voice → stance: walking a genuinely split board', 'walk the two branches with the condition'],
  ['deploy_voice keeps: no opening beat', '哈,这问题问得好'],
  ['deploy_voice keeps: one clean picture', 'one clean picture beats three'],
  ['deploy_voice keeps: headings summarise conclusions', 'never a fixed label reused across readings'],
  ['route_relationship → priority_ladder: read real people', 'default is to READ (attractiveness'],
  ['route_relationship → priority_ladder: no falsifiable private facts', "don't state falsifiable private facts as certain"],
  ['route_relationship → priority_ladder: no fabricated accusations', "don't fabricate named accusations"],
  ['route_relationship keeps: read HER, not his psychology', 'is NOT an answer to "is she X."'],
  ['meta_rules merge keeps: never withhold a reading', 'NEVER withhold a reading'],
  ['meta_rules merge keeps: rarer domain, more deviation', 'the rarer the domain'],
  ['meta_rules merge keeps: the three hard lines override', 'minor sexualization'],
  ['meta_rules merge keeps: refusing service is the error', 'REFUSE SERVICE is the error'],
  ['density → voice: confidence carried by grammar', 'carried by the grammar'],
  ['density keeps: never print a confidence list', 'Never print a list of what you are'],
  ['voice → inference_traps: two narrations of one fact', 'THE BOARD LICENSES NEITHER'],
  ['voice → inference_traps: the two ledgers', 'KEEP TWO LEDGERS'],
  ['voice → inference_traps: absence is not evidence', 'ABSENCE IS NOT EVIDENCE'],
  ['voice → inference_traps: nothing subtractive about the absent', 'NEVER TAKE SOMETHING AWAY FROM A PERSON'],
  ['voice → inference_traps: a board carries its own month', 'A BOARD CARRIES THE MONTH IT WAS CAST IN'],
  ['voice → clarity_rules: symbol to real-world variable', 'real-world variable it maps to'],
  ['voice → clarity_rules: the list contains the hardest name', 'THE LIST MUST CONTAIN THE ONE YOU LEAST WANT TO SAY'],
];

let failures = 0;
for (const [label, fragment] of [...VOICE_RULES, ...DEDUPLICATED]) {
  const found = owner(fragment);
  if (!found.length) {
    failures++;
    console.error(`  LOST: ${label}\n        no segment contains: ${fragment}`);
  }
}

assert.equal(failures, 0, `${failures} prompt rule(s) lost — see above`);

// The de-duplication only pays off if the moved rules are not still sitting in
// their old home too. A rule in two places drifts into two different rules,
// which is what produced the contradictions this rebuild cleared.
const SINGLE_OWNER = [
  ['two-narrations rule', 'THE BOARD LICENSES NEITHER', 'inference_traps'],
  ['real-person reading restraints', "don't fabricate named accusations", 'priority_ladder'],
  ['symbol→reality worked example', '录取资格', 'clarity_rules'],
];
for (const [label, fragment, expected] of SINGLE_OWNER) {
  const found = owner(fragment);
  assert.deepEqual(found, [expected], `${label} should live only in ${expected}, found in: ${found.join(', ')}`);
}

console.log(`prompt coverage OK — ${VOICE_RULES.length} voice rules + ${DEDUPLICATED.length} de-duplicated clauses located, ${SINGLE_OWNER.length} single-owner checks passed`);
