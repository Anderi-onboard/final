/* BourneWise — Liu Yao casting engine (六爻排盘 · deterministic core)
   ────────────────────────────────────────────────────────────────────────
   PURE computation, no DOM. Produces a complete professional casting board
   from (hexagram lines + moving lines + date). Everything traditional Liu
   Yao derives by fixed rule is computed here and guaranteed correct; the
   INTERPRETIVE layer (用神 selection, 吉凶 judgment) is left to the AI
   protocol (liuyao-ai.js) which consumes this board verbatim.

   Najia verified against the Jing Fang (京房) standard — BWLiuYao._selfTest().

   window.BWLiuYao.computeBoard({ lines, changeIdx, date?, dayGanzhi?, monthBranch? })
   ──────────────────────────────────────────────────────────────────────── */
(function () {
  "use strict";

  /* ═══════════ 1. CANONICAL NAME TABLES ═══════════ */
  var STEM_CN = ["甲","乙","丙","丁","戊","己","庚","辛","壬","癸"];
  var STEM_PY = ["Jiǎ","Yǐ","Bǐng","Dīng","Wù","Jǐ","Gēng","Xīn","Rén","Guǐ"];
  var BR_CN = ["子","丑","寅","卯","辰","巳","午","未","申","酉","戌","亥"];
  var BR_PY = ["Zǐ","Chǒu","Yín","Mǎo","Chén","Sì","Wǔ","Wèi","Shēn","Yǒu","Xū","Hài"];
  var BR_ANIMAL = ["Rat","Ox","Tiger","Rabbit","Dragon","Snake","Horse","Goat","Monkey","Rooster","Dog","Pig"];
  // five elements, generating order: Wood0 Fire1 Earth2 Metal3 Water4
  var EL_EN = ["Wood","Fire","Earth","Metal","Water"];
  var EL_CN = ["木","火","土","金","水"];
  var EL_COLOR = ["#6E7B43","#B5502C","#A87C36","#8A8273","#284C82"];

  var BR_EL = [4,2,0,0,2,1,1,2,3,3,2,4]; // 子水丑土寅木卯木辰土巳火午火未土申金酉金戌土亥水
  var STEM_EL = [0,0,1,1,2,2,3,3,4,4];

  // six relatives 六亲 — English matches existing BourneWise figure reading
  var REL = {
    parent:  { cn:"父母", en:"Resource", gloss:"feeds you" },     // 生我
    peer:    { cn:"兄弟", en:"Peer",     gloss:"your element" },  // 比和
    output:  { cn:"子孙", en:"Output",   gloss:"you feed" },      // 我生
    wealth:  { cn:"妻财", en:"Wealth",   gloss:"you control" },   // 我克
    officer: { cn:"官鬼", en:"Pressure", gloss:"controls you" }   // 克我
  };

  // six spirits 六神 (bottom→top), started by day stem
  var SPIRIT = [
    { cn:"青龙", en:"Azure Dragon"   },
    { cn:"朱雀", en:"Vermilion Bird" },
    { cn:"勾陈", en:"Hook Earth"     },
    { cn:"螣蛇", en:"Coiling Snake"  },
    { cn:"白虎", en:"White Tiger"    },
    { cn:"玄武", en:"Dark Tortoise"  }
  ];
  // 甲乙→青龙 丙丁→朱雀 戊→勾陈 己→螣蛇 庚辛→白虎 壬癸→玄武
  var SPIRIT_START = [0,0,1,1,2,3,4,4,5,5];

  // eight trigrams by 3-bit pattern (bit0=bottom)
  var TRI = [
    { tb:0, cn:"坤", sym:"☷", en:"Earth",    gi:2, palace:"坤宫", palaceEn:"Earth Palace"    },
    { tb:1, cn:"震", sym:"☳", en:"Thunder",  gi:0, palace:"震宫", palaceEn:"Thunder Palace"  },
    { tb:2, cn:"坎", sym:"☵", en:"Water",    gi:4, palace:"坎宫", palaceEn:"Water Palace"    },
    { tb:3, cn:"兑", sym:"☱", en:"Lake",     gi:3, palace:"兑宫", palaceEn:"Lake Palace"     },
    { tb:4, cn:"艮", sym:"☶", en:"Mountain", gi:2, palace:"艮宫", palaceEn:"Mountain Palace" },
    { tb:5, cn:"离", sym:"☲", en:"Fire",     gi:1, palace:"离宫", palaceEn:"Fire Palace"     },
    { tb:6, cn:"巽", sym:"☴", en:"Wind",     gi:0, palace:"巽宫", palaceEn:"Wind Palace"     },
    { tb:7, cn:"乾", sym:"☰", en:"Heaven",   gi:3, palace:"乾宫", palaceEn:"Heaven Palace"   }
  ];

  /* ═══════════ 2. NAJIA 纳甲 (stems & branches per trigram) ═══════════
     inner = lower trigram lines 1-3; outer = upper trigram lines 4-6;
     each [bottom, mid, top] as branch index 0-11. Verified vs 京房纳甲. */
  var NAJIA_BR_INNER = [
    [7,5,3],   // 坤 未巳卯
    [0,2,4],   // 震 子寅辰
    [2,4,6],   // 坎 寅辰午
    [5,3,1],   // 兑 巳卯丑
    [4,6,8],   // 艮 辰午申
    [3,1,11],  // 离 卯丑亥
    [1,11,9],  // 巽 丑亥酉
    [0,2,4]    // 乾 子寅辰
  ];
  var NAJIA_BR_OUTER = [
    [1,11,9],  // 坤 丑亥酉
    [6,8,10],  // 震 午申戌
    [8,10,0],  // 坎 申戌子
    [11,9,7],  // 兑 亥酉未
    [10,0,2],  // 艮 戌子寅
    [9,7,5],   // 离 酉未巳
    [7,5,3],   // 巽 未巳卯
    [6,8,10]   // 乾 午申戌
  ];
  // [inner stem, outer stem]: 乾甲壬 坤乙癸 震庚 巽辛 坎戊 离己 艮丙 兑丁
  var NAJIA_STEM = [
    [1,9],[6,6],[4,4],[3,3],[2,2],[5,5],[7,7],[0,8]
  ];

  /* ═══════════ 3. EIGHT-PALACE MAP (世应·宫·世系) ═══════════ */
  var SERIES    = ["Pure","1st","2nd","3rd","4th","5th","Wandering Soul","Returning Soul"];
  var SERIES_CN = ["本宫","一世","二世","三世","四世","五世","游魂","归魂"];
  var PALACE = (function () {
    var map = {};
    var stages = [
      { f:[],          w:6 },{ f:[0],         w:1 },{ f:[0,1],       w:2 },
      { f:[0,1,2],     w:3 },{ f:[0,1,2,3],   w:4 },{ f:[0,1,2,3,4], w:5 },
      { f:[0,1,2,4],   w:4 },{ f:[4],         w:3 }
    ];
    for (var tb = 0; tb < 8; tb++) {
      var base = tb | (tb << 3);
      for (var si = 0; si < stages.length; si++) {
        var st = stages[si], pat = base;
        for (var k = 0; k < st.f.length; k++) pat ^= (1 << st.f[k]);
        if (map[pat] === undefined) {
          var worldLi = st.w - 1;
          var respLi = worldLi >= 3 ? worldLi - 3 : worldLi + 3;
          map[pat] = { palaceTb: tb, worldLi: worldLi, respLi: respLi, series: si };
        }
      }
    }
    return map;
  })();

  // hexagram-level 六冲 / 六合 (6-bit patterns)
  var SIX_CLASH   = { 63:1, 0:1, 18:1, 45:1, 9:1, 36:1, 54:1, 27:1, 57:1, 15:1 };
  var SIX_COMBINE = { 1:1, 8:1, 56:1, 7:1, 26:1, 19:1, 44:1, 37:1 };
  // branch 六合 / 六冲
  var BR_COMBINE = { 0:1,1:0, 2:11,11:2, 3:10,10:3, 4:9,9:4, 5:8,8:5, 6:7,7:6 };
  function brClash(a,b){ return ((a+6)%12)===b; }
  function brCombine(a,b){ return BR_COMBINE[a]===b; }

  // 墓库 / 绝 by element (火土同宫: 土 follows 火)
  var EL_TOMB = [7,10,10,1,4];  // Wood→未 Fire→戌 Earth→戌 Metal→丑 Water→辰
  var EL_DEAD = [8,11,11,2,5];  // 绝: Wood→申 Fire→亥 Earth→亥 Metal→寅 Water→巳

  /* ═══════════ 4. ELEMENT RELATIONS ═══════════ */
  function generates(a,b){ return (a+1)%5===b; }
  function controls(a,b){ return (a+2)%5===b; }
  function relativeKey(lineEl, selfEl){
    if (lineEl===selfEl) return "peer";
    if (generates(lineEl,selfEl)) return "parent";
    if (generates(selfEl,lineEl)) return "output";
    if (controls(selfEl,lineEl)) return "wealth";
    return "officer";
  }
  function wangShuai(e,m){
    if (e===m) return { cn:"旺", en:"Thriving", rank:4 };
    if (e===(m+1)%5) return { cn:"相", en:"Strong",  rank:3 };
    if (e===(m+4)%5) return { cn:"休", en:"Resting", rank:2 };
    if (e===(m+3)%5) return { cn:"囚", en:"Trapped", rank:1 };
    return { cn:"死", en:"Dead", rank:0 };
  }

  /* ═══════════ 5. CALENDAR (日柱·月建·旬空) ═══════════ */
  function jdn(y,m,d){
    var a = Math.floor((14-m)/12), yy = y+4800-a, mm = m+12*a-3;
    return d + Math.floor((153*mm+2)/5) + 365*yy + Math.floor(yy/4)
             - Math.floor(yy/100) + Math.floor(yy/400) - 32045;
  }
  // day pillar (0-59, 0=甲子). anchor (JDN+49)%60. CALIBRATION CONSTANT — overridable.
  function dayPillarFromDate(dt){
    return ((jdn(dt.getFullYear(), dt.getMonth()+1, dt.getDate()) + 49) % 60 + 60) % 60;
  }
  // approximate 节 boundaries → 月建 branch. Overridable via opts.monthBranch.
  var SOLAR_TERMS = [
    [1,6,1],[2,4,2],[3,6,3],[4,5,4],[5,6,5],[6,6,6],
    [7,7,7],[8,8,8],[9,8,9],[10,8,10],[11,7,11],[12,7,0]
  ];
  function monthBranchFromDate(dt){
    var m = dt.getMonth()+1, d = dt.getDate(), found = null;
    for (var i=0;i<SOLAR_TERMS.length;i++){
      var t = SOLAR_TERMS[i];
      if (m > t[0] || (m===t[0] && d >= t[1])) found = t[2];
    }
    return found===null ? 0 : found; // early Jan before 小寒 → 子月
  }
  function xunkong(dayGZ){
    var xunStartBr = ((dayGZ - (dayGZ%10)) % 12 + 12) % 12;
    return [ (xunStartBr+10)%12, (xunStartBr+11)%12 ];
  }

  /* four pillars 四柱 — year/month/day/hour sexagenary (deterministic from date+time).
     Day pillar anchor is verified (2000-01-07 = 甲子); year/month/hour follow by rule.
     月建 branch from approximate solar terms (overridable). */
  function yearGZ(dt){
    // sexagenary year, 甲子 at 1984; use solar-year approx (before 立春 ~Feb4 belongs to prev year)
    var y = dt.getFullYear();
    var m = dt.getMonth()+1, d = dt.getDate();
    if (m < 2 || (m===2 && d < 4)) y -= 1;            // before 立春 → previous year pillar
    return ((y - 1984) % 60 + 60) % 60;                // 1984 = 甲子(0)
  }
  // 五虎遁: year stem → stem of 寅 month, then offset by month branch from 寅(2)
  function monthStem(yearStemIdx, monthBr){
    var firstYinStem = [2,4,6,8,0][yearStemIdx % 5];   // 甲己→丙, 乙庚→戊, 丙辛→庚, 丁壬→壬, 戊癸→甲
    var stepsFromYin = ((monthBr - 2) % 12 + 12) % 12; // 寅=0,卯=1,…
    return (firstYinStem + stepsFromYin) % 10;
  }
  // 五鼠遁: day stem → stem of 子 hour, then offset by hour branch
  function hourBranchFromDate(dt){ return Math.floor(((dt.getHours()+1)%24)/2); } // 23-1→子(0)
  function hourStem(dayStemIdx, hourBr){
    var ziStem = [0,2,4,6,8][dayStemIdx % 5];          // 甲己→甲, 乙庚→丙, 丙辛→戊, 丁壬→庚, 戊癸→壬
    return (ziStem + hourBr) % 10;
  }

  /* 神煞 (day-based stars) — driver branch group / stem keyed, verified vs almanac */
  function postHorse(b){ // 驿马: 申子辰→寅, 寅午戌→申, 巳酉丑→亥, 亥卯未→巳
    var horse = { 8:2,0:2,4:2,  2:8,6:8,10:8,  5:11,9:11,1:11,  11:5,3:5,7:5 };
    return horse[b];
  }
  function peachBlossom(b){ // 桃花/咸池: 申子辰→酉, 寅午戌→卯, 巳酉丑→午, 亥卯未→子
    var pb = { 8:9,0:9,4:9,  2:3,6:3,10:3,  5:6,9:6,1:6,  11:0,3:0,7:0 };
    return pb[b];
  }
  function luShen(dayStem){ // 日禄: 甲寅 乙卯 丙戊巳 丁己午 庚申 辛酉 壬亥 癸子
    return [2,3,5,6,5,6,8,9,11,0][dayStem];
  }
  function nobleMen(dayStem){ // 天乙贵人: pairs by day stem
    var N = [[1,7],[0,8],[11,9],[11,9],[1,7],[0,8],[1,7],[6,2],[5,3],[5,3]];
    return N[dayStem]; // 甲戊庚→丑未, 乙己→子申, 丙丁→亥酉, 辛→午寅, 壬癸→巳卯
  }
  // 羊刃 yangren: by day stem (阳干刃, 阴干无刃→借禄前一位). 甲卯 乙辰 丙午 丁未 戊午 己未 庚酉 辛戌 壬子 癸丑
  function yangRen(dayStem){ return [3,4,6,7,6,7,9,10,0,1][dayStem]; }
  // 将星 jiangxing: day-branch trine centre. 申子辰→子, 寅午戌→午, 巳酉丑→酉, 亥卯未→卯
  function generalStar(b){ var g={8:0,0:0,4:0, 2:6,6:6,10:6, 5:9,9:9,1:9, 11:3,3:3,7:3}; return g[b]; }
  // 华盖 huagai: trine last. 申子辰→辰, 寅午戌→戌, 巳酉丑→丑, 亥卯未→未
  function canopy(b){ var h={8:4,0:4,4:4, 2:10,6:10,10:10, 5:1,9:1,1:1, 11:7,3:7,7:7}; return h[b]; }
  // 劫煞 jiesha: trine "绝" position. 申子辰→巳, 寅午戌→亥, 巳酉丑→寅, 亥卯未→申
  function robbery(b){ var j={8:5,0:5,4:5, 2:11,6:11,10:11, 5:2,9:2,1:2, 11:8,3:8,7:8}; return j[b]; }
  // 亡神 wangshen: trine "临官". 申子辰→亥, 寅午戌→巳, 巳酉丑→申, 亥卯未→寅
  function ghost(b){ var w={8:11,0:11,4:11, 2:5,6:5,10:5, 5:8,9:8,1:8, 11:2,3:2,7:2}; return w[b]; }
  // 灾煞 zaisha: opposite the 将星 (trine centre clash). 申子辰→午, 寅午戌→子, 巳酉丑→卯, 亥卯未→酉
  function disaster(b){ var z={8:6,0:6,4:6, 2:0,6:0,10:0, 5:3,9:3,1:3, 11:9,3:9,7:9}; return z[b]; }
  // 天医 tianyi: month-branch based, the branch before the month. (here keyed off month)
  function heavenDoctor(monthBr){ return ((monthBr-1)%12+12)%12; }
  // 月德 yuede: by month-branch trine. 寅午戌→丙, 申子辰→壬, 亥卯未→甲, 巳酉丑→庚 (returns a STEM)
  function monthVirtue(monthBr){ var v={2:2,6:2,10:2, 8:8,0:8,4:8, 11:0,3:0,7:0, 5:6,9:6,1:6}; return v[monthBr]; }

  /* ═══════════ 6. HELPERS ═══════════ */
  function patternOf(lines){ var b=0; for (var i=0;i<6;i++) if (lines[i].yang) b|=(1<<i); return b; }
  function triIndex(lines, off){ var b=0; for (var i=0;i<3;i++) if (lines[off+i].yang) b|=(1<<i); return b; }
  function normLines(lines){
    return lines.map(function(l){ return { yang:(typeof l==="boolean")?l:!!l.yang, changing:!!(l&&l.changing) }; });
  }
  function elObj(gi){ return { gi:gi, en:EL_EN[gi], cn:EL_CN[gi], color:EL_COLOR[gi] }; }
  function brObj(bi){ return { bi:bi, cn:BR_CN[bi], py:BR_PY[bi], animal:BR_ANIMAL[bi], el:elObj(BR_EL[bi]) }; }
  function triObj(tb){ return { tb:tb, cn:TRI[tb].cn, sym:TRI[tb].sym, en:TRI[tb].en, element:elObj(TRI[tb].gi) }; }

  function najiaLines(lines){
    var loTb = triIndex(lines,0), upTb = triIndex(lines,3), out=[];
    for (var i=0;i<3;i++) out.push({ stem:NAJIA_STEM[loTb][0], br:NAJIA_BR_INNER[loTb][i] });
    for (var j=0;j<3;j++) out.push({ stem:NAJIA_STEM[upTb][1], br:NAJIA_BR_OUTER[upTb][j] });
    return out;
  }
  function palaceOf(lines){
    var p = PALACE[patternOf(lines)];
    if (!p){ var tb=triIndex(lines,0); return { palaceTb:tb, worldLi:5, respLi:2, series:0 }; }
    return p;
  }
  function jinTui(b0,b1){
    var ADV = { 2:3, 5:6, 8:9, 11:0 }, RET = { 3:2, 6:5, 9:8, 0:11 };
    if (ADV[b0]===b1) return { dir:"advance", cn:"进神", en:"Advancing" };
    if (RET[b0]===b1) return { dir:"retreat", cn:"退神", en:"Retreating" };
    return null;
  }
  function markYin(L, nj, bianNj, idxs){
    var allSame=true, allClash=true, anyMove=false;
    idxs.forEach(function(i){
      if (L[i].moving) anyMove=true;
      if (nj[i].br !== bianNj[i].br) allSame=false;
      if (((nj[i].br+6)%12) !== bianNj[i].br) allClash=false;
    });
    if (!anyMove) return;
    if (allSame) idxs.forEach(function(i){ L[i].fuyin=true; });
    else if (allClash) idxs.forEach(function(i){ L[i].fanyin=true; });
  }

  /* ═══════════ 7. computeBoard ═══════════ */
  function computeBoard(input){
    input = input || {};
    var lines = normLines(input.lines || []);
    if (lines.length !== 6) throw new Error("computeBoard: need 6 lines");
    var changeIdx = (input.changeIdx || []).slice().filter(function(i){return i>=0&&i<6;});
    changeIdx.forEach(function(i){ lines[i].changing = true; });

    // calendar
    var dt = input.date instanceof Date ? input.date : (input.date ? new Date(input.date) : new Date());
    var dayGZ = (typeof input.dayGanzhi==="number") ? ((input.dayGanzhi%60)+60)%60 : dayPillarFromDate(dt);
    var dayStem = dayGZ%10, dayBr = dayGZ%12;
    var monthBr = (typeof input.monthBranch==="number") ? ((input.monthBranch%12)+12)%12 : monthBranchFromDate(dt);
    var monthEl = BR_EL[monthBr], dayEl = BR_EL[dayBr];
    var kong = xunkong(dayGZ);
    // four pillars (year/month/day/hour) — day overridable; others derived
    var yGZ = yearGZ(dt), yStem = yGZ%10, yBr = yGZ%12;
    var mStem = monthStem(yStem, monthBr);
    var hBr = hourBranchFromDate(dt), hStem = hourStem(dayStem, hBr);
    var noble = nobleMen(dayStem);

    // primary hexagram
    var pal = palaceOf(lines);
    var selfEl = TRI[pal.palaceTb].gi;
    var nj = najiaLines(lines);
    var loTb = triIndex(lines,0), upTb = triIndex(lines,3);
    var benPat = patternOf(lines);
    var spiritStart = SPIRIT_START[dayStem];

    // transformed hexagram
    var hasMoving = changeIdx.length>0;
    var bianLines = lines.map(function(l){ return { yang:l.changing?!l.yang:l.yang, changing:false }; });
    var bianPal = hasMoving ? palaceOf(bianLines) : null;
    var bianNj  = hasMoving ? najiaLines(bianLines) : null;

    // per-line data
    var L = [];
    for (var i=0;i<6;i++){
      var stem = nj[i].stem, br = nj[i].br, gi = BR_EL[br];
      var relK = relativeKey(gi, selfEl);
      L.push({
        idx:i, yang:lines[i].yang, moving:lines[i].changing,
        stem:{ idx:stem, cn:STEM_CN[stem], py:STEM_PY[stem], el:elObj(STEM_EL[stem]) },
        branch: brObj(br),
        element: elObj(gi),
        relative: { key:relK, cn:REL[relK].cn, en:REL[relK].en, gloss:REL[relK].gloss },
        spirit: { cn:SPIRIT[(spiritStart+i)%6].cn, en:SPIRIT[(spiritStart+i)%6].en },
        marker:   i===pal.worldLi ? "self" : (i===pal.respLi ? "response" : ""),
        markerCn: i===pal.worldLi ? "世"   : (i===pal.respLi ? "应"      : ""),
        void: (br===kong[0]||br===kong[1]),
        wangShuai: wangShuai(gi, monthEl),
        dayClash: brClash(br,dayBr), dayCombine: brCombine(br,dayBr),
        monthClash: brClash(br,monthBr), monthCombine: brCombine(br,monthBr),
        dayGenerates: generates(dayEl,gi), dayControls: controls(dayEl,gi),
        monthGenerates: generates(monthEl,gi), monthControls: controls(monthEl,gi),
        dayTomb: (EL_TOMB[gi]===dayBr), monthTomb: (EL_TOMB[gi]===monthBr),
        tombBranch: brObj(EL_TOMB[gi]), deadBranch: brObj(EL_DEAD[gi]),
        transform: null, fanyin:false, fuyin:false
      });
    }

    // transforms (动爻→变爻)
    if (hasMoving){
      changeIdx.forEach(function(ci){
        var b0=nj[ci].br, b1=bianNj[ci].br, g0=BR_EL[b0], g1=BR_EL[b1];
        var relK = relativeKey(g1, selfEl);
        L[ci].transform = {
          stem:{ idx:bianNj[ci].stem, cn:STEM_CN[bianNj[ci].stem] },
          branch: brObj(b1), element: elObj(g1),
          relative:{ key:relK, cn:REL[relK].cn, en:REL[relK].en },
          jinTui: jinTui(b0,b1),
          backToTomb: (EL_TOMB[g0]===b1),
          backToVoid: (b1===kong[0]||b1===kong[1]),
          clashBen: brClash(b0,b1), combineBen: brCombine(b0,b1),
          feedsBen: generates(g1,g0), controlsBen: controls(g1,g0)
        };
      });
      markYin(L, nj, bianNj, [0,1,2]);
      markYin(L, nj, bianNj, [3,4,5]);
    }

    // per-line 神煞 tags (branch-based stars land on whichever line carries that branch)
    var ssMap = {};
    function tagSS(bi, key, label){ if(bi==null) return; (ssMap[bi]=ssMap[bi]||[]).push({key:key,label:label}); }
    tagSS(postHorse(dayBr),"postHorse","Post-Horse");
    tagSS(peachBlossom(dayBr),"peachBlossom","Peach");
    tagSS(luShen(dayStem),"lu","Prosperity");
    tagSS(noble[0],"noble","Noble"); tagSS(noble[1],"noble","Noble");
    tagSS(yangRen(dayStem),"yangRen","Blade");
    tagSS(generalStar(dayBr),"generalStar","General");
    tagSS(canopy(dayBr),"canopy","Canopy");
    tagSS(robbery(dayBr),"robbery","Robbery");
    tagSS(ghost(dayBr),"ghost","Ghost");
    tagSS(disaster(dayBr),"disaster","Disaster");
    tagSS(heavenDoctor(monthBr),"heavenDoctor","Healer");
    L.forEach(function(l){ l.shensha = (ssMap[l.branch.bi]||[]).slice(); });

    // full 变卦 lines (all six, najia + relative vs BEN palace element) for the chart's 变卦 column
    var bianFull = null;
    if (hasMoving){
      bianFull = [];
      for (var bi2=0; bi2<6; bi2++){
        var bbr = bianNj[bi2].br, bgi = BR_EL[bbr], bRelK = relativeKey(bgi, selfEl);
        bianFull.push({
          idx:bi2, yang:bianLines[bi2].yang, fromMoving:lines[bi2].changing,
          stem:{ idx:bianNj[bi2].stem, cn:STEM_CN[bianNj[bi2].stem], py:STEM_PY[bianNj[bi2].stem] },
          branch: brObj(bbr), element: elObj(bgi),
          relative:{ key:bRelK, cn:REL[bRelK].cn, en:REL[bRelK].en },
          marker: bi2===bianPal.worldLi ? "self" : (bi2===bianPal.respLi ? "response" : ""),
          markerCn: bi2===bianPal.worldLi ? "世" : (bi2===bianPal.respLi ? "应" : "")
        });
      }
    }

    // 伏神 / 飞神
    var present = {}; L.forEach(function(l){ present[l.relative.key]=true; });
    var ptb = pal.palaceTb;
    var pureHex = []; for (var q=0;q<6;q++) pureHex.push({ yang:((ptb>>(q%3))&1)===1, changing:false });
    var pureNj = najiaLines(pureHex);
    var hidden = [];
    ["parent","peer","output","wealth","officer"].forEach(function(key){
      if (present[key]) return;
      for (var pi=0; pi<6; pi++){
        var pg = BR_EL[pureNj[pi].br];
        if (relativeKey(pg, selfEl)===key){
          var fb = L[pi].branch.bi;
          hidden.push({
            position: pi,
            relative:{ key:key, cn:REL[key].cn, en:REL[key].en },
            hiddenBranch: brObj(pureNj[pi].br),
            flyingBranch: L[pi].branch,
            flyingRelative: L[pi].relative,
            flyGeneratesHidden: generates(BR_EL[fb], pg),
            flyControlsHidden:  controls(BR_EL[fb], pg),
            hiddenControlsFly:  controls(pg, BR_EL[fb])
          });
          break;
        }
      }
    });

    // 三合局 — three of the six lines whose branches form a triple-combination
    // (申子辰→水 / 亥卯未→木 / 寅午戌→火 / 巳酉丑→金) fuse into one elemental bloc
    // that acts together, far stronger than any single line. A half-frame (半合)
    // is two of the three WITH the 帝旺 peak present; it completes when the third
    // branch arrives (day/month/moving line) — itself a natural 应期.
    var SANHE = [
      { peak:0, members:[8,0,4], el:4 },   // 申子辰 → 水
      { peak:3, members:[11,3,7], el:0 },  // 亥卯未 → 木
      { peak:6, members:[2,6,10], el:1 },  // 寅午戌 → 火
      { peak:9, members:[5,9,1], el:3 }    // 巳酉丑 → 金
    ];
    var byBranch = {};
    L.forEach(function(l, idx){ var b=l.branch.bi; (byBranch[b]=byBranch[b]||[]).push(idx); });
    var sanhe = [];
    SANHE.forEach(function(g){
      var hit = g.members.filter(function(b){ return byBranch[b]; });
      var full = hit.length === 3;
      var half = hit.length === 2 && hit.indexOf(g.peak) >= 0;
      if (!full && !half) return;
      var linePos = [];
      hit.forEach(function(b){ byBranch[b].forEach(function(p){ linePos.push(p); }); });
      var missBr = g.members.filter(function(b){ return hit.indexOf(b) < 0; });
      sanhe.push({
        type: full ? "full" : "half",
        element: elObj(g.el),
        branches: hit.map(function(b){ return brObj(b); }),
        lines: linePos.map(function(p){ return p+1; }).sort(function(a,b){return a-b;}),
        missing: missBr.length ? brObj(missBr[0]) : null,
        hasMoving: linePos.some(function(p){ return L[p].moving; })
      });
    });

    // 月卦身 (gua-shen / body of the matter) — the subject the whole question
    // hangs on. Classic rule: yang world line counts the body-branch from 子 at
    // the first line; yin world line counts from 午. If that branch appears on a
    // line, that line IS the body (卦身上卦); if not, 卦身不上卦 — the matter has
    // no clear anchor/subject yet.
    var wl = pal.worldLi;
    var guashenBi = ((lines[wl] && lines[wl].yang) ? wl : wl + 6) % 12;
    var guashenLines = [];
    L.forEach(function(l, idx){ if (l.branch.bi === guashenBi) guashenLines.push(idx + 1); });
    var guashen = { branch: brObj(guashenBi), onBoard: guashenLines.length > 0, lines: guashenLines };

    // hexagram-level relationships
    var benClash=!!SIX_CLASH[benPat], benCombine=!!SIX_COMBINE[benPat];
    var bianClash=false, bianCombine=false;
    if (hasMoving){ var bp=patternOf(bianLines); bianClash=!!SIX_CLASH[bp]; bianCombine=!!SIX_COMBINE[bp]; }

    return {
      meta: {
        date: dt.toISOString().slice(0,10),
        dateAuthoritative: (typeof input.dayGanzhi==="number"),
        dayPillar:{ gz:dayGZ, stem:{idx:dayStem,cn:STEM_CN[dayStem]}, branch:brObj(dayBr), el:elObj(dayEl) },
        monthBranch:{ bi:monthBr, cn:BR_CN[monthBr], el:elObj(monthEl) },
        xunkong:[ brObj(kong[0]), brObj(kong[1]) ],
        pillars: {
          year:  { stem:{idx:yStem,cn:STEM_CN[yStem]}, branch:brObj(yBr) },
          month: { stem:{idx:mStem,cn:STEM_CN[mStem]}, branch:brObj(monthBr) },
          day:   { stem:{idx:dayStem,cn:STEM_CN[dayStem]}, branch:brObj(dayBr) },
          hour:  { stem:{idx:hStem,cn:STEM_CN[hStem]}, branch:brObj(hBr) },
          hourKnown: (input.date instanceof Date || !!input.date)
        },
        shensha: {
          postHorse:    brObj(postHorse(dayBr)),
          peachBlossom: brObj(peachBlossom(dayBr)),
          lu:           brObj(luShen(dayStem)),
          noble:        [ brObj(noble[0]), brObj(noble[1]) ],
          yangRen:      brObj(yangRen(dayStem)),
          generalStar:  brObj(generalStar(dayBr)),
          canopy:       brObj(canopy(dayBr)),
          robbery:      brObj(robbery(dayBr)),
          ghost:        brObj(ghost(dayBr)),
          disaster:     brObj(disaster(dayBr)),
          heavenDoctor: brObj(heavenDoctor(monthBr)),
          monthVirtue:  { stem:{ idx:monthVirtue(monthBr), cn:STEM_CN[monthVirtue(monthBr)] } }
        },
        method: input.method || "sortis"
      },
      ben: {
        pattern: benPat,
        palace:{ tb:pal.palaceTb, cn:TRI[pal.palaceTb].palace, en:TRI[pal.palaceTb].palaceEn, element:elObj(selfEl) },
        series:{ idx:pal.series, cn:SERIES_CN[pal.series], en:SERIES[pal.series] },
        worldLi: pal.worldLi, respLi: pal.respLi,
        lower: triObj(loTb), upper: triObj(upTb),
        clash: benClash, combine: benCombine, name: input.name || null
      },
      bian: hasMoving ? {
        pattern: patternOf(bianLines),
        palace:{ tb:bianPal.palaceTb, cn:TRI[bianPal.palaceTb].palace, en:TRI[bianPal.palaceTb].palaceEn, element:elObj(TRI[bianPal.palaceTb].gi) },
        lower: triObj(triIndex(bianLines,0)), upper: triObj(triIndex(bianLines,3)),
        clash: bianClash, combine: bianCombine, name: input.transformedName || null,
        full: bianFull
      } : null,
      lines: L, moving: changeIdx.slice().sort(function(a,b){return a-b;}),
      hidden: hidden, sanhe: sanhe, guashen: guashen, reading: null
    };
  }

  /* ═══════════ 8. SELF-TEST (reference verification) ═══════════ */
  function _selfTest(){
    var results=[], pass=0, fail=0;
    function chk(name, got, exp){
      var ok = JSON.stringify(got)===JSON.stringify(exp);
      results.push((ok?"✓ ":"✗ ")+name+(ok?"":"  got="+JSON.stringify(got)+" exp="+JSON.stringify(exp)));
      ok?pass++:fail++;
    }
    function hex(bits){ return bits.map(function(y){return {yang:!!y,changing:false};}); }
    var qian = computeBoard({ lines:hex([1,1,1,1,1,1]), changeIdx:[], dayGanzhi:0 });
    chk("乾 branches", qian.lines.map(function(l){return l.branch.cn;}), ["子","寅","辰","午","申","戌"]);
    chk("乾 palace", qian.ben.palace.cn, "乾宫");
    chk("乾 world idx", qian.ben.worldLi, 5);
    chk("乾 relatives", qian.lines.map(function(l){return l.relative.cn;}),
        ["子孙","妻财","父母","官鬼","兄弟","父母"]);
    var kun = computeBoard({ lines:hex([0,0,0,0,0,0]), changeIdx:[], dayGanzhi:0 });
    chk("坤 branches", kun.lines.map(function(l){return l.branch.cn;}), ["未","巳","卯","丑","亥","酉"]);
    chk("坤 world idx", kun.ben.worldLi, 5);
    var kan = computeBoard({ lines:hex([0,1,0,0,1,0]), changeIdx:[], dayGanzhi:0 });
    chk("坎 branches", kan.lines.map(function(l){return l.branch.cn;}), ["寅","辰","午","申","戌","子"]);
    chk("坎 palace", kan.ben.palace.cn, "坎宫");
    chk("六神 甲日", qian.lines.map(function(l){return l.spirit.cn;}),
        ["青龙","朱雀","勾陈","螣蛇","白虎","玄武"]);
    var qG = computeBoard({ lines:hex([1,1,1,1,1,1]), changeIdx:[], dayGanzhi:6 });
    chk("六神 庚日", qG.lines.map(function(l){return l.spirit.cn;}),
        ["白虎","玄武","青龙","朱雀","勾陈","螣蛇"]);
    chk("旬空 甲子旬", qian.meta.xunkong.map(function(b){return b.cn;}), ["戌","亥"]);
    var x10 = computeBoard({ lines:hex([1,1,1,1,1,1]), changeIdx:[], dayGanzhi:10 });
    chk("旬空 甲戌旬", x10.meta.xunkong.map(function(b){return b.cn;}), ["申","酉"]);
    return { pass:pass, fail:fail, results:results };
  }

  window.BWLiuYao = {
    computeBoard: computeBoard, _selfTest: _selfTest,
    EL_EN:EL_EN, EL_CN:EL_CN, EL_COLOR:EL_COLOR,
    REL:REL, SPIRIT:SPIRIT, BR_CN:BR_CN, STEM_CN:STEM_CN
  };
})();
