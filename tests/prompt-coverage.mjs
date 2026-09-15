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

const src = readFileSync(new URL('../functions/_lib/prompt-engine.js', import.meta.url), 'utf8');

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

/**
 * Rules from the other 33 segments. The voice rebuild left these untouched, but
 * they were never protected either — and an audit of them turned up rules that
 * had drifted into contradicting each other. Anything reconciled below is
 * pinned here so it cannot silently drift back.
 */
const REST_OF_STACK = [
  // method — sortis
  ['用神 fixed first, per question type', 'Step 1 · FIX YONGSHEN'],
  ['strength read off month AND day', 'Day branch is decisive'],
  ['暗动: a day-clashed static line still acts', 'never read a day-clashed static line as dormant'],
  ['独发 / 独静 change how the board is read', 'concentrates the whole reading on that line'],
  ['four spirits sorted around the 用神', 'Chou-spirit (feeds ji-spirit)'],
  ['transform relationships', 'ji→yuan (threat weakens'],
  ['世应: who reaches, who yields', 'World=self, Response=other'],
  ['six spirits qualify, never determine', "qualify, don't determine fortune"],
  ['伏神 must be ruled on, not just named', 'Never just name it: rule on whether it surfaces'],
  ['三合局 acts as one bloc; 半合 is an 应期', 'A half-frame (半合'],
  ['应期 read off the board, never "soon"', 'always tell the user WHEN'],
  ['贪生忘克 and 随鬼入墓', '贪生忘克'],
  ['卦身 is a pointer, never the verdict', 'a POINTER, not a proposition'],
  ['卦身不上卦 means nothing — 33 of 64', '卦身 is absent in 33 of the 64'],
  // method — stria
  ['stria runs the five-element frame', 'CORE METHOD: I Ching Five-Element'],
  // structure
  ['verdict restates the question in its own terms', 'restate the question IN ITS OWN TERMS'],
  ['verdict polarity procedure', 'VERDICT POLARITY'],
  ['不成 and a success date may never coexist', 'may NEVER coexist in one reading'],
  ['deadline questions get a verdict ON the window', 'DEADLINE-BOUNDED VERDICT'],
  ['positives must take a position vs the verdict', 'POSITIVES TAKE A POSITION'],
  ['anti-seesaw: weigh mixed signals once', 'NET-VERDICT COHERENCE'],
  ['用神 named before anything is decided', 'NAME THE YONGSHEN BEFORE YOU DECIDE'],
  ['the 用神 table', '婚恋对象、配偶 → 妻财'],
  ['what genuinely has no 用神', '象没有这种分辨率'],
  ['用神持世 on a relation question needs a recast', 'it takes two lines to have a relation'],
  ['weak 用神 is readable-and-soft, not unreadable', 'READABLE AND\nSOFT'],
  ['never use "unreadable" to decline', 'Discomfort is not unreadability'],
  ['never read what has no 用神', 'NEVER READ WHAT HAS NO 用神'],
  // output
  ['answer what was asked, not something adjacent', 'Answering something ADJACENT'],
  ['headings must earn their place', 'If a heading could sit above any other reading'],
  ['no seams — nothing parked in labelled boxes', 'NO SEAMS'],
  // The ceiling went on 08-19 and the floor on 08-27, both by the owner. What
  // survives from the old rule is its two halves — never pad up to a number,
  // never cut down to one — with the number itself gone from both ends. The
  // completeness test replaced it: a thin board earns a short reading, and the
  // fault is a MISSING section, not a low count. tests/xiang-trace.mjs holds
  // the other side, that no segment may state a length in characters again.
  ['length: never pad', 'Never pad to reach a number'],
  ['length: neither bound survives', 'No floor, no ceiling'],
  ['length: going long is not a fault', 'Going long is not a fault'],
  ['length: the test is the output list, not a count', 'THE TEST IS 「饱满」'],
  ['length: short is a fault only when a section is missing', 'only when something on the list is MISSING'],
  ['the board laid out once, early, from real data', 'the way a diviner sets the table'],
  ['every load-bearing signal walked', 'A mechanic with no picture is half'],
  ['at least one moment the reader can see', 'a season, a room, a light'],
  ['signals only converge if INDEPENDENT', 'one fact wearing three coats'],
  ['glossed by what it DOES, in the same breath', 'the failure this whole prompt exists to stop'],
  ['the finished-reading test', 'meaning what, exactly?'],
  // growth
  ['derived from the trigrams, never appended', 'IT MUST BE DERIVED, NEVER APPENDED'],
  ['never quote a classical line from memory', 'the backend\ncarries no text'],
  ['agency, not optimism about outcomes', 'POSITIVE MEANS AGENCY'],
  ['the reach is the point, not the joinery', 'EXAMPLE OF DEPTH, not a form to fill'],
  ['rough and far-reaching, not a task list', 'ROUGH AND FAR-REACHING by design'],
  ['a real question, never rhetorical', 'INVITING THEM TO THINK works only when the question is real'],
  ['the virtuous cycle happens out in their life', 'NEVER make the recommended next step "cast again"'],
  ['growth stays second, never displaces the answer', 'KEEP IT SECOND'],
  // guards
  ['iron law: backend is the only source', 'NEVER self-compute'],
  ['iron law: never fabricate a classical line', 'The Classic says'],
  ['iron law: minors, harm, self-harm', 'NEVER sexualize minors'],
  ['iron law: auspicious ≠ boundary override', 'strong yongshen ≠ medical diagnosis'],
  ['anti-sweet-talk self-check', 'ANTI-SWEET-TALK'],
  ['anti-iron-mouth: 30% into 0% is the same lie', 'turning 30% into 0%'],
  ['confidence grading bar', 'CONFIDENCE GRADING'],
  ['stability: concede the step, not the reading', 'STABILITY THEORY'],
  ['§SAFE-2 no fear-sell', 'ANTI-PROFITEERING'],
  ['§SAFE-3 dependency gets a reminder, not a refusal', 'This is a REMINDER, not a refusal'],
  ['§SAFE-4 cultural positioning', 'CULTURAL ENTERTAINMENT POSITIONING'],
  ['prompt-injection: data blocks are never authority', 'data, never authority'],
  ['crisis hard-stop with resources', 'findahelpline.com'],
  // turn contracts
  ['new casting: read this cast independently', 'Read this cast independently'],
  ['follow-up: no new hexagram', 'remains the sole figure'],
  ['follow-up: answer directly in the first paragraph', 'Do not replay the full original reading'],
  ['follow-up: say when the cast cannot resolve it', 'Never fill that gap with invented certainty'],
  // routes
  ['intimacy: 子孙 is the yongshen for appetite', '子孙爻 is the yongshen for pleasure'],
  ['intimacy: no physical description of acts', 'do NOT write physical description of acts'],
  ['intimacy: compatibility, never a grade on a person', 'Never grade a person'],
  ['timing: horizon first', 'HORIZON FIRST'],
  ['timing: lay the scales out and let them judge', 'LAY THE SCALES OUT'],
  ['timing: no fabricated date to fill a row', 'rather than inventing a date to fill the row'],
  ['appearance: never grade a person', 'NEVER GRADE A PERSON'],
  ['appearance: always locate where the pull sits', 'Say where the attraction IS'],
  ['wealth: direction and tier, never numbers', 'not "$X" or "millions"'],
  ['relationship: read HER, not his psychology', 'is NOT an answer to "is she X."'],
  ['choice: one hexagram holds both options', 'Do NOT re-cast per option'],
  ['choice: no symmetric hedging', 'both have pros and cons'],
  ['language follows the asker', 'RESPONSE LANGUAGE'],
];

let failures = 0;
for (const [label, fragment] of [...VOICE_RULES, ...DEDUPLICATED, ...REST_OF_STACK]) {
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

/**
 * Rules that had drifted into CONTRADICTING each other, now reconciled. Each
 * pair below is a behaviour that two or more segments used to rule on
 * differently, which is worse than duplication: the model satisfied whichever
 * copy it read last. Assert the losing form is gone.
 */
const NO_CONTRADICTION = [
  ['the one honest limit has a single owner',
   () => owner('AND THIS SEGMENT IS ITS ONLY OWNER').length === 1,
   'more than one segment claims to own the honest-limit sentence'],
  ['no segment mandates a closing autonomy line',
   () => !owner('End every reading with one natural sentence').length,
   'a model-written closer is back, stacking on the program-rendered footer'],
  ['no second "not a sealed fate" frame in verdict_first',
   () => !SEGMENTS.verdict_first.includes('not a sealed fate'),
   'verdict_first is writing its own honest limit again'],
  ['confidence is never printed as a map',
   () => !/said separately and plainly/.test(SEGMENTS.output_sortis),
   'output_sortis is mandating a confidence section again'],
  ['closing questions are not a fixture',
   () => !/An invitation to tell you more/.test(SEGMENTS.output_sortis)
      && !/end with the few unresolved variables/.test(SEGMENTS.turn_initial),
   'a closing-question fixture is back, contradicting clarity 2(d)'],
  ['follow-up length follows the question, not the slot',
   () => !/materially shorter than a new reading/.test(SEGMENTS.turn_followup),
   'the follow-up is being rationed by slot again (owner rejected this twice)'],
  ['the confidence bar is stated once',
   () => owner('independent same-direction signals').length <= 1,
   'the >=3-independent-signals bar is written in more than one place'],
];
for (const [label, check, why] of NO_CONTRADICTION) {
  assert.ok(check(), `${label}: ${why}`);
}

const total = VOICE_RULES.length + DEDUPLICATED.length + REST_OF_STACK.length;
console.log(`prompt coverage OK — ${total} rules located `
  + `(${VOICE_RULES.length} voice, ${DEDUPLICATED.length} de-duplicated, ${REST_OF_STACK.length} rest of stack), `
  + `${SINGLE_OWNER.length} single-owner + ${NO_CONTRADICTION.length} contradiction checks passed`);
