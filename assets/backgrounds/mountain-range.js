/* BourneWise · animated mountain-range background (paper skin).
   Usage: place <div class="mtn-bg" aria-hidden="true"></div> anywhere and load
   this script. It injects the layered SVG, expands contour lines, and scopes its
   own CSS. Style the .mtn-bg box (position/size/opacity) from the host page.
   Eight parallax ridges flow at different speeds; six clouds drift over them. */
(function () {
  "use strict";

  var CSS = ''
    + '.mtn-bg{overflow:hidden;contain:strict}'
    + '.mtn-bg>svg{display:block;width:100%;height:100%}'
    /* eight ridges, each an 18-stop run through named, REAL
       colour references (film colourists/directors, heritage luxury
       houses, art movements, literary print) — 144 named systems
       total, not invented seasonal moods:
       mtn-youth: Nike swoosh orange, Supreme box-logo red, Adidas trefoil teal, Off-White safety orange, Gen-Z Y2K lime, Bubblegum pop pink, Bape camo green, Stussy sky blue, Skate-deck grip black-cherry, Uniqlo primary yellow, Crocs jibbitz coral, Aqua-neon rave cyan, Sanrio pastel lilac, 90s windbreaker cobalt, Highlighter chartreuse, Skittles candy purple, Vans checkerboard cream, A-Bathing-Ape shark blue
       mtn-noble: Hermès orange, Tiffany & Co robin's-egg blue, Cartier red-gold, Valentino red, Bottega Veneta parakeet green, Chanel noir, Gucci racing green, Burberry camel, Louis Vuitton monogram brown, Prada saffron, Bulgari serpenti emerald, Rolex crown green, Chopard rose gold, Goyard chevron ochre, Loro Piana cashmere taupe, Van Cleef malachite, Dior toile de Jouy indigo, Fendi ochre-gold
       mtn-winter: Nordic noir slate, Scandinavian birch-grey, The Revenant frost blue, Let the Right One In pale ice, Fargo snowfield white-grey, Insomnia arctic haze, IKEA cool blue, Marimekko frost teal, Aalto glacier green-grey, Finnish sauna cedar-grey, Reykjavik basalt black, Hoth ice-planet white, Narnia eternal-winter blue, Frozen Elsa ice-blue, December dusk navy, Glacial crevasse cyan, Whiteout blizzard grey, Polar-night indigo
       mtn-autumnwind: Godfather sepia amber, Malick golden-hour wheat, Norman Rockwell Americana rust, Autumn-in-New-England maple, Pumpkin-spice ochre, Harvest-moon amber, Vintage Kodachrome orange, Bourbon-barrel oak, Tobacco-leaf brown, Cornfield gold, Cider-mill cinnamon, Falling-leaves copper, New-England clapboard barn-red, Thanksgiving cranberry, Maple-syrup dark amber, Wool-plaid rust, Prairie wheat-field tan, Woodsmoke grey-brown
       mtn-springday: Monet water-lily lavender, Sakura cherry-blossom pink, Renoir soft rose, Kyoto spring moss, Easter pastel yellow, Ghibli meadow green, Monet garden violet, Degas ballet-pink, Studio-Ghibli sky pastel-blue, Hanami picnic cream, Provence lavender field, Matcha-latte green, Vermeer pearl-light cream, Renoir peach, Wisteria-arbor purple, Fresh-mint spring green, Peony blush, Robin's-egg spring blue
       mtn-summerflower: Almodóvar saturated magenta, Miami-vice neon coral, Rio-carnival fuchsia, Warhol pop-art orange, Frida Kahlo cobalt, Tropicalia hibiscus red, Havana pastel-lime, Bollywood saffron-magenta, Ibiza sunset violet, Wes-Anderson-tropical pink, Mardi-Gras purple-gold, Bougainvillea magenta, Lisbon azulejo cobalt-yellow, Tiki-bar tangerine, Barbie hot pink, Notting-Hill-Carnival orange, Piña-colada cream-gold, Flamingo-pink Miami
       mtn-literary: Old-library leather brown, Moleskine ink-brown, Antiquarian parchment tan, Hemingway-typewriter grey-brown, Fountain-pen sepia, New-Yorker cartoon cream, Gabriel-García-Márquez dust, Bodleian oak shelving, Vintage-postage-stamp ochre, First-edition cloth-binding maroon, Letterpress ink-black, Café-de-Flore café-au-lait, Proust madeleine gold-brown, Gothic-novel candle-amber, Editorial cream page, Ink-blotter navy-brown, Weathered map-parchment, Wax-seal burgundy
       mtn-twilight: Blade-Runner-2049 amber-haze, Drive synthwave magenta, Wong-Kar-wai neon dusk, Miami-noir violet, Casablanca sepia-dusk, Chinatown smog-amber, Blade-Runner-original teal-neon, Twin-Peaks red-room, Sin-City chiaroscuro, Vaporwave dusk-pink, Kubrick Shining hallway-amber, Le-Samouraï trench-grey-blue, Withnail-and-I dusk-brown, David-Lynch red-velvet, Fincher Se7en sickly-green-dusk, Old-Hollywood sunset-gold, Noir-alley rain-slick indigo, Tarkovsky Stalker rust-fog
       */
    + '@keyframes mtn-youth{0%,100%{fill:#FA6400}6%{fill:#DA291C}11%{fill:#00A19A}17%{fill:#FF6A00}22%{fill:#CCFF00}28%{fill:#FF6FB5}33%{fill:#5B7B4A}39%{fill:#4FA8D8}44%{fill:#8C1F3B}50%{fill:#FFD400}56%{fill:#FF7F6B}61%{fill:#00E5D1}67%{fill:#C9A6E0}72%{fill:#1E63C9}78%{fill:#D6FF3F}83%{fill:#8E4FCB}89%{fill:#F2EADF}94%{fill:#2E6FA8}}'
    + '@keyframes mtn-noble{0%,100%{fill:#F37021}6%{fill:#0ABAB5}11%{fill:#A6192E}17%{fill:#C41E3A}22%{fill:#2E7D32}28%{fill:#0B0B0B}33%{fill:#005C40}39%{fill:#C19A6B}44%{fill:#5A3A22}50%{fill:#D9A441}56%{fill:#0E4D3C}61%{fill:#00563F}67%{fill:#B76E79}72%{fill:#C58C3E}78%{fill:#8A7A6D}83%{fill:#0F5E44}89%{fill:#2A3E6B}94%{fill:#C99A3A}}'
    + '@keyframes mtn-winter{0%,100%{fill:#3E4A55}6%{fill:#B8BEC2}11%{fill:#7C93A3}17%{fill:#C6D6DE}22%{fill:#D8DEE2}28%{fill:#8FA3AE}33%{fill:#0058A3}39%{fill:#4E7C82}44%{fill:#7A928C}50%{fill:#6E625A}56%{fill:#2B2E33}61%{fill:#EAF1F4}67%{fill:#5D7C9E}72%{fill:#A8D4E0}78%{fill:#2E3D52}83%{fill:#9FC6D1}89%{fill:#C9D3D8}94%{fill:#25344A}}'
    + '@keyframes mtn-autumnwind{0%,100%{fill:#7A4A24}6%{fill:#D2A24C}11%{fill:#B5502C}17%{fill:#B23A1E}22%{fill:#C97A2E}28%{fill:#D68A3C}33%{fill:#C1622A}39%{fill:#7A4A1F}44%{fill:#6B4423}50%{fill:#D9A441}56%{fill:#9C5A28}61%{fill:#B5652E}67%{fill:#7B2D26}72%{fill:#8B2E2E}78%{fill:#8A5A1E}83%{fill:#A0522D}89%{fill:#C9A66B}94%{fill:#5A4A3F}}'
    + '@keyframes mtn-springday{0%,100%{fill:#B7A6D9}6%{fill:#F4C2D0}11%{fill:#E8B4BC}17%{fill:#8FB98A}22%{fill:#F7E6A3}28%{fill:#A8D5A2}33%{fill:#C6A6D9}39%{fill:#F0C8D4}44%{fill:#B8E0E8}50%{fill:#FAF0DC}56%{fill:#9B8AC4}61%{fill:#B4C98A}67%{fill:#F2E8D5}72%{fill:#F2C6A0}78%{fill:#A98AC4}83%{fill:#A8E0C4}89%{fill:#F0A8C0}94%{fill:#A8D8E0}}'
    + '@keyframes mtn-summerflower{0%,100%{fill:#E0447A}6%{fill:#FF6B5C}11%{fill:#E63E8F}17%{fill:#FF7A3D}22%{fill:#1E5FA8}28%{fill:#E63E6D}33%{fill:#B8E066}39%{fill:#F2578F}44%{fill:#9B4FCC}50%{fill:#FFAA5C}56%{fill:#8F3FC7}61%{fill:#C0308F}67%{fill:#F0679E}72%{fill:#FF8F5C}78%{fill:#E0218A}83%{fill:#FF7A3D}89%{fill:#F5D48A}94%{fill:#FF7AA8}}'
    + '@keyframes mtn-literary{0%,100%{fill:#6E5A50}6%{fill:#4A3A32}11%{fill:#B39A8B}17%{fill:#8A7264}22%{fill:#5E4A3F}28%{fill:#D9C4B0}33%{fill:#9E8779}39%{fill:#63504A}44%{fill:#AC8F7E}50%{fill:#6B3A3A}56%{fill:#2E2622}61%{fill:#957C6E}67%{fill:#B0937F}72%{fill:#8A6A3E}78%{fill:#EDE3D3}83%{fill:#4A4038}89%{fill:#C4B296}94%{fill:#6B2A38}}'
    + '@keyframes mtn-twilight{0%,100%{fill:#C77B5E}6%{fill:#B56A7E}11%{fill:#8E5A73}17%{fill:#5E4A7A}22%{fill:#8A6A52}28%{fill:#A6674F}33%{fill:#4E7C82}39%{fill:#5A2A32}44%{fill:#2E1F32}50%{fill:#C6795F}56%{fill:#B58A5C}61%{fill:#5A6472}67%{fill:#6E4E4A}72%{fill:#5A2432}78%{fill:#5A5E3F}83%{fill:#C6975F}89%{fill:#3F2A3D}94%{fill:#7A5843}}'
    + '@keyframes mtn-cloud-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}'
    + '@keyframes mtn-flow-l{from{transform:translate3d(0,0,0)}to{transform:translate3d(-2000px,0,0)}}'
    + '@keyframes mtn-flow-r{from{transform:translate3d(0,0,0)}to{transform:translate3d(2000px,0,0)}}'
    + '@keyframes mtn-cloud-r{from{transform:translate3d(-1700px,0,0)}to{transform:translate3d(1700px,0,0)}}'
    + '@keyframes mtn-cloud-l{from{transform:translate3d(1700px,0,0)}to{transform:translate3d(-1700px,0,0)}}'
    /* fill is a PAINT property: animating it forces a full re-raster of these huge ridge
       textures every frame. The colour shift is so slow that stepping it (≈4 jumps/sec)
       is visually identical but cuts re-paints ~15x. translate flows stay GPU-composited. */
    + '.mtn-bg .fill{animation-iteration-count:infinite;animation-timing-function:steps(30)}'
    + '.mtn-bg [class^="flow-"]{will-change:transform}'
    + '.mtn-bg .cloud-bob{animation:mtn-cloud-bob 8s ease-in-out infinite}'
    + '.mtn-bg .contour use,.mtn-bg .cloud-contour use{fill:none;stroke:rgba(0,0,0,0.24);stroke-width:1.2}'
    + '.mtn-bg .l1{animation-name:mtn-youth;animation-duration:56s;animation-delay:-22s;opacity:.52}'
    + '.mtn-bg .l2{animation-name:mtn-noble;animation-duration:52s;animation-delay:-4s;opacity:.70}'
    + '.mtn-bg .l3{animation-name:mtn-winter;animation-duration:48s;animation-delay:-11s;opacity:.85}'
    + '.mtn-bg .l4{animation-name:mtn-autumnwind;animation-duration:44s;animation-delay:-7s;opacity:.92}'
    + '.mtn-bg .l5{animation-name:mtn-springday;animation-duration:40s;animation-delay:-15s;opacity:.97}'
    + '.mtn-bg .l6{animation-name:mtn-summerflower;animation-duration:60s;animation-delay:-28s;opacity:1}'
    + '.mtn-bg .l7{animation-name:mtn-literary;animation-duration:50s;animation-delay:-33s;opacity:1}'
    + '.mtn-bg .l8{animation-name:mtn-twilight;animation-duration:64s;animation-delay:-9s;opacity:1}'
    + '.mtn-bg .flow-1{animation:mtn-flow-l 140s linear infinite}.mtn-bg .flow-2{animation:mtn-flow-r 116s linear infinite}'
    + '.mtn-bg .flow-3{animation:mtn-flow-l 98s linear infinite}.mtn-bg .flow-4{animation:mtn-flow-r 82s linear infinite}'
    + '.mtn-bg .flow-5{animation:mtn-flow-l 70s linear infinite}.mtn-bg .flow-6{animation:mtn-flow-r 58s linear infinite}'
    + '.mtn-bg .flow-7{animation:mtn-flow-l 46s linear infinite}.mtn-bg .flow-8{animation:mtn-flow-r 36s linear infinite}'
    + '.mtn-bg .cloud-1{animation:mtn-cloud-r 120s linear infinite}.mtn-bg .cloud-2{animation:mtn-cloud-l 96s linear infinite}'
    + '.mtn-bg .cloud-3{animation:mtn-cloud-r 74s linear -30s infinite}.mtn-bg .cloud-4{animation:mtn-cloud-l 132s linear -18s infinite}'
    + '.mtn-bg .cloud-5{animation:mtn-cloud-r 104s linear -50s infinite}.mtn-bg .cloud-6{animation:mtn-cloud-l 84s linear -12s infinite}'
    + '@media(prefers-reduced-motion:reduce){.mtn-bg path,.mtn-bg g,.mtn-bg use{animation:none!important}}';

  var W = {
    1: "M -2000 188 L -1860 186 C -1777 186 -1763 150 -1680 150 C -1570 150 -1550 178 -1440 178 L -1240 178 C -1176 178 -1164 166 -1100 166 C -1045 166 -1035 188 -980 188 L -780 195 C -660 195 -640 144 -520 144 C -428 144 -412 189 -320 189 L 0 184 L 140 186 C 223 186 237 150 320 150 C 430 150 450 178 560 178 L 760 178 C 824 178 836 166 900 166 C 955 166 965 188 1020 188 L 1220 195 C 1340 195 1360 144 1480 144 C 1572 144 1588 189 1680 189 L 2000 184 L 2140 186 C 2223 186 2237 150 2320 150 C 2430 150 2450 178 2560 178 L 2760 178 C 2824 178 2836 166 2900 166 C 2955 166 2965 188 3020 188 L 3220 195 C 3340 195 3360 144 3480 144 C 3572 144 3588 189 3680 189 L 4000 184",
    2: "M -2000 270 L -1960 269 C -1872 269 -1848 214 -1760 214 C -1690 214 -1670 263 -1600 263 L -1330 258 C -1261 258 -1249 232 -1180 232 C -1074 232 -1056 265 -950 265 L -870 268 C -795 268 -775 205 -700 205 C -638 205 -622 277 -560 277 L -360 273 C -307 273 -293 240 -240 240 C -161 240 -139 267 -60 267 L 0 266 L 40 269 C 128 269 152 214 240 214 C 310 214 330 263 400 263 L 670 258 C 739 258 751 232 820 232 C 926 232 944 265 1050 265 L 1130 268 C 1205 268 1225 205 1300 205 C 1362 205 1378 277 1440 277 L 1640 273 C 1693 273 1707 240 1760 240 C 1839 240 1861 267 1940 267 L 2000 266 L 2040 269 C 2128 269 2152 214 2240 214 C 2310 214 2330 263 2400 263 L 2670 258 C 2739 258 2751 232 2820 232 C 2926 232 2944 265 3050 265 L 3130 268 C 3205 268 3225 205 3300 205 C 3362 205 3378 277 3440 277 L 3640 273 C 3693 273 3707 240 3760 240 C 3839 240 3861 267 3940 267 L 4000 266",
    3: "M -2000 374 L -1880 372 C -1742 372 -1718 282 -1580 282 C -1479 282 -1461 364 -1360 364 L -980 361 C -855 361 -845 308 -720 308 C -547 308 -533 368 -360 368 L 0 372 L 120 372 C 258 372 282 282 420 282 C 521 282 539 364 640 364 L 1020 361 C 1145 361 1155 308 1280 308 C 1453 308 1467 368 1640 368 L 2000 372 L 2120 372 C 2258 372 2282 282 2420 282 C 2521 282 2539 364 2640 364 L 3020 361 C 3145 361 3155 308 3280 308 C 3453 308 3467 368 3640 368 L 4000 372",
    4: "M -2000 440 L -1910 438 C -1835 438 -1815 356 -1740 356 C -1683 356 -1667 434 -1610 434 L -1320 432 C -1256 432 -1244 380 -1180 380 C -1093 380 -1077 440 -990 440 L -740 446 C -630 446 -610 340 -500 340 C -408 340 -392 441 -300 441 L 0 436 L 90 438 C 165 438 185 356 260 356 C 317 356 333 434 390 434 L 680 432 C 744 432 756 380 820 380 C 907 380 923 440 1010 440 L 1260 446 C 1370 446 1390 340 1500 340 C 1592 340 1608 441 1700 441 L 2000 436 L 2090 438 C 2165 438 2185 356 2260 356 C 2317 356 2333 434 2390 434 L 2680 432 C 2744 432 2756 380 2820 380 C 2907 380 2923 440 3010 440 L 3260 446 C 3370 446 3390 340 3500 340 C 3592 340 3608 441 3700 441 L 4000 436",
    5: "M -2000 500 L -1690 498 C -1602 498 -1568 330 -1480 330 C -1413 330 -1387 496 -1320 496 L -820 495 C -723 495 -697 366 -600 366 C -468 366 -432 498 -300 498 L 0 500 L 310 498 C 398 498 432 330 520 330 C 587 330 613 496 680 496 L 1180 495 C 1277 495 1303 366 1400 366 C 1532 366 1568 498 1700 498 L 2000 500 L 2310 498 C 2398 498 2432 330 2520 330 C 2587 330 2613 496 2680 496 L 3180 495 C 3277 495 3303 366 3400 366 C 3532 366 3568 498 3700 498 L 4000 500",
    6: "M -2000 538 L -1840 536 C -1752 536 -1728 512 -1640 512 C -1570 512 -1550 533 -1480 533 L -1150 531 C -1081 531 -1069 520 -1000 520 C -903 520 -887 538 -790 538 L -540 543 C -461 543 -439 508 -360 508 C -298 508 -282 538 -220 538 L 0 534 L 160 536 C 248 536 272 512 360 512 C 430 512 450 533 520 533 L 850 531 C 919 531 931 520 1000 520 C 1097 520 1113 538 1210 538 L 1460 543 C 1539 543 1561 508 1640 508 C 1702 508 1718 538 1780 538 L 2000 534 L 2160 536 C 2248 536 2272 512 2360 512 C 2430 512 2450 533 2520 533 L 2850 531 C 2919 531 2931 520 3000 520 C 3097 520 3113 538 3210 538 L 3460 543 C 3539 543 3561 508 3640 508 C 3702 508 3718 538 3780 538 L 4000 534",
    7: "M -2000 568 L -1780 566 C -1662 566 -1618 556 -1500 556 C -1366 556 -1314 561 -1180 561 L -800 561 C -674 561 -626 560 -500 560 C -391 560 -349 565 -240 565 L 0 566 L 220 566 C 338 566 382 556 500 556 C 634 556 686 561 820 561 L 1200 561 C 1326 561 1374 560 1500 560 C 1609 560 1651 565 1760 565 L 2000 566 L 2220 566 C 2338 566 2382 556 2500 556 C 2634 556 2686 561 2820 561 L 3200 561 C 3326 561 3374 560 3500 560 C 3609 560 3651 565 3760 565 L 4000 566",
    8: "M -2000 588 L -1760 588 C -1609 588 -1551 582 -1400 582 C -1266 582 -1214 587 -1080 587 L -700 587 C -574 587 -526 584 -400 584 C -240 584 -180 586 -20 586 L 0 586 L 240 588 C 391 588 449 582 600 582 C 734 582 786 587 920 587 L 1300 587 C 1426 587 1474 584 1600 584 C 1760 584 1820 586 1980 586 L 2000 586 L 2240 588 C 2391 588 2449 582 2600 582 C 2734 582 2786 587 2920 587 L 3300 587 C 3426 587 3474 584 3600 584 C 3760 584 3820 586 3980 586 L 4000 586"
  };
  var CLOUD = "M 18 30 C 8 30 5 18 18 14 C 20 4 40 4 46 14 C 52 4 72 4 78 14 C 90 8 110 18 105 30 C 116 32 116 44 100 42 C 96 50 76 48 70 40 C 64 50 40 50 34 40 C 22 44 6 42 18 30 Z";
  var CLOUDC = "M 18 30 C 8 30 5 18 18 14 C 20 4 40 4 46 14 C 52 4 72 4 78 14 C 90 8 110 18 105 30";

  /* ridge fill closes to the bottom; the curve is the open top edge for contours */
  function shape(i) { return W[i] + " L 4000 600 L -2000 600 Z"; }

  var LAYERS = [
    { n: 5, step: 14 }, { n: 8, step: 13 }, { n: 12, step: 12 }, { n: 14, step: 11 },
    { n: 18, step: 10 }, { n: 7, step: 8 }, { n: 3, step: 7 }, { n: 2, step: 5 }
  ];
  var CLOUDS = [
    { t: "translate(180,42) scale(1.6)", o: .55, d: "0s" },
    { t: "translate(470,86) scale(1.0)", o: .78, d: "-2.8s" },
    { t: "translate(720,58) scale(1.25)", o: .88, d: "-5.4s" },
    { t: "translate(330,120) scale(0.8)", o: .70, d: "-1.6s" },
    { t: "translate(620,150) scale(0.92)", o: .66, d: "-4.0s" },
    { t: "translate(860,108) scale(0.7)", o: .82, d: "-6.8s" }
  ];

  function build(opts) {
    var vbw = (opts && opts.vbw) || 1000;
    var par = (opts && opts.par) || 'xMidYMid slice';
    var defs = '<defs>';
    for (var i = 1; i <= 8; i++) {
      defs += '<path id="mw' + i + '" d="' + shape(i) + '"/>';
      defs += '<path id="mw' + i + 'c" d="' + W[i] + '"/>';
    }
    defs += '<path id="mxy-cloud" d="' + CLOUD + '"/><path id="mxy-cloud-c" d="' + CLOUDC + '"/>';
    defs += '<clipPath id="mcloud-clip"><use href="#mxy-cloud"/></clipPath></defs>';

    var ridges = '';
    LAYERS.forEach(function (L, idx) {
      var i = idx + 1, contour = '';
      for (var k = 1; k <= L.n; k++) contour += '<use href="#mw' + i + 'c" y="' + (k * L.step).toFixed(2) + '"/>';
      ridges += '<g class="flow-' + i + '"><use href="#mw' + i + '" class="fill l' + i + '"/>'
        + '<g class="contour">' + contour + '</g></g>';
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
      if (!el.firstElementChild) el.innerHTML = build({
        vbw: el.dataset.vbw ? +el.dataset.vbw : 1000,
        par: el.dataset.par || 'xMidYMid slice'
      });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
