/* BourneWise · animated mountain-range background (paper skin).
   Usage: place <div class="mtn-bg" aria-hidden="true"></div> anywhere and load
   this script. It injects the layered SVG, expands contour lines, and scopes its
   own CSS. Style the .mtn-bg box (position/size/opacity) from the host page.
   Ten parallax ridges flow at different speeds; six clouds drift over them. */
(function () {
  "use strict";

  var scriptSrc = document.currentScript && document.currentScript.src;
  var paletteUrl = scriptSrc
    ? new URL("../palettes/color-groups-180.json?v=20260801d", scriptSrc).href
    : "./assets/palettes/color-groups-180.json?v=20260801d";
  var paletteDwellMs = 15000;
  var paletteStep = 47;
  var palettePriorityWeight = 5;
  var palettePrioritySegments = {
    "近白段": true,
    "金赭段": true,
    "蓝靛段": true
  };
  var paletteScheduleSlots = 500;
  var paletteTimer = 0;


  var CSS = ''
    + '.mtn-bg{overflow:hidden;contain:strict}'
    + '.mtn-bg>svg{display:block;width:100%;height:100%}'
    /* The sky and ten ridges receive exact colours from the external 180-group
       source. JavaScript changes them once per 15-second slot; there is no
       perpetual fill animation or duplicate palette packed into this file. */
    + '.mtn-sky{position:fixed;inset:0;z-index:0;pointer-events:none}'
    + '@keyframes mtn-cloud-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}'
    + '@keyframes mtn-flow-l{from{transform:translate3d(0,0,0)}to{transform:translate3d(-2000px,0,0)}}'
    + '@keyframes mtn-flow-r{from{transform:translate3d(0,0,0)}to{transform:translate3d(2000px,0,0)}}'
    + '@keyframes mtn-cloud-r{from{transform:translate3d(-1700px,0,0)}to{transform:translate3d(1700px,0,0)}}'
    + '@keyframes mtn-cloud-l{from{transform:translate3d(1700px,0,0)}to{transform:translate3d(-1700px,0,0)}}'
    + '.mtn-bg [class^="flow-"]{will-change:auto}'
    + '.mtn-bg .cloud-bob{animation:none}'
    /* Anthropic-art line language: warm near-black, rounded brush ends and a
       deliberately uneven cadence of weights rather than technical hairlines. */
    + '.mtn-bg .contour use,.mtn-bg .cloud-contour use{fill:none;stroke:rgba(20,20,19,.28);stroke-width:2;stroke-linecap:round;stroke-linejoin:round;vector-effect:non-scaling-stroke}'
    + '.mtn-bg .contour use:nth-child(3n+1){stroke-width:1.55;opacity:.72}'
    + '.mtn-bg .contour use:nth-child(3n+2){stroke-width:2.45;opacity:.5}'
    + '.mtn-bg .contour use:nth-child(3n){stroke-width:1.9;opacity:.62}'
    /* LINE-ART mode — add class "line-art" to .mtn-bg. The filled ridges drop
       out and only the contour lines remain: a clean topographic line-drawing
       of the range, so text pages keep the living, moving backdrop without any
       coloured wash competing with the words. */
    + '.mtn-bg.line-art .fill{opacity:.62;transition:opacity 1s cubic-bezier(.16,1,.3,1)}'
    + '.mtn-bg.line-art [clip-path]>use{opacity:.5;transition:opacity 1s cubic-bezier(.16,1,.3,1)}'
    + '.mtn-bg.line-art .contour use,.mtn-bg.line-art .cloud-contour use{stroke:rgba(20,20,19,.3)}'
    /* ENTRANCE FLOOD — on page arrival the range pours up into place. init()
       holds line-art off for a beat so the coloured ridges surge in, then adds
       line-art so the colour recedes and leaves the line-drawing: background
       floods in, then fades to rest. Transform-only sweep = GPU cheap. */
    + '.mtn-bg.mtn-enter{animation:mtn-enter 1.15s cubic-bezier(.16,1,.3,1) both}'
    + '@keyframes mtn-enter{from{transform:translateY(38px) scale(1.06)}to{transform:none}}'
    + '.mtn-bg .l1{opacity:.48}.mtn-bg .l2{opacity:.60}.mtn-bg .l3{opacity:.72}.mtn-bg .l4{opacity:.83}'
    + '.mtn-bg .l5{opacity:.90}.mtn-bg .l6{opacity:.95}.mtn-bg .l7{opacity:.97}'
    + '.mtn-bg .l8,.mtn-bg .l9,.mtn-bg .l10{opacity:1}'
    + '.mtn-bg .flow-1{animation:mtn-flow-l 145s linear infinite}.mtn-bg .flow-2{animation:mtn-flow-r 128s linear infinite}'
    + '.mtn-bg .flow-3{animation:mtn-flow-l 112s linear infinite}.mtn-bg .flow-4{animation:mtn-flow-r 96s linear infinite}'
    + '.mtn-bg .flow-5{animation:mtn-flow-l 82s linear infinite}.mtn-bg .flow-6{animation:mtn-flow-r 70s linear infinite}'
    + '.mtn-bg .flow-7{animation:mtn-flow-l 58s linear infinite}.mtn-bg .flow-8{animation:mtn-flow-r 48s linear infinite}'
    + '.mtn-bg .flow-9{animation:mtn-flow-l 40s linear infinite}.mtn-bg .flow-10{animation:mtn-flow-r 32s linear infinite}'
    + '.mtn-bg .cloud-1{animation:mtn-cloud-r 120s linear infinite}.mtn-bg .cloud-2{animation:mtn-cloud-l 96s linear infinite}'
    + '.mtn-bg .cloud-3{animation:mtn-cloud-r 74s linear -30s infinite}.mtn-bg .cloud-4{animation:mtn-cloud-l 132s linear -18s infinite}'
    + '.mtn-bg .cloud-5{animation:mtn-cloud-r 104s linear -50s infinite}.mtn-bg .cloud-6{animation:mtn-cloud-l 84s linear -12s infinite}'
    /* Lightweight motion profile: keep the scene alive with three slow ridge
       planes and two clouds. The remaining artwork is static, so extension-heavy
       Chromium profiles do not have to composite sixteen perpetual animations. */
    + '.mtn-bg .fill{animation:none;fill:#D9C9A5}'
    + '.mtn-bg .l1,.mtn-bg .l2{fill:#F3EBDD}.mtn-bg .l3,.mtn-bg .l4{fill:#E9DDC5}.mtn-bg .l5,.mtn-bg .l6{fill:#DCC8A7}.mtn-bg .l7,.mtn-bg .l8{fill:#CDB28A}.mtn-bg .l9,.mtn-bg .l10{fill:#B9956E}'
    + '.mtn-bg [class^="flow-"]{animation:none;will-change:auto}'
    + '.mtn-bg .flow-3{animation:mtn-flow-l 240s linear infinite;will-change:transform}'
    + '.mtn-bg .flow-6{animation:mtn-flow-r 210s linear infinite;will-change:transform}'
    + '.mtn-bg .flow-9{animation:mtn-flow-l 280s linear infinite;will-change:transform}'
    + '.mtn-bg [class^="cloud-"]{animation:none}'
    + '.mtn-bg .cloud-2{animation:mtn-cloud-l 210s linear infinite;will-change:transform}'
    + '.mtn-bg .cloud-5{animation:mtn-cloud-r 240s linear -50s infinite;will-change:transform}'
    + '@media(prefers-reduced-motion:reduce){.mtn-bg path,.mtn-bg g,.mtn-bg use,.mtn-sky{animation:none!important}}';

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

  /* Fewer, less evenly spaced strokes read as a hand-drawn landscape instead
     of a technical contour map. The foreground remains denser, but no plane
     becomes a grey wall of repeated hairlines. */
  var LAYERS = [
    { n: 3, step: 19 }, { n: 3, step: 18 }, { n: 4, step: 17 }, { n: 5, step: 16 },
    { n: 6, step: 14 }, { n: 7, step: 13 }, { n: 5, step: 12 }, { n: 4, step: 11 },
    { n: 3, step: 9 }, { n: 2, step: 7 }
  ];
  var LINE_WOBBLE = [0, 2.8, -1.6, 1.2, -2.4, 2.1, -.8];
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
      for (var k = 1; k <= L.n; k++) {
        var offset = k * L.step + LINE_WOBBLE[(k + i) % LINE_WOBBLE.length];
        contour += '<use href="#mw' + i + 'c" y="' + offset.toFixed(2) + '"/>';
      }
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
      [7, 15.5, 22].forEach(function (y) { cc += '<use href="#mxy-cloud-c" y="' + y + '"/>'; });
      clouds += '<g class="cloud-' + (idx + 1) + '"><g class="cloud-bob" style="animation-delay:' + c.d + '">'
        + '<g transform="' + c.t + '"><g clip-path="url(#mcloud-clip)">'
        + '<use href="#mxy-cloud" fill="#EA6632" opacity="' + c.o + '"/>'
        + '<g class="cloud-contour">' + cc + '</g></g></g></g></g>';
    });

    return '<svg viewBox="0 0 ' + vbw + ' 600" preserveAspectRatio="' + par + '" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Mountain range">'
      + '<title>Layered mountain background</title>' + defs + ridges + clouds + '</svg>';
  }

  function srgbChannel(v) {
    v /= 255;
    return v <= .04045 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4);
  }

  function luminance(hex) {
    var n = parseInt(hex.slice(1), 16);
    return .2126 * srgbChannel(n >> 16)
      + .7152 * srgbChannel((n >> 8) & 255)
      + .0722 * srgbChannel(n & 255);
  }

  function readableOn(hex) {
    var l = luminance(hex);
    return (1.05 / (l + .05)) >= ((l + .05) / .05) ? "#FAF9F5" : "#141413";
  }

  function validPaletteGroup(group) {
    return group && typeof group.id === "string"
      && typeof group.cloud === "string"
      && Array.isArray(group.rows) && group.rows.length === 10
      && group.rows.every(function (hex) { return /^#[0-9a-f]{6}$/i.test(hex); });
  }

  /* The source file is an art-palette catalogue, not a set of equally reliable
     product themes. Near-white, gold/ochre and blue/indigo groups carry the
     calmest combinations, so they receive five slots each. Every other group
     keeps one slot: nothing is banned, but the heavier purple/green collisions
     become occasional accents instead of the site's default atmosphere. */
  function buildPaletteSchedule(groups) {
    var schedule = [];
    groups.forEach(function (group) {
      var weight = palettePrioritySegments[group.seg] ? palettePriorityWeight : 1;
      for (var i = 0; i < weight; i++) schedule.push(group);
    });
    return schedule;
  }

  function applyPalette(group) {
    var root = document.documentElement;
    var gemIndex = Array.isArray(group.gems) && group.gems.length
      ? Math.max(0, Math.min(9, group.gems[0] - 1))
      : 5;
    root.dataset.bwPalette = group.id;
    root.dataset.bwPaletteName = group.name || "";
    root.dataset.bwPaletteSegment = group.seg || "";
    root.style.setProperty("--bw-palette-cloud", group.cloud);
    group.rows.forEach(function (hex, index) {
      root.style.setProperty("--bw-palette-" + (index + 1), hex);
      root.style.setProperty("--bw-palette-on-" + (index + 1), readableOn(hex));
    });
    root.style.setProperty("--bw-palette-gem", group.rows[gemIndex]);
    root.style.setProperty("--bw-palette-on-gem", readableOn(group.rows[gemIndex]));

    document.querySelectorAll(".mtn-bg").forEach(function (el) {
      group.rows.forEach(function (hex, index) {
        el.querySelectorAll(".fill.l" + (index + 1)).forEach(function (node) {
          node.style.fill = hex;
        });
      });
      el.querySelectorAll("[clip-path] > use").forEach(function (node) {
        node.style.fill = group.cloud;
      });
    });

    window.dispatchEvent(new CustomEvent("bw:palettechange", {
      detail: { id: group.id, name: group.name, segment: group.seg }
    }));
  }

  function startPaletteSystem(clockStart, reduce) {
    fetch(paletteUrl, { cache: "force-cache" })
      .then(function (response) {
        if (!response.ok) throw new Error("Palette data " + response.status);
        return response.json();
      })
      .then(function (groups) {
        if (!Array.isArray(groups) || groups.length !== 180 || !groups.every(validPaletteGroup)) {
          throw new Error("Palette data failed validation");
        }
        var schedule = buildPaletteSchedule(groups);
        if (schedule.length !== paletteScheduleSlots) {
          throw new Error("Palette schedule failed validation");
        }
        function update() {
          var slot = Math.floor((Date.now() - clockStart) / paletteDwellMs);
          var index = ((slot * paletteStep) % schedule.length + schedule.length) % schedule.length;
          applyPalette(schedule[index]);
          if (!reduce) {
            clearTimeout(paletteTimer);
            paletteTimer = setTimeout(update, paletteDwellMs - ((Date.now() - clockStart) % paletteDwellMs) + 32);
          }
        }
        update();
      })
      .catch(function (error) {
        document.documentElement.dataset.bwPalette = "fallback";
        if (window.console && console.warn) console.warn("[BourneWise palette]", error.message);
      });
  }

  function init() {
    if (!document.getElementById('mtn-bg-css')) {
      var st = document.createElement('style');
      st.id = 'mtn-bg-css';
      st.textContent = CSS;
      document.head.appendChild(st);
    }
    var reduce = matchMedia('(prefers-reduced-motion:reduce)').matches;
    var cycleMs = paletteDwellMs * paletteScheduleSlots;
    var clockKey = 'bw-palette-clock-v3';
    var seenKey = 'bw-mtn-seen';
    var clockStart;
    var seen = false;
    try {
      clockStart = +(sessionStorage.getItem(clockKey) || 0);
      if (!clockStart) {
        clockStart = Date.now() - Math.random() * cycleMs;
        sessionStorage.setItem(clockKey, String(clockStart));
      }
      seen = sessionStorage.getItem(seenKey) === '1';
      sessionStorage.setItem(seenKey, '1');
    } catch (e) {
      clockStart = Date.now() - Math.random() * cycleMs;
    }
    var sharedPhase = -(((Date.now() - clockStart) % cycleMs) / 1000);
    document.querySelectorAll('.mtn-bg').forEach(function (el) {
      /* One session-wide clock keeps the palette continuous across documents.
         A new page resumes the current frame instead of choosing a new colour. */
      if (!el.style.getPropertyValue('--mtn-phase')) {
        el.style.setProperty('--mtn-phase', sharedPhase.toFixed(1) + 's');
      }
      /* rotating page field on the SAME clock, painted behind the ridges */
      if (el.previousElementSibling == null || !el.previousElementSibling.classList.contains('mtn-sky')) {
        var sky = document.createElement('div');
        sky.className = 'mtn-sky';
        sky.setAttribute('aria-hidden', 'true');
        sky.style.setProperty('--mtn-phase', el.style.getPropertyValue('--mtn-phase'));
        el.parentNode.insertBefore(sky, el);
      }
      if (!el.firstElementChild) el.innerHTML = build({
        vbw: el.dataset.vbw ? +el.dataset.vbw : 1000,
        par: el.dataset.par || 'xMidYMid slice'
      });

      /* entrance flood: on a line-art backdrop, hold the line-art off for a
         beat so the coloured ridges pour in, then restore it so the colour
         fades to the resting line-drawing. Pure enhancement; reduced-motion
         and no-JS keep the static line-art the HTML already declares. */
      if (!reduce && !seen && el.classList.contains('line-art')) {
        el.classList.remove('line-art');
        el.classList.add('mtn-enter');
        setTimeout(function () { el.classList.add('line-art'); }, 760);
        setTimeout(function () { el.classList.remove('mtn-enter'); }, 1200);
      }
    });
    startPaletteSystem(clockStart, reduce);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
