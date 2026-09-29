/* 古籍断法库:读数据、逐字核对原文、找他本异文、生成文本 skill 和 Obsidian 库。
 *
 * 数据在 functions/_lib/doctrine/kb/data/<术数>/<问题域>/<书>.json,人写的只有这些 JSON。
 * 下面三处全是生成的,手改会被下一次生成覆盖,契约也会报红:
 *   .claude/skills/guji-duanfa/              文本 skill
 *   functions/_lib/doctrine/kb/古籍断法库/     Obsidian 库
 *   functions/_lib/doctrine/kb/jsonl/         给程序读的 jsonl
 *
 * 输出目录不许叫 dist:.gitignore 里有一条 dist/,会把整个目录吞掉。生成物在本机是全的、
 * 推上去就缺一个文件,「生成物是最新的」在本机绿、在 CI 上才红(2026-09-29 出过)。
 * tests/kb-quotes.mjs 现在直接问 git:哪些生成物会被 .gitignore 挡住。
 *
 * 核对的规矩只有一条:每段原文去掉空白之后,必须在它标的那本书里原样出现,
 * 而且落在那本书这一章的行号范围里。空白不算,是因为书里一句话常被换行、
 * 全角空格切开;标点算,一个字都不许差。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const DOCTRINE = path.join(ROOT, 'functions/_lib/doctrine');
export const BOOKS = path.join(DOCTRINE, 'books');
export const KB = path.join(DOCTRINE, 'kb');
export const DATA = path.join(KB, 'data');
export const OUT = {
  skill: path.join(ROOT, '.claude/skills/guji-duanfa'),
  vault: path.join(KB, '古籍断法库'),
  jsonl: path.join(KB, 'jsonl')
};
export const SKILL_NAME = 'guji-duanfa';

const CJK = /[㐀-鿿豈-﫿]/u;
const CJK_G = /[㐀-鿿豈-﫿]/gu;
const PUNCT = /[\p{P}\p{S}]/u;
const PUNCT_G = /[\p{P}\p{S}]/gu;

export const flatten = (s) => String(s).replace(/\s/gu, '');
const stripPunct = (s) => flatten(s).replace(PUNCT_G, '');

/* ---------------------------------------------------------------- config */

export function loadConfig() {
  const read = (f) => JSON.parse(fs.readFileSync(path.join(KB, f), 'utf8'));
  const topics = read('topics.json');
  const terms = read('terms.json').terms;
  const sources = read('sources.json');
  const shushu = new Map(topics.shushu.map((s) => [s.key, s]));
  const domains = new Map(topics.domains.map((d) => [d.key, d]));
  return { topics, terms, sources, shushu, domains };
}

/* ----------------------------------------------------------------- books */

const bookCache = new Map();

/* 一本书读进来之后做两份:flat 是去掉所有空白的正文,flatLine[i] 记 flat 第 i 个字
   在原文第几行;strip 再去掉标点,只给找异文用。 */
export function loadBook(shushu, book) {
  const key = `${shushu}/${book}`;
  if (bookCache.has(key)) return bookCache.get(key);
  const file = path.join(BOOKS, shushu, `${book}.txt`);
  if (!fs.existsSync(file)) { bookCache.set(key, null); return null; }
  const raw = fs.readFileSync(file, 'utf8');
  const chars = [];
  const flatLine = [];
  const flatRaw = [];
  let line = 1;
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (c === '\n') { line++; continue; }
    if (/\s/u.test(c)) continue;
    chars.push(c); flatLine.push(line); flatRaw.push(i);
  }
  const b = { shushu, book, file, raw, flat: chars.join(''), flatLine, flatRaw, strip: null };
  bookCache.set(key, b);
  return b;
}

export function booksOf(shushu) {
  const dir = path.join(BOOKS, shushu);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.txt')).map((f) => f.slice(0, -4)).sort();
}

/* 所有出现的位置。text 按同样的规矩去空白。 */
export function locateAll(b, text) {
  const q = flatten(text);
  const out = [];
  if (!q) return out;
  for (let from = 0; ;) {
    const i = b.flat.indexOf(q, from);
    if (i < 0) break;
    out.push({ start: i, line: b.flatLine[i], endLine: b.flatLine[i + q.length - 1] });
    from = i + 1;
  }
  return out;
}

function stripIndex(b) {
  if (b.strip) return b.strip;
  const chars = []; const line = []; const raw = [];
  for (let k = 0; k < b.flat.length; k++) {
    const c = b.flat[k];
    if (PUNCT.test(c)) continue;
    chars.push(c); line.push(b.flatLine[k]); raw.push(b.flatRaw[k]);
  }
  const s = chars.join('');
  const idx = new Map();
  for (let i = 0; i + 1 < s.length; i++) {
    const g = s.slice(i, i + 2);
    let a = idx.get(g);
    if (!a) { a = []; idx.set(g, a); }
    a.push(i);
  }
  b.strip = { s, line, raw, idx };
  return b.strip;
}

/* q 对 w 的任意一段的最小编辑距离,并记下那一段在 w 里的起止。 */
function semiGlobal(q, w) {
  const n = q.length; const m = w.length;
  let prev = new Array(m + 1).fill(0);
  let prevStart = Array.from({ length: m + 1 }, (_, j) => j);
  for (let i = 1; i <= n; i++) {
    const cur = new Array(m + 1);
    const curStart = new Array(m + 1);
    cur[0] = i; curStart[0] = 0;
    for (let j = 1; j <= m; j++) {
      const sub = prev[j - 1] + (q[i - 1] === w[j - 1] ? 0 : 1);
      const del = prev[j] + 1;
      const ins = cur[j - 1] + 1;
      if (sub <= del && sub <= ins) { cur[j] = sub; curStart[j] = prevStart[j - 1]; }
      else if (del <= ins) { cur[j] = del; curStart[j] = prevStart[j]; }
      else { cur[j] = ins; curStart[j] = curStart[j - 1]; }
    }
    prev = cur; prevStart = curStart;
  }
  let best = 0;
  for (let j = 1; j <= m; j++) if (prev[j] < prev[best]) best = j;
  return { dist: prev[best], start: prevStart[best], end: best };
}

/* 在一本书里找和 seg 最像的一段。给异文用:同一句在别的本子里字句不同。 */
export function approx(seg, b) {
  const q = stripPunct(seg);
  if (q.length < 6) return null;
  const minSim = q.length < 10 ? 0.8 : 0.75;
  const S = stripIndex(b);
  const votes = new Map();
  for (let i = 0; i + 1 < q.length; i++) {
    const arr = S.idx.get(q.slice(i, i + 2));
    if (!arr || arr.length > 6000) continue;
    for (const p of arr) { const st = p - i; votes.set(st, (votes.get(st) || 0) + 1); }
  }
  const need = Math.max(2, Math.floor((q.length - 1) * 0.35));
  const cands = [...votes.entries()].filter(([, v]) => v >= need).sort((a, c) => c[1] - a[1] || a[0] - c[0]).slice(0, 8);
  let best = null;
  for (const [st] of cands) {
    const lo = Math.max(0, st - 6); const hi = Math.min(S.s.length, st + q.length + 6);
    const r = semiGlobal(q, S.s.slice(lo, hi));
    const sim = 1 - r.dist / q.length;
    if (r.end > r.start && (!best || sim > best.sim || (sim === best.sim && lo + r.start < best.start))) {
      best = { sim, start: lo + r.start, end: lo + r.end };
    }
  }
  if (!best || best.sim < minSim) return null;
  const rs = S.raw[best.start];
  const re = S.raw[best.end - 1] + 1;
  return {
    sim: Math.round(best.sim * 100) / 100,
    same: best.sim === 1,
    line: S.line[best.start],
    endLine: S.line[best.end - 1],
    text: flatten(b.raw.slice(rs, re))
  };
}

/* ------------------------------------------------------------------ data */

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.name.endsWith('.json')) out.push(p);
  }
  return out.sort();
}

export function loadData() {
  const units = [];
  const files = walk(DATA);
  for (const f of files) {
    const doc = JSON.parse(fs.readFileSync(f, 'utf8'));
    const rel = path.relative(DATA, f).split(path.sep);
    const defaults = {
      shushu: doc.shushu || rel[0], domain: doc.domain || rel[1],
      work: doc.work, chapter: doc.chapter, chapter_en: doc.chapter_en, ranges: doc.ranges || {}
    };
    for (const u of doc.units || []) {
      units.push({
        ...defaults, ...u,
        ranges: { ...defaults.ranges, ...(u.ranges || {}) },
        _file: path.relative(ROOT, f)
      });
    }
  }
  return { units, files };
}

/* ---------------------------------------------------------------- verify */

export function verify(units, cfg) {
  const errors = [];
  const err = (u, msg) => errors.push(`${u.id || '(无 id)'} [${u._file}]: ${msg}`);
  const ids = new Set();
  const checkTerms = cfg.terms.filter((t) => t.check && t.check.length);
  let quotes = 0; let segments = 0; let chars = 0;

  for (const u of units) {
    const sh = cfg.shushu.get(u.shushu);
    const dm = cfg.domains.get(u.domain);
    if (!sh) err(u, `术数「${u.shushu}」不在 topics.json`);
    if (!dm) err(u, `问题域「${u.domain}」不在 topics.json`);
    if (!u.id) { err(u, '没有 id'); continue; }
    if (ids.has(u.id)) err(u, 'id 重复');
    ids.add(u.id);
    const m = /^([A-Z]{2})\.([A-Z]+)\.([A-Z]+)\.(\d{2,3})$/.exec(u.id);
    if (!m) err(u, 'id 格式应为 LY.WEALTH.HJC.01');
    else {
      if (sh && m[1] !== sh.code) err(u, `id 前缀 ${m[1]} 和术数代号 ${sh.code} 不符`);
      if (dm && m[2] !== dm.code) err(u, `id 第二段 ${m[2]} 和问题域代号 ${dm.code} 不符`);
    }
    if (dm && !dm.topics.some((t) => t.key === u.topic)) err(u, `主题「${u.topic}」不在「${u.domain}」的主题表里`);
    if (!cfg.sources.works[u.work]) err(u, `出处「${u.work}」不在 sources.json 的 works 里`);
    if (!u.title) err(u, '没有 title');
    for (const k of ['yi', 'en']) if (!u.rule || !String(u.rule[k] || '').trim()) err(u, `rule.${k} 为空`);
    if (u.rule && u.rule.en && CJK.test(u.rule.en)) err(u, 'rule.en 里有汉字');
    for (const box of ['dispute', 'note']) {
      if (!u[box]) continue;
      for (const k of ['yi', 'en']) if (!String(u[box][k] || '').trim()) err(u, `${box}.${k} 为空`);
      if (u[box].en && CJK.test(u[box].en)) err(u, `${box}.en 里有汉字`);
    }
    if (!Array.isArray(u.quotes) || !u.quotes.length) { err(u, '没有 quotes'); continue; }
    /* 第一段是这条规则的正身:必须出自这部书(文件收了这部书),不能是卦例。
       多数是本文(by: 经);《增删卜易》有几章通篇是「野鹤曰」「觉子曰」,那就是说话人本人。 */
    const first = u.quotes[0];
    if (first.by === '书中例') err(u, '第一段 quote 是卦例,规则的正身应当是论断的原文');
    const holds = cfg.sources.books[first.book]?.contains || [];
    if (!holds.includes(u.work)) err(u, `第一段 quote 引自《${first.book}》,可 sources.json 说这个文件不收《${u.work}》`);

    u.quotes.forEach((q, qi) => {
      const tag = `quote[${qi}]`;
      quotes++;
      if (!cfg.sources.speakers[q.by]) err(u, `${tag}: by「${q.by}」不在 sources.json 的 speakers 里`);
      const b = loadBook(u.shushu, q.book);
      if (!b) { err(u, `${tag}: books/${u.shushu}/${q.book}.txt 不存在`); return; }
      for (const k of ['zh', 'yi', 'en']) {
        if (!Array.isArray(q[k]) || !q[k].length) err(u, `${tag}.${k} 应是非空数组`);
      }
      if (!Array.isArray(q.zh) || !Array.isArray(q.yi) || !Array.isArray(q.en)) return;
      if (q.zh.length !== q.yi.length || q.zh.length !== q.en.length) {
        err(u, `${tag}: 原文 ${q.zh.length} 段、译文 ${q.yi.length} 段、英文 ${q.en.length} 段,对不齐`);
        return;
      }
      q.zh.forEach((z, i) => {
        segments++; chars += flatten(z).length;
        const y = q.yi[i]; const e = q.en[i];
        for (const [k, v] of [['zh', z], ['yi', y], ['en', e]]) {
          if (!String(v || '').trim()) err(u, `${tag}.${k}[${i}] 为空`);
          if (/[\n|]/.test(v || '')) err(u, `${tag}.${k}[${i}] 里有换行或竖线,表格会断`);
        }
        if (CJK.test(e || '')) err(u, `${tag}.en[${i}] 里有汉字:${(e.match(CJK_G) || []).join('')}`);
        const cjk = ((y || '').match(CJK_G) || []).length;
        if (cjk < Math.min(4, flatten(z).length)) err(u, `${tag}.yi[${i}] 不像中文译文`);
        if (flatten(z).length > 8 && flatten(y) === flatten(z)) err(u, `${tag}.yi[${i}] 和原文一字不差,没有翻译`);
        for (const t of checkTerms) {
          if ((q.literal || []).includes(t.zh)) continue;
          const hit = t.check.find((a) => z.includes(a));
          const needle = (t.needle || t.en).toLowerCase();
          if (hit && !(e || '').toLowerCase().includes(needle)) {
            err(u, `${tag}[${i}]: 原文有「${hit}」,英文里应出现「${t.needle || t.en}」(术语表 ${t.zh});字面意思的话在这段 quote 写 literal`);
          }
        }
      });
      // 整段(各小段连起来)必须在书里连着出现,并且落在这一章的范围里
      const joined = q.zh.join('');
      const all = locateAll(b, joined);
      const range = q.range || u.ranges[q.book];
      const inRange = range ? all.filter((o) => o.line >= range[0] && o.endLine <= range[1]) : all;
      if (!all.length) {
        const bad = q.zh.map((z, i) => (locateAll(b, z).length ? null : i)).filter((i) => i !== null);
        const where = bad.length ? `第 ${bad.join('、')} 段在书里找不到` : '各段都找得到,但连起来不连续';
        err(u, `${tag}: 原文不在《${q.book}》里(${where})`);
        return;
      }
      if (range && !inRange.length) {
        err(u, `${tag}: 原文在《${q.book}》第 ${all.map((o) => o.line).join('、')} 行,不在这一章的范围 ${range[0]}–${range[1]} 行`);
        return;
      }
      const hit = inRange[0];
      q.loc = { line: hit.line, endLine: hit.endLine, also: inRange.length - 1 };
    });
    if (u.see) for (const s of u.see) if (typeof s !== 'string') err(u, 'see 里应是 id 字符串');
  }
  for (const u of units) for (const s of u.see || []) if (!ids.has(s)) err(u, `see 里的 ${s} 不存在`);
  return { errors, stats: { units: units.length, quotes, segments, chars } };
}

/* 本文(by: 经)逐段到同一术数的其他书里找同文、异文。结果只进生成物,不写回数据。 */
export function computeVariants(units) {
  for (const u of units) {
    for (const q of u.quotes || []) {
      if (!(q.by === '经' || q.variants) || !q.loc) continue;
      const others = booksOf(u.shushu).filter((x) => x !== q.book);
      q.parallels = [];
      for (const other of others) {
        const b = loadBook(u.shushu, other);
        const hits = q.zh.map((z) => approx(z, b));
        if (!hits.some(Boolean)) continue;
        q.parallels.push({ book: other, hits });
      }
    }
  }
}

/* ---------------------------------------------------------------- render */

const esc = (s) => String(s).replace(/\|/g, '\\|');
const lineRef = (loc) => (loc.line === loc.endLine ? `第 ${loc.line} 行` : `第 ${loc.line}–${loc.endLine} 行`);
const lineRefEn = (loc) => (loc.line === loc.endLine ? `line ${loc.line}` : `lines ${loc.line}–${loc.endLine}`);
const safeName = (s) => String(s).replace(/[\\/:*?"<>|#^[\]]/g, '').replace(/\s+/g, ' ').trim();

function quoteLabel(u, q, cfg) {
  const sp = cfg.sources.speakers[q.by] || { zh: q.by, en: q.by };
  const work = cfg.sources.works[u.work] || { en: u.work };
  if (q.by === '经') {
    /* 某一段引自别的章,就在那一段上单写 chapter / chapter_en,标签才不会指错章 */
    const ch = q.chapter ?? u.chapter;
    const chEn = q.chapter_en ?? u.chapter_en;
    return {
      zh: `《${u.work}·${ch}》原文`,
      en: `${work.en}${chEn ? `, "${chEn}"` : ''}, base text`
    };
  }
  return { zh: sp.zh, en: sp.en };
}

function table(q, prefix = '') {
  const rows = [`${prefix}| 原文 | 译文 | English |`, `${prefix}| --- | --- | --- |`];
  q.zh.forEach((z, i) => rows.push(`${prefix}| ${esc(z)} | ${esc(q.yi[i])} | ${esc(q.en[i])} |`));
  return rows.join('\n');
}

function parallelsLines(q) {
  const lines = [];
  for (const p of q.parallels || []) {
    const segs = p.hits.map((h, i) => (h ? `${h.same ? '同文' : `异文(相似 ${h.sim})`} ${lineRef(h)}:${h.text}` : null))
      .filter(Boolean);
    if (segs.length) lines.push(`- 《${p.book}》:${segs.join(';')}`);
  }
  return lines;
}

function topicsOf(cfg, domain) {
  const d = cfg.domains.get(domain);
  return d ? d.topics : [];
}

function termsIn(u, cfg) {
  const text = u.quotes.map((q) => q.zh.join('')).join('');
  return cfg.terms.filter((t) => [t.zh, ...(t.aliases || []).filter((a) => a.length > 1)].some((a) => text.includes(a))).map((t) => t.zh);
}

function groupBy(arr, key) {
  const m = new Map();
  for (const x of arr) { const k = key(x); if (!m.has(k)) m.set(k, []); m.get(k).push(x); }
  return m;
}

function idSort(a, b) { return a.id.localeCompare(b.id, 'en', { numeric: true }); }

/* ---- 文本 skill ---- */

function unitMarkdown(u, cfg, level = '##') {
  const out = [];
  out.push(`${level} ${u.id} ${u.title}`);
  out.push('');
  out.push(`**规则(整理,不是原文)**:${u.rule.yi}`);
  out.push('');
  out.push(`**Rule (our summary, not the source text):** ${u.rule.en}`);
  for (const q of u.quotes) {
    const lab = quoteLabel(u, q, cfg);
    out.push('');
    out.push(`**${lab.zh}** — 《${q.book}》${lineRef(q.loc)} · *${lab.en}; ${cfg.sources.books[q.book]?.en || q.book}, ${lineRefEn(q.loc)}*`);
    out.push('');
    out.push(table(q));
  }
  if (u.dispute) {
    out.push('');
    out.push(`> **打架**:${u.dispute.yi}`);
    out.push('>');
    out.push(`> **Where they disagree:** ${u.dispute.en}`);
  }
  if (u.note) {
    out.push('');
    out.push(`> **按**:${u.note.yi}`);
    out.push('>');
    out.push(`> **Note:** ${u.note.en}`);
  }
  const par = u.quotes.flatMap((q) => parallelsLines(q));
  if (par.length) {
    out.push('');
    out.push('他本同文、异文(程序比对,只比本文):');
    out.push('');
    out.push(...par);
  }
  if (u.see && u.see.length) {
    out.push('');
    out.push(`相关:${u.see.join('、')}`);
  }
  return out.join('\n');
}

function renderSkill(units, cfg) {
  const files = new Map();
  const byShushu = groupBy(units, (u) => u.shushu);
  const coverage = [];

  for (const [shushu, us] of byShushu) {
    for (const [domain, du] of groupBy(us, (u) => u.domain)) {
      const tps = topicsOf(cfg, domain);
      const byTopic = groupBy(du, (u) => u.topic);
      const dir = `${shushu}/${domain}`;
      const idx = [
        `# ${shushu} · ${domain} · 索引`,
        '',
        `${du.length} 条。每条一行:id、整理的规则、出处。要看原文、译文、英文三栏对照,打开同目录下的主题文件。`,
        '',
        `${du.length} rules. One line each: id, our summary of the rule, source. For the aligned source text, Chinese translation and English, open the topic file in this folder.`,
        ''
      ];
      for (const t of tps) {
        const list = (byTopic.get(t.key) || []).sort(idSort);
        if (!list.length) continue;
        idx.push(`## ${t.key}(${t.en})→ \`${t.key}.md\``, '');
        for (const u of list) {
          idx.push(`- **${u.id}** ${u.rule.yi}(《${u.work}》)`);
          idx.push(`  ${u.rule.en}`);
        }
        idx.push('');
        const body = [
          `# ${shushu} · ${domain} · ${t.key}`,
          '',
          `*${cfg.shushu.get(shushu)?.en || shushu} · ${cfg.domains.get(domain)?.en || domain} · ${t.en}*`,
          '',
          `${list.length} 条。原文逐字核对过 \`functions/_lib/doctrine/books/\` 下的文本,行号是那份整理本的行号,不是原刻本的页码。「规则(整理)」是本库的归纳,引用时引原文。`,
          ''
        ];
        for (const u of list) body.push(unitMarkdown(u, cfg), '', '---', '');
        files.set(`chapters/${dir}/${t.key}.md`, body.join('\n').trimEnd() + '\n');
      }
      files.set(`chapters/${dir}/索引.md`, idx.join('\n').trimEnd() + '\n');
      coverage.push({ shushu, domain, n: du.length, topics: tps.filter((t) => byTopic.has(t.key)).map((t) => t.key) });
    }
  }

  // 联合:同一问题域下,五门按主题并排
  for (const [domain, du] of groupBy(units, (u) => u.domain)) {
    const tps = topicsOf(cfg, domain);
    const present = [...cfg.shushu.keys()].filter((s) => du.some((u) => u.shushu === s));
    const absent = [...cfg.shushu.keys()].filter((s) => !present.includes(s));
    const lines = [
      `# 五术联合 · ${domain}`,
      '',
      `同一个问题,几门各自怎么看,按主题并排。每条一行,原文在各门自己的主题文件里。`,
      '',
      `One question, each art side by side, by topic. One line per rule; the source text is in each art's own topic file.`,
      '',
      `已收:${present.join('、') || '无'}。${absent.length ? `还没收:${absent.join('、')}。` : ''}`,
      '',
      '| 主题 | ' + present.join(' | ') + ' |',
      '| --- | ' + present.map(() => '---').join(' | ') + ' |'
    ];
    for (const t of tps) {
      lines.push(`| ${t.key} | ` + present.map((s) => du.filter((u) => u.shushu === s && u.topic === t.key).length || '').join(' | ') + ' |');
    }
    lines.push('');
    for (const t of tps) {
      const tu = du.filter((u) => u.topic === t.key);
      if (!tu.length) continue;
      lines.push(`## ${t.key}(${t.en})`, '');
      for (const s of present) {
        const su = tu.filter((u) => u.shushu === s).sort(idSort);
        if (!su.length) continue;
        lines.push(`### ${s} → \`chapters/${s}/${domain}/${t.key}.md\``, '');
        for (const u of su) lines.push(`- **${u.id}** ${u.rule.yi}`, `  ${u.rule.en}`);
        lines.push('');
      }
    }
    files.set(`chapters/联合/${domain}.md`, lines.join('\n').trimEnd() + '\n');
  }

  // 术语表
  const gl = ['# 术语表 · Glossary', '', '英文和本站产品里的叫法一致。「核对」一栏里的写法出现在原文时,英文那一栏必须用这个英文词。', '',
    'English follows the names used in the product. When a form listed under "checked" appears in the source text, the English column must use this English term.', ''];
  for (const [g, ts] of groupBy(cfg.terms, (t) => t.group || '其他')) {
    gl.push(`## ${g}`, '', '| 术语 | 拼音 | English | 别名 | 核对 | 释义 | Definition |', '| --- | --- | --- | --- | --- | --- | --- |');
    for (const t of ts) {
      gl.push(`| ${t.zh} | ${t.py} | ${t.en} | ${(t.aliases || []).join('、')} | ${(t.check || []).join('、')} | ${esc(t.yi)} | ${esc(t.def)} |`);
    }
    gl.push('');
  }
  files.set('glossary.md', gl.join('\n').trimEnd() + '\n');

  // 出处
  const used = new Set(units.flatMap((u) => u.quotes.map((q) => q.book)));
  const usedWorks = new Set(units.map((u) => u.work));
  const src = ['# 出处 · Sources', '',
    '原文逐字核对的是 `functions/_lib/doctrine/books/` 下的整理本,行号是那份文件的行号。要录进判据库的句子仍以影印本为准(见 `functions/_lib/doctrine/BOOK-DB.md`)。', '',
    'Every quote is checked character by character against the texts in `functions/_lib/doctrine/books/`; line numbers refer to those files, not to page numbers of any printed edition.', '',
    '## 古书 · Works', '', '| 书 | English | 作者 | Author |', '| --- | --- | --- | --- |'];
  for (const [k, w] of Object.entries(cfg.sources.works)) if (usedWorks.has(k)) src.push(`| ${k} | ${w.en} | ${w.author || '—'} | ${w.author_en || '—'} |`);
  src.push('', '## 文件和版本 · Files and editions', '', '| 文件 | English | 版本 | 收了哪几部 |', '| --- | --- | --- | --- |');
  for (const [k, b] of Object.entries(cfg.sources.books)) if (used.has(k)) src.push(`| \`books/${[...cfg.shushu.keys()].find((s) => fs.existsSync(path.join(BOOKS, s, k + '.txt'))) || ''}/${k}.txt\` | ${b.en} | ${esc(b.edition)} | ${(b.contains || []).join('、')} |`);
  src.push('', '## 说话的人 · Speakers', '', '| 标记 | 中文 | English | 说明 |', '| --- | --- | --- | --- |');
  for (const [k, s] of Object.entries(cfg.sources.speakers)) src.push(`| ${k} | ${s.zh} | ${s.en} | ${esc(s.note || '')} |`);
  files.set('chapters/出处.md', src.join('\n').trimEnd() + '\n');

  // SKILL.md
  const total = units.length;
  const skill = [
    '---',
    `name: ${SKILL_NAME}`,
    'description: 古籍断法库。六爻、梅花易数、大六壬、奇门遁甲、紫微斗数五门古籍里的判断规则,按问题(求财、婚姻、疾病、事业、考试、出行、失物、官非、应期)分主题整理;每条规则都有逐字核对过的原文、现代汉语译文和英文,三栏逐句对齐,并标出几家说法不同的地方。Use when judging a divination question by the classical rules, looking up what the classics say about a kind of question, or quoting the original text with a translation.',
    '---',
    '',
    '# 古籍断法库',
    '',
    `现在收了 ${total} 条。每条是一个判断点:一句整理过的规则,加上它在古书里的原文、译文、英文(逐句对齐),几家说法不一样的地方单独标出来。`,
    '',
    '## 怎么查',
    '',
    '1. 定术数和问题,打开 `chapters/<术数>/<问题域>/索引.md`:每条规则一行,按主题分组,写着该看哪个主题文件。',
    '2. 打开同一文件夹里的 `<主题>.md`:每条规则下面是原文 | 译文 | English 三栏表,注明哪本书第几行。',
    '3. 同一个问题几门一起看:`chapters/联合/<问题域>.md`。',
    '4. 术语和英文叫法:`glossary.md`。书、版本、说话的人:`chapters/出处.md`。全库一览和所有「打架」条目:`cheatsheet.md`。',
    '',
    '## 引用的规矩',
    '',
    '- **原文是逐字核对过的**:每段原文去掉空白后必须在它标的那本书、那一章的行号范围里原样出现,不然生成这个 skill 的程序直接报错。行号是 `functions/_lib/doctrine/books/` 下整理本的行号,不是原刻本页码。',
    '- **「规则(整理)」不是原文**,是本库的归纳。下断语、写解读时引原文;整理只用来快速找。',
    '- **「打架」**:几家说法不同(比如《黄金策》旧注和王洪绪、野鹤老人意见相反),都列出来了。不要只取一家当定论。',
    '- **「他本同文、异文」**:同一句在别的书里的样子,程序比出来的,只比本文不比注。',
    '- 书里今人加的按语(《增删卜易》的「[乾按]」「[提要]」,《断易天机》的「[注释]」「[译文]」「虎易注」)不收。',
    '',
    '## 目录',
    '',
    '| 术数 | 问题域 | 条数 | 有哪些主题 |',
    '| --- | --- | --- | --- |',
    ...coverage.map((c) => `| ${c.shushu} | ${c.domain} | ${c.n} | ${c.topics.join('、')} |`),
    '',
    `五门联合:${[...new Set(units.map((u) => u.domain))].map((d) => `\`chapters/联合/${d}.md\``).join('、')}。`,
    '',
    '## English',
    '',
    'Classical divination rules from five arts, organised by the kind of question and then by topic. Every rule carries the source text (verified character by character against the library files), a modern Chinese translation and an English translation, aligned phrase by phrase, and flags where the classics disagree. Start from `chapters/<art>/<domain>/索引.md` (index), then open the topic file it points to; `cheatsheet.md` maps the whole library. "Rule (our summary)" is our wording; quote the source text, not the summary.',
    ''
  ];
  files.set('SKILL.md', skill.join('\n'));

  // 一览:每个术数 × 问题域 × 主题有几条;以及所有「打架」的条目,打架最容易被只取一家
  const cheat = ['# 一览 · Cheatsheet', '',
    '全库有哪些、在哪儿;几家说法不同的条目单列在后面,下断语前先看一眼。', '',
    'What is in the library and where; entries where the classics disagree are listed at the end. Check them before judging.', ''];
  for (const c of coverage) {
    const tps = topicsOf(cfg, c.domain);
    cheat.push(`## ${c.shushu} · ${c.domain}(${c.n} 条)→ \`chapters/${c.shushu}/${c.domain}/索引.md\``, '',
      '| 主题 | Topic | 条数 |', '| --- | --- | --- |');
    for (const t of tps) {
      const n = units.filter((u) => u.shushu === c.shushu && u.domain === c.domain && u.topic === t.key).length;
      if (n) cheat.push(`| ${t.key} | ${t.en} | ${n} |`);
    }
    cheat.push('');
  }
  const disputes = units.filter((u) => u.dispute).sort(idSort);
  cheat.push(`## 打架 · Where the classics disagree(${disputes.length} 条)`, '');
  for (const u of disputes) {
    cheat.push(`- **${u.id} ${u.title}**(\`chapters/${u.shushu}/${u.domain}/${u.topic}.md\`):${u.dispute.yi}`, `  ${u.dispute.en}`);
  }
  files.set('cheatsheet.md', cheat.join('\n').trimEnd() + '\n');
  return files;
}

/* ---- Obsidian 库 ---- */

// 文件名上限 255 字节(Linux/macOS),汉字一个 3 字节:标题长到 85 个字就写不出文件(ENAMETOOLONG)。
// 名字里 id 在前、保证不重名,标题只是给人看的,超过 200 字节就截断加「…」;笔记里的 # 标题和 aliases 仍是全文。
const MAX_NOTE_NAME_BYTES = 200;
function clipBytes(s, max) {
  if (Buffer.byteLength(s) <= max) return s;
  let out = '';
  for (const ch of s) {
    if (Buffer.byteLength(out + ch + '…') > max) break;
    out += ch;
  }
  return out + '…';
}
function noteName(u) { return clipBytes(safeName(`${u.id} ${u.title}`), MAX_NOTE_NAME_BYTES); }
function notePath(u) { return `规则/${u.shushu}/${u.domain}/${u.topic}/${noteName(u)}`; }
function link(u) { return `[[${noteName(u)}|${u.id} ${u.title}]]`; }

function yamlStr(s) { return JSON.stringify(String(s)); }
function yamlList(key, arr) { return arr.length ? [`${key}:`, ...arr.map((x) => `  - ${yamlStr(x)}`)] : [`${key}: []`]; }

function renderVault(units, cfg) {
  const files = new Map();
  const byId = new Map(units.map((u) => [u.id, u]));

  for (const u of units) {
    const books = [...new Set(u.quotes.map((q) => q.book))];
    const terms = termsIn(u, cfg);
    const fm = [
      '---',
      `id: ${yamlStr(u.id)}`,
      `title: ${yamlStr(u.title)}`,
      `shushu: ${yamlStr(u.shushu)}`,
      `domain: ${yamlStr(u.domain)}`,
      `topic: ${yamlStr(u.topic)}`,
      `work: ${yamlStr(`[[${u.work}]]`)}`,
      ...yamlList('books', books.map((b) => `[[${b}]]`)),
      ...yamlList('speakers', [...new Set(u.quotes.map((q) => cfg.sources.speakers[q.by]?.zh || q.by))]),
      `dispute: ${u.dispute ? 'true' : 'false'}`,
      ...yamlList('terms', terms.map((t) => `[[${t}]]`)),
      `rule: ${yamlStr(u.rule.yi)}`,
      `rule_en: ${yamlStr(u.rule.en)}`,
      ...yamlList('tags', [`${u.shushu}/${u.domain}/${u.topic}`]),
      ...yamlList('aliases', [u.id, u.title]),
      '---'
    ];
    const body = ['', `# ${u.title}`, '', `${u.shushu} · ${u.domain} · ${u.topic} · 出处 [[${u.work}]]`, '',
      '> [!abstract] 规则(整理,不是原文)', `> ${u.rule.yi}`, '>', `> *Rule (our summary):* ${u.rule.en}`];
    u.quotes.forEach((q, i) => {
      const lab = quoteLabel(u, q, cfg);
      body.push('', `## ${lab.zh}`, '', `> [!quote]+ [[${q.book}]] ${lineRef(q.loc)} · ${lab.en}`, table(q, '> '), '', `^q${i + 1}`);
    });
    if (u.dispute) body.push('', '> [!warning] 打架', `> ${u.dispute.yi}`, '>', `> *Where they disagree:* ${u.dispute.en}`);
    if (u.note) body.push('', '> [!note] 按', `> ${u.note.yi}`, '>', `> *Note:* ${u.note.en}`);
    const par = u.quotes.flatMap((q) => parallelsLines(q).map((l) => l.replace(/^- 《(.+?)》/, '- [[$1]]')));
    if (par.length) body.push('', '## 他本同文、异文', '', ...par);
    if (u.see && u.see.length) body.push('', '## 相关', '', ...u.see.map((s) => `- ${link(byId.get(s))}`));
    files.set(`${notePath(u)}.md`, [...fm, ...body].join('\n') + '\n');
  }

  // 术语
  for (const t of cfg.terms) {
    const fm = ['---', `title: ${yamlStr(t.zh)}`, `en: ${yamlStr(t.en)}`, `pinyin: ${yamlStr(t.py)}`, `group: ${yamlStr(t.group || '')}`,
      ...yamlList('aliases', [...(t.aliases || []).filter((a) => a.length > 1), t.en]), ...yamlList('tags', ['术语']), '---'];
    const used = units.filter((u) => termsIn(u, cfg).includes(t.zh)).sort(idSort);
    const body = ['', `# ${t.zh} · ${t.en}`, '', `*${t.py}*`, '', t.yi, '', t.def, ''];
    if ((t.check || []).length) body.push(`原文里写作「${t.check.join('」「')}」时,英文一律译作 **${t.en}**。`, '');
    body.push(`## 提到它的规则(${used.length})`, '', ...used.map((u) => `- ${link(u)}`));
    files.set(`术语/${safeName(t.zh)}.md`, [...fm, ...body].join('\n') + '\n');
  }

  // 书(文件)和出处(古书)
  const books = [...new Set(units.flatMap((u) => u.quotes.map((q) => q.book)))].sort();
  for (const bk of books) {
    const info = cfg.sources.books[bk] || {};
    const us = units.filter((u) => u.quotes.some((q) => q.book === bk)).sort(idSort);
    const body = ['---', `title: ${yamlStr(bk)}`, `en: ${yamlStr(info.en || '')}`, ...yamlList('tags', ['书']), '---', '',
      `# ${bk}`, '', `*${info.en || ''}*`, '', `版本:${info.edition || '—'}`, '',
      `收的古书:${(info.contains || []).map((w) => (cfg.sources.works[w] ? `[[${w}]]` : w)).join('、') || '—'}`, '',
      `## 从这本书引了原文的规则(${us.length})`, '', ...us.map((u) => `- ${link(u)}`)];
    files.set(`书/${safeName(bk)}.md`, body.join('\n') + '\n');
  }
  for (const w of [...new Set(units.map((u) => u.work))].sort()) {
    const info = cfg.sources.works[w] || {};
    const us = units.filter((u) => u.work === w).sort(idSort);
    const body = ['---', `title: ${yamlStr(w)}`, `en: ${yamlStr(info.en || '')}`, ...yamlList('tags', ['出处']), '---', '',
      `# ${w}`, '', `*${info.en || ''}*`, '', `作者:${info.author || '—'}(${info.author_en || '—'})`, '',
      `## 出自这部书的规则(${us.length})`, '', ...us.map((u) => `- ${link(u)}`)];
    files.set(`出处/${safeName(w)}.md`, body.join('\n') + '\n');
  }

  // 术数 MOC、问题域 MOC(联合)
  for (const [shushu, us] of groupBy(units, (u) => u.shushu)) {
    const lines = ['---', `title: ${yamlStr(shushu)}`, ...yamlList('tags', ['术数']), '---', '', `# ${shushu}`, '', `*${cfg.shushu.get(shushu)?.en || ''}*`, ''];
    for (const [domain, du] of groupBy(us, (u) => u.domain)) {
      lines.push(`## ${domain}(${du.length})`, '', `五门并排看:[[${domain}]]`, '');
      for (const t of topicsOf(cfg, domain)) {
        const tu = du.filter((u) => u.topic === t.key).sort(idSort);
        if (!tu.length) continue;
        lines.push(`### ${t.key} · ${t.en}`, '', ...tu.map((u) => `- ${link(u)}:${u.rule.yi}`), '');
      }
    }
    files.set(`术数/${safeName(shushu)}.md`, lines.join('\n').trimEnd() + '\n');
  }
  for (const [domain, du] of groupBy(units, (u) => u.domain)) {
    const present = [...cfg.shushu.keys()].filter((s) => du.some((u) => u.shushu === s));
    const absent = [...cfg.shushu.keys()].filter((s) => !present.includes(s));
    const lines = ['---', `title: ${yamlStr(domain)}`, ...yamlList('tags', ['问题域']), '---', '',
      `# ${domain} · 五术联合`, '', `*${cfg.domains.get(domain)?.en || ''}*`, '',
      `已收:${present.map((s) => `[[${s}]]`).join('、')}。${absent.length ? `还没收:${absent.join('、')}。` : ''}`, '',
      `表格视图:![[规则库.base#${domain}]]`, ''];
    for (const t of topicsOf(cfg, domain)) {
      const tu = du.filter((u) => u.topic === t.key);
      if (!tu.length) continue;
      lines.push(`## ${t.key} · ${t.en}`, '');
      for (const s of present) {
        const su = tu.filter((u) => u.shushu === s).sort(idSort);
        if (!su.length) continue;
        lines.push(`### ${s}`, '', ...su.map((u) => `- ${link(u)}:${u.rule.yi}`), '');
      }
    }
    files.set(`问题域/${safeName(domain)}.md`, lines.join('\n').trimEnd() + '\n');
  }

  // Base
  const domainsPresent = [...new Set(units.map((u) => u.domain))];
  const shushuPresent = [...new Set(units.map((u) => u.shushu))];
  const base = [
    '# 规则库:所有规则的表格视图。每条规则是一篇笔记,下面的列都是笔记的属性。',
    'filters:',
    '  and:',
    '    - file.inFolder("规则")',
    'properties:',
    '  id:', '    displayName: "id"',
    '  title:', '    displayName: "标题"',
    '  shushu:', '    displayName: "术数"',
    '  domain:', '    displayName: "问题域"',
    '  topic:', '    displayName: "主题"',
    '  work:', '    displayName: "出处"',
    '  books:', '    displayName: "引了哪几本"',
    '  dispute:', '    displayName: "打架"',
    '  rule:', '    displayName: "规则(整理)"',
    '  rule_en:', '    displayName: "Rule"',
    'views:',
    '  - type: table',
    '    name: "全部"',
    '    groupBy:', '      property: domain', '      direction: ASC',
    '    order:', '      - id', '      - shushu', '      - topic', '      - rule', '      - work', '      - dispute',
    ...domainsPresent.flatMap((d) => [
      '  - type: table',
      `    name: ${yamlStr(d)}`,
      '    filters:', '      and:', `        - 'domain == ${JSON.stringify(d)}'`,
      '    groupBy:', '      property: topic', '      direction: ASC',
      '    order:', '      - id', '      - shushu', '      - rule', '      - rule_en', '      - work'
    ]),
    ...shushuPresent.flatMap((s) => [
      '  - type: table',
      `    name: ${yamlStr(s)}`,
      '    filters:', '      and:', `        - 'shushu == ${JSON.stringify(s)}'`,
      '    groupBy:', '      property: domain', '      direction: ASC',
      '    order:', '      - id', '      - topic', '      - rule', '      - work', '      - books'
    ]),
    '  - type: table',
    '    name: "打架"',
    '    filters:', '      and:', "        - 'dispute == true'",
    '    order:', '      - id', '      - shushu', '      - domain', '      - topic', '      - rule', '      - work'
  ];
  files.set('规则库.base', base.join('\n') + '\n');

  // 首页
  const home = ['---', 'title: "首页"', '---', '', '# 古籍断法库', '',
    `${units.length} 条规则。每条一篇笔记:整理的规则,加上原文、译文、English 三栏逐句对齐,注明出自哪本书第几行;几家说法不同的标「打架」。`, '',
    '## 从哪儿进', '',
    `- 按问题:${domainsPresent.map((d) => `[[${d}]]`).join('、')}(五门并排)`,
    `- 按术数:${shushuPresent.map((s) => `[[${s}]]`).join('、')}`,
    '- 按表格:[[规则库.base]](可按术数、问题域、主题、打架筛)',
    '- 术语:`术语/` 文件夹,每个术语一篇,带英文和别名', '- 书和版本:`书/`、`出处/` 文件夹', '',
    '## 引用的规矩', '',
    '- 原文逐字核对过仓库里 `functions/_lib/doctrine/books/` 的整理本,行号是那份文件的行号,不是原刻本页码。',
    '- 「规则(整理)」是本库的归纳,不是原文。',
    '- 这个库是程序生成的(`node tools/kb/build.mjs`),在 Obsidian 里改了会被下一次生成覆盖;要改,改 `functions/_lib/doctrine/kb/data/` 里的 JSON。', '',
    '![[规则库.base#全部]]', ''];
  files.set('首页.md', home.join('\n'));
  return files;
}

function renderJsonl(units) {
  const files = new Map();
  const rows = units.slice().sort(idSort).map((u) => JSON.stringify({
    id: u.id, shushu: u.shushu, domain: u.domain, topic: u.topic, work: u.work, chapter: u.chapter, title: u.title,
    rule: u.rule, dispute: u.dispute || null, note: u.note || null, see: u.see || [],
    quotes: u.quotes.map((q) => ({
      by: q.by, book: q.book, line: q.loc.line, endLine: q.loc.endLine,
      zh: q.zh, yi: q.yi, en: q.en,
      parallels: (q.parallels || []).map((p) => ({ book: p.book, hits: p.hits }))
    }))
  }));
  files.set('rules.jsonl', rows.join('\n') + '\n');
  return files;
}

export function render(units, cfg) {
  return { skill: renderSkill(units, cfg), vault: renderVault(units, cfg), jsonl: renderJsonl(units) };
}

/* ------------------------------------------------------------ write/check */

function listTree(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...listTree(p).map((x) => path.join(e.name, x)));
    else out.push(e.name);
  }
  return out;
}

/* 生成目录归程序所有:多出来的文件删掉,缺的补上,不同的覆盖。check 模式只报不写。 */
export function sync(dir, files, { write }) {
  const want = new Map([...files].map(([k, v]) => [k.split('/').join(path.sep), v]));
  const have = listTree(dir);
  const diff = { added: [], changed: [], removed: [] };
  for (const [rel, content] of want) {
    const p = path.join(dir, rel);
    if (!fs.existsSync(p)) diff.added.push(rel);
    else if (fs.readFileSync(p, 'utf8') !== content) diff.changed.push(rel);
  }
  for (const rel of have) if (!want.has(rel)) diff.removed.push(rel);
  if (write) {
    for (const rel of diff.removed) fs.rmSync(path.join(dir, rel));
    for (const rel of [...diff.added, ...diff.changed]) {
      const p = path.join(dir, rel);
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, want.get(rel));
    }
    // 删空目录
    const prune = (d) => {
      if (!fs.existsSync(d)) return;
      for (const e of fs.readdirSync(d, { withFileTypes: true })) if (e.isDirectory()) prune(path.join(d, e.name));
      if (d !== dir && fs.readdirSync(d).length === 0) fs.rmdirSync(d);
    };
    prune(dir);
  }
  return diff;
}

export function buildAll({ write }) {
  const cfg = loadConfig();
  const { units } = loadData();
  const { errors, stats } = verify(units, cfg);
  if (errors.length) return { errors, stats };
  computeVariants(units);
  const out = render(units, cfg);
  const diffs = {
    skill: sync(OUT.skill, out.skill, { write }),
    vault: sync(OUT.vault, out.vault, { write }),
    jsonl: sync(OUT.jsonl, out.jsonl, { write })
  };
  return { errors, stats, diffs, units };
}
