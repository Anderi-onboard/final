/* BourneWise — casting figure v4
   Organic SVG coin loader (hand-drawn morphing blobs, no square hole)
   Traditional trigram glyphs · ink-brush line reveal · mouse tilt
   API: window.BWFigure.{random, glyphSVG, pairHTML, cast, loaderEl, NAMES} */
(function () {
  "use strict";

  var NS = "http://www.w3.org/2000/svg";

  /* 64 hexagram poetic names — ONE-TO-ONE by pattern (bit0=line1, bottom).
     pattern = lowerTb | (upperTb<<3); tb: 0坤 1震 2坎 3兑 4艮 5离 6巽 7乾.
     Wilhelm/Baynes English names, mapped to the correct trigram pair. */
  var NAMES = (function(){
    var H = new Array(64);
    function S(U,L,name){ H[ L | (U<<3) ] = name; }
    S(7,7,"The Creative");                S(0,0,"The Receptive");
    S(2,1,"Difficulty at the Beginning"); S(4,2,"Youthful Folly");
    S(2,7,"Waiting");                     S(7,2,"Conflict");
    S(0,2,"The Army");                    S(2,0,"Holding Together");
    S(6,7,"Small Taming");                S(7,3,"Treading");
    S(0,7,"Peace");                       S(7,0,"Standstill");
    S(7,5,"Fellowship");                  S(5,7,"Great Possession");
    S(0,4,"Modesty");                     S(1,0,"Enthusiasm");
    S(3,1,"Following");                   S(4,6,"Work on the Decayed");
    S(0,3,"Approach");                    S(6,0,"Contemplation");
    S(5,1,"Biting Through");              S(4,5,"Grace");
    S(4,0,"Splitting Apart");             S(0,1,"Return");
    S(7,1,"Innocence");                   S(4,7,"Great Taming");
    S(4,1,"Nourishment");                 S(3,6,"Great Exceeding");
    S(2,2,"The Abysmal");                 S(5,5,"The Clinging");
    S(3,4,"Influence");                   S(1,6,"Duration");
    S(7,4,"Retreat");                     S(1,7,"Great Power");
    S(5,0,"Progress");                    S(0,5,"Darkening of the Light");
    S(6,5,"The Family");                  S(5,3,"Opposition");
    S(2,4,"Obstruction");                 S(1,2,"Deliverance");
    S(4,3,"Decrease");                    S(6,1,"Increase");
    S(3,7,"Breakthrough");                S(7,6,"Coming to Meet");
    S(3,0,"Gathering Together");          S(0,6,"Pushing Upward");
    S(3,2,"Oppression");                  S(2,6,"The Well");
    S(3,5,"Revolution");                  S(5,6,"The Cauldron");
    S(1,1,"The Arousing");                S(4,4,"Keeping Still");
    S(6,4,"Development");                 S(1,3,"The Marrying Maiden");
    S(1,5,"Abundance");                   S(5,4,"The Wanderer");
    S(6,6,"The Gentle");                  S(3,3,"The Joyous");
    S(6,2,"Dispersion");                  S(2,3,"Limitation");
    S(6,3,"Inner Truth");                 S(1,4,"Small Exceeding");
    S(2,5,"After Completion");            S(5,2,"Before Completion");
    return H;
  })();

  /* Trigrams by 3-bit index (bit0=bottom, bit2=top).
     gi = five-element index in generating order (Wood0 Fire1 Earth2 Metal3 Water4);
     nat = the trigram's classical image, used to mark where the reading comes from. */
  var TRIGRAMS = [
    { sym:"☷", en:"Earth",    gi:2, nat:"yielding, receptive" },
    { sym:"☳", en:"Thunder",  gi:0, nat:"arousing, sudden movement" },
    { sym:"☵", en:"Water",    gi:4, nat:"depth, the unavoidable" },
    { sym:"☱", en:"Lake",     gi:3, nat:"openness, quiet joy" },
    { sym:"☶", en:"Mountain", gi:2, nat:"stillness, the immovable" },
    { sym:"☲", en:"Fire",     gi:1, nat:"clarity, what clings and shows" },
    { sym:"☴", en:"Wind",     gi:0, nat:"gentle, persistent pressure" },
    { sym:"☰", en:"Heaven",   gi:3, nat:"force, pure initiative" }
  ];

  /* Five elements in generating order — colours tuned to the Paper palette */
  var ELEMENTS = [
    { en:"Wood",  color:"#6E7B43" },
    { en:"Fire",  color:"#B5502C" },
    { en:"Earth", color:"#A87C36" },
    { en:"Metal", color:"#8A8273" },
    { en:"Water", color:"#284C82" }
  ];

  /* Najia line-branch element (gi) per trigram bit-index, bottom->top.
     Inner table = lower trigram (lines 1-3); outer = upper trigram (lines 4-6). */
  var NAJIA_INNER = [ [2,1,0],[4,0,2],[0,2,1],[1,0,2],[2,1,3],[0,2,4],[2,4,3],[4,0,2] ];
  var NAJIA_OUTER = [ [2,4,3],[1,3,2],[3,2,4],[4,3,2],[2,4,0],[3,2,1],[2,1,0],[1,3,2] ];

  /* Eight-palace map: pattern (6-bit) -> palace element (gi) + Self-line position.
     Built from each pure trigram doubled, by the canonical world-line flip sequence. */
  var PALACE = (function () {
    var map = {}, stages = [
      {f:[],w:6},{f:[0],w:1},{f:[0,1],w:2},{f:[0,1,2],w:3},
      {f:[0,1,2,3],w:4},{f:[0,1,2,3,4],w:5},{f:[0,1,2,4],w:4},{f:[4],w:3}
    ];
    for (var tb = 0; tb < 8; tb++) {
      var base = tb | (tb << 3);
      stages.forEach(function (st) {
        var pat = base;
        st.f.forEach(function (li) { pat ^= (1 << li); });
        if (map[pat] === undefined) map[pat] = { palaceGi: TRIGRAMS[tb].gi, world: st.w };
      });
    }
    return map;
  })();

  function trigramOf(lines, offset) {
    var b = 0;
    for (var i = 0; i < 3; i++) if (lines[offset+i].yang) b |= (1<<i);
    return TRIGRAMS[b];
  }

  /* Figure geometry — extra right margin for position labels */
  var W = 64, BAR = 7, GAP = 8, PADX = 5, PADY = 5, N = 6;
  var H = PADY*2 + N*BAR + (N-1)*GAP;
  var WFULL = 82; /* viewBox width including label column */
  var POS_LABELS = ["Ⅰ","Ⅱ","Ⅲ","Ⅳ","Ⅴ","Ⅵ"];

  function patternBits(lines) {
    var b = 0;
    for (var i = 0; i < N; i++) if (lines[i].yang) b |= (1<<i);
    return b;
  }

  /* ── public: random ── */
  function random(method) {
    var lines = [];
    for (var i = 0; i < N; i++) lines.push({ yang: Math.random() < 0.5, changing: false });
    var name = NAMES[patternBits(lines) % NAMES.length];
    var transformedLines = null, transformedName = null, changeIdx = [];
    if (method === "sortis") {
      var k = 1 + (Math.random() < 0.55 ? 1 : 0);
      var pool = [0,1,2,3,4,5];
      for (var s = pool.length-1; s > 0; s--) {
        var j = Math.floor(Math.random()*(s+1));
        var t = pool[s]; pool[s]=pool[j]; pool[j]=t;
      }
      changeIdx = pool.slice(0,k).sort(function(a,b){return a-b;});
      changeIdx.forEach(function(i){ lines[i].changing = true; });
      transformedLines = lines.map(function(l){
        return { yang: l.changing ? !l.yang : l.yang, changing: false };
      });
      transformedName = NAMES[patternBits(transformedLines) % NAMES.length];
    }
    return { method:method, lines:lines, name:name,
      transformedLines:transformedLines, transformedName:transformedName, changeIdx:changeIdx };
  }

  /* ── public: glyphSVG ── */
  function glyphSVG(lines, o) {
    o = o || {};
    var size = o.size||60, color = o.color||"currentColor";
    var markChanges = o.markChanges!==false, changeColor = o.changeColor||color;
    var c = "";
    for (var v = 0; v < N; v++) {
      var li = N-1-v, ln = lines[li];
      var y = PADY + v*(BAR+GAP);
      if (ln.yang) {
        c += barStr(PADX, y, W-2*PADX, BAR);
      } else {
        var half = (W-2*PADX-10)/2;
        c += barStr(PADX, y, half, BAR);
        c += barStr(W-PADX-half, y, half, BAR);
      }
      if (markChanges && ln.changing) {
        c += '<circle cx="'+(W/2)+'" cy="'+(y+BAR/2)+
          '" r="2.7" fill="none" stroke="'+changeColor+'" stroke-width="1.4"></circle>';
      }
    }
    return '<svg class="bw-fig" width="'+size+'" height="'+(size*H/W).toFixed(1)+
      '" viewBox="0 0 '+W+' '+H+'" fill="'+color+'" aria-hidden="true">'+c+'</svg>';
  }
  function rectStr(x,y,w,h){ return barStr(x,y,w,h); }

  /* ── public: pairHTML — renders the WHOLE casting block (loader + model label +
     figure) so the SAVED reading is byte-for-byte what the animation settles into ── */
  function pairHTML(spec, o) {
    injectCSS();
    o = o || {};
    var size = o.size||52;
    var primWrap = figWrapStr(spec.lines,
      {size:size, color:o.color||"var(--ink)", changeColor:"var(--terracotta)", name:spec.name});
    var figsInner = primWrap, pairMode = "";
    if (spec.transformedLines) {
      pairMode = " bw-pair-mode";
      var relWrap = figWrapStr(spec.transformedLines,
        {size:size, color:"var(--prussian)", name:spec.transformedName, relating:true});
      figsInner = primWrap + '<span class="bw-pair-arrow">'+arrowSVG()+'</span>' + relWrap;
    }
    return '<div class="bw-cast" data-method="'+esc(spec.method)+'">'+
        '<div class="bw-cast-head">'+coinsStr()+
          '<span class="bw-cast-method">'+methodName(spec.method)+'</span></div>'+
        '<div class="bw-figs'+pairMode+'">'+figsInner+'</div>'+
      '</div>';
  }

  /* one figure column: trigram tag · glyph · trigram tag · name (matches cast's buildHexWrap) */
  function figWrapStr(lines, o){
    o = o || {};
    var lower = trigramOf(lines,0), upper = trigramOf(lines,3);
    var glyph = glyphSVG(lines,{size:o.size||52,color:o.color||"var(--ink)",
      changeColor:o.changeColor||"var(--terracotta)"});
    return '<span class="bw-fig-wrap">'+
      '<span class="bw-tri-tag bw-tri-tag-static">'+triLbl(upper)+'</span>'+
      '<span class="bw-fig-glyph">'+glyph+'</span>'+
      '<span class="bw-tri-tag bw-tri-tag-static">'+triLbl(lower)+'</span>'+
      '<span class="bw-fig-name'+(o.relating?' relating':'')+'">'+esc(o.name||"")+'</span>'+
    '</span>';
  }
  function methodName(m){ return m==="sortis" ? "Sortis 6" : "Stria 64"; }
  /* the loader as markup — identical morphing coins as the live cast */
  function coinsStr(){ return '<span class="bw-coins">'+coinsMarkup()+'</span>'; }

  function triLbl(tri){
    return '<span class="bw-tri-sym">'+tri.sym+'</span>'+
           '<span class="bw-tri-en">'+tri.en+'</span>';
  }
  /* refined transform arrow: a long hairline shaft with a small open head —
     no squiggle, no fat chevron. Reads as a typographic mark, not a doodle. */
  function arrowSVG(){
    return '<svg width="34" height="12" viewBox="0 0 34 12" fill="none" stroke="var(--ghost)" '+
      'stroke-width=".9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+
      '<path d="M2 6 H 31"></path><path d="M26.5 2.8 L 31 6 L 26.5 9.2"></path></svg>';
  }
  function esc(s){
    return String(s==null?"":s).replace(/[&<>]/g,function(c){
      return{"&":"&amp;","<":"&lt;",">":"&gt;"}[c];
    });
  }

  /* ── organic loader: a single hollow, hand-drawn-style ring — its corners
     morph asymmetrically while it drifts in a slow rotation, so it reads as
     an imperfect circle being drawn-in-motion rather than a mechanical
     spinner. Replaces the old three-coin toss icon (kept identical in the
     live cast and the saved reading, so nothing shrinks or freezes when the
     casting settles). ── */
  var BW_BLOB = "M -2.8 -22.7 C 3.8 -23.2, 16.0 -19.3, 19.5 -13.6 C 23.0 -7.9, 21.9 5.4, 18.1 11.4 C 14.5 17.5, 3.2 23.2, -2.8 22.6 C -8.8 22.0, -14.8 13.5, -17.8 7.9 C -20.8 2.3, -23.0 -5.7, -20.5 -10.8 C -17.9 -15.9, -9.4 -22.2, -2.8 -22.7 Z";
  function coinsMarkup() {
    return '<span class="bw-af-loader" aria-hidden="true"></span>' +
      '<span class="bw-af-loader b" aria-hidden="true"></span>' +
      '<span class="bw-af-loader c" aria-hidden="true"></span>';
  }
  function makeCoins() {
    var tmp = el("span");
    tmp.innerHTML = coinsMarkup();
    return tmp.firstChild;
  }

  /* ── public: loaderEl — the three coins, standalone (always animating) ── */
  function loaderEl() {
    injectCSS();
    var wrap = el("div","bw-loader");
    wrap.appendChild(makeCoins());
    return wrap;
  }

  /* ── animated hexagram figure — geometry identical to glyphSVG (WYSIWYG) ── */
  function buildAnimFig(lines, o) {
    o = o||{};
    var size = o.size||80;
    var svg = document.createElementNS(NS,"svg");
    svg.setAttribute("class","bw-fig"+(o.relating?" bw-fig-relating":""));
    svg.setAttribute("viewBox","0 0 "+W+" "+H);
    svg.setAttribute("width",size);
    svg.setAttribute("height",(size*H/W).toFixed(1));
    svg.style.color = o.color||"currentColor";
    svg.style.overflow = "visible";

    var lineNames = ["First","Second","Third","Fourth","Fifth","Sixth"];
    var groups = [];
    for (var li = 0; li < N; li++) {
      var v = N-1-li;
      var y = PADY + v*(BAR+GAP);
      var g = document.createElementNS(NS,"g");
      g.setAttribute("class","bw-ln");
      g.setAttribute("data-line",li);
      var title = document.createElementNS(NS,"title");
      var ln = lines[li];
      title.textContent = lineNames[li]+" line · "+(ln.yang?"yang":"yin")+(ln.changing?" · moving":"");
      g.appendChild(title);
      /* hand-drawn bar paths — same brush as glyphSVG */
      if (ln.yang) {
        g.appendChild(mkBar(PADX,y,W-2*PADX,BAR));
      } else {
        var half = (W-2*PADX-10)/2;
        g.appendChild(mkBar(PADX,y,half,BAR));
        g.appendChild(mkBar(W-PADX-half,y,half,BAR));
      }
      if (ln.changing) {
        var dot = document.createElementNS(NS,"circle");
        dot.setAttribute("cx",W/2); dot.setAttribute("cy",y+BAR/2); dot.setAttribute("r",2.7);
        dot.setAttribute("fill","none");
        dot.setAttribute("stroke",o.changeColor||"currentColor");
        dot.setAttribute("stroke-width",1.4);
        g.appendChild(dot);
      }
      svg.appendChild(g);
      groups[li] = g;
    }
    return {
      el: svg,
      revealLine: function(i){ if(groups[i]) groups[i].classList.add("in"); },
      revealAll: function(lit){
        groups.forEach(function(g){ g.classList.add("shown"); });
        if(lit) requestAnimationFrame(function(){ svg.classList.add("lit"); });
      }
    };
  }
  /* hand-drawn bar — gentle S-wave edges echoing the BourneWise logomark strokes */
  function mkBar(x,y,w,h){
    var p = document.createElementNS(NS,"path");
    p.setAttribute("d",barPath(x,y,w,h));
    p.setAttribute("fill","currentColor");
    p.setAttribute("stroke","currentColor");
    p.setAttribute("stroke-width","0.5");
    p.setAttribute("stroke-linejoin","round");
    p.setAttribute("stroke-linecap","round");
    return p;
  }
  function mkRect(x,y,w,h){ return mkBar(x,y,w,h); } /* alias for compat */
  /* shared wave geometry: top & bottom edges flow as a soft S, like the mark's brush waves */
  function barPath(x,y,w,h){
    var x2=x+w, y2=y+h, t=w/3, a=1.4;
    return "M "+x.toFixed(1)+" "+y.toFixed(1)+
      " C "+(x+t).toFixed(1)+" "+(y-a).toFixed(1)+" "+(x+2*t).toFixed(1)+" "+(y+a).toFixed(1)+" "+x2.toFixed(1)+" "+y.toFixed(1)+
      " L "+x2.toFixed(1)+" "+y2.toFixed(1)+
      " C "+(x+2*t).toFixed(1)+" "+(y2+a).toFixed(1)+" "+(x+t).toFixed(1)+" "+(y2-a).toFixed(1)+" "+x.toFixed(1)+" "+y2.toFixed(1)+" Z";
  }
  /* same brush look for static glyphSVG */
  function barStr(x,y,w,h){
    return '<path d="'+barPath(x,y,w,h)+'" fill="currentColor" stroke="currentColor" '+
      'stroke-width="0.5" stroke-linejoin="round" stroke-linecap="round"></path>';
  }

  /* ── mouse tilt (disabled — no viewpoint-following on the figures) ── */
  function attachTilt(wrap, reduced) { return; }

  /* ── build fig-wrap column — DOM matches pairHTML for seamless WYSIWYG handoff ── */
  function buildHexWrap(lines, figOpts, reduced) {
    figOpts = figOpts || {};
    var wrap = el("span","bw-fig-wrap");
    var lower = trigramOf(lines,0), upper = trigramOf(lines,3);

    var tagUpper = el("span","bw-tri-tag");
    tagUpper.innerHTML = triLbl(upper);
    var tagLower = el("span","bw-tri-tag");
    tagLower.innerHTML = triLbl(lower);

    var primary = buildAnimFig(lines, figOpts);
    var glyph = el("span","bw-fig-glyph");
    glyph.appendChild(primary.el);

    var name = el("span","bw-fig-name"+(figOpts.relating?" relating":""));
    name.textContent = figOpts.name || "";

    wrap.appendChild(tagUpper);
    wrap.appendChild(glyph);
    wrap.appendChild(tagLower);
    wrap.appendChild(name);
    attachTilt(wrap, reduced);

    return {
      wrap: wrap,
      primary: primary,
      showTrigrams: function(){
        tagUpper.classList.add("vis");
        tagLower.classList.add("vis");
        name.classList.add("vis");
      }
    };
  }

  /* ── public: cast — the casting animation IS the annotated figure. The same
     figure that holds the reading draws itself in place (coins toss → ink bars
     appear line by line → trigrams/name → branches grow), so nothing is swapped
     and the board never jumps position. ── */
  function cast(container, spec, opts) {
    injectCSS();
    opts = opts||{};
    var reduced = opts.reduced!=null ? opts.reduced
      : window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var sortis = spec.method==="sortis";
    var methodLabel = sortis?"Sortis 6":"Stria 64";

    /* render the FINAL annotated figure, in cast mode (lines + branches start hidden).
       The coin bar + method label live INSIDE the figure HTML and persist after. */
    container.innerHTML = annotatedFigureHTML(spec, { board: opts.board, cast: !reduced });
    var figEl = container.querySelector(".bw-af-fig");
    var svg = container.querySelector("svg.bw-af");
    var status = container.querySelector(".bw-cast-status");
    /* synchronous — measuring right after innerHTML forces layout once, BEFORE
       first paint, so the centering shift is never visible as a "refresh" */
    opticalCenter(container);

    /* reduced-motion: figure is already fully painted & static; nothing to animate */
    if (reduced || !svg) {
      if (status) status.textContent = "";
      return Promise.resolve();
    }

    var benLn = [].slice.call(svg.querySelectorAll('.bw-af-ln:not([data-bian])'))
      .sort(function(a,b){ return (+a.getAttribute("data-li")) - (+b.getAttribute("data-li")); }); /* bottom → top */
    var bianLn = [].slice.call(svg.querySelectorAll('.bw-af-ln[data-bian]'))
      .sort(function(a,b){ return (+a.getAttribute("data-li")) - (+b.getAttribute("data-li")); });
    var ordinals = ["First","Second","Third","Fourth","Fifth","Sixth"];

    return new Promise(function(resolve){
      /* ONE unbroken rhythm \u2014 no phases. All twelve strokes (primary six, then
         transformed six) land on the same steady 620ms heartbeat with zero
         pause between the figures, and the annotations begin blooming while
         the final strokes are still settling \u2014 a single continuous unfolding,
         never "part one, stop, part two". Each stroke's 950ms settle always
         finishes before its successor's midpoint, so nothing collides. */
      var PER = 620;
      var seq = benLn.concat(bianLn), k = 0;
      if (status) status.textContent = "Casting\u2026";
      setTimeout(step, 480);

      function step(){
        if (k >= seq.length){ finishCast(); return; }
        if (status) {
          status.textContent = k < benLn.length
            ? ordinals[k] + " line\u2026"
            : "Transforming\u2026";
        }
        seq[k].classList.add("in");
        k++;
        /* annotations start blooming two strokes before the end \u2014 the finish
           overlaps the last ink instead of waiting for it */
        if (k === seq.length - 1) beginBloom();
        setTimeout(step, PER);
      }
      var bloomed = false;
      function beginBloom(){
        /* stage 1: start the branch-label bloom (their keyframe animations fill
           forwards, overriding the data-cast hide) while the last strokes are
           still landing — data-cast stays ON so un-landed lines remain hidden */
        if (bloomed) return; bloomed = true;
        svg.setAttribute("data-anim","1");
      }
      function finishCast(){
        beginBloom();
        /* stage 2: the last stroke has landed — release the rest of the board
           (marks → names → currents follow on their own staggered transitions) */
        svg.removeAttribute("data-cast");
        if (figEl){ figEl.classList.remove("casting"); figEl.classList.add("bw-af-live"); }
        if (status) status.textContent = "";
        setTimeout(resolve, 1100);
      }
    });
  }

  function el(tag,cls){ var e=document.createElement(tag); if(cls) e.className=cls; return e; }

  /* ── optical centering: the drawn ink's left/right extents vary per cast
     (label text lengths differ), so a centered CONTAINER can still read as
     off-center. Measure the ink and zero the drift on the wrapper. ── */
  function opticalCenter(container){
    try{
      if(!container) return;
      var svg = container.querySelector('svg.bw-af'); if(!svg) return;
      var sr = svg.getBoundingClientRect(); if(!sr.width) return;
      var l = 1e9, r = -1e9;
      svg.querySelectorAll('path,text,circle').forEach(function(n){
        var b = n.getBoundingClientRect();
        if(b.width || b.height){ if(b.left < l) l = b.left; if(b.right > r) r = b.right; }
      });
      if(r <= l) return;
      var drift = (l + r) / 2 - (sr.left + sr.width / 2);
      if (Math.abs(drift) > .5) container.style.transform = 'translateX(' + (-drift).toFixed(1) + 'px)';
    }catch(e){}
  }

  /* ── CSS ── */
  var injected = false;
  function injectCSS(){
    if(injected) return; injected=true;
    var s = document.createElement("style");
    s.id = "bw-figure-css";
    s.textContent = [
      /* root */
      ".bw-cast{display:flex;flex-direction:column;gap:15px;margin-top:10px;font-family:var(--sans)}",
      /* Spinnaker, pinned — without this the header inherits the reading
         column's book serif */
      ".bw-cast-head{display:flex;align-items:center;gap:15px;font-family:var(--sans);font-size:12px;letter-spacing:.17em;text-transform:uppercase;white-space:nowrap}",
      ".bw-cast-method{color:var(--terracotta);font-weight:600}",
      ".bw-cast-status{color:var(--faint);font-size:11.5px;letter-spacing:.1em;font-variant-numeric:tabular-nums;transition:opacity .3s}",
      ".bw-cast-status:empty{display:none}",

      /* ── organic loader: three hollow hand-drawn rings (echoes the three-coin
         toss), each morphing + turning on its own independent phase so they
         read as three coins landing separately, not one mechanical spinner ── */
      ".bw-coins{display:inline-flex;align-items:center;gap:6px;color:var(--ink)}",
      ".bw-af-loader{display:block;flex:none;width:22px;height:22px;box-sizing:border-box;",
        "border:2.1px solid currentColor;border-radius:47% 53% 61% 39% / 44% 51% 49% 56%;",
        "animation:bwLoaderMorph 3.6s ease-in-out infinite,bwLoaderSpin 10s linear infinite}",
      ".bw-af-loader.b{animation-delay:-1.2s,-3.4s}",
      ".bw-af-loader.c{animation-delay:-2.4s,-6.8s}",
      "@keyframes bwLoaderMorph{",
        "0%,100%{border-radius:47% 53% 61% 39% / 44% 51% 49% 56%}",
        "20%{border-radius:58% 42% 38% 62% / 62% 44% 56% 38%}",
        "40%{border-radius:38% 62% 55% 45% / 40% 60% 40% 60%}",
        "60%{border-radius:63% 37% 44% 56% / 52% 48% 63% 37%}",
        "80%{border-radius:42% 58% 60% 40% / 48% 58% 42% 52%}",
      "}",
      "@keyframes bwLoaderSpin{to{transform:rotate(360deg)}}",

      /* Standalone loader */
      ".bw-loader{display:inline-flex;align-items:center;color:var(--ink)}",

      /* ── FIGURES ── */
      ".bw-figs{display:inline-flex;align-items:center;gap:18px}",
      ".bw-fig{display:block;overflow:visible}",
      ".bw-fig .bw-ln{opacity:0;transform:translateY(4px);cursor:default}",
      /* Line reveal: gentle float-in from below — classical, unhurried */
      ".bw-fig .bw-ln.in{animation:bwLineFloat .8s cubic-bezier(.22,.7,.28,1) forwards}",
      ".bw-fig .bw-ln.shown{opacity:1;transform:translateY(0);transition:transform .4s cubic-bezier(.22,.7,.28,1),filter .4s ease}",
      /* micro-interaction: the hovered line alone breathes — a hair of lift and
         a warm underglow. Nothing else dims, nothing jumps. */
      ".bw-fig .bw-ln.shown:hover{transform:translateY(-1px);filter:drop-shadow(0 2px 4px rgba(181,80,44,.2))}",
      "@keyframes bwLineFloat{",
        "0%{opacity:0;transform:translateY(4px)}",
        "30%{opacity:.6}",
        "70%{transform:translateY(-1px)}",
        "100%{opacity:1;transform:translateY(0)}",
      "}",
      ".bw-fig-relating{opacity:0;transition:opacity .7s ease}",
      ".bw-fig-relating.lit{opacity:1}",

      /* trigram labels */
      ".bw-tri-tag{display:flex;align-items:center;gap:8px;opacity:0;transform:translateY(4px);",
        "transition:opacity .45s ease,transform .45s ease;pointer-events:none}",
      ".bw-tri-tag.vis{opacity:1;transform:translateY(0)}",
      ".bw-tri-sym{font-size:21px;color:var(--terracotta);line-height:1}",
      ".bw-tri-en{font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--faint)}",
      ".bw-tri-tag-static{display:inline-flex;align-items:center;gap:8px;opacity:1;transform:none}",

      /* arrow + pair */
      ".bw-pair-arrow{display:flex;align-items:center;padding-bottom:18px}",
      ".bw-pair{display:inline-flex;align-items:center;gap:14px}",
      ".bw-fig-wrap{display:inline-flex;flex-direction:column;align-items:center;gap:5px;",
        "transform-style:preserve-3d;transition:transform .2s cubic-bezier(.18,.72,.28,1)}",
      ".bw-fig-glyph{display:block}",
      ".bw-fig-name{font-family:var(--sans);font-size:13px;color:var(--ink)}",
      ".bw-fig-name.relating{color:var(--prussian)}",

      /* ── INSIGHT: the hexagram read line by line ── */
      ".bw-insight{margin-top:26px;display:flex;flex-direction:column;gap:14px}",
      ".bw-ix-head{padding:0 2px}",
      ".bw-ix-tag{font-size:11px;letter-spacing:.09em;color:var(--faint)}",
      ".bw-ix-head .bw-ix-tag b{color:var(--terracotta);font-weight:400}",
      ".bw-zg{display:flex;gap:28px;align-items:center;padding:18px 24px;background:transparent;border:1px solid var(--line);border-radius:12px}",
      ".bw-zg-svg{flex:none;width:330px;height:auto;overflow:visible}",
      ".bw-zg-el{font-family:var(--sans);font-weight:600;font-size:13.5px;dominant-baseline:middle}",
      ".bw-zg-role{font-family:var(--sans);font-weight:500;font-size:11px;fill:var(--faint);letter-spacing:.02em}",
      ".bw-zg-mk{font-size:10px;letter-spacing:.05em;text-anchor:end;dominant-baseline:middle;font-family:var(--sans);font-weight:600}",
      ".bw-zg-mk.self{fill:var(--terracotta)}",
      ".bw-zg-mk.resp{fill:var(--prussian)}",
      ".bw-zg-arrow{fill:none;stroke-width:2;opacity:.34}",
      ".bw-zg-flow{fill:none;stroke-linecap:round;opacity:0}",
      ".bw-zg-move{transform-box:fill-box;transform-origin:center}",
      ".bw-zg-row{opacity:1}",
      ".bw-zg-side{flex:1;min-width:0}",
      ".bw-zg-note{font-family:var(--sans);font-size:15px;color:var(--ink);line-height:1.6;text-wrap:pretty}",
      ".bw-zg-legend{display:flex;flex-direction:column;gap:6px;margin-top:15px;font-size:11px;letter-spacing:.03em;color:var(--faint)}",
      ".bw-zg-legend span{display:inline-flex;align-items:center;gap:9px}",
      ".bw-zg-legend i{flex:none;width:14px;height:0;border-top:2px solid var(--line);display:inline-block}",
      ".bw-zg-legend i.d-self{height:8px;width:8px;border:0;border-radius:50%;background:var(--terracotta)}",
      ".bw-zg-legend i.d-resp{height:8px;width:8px;border:0;border-radius:50%;background:var(--prussian)}",
      ".bw-zg-legend i.d-move{height:9px;width:9px;border:1.6px solid var(--terracotta);border-radius:50%;background:var(--paper-raised)}",
      ".bw-zg-legend i.d-gen{border-top:2px solid var(--terracotta)}",
      ".bw-zg-legend i.d-ctrl{border-top:2px solid var(--prussian)}",
      "@media (max-width:600px){.bw-zg{flex-direction:column;align-items:stretch;gap:16px}.bw-zg-svg{width:100%}}",

      /* ── annotated casting figure: the per-line reading grown off the ink figure ── */
      ".bw-af-fig{margin:0;display:flex;flex-direction:column;align-items:flex-start;gap:13px;max-width:100%;font-family:var(--sans)}",
      ".bw-af{display:block;width:100%;height:auto;overflow:visible}",
      /* SVG text at fractional scale renders fuzzy with default hinting — force
         geometric precision so micro labels stay crisp at any board width */
      ".bw-af text{text-rendering:geometricPrecision}",
      ".bw-af-el{font-family:var(--sans);font-size:11px;font-weight:600;fill:var(--ink)}",
      ".bw-af-role{font-family:var(--sans);font-size:9px;font-weight:500;fill:var(--faint);letter-spacing:.02em}",
      ".bw-af-bel{font-family:var(--sans);font-size:10.5px;font-weight:600;fill:var(--dim)}",
      ".bw-af-mk{font-family:var(--sans);font-size:9px;font-weight:700;letter-spacing:.05em;text-transform:uppercase}",
      ".bw-af-mk.self{fill:var(--terracotta)}",".bw-af-mk.resp{fill:var(--prussian)}",
      ".bw-af-tri-sym{font-size:15px;fill:var(--terracotta)}",
      ".bw-af-tri-en{font-family:var(--sans);font-size:8.5px;letter-spacing:.12em;fill:var(--faint)}",
      ".bw-af-name{font-family:var(--sans);font-size:14px;font-weight:600;fill:var(--ink)}",".bw-af-name.rel{fill:var(--prussian)}",
      ".bw-af-arrow{fill:none;stroke-width:1.5;opacity:.5;stroke-linecap:round}",
      ".bw-af-tarrow{fill:none;stroke:var(--ghost);stroke-width:.9;stroke-linecap:round;stroke-linejoin:round;opacity:.85}",
      ".bw-af-branch{opacity:1}",
      ".bw-af-legend{display:flex;flex-direction:column;align-items:flex-start;gap:4px;font-family:var(--sans);font-size:10px;letter-spacing:.02em;color:var(--faint);padding-top:8px;border-top:1px solid var(--line-soft);width:100%}",
      ".bw-af-legend span{display:inline-flex;align-items:center;gap:7px;white-space:nowrap}",
      ".bw-af-legend i{flex:none;width:13px;height:0;border-top:2px solid var(--line)}",
      ".bw-af-legend i.d-self{height:8px;width:8px;border:0;border-radius:50%;background:var(--terracotta)}",
      ".bw-af-legend i.d-resp{height:8px;width:8px;border:0;border-radius:50%;background:var(--prussian)}",
      ".bw-af-legend i.d-move{height:9px;width:9px;border:1.6px solid var(--terracotta);border-radius:50%;background:var(--paper-raised)}",
      ".bw-af-legend i.d-gen{border-top:2px solid var(--terracotta)}",
      ".bw-af-legend i.d-ctrl{border-top:2px solid var(--prussian)}",
      "@media (prefers-reduced-motion:no-preference){",
        ".bw-af[data-anim] .bw-af-branch{opacity:0;transform:translate(var(--fx,6px),0);animation:bwAfGrow .55s cubic-bezier(.22,.7,.28,1) forwards;animation-delay:var(--d,0s)}",
        ".bw-af[data-anim] .bw-af-arrow{stroke-dasharray:var(--len,140);stroke-dashoffset:var(--len,140);animation:bwAfDraw .7s .9s ease forwards}",
      "}",
      "@keyframes bwAfGrow{to{opacity:1;transform:none}}",
      "@keyframes bwAfDraw{to{stroke-dashoffset:0}}",
      /* premium per-label reveal — five styles rotate across the figure's text */
      "@media (prefers-reduced-motion:no-preference){",
        ".bw-af[data-anim] .bw-aft{transform-box:fill-box;transform-origin:center;animation-duration:.85s;animation-fill-mode:both;animation-timing-function:cubic-bezier(.22,.7,.28,1);animation-delay:var(--d,0s)}",
        ".bw-af[data-anim] .bw-aft-0{animation-name:bwAftBlur}",
        ".bw-af[data-anim] .bw-aft-1{animation-name:bwAftRise}",
        ".bw-af[data-anim] .bw-aft-2{animation-name:bwAftSlide}",
        ".bw-af[data-anim] .bw-aft-3{animation-name:bwAftBleed}",
        ".bw-af[data-anim] .bw-aft-4{animation-name:bwAftScale}",
      "}",
      "@keyframes bwAftBlur{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}",
      "@keyframes bwAftRise{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}",
      "@keyframes bwAftSlide{from{opacity:0;transform:translateX(6px)}to{opacity:1;transform:translateX(0)}}",
      "@keyframes bwAftBleed{from{opacity:0;transform:translateX(-6px)}to{opacity:1;transform:translateX(0)}}",
      "@keyframes bwAftScale{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:scale(1)}}",
      /* ── casting IN PLACE: the annotated figure draws itself line by line, then
         the branches grow & the whole board comes alive — same element, no swap ── */
      ".bw-af-bar{display:flex;align-items:center;gap:13px;margin-bottom:13px;font-size:13px;letter-spacing:.13em;text-transform:uppercase;white-space:nowrap}",
      ".bw-af-bar .bw-coins{flex:none}",
      ".bw-af-bar .bw-cast-method{color:var(--terracotta);font-weight:600}",
      ".bw-af-bar .bw-cast-status{color:var(--faint);font-size:11.5px;letter-spacing:.1em;font-variant-numeric:tabular-nums;transition:opacity .3s}",
      ".bw-af-bar .bw-cast-status:empty{display:none}",
      /* the moment, as a compact inline row joined by organic ink dots */
      ".bw-af-moment{display:flex;flex-wrap:wrap;align-items:center;justify-content:flex-start;gap:6px 9px;margin-bottom:6px;font-family:var(--sans)}",
      ".bw-af-moment .bw-af-dot{flex:none;opacity:.85}",
      ".bw-af-mt-date{font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--ghost);font-weight:600}",
      ".bw-af-mt{display:inline-flex;align-items:baseline;gap:5px;white-space:nowrap}",
      ".bw-af-mt i{font-style:normal;font-size:8px;letter-spacing:.1em;text-transform:uppercase;color:var(--ghost)}",
      ".bw-af-mt b{font-family:var(--sans);font-size:12px;font-weight:600;color:var(--ink)}",
      ".bw-af-mt.hot b{color:var(--terracotta)}",
      ".bw-af-mt.vd b{font-size:11px;color:var(--prussian)}",
      /* moving-line marks ○/✕ (brush strokes, right of the bar) + the flowing sheng-ke ties */
      ".bw-af-mark{fill:none;stroke-linecap:round}",
      ".bw-af-flowbase{fill:none;stroke-width:1.3;opacity:.26}",
      ".bw-af-flow{fill:none;stroke-width:2.2;stroke-linecap:round}",
      ".bw-af-fig.casting .bw-af-moment{opacity:0;transition:opacity .5s ease}",
      ".bw-af[data-cast] .bw-af-ln{opacity:0}",
      /* a stroke of ink settling: drifts up from below through a slight blur,
         overshoots a hair, then rests — 950ms, always finished before the next
         line begins (620ms cadence + the animation's long soft tail) */
      ".bw-af[data-cast] .bw-af-ln.in{opacity:1;animation:bwAfRow .95s cubic-bezier(.2,.65,.25,1) both}",
      ".bw-af[data-cast] .bw-af-branch,.bw-af[data-cast] .bw-af-arrow,.bw-af[data-cast] .bw-af-tarrow,.bw-af[data-cast] .bw-af-flow,.bw-af[data-cast] .bw-af-flowbase,.bw-af[data-cast] .bw-af-mark,.bw-af[data-cast] .bw-af-markbg{opacity:0}",
      ".bw-af[data-cast] .bw-af-tri-sym,.bw-af[data-cast] .bw-af-tri-en,.bw-af[data-cast] .bw-af-name{opacity:0}",
      /* the finish is a layered bloom, not a dump: annotations arrive in waves —
         branches → moving marks → trigrams/names → sheng-ke currents */
      ".bw-af .bw-af-branch{transition:opacity .6s ease}",
      ".bw-af .bw-af-mark,.bw-af .bw-af-markbg{transition:opacity .6s ease .25s}",
      ".bw-af .bw-af-tri-sym,.bw-af .bw-af-tri-en,.bw-af .bw-af-name{transition:opacity .7s ease .5s}",
      ".bw-af .bw-af-flow,.bw-af .bw-af-flowbase,.bw-af .bw-af-tarrow{transition:opacity .8s ease .85s}",
      /* opacity+transform ONLY — an animated filter:blur on SVG forces a full
         re-raster every frame and was the frame-skip ("跳帧") source */
      "@keyframes bwAfRow{0%{opacity:0;transform:translateY(9px)}55%{opacity:1}78%{transform:translateY(-.6px)}100%{opacity:1;transform:none}}",
      /* ── the living board: everything loops gently & in step ── */
      "@media (prefers-reduced-motion:no-preference){",
        /* each ink line undulates on a slow, irregular ocean swell — per-line
           non-harmonic periods (--wd) + offset phases (--bd) drift in and out of
           sync so the figure never bobs in unison */
        ".bw-af-live .bw-af-ln{animation:bwAfSwell var(--wd,7s) linear infinite;animation-delay:var(--bd,0s)}",
        /* moving-line marks pulse */
        ".bw-af-live .bw-af-mark{transform-box:fill-box;transform-origin:center;animation:bwAfMark 2.4s ease-in-out infinite}",
        ".bw-af-live .bw-af-markbg{transform-box:fill-box;transform-origin:center;animation:bwAfMark 2.4s ease-in-out infinite}",
        /* sheng-ke ties: a marching dashed current — solid-feel base + flowing dashes */
        ".bw-af-live .bw-af-flow{stroke-dasharray:2 9;animation:bwAfFlow 1s linear infinite;animation-delay:calc(var(--fi,0)*.25s)}",
        ".bw-af-live .bw-af-flow.gen{stroke-dasharray:2 8;stroke-width:2.6;animation-duration:.8s}",
        ".bw-af-live .bw-af-flow.ctrl{stroke-dasharray:6 6;stroke-width:2.2;animation-duration:1.25s}",
        ".bw-af-live .bw-af-flow.gen-rev{stroke-dasharray:2 9;stroke-width:1.9;opacity:.78;animation-name:bwAfFlowBack;animation-duration:1.7s}",
        ".bw-af-live .bw-af-flow.ctrl-rev{stroke-dasharray:6 6;stroke-width:1.9;opacity:.78;animation-name:bwAfFlowBack;animation-duration:1.9s}",
        ".bw-af-live .bw-af-flow.peer{stroke-dasharray:2 8;stroke-width:2;opacity:.7;animation-duration:2.1s}",
      "}",
      "@keyframes bwAfSwell{0%{transform:translateY(0)}6.25%{transform:translateY(-.84px)}12.5%{transform:translateY(-1.56px)}18.75%{transform:translateY(-2.03px)}25%{transform:translateY(-2.2px)}31.25%{transform:translateY(-2.03px)}37.5%{transform:translateY(-1.56px)}43.75%{transform:translateY(-.84px)}50%{transform:translateY(0)}56.25%{transform:translateY(.84px)}62.5%{transform:translateY(1.56px)}68.75%{transform:translateY(2.03px)}75%{transform:translateY(2.2px)}81.25%{transform:translateY(2.03px)}87.5%{transform:translateY(1.56px)}93.75%{transform:translateY(.84px)}100%{transform:translateY(0)}}",
      "@keyframes bwAfMark{0%,100%{transform:scale(1)}50%{transform:scale(1.22)}}",
      "@keyframes bwAfFlow{to{stroke-dashoffset:-11}}",
      "@keyframes bwAfFlowBack{to{stroke-dashoffset:11}}",
      /* full board: header + dense per-line branches (Sortis tier) */
      ".bw-af-head{display:flex;flex-wrap:wrap;align-items:baseline;gap:6px 12px;font-family:var(--sans);font-size:11px;color:var(--dim);padding-bottom:9px;margin-bottom:2px;border-bottom:1px solid var(--line-soft)}",
      ".bw-af-tag{font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--ghost)}",
      ".bw-af-gzp{color:var(--dim)}",".bw-af-gzp b{font-family:var(--sans);font-size:12.5px;color:var(--ink);font-weight:600}",
      ".bw-af-gzp.hot b{color:var(--terracotta)}",
      ".bw-af-void{margin-left:auto;color:var(--dim)}",".bw-af-void b{font-family:var(--sans);color:var(--prussian)}",
      ".bw-af-rel{font-family:var(--sans);font-size:10.5px;font-weight:600;fill:var(--ink)}",
      ".bw-af-gz{font-family:var(--sans);font-size:9px;fill:var(--ink)}",
      ".bw-af-fel{font-family:var(--sans);font-size:9px;fill:var(--faint)}",
      ".bw-af-sp{font-family:var(--sans);font-size:9px;fill:var(--dim)}",
      ".bw-af-hid{font-family:var(--sans);font-size:8.5px;fill:var(--faint);font-style:italic}",
      ".bw-af-ss{font-family:var(--sans);font-size:8.5px;letter-spacing:.02em;fill:var(--prussian)}",
      ".bw-af-flag{font-family:var(--sans);font-size:8.5px;letter-spacing:.04em;text-transform:uppercase;fill:var(--prussian)}",
      ".bw-af-tt{font-family:var(--sans);font-size:8.5px}",
      ".bw-af-brel{font-family:var(--sans);font-size:10px;font-weight:600;fill:var(--prussian)}",".bw-af-brel.hot{fill:var(--terracotta)}",
      ".bw-af-full .bw-af-legend{margin-top:2px}",
      "@media (prefers-reduced-motion:no-preference){",
        /* lines float in bottom\u2192top, same brush as the casting figure */
        ".bw-zg-row{opacity:0;transform:translateY(5px);transform-box:fill-box;animation:bwZgRow .7s cubic-bezier(.22,.7,.28,1) forwards;animation-delay:var(--d,0s)}",
        /* the moving line breathes slowly */
        ".bw-zg-move{animation:bwZgPulse 2.6s ease-in-out infinite;animation-delay:.9s}",
        /* the sheng-ke guide draws itself once, after the lines settle */
        ".bw-zg-arrow{stroke-dasharray:var(--bw-zg-len);stroke-dashoffset:var(--bw-zg-len);animation:bwZgDraw .9s calc(.85s + var(--bw-zg-i,0)*.3s) ease forwards}",
        /* then a flowing current runs along it \u2014 line-style + speed encode the tie & its strength */
        ".bw-zg-flow{opacity:1;animation:bwZgFlowFwd 1s linear infinite;animation-delay:calc(1.15s + var(--bw-zg-i,0)*.3s)}",
        ".bw-zg-flow.gen{stroke-dasharray:1.6 8.4;stroke-width:2.8;animation-duration:.85s}",          /* feeds you \u2014 fast bright stream */
        ".bw-zg-flow.ctrl{stroke-dasharray:5 5;stroke-width:2.4;animation-duration:1.2s}",             /* checks you \u2014 firm pressure pulses */
        ".bw-zg-flow.gen-rev{stroke-dasharray:1.6 8.4;stroke-width:1.9;opacity:.7;animation-name:bwZgFlowBack;animation-duration:1.8s}",  /* you feed it \u2014 slow drain outward */
        ".bw-zg-flow.ctrl-rev{stroke-dasharray:5 5;stroke-width:1.9;opacity:.7;animation-name:bwZgFlowBack;animation-duration:1.9s}",     /* you check it \u2014 slow hold outward */
        ".bw-zg-flow.peer{stroke-dasharray:2 8;stroke-width:2;opacity:.6;animation-duration:2.2s}",    /* shared element \u2014 gentle even drift */
      "}",
      "@keyframes bwZgRow{to{opacity:1;transform:translateY(0)}}",
      "@keyframes bwZgDraw{to{stroke-dashoffset:0}}",
      "@keyframes bwZgFlowFwd{to{stroke-dashoffset:-10}}",
      "@keyframes bwZgFlowBack{to{stroke-dashoffset:10}}",
      "@keyframes bwZgPulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.55);opacity:.5}}",
      /* settle fallback: once added, the figure is guaranteed visible even if the
         entrance animation was interrupted (background tab, capture, print) */
      ".bw-zg-svg.settled .bw-zg-row{animation:none;opacity:1;transform:none}",

      /* reduced motion */
      "@media (prefers-reduced-motion:reduce){",
        ".bw-af-loader{animation:none!important}",
        ".bw-fig .bw-ln.in{animation:none;opacity:1;transform:none}",
      "}"
    ].join("");
    document.head.appendChild(s);
  }

  /* ── per-line elements (najia), palace, relatives & relationships ── */
  function patternOf(lines) { var b = 0; for (var i = 0; i < 6; i++) if (lines[i].yang) b |= (1 << i); return b; }
  function lineElements(lines) {
    var lo = 0, up = 0;
    for (var i = 0; i < 3; i++) { if (lines[i].yang) lo |= (1 << i); if (lines[i + 3].yang) up |= (1 << i); }
    return [ NAJIA_INNER[lo][0], NAJIA_INNER[lo][1], NAJIA_INNER[lo][2],
             NAJIA_OUTER[up][0], NAJIA_OUTER[up][1], NAJIA_OUTER[up][2] ];
  }
  /* a line's standing relative to your position (Self): the relative encodes its sheng-ke tie */
  function relativeRole(lineGi, selfGi) {
    if (lineGi === selfGi) return "Peer";
    if ((lineGi + 1) % 5 === selfGi) return "Resource";   /* line generates you */
    if ((selfGi + 1) % 5 === lineGi) return "Output";      /* you generate line */
    if ((selfGi + 2) % 5 === lineGi) return "Wealth";      /* you control line */
    return "Pressure";                                     /* line controls you */
  }
  /* directional element relationship a -> b (how a acts on b) */
  function elRel(a, b) {
    if (a === b) return { kind:"peer", color:ELEMENTS[a].color };
    if ((a + 1) % 5 === b) return { kind:"gen", color:"var(--terracotta)" };
    if ((b + 1) % 5 === a) return { kind:"gen-rev", color:"var(--terracotta)" };
    if ((a + 2) % 5 === b) return { kind:"ctrl", color:"var(--prussian)" };
    return { kind:"ctrl-rev", color:"var(--prussian)" };
  }
  function relNote(rel, moving) {
    var M = {
      "gen":      "The moving line feeds your position \u2014 the shift underway is pouring strength into where you stand. Lean into it; momentum is on your side.",
      "gen-rev":  "Your position feeds the moving line \u2014 you are the one powering this shift. Nothing moves on its own here, and it keeps costing you to drive it.",
      "ctrl":     "The moving line checks your position \u2014 the shift underway bears straight down on where you stand. Shore up your footing before you commit.",
      "ctrl-rev": "Your position checks the moving line \u2014 you hold the brake on this shift. It waits on your decision, not the other way round.",
      "peer":     "The moving line shares your element \u2014 this shift is an extension of your own position, not an outside force. Read it as your own momentum."
    };
    var R = {
      "gen":      "The other side of the figure feeds your position \u2014 circumstances are quietly working in your favour. Receive what's offered before you spend.",
      "gen-rev":  "Your position feeds the other side \u2014 you are carrying this, and the return is slow. Watch what it is costing you to hold it up.",
      "ctrl":     "The other side checks your position \u2014 outside pressure is set against where you stand. Hold the line; forcing it uphill only spends you.",
      "ctrl-rev": "Your position checks the other side \u2014 the leverage here is yours. Move deliberately and the rest gives way.",
      "peer":     "Both sides of the figure share your element \u2014 the matter is evenly matched and self-reinforcing. The tie breaks only by your move."
    };
    return (moving ? M : R)[rel.kind];
  }

  /* ── public: insightHTML — the hexagram read line by line ──
     Each line carries its five-element (najia) and how it stands to your position
     (Self). Self / Response / moving lines are marked, and the generating/controlling tie between the
     moving line and your position is drawn as a directional arrow on the figure. */
  var LINE_POS = ["First (bottom)", "Second", "Third", "Fourth", "Fifth", "Sixth (top)"];

  /* ── core: lineFigure — compute everything about the figure read line by line,
     and return BOTH the standalone figure SVG (floatable inside prose) and the
     structured per-line data so callers can weave it into running text. ── */
  function lineFigure(spec) {
    injectCSS();
    if (!spec || !spec.lines) return null;
    var lines = spec.lines;
    var els = lineElements(lines);
    var pinfo = PALACE[patternOf(lines)] || { palaceGi: trigramOf(lines, 0).gi, world: 6 };
    var selfGi = pinfo.palaceGi, world = pinfo.world;
    var selfLi = world - 1;
    var respWorld = world <= 3 ? world + 3 : world - 3;
    var respLi = respWorld - 1;
    var moving = (spec.changeIdx || []).slice();

    var VW = 326, rowH = 33, top = 12, VH = top * 2 + 6 * rowH;
    var gx = 22, barX = 40, barW = 104, labX = 158, rightX = VW - 8;
    function cy(li) { return top + (5 - li) * rowH + rowH / 2; }

    var srcLi = moving.length ? moving[0] : respLi;
    var rel = (srcLi !== selfLi) ? elRel(els[srcLi], els[selfLi]) : null;
    var arrowColor = rel ? rel.color : "var(--faint)";

    /* per-line structured data, bottom (0) → top (5) */
    var data = [];
    for (var d = 0; d < 6; d++) {
      var gid = els[d];
      data.push({
        idx: d, pos: LINE_POS[d], yang: lines[d].yang,
        el: ELEMENTS[gid].en, elColor: ELEMENTS[gid].color,
        role: relativeRole(gid, selfGi),
        marker: d === selfLi ? "Self" : (d === respLi ? "Response" : ""),
        moving: moving.indexOf(d) >= 0
      });
    }

    var body = "";
    for (var li = 5; li >= 0; li--) {
      var gi = els[li], col = ELEMENTS[gi].color, yc = cy(li), yang = lines[li].yang;
      var barY = yc - 4;
      var row = '<g class="bw-zg-row" style="--d:' + (li * 0.085).toFixed(3) + 's">';
      if (yang) {
        row += '<rect x="' + barX + '" y="' + barY + '" width="' + barW + '" height="8" rx="2.5" fill="' + col + '"></rect>';
      } else {
        var half = (barW - 14) / 2;
        row += '<rect x="' + barX + '" y="' + barY + '" width="' + half + '" height="8" rx="2.5" fill="' + col + '"></rect>';
        row += '<rect x="' + (barX + barW - half) + '" y="' + barY + '" width="' + half + '" height="8" rx="2.5" fill="' + col + '"></rect>';
      }
      if (moving.indexOf(li) >= 0)
        row += '<circle class="bw-zg-move" cx="' + (barX + barW / 2) + '" cy="' + yc + '" r="4.6" fill="var(--paper-raised)" stroke="var(--terracotta)" stroke-width="1.6"></circle>';
      row += '<text x="' + labX + '" y="' + yc + '" class="bw-zg-el" fill="' + col + '">' + ELEMENTS[gi].en +
        '<tspan class="bw-zg-role" dx="7">' + relativeRole(gi, selfGi) + '</tspan></text>';
      var mk = li === selfLi ? "Self" : (li === respLi ? "Response" : "");
      if (mk) row += '<text x="' + rightX + '" y="' + yc + '" class="bw-zg-mk ' + (li === selfLi ? "self" : "resp") + '">' + mk + '</text>';
      body += row + '</g>';
    }

    /* one tie-arrow per moving line — Sortis only. A still figure (Stria) draws no
       flow arrow at all: it is the figure as it stands, nothing in motion. */
    var srcLines = moving.length ? moving.slice() : [];
    var arrow = "", markers = "";
    srcLines.forEach(function (s, i) {
      if (s === selfLi) return;
      var r = elRel(els[s], els[selfLi]), col = r.color;
      var y1 = cy(s), y2raw = cy(selfLi), mid = (y1 + y2raw) / 2;
      var y2 = y2raw + (y1 > y2raw ? 6 : -6); // stand off the target line
      var bow = gx - 13 - i * 7, len = Math.abs(y2 - y1) + 80;
      var dpath = 'M ' + gx + ' ' + y1 + ' Q ' + bow + ' ' + mid + ' ' + gx + ' ' + y2;
      var mid2 = 'bwZgArr' + i;
      markers += '<marker id="' + mid2 + '" viewBox="0 0 12 12" refX="7.6" refY="6" markerWidth="5" markerHeight="5" orient="auto-start-reverse">' +
        '<path d="M4 3.2 L8.4 6 L4 8.8" fill="none" stroke="' + col + '" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"></path></marker>';
      arrow += '<path d="' + dpath + '" class="bw-zg-arrow" stroke="' + col + '" marker-end="url(#' + mid2 + ')" style="--bw-zg-len:' + len + ';--bw-zg-i:' + i + '"></path>' +
        '<path d="' + dpath + '" class="bw-zg-flow ' + r.kind + '" stroke="' + col + '" style="--bw-zg-i:' + i + '"></path>';
    });
    var defs = '<defs>' + markers + '</defs>';

    var note = rel ? relNote(rel, moving.length > 0)
      : "The moving line falls on your own position \u2014 the change here is yours to make, not one happening to you.";

    var svg = '<svg viewBox="0 0 ' + VW + ' ' + VH + '" class="bw-zg-svg" aria-hidden="true">' + defs + arrow + body + '</svg>';

    return {
      svg: svg, lines: data, note: note,
      selfLi: selfLi, respLi: respLi, moving: moving, rel: rel
    };
  }

  /* legend chips, reused by the embedded layout */
  function legendHTML() {
    return '<div class="bw-zg-legend">' +
      '<span><i class="d-self"></i>Self \u2014 where you stand</span>' +
      '<span><i class="d-resp"></i>Response \u2014 the other side</span>' +
      '<span><i class="d-move"></i>Moving line \u2014 what is turning</span>' +
      '<span><i class="d-gen"></i>feeds &middot; generating</span>' +
      '<span><i class="d-ctrl"></i>checks &middot; controlling</span>' +
    '</div>';
  }

  /* romanization for the full board (English-only UI) */
  var STEM_PY = ["Jia","Yi","Bing","Ding","Wu","Ji","Geng","Xin","Ren","Gui"];
  var BR_PY   = ["Zi","Chou","Yin","Mao","Chen","Si","Wu","Wei","Shen","You","Xu","Hai"];
  var SPIRIT_PY = { "\u9752\u9f99":"Qinglong","\u6731\u96c0":"Zhuque","\u52fe\u9648":"Gouchen","\u87a3\u86c7":"Tengshe","\u767d\u864e":"Baihu","\u7384\u6b66":"Xuanwu" };
  var REL_PY = { parent:"Fumu", peer:"Xiongdi", output:"Zisun", wealth:"Qicai", officer:"Guangui" };
  var EN_GI = { Wood:0, Fire:1, Earth:2, Metal:3, Water:4 };

  /* ── each yao's skeleton is a soft brush stroke that breathes on a gentle, slightly
     irregular swell — a single low-frequency wave (no twist), close to the original
     ink-bar edge, morphed through phase frames so it flows smoothly ── */
  function afSineD(x0, yc, W, amp, periods, phase) {
    var n = 30, d = "M", x, y, t, i;
    for (i = 0; i <= n; i++) {
      t = i / n; x = x0 + t * W;
      /* one soft wave + a very small second harmonic for an organic, non-mechanical edge */
      y = yc + amp * Math.sin(2 * Math.PI * periods * t + phase)
            + amp * 0.16 * Math.sin(2 * Math.PI * periods * 2.0 * t + phase * 0.7);
      d += (i ? "L" : "") + x.toFixed(1) + " " + y.toFixed(1) + (i < n ? " " : "");
    }
    return d;
  }
  function afWave(x0, yc, W, col, dur, phase, flow) {
    var amp = 1.5;
    var d0 = afSineD(x0, yc, W, amp, 1.0, phase);
    var p = '<path d="' + d0 + '" fill="none" stroke="' + col + '" stroke-width="8.6" stroke-linecap="round" stroke-linejoin="round">';
    if (flow) {
      var frames = 30, vals = [], f;
      for (f = 0; f <= frames; f++) vals.push(afSineD(x0, yc, W, amp, 1.0, phase + 2 * Math.PI * (f / frames)));
      p += '<animate attributeName="d" dur="' + dur + 's" repeatCount="indefinite" calcMode="spline" keyTimes="' + vals.map(function(_,j){return (j/frames).toFixed(3);}).join(";") + '" keySplines="' + vals.slice(1).map(function(){return ".42 0 .58 1";}).join(";") + '" values="' + vals.join(";") + '"></animate>';
    }
    return p + '</path>';
  }
  /* one yao: yang = a single wave; yin = two waves with the centre gap */
  function afInk(x0, yc, W, yang, col, dur, phase, flow) {
    if (yang) return afWave(x0, yc, W, col, dur, phase, flow);
    var half = (W - 12) / 2;
    return afWave(x0, yc, half, col, dur, phase, flow) +
           afWave(x0 + W - half, yc, half, col, dur, phase + 1.2, flow);
  }

  /* ── public: annotatedFigureHTML — the casting figure itself, with the per-line
     reading GROWN OFF IT as branches (element · role left of the primary, World/Resp
     at the bar, moving→Self sheng-ke arrows on the figure). Three colours only —
     ink (primary), prussian (relating + checks), terracotta (moving + feeds). The
     bian figure stays a quiet result column (element names only). Nothing of this
     lives in the prose below; it all hangs on the figure. ── */
  function annotatedFigureHTML(spec, opts) {
    injectCSS();
    if (!spec || !spec.lines) return "";
    opts = opts || {};
    if (opts.board) return fullBoardFigureHTML(opts.board, spec, opts);
    var lines = spec.lines;
    var els = lineElements(lines);
    var pinfo = PALACE[patternOf(lines)] || { palaceGi: trigramOf(lines, 0).gi, world: 6 };
    var selfGi = pinfo.palaceGi, world = pinfo.world, selfLi = world - 1;
    var respWorld = world <= 3 ? world + 3 : world - 3, respLi = respWorld - 1;
    var moving = (spec.changeIdx || []).slice();
    var hasBian = !!spec.transformedLines;
    var els2 = hasBian ? lineElements(spec.transformedLines) : null;
    var flow = !(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

    var TOP = 54, STEP = 23, BARW = 62;
    function cy(li) { return TOP + (5 - li) * STEP; }
    var benX = 98, benR = benX + BARW, benTextX = 84, benLeadX = 88;
    var tieX = 164, tiePeak = 180, benMkX = 188;
    var VW = hasBian ? 426 : 236, VH = 232;
    var bianX = 270, bianR = bianX + BARW, bianLeadX = bianR + 4, bianTextX = bianR + 10;
    var benCx = benX + BARW / 2, bianCx = bianX + BARW / 2;

    function brush(x, y, w, h, col) {
      return '<path d="' + barPath(x, y, w, h) + '" fill="' + col + '" stroke="' + col +
        '" stroke-width="0.5" stroke-linejoin="round" stroke-linecap="round"></path>';
    }
    function inkRow(x, yc, yang, col) {
      var h = 9, y = yc - h / 2, w = BARW;
      if (yang) return brush(x, y, w, h, col);
      var half = (w - 12) / 2;
      return brush(x, y, half, h, col) + brush(x + w - half, y, half, h, col);
    }
    function triTag(cx, tri, symY) {
      return '<text class="bw-af-tri-sym" x="' + cx + '" y="' + symY + '" text-anchor="middle">' + tri.sym + '</text>' +
        '<text class="bw-af-tri-en" x="' + cx + '" y="' + (symY + 11) + '" text-anchor="middle">' + esc(tri.en) + '</text>';
    }

    /* primary column: bars · moving rings · branches (element · role) · World/Resp */
    var ben = "", branch = "";
    for (var li = 5; li >= 0; li--) {
      var yc = cy(li), d = ((5 - li) * 0.07).toFixed(3);
      var row = afInk(benX, yc, BARW, lines[li].yang, "var(--ink)", 6 + li * 0.45, li * 0.9, flow);
      if (moving.indexOf(li) >= 0)
        row += '<circle cx="' + benCx + '" cy="' + yc + '" r="4.2" fill="var(--paper-raised)" stroke="var(--terracotta)" stroke-width="1.5"></circle>';
      ben += '<g class="bw-af-ln" data-li="' + li + '" style="--wd:' + (6 + li * 0.45).toFixed(2) + 's;--bd:' + (li * 0.55).toFixed(2) + 's">' + row + '</g>';
      var elName = ELEMENTS[els[li]].en, role = relativeRole(els[li], selfGi);
      branch += '<g class="bw-af-branch" style="--d:' + d + 's;--fx:7px">' +
        '<text x="' + benTextX + '" y="' + yc + '" text-anchor="end" dominant-baseline="middle">' +
          '<tspan class="bw-af-role">' + role + '\u2002</tspan><tspan class="bw-af-el">' + elName + '</tspan></text></g>';
      var mk = li === selfLi ? "Self" : (li === respLi ? "Resp" : "");
      if (mk) branch += '<g class="bw-af-branch" style="--d:' + d + 's;--fx:-6px">' +
        '<text class="bw-af-mk ' + (li === selfLi ? "self" : "resp") + '" x="' + benMkX + '" y="' + yc + '" text-anchor="start" dominant-baseline="middle">' + mk + '</text></g>';
    }

    /* moving → Self sheng-ke arrows, on the figure (Sortis only).
       Bow scales with span so arcs NEST like brackets instead of crossing; with
       3+ moving lines they thin out and the heads shrink so the stack stays legible. */
    var arrows = "", defs = "";
    var manyTies = moving.length >= 3;
    if (hasBian) moving.forEach(function (s, i) {
      if (s === selfLi) return;
      var r = elRel(els[s], els[selfLi]), col = r.kind === "peer" ? "var(--faint)" : "color-mix(in oklab, " + r.color + " 42%, var(--dim))";
      var y1 = cy(s), y2 = cy(selfLi), mid = (y1 + y2) / 2;
      var span = Math.abs(y2 - y1), peak = tiePeak + 2 + span * 0.16 + i * 3;
      var dp = 'M ' + tieX + ' ' + y1 + ' Q ' + peak + ' ' + mid + ' ' + tieX + ' ' + y2;
      var mid2 = 'bwAf' + i, mw = manyTies ? 7 : 8;
      defs += '<marker id="' + mid2 + '" viewBox="0 0 12 12" refX="7.6" refY="6" markerWidth="' + mw + '" markerHeight="' + mw + '" orient="auto-start-reverse"><path d="M4 3.2 L8.4 6 L4 8.8" fill="none" stroke="' + col + '" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"></path></marker>';
      arrows += '<path class="bw-af-arrow" d="' + dp + '" stroke="' + col + '" marker-end="url(#' + mid2 + ')" style="--len:' + (Math.abs(y2 - y1) + 90) + (manyTies ? ';opacity:.5;stroke-width:1.3' : '') + '"></path>';
    });

    /* the cross into the result figure */
    var tarrow = "", bian = "", bbranch = "";
    if (hasBian) {
      var ty = (cy(5) + cy(0)) / 2;
      tarrow = '<path class="bw-af-tarrow" d="M 225 ' + ty + ' L 255 ' + ty + '"></path>' +
        '<path class="bw-af-tarrow" d="M 250.8 ' + (ty - 3) + ' L 255 ' + ty + ' L 250.8 ' + (ty + 3) + '"></path>';
      var bl = spec.transformedLines;
      for (var li2 = 5; li2 >= 0; li2--) {
        var yc2 = cy(li2), d2 = ((5 - li2) * 0.07 + 0.15).toFixed(3);
        bian += '<g class="bw-af-ln" data-bian="1" data-li="' + li2 + '" style="--wd:' + (6.3 + li2 * 0.45).toFixed(2) + 's;--bd:' + (li2 * 0.55 + 0.3).toFixed(2) + 's">' + afInk(bianX, yc2, BARW, bl[li2].yang, "var(--prussian)", 6.3 + li2 * 0.45, li2 * 0.9 + 0.6, flow) + '</g>';
        bbranch += '<g class="bw-af-branch" style="--d:' + d2 + 's;--fx:-7px">' +
          '<text class="bw-af-bel" x="' + bianTextX + '" y="' + yc2 + '" text-anchor="start" dominant-baseline="middle">' + ELEMENTS[els2[li2]].en + '</text></g>';
      }
    }

    var benTags = triTag(benCx, trigramOf(lines, 3), 22) + triTag(benCx, trigramOf(lines, 0), 188);
    var benName = '<text class="bw-af-name" x="' + benCx + '" y="220" text-anchor="middle">' + esc(spec.name || "") + '</text>';
    var bianTags = hasBian ? triTag(bianCx, trigramOf(spec.transformedLines, 3), 22) + triTag(bianCx, trigramOf(spec.transformedLines, 0), 188) : "";
    var bianName = hasBian ? '<text class="bw-af-name rel" x="' + bianCx + '" y="220" text-anchor="middle">' + esc(spec.transformedName || "") + '</text>' : "";

    var svg = '<svg class="bw-af" viewBox="0 0 ' + VW + ' ' + VH + '"' + (opts.animate ? ' data-anim="1"' : '') + (opts.cast ? ' data-cast="1"' : '') + ' aria-hidden="true">' +
      '<defs>' + defs + '</defs>' + ben + bian + tarrow + arrows + branch + bbranch +
      benTags + bianTags + benName + bianName + '</svg>';
    var cls = 'bw-af-fig' + (opts.cast ? ' casting' : ' bw-af-live');
    return '<figure class="' + cls + '">' + barHTML("Stria 64") + svg + annoLegend(hasBian && moving.length > 0) + '</figure>';
  }

  function annoLegend(withMotion) {
    var items = ['<span><i class="d-self"></i>Self</span>', '<span><i class="d-resp"></i>Response</span>'];
    if (withMotion) items.push('<span><i class="d-move"></i>Moving</span>', '<span><i class="d-gen"></i>feeds</span>', '<span><i class="d-ctrl"></i>checks</span>');
    return '<div class="bw-af-legend">' + items.join("") + '</div>';
  }

  /* ── the FULL professional board, grown onto the casting figure (Sortis tier).
     Six spirits · najia ganzhi · six-relatives · five-element · hidden spirits (伏神) ·
     World/Resp · 神煎 stars · moving→changed · sheng-ke arrows · four-pillar + void
     header. Three colours only (ink / prussian / terracotta); five-elements are TEXT. ── */
  function rom(p) { return STEM_PY[p.stem.idx] + "-" + BR_PY[p.branch.bi]; }
  /* persistent cast bar — coins + method label + (live) status — kept after the toss */
  function barHTML(method) {
    return '<div class="bw-af-bar">' +
      '<span class="bw-coins">' + coinsMarkup() + '</span>' +
      '<span class="bw-cast-method">' + method + '</span>' +
      '<span class="bw-cast-status"></span>' +
    '</div>';
  }
  /* a small hand-drawn organic ink dot (black blob, no perfect circle) */
  function afDot() {
    return '<svg class="bw-af-dot" viewBox="-24 -24 48 48" width="5" height="5" aria-hidden="true">' +
      '<path d="' + BW_BLOB + '" fill="var(--ink)"></path></svg>';
  }
  /* the moment's time — compact inline row, pillars joined by organic ink dots (no table) */
  function headTableHTML(board) {
    var P = board.meta.pillars, k = board.meta.xunkong, date = board.meta.date || "";
    function pill(lbl, val, cls) {
      return '<span class="bw-af-mt ' + (cls || "") + '"><i>' + lbl + '</i><b>' + val + '</b></span>';
    }
    var parts = [
      pill("Year", rom(P.year)),
      pill("Month", rom(P.month)),
      pill("Day", rom(P.day), "hot"),
      pill("Hour", P.hourKnown ? rom(P.hour) : "\u2014"),
      pill("Void", BR_PY[k[0].bi] + " " + BR_PY[k[1].bi], "vd")
    ];
    return '<div class="bw-af-moment" aria-hidden="true">' +
      (date ? '<span class="bw-af-mt-date">' + esc(date) + '</span>' + afDot() : "") +
      parts.join(afDot()) +
    '</div>';
  }
  function fullBoardFigureHTML(board, spec, opts) {
    var L = board.lines, bf = board.bian && board.bian.full, hasBian = !!bf;
    var worldLi = board.ben.worldLi;
    var hid = {}; (board.hidden || []).forEach(function (h) { hid[h.position] = h; });
    var flow = !(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

    var TOP = 46, STEP = 25, BARW = 56;
    function cy(li) { return TOP + (5 - li) * STEP; }
    var benX = 246, benR = benX + BARW, benLeadX = benX - 6, benTextX = benX - 12;
    /* marks (○/✕) sit clearly right of the bar, and the Self/Resp label starts
       clear of the marks — the old 318/320 put the ring ON the label */
    var tieX = benR, benMkX = 342;
    var bianX = 408, bianR = bianX + BARW, bianLeadX = bianR + 4, bianTextX = bianR + 10;
    /* no transformed figure to make room for: crop the canvas to the primary
       column + its World/Resp marks instead of always reserving the full
       two-figure width (was leaving ~40% of the SVG blank and reading as a
       floating, over-wide chart disconnected from the text column below it) */
    var arrowCx = 384, VW = hasBian ? 600 : 372, VH = 232;
    var benCx = benX + BARW / 2, bianCx = bianX + BARW / 2;

    function brush(x, y, w, h, col) {
      return '<path d="' + barPath(x, y, w, h) + '" fill="' + col + '" stroke="' + col +
        '" stroke-width="0.5" stroke-linejoin="round" stroke-linecap="round"></path>';
    }
    function inkRow(x, yc, yang, col) {
      var h = 9, y = yc - h / 2, w = BARW;
      if (yang) return brush(x, y, w, h, col);
      var half = (w - 12) / 2;
      return brush(x, y, half, h, col) + brush(x + w - half, y, half, h, col);
    }
    function triTag(cx, tri, symY) {
      return '<text class="bw-af-tri-sym" x="' + cx + '" y="' + symY + '" text-anchor="middle">' + tri.sym + '</text>' +
        '<text class="bw-af-tri-en" x="' + cx + '" y="' + (symY + 11) + '" text-anchor="middle">' + esc(tri.en) + '</text>';
    }
    /* moving-line mark, drawn in the same ink-brush language as the figure and set
       to the RIGHT of the bar (like the Self/Resp labels): ○ old-yang · ✕ old-yin */
    function moveMark(cx, yc, yang) {
      if (yang) return '<g class="bw-af-mark"><circle cx="' + cx + '" cy="' + yc + '" r="5" fill="none" stroke="var(--terracotta)" stroke-width="1.7" stroke-linecap="round"></circle></g>';
      var o = 4.3;
      return '<g class="bw-af-mark">' +
        '<path d="M ' + (cx - o) + ' ' + (yc - o) + ' L ' + (cx + o) + ' ' + (yc + o) + '" fill="none" stroke="var(--terracotta)" stroke-width="1.7" stroke-linecap="round"></path>' +
        '<path d="M ' + (cx + o) + ' ' + (yc - o) + ' L ' + (cx - o) + ' ' + (yc + o) + '" fill="none" stroke="var(--terracotta)" stroke-width="1.7" stroke-linecap="round"></path></g>';
    }

    var ben = "", branch = "", arrows = "", defs = "";
    /* premium per-label reveal: each text group streams in on a slow stagger,
       rotating through five reveal styles (blur · rise · slide · ink-bleed · scale) */
    var ti = 0;
    function aftAttr(fx) {
      var i = ti++;
      return 'class="bw-af-branch bw-aft-' + (i % 5) + '" style="--d:' + (i * 0.075).toFixed(3) + 's;--fx:' + fx + 'px"';
    }
    /* non-harmonic per-line wave periods + phases → an irregular ocean swell */
    /* phases are POSITIVE stagger — every line starts its swell from rest
       (translateY 0). Negative phases made the whole figure jump to mid-wave
       the instant the living state switched on (the reported "突然刷新"). */
    var WD = [6.4, 7.7, 5.9, 8.3, 6.8, 7.2], PH = [0, 0.9, 1.7, 0.5, 2.1, 1.3];
    for (var li = 5; li >= 0; li--) {
      var l = L[li], yc = cy(li);
      var row = afInk(benX, yc, BARW, l.yang, "var(--ink)", WD[li], li * 0.9, flow);
      if (l.moving) {
        /* moving-line mark to the RIGHT of the bar, brush-drawn: ○ old-yang · ✕ old-yin */
        row += moveMark(benR + 20, yc, l.yang);
      }
      ben += '<g class="bw-af-ln" data-li="' + li + '" style="--wd:' + WD[li] + 's;--bd:' + PH[li] + 's">' + row + '</g>';

      /* left branch: spirit · [hidden] · six-relative · ganzhi · element · stars · flags */
      var spirit = SPIRIT_PY[l.spirit.cn] || l.spirit.en;
      var t = '<g ' + aftAttr(7) + '>' +
        '<text x="' + benTextX + '" y="' + yc + '" text-anchor="end" dominant-baseline="middle">';
      var stars = (l.shensha || []).map(function (s) { return s.label; });
      if (stars.length) t += '<tspan class="bw-af-ss">' + stars.join(" ") + '\u2002</tspan>';
      if (l.void) t += '<tspan class="bw-af-flag">void\u2002</tspan>';
      if (l.dayClash) t += '<tspan class="bw-af-flag">clash\u2002</tspan>';
      t += '<tspan class="bw-af-fel">' + esc(l.element.en) + '\u2002</tspan>' +
           '<tspan class="bw-af-gz">' + STEM_PY[l.stem.idx] + '-' + BR_PY[l.branch.bi] + '\u2002</tspan>' +
           '<tspan class="bw-af-rel">' + REL_PY[l.relative.key] + '</tspan>';
      if (hid[li]) t += '<tspan class="bw-af-hid">\u2002\u27e8' + REL_PY[hid[li].relative.key] + ' ' + BR_PY[hid[li].hiddenBranch.bi] + '\u27e9</tspan>';
      t += '<tspan class="bw-af-sp">\u2002' + spirit + '</tspan></text></g>';
      branch += t;

      /* right: World/Resp marker (the 变卦 column already carries the moving→changed detail) */
      var mk = li === worldLi ? "Self" : (li === board.ben.respLi ? "Resp" : "");
      var rg = '<g ' + aftAttr(-6) + '>';
      if (mk) rg += '<text class="bw-af-mk ' + (li === worldLi ? "self" : "resp") + '" x="' + benMkX + '" y="' + yc + '" text-anchor="start" dominant-baseline="middle">' + mk + '</text>';
      rg += '</g>';
      branch += rg;
    }

    /* moving → World sheng-ke ties: a faint solid guide + a flowing dashed current
       on top (gen = bright fast stream, ctrl = firm pulse), all looping in place.
       Bow scales with span so arcs NEST instead of crossing; with 3+ ties the
       guides fade back, currents thin, and heads shrink — the stack stays calm. */
    var manyTies = board.moving.length >= 3;
    board.moving.forEach(function (s, i) {
      if (s === worldLi) return;
      var gA = EN_GI[L[s].element.en], gB = EN_GI[L[worldLi].element.en];
      var r = elRel(gA, gB), col = r.kind === "peer" ? "var(--faint)" : "color-mix(in oklab, " + r.color + " 42%, var(--dim))";
      var y1 = cy(s), y2raw = cy(worldLi), mid = (y1 + y2raw) / 2;
      /* stop the current 6 units short of the target line so the head never
         collides with the moving-line ring / Self label sitting there */
      var y2 = y2raw + (y1 > y2raw ? 6 : -6);
      var span = Math.abs(y2raw - y1), peak = tieX + 8 + span * 0.16 + i * 3;
      var dp = 'M ' + tieX + ' ' + y1 + ' Q ' + peak + ' ' + mid + ' ' + tieX + ' ' + y2;
      var id = 'bwAfb' + i, len = (Math.abs(y2 - y1) + 90), mw = manyTies ? 4.5 : 5;
      /* open chevron head — same stroke language as every other arrow on the
         board (no filled wedges anywhere) */
      defs += '<marker id="' + id + '" viewBox="0 0 12 12" refX="7.6" refY="6" markerWidth="' + mw + '" markerHeight="' + mw + '" orient="auto-start-reverse"><path d="M4 3.2 L8.4 6 L4 8.8" fill="none" stroke="' + col + '" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"></path></marker>';
      arrows += '<path class="bw-af-flowbase" d="' + dp + '" stroke="' + col + '" style="--len:' + len + (manyTies ? ';opacity:.14' : '') + '"></path>' +
        '<path class="bw-af-flow ' + r.kind + '" d="' + dp + '" stroke="' + col + '" marker-end="url(#' + id + ')" style="--fi:' + i + (manyTies ? ';stroke-width:1.8' : '') + '"></path>';
    });

    /* the cross into the result figure + the 变卦 column (rel · ganzhi · element · World/Resp) */
    var tarrow = "", bian = "", bbranch = "";
    if (hasBian) {
      var ty = (cy(5) + cy(0)) / 2;
      tarrow = '<path class="bw-af-tarrow" d="M ' + (arrowCx - 15) + ' ' + ty + ' L ' + (arrowCx + 15) + ' ' + ty + '"></path>' +
        '<path class="bw-af-tarrow" d="M ' + (arrowCx + 10.8) + ' ' + (ty - 3) + ' L ' + (arrowCx + 15) + ' ' + ty + ' L ' + (arrowCx + 10.8) + ' ' + (ty + 3) + '"></path>';
      for (var li2 = 5; li2 >= 0; li2--) {
        var b = bf[li2], yc2 = cy(li2);
        bian += '<g class="bw-af-ln" data-bian="1" data-li="' + li2 + '" style="--wd:' + (WD[li2] + 0.5) + 's;--bd:' + (PH[li2] * 0.5 + 0.35).toFixed(2) + 's">' + afInk(bianX, yc2, BARW, b.yang, "var(--prussian)", WD[li2] + 0.5, li2 * 0.9 + 0.6, flow) + '</g>';
        var bmk = b.marker === "self" ? "Self" : (b.marker === "response" ? "Resp" : "");
        bbranch += '<g ' + aftAttr(-7) + '>' +
          '<text x="' + bianTextX + '" y="' + yc2 + '" text-anchor="start" dominant-baseline="middle">' +
            '<tspan class="bw-af-brel' + (b.fromMoving ? ' hot' : '') + '">' + REL_PY[b.relative.key] + '</tspan>' +
            '<tspan class="bw-af-gz">\u2002' + STEM_PY[b.stem.idx] + '-' + BR_PY[b.branch.bi] + '\u2002</tspan>' +
            '<tspan class="bw-af-fel">' + esc(b.element.en) + '</tspan>' +
            (bmk ? '<tspan class="bw-af-mk ' + (b.marker === "self" ? "self" : "resp") + '">\u2002' + bmk + '</tspan>' : '') +
          '</text></g>';
      }
    }

    var benTags = triTag(benCx, trigramOf(spec.lines, 3), 20) + triTag(benCx, trigramOf(spec.lines, 0), 196);
    var benName = '<text class="bw-af-name" x="' + benCx + '" y="222" text-anchor="middle">' + esc(board.ben.name || spec.name || "") + '</text>';
    var bianTags = hasBian ? triTag(bianCx, trigramOf(spec.transformedLines, 3), 20) + triTag(bianCx, trigramOf(spec.transformedLines, 0), 196) : "";
    var bianName = hasBian ? '<text class="bw-af-name rel" x="' + bianCx + '" y="222" text-anchor="middle">' + esc((board.bian && board.bian.name) || spec.transformedName || "") + '</text>' : "";

    var svg = '<svg class="bw-af" viewBox="-8 0 ' + (VW + 16) + ' ' + VH + '"' + (opts.animate ? ' data-anim="1"' : '') + (opts.cast ? ' data-cast="1"' : '') + ' aria-hidden="true">' +
      '<defs>' + defs + '</defs>' + ben + bian + tarrow + arrows + branch + bbranch +
      benTags + bianTags + benName + bianName + '</svg>';
    var cls = 'bw-af-fig bw-af-full' + (opts.cast ? ' casting' : ' bw-af-live');
    return '<figure class="' + cls + '">' + barHTML("Sortis 6") + headTableHTML(board) + svg + annoLegend(true) + '</figure>';
  }

  /* ── public: insightHTML — the hexagram read line by line (standalone card). ── */
  function insightHTML(spec, opts) {
    var f = lineFigure(spec);
    if (!f) return "";
    return '<section class="bw-insight">' +
      '<div class="bw-ix-head"><span class="bw-ix-tag"><b>\u25C6</b>\u2002Reading the lines \u2014 element by element</span></div>' +
      '<div class="bw-zg">' + f.svg +
        '<div class="bw-zg-side">' +
          '<p class="bw-zg-note">' + f.note + '</p>' + legendHTML() +
        '</div>' +
      '</div>' +
    '</section>';
  }

  window.BWFigure = {
    random:    random,
    glyphSVG:  glyphSVG,
    opticalCenter: opticalCenter,
    pairHTML:  pairHTML,
    cast:      cast,
    loaderEl:  loaderEl,
    insightHTML: insightHTML,
    annotatedFigureHTML: annotatedFigureHTML,
    lineFigure: lineFigure,
    legendHTML: legendHTML,
    NAMES:     NAMES
  };
})();
