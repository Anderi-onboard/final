/* BourneWise · animated mountain-range background (paper skin).
   Usage: place <div class="mtn-bg" aria-hidden="true"></div> anywhere and load
   this script. It injects the layered SVG, expands contour lines, and scopes its
   own CSS. Style the .mtn-bg box (position/size/opacity) from the host page.
   Ten parallax ridges flow at different speeds; six clouds drift over them. */
(function () {
  "use strict";

  var CSS = ''
    + '.mtn-bg{overflow:hidden;contain:strict}'
    + '.mtn-bg>svg{display:block;width:100%;height:100%}'
    /* ten ridges, ALL SYNCHRONISED to one shared timeline (same duration, same
       stops, same delay) so at any moment the whole mountain wears ONE palette,
       then crossfades to the next. FIVE fixed professional combinations rotate,
       each a 10-tone ramp ordered light->dark (hazy far ridge -> rich near ridge)
       with at most one deliberate contrast band:
         0%   A - Terracotta Canyon  (brand default: cream -> terracotta -> espresso)
         20%  B - Harbour Dusk       (cream -> prussian navy)
         40%  C - Wheat & Ink        (gold ridges over navy bases)
         60%  D - Aubergine & Ember  (plum ladder, one ember band)
         80%  E - Winter Slate       (fog greys, one warm fawn band)
       Each palette holds ~39s of its 40s slot; holdify() below inserts the hold
       keyframes so the ~1s crossfade is the only window where ridges repaint. */
    + '@keyframes mtn-sys-l1{0%,100%{fill:#FBF3E9}20%{fill:#F3F5F8}40%{fill:#FBF6E6}60%{fill:#F8F0EB}80%{fill:#F5F4F1}}'
    + '@keyframes mtn-sys-l2{0%,100%{fill:#F7E8D2}20%{fill:#E4EAF2}40%{fill:#F6EACA}60%{fill:#EFDFD6}80%{fill:#E9E8E3}}'
    + '@keyframes mtn-sys-l3{0%,100%{fill:#F0D8B6}20%{fill:#CBD8E8}40%{fill:#EDD9A4}60%{fill:#E2C6BB}80%{fill:#D6D6D1}}'
    + '@keyframes mtn-sys-l4{0%,100%{fill:#E6BE8C}20%{fill:#A6BEDA}40%{fill:#E0C078}60%{fill:#CFA090}80%{fill:#BBBEBE}}'
    + '@keyframes mtn-sys-l5{0%,100%{fill:#DCA06A}20%{fill:#7E9FC4}40%{fill:#CFA452}60%{fill:#C77B5A}80%{fill:#B08A68}}'
    + '@keyframes mtn-sys-l6{0%,100%{fill:#C97C4C}20%{fill:#5B7FA9}40%{fill:#B58839}60%{fill:#9A5F63}80%{fill:#7C848C}}'
    + '@keyframes mtn-sys-l7{0%,100%{fill:#AC5C36}20%{fill:#42648E}40%{fill:#4E5F84}60%{fill:#7A4759}80%{fill:#616B75}}'
    + '@keyframes mtn-sys-l8{0%,100%{fill:#843F24}20%{fill:#2F4C72}40%{fill:#384A6D}60%{fill:#5A3349}80%{fill:#47515C}}'
    + '@keyframes mtn-sys-l9{0%,100%{fill:#4E2415}20%{fill:#1D3252}40%{fill:#25334F}60%{fill:#3A2034}80%{fill:#2F3741}}'
    + '@keyframes mtn-sys-l10{0%,100%{fill:#241009}20%{fill:#101D33}40%{fill:#141D32}60%{fill:#1E101E}80%{fill:#191E26}}'
    + '@keyframes mtn-cloud-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}'
    + '@keyframes mtn-flow-l{from{transform:translate3d(0,0,0)}to{transform:translate3d(-2000px,0,0)}}'
    + '@keyframes mtn-flow-r{from{transform:translate3d(0,0,0)}to{transform:translate3d(2000px,0,0)}}'
    + '@keyframes mtn-cloud-r{from{transform:translate3d(-1700px,0,0)}to{transform:translate3d(1700px,0,0)}}'
    + '@keyframes mtn-cloud-l{from{transform:translate3d(1700px,0,0)}to{transform:translate3d(-1700px,0,0)}}'
    /* fill is a PAINT property: animating it forces a full re-raster of these huge ridge
       textures, so it must not interpolate continuously. Each palette stop gets a HOLD
       keyframe injected just before the next stop (see holdify() below): the colour
       stays perfectly still for ~3.6s of its 4s slot, then crossfades to the next stop
       over the last ~0.4s. Repaints happen only inside that brief crossfade window —
       no per-frame re-raster, and no hard steps() flash at the boundary.
       translate flows stay GPU-composited regardless.
       --mtn-phase offsets the shared palette clock so a fresh page load opens mid-cycle
       inside the Terracotta Canyon band; hosts may override it on
       .mtn-bg (e.g. style="--mtn-phase:-52s" opens on Harbour Dusk). */
    + '.mtn-bg .fill{animation-iteration-count:infinite;animation-timing-function:linear}'
    + '.mtn-bg [class^="flow-"]{will-change:transform}'
    + '.mtn-bg .cloud-bob{animation:mtn-cloud-bob 8s ease-in-out infinite}'
    + '.mtn-bg .contour use,.mtn-bg .cloud-contour use{fill:none;stroke:rgba(0,0,0,0.24);stroke-width:1.2}'
    + '.mtn-bg .l1{animation-name:mtn-sys-l1;animation-duration:200s;animation-delay:var(--mtn-phase,-12s);opacity:.48}'
    + '.mtn-bg .l2{animation-name:mtn-sys-l2;animation-duration:200s;animation-delay:var(--mtn-phase,-12s);opacity:.60}'
    + '.mtn-bg .l3{animation-name:mtn-sys-l3;animation-duration:200s;animation-delay:var(--mtn-phase,-12s);opacity:.72}'
    + '.mtn-bg .l4{animation-name:mtn-sys-l4;animation-duration:200s;animation-delay:var(--mtn-phase,-12s);opacity:.83}'
    + '.mtn-bg .l5{animation-name:mtn-sys-l5;animation-duration:200s;animation-delay:var(--mtn-phase,-12s);opacity:.90}'
    + '.mtn-bg .l6{animation-name:mtn-sys-l6;animation-duration:200s;animation-delay:var(--mtn-phase,-12s);opacity:.95}'
    + '.mtn-bg .l7{animation-name:mtn-sys-l7;animation-duration:200s;animation-delay:var(--mtn-phase,-12s);opacity:.97}'
    + '.mtn-bg .l8{animation-name:mtn-sys-l8;animation-duration:200s;animation-delay:var(--mtn-phase,-12s);opacity:1}'
    + '.mtn-bg .l9{animation-name:mtn-sys-l9;animation-duration:200s;animation-delay:var(--mtn-phase,-12s);opacity:1}'
    + '.mtn-bg .l10{animation-name:mtn-sys-l10;animation-duration:200s;animation-delay:var(--mtn-phase,-12s);opacity:1}'
    + '.mtn-bg .flow-1{animation:mtn-flow-l 145s linear infinite}.mtn-bg .flow-2{animation:mtn-flow-r 128s linear infinite}'
    + '.mtn-bg .flow-3{animation:mtn-flow-l 112s linear infinite}.mtn-bg .flow-4{animation:mtn-flow-r 96s linear infinite}'
    + '.mtn-bg .flow-5{animation:mtn-flow-l 82s linear infinite}.mtn-bg .flow-6{animation:mtn-flow-r 70s linear infinite}'
    + '.mtn-bg .flow-7{animation:mtn-flow-l 58s linear infinite}.mtn-bg .flow-8{animation:mtn-flow-r 48s linear infinite}'
    + '.mtn-bg .flow-9{animation:mtn-flow-l 40s linear infinite}.mtn-bg .flow-10{animation:mtn-flow-r 32s linear infinite}'
    + '.mtn-bg .cloud-1{animation:mtn-cloud-r 120s linear infinite}.mtn-bg .cloud-2{animation:mtn-cloud-l 96s linear infinite}'
    + '.mtn-bg .cloud-3{animation:mtn-cloud-r 74s linear -30s infinite}.mtn-bg .cloud-4{animation:mtn-cloud-l 132s linear -18s infinite}'
    + '.mtn-bg .cloud-5{animation:mtn-cloud-r 104s linear -50s infinite}.mtn-bg .cloud-6{animation:mtn-cloud-l 84s linear -12s infinite}'
    + '@media(prefers-reduced-motion:reduce){.mtn-bg path,.mtn-bg g,.mtn-bg use{animation:none!important}}';

  /* holdify — rewrite every mtn-sys-l* keyframe list from evenly-spaced stops into
     hold-then-blend pairs: before each stop, insert a keyframe 0.5% (~1s) earlier
     carrying the PREVIOUS colour. Between a stop and its inserted twin the value is
     constant (zero repaint); the short window to the next stop crossfades smoothly.
     Kills both the per-frame re-raster and the hard flash at palette boundaries. */
  var HOLD = 0.5;
  CSS = CSS.replace(/@keyframes (mtn-sys-l\d+)\{((?:[^{}]+\{[^{}]*\})+)\}/g, function (m, name, body) {
    var stops = [];
    body.replace(/([\d.,%]+)\{fill:(#[0-9A-Fa-f]+)\}/g, function (mm, sel, col) {
      stops.push({ sel: sel, p: parseFloat(sel), c: col });
      return mm;
    });
    if (!stops.length) return m;
    var out = '';
    for (var i = 0; i < stops.length; i++) {
      if (i > 0) out += (stops[i].p - HOLD).toFixed(3) + '%{fill:' + stops[i - 1].c + '}';
      out += stops[i].sel + '{fill:' + stops[i].c + '}';
    }
    out += (100 - HOLD).toFixed(3) + '%{fill:' + stops[stops.length - 1].c + '}';
    return '@keyframes ' + name + '{' + out + '}';
  });

  var W = {
    1: "M -2000 188 L -1860 186 C -1777 186 -1763 150 -1680 150 C -1570 150 -1550 178 -1440 178 L -1240 178 C -1176 178 -1164 166 -1100 166 C -1045 166 -1035 188 -980 188 L -780 195 C -660 195 -640 144 -520 144 C -428 144 -412 189 -320 189 L 0 184 L 140 186 C 223 186 237 150 320 150 C 430 150 450 178 560 178 L 760 178 C 824 178 836 166 900 166 C 955 166 965 188 1020 188 L 1220 195 C 1340 195 1360 144 1480 144 C 1572 144 1588 189 1680 189 L 2000 184 L 2140 186 C 2223 186 2237 150 2320 150 C 2430 150 2450 178 2560 178 L 2760 178 C 2824 178 2836 166 2900 166 C 2955 166 2965 188 3020 188 L 3220 195 C 3340 195 3360 144 3480 144 C 3572 144 3588 189 3680 189 L 4000 184",
    2: "M -2000 229.33 L -1860 228 C -1777 228 -1763 204 -1680 204 C -1570 204 -1550 222.67 -1440 222.67 L -1240 222.67 C -1176 222.67 -1164 214.67 -1100 214.67 C -1045 214.67 -1035 229.33 -980 229.33 L -780 234 C -660 234 -640 200 -520 200 C -428 200 -412 230 -320 230 L 0 226.67 L 140 228 C 223 228 237 204 320 204 C 430 204 450 222.67 560 222.67 L 760 222.67 C 824 222.67 836 214.67 900 214.67 C 955 214.67 965 229.33 1020 229.33 L 1220 234 C 1340 234 1360 200 1480 200 C 1572 200 1588 230 1680 230 L 2000 226.67 L 2140 228 C 2223 228 2237 204 2320 204 C 2430 204 2450 222.67 2560 222.67 L 2760 222.67 C 2824 222.67 2836 214.67 2900 214.67 C 2955 214.67 2965 229.33 3020 229.33 L 3220 234 C 3340 234 3360 200 3480 200 C 3572 200 3588 230 3680 230 L 4000 226.67",
    3: "M -2000 270 L -1960 269 C -1872 269 -1848 214 -1760 214 C -1690 214 -1670 263 -1600 263 L -1330 258 C -1261 258 -1249 232 -1180 232 C -1074 232 -1056 265 -950 265 L -870 268 C -795 268 -775 205 -700 205 C -638 205 -622 277 -560 277 L -360 273 C -307 273 -293 240 -240 240 C -161 240 -139 267 -60 267 L 0 266 L 40 269 C 128 269 152 214 240 214 C 310 214 330 263 400 263 L 670 258 C 739 258 751 232 820 232 C 926 232 944 265 1050 265 L 1130 268 C 1205 268 1225 205 1300 205 C 1362 205 1378 277 1440 277 L 1640 273 C 1693 273 1707 240 1760 240 C 1839 240 1861 267 1940 267 L 2000 266 L 2040 269 C 2128 269 2152 214 2240 214 C 2310 214 2330 263 2400 263 L 2670 258 C 2739 258 2751 232 2820 232 C 2926 232 2944 265 3050 265 L 3130 268 C 3205 268 3225 205 3300 205 C 3362 205 3378 277 3440 277 L 3640 273 C 3693 273 3707 240 3760 240 C 3839 240 3861 267 3940 267 L 4000 266",
    4: "M -2000 374 L -1880 372 C -1742 372 -1718 282 -1580 282 C -1479 282 -1461 364 -1360 364 L -980 361 C -855 361 -845 308 -720 308 C -547 308 -533 368 -360 368 L 0 372 L 120 372 C 258 372 282 282 420 282 C 521 282 539 364 640 364 L 1020 361 C 1145 361 1155 308 1280 308 C 1453 308 1467 368 1640 368 L 2000 372 L 2120 372 C 2258 372 2282 282 2420 282 C 2521 282 2539 364 2640 364 L 3020 361 C 3145 361 3155 308 3280 308 C 3453 308 3467 368 3640 368 L 4000 372",
    5: "M -2000 440 L -1910 438 C -1835 438 -1815 356 -1740 356 C -1683 356 -1667 434 -1610 434 L -1320 432 C -1256 432 -1244 380 -1180 380 C -1093 380 -1077 440 -990 440 L -740 446 C -630 446 -610 340 -500 340 C -408 340 -392 441 -300 441 L 0 436 L 90 438 C 165 438 185 356 260 356 C 317 356 333 434 390 434 L 680 432 C 744 432 756 380 820 380 C 907 380 923 440 1010 440 L 1260 446 C 1370 446 1390 340 1500 340 C 1592 340 1608 441 1700 441 L 2000 436 L 2090 438 C 2165 438 2185 356 2260 356 C 2317 356 2333 434 2390 434 L 2680 432 C 2744 432 2756 380 2820 380 C 2907 380 2923 440 3010 440 L 3260 446 C 3370 446 3390 340 3500 340 C 3592 340 3608 441 3700 441 L 4000 436",
    6: "M -2000 500 L -1690 498 C -1602 498 -1568 330 -1480 330 C -1413 330 -1387 496 -1320 496 L -820 495 C -723 495 -697 366 -600 366 C -468 366 -432 498 -300 498 L 0 500 L 310 498 C 398 498 432 330 520 330 C 587 330 613 496 680 496 L 1180 495 C 1277 495 1303 366 1400 366 C 1532 366 1568 498 1700 498 L 2000 500 L 2310 498 C 2398 498 2432 330 2520 330 C 2587 330 2613 496 2680 496 L 3180 495 C 3277 495 3303 366 3400 366 C 3532 366 3568 498 3700 498 L 4000 500",
    7: "M -2000 524 L -1880 523.35 C -1742 523.35 -1718 494 -1580 494 C -1479 494 -1461 520.74 -1360 520.74 L -980 519.76 C -855 519.76 -845 502.48 -720 502.48 C -547 502.48 -533 522.04 -360 522.04 L 0 523.35 L 120 523.35 C 258 523.35 282 494 420 494 C 521 494 539 520.74 640 520.74 L 1020 519.76 C 1145 519.76 1155 502.48 1280 502.48 C 1453 502.48 1467 522.04 1640 522.04 L 2000 523.35 L 2120 523.35 C 2258 523.35 2282 494 2420 494 C 2521 494 2539 520.74 2640 520.74 L 3020 519.76 C 3145 519.76 3155 502.48 3280 502.48 C 3453 502.48 3467 522.04 3640 522.04 L 4000 523.35",
    8: "M -2000 538 L -1840 536 C -1752 536 -1728 512 -1640 512 C -1570 512 -1550 533 -1480 533 L -1150 531 C -1081 531 -1069 520 -1000 520 C -903 520 -887 538 -790 538 L -540 543 C -461 543 -439 508 -360 508 C -298 508 -282 538 -220 538 L 0 534 L 160 536 C 248 536 272 512 360 512 C 430 512 450 533 520 533 L 850 531 C 919 531 931 520 1000 520 C 1097 520 1113 538 1210 538 L 1460 543 C 1539 543 1561 508 1640 508 C 1702 508 1718 538 1780 538 L 2000 534 L 2160 536 C 2248 536 2272 512 2360 512 C 2430 512 2450 533 2520 533 L 2850 531 C 2919 531 2931 520 3000 520 C 3097 520 3113 538 3210 538 L 3460 543 C 3539 543 3561 508 3640 508 C 3702 508 3718 538 3780 538 L 4000 534",
    9: "M -2000 568 L -1780 566 C -1662 566 -1618 556 -1500 556 C -1366 556 -1314 561 -1180 561 L -800 561 C -674 561 -626 560 -500 560 C -391 560 -349 565 -240 565 L 0 566 L 220 566 C 338 566 382 556 500 556 C 634 556 686 561 820 561 L 1200 561 C 1326 561 1374 560 1500 560 C 1609 560 1651 565 1760 565 L 2000 566 L 2220 566 C 2338 566 2382 556 2500 556 C 2634 556 2686 561 2820 561 L 3200 561 C 3326 561 3374 560 3500 560 C 3609 560 3651 565 3760 565 L 4000 566",
    10: "M -2000 588 L -1760 588 C -1609 588 -1551 582 -1400 582 C -1266 582 -1214 587 -1080 587 L -700 587 C -574 587 -526 584 -400 584 C -240 584 -180 586 -20 586 L 0 586 L 240 588 C 391 588 449 582 600 582 C 734 582 786 587 920 587 L 1300 587 C 1426 587 1474 584 1600 584 C 1760 584 1820 586 1980 586 L 2000 586 L 2240 588 C 2391 588 2449 582 2600 582 C 2734 582 2786 587 2920 587 L 3300 587 C 3426 587 3474 584 3600 584 C 3760 584 3820 586 3980 586 L 4000 586"
  };
  var CLOUD = "M 18 30 C 8 30 5 18 18 14 C 20 4 40 4 46 14 C 52 4 72 4 78 14 C 90 8 110 18 105 30 C 116 32 116 44 100 42 C 96 50 76 48 70 40 C 64 50 40 50 34 40 C 22 44 6 42 18 30 Z";
  var CLOUDC = "M 18 30 C 8 30 5 18 18 14 C 20 4 40 4 46 14 C 52 4 72 4 78 14 C 90 8 110 18 105 30";

  /* ridge fill closes to the bottom; the curve is the open top edge for contours */
  function shape(i) { return W[i] + " L 4000 600 L -2000 600 Z"; }

  var LAYERS = [
    { n: 5, step: 14 }, { n: 6, step: 14 }, { n: 8, step: 13 }, { n: 12, step: 12 },
    { n: 14, step: 11 }, { n: 18, step: 10 }, { n: 12, step: 9 }, { n: 7, step: 8 },
    { n: 3, step: 7 }, { n: 2, step: 5 }
  ];
  var CLOUDS = [
    { t: "translate(180,12) scale(1.6)", o: .55, d: "0s" },
    { t: "translate(470,50) scale(1.0)", o: .78, d: "-2.8s" },
    { t: "translate(720,24) scale(1.25)", o: .88, d: "-5.4s" },
    { t: "translate(330,84) scale(0.8)", o: .70, d: "-1.6s" },
    { t: "translate(620,108) scale(0.92)", o: .66, d: "-4.0s" },
    { t: "translate(860,68) scale(0.7)", o: .82, d: "-6.8s" }
  ];

  function build(opts) {
    var vbw = (opts && opts.vbw) || 1000;
    var par = (opts && opts.par) || 'xMidYMid slice';
    var defs = '<defs>';
    for (var i = 1; i <= 10; i++) {
      defs += '<path id="mw' + i + '" d="' + shape(i) + '"/>';
      defs += '<path id="mw' + i + 'c" d="' + W[i] + '"/>';
    }
    defs += '<path id="mxy-cloud" d="' + CLOUD + '"/><path id="mxy-cloud-c" d="' + CLOUDC + '"/>';
    defs += '<clipPath id="mcloud-clip"><use href="#mxy-cloud"/></clipPath></defs>';

    var ridges = '';
    LAYERS.forEach(function (L, idx) {
      var i = idx + 1, contour = '';
      for (var k = 1; k <= L.n; k++) contour += '<use href="#mw' + i + 'c" y="' + (k * L.step).toFixed(2) + '"/>';
      /* fill and contours ride in SEPARATE flow groups sharing the same animation
         (same timeline + start = always in sync). The fill layer re-rasters at each
         4s palette step; the ~100 stroked contour paths now sit in their own cached
         composited layers and are never re-stroked. */
      ridges += '<g class="flow-' + i + '"><use href="#mw' + i + '" class="fill l' + i + '"/></g>'
        + '<g class="flow-' + i + '"><g class="contour">' + contour + '</g></g>';
    });

    var clouds = '';
    CLOUDS.forEach(function (c, idx) {
      var cc = '';
      for (var y = 5; y <= 25; y += 5) cc += '<use href="#mxy-cloud-c" y="' + y + '"/>';
      clouds += '<g class="cloud-' + (idx + 1) + '"><g class="cloud-bob" style="animation-delay:' + c.d + '">'
        + '<g transform="' + c.t + '"><g clip-path="url(#mcloud-clip)">'
        + '<use href="#mxy-cloud" fill="#EA6632" opacity="' + c.o + '"/>'
        + '<g class="cloud-contour">' + cc + '</g></g></g></g></g>';
    });

    return '<svg viewBox="0 0 ' + vbw + ' 600" preserveAspectRatio="' + par + '" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Mountain range">'
      + '<title>Layered mountain background</title>' + defs + ridges + clouds + '</svg>';
  }

  function init() {
    if (!document.getElementById('mtn-bg-css')) {
      var st = document.createElement('style');
      st.id = 'mtn-bg-css';
      st.textContent = CSS;
      document.head.appendChild(st);
    }
    document.querySelectorAll('.mtn-bg').forEach(function (el) {
      /* random palette starting point per page load (host may still pin --mtn-phase) */
      if (!el.style.getPropertyValue('--mtn-phase')) {
        el.style.setProperty('--mtn-phase', '-' + (Math.random() * 200).toFixed(1) + 's');
      }
      if (!el.firstElementChild) el.innerHTML = build({
        vbw: el.dataset.vbw ? +el.dataset.vbw : 1000,
        par: el.dataset.par || 'xMidYMid slice'
      });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
