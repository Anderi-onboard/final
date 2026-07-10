/* BourneWise — Liu Yao annotated casting figure (排盘 on the hand-drawn figure)
   ────────────────────────────────────────────────────────────────────────
   Expands the casting-figure art (organic ink bars · trigram-name caps ·
   hexagram names · arrow) into a full professional 排盘: every line of the
   primary (本卦) carries its 六神 / 伏神 / 六亲·纳甲 / 世应 / 神煞, the changed
   figure (变卦) carries its own labels, with a 干支 + 神煞 header above.
   ALL terms ROMANIZED (pinyin), black-and-white ink. Frame-animated reveal.
   Hover / click a line → English explanation. Nothing leaks to chat text —
   this block holds the whole reading.

   BWLiuYaoChart.html(board, reading?, opts?) -> string   (opts.animate)
   BWLiuYaoChart.wire(container)                                                */
(function () {
  "use strict";

  var STEM_PY = ["Jia","Yi","Bing","Ding","Wu","Ji","Geng","Xin","Ren","Gui"];
  var BR_PY   = ["Zi","Chou","Yin","Mao","Chen","Si","Wu","Wei","Shen","You","Xu","Hai"];
  var SPIRIT_PY = { "青龙":"Qinglong","朱雀":"Zhuque","勾陈":"Gouchen","螣蛇":"Tengshe","白虎":"Baihu","玄武":"Xuanwu" };
  var REL_PY = { parent:"Fumu", peer:"Xiongdi", output:"Zisun", wealth:"Qicai", officer:"Guangui" };
  var REL_GLOSS = {
    parent:"Fumu (Resource) — elders, home, study, documents, what supports you",
    peer:"Xiongdi (Peer) — siblings, friends, rivals, partners, shared cost",
    output:"Zisun (Output) — children, juniors, the remedy, ease, what relieves pressure",
    wealth:"Qicai (Wealth) — money, assets, a man's partner, what you gain",
    officer:"Guangui (Officer) — career, authority, a woman's partner, threat, illness"
  };
  var SPIRIT_GLOSS = {
    "青龙":"Qinglong (Azure Dragon) — joy, growth, romance, good news",
    "朱雀":"Zhuque (Vermilion Bird) — words, documents, gossip, disputes",
    "勾陈":"Gouchen (Hook) — land, delay, entanglement, the slow and stuck",
    "螣蛇":"Tengshe (Snake) — the strange, anxiety, twists, things half-seen",
    "白虎":"Baihu (White Tiger) — force, injury, illness, hard decisive events",
    "玄武":"Xuanwu (Dark Tortoise) — the hidden, theft, doubt, secret dealings"
  };
  var ROLE_PY = { yong:"Yongshen", yuan:"Yuanshen", ji:"Jishen", chou:"Choushen", drain:"Xieshen", peer:"Bihe" };
  var ROLE_GLOSS = {
    yong:"Yongshen — the subject of the question itself",
    yuan:"Yuanshen — the source that feeds the subject",
    ji:"Jishen — the force that attacks the subject",
    chou:"Choushen — feeds the attacker / drains the source",
    drain:"Xieshen — saps the subject's strength",
    peer:"Bihe — same element, reinforces the subject"
  };
  var SS_GLOSS = {
    "Post-Horse":"Yima · travel, movement, a change of place","Peach":"Taohua · romance, charm, attraction",
    "Prosperity":"Lushen · income, salary, steady support","Noble":"Guiren · helpful people, patrons, rescue",
    "Blade":"Yangren · sharp force, risk of injury, a cut-throat edge","General":"Jiangxing · leadership, authority, command",
    "Canopy":"Huagai · solitude, faith, art, the inward path","Robbery":"Jiesha · sudden loss, theft, being stripped",
    "Ghost":"Wangshen · loss of grip, scattering, slipping away","Disaster":"Zaisha · calamity, accident, the unforeseen blow",
    "Healer":"Tianyi · medicine, recovery, the cure"
  };

  function esc(s){ return String(s==null?"":s).replace(/[&<>]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;"}[c];}); }

  /* ── organic ink bar (same brush wave as the casting figure) ── */
  function barPath(x,y,w,h){
    var x2=x+w, y2=y+h, t=w/3, a=1.4;
    return "M "+x.toFixed(1)+" "+y.toFixed(1)+
      " C "+(x+t).toFixed(1)+" "+(y-a).toFixed(1)+" "+(x+2*t).toFixed(1)+" "+(y+a).toFixed(1)+" "+x2.toFixed(1)+" "+y.toFixed(1)+
      " L "+x2.toFixed(1)+" "+y2.toFixed(1)+
      " C "+(x+2*t).toFixed(1)+" "+(y2+a).toFixed(1)+" "+(x+t).toFixed(1)+" "+(y2-a).toFixed(1)+" "+x.toFixed(1)+" "+y2.toFixed(1)+" Z";
  }
  // a single line as an organic bar (yang solid / yin split), ink, optional moving ring
  function lineBar(yang, moving){
    var W=92,H=14,bar=10,y=(H-bar)/2,o;
    function p(x,w){ return '<path d="'+barPath(x,y,w,bar)+'" fill="var(--ink)" stroke="var(--ink)" stroke-width="0.5" stroke-linejoin="round" stroke-linecap="round"></path>'; }
    if (yang){ o=p(0,W); } else { var half=(W-16)/2; o=p(0,half)+p(W-half,half); }
    if (moving){ var cx=W/2,cy=H/2; o+='<circle cx="'+cx+'" cy="'+cy+'" r="4" fill="var(--paper)" stroke="var(--ink)" stroke-width="1.5"></circle>'; }
    return '<svg class="lyc-bar" viewBox="0 0 '+W+' '+H+'" width="'+W+'" height="'+H+'">'+o+'</svg>';
  }

  function html(board, reading, opts){
    injectCSS();
    opts = opts || {};
    var roles = reading && reading.roles ? reading.roles : null;
    var hasBian = !!board.bian, bianFull = board.bian && board.bian.full;
    var L = board.lines, ben = board.ben, m = board.meta;

    /* ── header: 干支 (pillars) + 神煞 (stars) ── */
    var P = m.pillars, header;
    function pp(p){ return STEM_PY[p.stem.idx]+"-"+BR_PY[p.branch.bi]; }
    var pillarStr = P
      ? '<span class="lyc-gz"><b>'+esc(pp(P.year))+'</b> yr</span><span class="lyc-gz"><b>'+esc(pp(P.month))+'</b> mo</span><span class="lyc-gz hot"><b>'+esc(pp(P.day))+'</b> day</span><span class="lyc-gz"><b>'+esc(pp(P.hour))+'</b> hr</span>'
      : '<span class="lyc-gz hot"><b>'+esc(STEM_PY[m.dayPillar.stem.idx]+"-"+BR_PY[m.dayPillar.branch.bi])+'</b> day</span><span class="lyc-gz"><b>'+esc(BR_PY[m.monthBranch.bi])+'</b> mo</span>';
    var ss = m.shensha, starItems=[];
    function st(label,val){ if(val==null) return; starItems.push('<span class="lyc-star" title="'+esc(SS_GLOSS[label]||"")+'"><i>'+label+'</i>'+esc(val)+'</span>'); }
    if (ss){
      st("Post-Horse",BR_PY[ss.postHorse.bi]); st("Peach",BR_PY[ss.peachBlossom.bi]);
      st("Prosperity",BR_PY[ss.lu.bi]); st("Noble",BR_PY[ss.noble[0].bi]+","+BR_PY[ss.noble[1].bi]);
      ss.yangRen&&st("Blade",BR_PY[ss.yangRen.bi]); ss.generalStar&&st("General",BR_PY[ss.generalStar.bi]);
      ss.canopy&&st("Canopy",BR_PY[ss.canopy.bi]); ss.robbery&&st("Robbery",BR_PY[ss.robbery.bi]);
      ss.ghost&&st("Ghost",BR_PY[ss.ghost.bi]); ss.disaster&&st("Disaster",BR_PY[ss.disaster.bi]);
      ss.heavenDoctor&&st("Healer",BR_PY[ss.heavenDoctor.bi]); ss.monthVirtue&&st("Virtue",STEM_PY[ss.monthVirtue.stem.idx]);
    }
    header = '<div class="lyc-head">'+
      '<div class="lyc-line1"><span class="lyc-tag">Pillars</span>'+pillarStr+
        '<span class="lyc-void">Void <b>'+esc(BR_PY[m.xunkong[0].bi])+' '+esc(BR_PY[m.xunkong[1].bi])+'</b></span></div>'+
      (starItems.length?'<div class="lyc-line2"><span class="lyc-tag">Stars</span>'+starItems.join("")+'</div>':'')+
    '</div>';

    /* ── the two figures, annotated, side by side ── */
    var benFig = benFigure(board, roles);
    var bianFig = hasBian ? bianFigure(board) : "";
    var arrow = hasBian ? '<div class="lyc-arrowcol">'+arrowSVG()+'</div>' : "";
    var figs = '<div class="lyc-figs'+(hasBian?' pair':'')+'">'+benFig+arrow+bianFig+'</div>';

    /* ── per-line hover payload ── */
    var payload = [];
    for (var li=5; li>=0; li--) payload.push(lineReadout(L[li], roles?roles.perLine[li]:null, board.hidden.filter(function(h){return h.position===li;})[0], board));

    return '<figure class="lyc'+(hasBian?' has-bian':'')+'"'+(opts.animate===false?' data-static="1"':'')+'>'+
      header + figs + verdictStrip(reading)+
      '<div class="lyc-readout" data-empty="1"><span class="lyc-ro-hint">Hover or tap a line to read it</span></div>'+
      '<script type="application/json" class="lyc-data">'+JSON.stringify(payload)+'</script>'+
    '</figure>';
  }

  // primary (本卦): trigram caps + 6 annotated line-rows + hexagram name
  function benFigure(board, roles){
    var L=board.lines, ben=board.ben;
    var rows="";
    for (var li=5; li>=0; li--){
      var l=L[li], r=roles?roles.perLine[li]:null, isYong=r&&r.primaryYong;
      var hid=board.hidden.filter(function(h){return h.position===li;})[0];
      var spirit='<span class="lyc-spirit">'+esc(SPIRIT_PY[l.spirit.cn]||l.spirit.en)+'</span>';
      var hidden=hid?'<span class="lyc-hidden">'+esc(REL_PY[hid.relative.key])+' '+esc(BR_PY[hid.hiddenBranch.bi])+'</span>':'<span class="lyc-hidden"></span>';
      var label='<span class="lyc-lab'+(isYong?' yong':'')+'"><span class="lyc-rel">'+esc(REL_PY[l.relative.key])+'</span> '+esc(STEM_PY[l.stem.idx]+"-"+BR_PY[l.branch.bi])+' <span class="lyc-el">'+esc(l.element.en)+'</span></span>';
      var role=r?'<span class="lyc-role">'+esc(ROLE_PY[r.role])+'</span>':'';
      var mk=l.marker?'<b class="lyc-mk">'+(l.marker==="self"?"World":"Resp")+'</b>':'';
      var stars=(l.shensha&&l.shensha.length)?'<span class="lyc-ssline">'+l.shensha.map(function(s){return '<i title="'+esc(SS_GLOSS[s.label]||"")+'">'+esc(s.label)+'</i>';}).join('')+'</span>':'';
      rows+='<div class="lyc-line" data-li="'+li+'" tabindex="0" style="--d:'+((5-li)*0.085).toFixed(3)+'s">'+
        spirit+hidden+label+'<span class="lyc-barcell">'+lineBar(l.yang,l.moving)+'</span><span class="lyc-rt">'+mk+role+stars+'</span>'+
      '</div>';
    }
    return '<div class="lyc-fig ben">'+
      '<div class="lyc-tricap top">'+esc(ben.upper.en)+'</div>'+
      '<div class="lyc-rows">'+rows+'</div>'+
      '<div class="lyc-tricap bot">'+esc(ben.lower.en)+'</div>'+
      '<div class="lyc-name">'+esc(ben.name||"")+'</div>'+
    '</div>';
  }

  // changed figure (变卦): trigram caps + 6 labelled line-rows + name (no spirit/hidden)
  function bianFigure(board){
    var bf=board.bian.full, bian=board.bian, L=board.lines;
    var rows="";
    for (var li=5; li>=0; li--){
      var moving=L[li].moving;
      if (bf){
        var b=bf[li];
        var label='<span class="lyc-lab'+(moving?'':' dim')+'"><span class="lyc-rel">'+esc(REL_PY[b.relative.key])+'</span> '+esc(STEM_PY[b.stem.idx]+"-"+BR_PY[b.branch.bi])+' <span class="lyc-el">'+esc(b.element.en)+'</span></span>';
        var mk=b.marker?'<b class="lyc-mk">'+(b.marker==="self"?"World":"Resp")+'</b>':'';
        rows+='<div class="lyc-line bianrow" data-li="'+li+'" style="--d:'+((5-li)*0.085+0.2).toFixed(3)+'s">'+
          '<span class="lyc-barcell">'+lineBar(b.yang,false)+'</span>'+label+'<span class="lyc-rt">'+mk+'</span>'+
        '</div>';
      } else {
        // old board without full bian data: bars only, from the transformed pattern
        var yang = ((bian.pattern>>li)&1)===1;
        rows+='<div class="lyc-line bianrow" style="--d:'+((5-li)*0.085+0.2).toFixed(3)+'s">'+
          '<span class="lyc-barcell">'+lineBar(yang,false)+'</span><span class="lyc-lab dim"></span><span class="lyc-rt"></span>'+
        '</div>';
      }
    }
    return '<div class="lyc-fig bian">'+
      '<div class="lyc-tricap top">'+esc(bian.upper.en)+'</div>'+
      '<div class="lyc-rows">'+rows+'</div>'+
      '<div class="lyc-tricap bot">'+esc(bian.lower.en)+'</div>'+
      '<div class="lyc-name rel">'+esc(bian.name||"")+'</div>'+
    '</div>';
  }

  function arrowSVG(){
    return '<svg width="30" height="16" viewBox="0 0 30 16" fill="none" stroke="var(--faint)" stroke-width="1.4" stroke-linecap="round"><path d="M2 8 C10 3 20 13 28 8"></path><path d="M23 4l5 4-5 4"></path></svg>';
  }

  function verdictStrip(reading){
    if (!reading) return "";
    var yi=reading.yongshenInfo||{}, vk=reading.verdict||"unclear", cap=vk.charAt(0).toUpperCase()+vk.slice(1);
    return '<div class="lyc-verdict v-'+esc(vk)+'"><span class="lyc-vsubj">Subject · <b>'+esc(yi.en||"")+'</b></span><span class="lyc-vbadge">'+esc(cap)+'</span>'+(reading.timing?'<span class="lyc-vtiming">'+esc(reading.timing)+'</span>':'')+'</div>';
  }

  function lineReadout(l, r, hid, board){
    var title="Line "+(l.idx+1)+(l.marker?(" · "+(l.marker==="self"?"World — where you stand":"Response — the other party")):"");
    var lead=(r?ROLE_GLOSS[r.role]+" · ":"")+REL_GLOSS[l.relative.key];
    var notes=[];
    notes.push(SPIRIT_GLOSS[l.spirit.cn]||l.spirit.en);
    notes.push("Najia "+STEM_PY[l.stem.idx]+"-"+BR_PY[l.branch.bi]+" ("+l.element.en+") · "+l.wangShuai.en.toLowerCase()+" this month");
    if (l.shensha&&l.shensha.length) notes.push("Stars here: "+l.shensha.map(function(s){return s.label+" — "+(SS_GLOSS[s.label]||"");}).join("; "));
    if (hid) notes.push("Hidden beneath: "+REL_PY[hid.relative.key]+" "+hid.hiddenBranch.el.en+" "+BR_PY[hid.hiddenBranch.bi]+" — latent, not yet in play");
    if (l.void) notes.push("Void (xunkong) — empty for now, fills when its time comes");
    if (l.monthClash) notes.push("Month-break — undercut by the month");
    if (l.dayClash) notes.push("Day-clash — struck by the day branch");
    if (l.dayCombine) notes.push("Day-bind — held in place by the day");
    if (l.dayTomb) notes.push("Enters the day tomb — shut away, hard to act");
    if (l.moving&&l.transform){ var t=l.transform;
      notes.push("Moving → becomes "+REL_PY[t.relative.key]+" "+t.element.en+" "+BR_PY[t.branch.bi]+(t.jinTui?(" ("+t.jinTui.en+")"):"")+(t.feedsBen?" · turns back to feed it":t.controlsBen?" · turns back to check it":t.clashBen?" · clashes back":"")); }
    return { title:title, lead:lead, notes:notes };
  }

  function wire(container){
    var figs=container.querySelectorAll?container.querySelectorAll('.lyc'):[];
    Array.prototype.forEach.call(figs,function(fig){
      if(fig.__wired) return; fig.__wired=true;
      var data=[]; try{ data=JSON.parse(fig.querySelector('.lyc-data').textContent); }catch(e){}
      var readout=fig.querySelector('.lyc-readout');
      var rows=fig.querySelectorAll('.lyc-line');
      var pinned=null;
      function paint(li,on){ Array.prototype.forEach.call(rows,function(row){ row.classList.toggle('hot', on&&+row.getAttribute('data-li')===li); }); }
      function show(li){
        var d=data[5-li]; if(!d) return;
        readout.removeAttribute('data-empty');
        readout.innerHTML='<div class="lyc-ro-title">'+esc(d.title)+'</div><div class="lyc-ro-lead">'+esc(d.lead)+'</div>'+(d.notes&&d.notes.length?'<ul class="lyc-ro-notes">'+d.notes.map(function(n){return '<li>'+esc(n)+'</li>';}).join('')+'</ul>':'');
        paint(li,true);
      }
      function clear(){ if(pinned!==null){show(pinned);return;} readout.setAttribute('data-empty','1'); readout.innerHTML='<span class="lyc-ro-hint">Hover or tap a line to read it</span>'; paint(-1,false); }
      Array.prototype.forEach.call(rows,function(row){
        var li=+row.getAttribute('data-li');
        row.addEventListener('mouseenter',function(){ if(pinned===null) show(li); });
        row.addEventListener('click',function(){ pinned=(pinned===li)?null:li; pinned===null?clear():show(li); });
        row.addEventListener('keydown',function(e){ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); pinned=(pinned===li)?null:li; pinned===null?clear():show(li); } });
      });
      fig.querySelector('.lyc-figs').addEventListener('mouseleave',clear);
    });
  }

  window.BWLiuYaoChart = { html:html, wire:wire, cast:cast, applyReading:applyReading };

  /* ── cast: draw the whole 排盘 AS the casting animation — coins toss in the
     header while the chart lays itself out line by line, bottom to top, in place.
     Returns a Promise that resolves when the figure has settled. The AI verdict /
     role overlay arrives later via applyReading(). ── */
  function cast(container, board, opts){
    injectCSS(); opts = opts || {};
    var reduced = opts.reduced != null ? opts.reduced
      : (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
    container.innerHTML =
      '<div class="lyc-cast">'+
        '<div class="lyc-casthead"><span class="lyc-coins"></span>'+
          '<span class="lyc-castlabel">Sortis 6</span><span class="lyc-caststatus">Casting\u2026</span></div>'+
        '<div class="lyc-host"></div>'+
      '</div>';
    var coinHost = container.querySelector('.lyc-coins');
    if (window.BWFigure && window.BWFigure.loaderEl) coinHost.appendChild(window.BWFigure.loaderEl());
    var host = container.querySelector('.lyc-host');
    host.innerHTML = html(board, null, { animate:false });
    var fig = host.querySelector('.lyc');
    fig.classList.add('casting');
    var status = container.querySelector('.lyc-caststatus');
    function rows(li){ return fig.querySelectorAll('.lyc-line[data-li="'+li+'"]'); }
    function drawAll(){ Array.prototype.forEach.call(fig.querySelectorAll('.lyc-line'), function(r){ r.classList.add('drawn'); }); }
    if (reduced){ drawAll(); fig.classList.remove('casting'); status.textContent=''; if(coinHost) coinHost.classList.add('spent'); return Promise.resolve(); }
    var ordinals = ["First","Second","Third","Fourth","Fifth","Sixth"];
    return new Promise(function(resolve){
      var i = 0;
      setTimeout(step, 320);
      function step(){
        if (i > 5){ done(); return; }
        status.textContent = ordinals[i] + " line\u2026";
        Array.prototype.forEach.call(rows(i), function(r){ r.classList.add('drawn'); });
        i++; setTimeout(step, 400);
      }
      function done(){
        Array.prototype.forEach.call(fig.querySelectorAll('.lyc-line:not(.drawn)'), function(r){ r.classList.add('drawn'); });
        if (coinHost) coinHost.classList.add('spent');
        setTimeout(function(){ status.textContent=''; fig.classList.remove('casting'); resolve(); }, 520);
      }
    });
  }

  /* ── applyReading: once the AI returns, fill in the 用神 role overlay + the
     verdict strip in place, without re-casting. ── */
  function applyReading(container, board, reading){
    var host = (container.querySelector && container.querySelector('.lyc-host')) || container;
    host.innerHTML = html(board, reading, { animate:false });
    wire(host);
    var status = container.querySelector && container.querySelector('.lyc-caststatus');
    if (status) status.textContent = '';
    var coins = container.querySelector && container.querySelector('.lyc-coins');
    if (coins) coins.classList.add('spent');
  }

  var injected=false;
  function injectCSS(){
    if(injected) return; injected=true;
    var s=document.createElement('style'); s.id='lyc-css';
    s.textContent=[
      ".lyc{font-family:var(--sans);color:var(--ink);font-size:12px}",
      // casting stage: coins toss in the header, the chart lays itself out line by line
      ".lyc-cast{display:flex;flex-direction:column;gap:14px}",
      ".lyc-casthead{display:flex;align-items:center;gap:13px;font-size:11px;letter-spacing:.14em;text-transform:uppercase;white-space:nowrap}",
      ".lyc-coins{display:inline-flex;align-items:center;transition:opacity .6s ease}",
      ".lyc-coins.spent{opacity:.45}",
      ".lyc-castlabel{color:var(--terracotta);font-weight:600}",
      ".lyc-caststatus{color:var(--faint);font-size:10px;letter-spacing:.1em;font-variant-numeric:tabular-nums;transition:opacity .3s}",
      ".lyc-caststatus:empty{display:none}",
      ".lyc.casting .lyc-line{opacity:0;transform:translateY(9px)}",
      ".lyc.casting .lyc-line.drawn{animation:lycRow .7s cubic-bezier(.22,.7,.28,1) forwards}",
      ".lyc-head{padding:0 1px 7px;border-bottom:1px solid var(--line-soft);margin-bottom:10px;display:flex;flex-direction:column;gap:4px}",
      ".lyc-line1,.lyc-line2{display:flex;align-items:baseline;gap:9px;flex-wrap:wrap}",
      ".lyc-line2{padding-top:4px;gap:5px 9px}",
      ".lyc-tag{font-size:9px;letter-spacing:.09em;text-transform:uppercase;color:var(--ghost);min-width:38px}",
      ".lyc-gz{font-size:10.5px;color:var(--dim)}",".lyc-gz b{font-family:var(--serif);font-size:12.5px;color:var(--ink);font-weight:600}",
      ".lyc-gz.hot b{color:var(--terracotta)}",
      ".lyc-void{margin-left:auto;font-size:10.5px;color:var(--dim)}",".lyc-void b{font-family:var(--serif);font-size:12px;color:var(--prussian)}",
      ".lyc-star{font-size:10.5px;color:var(--ink);white-space:nowrap;cursor:help}",
      ".lyc-star i{font-style:normal;font-size:8.5px;letter-spacing:.04em;text-transform:uppercase;color:var(--ghost);margin-right:4px}",
      // figures
      ".lyc-figs{display:flex;align-items:flex-start;gap:6px}",
      ".lyc-figs.pair{justify-content:space-between}",
      ".lyc-fig{display:flex;flex-direction:column;min-width:0}",
      ".lyc-fig.ben{flex:1 1 64%}",".lyc-fig.bian{flex:1 1 36%}",
      ".lyc-arrowcol{align-self:center;padding:0 4px;flex:none}",
      ".lyc-tricap{font-size:9px;letter-spacing:.16em;text-transform:uppercase;color:var(--faint);padding:3px 5px}",
      ".lyc-fig.bian .lyc-tricap{text-align:left}",
      ".lyc-name{font-family:var(--serif);font-size:15px;font-weight:600;color:var(--ink);padding:5px 5px 0;letter-spacing:.01em}",
      ".lyc-name.rel{color:var(--prussian)}",
      ".lyc-rows{display:flex;flex-direction:column}",
      // ben rows: spirit | hidden | label | bar | right(mk+role+stars)
      ".lyc-fig.ben .lyc-line{display:grid;grid-template-columns:56px 62px max-content 78px minmax(90px,1fr);align-items:center;column-gap:8px}",
      ".lyc-fig.bian .lyc-line{display:grid;grid-template-columns:78px max-content 42px;align-items:center;column-gap:8px}",
      ".lyc-line{padding:4px 5px;border-radius:5px;cursor:pointer;transition:background .15s}",
      ".lyc-line:hover,.lyc-line.hot{background:color-mix(in oklab,var(--ink) 5%,transparent)}",
      ".lyc-line.bianrow{cursor:default}",
      ".lyc-line:focus{outline:1.5px solid color-mix(in oklab,var(--ink) 35%,transparent);outline-offset:-2px}",
      ".lyc-spirit{font-size:11px;color:var(--dim);font-weight:500}",
      ".lyc-hidden{font-size:9.5px;color:var(--dim)}",
      ".lyc-lab{font-size:11.5px;color:var(--ink);white-space:nowrap;min-width:0}",
      ".lyc-lab .lyc-rel{font-family:var(--serif);font-size:13px;font-weight:600}",
      ".lyc-lab.yong .lyc-rel{color:var(--terracotta)}",
      ".lyc-lab .lyc-el{color:var(--faint);font-size:9.5px}",
      ".lyc-lab.dim{color:var(--faint)}",".lyc-lab.dim .lyc-rel{color:var(--faint);font-weight:400}",
      ".lyc-role{display:inline-block;font-size:8.5px;font-weight:600;letter-spacing:.03em;text-transform:uppercase;color:var(--dim);margin-left:6px;border:1px solid var(--line);border-radius:3px;padding:0 4px}",
      ".lyc-barcell{display:flex;align-items:center;justify-content:center}",".lyc-bar{display:block;width:76px;height:12px}",
      ".lyc-fig.bian .lyc-barcell{justify-content:flex-start}",
      ".lyc-rt{display:flex;align-items:center;gap:5px;flex-wrap:wrap}",
      ".lyc-mk{font-family:var(--serif);font-size:10px;font-weight:600;color:var(--ink)}",
      ".lyc-ssline{display:inline-flex;gap:4px;flex-wrap:wrap}",
      ".lyc-ssline i{font-style:normal;font-size:8px;letter-spacing:.03em;text-transform:uppercase;color:var(--prussian);border:1px solid color-mix(in oklab,var(--prussian) 30%,transparent);border-radius:3px;padding:0 3px;cursor:help}",
      // verdict + readout
      ".lyc-verdict{display:flex;align-items:center;gap:10px;margin-top:11px;padding-top:10px;border-top:1.5px solid var(--ink)}",
      ".lyc-vsubj{font-size:11px;color:var(--dim)}",".lyc-vsubj b{color:var(--ink);font-weight:600}",
      ".lyc-vbadge{font-family:var(--serif);font-size:12.5px;padding:2px 11px;border:1px solid var(--ink);border-radius:999px;color:var(--ink)}",
      ".lyc-vtiming{font-size:11px;color:var(--faint)}",
      ".lyc-readout{margin-top:9px;padding:9px 12px;background:transparent;border:1px solid var(--line-soft);border-radius:9px;min-height:46px}",
      ".lyc-readout[data-empty]{display:flex;align-items:center;justify-content:center;min-height:36px}",
      ".lyc-ro-hint{font-size:11.5px;color:var(--ghost);letter-spacing:.03em}",
      ".lyc-ro-title{font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--faint);margin-bottom:4px}",
      ".lyc-ro-lead{font-family:var(--serif);font-size:13px;color:var(--ink);line-height:1.5}",
      ".lyc-ro-notes{margin:7px 0 0;padding:0;list-style:none;display:flex;flex-direction:column;gap:3px}",
      ".lyc-ro-notes li{font-size:12px;color:var(--dim);line-height:1.45}",
      ".lyc-ro-notes li:before{content:'\\2014';color:var(--faint);margin-right:6px}",
      "@media (prefers-reduced-motion:no-preference){.lyc:not([data-static]) .lyc-line{animation:lycRow .5s cubic-bezier(.22,.7,.28,1) backwards;animation-delay:var(--d,0s)}}",
      "@keyframes lycRow{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:none}}",
      "@media (max-width:680px){.lyc-figs.pair{flex-direction:column;gap:10px}.lyc-fig.ben,.lyc-fig.bian{flex:1 1 auto}.lyc-arrowcol{transform:rotate(90deg)}}"
    ].join('');
    document.head.appendChild(s);
  }
})();
