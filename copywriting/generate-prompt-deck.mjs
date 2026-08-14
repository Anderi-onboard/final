// Export every model-facing string as an editable deck — the half the
// site-copy deck deliberately leaves out.
import { writeFileSync } from 'node:fs';
global.window = global;
const { PromptEngine } = await import('/home/user/final/functions/_lib/prompt-engine.js');
globalThis.window = globalThis.window || {};
window.BWPromptEngine = PromptEngine;
const PE = global.window.BWPromptEngine;

const SEG_NOTES = {
  role_sortis: 'Who the model is when reading a full Sortis board.',
  role_stria: 'Who the model is for the lighter Stria read.',
  iron_laws: 'Non-negotiables. Violating these is a defect, not a style choice.',
  priority_ladder: 'What wins when two rules pull in different directions.',
  verdict_first: 'The opening verdict and its polarity rules.',
  clarity_rules: 'Plain speech; how findings must land in the reader\'s life.',
  sortis_method: 'The Liu Yao machinery for a full board.',
  stria_method: 'The lighter five-element / trigram read.',
  ux_core: 'How the reading behaves as a product, not just a text.',
  density: 'The no-padding rule — every sentence must carry new information.',
  output_sortis: 'The shape of a Sortis reading, movement by movement.',
  output_stria: 'The shape of a Stria reading.',
  safety: 'Crisis handling and where the model must stop.',
  anti_failure: 'The specific ways past readings went wrong.',
  meta_rules: 'Rules about following the rules.',
  deploy_voice: 'The voice: warm, alive, decisive — the part readers remember.',
  lang_zh: 'Language lock for Chinese questions.'
};

const order = Object.keys(PE.SEGMENTS);
let md = `# BourneWise — prompt deck (model-facing text)

Every word the MODEL reads. The companion to \`copywriting/BOURNEWISE_ALL_SITE_COPY.md\`,
which covers every word a READER sees and deliberately excludes what is here.

Source of truth: \`functions/_lib/prompt-engine.js\`. Editing this file does nothing on its own —
it is for reading, reviewing and drafting. Changes are applied by editing the
matching \`SEGMENTS.<key>\` / \`ROUTES.<key>\` in that file.

- **${order.length} segments** — the building blocks
- **${Object.keys(PE.ROUTES).length} routes** — which blocks a question assembles, in order
- **1 router** — the follow-up vs new-question classifier
- Assembled length: Sortis ~${PE.assemblePrompt('general', 'sortis').length.toLocaleString()} chars · Stria ~${PE.assemblePrompt('general', 'stria').length.toLocaleString()} chars

---

## 1. Routes — what each kind of question assembles

| Route | Purpose | Segments, in order |
|---|---|---|
`;
const BASE = ["role","iron_laws","priority_ladder","experience_contract","verdict_first","clarity_rules","method","ux_core"];
const DELIVERY = ["density","turn","output","safety","anti_failure","meta_rules","deploy_voice"];
for (const [k, r] of Object.entries(PE.ROUTES)) {
  const keys = r.customLayers || BASE.concat(r.focus || [], DELIVERY);
  md += `| \`${k}\` | ${r.description || ''} | ${keys.join(' → ')} |\n`;
}

md += `\n> Four keys resolve at assembly time:
> \`role\` → \`role_sortis\` / \`role_stria\` · \`method\` → \`sortis_method\` / \`stria_method\`
> \`output\` → \`output_sortis\` / \`output_stria\`, or \`output_followup\` on a follow-up turn
> \`turn\` → \`turn_initial\` / \`turn_followup\`
>
> So a follow-up assembles a DIFFERENT prompt from a fresh cast — same rules, different
> shape and turn framing. That is the seam where the follow-up system meets the prompt layer.\n\n---\n\n## 2. Segments\n\n`;

for (const key of order) {
  const body = String(PE.SEGMENTS[key] || '');
  md += `### \`${key}\`\n\n`;
  if (SEG_NOTES[key]) md += `*${SEG_NOTES[key]}*\n\n`;
  md += `<sub>${body.length.toLocaleString()} characters</sub>\n\n\`\`\`text\n${body}\n\`\`\`\n\n---\n\n`;
}

const R = PE.INTENT_ROUTER;
md += `## 3. Follow-up router

Decides whether a new message continues the existing casting or needs a fresh one.
Model \`${R.model}\` · max ${R.maxTokens} tokens · ${R.timeoutMs}ms timeout · falls back to \`${R.fallback}\`.

A tie resolves to NEW on purpose: stretching one casting over two matters produces
a wrong reading, while a fresh cast merely costs a little more.

\`\`\`text
${R.build('«the new message»', '«the earlier casting question»', '«an excerpt of the last reading»')}
\`\`\`
`;

writeFileSync('/home/user/final/copywriting/BOURNEWISE_PROMPT_DECK.md', md);
console.log('prompt deck written ·', md.length.toLocaleString(), 'chars ·', order.length, 'segments');
