// Regenerate the site-copy deck FROM SOURCE, so it cannot drift out of step
// with the product the way the hand-made snapshot did (32% of its blocks no
// longer existed anywhere in the files they named).
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const at = file => resolve(REPO, file);

const PAGES = [
  ['index.html', 'The app — sidebar, casting workbench, composer'],
  ['pricing.html', 'Plans, rates and unit packs'],
  ['guide.html', 'The method, walked through'],
  ['about.html', 'What BourneWise is'],
  ['login.html', 'Sign in and sign up'],
  ['settings.html', 'Account, plan and data'],
  ['privacy.html', 'Privacy policy'],
  ['terms.html', 'Terms of service'],
  ['refund.html', 'Refund policy'],
  ['404.html', 'Not found']
];

/* ── Everything below the HTML pages was outside this deck until 2026-09-03 ──
   The extractor blanked every <script> body with the note "script/style bodies
   are not reader-facing". That is true of the CODE and false of the STRINGS in
   it: the toasts, the error text, the empty states, the board's own vocabulary
   (六亲, 地支, 卦名, 旺衰) and the 万物类象 panel are all things a reader sees,
   and none of them were in here. Measured at the time: 76 strings in the pages'
   own inline scripts, plus eight browser modules and six server files.

   "包括可能看到的" is the whole point of the last two groups. A server error
   string is copy that only appears when something breaks; a 类象 card only
   appears when a reading happens to name that symbol. Neither is less written
   than the landing page, and neither was reviewable before. */

// Browser modules whose strings reach the page.
const READER_JS = [
  ['chat-app.js', '聊天 UI — 投卦流程、toast、报错、空状态、解读外壳'],
  ['account.js', '余额、套餐名、账本条目'],
  ['sidebar.js', '会话列表、余额片、账户行'],
  ['ds-base.js', '共享 chrome'],
  ['casting-figure.js', '排卦图 — 六十四卦名与爻的注解'],
  ['liuyao-engine.js', '盘面词汇 — 六亲 / 地支 / 五行 / 卦名 / 旺衰,直接画在盘上'],
  ['liuyao-ai.js', '用神名称,以及模型没答上来时顶上去的占位解读'],
  ['assets/method.js', '方法页的翻卡部件']
];

// Server files whose error text the browser renders as-is.
const SERVER_JS = [
  ['functions/api/claude.js', '模型代理 — 余额、上游故障、参数拒绝'],
  ['functions/api/rates.js', '费率'],
  ['functions/api/checkout.js', '下单'],
  ['functions/api/auth/[[path]].js', '注册 / 登录 / 改密'],
  ['functions/api/account/[[path]].js', '账户'],
  ['functions/api/billing/[[path]].js', '账单与 webhook']
];

/* Deliberately NOT in this deck. Listed with the reason, because the next
   person's first instinct will be that they were missed. */
const EXCLUDED = [
  ['functions/_lib/prompt-engine.js',
   '提示词栈。**商业机密,而且读者从来看不到它** —— `_middleware.js` 让它保持 404,`tests/prompt-secrecy.mjs` 钉着这条。它是「模型读的字」,归 BOURNEWISE_PROMPT_DECK。'],
  ['functions/_lib/relative-gloss.js',
   '喂系统提示词里的 SYMBOL_CANDIDATES 块。只到模型,不到页面 —— 读者在取象面板看到的是 `lei-xiang.json`,那一份在下面。'],
  ['liuyao-verdict.js',
   '《增删卜易》断卦裁决梯。它的每一条 `why` 都写进盘面 payload 给模型读,页面上一个字都不出现。'],
  ['prompt-checks.js',
   '解读写完之后的核对。源码注释写明「surfaced as telemetry, never acted on」—— 它的判词进日志,不进页面。'],
  ['functions/_lib/db.js · session.js · password.js', 'SQL 与会话内部,没有面向读者的字。'],
  ['assets/marks.js · blocks.js · about.js · weave.js', '几何与排布,画的是形状不是字。'],
  ['palette-guide.html · palette-overview.html', '色板工具,`_redirects` 挡在 `/tools/*` 的 404 后面。']
];

// Attributes a reader can actually perceive — as a label, a tooltip, a hint.
const ATTRS = ['aria-label', 'placeholder', 'title', 'alt', 'aria-description'];

const lineOf = (text, idx) => text.slice(0, idx).split('\n').length;

// Blank out a region but keep the line count, so reported line numbers stay true.
function blank(text, re) {
  return text.replace(re, m => m.replace(/[^\n]/g, ' '));
}

function extract(file) {
  const raw = readFileSync(at(file), 'utf8');
  // script/style bodies are not reader-facing; comments are notes to ourselves
  let scan = blank(raw, /<script\b[^>]*>[\s\S]*?<\/script>/gi);
  scan = blank(scan, /<style\b[^>]*>[\s\S]*?<\/style>/gi);
  scan = blank(scan, /<!--[\s\S]*?-->/g);

  const out = [];
  const seen = new Set();
  const push = (kind, value, idx) => {
    const v = value.replace(/\s+/g, ' ').trim();
    if (!v || v.length < 2) return;
    if (/^[\d\s.,:;·—–\-|/\\+()[\]{}<>#*&%$@!?"']+$/.test(v)) return;  // punctuation/number only
    const key = kind + '\\0' + v;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ kind, value: v, line: lineOf(raw, idx) });
  };

  // <title> and the meta description are what a reader sees in a tab or a link
  let m;
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(scan);
  if (title) push('title', title[1], title.index);
  const desc = /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i.exec(scan);
  if (desc) push('meta description', desc[1], desc.index);

  // perceivable attributes
  for (const attr of ATTRS) {
    const re = new RegExp(`${attr}=["']([^"']+)["']`, 'gi');
    while ((m = re.exec(scan))) push(attr, m[1], m.index);
  }

  // visible text between tags
  const textRe = />([^<>]+)</g;
  while ((m = textRe.exec(scan))) push('text', m[1], m.index);

  return out;
}

/* ── strings inside JavaScript ──────────────────────────────────────────────
   The hard part is telling copy from code, because both are string literals.
   Two passes:

   ① A literal that contains a tag is an HTML fragment being assembled for
      innerHTML — run the same text/attribute reader over it that the pages get.
      This is where most of the chat UI's words live.
   ② Everything else goes through isCopy(), which keeps CJK and English prose
      and drops selectors, class lists, storage keys, CSS and SQL.

   isCopy errs toward keeping. A false positive costs the reader one line to
   skip; a false negative is a string nobody reviews — and this whole deck
   exists because 244 hand-listed blocks turned out not to exist while nobody
   noticed the ones that did. */
function isCopy(t) {
  if (t.length < 2) return false;
  if (/^[\s\d.,:;·—–\-|/\\+()[\]{}<>#*&%$@!?"'=~^]+$/.test(t)) return false;
  if (/^(https?:|\/\/|\.{0,2}\/|data:|mailto:)/i.test(t)) return false;
  if (/^#[0-9a-f]{3,8}$/i.test(t)) return false;
  if (/^[.#[]/.test(t)) return false;                       // CSS selector
  if (/[;{]\s*[a-z-]+\s*:/.test(t)) return false;           // CSS declaration
  if (/^\s*(select|insert|update|delete|create|alter|pragma)\s+/i.test(t)) return false;
  if (/^\{\{value\}\}$/.test(t)) return false;
  if (/^use (strict|asm)$/.test(t)) return false;   // pragma, in every file
  /* ⚠️ 这条是必须的,不是保险。字面量扫描会被**正则字面量**骗:`/["']/` 里的
     引号被当成字符串起点,于是接下来几百个字符的代码被当成一个串抓出来,
     再当文案发出去。审计当场报了 23 条这样的 chat-app 块 ——
     全是 `; } function xrCatalogue() {` 这种。判据是"它看起来像代码"。 */
  if (/\bfunction\s|\bvar\s|\breturn\s|=>|\)\s*\{|;\s*\}/.test(t)) return false;
  if (/^[)\];,}]/.test(t)) return false;         // 以闭合符开头 = 被吞掉的半截代码,文案不这样起头
  if (/\(\?[!:=]|\[\^|\\\*|\\d|\\s\+/.test(t)) return false;   // 正则语法
  if (t.length > 400) return false;              // 文案没有这么长;这么长的是被吞掉的代码
  const cjk = /[一-鿿]/.test(t);
  if (cjk) return true;
  if (!/\s/.test(t)) return false;                          // one token = identifier
  if (!/[a-z]{2}/.test(t)) return false;
  // "is-on rd-badge", "flex-start center" — hyphenated tokens are class/CSS lists
  if (t.split(/\s+/).every((w) => /^[a-z][\w-]*$/.test(w))
      && t.split(/\s+/).some((w) => w.includes('-'))) return false;
  return true;
}

// Reader-perceivable text out of an HTML fragment (used for pages and for
// fragments found inside JS string literals).
function htmlBits(frag) {
  const bits = [];
  let m;
  const textRe = />([^<>]+)</g;
  while ((m = textRe.exec(frag))) bits.push(['text', m[1]]);
  for (const attr of ATTRS) {
    const re = new RegExp(`${attr}=\\\\?["']([^"'\\\\]+)`, 'gi');
    while ((m = re.exec(frag))) bits.push([attr, m[1]]);
  }
  return bits;
}

// `${expr}` → {{value}} so a template reads as a template and the auditor's
// placeholder rule applies to it.
const detmpl = (s) => s
  .replace(/\$\{[^{}]*\}/g, '{{value}}')
  .replace(/\\n/g, ' ').replace(/\\t/g, ' ')
  .replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\\`/g, '`');

function jsCopy(file, opts = {}) {
  const raw = readFileSync(at(file), 'utf8');
  let code = blank(raw, /\/\*[\s\S]*?\*\//g);          // block comments
  code = blank(code, /^[ \t]*\/\/.*$/gm);              // line comments
  if (opts.inlineScriptsOnly) {
    // keep ONLY <script> bodies that have no src, blank everything else
    const keep = [];
    const re = /<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
    let m2, masked = code.replace(/[^\n]/g, ' ').split('');
    while ((m2 = re.exec(code))) {
      const start = m2.index + m2[0].indexOf(m2[1]);
      for (let i = 0; i < m2[1].length; i++) masked[start + i] = code[start + i];
      keep.push(1);
    }
    code = masked.join('');
    if (!keep.length) return [];
  }
  const out = [];
  const seen = new Set();
  const push = (kind, value, idx) => {
    const v = String(value).replace(/\s+/g, ' ').trim();
    if (!v || !isCopy(v)) return;
    const key = kind + '\0' + v;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ kind, value: v, line: lineOf(raw, idx) });
  };
  const re = /(["'`])((?:\\.|(?!\1)[\s\S])*?)\1/g;
  let m;
  while ((m = re.exec(code))) {
    const lit = detmpl(m[2]);
    /* Any literal carrying a tag is markup being assembled — INCLUDING one cut
       off mid-attribute, which is how a long fragment gets split across a `+`.
       The first version tested for a closing `>`, so those halves fell through
       and shipped as tag soup: `<button type="button" class="carry-drop …`. */
    if (/<[a-z][a-z0-9]*[\s>/]/i.test(lit)) {
      for (const [kind, val] of htmlBits(lit)) push(kind === 'text' ? 'markup text' : kind, val, m.index);
      continue;   // never emit the raw fragment
    }
    push(opts.kind || 'string', lit, m.index);
  }
  return out;
}

/* ── server error text ─────────────────────────────────────────────────────
   A server file is mostly SQL, cookie attributes and OAuth scopes; scanning it
   the way a browser module is scanned produced `; Path=/api/auth; HttpOnly…`
   as copy. So take the one field the browser actually renders — `error:` on the
   JSON body (55 of them; there is also one `reason:` and one `message:`) — and
   nothing else. This is a sink, not a guess. */
function serverCopy(file) {
  const raw = readFileSync(at(file), 'utf8');
  let code = blank(raw, /\/\*[\s\S]*?\*\//g);
  code = blank(code, /^[ \t]*\/\/.*$/gm);
  const out = [];
  const seen = new Set();
  const re = /\b(error|reason|message)\s*:\s*(["'`])((?:\\.|(?!\2)[\s\S])*?)\2/g;
  let m;
  while ((m = re.exec(code))) {
    const v = detmpl(m[3]).replace(/\s+/g, ' ').trim();
    if (!v || seen.has(v)) continue;
    seen.add(v);
    out.push({ kind: `${m[1]} response`, value: v, line: lineOf(raw, m.index) });
  }
  return out;
}

/* ── 万物类象 (assets/xiangshu/lei-xiang.json) ──────────────────────────────
   chat-app fetches this and renders it into the 取象 panel: the symbol's name,
   its English gloss, each 象 and every concrete noun under it, plus 动词象意.
   A card only appears when a reading names that symbol, which is exactly the
   "可能看到的" case — written copy that no page shows on its own. */
function xiangCopy() {
  const j = JSON.parse(readFileSync(at('assets/xiangshu/lei-xiang.json'), 'utf8'));
  const out = [];
  for (const [key, e] of Object.entries(j.symbols || {})) {
    const cats = (e.cats || []).map((c) => {
      const zh = (c.items && c.items.zh) || [];
      const en = (c.items && c.items.en) || [];
      return `**${c.zh}** / ${c.en}\n  · ${zh.join('、')}\n  · ${en.join(' · ')}`;
    });
    const acts = e.acts
      ? `**动词象意** · ${(e.acts.zh || []).join('、')} / ${(e.acts.en || []).join(' · ')}`
      : null;
    out.push({
      key,
      en: e.en || '',
      body: [`${key} — ${e.en || ''}`, ...cats, acts].filter(Boolean).join('\n')
    });
  }
  return out;
}

const ent = s => s
  .replace(/&mdash;/g, '—').replace(/&middot;/g, '·').replace(/&hellip;/g, '…')
  .replace(/&rarr;/g, '→').replace(/&times;/g, '×').replace(/&amp;/g, '&')
  .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)));

let md = `# BourneWise — site copy deck (reader-facing text)

Every word a READER sees. The companion to \`copywriting/BOURNEWISE_PROMPT_DECK.md\`,
which covers every word the MODEL reads.

**Generated from source.** The previous edition was assembled by hand and, once the
product moved on, 244 of its 767 blocks (32%) no longer existed anywhere in the
files they pointed at — including a whole pricing scheme that had been replaced.
This one is rebuilt from the files themselves, so a block that appears here is a
block that is really in the product. Regenerate after changing copy.

Each block carries the file and line it came from, and what kind of text it is —
visible text, or a label a reader perceives some other way (a tooltip, a hint, a
screen-reader name).

Runtime strings live in \`copy.js\` and appear in their own section at the end;
they are functions of live numbers, so they are shown as templates.

`;

let total = 0;
const sections = [];
for (const [file, purpose] of PAGES) {
  const items = extract(file);
  total += items.length;
  sections.push({ file, purpose, items });
}

md += `**${total} blocks** across ${PAGES.length} pages, plus the runtime copy module.\n\n---\n\n`;

let si = 0;
for (const { file, purpose, items } of sections) {
  si++;
  md += `## ${si}. ${file}\n\n*${purpose}* — ${items.length} blocks\n\n`;
  let i = 0;
  for (const it of items) {
    i++;
    const id = `s${String(si).padStart(2, '0')}.${file}.${String(i).padStart(3, '0')}`;
    md += `@@ ${id}\n<!-- source: ${file}:${it.line} | kind: ${it.kind} -->\n${ent(it.value)}\n\n`;
  }
  md += `---\n\n`;
}

// runtime copy module
global.window = global;
await import(pathToFileURL(at('copy.js')).href);
const C = global.window.BWCopy;
md += `## ${si + 1}. copy.js — runtime strings\n\n`;
md += `*Shown to a reader while the app is running. Lines that carry a number are*\n`;
md += `*functions of the live value, so they are rendered here with a sample.*\n\n`;
const SAMPLE = { typical: 690, maximum: 900, name: 'Sortis 6', subject: '这件事' };
function renderTemplate(fn) {
  const match = String(fn).match(/^[^(]*\(([^)]*)\)/);
  const params = match ? match[1].split(',').map(s => s.trim()).filter(Boolean) : [];
  const args = params.map(p => /method|name/i.test(p) ? SAMPLE.name
    : /title|subject|question|text/i.test(p) ? SAMPLE.subject
    : /max|reserve/i.test(p) ? SAMPLE.maximum : SAMPLE.typical);
  try { return fn(...args); } catch (e) { return '(takes arguments)'; }
}
function emitRuntime(obj, path, level) {
  md += `${'#'.repeat(level)} \`${path.join('.')}\`\n\n`;
  for (const [key, value] of Object.entries(obj)) {
    const next = [...path, key];
    if (value && typeof value === 'object') {
      emitRuntime(value, next, Math.min(6, level + 1));
      continue;
    }
    const id = `s${si + 1}.copy.js.${next.join('.')}`;
    const kind = typeof value === 'function' ? 'template' : 'runtime text';
    const rendered = typeof value === 'function' ? renderTemplate(value) : value;
    md += `@@ ${id}\n<!-- source: copy.js | kind: ${kind} -->\n${rendered}\n\n`;
  }
}
for (const [group, entries] of Object.entries(C)) emitRuntime(entries, [group], 3);

/* ── the sections that were missing until 2026-09-03 ─────────────────────── */
let sn = si + 1;
let extra = 0;
function emitBlocks(heading, purpose, rows, srcOf) {
  sn++;
  md += `\n---\n\n## ${sn}. ${heading}\n\n*${purpose}* — ${rows.length} blocks\n\n`;
  let i = 0;
  for (const r of rows) {
    i++; extra++;
    const id = `s${String(sn).padStart(2, '0')}.${heading.replace(/\s+/g, '_')}.${String(i).padStart(3, '0')}`;
    md += `@@ ${id}\n<!-- source: ${srcOf(r)} | kind: ${r.kind} -->\n${ent(r.value)}\n\n`;
  }
}

// 12 · the pages' own inline scripts — blanked out by the page extractor above
md += `\n---\n\n## ${++sn}. Inline scripts in the pages\n\n`;
md += `*The page extractor blanks every \`<script>\` body, which is right for the code*\n`;
md += `*and wrong for the strings in it — these are the toasts, errors and empty*\n`;
md += `*states the pages raise themselves.*\n\n`;
{
  let i = 0;
  for (const [file] of PAGES) {
    const rows = jsCopy(file, { inlineScriptsOnly: true });
    if (!rows.length) continue;
    md += `### ${file} — ${rows.length} blocks\n\n`;
    for (const r of rows) {
      i++; extra++;
      md += `@@ s${String(sn).padStart(2, '0')}.inline.${String(i).padStart(3, '0')}\n`
        + `<!-- source: ${file}:${r.line} | kind: ${r.kind} -->\n${ent(r.value)}\n\n`;
    }
  }
}

// 13 · browser modules
for (const [file, purpose] of READER_JS) {
  const rows = jsCopy(file);
  emitBlocks(file, purpose, rows, (r) => `${file}:${r.line}`);
}

// 14 · server error text
{
  const rows = [];
  for (const [file] of SERVER_JS) for (const r of serverCopy(file)) rows.push({ ...r, file });
  emitBlocks('Server responses', '服务端返回、前端原样渲染的报错 —— 只在出事时才看得到的文案', rows,
    (r) => `${r.file}:${r.line}`);
}

// 15 · 万物类象
{
  sn++;
  const syms = xiangCopy();
  md += `\n---\n\n## ${sn}. 万物类象 — the 取象 panel\n\n`;
  md += `*\`assets/xiangshu/lei-xiang.json\`, fetched by chat-app and rendered when a*\n`;
  md += `*reading names a symbol. ${syms.length} symbols. A card appears only if that reading*\n`;
  md += `*happens to mention its symbol — written copy that no page shows on its own.*\n\n`;
  let i = 0;
  for (const s of syms) {
    i++; extra++;
    md += `@@ s${String(sn).padStart(2, '0')}.xiang.${String(i).padStart(3, '0')}\n`
      + `<!-- source: assets/xiangshu/lei-xiang.json | kind: 类象 card -->\n${s.body}\n\n`;
  }
}

// appendix · what is deliberately out, and why
md += `\n---\n\n## Appendix · Deliberately NOT in this deck\n\n`;
md += `每一条都写了理由,因为下一个人的第一反应会是「漏了」。\n\n`;
for (const [file, why] of EXCLUDED) md += `- **\`${file}\`** — ${why}\n`;
md += `\n**判据只有一条:读者的屏幕上会不会出现这些字。**\n`;
md += `发给模型的字是另一本册子(\`BOURNEWISE_PROMPT_DECK.md\`),两者不许混 ——\n`;
md += `提示词栈是商业机密,而且它在公网上必须是 404。\n`;

md = md.replace(
  `**${total} blocks** across ${PAGES.length} pages, plus the runtime copy module.`,
  `**${total + extra} blocks** — ${total} in the markup of ${PAGES.length} pages, `
  + `${extra} in the pages' inline scripts, the browser modules, the server's error text `
  + `and the 万物类象 panel, plus the runtime copy module.`);

writeFileSync(at('copywriting/BOURNEWISE_ALL_SITE_COPY.md'), md);
console.log(`site copy deck regenerated · ${total} page blocks + ${extra} script/server/类象 blocks `
  + `+ copy.js · ${md.length.toLocaleString()} chars`);
