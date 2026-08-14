#!/usr/bin/env node
/**
 * Dump the assembled system prompt for reading.
 *
 *   node scripts/dump-prompt.mjs
 *     → artifacts/full-prompt.txt   (greppable / diffable)
 *     → artifacts/full-prompt.html  (navigable, self-contained)
 *
 * Both outputs are gitignored on purpose. They are a verbatim second copy of
 * prompt-engine.js, and artifacts/ is served publicly by Cloudflare Pages —
 * shipping 277 KB of duplicate text to every visitor buys nothing. Regenerate
 * whenever you want to read the stack; the generator is the durable artifact.
 *
 * The HTML embeds BioRhyme and Spinnaker as data URIs because the reading page
 * has to work offline and outside the site's own font paths. Note that both
 * faces are Latin-only (see tokens/fonts.css unicode-range) — the Chinese in
 * the prompt renders in a system CJK face here exactly as it does in the app.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PromptEngine } from '../functions/_lib/prompt-engine.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'artifacts');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

const ENGINE = PromptEngine;

const SEGMENTS = Object.fromEntries(
  [...read('functions/_lib/prompt-engine.js').matchAll(/SEGMENTS\.([a-z_0-9]+)\s*=\s*`([\s\S]*?)`;/g)]
    .map(m => [m[1], m[2]])
);

/* Groups mirror BASE_LAYERS / route focus / DELIVERY_LAYERS in prompt-engine.js.
   The order is functional and worth preserving in the dump: voice sits third
   because it governs the wording of every rule after it, and growth sits before
   density because density is the rule that stops growth becoming a fortune
   cookie. Keep these lists in sync if the assembler changes. */
const GROUPS = [
  {
    title: 'BASE LAYERS',
    note: '每次解读都加载,按此顺序。voice 排第三位,因为它管着它后面每一条规则的措辞。',
    keys: ['role_sortis', 'stance', 'voice', 'readability', 'inference_traps', 'iron_laws',
      'priority_ladder', 'experience_contract', 'verdict_first', 'clarity_rules',
      'sortis_method', 'ux_core']
  },
  {
    title: 'ROUTE FOCUS',
    note: '按问题类型只加载一到两段,由 prompt-router.js 判定。general 路由一段都不加;crisis 路由只留 priority_ladder,不出解读。',
    keys: ['route_relationship', 'route_intimacy', 'route_timing', 'route_wealth',
      'route_appearance', 'route_future_unseen', 'route_choice']
  },
  {
    title: 'DELIVERY LAYERS',
    note: 'route 之后加载。growth 排在 density 前面是故意的:density 正是防止 growth 变成心灵鸡汤的那条规则。',
    keys: ['growth', 'density', 'turn_initial', 'output_sortis', 'safety',
      'anti_failure', 'meta_rules', 'deploy_voice']
  },
  {
    title: 'PRODUCT / TURN 变体',
    note: '与上面同位替换。Stria 走 role_stria / stria_method / output_stria;追问走 turn_followup / output_followup;语言段按 detectLanguage 二选一。',
    keys: ['role_stria', 'stria_method', 'output_stria', 'turn_followup',
      'output_followup', 'lang_en', 'lang_zh']
  }
];

const missing = GROUPS.flatMap(g => g.keys).filter(k => !SEGMENTS[k]);
if (missing.length) {
  console.error('segments missing from the group lists — update scripts/dump-prompt.js:', missing.join(', '));
  process.exit(1);
}
const ungrouped = Object.keys(SEGMENTS).filter(k => !GROUPS.some(g => g.keys.includes(k)));
if (ungrouped.length) {
  console.error('new segments not in any group — update scripts/dump-prompt.js:', ungrouped.join(', '));
  process.exit(1);
}

const BUILD = JSON.parse(read('version.json')).v;
const TOTAL = Object.values(SEGMENTS).reduce((a, b) => a + b.length, 0);
const ASSEMBLED = ENGINE.assemblePrompt('general', 'sortis', 'initial').length;

fs.mkdirSync(OUT, { recursive: true });

// ── plain text ────────────────────────────────────────────────────────────
let txt = `BOURNEWISE — 完整系统提示词\nbuild ${BUILD}\n`
  + `${Object.keys(SEGMENTS).length} 段 · 全部合计 ${TOTAL} 字符 · `
  + `general/sortis/initial 实际装配 ${ASSEMBLED} 字符\n`;
for (const g of GROUPS) {
  txt += `\n\n${'█'.repeat(74)}\n█ ${g.title}\n█ ${g.note}\n${'█'.repeat(74)}\n`;
  for (const k of g.keys) {
    txt += `\n\n╔══ SEGMENTS.${k}  (${SEGMENTS[k].length} 字符) ══╗\n\n${SEGMENTS[k]}\n`;
  }
}
fs.writeFileSync(path.join(OUT, 'full-prompt.txt'), txt);

// ── navigable page ────────────────────────────────────────────────────────
const b64 = p => fs.readFileSync(path.join(ROOT, p)).toString('base64');
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const maxChars = Math.max(...Object.values(SEGMENTS).map(s => s.length));

let rail = '', body = '', n = 0;
for (const g of GROUPS) {
  rail += `<li class="rail-head"><span class="rail-group">${esc(g.title)}</span></li>`;
  body += `<section class="band"><h2 class="band-t">${esc(g.title)}</h2>`
        + `<p class="band-n">${esc(g.note)}</p></section>`;
  for (const k of g.keys) {
    n++;
    const chars = SEGMENTS[k].length;
    rail += `<li class="rail-item" data-seg="${k}"><a href="#s-${k}">`
          + `<span class="rn">${String(n).padStart(2, '0')}</span>`
          + `<span class="rl">${k}</span>`
          + `<span class="rc">${chars.toLocaleString()}</span>`
          + `<span class="bar" style="--w:${(chars / maxChars * 100).toFixed(1)}%"></span></a></li>`;
    body += `<article class="seg" id="s-${k}" data-seg="${k}">`
          + `<header class="seg-h"><span class="seg-n">${String(n).padStart(2, '0')}</span>`
          + `<h3 class="seg-t">SEGMENTS.${k}</h3>`
          + `<span class="seg-c">${chars.toLocaleString()} 字符</span></header>`
          + `<pre class="seg-b">${esc(SEGMENTS[k])}</pre></article>`;
  }
}

/* Palette is lifted from tokens/colors.css so the page reads as part of the
   product: light = the "white" muted-paper theme, dark = the default Harbour
   Dusk. Components reference the aliases only, never a raw hex, per CLAUDE.md. */
const html = `<title>BourneWise Prompt Stack</title>
<style>
@font-face{font-family:'BioRhyme';font-weight:200 800;font-display:swap;src:url(data:font/woff2;base64,${b64('assets/fonts/BioRhyme.woff2')}) format('woff2')}
@font-face{font-family:'Spinnaker';font-weight:400;font-display:swap;src:url(data:font/woff2;base64,${b64('assets/fonts/Spinnaker-400.woff2')}) format('woff2')}
:root{
  --ground:#DDD8CF; --raise:#D3CDC3; --ink:#1F1F1F; --dim:#5B5750;
  --accent:#8F4A2C; --hair:rgba(31,31,31,.16); --bar:rgba(143,74,44,.30);
  --code:#EFEBE4; --shadow:0 1px 2px rgba(31,31,31,.07);
  --serif:'BioRhyme',Georgia,serif; --sans:'Spinnaker',system-ui,sans-serif;
  --han:"PingFang SC","Hiragino Sans GB","Source Han Sans SC","Noto Sans CJK SC","Microsoft YaHei",sans-serif;
  --mono:ui-monospace,SFMono-Regular,"SF Mono",Menlo,Consolas,monospace;
  --tracking:.06em;
}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){
  --ground:#2A211B; --raise:#332821; --ink:#E7DCCB; --dim:#A2968A;
  --accent:#C77A52; --hair:rgba(231,220,203,.18); --bar:rgba(199,122,82,.38);
  --code:#211A15; --shadow:0 1px 2px rgba(0,0,0,.30);
}}
:root[data-theme="dark"]{
  --ground:#2A211B; --raise:#332821; --ink:#E7DCCB; --dim:#A2968A;
  --accent:#C77A52; --hair:rgba(231,220,203,.18); --bar:rgba(199,122,82,.38);
  --code:#211A15; --shadow:0 1px 2px rgba(0,0,0,.30);
}
*{box-sizing:border-box}
body{margin:0;background:var(--ground);color:var(--ink);
  font-family:var(--sans),var(--han);font-size:15px;line-height:1.5;-webkit-font-smoothing:antialiased}
.wrap{display:grid;grid-template-columns:288px minmax(0,1fr);align-items:start}
.rail{position:sticky;top:0;height:100vh;overflow-y:auto;padding:26px 0 40px;
  border-right:1px solid var(--hair);background:var(--ground);scrollbar-width:thin}
.brand{padding:0 22px 18px;border-bottom:1px solid var(--hair);margin-bottom:14px}
.brand h1{font-family:var(--serif);font-weight:700;font-size:19px;letter-spacing:-.01em;
  margin:0 0 6px;line-height:1.15;text-wrap:balance}
.brand .sub{font-size:11.5px;color:var(--dim);letter-spacing:var(--tracking);font-variant-numeric:tabular-nums}
.find{margin:0 22px 16px;display:block;width:calc(100% - 44px);padding:7px 10px;
  font:inherit;font-size:12.5px;color:var(--ink);background:var(--code);
  border:1px solid var(--hair);border-radius:7px}
.find:focus{outline:2px solid var(--accent);outline-offset:1px}
.rail ul{list-style:none;margin:0;padding:0}
.rail-head{padding:16px 22px 7px}
.rail-group{display:block;font-size:11px;letter-spacing:var(--tracking);color:var(--accent)}
.rail-item a{display:grid;grid-template-columns:22px 1fr auto;gap:8px;align-items:baseline;
  position:relative;padding:5px 22px 6px;text-decoration:none;color:var(--ink)}
.rail-item a:hover{background:var(--raise)}
.rail-item a:focus-visible{outline:2px solid var(--accent);outline-offset:-2px}
.rn{font-family:var(--mono);font-size:10px;color:var(--dim);font-variant-numeric:tabular-nums}
.rl{font-size:12.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rc{font-family:var(--mono);font-size:10px;color:var(--dim);font-variant-numeric:tabular-nums}
.bar{position:absolute;left:22px;right:22px;bottom:1px;height:2px;background:var(--bar);
  clip-path:inset(0 calc(100% - var(--w)) 0 0)}
.rail-item.on a{background:var(--raise)}
.rail-item.on .rl{color:var(--accent)}
.rail-item.hide,.seg.hide,.band.hide{display:none}
.main{padding:34px 40px 120px;min-width:0;max-width:1080px}
.lede{max-width:62ch;margin:0 0 40px}
.lede h2{font-family:var(--serif);font-weight:700;font-size:27px;margin:0 0 12px;
  letter-spacing:-.015em;line-height:1.2;text-wrap:balance}
.lede p{margin:0 0 10px;color:var(--dim);font-size:14px}
.stats{display:flex;flex-wrap:wrap;gap:26px;margin:22px 0 0;padding:16px 0 0;border-top:1px solid var(--hair)}
.stat b{display:block;font-family:var(--serif);font-weight:700;font-size:22px;
  font-variant-numeric:tabular-nums;letter-spacing:-.01em}
.stat span{font-size:11px;color:var(--dim);letter-spacing:var(--tracking)}
.band{margin:52px 0 20px;padding-bottom:12px;border-bottom:2px solid var(--accent)}
.band-t{font-family:var(--serif);font-weight:700;font-size:16px;margin:0 0 5px}
.band-n{margin:0;font-size:12.5px;color:var(--dim);max-width:70ch}
.seg{margin:0 0 14px;border:1px solid var(--hair);border-radius:9px;background:var(--raise);
  box-shadow:var(--shadow);overflow:hidden;scroll-margin-top:18px}
.seg-h{display:flex;align-items:baseline;gap:11px;padding:11px 15px;border-bottom:1px solid var(--hair)}
.seg-n{font-family:var(--mono);font-size:10.5px;color:var(--dim);font-variant-numeric:tabular-nums}
.seg-t{font-family:var(--mono);font-size:13px;font-weight:400;margin:0;color:var(--accent);flex:1}
.seg-c{font-family:var(--mono);font-size:10.5px;color:var(--dim);font-variant-numeric:tabular-nums}
.seg-b{margin:0;padding:16px 15px 19px;background:var(--code);overflow-x:auto;
  font-family:var(--mono),var(--han);font-size:12.5px;line-height:1.62;
  white-space:pre-wrap;overflow-wrap:anywhere;tab-size:2}
@media (max-width:900px){
  .wrap{grid-template-columns:1fr}
  .rail{position:static;height:auto;border-right:0;border-bottom:1px solid var(--hair);padding-bottom:20px}
  .main{padding:26px 18px 90px}
  .bar,.rc{display:none}
  .rail ul{display:flex;flex-wrap:wrap;gap:2px;padding:0 16px}
  .rail-head{width:100%;padding:12px 6px 4px}
  .rail-item a{padding:4px 9px;border:1px solid var(--hair);border-radius:99px;
    grid-template-columns:auto auto;gap:6px}
}
html{scroll-behavior:smooth}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
</style>
<div class="wrap">
<nav class="rail">
  <div class="brand">
    <h1>BourneWise 提示词全文</h1>
    <div class="sub">build ${BUILD} · ${Object.keys(SEGMENTS).length} 段 · ${TOTAL.toLocaleString()} 字符</div>
  </div>
  <input class="find" id="find" type="search" placeholder="筛选段落 / 搜索内容" aria-label="筛选段落">
  <ul id="rail">${rail}</ul>
</nav>
<main class="main">
  <div class="lede">
    <h2>这是发给模型的全部文本</h2>
    <p>${Object.keys(SEGMENTS).length} 个段落的逐字全文,按实际装配顺序排列。顺序本身是功能性的:<strong>voice</strong> 排在第三位,因为它管着它后面每一条规则的措辞;<strong>growth</strong> 排在 <strong>density</strong> 前面,因为 density 是防止 growth 变成心灵鸡汤的那条规则。</p>
    <p>左栏每一条底下的横线按字符数等比绘制 —— 长度就是这一段在整份提示词里占的分量。</p>
    <div class="stats">
      <div class="stat"><b>${ASSEMBLED.toLocaleString()}</b><span>一次解读实际装配</span></div>
      <div class="stat"><b>${TOTAL.toLocaleString()}</b><span>全部段落合计</span></div>
      <div class="stat"><b>${Object.keys(SEGMENTS).length}</b><span>段</span></div>
    </div>
  </div>
  <div id="body">${body}</div>
</main>
</div>
<script>
(function(){
  var items=[].slice.call(document.querySelectorAll('.rail-item'));
  var segs=[].slice.call(document.querySelectorAll('.seg'));
  var bands=[].slice.call(document.querySelectorAll('.band'));
  var find=document.getElementById('find');
  function railFor(name){
    for(var i=0;i<items.length;i++) if(items[i].dataset.seg===name) return items[i];
    return null;
  }
  find.addEventListener('input',function(){
    var q=find.value.trim().toLowerCase();
    if(!q){
      items.forEach(function(i){i.classList.remove('hide')});
      segs.forEach(function(s){s.classList.remove('hide')});
      bands.forEach(function(b){b.classList.remove('hide')});
      return;
    }
    segs.forEach(function(s){
      var hit=s.dataset.seg.toLowerCase().indexOf(q)>=0
        || s.querySelector('.seg-b').textContent.toLowerCase().indexOf(q)>=0;
      s.classList.toggle('hide',!hit);
      var r=railFor(s.dataset.seg);
      if(r) r.classList.toggle('hide',!hit);
    });
    bands.forEach(function(b){b.classList.add('hide')});
  });
  if('IntersectionObserver' in window){
    var io=new IntersectionObserver(function(es){
      es.forEach(function(e){
        var r=railFor(e.target.dataset.seg);
        if(r) r.classList.toggle('on',e.isIntersecting);
      });
    },{rootMargin:'-10% 0px -80% 0px'});
    segs.forEach(function(s){io.observe(s)});
  }
})();
</script>`;
fs.writeFileSync(path.join(OUT, 'full-prompt.html'), html);

console.log(`build ${BUILD} · ${Object.keys(SEGMENTS).length} segments · ${TOTAL} chars total`);
console.log(`  artifacts/full-prompt.txt   ${txt.length} bytes`);
console.log(`  artifacts/full-prompt.html  ${html.length} bytes`);
