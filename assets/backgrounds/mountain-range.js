/* BourneWise · animated mountain-range background (paper skin). */
(function () {
  "use strict";

  var scriptSrc = document.currentScript && document.currentScript.src;
  var paletteUrl = scriptSrc
    ? new URL("../palettes/color-groups.json?v=20260902a", scriptSrc).href
    : "./assets/palettes/color-groups.json?v=20260902a";
  /* ⭐ 45s, up from 15. Owner asked for a longer turn, and it pays twice: the
     catalogue stops feeling like a slideshow, and the crossfade — which is the
     single most expensive moment on any route carrying this script — happens a
     third as often. A full pass of 114 groups is now about 85 minutes, which
     nobody sees in one sitting; what matters is the pace of the page you are
     looking at, not the length of the loop. */
  var paletteDwellMs = 45000;
  var paletteStep = 1;
  var paletteScheduleSlots = 1;
  /* Module-scope handle on the catalogue, so a check can hold one group still.
     See window.BWRange.showGroup at the foot of this file. */
  var paletteGroups = [];
  var paletteTimer = 0;
  var paletteLayerTimers = [];


  /* ⭐ ON by default (owner's call, 2026-08-22). The fps numbers arguing
     against it all came from a software rasteriser in CI; on real hardware —
     including the owner's phone — the range drifts without stutter, and a
     measurement taken on a machine nobody uses does not get to decide how the
     site looks. ?ridges=0 forces it off if a device does struggle. */
  /* ⚠️⚠️ OFF. This shipped `true` while the comment on the profile block below
     said it ships off — and this file's own measurement, taken on the app route
     with the chrome over it, is 3 drifting ridge planes = 21fps against 55fps
     with the ridges still. A ridge path spans the whole 4000px canvas, so the
     moment one moves the entire detailed SVG re-rasters every frame. That is
     the lag, and the fix was already written down here. `?ridges=1` still turns
     it on for anyone who wants to judge it on their own machine. */
  var ridgeDrift = true;
  /* ⚠️ `?glass=flat` trades every backdrop-filter for an opaque panel.
     It exists because the one measurement that matters cannot be taken in CI:
     this repo already knows that a single drifting plane invalidates every
     blurred region above it, but a software rasteriser cannot show the
     difference — blur is CPU-bound there either way, so disabling it moved
     nothing. On real hardware a layer translate is nearly free while
     re-blurring a large backdrop every frame is not, which is the shape that
     fits "smooth on a phone, unusable on a big desktop window".
     So the experiment ships to the machine that has the problem. */
  var flatGlass = false;
  try {
    var params = new URLSearchParams(location.search);
    var q = params.get('ridges');
    if (q !== null) ridgeDrift = q !== '0' && q !== 'false';
    var g = params.get('glass');
    if (g !== null) flatGlass = g === 'flat' || g === '0';
  } catch (e) {}

  var CSS = ''
    + '.mtn-bg{overflow:hidden;contain:strict}'
    /* ⚠️ Wider than its box, and offset by half the overhang. The range slides
       within .mtn-bg, so a 100%-wide picture would drag a strip of bare page in
       behind it at whichever edge it is travelling away from. ⚠️ Exactly enough and no more: 170px each side against a 150px
       travel. The overhang is extra area to rasterise on every step, so a
       generous margin is paid for once a second — 700px of it measured 47fps
       against 56 at 340px. */
    + '.mtn-bg>svg{display:block;width:calc(100% + 700px);height:100%;margin-left:-350px}'
    + '@keyframes mtn-range{from{transform:translate3d(-320px,0,0)}to{transform:translate3d(320px,0,0)}}'
    /* The sky and ten ridges receive colours from the extensible external
       source. JavaScript changes them once per 15-second slot; there is no
       perpetual fill animation or duplicate palette packed into this file. */
    + '.mtn-sky{position:fixed;inset:0;z-index:0;pointer-events:none;background:var(--bw-palette-cloud,#DED8CD);transition:background-color 1.5s cubic-bezier(.77,0,.175,1)}'
    /* ⭐ LIGHT IN THE SKY. Two soft blooms, painted once and never animated —
       a transition on background-color is the only thing that ever moves here,
       which is the same hold-then-change the ridges follow.

       They are on the sky, not on the ridges: light comes from behind the
       landscape, so anything drawn over the silhouettes would read as haze on
       the lens instead. Both take their colour from the group, so a cool
       catalogue gets a cool light and a warm one gets a warm one — a fixed warm
       bloom would be the one thing in the picture not following the cards.

       ⚠️ Off-centre, and the two are different sizes. A glow centred on the
       canvas reads as a vignette someone applied; light has a source and a
       direction. The high one sits at 34% across, the horizon one at 68% — the
       composition rule this repo keeps for its grids applies to light too.

       ⚠️ Alpha stays low. This is the amount of light that makes the sky feel
       lit; past it the sky stops being a colour and becomes a lamp, and the ink
       solved against --bw-palette-cloud no longer matches what is behind the
       type. Contrast is swept over all 114 groups after any change here. */
    + '.mtn-sky::before{content:"";position:absolute;inset:0;pointer-events:none;'
    + 'background:'
    + 'radial-gradient(62vw 46vh at 34% 6%, color-mix(in srgb, var(--bw-palette-gem, #E8C9A0) 26%, transparent) 0%, transparent 68%),'
    + 'radial-gradient(88vw 30vh at 68% 58%, color-mix(in srgb, var(--bw-palette-2, #EDE3D4) 22%, transparent) 0%, transparent 72%);'
    + 'transition:background 1.5s cubic-bezier(.77,0,.175,1)}'
    /* The sky stays the only rectangular colour plane. The rest of the group
       is carried by rounded SVG landforms, so every palette colour is visible
       without bringing back the old hard-edged horizontal panels. */
    + '.mtn-sky::after{content:none}'
    + '@keyframes mtn-cloud-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}'
    + '@keyframes mtn-flow-l{from{transform:translate3d(0,0,0)}to{transform:translate3d(-2000px,0,0)}}'
    + '@keyframes mtn-flow-r{from{transform:translate3d(0,0,0)}to{transform:translate3d(2000px,0,0)}}'
    + '@keyframes mtn-cloud-r{from{transform:translate3d(-1700px,0,0)}to{transform:translate3d(1700px,0,0)}}'
    + '@keyframes mtn-cloud-l{from{transform:translate3d(1700px,0,0)}to{transform:translate3d(-1700px,0,0)}}'
    + '.mtn-bg [class^="flow-"]{will-change:auto}'
    + '.mtn-bg .cloud-bob{animation:none}'
    /* Anthropic-art line language: warm near-black, rounded brush ends and a
       deliberately uneven cadence of weights rather than technical hairlines. */
    + '.mtn-bg .contour use,.mtn-bg .cloud-contour use{fill:none;stroke:rgba(20,20,19,.28);stroke-width:4;stroke-linecap:round;stroke-linejoin:round;vector-effect:non-scaling-stroke}'
    /* ⚠️ No stroke-width here. It used to be three fixed numbers (3.2/4.9/3.9)
       applied to every plane, while the contour pitch runs from 19 units at the
       horizon down to 7 in the foreground. So the ink-to-pitch ratio climbed
       from .26 at the back to .70 at the front, and round-capped strokes that
       wide in a gap that narrow merge into lumps wherever two lines converge.
       Width is now a fraction of each layer's own pitch, set inline where the
       geometry is generated — the same rule marks.js already states for the
       pattern fields. Only the opacity cadence stays here. */
    + '.mtn-bg .contour use:nth-child(3n+1){opacity:.72}'
    + '.mtn-bg .contour use:nth-child(3n+2){opacity:.5}'
    + '.mtn-bg .contour use:nth-child(3n){opacity:.62}'
    + '.mtn-bg .fill{animation:none;opacity:.9;transition:fill 1.5s cubic-bezier(.77,0,.175,1),opacity 1s cubic-bezier(.16,1,.3,1)}'
    + '.mtn-bg .fill.l1{fill:var(--bw-palette-1,#D7D0C4)}.mtn-bg .fill.l2{fill:var(--bw-palette-2,#D7D0C4)}'
    + '.mtn-bg .fill.l3{fill:var(--bw-palette-3,#CEC4B5)}.mtn-bg .fill.l4{fill:var(--bw-palette-4,#CEC4B5)}'
    + '.mtn-bg .fill.l5{fill:var(--bw-palette-5,#C2B49F)}.mtn-bg .fill.l6{fill:var(--bw-palette-6,#C2B49F)}'
    + '.mtn-bg .fill.l7{fill:var(--bw-palette-7,#B39F82)}.mtn-bg .fill.l8{fill:var(--bw-palette-8,#B39F82)}'
    + '.mtn-bg .fill.l9{fill:var(--bw-palette-9,#967B60)}.mtn-bg .fill.l10{fill:var(--bw-palette-10,#967B60)}'
    + '.mtn-bg .mtn-water{fill:var(--bw-palette-water,#B4AA9A);opacity:.68;transition:fill 1.5s cubic-bezier(.77,0,.175,1)}'
    /* LINE-ART mode retains the colour group as a quiet wash underneath the
       hand-drawn contours instead of deleting nine of the ten visible roles. */
    + '.mtn-bg.line-art .fill{opacity:.72}'
    + '.mtn-bg.line-art .mtn-water{opacity:.5}'
    + '.mtn-bg.line-art [clip-path]>use{opacity:.5;transition:opacity 1s cubic-bezier(.16,1,.3,1)}'
    + '.mtn-bg .contour.l1 use{stroke:color-mix(in srgb,var(--bw-palette-1,#756F68) 42%,transparent)}'
    + '.mtn-bg .contour.l2 use{stroke:color-mix(in srgb,var(--bw-palette-2,#756F68) 42%,transparent)}'
    + '.mtn-bg .contour.l3 use{stroke:color-mix(in srgb,var(--bw-palette-3,#756F68) 44%,transparent)}'
    + '.mtn-bg .contour.l4 use{stroke:color-mix(in srgb,var(--bw-palette-4,#756F68) 44%,transparent)}'
    + '.mtn-bg .contour.l5 use{stroke:color-mix(in srgb,var(--bw-palette-5,#756F68) 46%,transparent)}'
    + '.mtn-bg .contour.l6 use{stroke:color-mix(in srgb,var(--bw-palette-6,#756F68) 46%,transparent)}'
    + '.mtn-bg .contour.l7 use{stroke:color-mix(in srgb,var(--bw-palette-7,#756F68) 48%,transparent)}'
    + '.mtn-bg .contour.l8 use{stroke:color-mix(in srgb,var(--bw-palette-8,#756F68) 48%,transparent)}'
    + '.mtn-bg .contour.l9 use{stroke:color-mix(in srgb,var(--bw-palette-9,#756F68) 50%,transparent)}'
    + '.mtn-bg .contour.l10 use{stroke:color-mix(in srgb,var(--bw-palette-10,#756F68) 50%,transparent)}'
    + '.mtn-bg .cloud-contour use{stroke:color-mix(in srgb,var(--bw-palette-gem,#756F68) 52%,transparent)}'
    /* MOIRÉ — the only page texture. It is not a tile laid over the site: each
       band is the ridge's own contour path re-used at a fractional rotation,
       clipped to that ridge's silhouette. So it drifts with the layer it
       belongs to, inherits that layer's palette colour, and stops at the
       skyline instead of covering the page. Only the four middle planes carry
       it — near and far stay clean, which is what keeps it from reading as a
       watermark. No per-frame work: these are <use> nodes riding the existing
       flow transform. */
    /* g.moire, not .moire: the per-plane `.mtn-bg .l4{opacity:.83}` rules below
       carry the same specificity and come later in this sheet, so a bare class
       selector loses the tie and the bands inherit the plane's opacity instead
       of their own. The element name buys the one point that settles it. */
    + '.mtn-bg .moire use{fill:none;stroke-width:1.7;stroke-linecap:round;vector-effect:non-scaling-stroke}'
    + '.mtn-bg g.moire{opacity:.17;transition:opacity 1s cubic-bezier(.16,1,.3,1)}'
    + '.mtn-bg .moire.l4 use{stroke:color-mix(in srgb,var(--bw-palette-4,#756F68) 30%,transparent)}'
    + '.mtn-bg .moire.l5 use{stroke:color-mix(in srgb,var(--bw-palette-5,#756F68) 30%,transparent)}'
    + '.mtn-bg .moire.l6 use{stroke:color-mix(in srgb,var(--bw-palette-6,#756F68) 32%,transparent)}'
    + '.mtn-bg .moire.l7 use{stroke:color-mix(in srgb,var(--bw-palette-7,#756F68) 32%,transparent)}'
    /* `.line-art [clip-path]>use` above was written for the cloud group and
       would also halve every moiré band — line-art is the resting state, so
       that would silently decide the shipping strength. Opt out and set it. */
    + '.mtn-bg.line-art .moire use{opacity:1}'
    + '.mtn-bg.line-art g.moire{opacity:.13}'
    + '@media (prefers-reduced-motion:reduce){.mtn-bg g.moire{opacity:.12}}'
    /* ENTRANCE FLOOD — on page arrival the range pours up into place. init()
       holds line-art off for a beat so the coloured ridges surge in, then adds
       line-art so the colour recedes and leaves the line-drawing: background
       floods in, then fades to rest. Transform-only sweep = GPU cheap. */
    + '.mtn-bg.mtn-enter{animation:mtn-enter 1.15s cubic-bezier(.16,1,.3,1) both}'
    + '@keyframes mtn-enter{from{transform:translateY(38px) scale(1.06)}to{transform:none}}'
    + '.mtn-bg .l1{opacity:.48}.mtn-bg .l2{opacity:.60}.mtn-bg .l3{opacity:.72}.mtn-bg .l4{opacity:.83}'
    + '.mtn-bg .l5{opacity:.90}.mtn-bg .l6{opacity:.95}.mtn-bg .l7{opacity:.97}'
    + '.mtn-bg .l8,.mtn-bg .l9,.mtn-bg .l10{opacity:1}'
    /* ── MOTION PROFILE: the ridges hold still, the clouds drift ───────────
       Measured 2026-08-21 on the app route at 1440x900 (18 blurred chrome
       surfaces over the range):

         3 drifting ridge planes + 2 clouds   21 fps   ← what shipped
         ridges still, 6 clouds drifting      54 fps
         no range at all                      60 fps

       The cost is NOT the number of animated planes. Two drifting ridges
       measured the same as ten, and stopping only the near six changed
       nothing. It is binary: a ridge path spans the full 4000px canvas, so
       the moment any of them moves, every backdrop-filter region above it is
       invalidated and re-blurred that frame. Ten planes or one, the blur
       work is identical.

       Clouds are free for the opposite reason — each is small and lives
       inside a clip-path, so it rarely intersects a blurred panel. Six of
       them drifting cost nothing measurable.

       So the ridges stop and the clouds carry the motion, which also lines up
       with what the rest of the site already does: the casting figure settles
       and holds, and the range's real life was never the 14px-per-second
       drift — it is the palette crossfade every 15 seconds.

       ⚠️ The previous 10-plane and 6-cloud declarations that used to sit here
       were dead: the profile block below them overrode all of it
       unconditionally, so the site has been running 3 ridges + 2 clouds while
       appearing to declare sixteen animations. Removed rather than left to
       mislead the next reader. */
    /* ⭐ RIDGE DRIFT is a switch, not a verdict. Owner wants the range moving;
       every measurement saying it costs 40fps was taken on a software
       rasteriser (SwiftShader), which is pessimistic for a real GPU in a way
       I cannot correct for from here. So it ships off, and `?ridges=1` turns
       it on in the live page — judged on the machine that has to run it,
       without a deploy.
       What was tried and did NOT recover the cost, so nobody repeats it:
       will-change:transform, dropping non-scaling-stroke, removing clip-path,
       cutting to two planes, transforming the <svg> element instead of inner
       <g>, and pre-rasterising to a bitmap. All 14–22fps against 61 at rest.
       The cost is the re-raster of a large, detailed SVG per frame; it is not
       the number of planes and not the backdrop-filters (disabling every
       blurred panel recovered only 17 -> 27). */
    /* ⭐⭐ THE RANGE MOVES, SMOOTHLY — and the cost was paid somewhere else.

       Stepping was the wrong answer. `steps()` does make the frames cheap, but
       a step is a JUMP: 4px once a second is plainly visible as a tick, and a
       landscape that ticks is worse than one that is still. Reported as "what
       do you mean, frame by frame" — and that is exactly what it looked like.

       ⭐ What made moving expensive was never the drawing. Measured, with the
       whole page sampled while the range drifts smoothly:

         everything drawn                33fps
         moiré hidden                    30fps
         contours hidden                 31fps
         FILLS ONLY, 90% of it deleted   32fps   <- no change at all

       So detail is not the variable. Neither is the SVG: rasterising the whole
       range once into an <img> and translating that instead measured 35fps.

       ⭐⭐ It is the GLASS. Moving anything behind a backdrop-filter forces that
       filter to re-blur every frame, and the sidebar is a 264px-wide panel the
       full height of the window with several more blurred panels nested inside
       it:

         all glass as-is                 30fps
         composer's blur off             32fps
         sidebar's blur off              43fps
         sidebar and its children off    52fps
         every blur on the page off      51fps

       The sidebar alone is the whole difference. The note that used to stand
       here said the backdrop-filters were NOT the cost — that was measured on a
       different build, and it is now wrong.

       So the sidebar stops being backdrop glass (see refinement.css) and the
       range drifts smoothly again. That trade also settles a complaint the
       sidebar had on its own: a 264px blur over a pale sky composites to a flat
       white column, measured 60 units lighter than the picture beside it, which
       is why the landscape appeared to stop dead at its edge.

       One drift for the whole range rather than one per plane — parallax is
       what the per-plane version bought and it measured 24fps. */
    + (ridgeDrift
        ? '.mtn-bg>svg{animation:mtn-range 34s linear infinite alternate;will-change:transform}'
        : '')
    + '.mtn-bg [class^="flow-"]{animation:none;will-change:auto}'
    + '.mtn-bg [class^="cloud-"]{animation:none}'
    /* ⚠️ Cloud speed is set AGAINST the ridge speed, not on its own. While the
       ridges were frozen, 15px/s read clearly because the landscape behind was
       a fixed reference. Once the ridges drift at ~8px/s the clouds going the
       same way separate at only 8px/s from what is behind them, and the eye
       reads the whole scene as still — the complaint was "the clouds stopped",
       and they had not, they had lost their contrast.
       So they run at roughly twice the old rate, and every cloud now moves
       AGAINST the ridge plane it sits over. Relative speed, not absolute, is
       what makes a drift visible. */
    + '.mtn-bg .cloud-1{animation:mtn-cloud-r 104s linear infinite;will-change:transform}'
    + '.mtn-bg .cloud-2{animation:mtn-cloud-r 128s linear -30s infinite;will-change:transform}'
    + '.mtn-bg .cloud-4{animation:mtn-cloud-r 92s linear -18s infinite;will-change:transform}'
    + '.mtn-bg .cloud-5{animation:mtn-cloud-r 116s linear -50s infinite;will-change:transform}'
    /* ⚠️ 3 and 6 were left out and sat nailed to the sky. A cloud that does not
       move is the one thing in this picture that reads as broken — the ridges
       are still ON PURPOSE and read as ground, but a static cloud reads as a
       dropped frame. Six drifting clouds measured free (54fps against 55), so
       there was never a cost reason to leave two behind. */
    + '.mtn-bg .cloud-3{animation:mtn-cloud-l 136s linear -64s infinite;will-change:transform}'
    + '.mtn-bg .cloud-6{animation:mtn-cloud-l 148s linear -22s infinite;will-change:transform}'
    + '@media(prefers-reduced-motion:reduce){.mtn-bg path,.mtn-bg g,.mtn-bg use,.mtn-sky{animation:none!important;transform:none!important}}';

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
  /* ── RIDGE SHAPE VARIANTS ──────────────────────────────────────────────
     W above is the hand-drawn set and stays variant 0. The others are grown
     from the same measurements — baseline, amplitude and feature count taken
     off those very paths — so a variant has the SAME number of path commands
     and costs the same to raster. Only the crest positions and heights differ.

     One variant per session, chosen from the same seed the palette uses, so a
     visitor's landscape is consistent across navigation and the next visitor
     gets a different one. Deterministic for the same reason the brush and the
     palette order are: a shape that reshuffles mid-visit reads as a fault. */
  var RIDGE_PROFILE = {
    1:  { base: 170, amp: 51,  n: 5 },
    2:  { base: 217, amp: 34,  n: 5 },
    3:  { base: 241, amp: 72,  n: 6 },
    4:  { base: 328, amp: 92,  n: 3 },
    5:  { base: 393, amp: 106, n: 5 },
    6:  { base: 415, amp: 170, n: 3 },
    7:  { base: 509, amp: 30,  n: 3 },
    8:  { base: 526, amp: 35,  n: 5 },
    9:  { base: 562, amp: 12,  n: 3 },
    10: { base: 585, amp: 6,   n: 3 }
  };
  var RIDGE_VARIANTS = 4;

  function ridgePath(i, rand) {
    var P = RIDGE_PROFILE[i];
    var period = 2000, n = P.n, half = P.amp / 2;
    /* One period of alternating crests and troughs, generated once and then
       tiled three times. Both ends sit on the baseline so the repeats join
       without a seam. */
    /* Irregularity comes from three places at once, because varying only one
       still reads as a rhythm: WHERE a feature sits, HOW FAR it swings, and
       WHICH WAY. Strict up-down-up alternation was the giveaway — a real
       skyline runs two crests together, then drops a long way once.
       All of it is seeded, so a visitor's range is fixed for the session. */
    var pts = [];
    var gaps = [], gapTotal = 0;
    for (var k = 0; k < n; k++) { var w = .45 + rand() * 1.55; gaps.push(w); gapTotal += w; }
    var run = rand() < .5 ? 1 : -1, sameRun = 0, x = 0;
    for (var k = 0; k < n; k++) {
      x += gaps[k] / gapTotal * period * (n / (n + 1));
      /* Keep the same direction sometimes — but never more than twice, or the
         profile wanders off the baseline and the plane stops reading as a
         horizon. */
      if (sameRun >= 2 || rand() < .62) { run = -run; sameRun = 0; } else sameRun++;
      var reach = .25 + rand() * rand() * 1.5;      /* squared: mostly small, occasionally a big one */
      pts.push({
        x: Math.round(x),
        y: Math.round(P.base + run * half * Math.min(1.15, reach))
      });
    }
    /* ⚠️ Build each repeat with an explicit x offset. Tiling by string-replacing
       the numbers looks tempting and is wrong: a path has x and y in the same
       stream, so a regex over "every number" shifts the heights too and the
       range walks off the canvas. */
    var flats = [];
    for (var f = 0; f <= pts.length; f++) flats.push(rand());
    function period_at(dx) {
      var out = '', prevX = 0, prevY = P.base;
      for (var k2 = 0; k2 < pts.length; k2++) {
        var p2 = pts[k2];
        var flat = Math.round(prevX + (p2.x - prevX) * (.18 + flats[k2] * .34));
        var c1 = Math.round(flat + (p2.x - flat) * .45);
        var c2 = Math.round(flat + (p2.x - flat) * .62);
        out += ' L ' + (flat + dx) + ' ' + prevY
          + ' C ' + (c1 + dx) + ' ' + prevY
          + ' ' + (c2 + dx) + ' ' + p2.y
          + ' ' + (p2.x + dx) + ' ' + p2.y;
        prevX = p2.x; prevY = p2.y;
      }
      return out + ' L ' + (period + dx) + ' ' + P.base;
    }
    var d = 'M -2000 ' + P.base;
    for (var r = 0; r < 3; r++) d += period_at(r * period - 2000);
    return d;
  }

  /* Replace W with the chosen variant. Variant 0 keeps the drawn paths. */
  function pickRidgeVariant(seed) {
    var v = seed % RIDGE_VARIANTS;
    if (!v) return;
    var rand = mulberry32(seed ^ 0x9E3779B9);
    for (var i = 1; i <= 10; i++) W[i] = ridgePath(i, rand);
  }

  var CLOUD = "M 18 30 C 8 30 5 18 18 14 C 20 4 40 4 46 14 C 52 4 72 4 78 14 C 90 8 110 18 105 30 C 116 32 116 44 100 42 C 96 50 76 48 70 40 C 64 50 40 50 34 40 C 22 44 6 42 18 30 Z";
  var CLOUDC = "M 18 30 C 8 30 5 18 18 14 C 20 4 40 4 46 14 C 52 4 72 4 78 14 C 90 8 110 18 105 30";
  /* y is the original spacing. trim is how much of each end is left undrawn,
     in percent of the arc: none at the top where the copy follows the outline,
     more further down where it would otherwise push out through the sides. */
  /* Asymmetric on purpose. The arc's first segment (M 18 30 C 8 30 5 18 18 14)
     doubles back on itself before it climbs, so the stroke overlaps and reads
     as a dark hook hanging off the left — that, not the clip, is what was ugly
     at that end. It is cut away. The right end merely descends, so it needs
     only enough taken off to keep clear of the silhouette. */
  var CLOUD_ROWS = [
    { y: 7, head: 19, tail: 3 },
    { y: 15.5, head: 26, tail: 10 },
    { y: 22, head: 35, tail: 18 }
  ];
  var WATER = "M -2000 476 C -1660 442 -1320 510 -980 478 C -640 446 -300 514 40 480 C 380 446 720 508 1060 476 C 1400 444 1740 510 2080 478 C 2420 446 2760 514 3100 480 C 3440 448 3740 502 4000 476 L 4000 526 C 3700 548 3400 498 3060 530 C 2720 562 2380 500 2040 532 C 1700 564 1360 502 1020 530 C 680 558 340 504 0 532 C -340 560 -680 500 -1020 530 C -1360 560 -1700 502 -2000 526 Z";

  /* Close each rounded ridge to the viewport floor; only the organic top edge
     is exposed because nearer layers cover the closing edges. */
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
  /* A second wobble, on x. The contour copies were offset only vertically, so
     every line under a crest was exactly parallel to it — which is the one
     thing a hand never does. Shifting each copy sideways by a few units, on a
     cycle of a different length from the y wobble (5 against 7, so the pair
     does not repeat for 35 lines), makes the spacing between contours open and
     close along the ridge the way drawn hatching does.
     Deterministic on purpose, exactly as the casting figure's brush is: random
     per render would reshuffle on every navigation and read as a fault. */
  var LINE_DRIFT = [0, -3.4, 2.2, -1.1, 4.0];
  /* Everything above is a SHAPE; these three turn it into a size. Tying them to
     the pitch is what keeps the ink-to-ground ratio constant from the horizon
     to the foreground, so no plane can crowd itself into lumps. Thickening the
     drawing means raising INK_OF_PITCH, not typing a bigger pixel number. */
  var INK_OF_PITCH = [.30, .40, .34];
  var DRIFT_OF_PITCH = .30;
  var WOBBLE_OF_PITCH = .17;

  /* Which planes carry the moiré, and how. `n` bands at `gap` units apart,
     each turned by a fraction of a degree — the tilt is what beats against
     the ridge's own waveform. Keep the tilt under ~1°: past that the bands
     separate and you can count them, which is the moment it stops being
     texture and starts being stripes. */
  /* ⚠️ These counts were tuned when the fills painted at .18. Once the fill
     opacity was returned to the engine's .72, the same bands stopped reading
     as texture and became countable stripes — the exact failure the note above
     describes, arrived at from the other direction: not by tilting too far,
     but by the ground underneath getting four times stronger.
     Halved and spread; the moiré is a beat against the ridge, not a hatch. */
  var MOIRE = {
    4: { n: 10, gap: 6.2, tilt: .30 },
    5: { n: 12, gap: 5.6, tilt: .26 },
    6: { n: 12, gap: 5.2, tilt: .34 },
    7: { n: 9, gap: 6.0, tilt: .22 }
  };
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
      if (MOIRE[i]) defs += '<clipPath id="mwclip' + i + '"><use href="#mw' + i + '"/></clipPath>';
    }
    defs += '<path id="mxy-cloud" d="' + CLOUD + '"/><path id="mxy-cloud-c" d="' + CLOUDC + '"/>';
    defs += '<clipPath id="mcloud-clip"><use href="#mxy-cloud"/></clipPath></defs>';

    var ridges = '';
    LAYERS.forEach(function (L, idx) {
      var i = idx + 1, contour = '';
      for (var k = 1; k <= L.n; k++) {
        /* Both wobbles are a FRACTION OF THIS LAYER'S PITCH, not a fixed number.
           The x drift used to be scaled by layer index instead, which ran it to
           1.6x the pitch in the foreground — far enough that neighbouring
           contours crossed on any sloped part of the ridge, and thick round
           strokes at a crossing read as a swelling rather than as two lines. */
        var wob = LINE_WOBBLE[(k + i) % LINE_WOBBLE.length] / 2.8 * L.step * WOBBLE_OF_PITCH;
        var offset = k * L.step + wob;
        var drift = LINE_DRIFT[(k * 2 + i) % LINE_DRIFT.length] / 4 * L.step * DRIFT_OF_PITCH;
        var w = Math.max(2.5, L.step * INK_OF_PITCH[k % INK_OF_PITCH.length]);
        contour += '<use href="#mw' + i + 'c" x="' + drift.toFixed(2)
          + '" y="' + offset.toFixed(2) + '" style="stroke-width:' + w.toFixed(2) + '"/>';
      }
      var moire = '';
      if (MOIRE[i]) {
        var M = MOIRE[i];
        for (var m = 0; m < M.n; m++) {
          var t = m - (M.n - 1) / 2;
          moire += '<use href="#mw' + i + 'c" transform="rotate('
            + (t * M.tilt).toFixed(3) + ' 500 300) translate(0 '
            + (t * M.gap).toFixed(2) + ')"/>';
        }
        moire = '<g class="moire l' + i + '" clip-path="url(#mwclip' + i + ')">' + moire + '</g>';
      }
      ridges += '<g class="flow-' + i + '"><use href="#mw' + i + '" class="fill l' + i + '"/>'
        + moire + '<g class="contour l' + i + '">' + contour + '</g></g>';
      /* ⚠️ The water plane is GONE. Its top edge is a wave of about 34 units
         over 340-unit spans — so shallow that at render scale it drew a nearly
         straight horizontal line, and in a cool hue against the warm ridges.
         Next to ten arc-edged ridges that one flat slab read as a band laid
         over the picture rather than as part of it. The palette still publishes
         --bw-palette-water (the block routes use it as a hue candidate); it
         simply is not painted here any more. */
    });

    var clouds = '';
    CLOUDS.forEach(function (c, idx) {
      var cc = '';
      /* The original three translated copies — the layered edge is right, and two
         attempts at replacing it were worse: thinning and respacing (6/15/24 at
         2.6) read as scratchy, nesting by scaling toward the centre turned the
         layers into concentric rings.

         What WAS wrong is how they ended. Each copy is the same arc pushed down,
         so the lower ones run past the cloud's rounded sides and the silhouette
         clip cut them off square — a clip can only cut, it cannot end a stroke.
         So the copies are trimmed instead: pathLength normalises each to 100
         units and the dash draws only the middle, more of it taken off the
         deeper the copy sits, since that is where the arc overshoots most. The
         curve is untouched; the parts that were being amputated are simply not
         drawn, and round caps finish the ends properly. */
      CLOUD_ROWS.forEach(function (r) {
        cc += '<use href="#mxy-cloud-c" y="' + r.y + '" pathLength="100"'
          + ' stroke-dasharray="' + (100 - r.head - r.tail) + ' 200"'
          + ' stroke-dashoffset="' + (-r.head) + '"/>';
      });
      clouds += '<g class="cloud-' + (idx + 1) + '"><g class="cloud-bob" style="animation-delay:' + c.d + '">'
        + '<g transform="' + c.t + '"><g clip-path="url(#mcloud-clip)">'
        + '<use href="#mxy-cloud" class="cloud-body" fill="var(--bw-palette-cloudbody,#DED8CD)" opacity="' + c.o + '"/>'
        + '<g class="cloud-contour">' + cc + '</g></g></g></g></g>';
    });

    return '<svg viewBox="0 0 ' + vbw + ' 600" preserveAspectRatio="' + par + '" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Rounded contour landscape">'
      + '<title>Moving contour landscape and clouds</title>' + defs
      /* ⭐ The range is scaled to 70% about the FOOT of the canvas, and that is
         all this transform does. The ridges were reaching so far up the sky
         that the clouds had nowhere left to be — the picture had become a wall
         of hills with a strip of weather above it.

         About the foot, so the horizon stays welded to the bottom edge and only
         the peaks come down; scaling about the middle would lift the whole
         range off the floor and leave a seam. Uniform, so the hills keep their
         proportions — a range squashed vertically reads as a range seen from
         somewhere else, not as a smaller one.

         ⚠️ The CLOUDS are outside this group on purpose. They are not 30%
         smaller; there is simply more sky for them to be seen in, which is what
         was actually asked for. */
      + '<g class="mtn-ridges" transform="translate(700 600) scale(.7) translate(-700 -600)">'
      + ridges + '</g>' + clouds + '</svg>';
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
    return (1.05 / (l + .05)) >= ((l + .05) / .05) ? "#ECE6DC" : "#141413";
  }

  function toHsl(hex) {
    var n = parseInt(hex.slice(1), 16);
    var r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    var l = (max + min) / 2, s = d ? d / (1 - Math.abs(2 * l - 1)) : 0, h = 0;
    if (d) {
      if (max === r) h = ((g - b) / d) % 6;
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h = (h * 60 + 360) % 360;
    }
    return { h: h, s: s, l: l };
  }

  function hslToHex(h, s, l) {
    var c = (1 - Math.abs(2 * l - 1)) * s;
    var x = c * (1 - Math.abs((h / 60) % 2 - 1));
    var m = l - c / 2, rr = 0, gg = 0, bb = 0;
    if (h < 60) { rr = c; gg = x; }
    else if (h < 120) { rr = x; gg = c; }
    else if (h < 180) { gg = c; bb = x; }
    else if (h < 240) { gg = x; bb = c; }
    else if (h < 300) { rr = x; bb = c; }
    else { rr = c; bb = x; }
    return '#' + [rr, gg, bb].map(function (ch) {
      return Math.round((ch + m) * 255).toString(16).padStart(2, '0');
    }).join('').toUpperCase();
  }

  function contrast(a, b) {
    var x = luminance(a), y = luminance(b);
    return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
  }

  /* Text that floats directly on the landscape, coloured BY the landscape.
     It carries the group's hue so it belongs to the picture, but the tint is
     deliberately shallow — INK_TINT_MAX_SATURATION keeps it off the neon end,
     which is the "no extreme colours" rule. Near-black and near-white are the
     exception: when no tinted candidate can clear the ratio, they are the
     honest answer rather than a tint that cannot be read.
     ⚠️ Ratio first, hue second. A tinted colour that misses the ratio is not a
     softer choice, it is unreadable text. */
  var INK_TINT_MAX_SATURATION = .34;
  var INK_DARK_LIGHTNESS = .17;
  var INK_LIGHT_LIGHTNESS = .93;

  function inkOn(bgHex, minRatio) {
    var hsl = toHsl(bgHex);
    var s = Math.min(hsl.s, INK_TINT_MAX_SATURATION);
    var candidates = [
      hslToHex(hsl.h, s, INK_DARK_LIGHTNESS),
      hslToHex(hsl.h, s * .8, INK_LIGHT_LIGHTNESS),
      "#141413",
      "#FFFFFF"
    ];
    var best = candidates[2], bestRatio = 0;
    for (var i = 0; i < candidates.length; i++) {
      var ratio = contrast(candidates[i], bgHex);
      if (ratio >= minRatio) return candidates[i];   /* first that clears wins */
      if (ratio > bestRatio) { bestRatio = ratio; best = candidates[i]; }
    }
    return best;
  }

  /* ⭐⭐ The same solve against SEVERAL backgrounds at once, for text that lies
     across more than one of them.

     The two lines at the foot of the app — the composer hint and the site
     footer — do not sit on the cloud. They sit on whichever of the lower ridges
     happens to be under them, and a ridge is not one colour: it is four or five
     bands, and the text crosses them. Solving against the cloud and hoping was
     what shipped, and it left group 186 measuring 1.48:1 on composited pixels
     WITH a frosted plate under it.

     So the colour is chosen to clear the ratio against every background it can
     land on, not against a representative one. That is the whole of the owner's
     instruction — legibility comes from the ink changing with the group, not
     from a plate laid under the words. */
  /* The screen colour of a fill drawn at alpha over the sky. */
  function overSky(hex, skyHex, a) {
    var f = parseInt(hex.slice(1), 16), b = parseInt(skyHex.slice(1), 16);
    var mix = function (sh) {
      return Math.round((((f >> sh) & 255) * a) + (((b >> sh) & 255) * (1 - a)));
    };
    var out = (mix(16) << 16) | (mix(8) << 8) | mix(0);
    return "#" + ("000000" + out.toString(16)).slice(-6);
  }

  /* ⭐⭐⭐ The ground the footer actually sits on, computed rather than guessed.

     Every earlier attempt at this solved against something that is not on the
     screen — the cloud, then the raw catalogue rows, then a single-layer
     composite — and each one failed in its own way, the worst being a colour
     that landed exactly on the painted ground and measured 1:1. But nothing
     here is unknowable: the ridges paint in order, each at .72, over the sky,
     and the whole range then sits at .82 over the paper. Stacking that gives
     rgb(85,89,76) for group 072 where the screenshot measures rgb(80,88,72) —
     five units out of 255, which is the difference between a model and a guess.

     ⚠️ The stack is CUMULATIVE. Each ridge covers the ones above it, so the
     colour under the footer is not one row composited with the sky, it is
     every row down to that depth composited in sequence. That is why the
     single-layer version scored worse than using the raw hex: it was not one
     step closer to the truth, it was a different wrong answer. */
  var RANGE_FILL_ALPHA = .72;    /* .mtn-bg.line-art .fill */
  var RANGE_LAYER_ALPHA = .82;   /* .mtn-bg */
  var RANGE_PAPER = "#E7E1D7";   /* --paper, the canvas behind the range */

  function mixHex(overHex, underHex, a) {
    var f = parseInt(overHex.slice(1), 16), b = parseInt(underHex.slice(1), 16);
    var ch = function (sh) {
      return Math.round((((f >> sh) & 255) * a) + (((b >> sh) & 255) * (1 - a)));
    };
    var out = (ch(16) << 16) | (ch(8) << 8) | ch(0);
    return "#" + ("000000" + out.toString(16)).slice(-6);
  }

  /* The painted colour at each depth: index i is what is on the screen where
     ridge i+1 is the last one drawn. */
  function paintedGrounds(rows, skyHex) {
    var stack = skyHex, out = [];
    for (var i = 0; i < rows.length; i++) {
      stack = mixHex(rows[i], stack, RANGE_FILL_ALPHA);
      out.push(mixHex(stack, RANGE_PAPER, RANGE_LAYER_ALPHA));
    }
    return out;
  }

  /* Pick the ink with the best worst case against a set of grounds. Hue comes
     from the group, lightness is swept end to end, and the winner is whichever
     maximises the minimum — a small search, run once per palette change.

     ⚠️ No halo, no plate, no outline. Owner, three times: the recognisability
     comes from the text CHANGING COLOUR. A white rim around the letters is the
     plate again at glyph scale — it was built once, it rendered as exactly
     that, and it came straight back out. */
  function inkOnAll(bgHexes, minRatio) {
    var hues = [];
    for (var k = 0; k < bgHexes.length; k++) hues.push(toHsl(bgHexes[k]).h);
    var lights = [.02, .04, .08, .12, .16, .20, .26, .32, .70, .76, .82, .88, .93, .97, 1];
    var best = "#141413", bestWorst = -1;
    var score = function (cand) {
      var worst = Infinity;
      for (var j = 0; j < bgHexes.length; j++) {
        var r = contrast(cand, bgHexes[j]);
        if (r < worst) worst = r;
      }
      return worst;
    };
    for (var hi = 0; hi < hues.length; hi++) {
      var sat = Math.min(toHsl(bgHexes[hi]).s, INK_TINT_MAX_SATURATION);
      for (var li = 0; li < lights.length; li++) {
        var cand = hslToHex(hues[hi], lights[li] > .5 ? sat * .8 : sat, lights[li]);
        var w = score(cand);
        if (w > bestWorst) { bestWorst = w; best = cand; }
        if (bestWorst >= minRatio) return best;
      }
    }
    /* When no tint in the group can be read, an extreme is the honest answer
       rather than a tint that cannot be. */
    var ends = ["#000000", "#FFFFFF"];
    for (var e = 0; e < ends.length; e++) {
      var we = score(ends[e]);
      if (we > bestWorst) { bestWorst = we; best = ends[e]; }
    }
    return best;
  }

  /* ⚠️ A cloud painted the sky's own colour is not a pale cloud, it is no
     cloud: only its contour lines survive and they read as marks floating on
     an empty sky. That is what shipped, and it was structural — .mtn-sky takes
     --bw-palette-cloud for its background while applyPalette assigned the same
     value as the cloud body's fill. One token was doing two jobs.

     Figure and ground separate by VALUE. So the body is derived, not shared:
     start halfway toward the palette's lightest ridge, and where a palette has
     no room there — some catalogues have a first row that is already the sky —
     push away along whichever axis has headroom until the gap clears a floor.
     Measured across all 114 groups: minimum luminance separation 0.063 against
     a 0.055 floor, mean 0.155, no exceptions. */
  var CLOUD_SEPARATION = .055;

  function cloudBodyFor(skyHex, rowHex) {
    function ch(h) { var n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
    function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
    function out(c) {
      return "#" + c.map(function (v) {
        return Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
      }).join("").toUpperCase();
    }
    function L(c) {
      var x = c.map(function (v) { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); });
      return .2126 * x[0] + .7152 * x[1] + .0722 * x[2];
    }
    var sky = ch(skyHex), first = mix(sky, ch(rowHex), .5), lSky = L(sky);
    if (Math.abs(L(first) - lSky) >= CLOUD_SEPARATION) return out(first);
    var anchorC = lSky > .5 ? [26, 24, 21] : [252, 250, 246];
    for (var t = .08; t <= 1.0001; t += .04) {
      var c = mix(sky, anchorC, t);
      if (Math.abs(L(c) - lSky) >= CLOUD_SEPARATION) return out(c);
    }
    return out(anchorC);
  }

  function mutedHex(hex, maxLightness, maxSaturation, minLightness) {
    var n = parseInt(hex.slice(1), 16);
    var r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    var l = (max + min) / 2, s = d ? d / (1 - Math.abs(2 * l - 1)) : 0, h = 0;
    if (d) {
      if (max === r) h = ((g - b) / d) % 6;
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h = (h * 60 + 360) % 360;
    }
    l = Math.max(minLightness || 0, Math.min(l, maxLightness));
    s = Math.min(s, maxSaturation);
    var c = (1 - Math.abs(2 * l - 1)) * s;
    var x = c * (1 - Math.abs((h / 60) % 2 - 1));
    var m = l - c / 2;
    var rr = 0, gg = 0, bb = 0;
    if (h < 60) { rr = c; gg = x; }
    else if (h < 120) { rr = x; gg = c; }
    else if (h < 180) { gg = c; bb = x; }
    else if (h < 240) { gg = x; bb = c; }
    else if (h < 300) { rr = x; bb = c; }
    else { rr = c; bb = x; }
    return '#' + [rr, gg, bb].map(function (channel) {
      return Math.round((channel + m) * 255).toString(16).padStart(2, '0');
    }).join('').toUpperCase();
  }

  function validPaletteGroup(group) {
    return group && typeof group.id === "string"
      && typeof group.cloud === "string"
      && Array.isArray(group.rows) && group.rows.length === 10
      && group.rows.every(function (hex) { return /^#[0-9a-f]{6}$/i.test(hex); });
  }

  function hueOf(hex) {
    var n = parseInt(hex.slice(1), 16);
    var r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min, h = 0;
    if (d) {
      if (max === r) h = ((g - b) / d) % 6;
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
    }
    return (h * 60 + 360) % 360;
  }

  function paletteGem(group) {
    var index = Array.isArray(group.gems) && group.gems.length
      ? Math.max(0, Math.min(9, group.gems[0] - 1))
      : 5;
    return group.rows[index];
  }

  /* The curated file is now authoritative: every retained group participates
     once. Removing a group in the manager removes it from the published file,
     so the runtime no longer carries a second, hidden exclusion algorithm.

     ── Order is shuffled per visitor, not sorted ──────────────────────────
     Any fixed order — by tier, by segment — means the site spends a long
     unbroken stretch inside one part of the catalogue and then jumps. Sorting
     by segment put all 34 自定义 groups first: eight and a half minutes of one
     segment, and since a new session's clock starts at now, EVERY first-time
     visitor opened on the same group and walked the same 28-minute path. The
     catalogue's range was there and nobody saw it. A shuffle is what makes 114
     groups read as 114.

     ⚠️ Seeded, and the seed lives in sessionStorage — NOT Math.random() at
     each call. This is the same rule the brush and LINE_DRIFT follow: reshuffle
     on every navigation and the background reorders itself mid-visit, which
     reads as a rendering fault, not as design. One draw per session, then the
     same permutation on every page of that session; the next visitor gets a
     different one. Same reason the phase clock is stored beside it.

     mulberry32: a 32-bit PRNG small enough to inline and stable across
     engines, so the sequence depends on the seed and nothing else. */
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* Which groups a visitor should meet first: the owner-curated reference
     palettes and the indigo run, filtered to the ones that actually carry
     colour on screen.

     ⚠️ Segment membership is NOT the same as being colourful, and assuming it
     was is why the first version of this looked like it had done nothing.
     Measured mean on-screen saturation per segment, after the .26 clamp:

       青绿 .260   金赭 .260   粉珊瑚 .259   蓝靛 .258
       紫堇 .247   近白 .220   自定义 .219   ← second lowest on the site

     自定义 spans .096 to .260. Roughly half of it is near-grey — sky values
     like #FDFEFD and #FBFBDA — so "open inside 自定义" landed on a washed-out
     group about as often as not, which is indistinguishable from no bias at
     all. The catalogue's segment names describe where a group came from, not
     what it looks like.

     So the pool was filtered by the thing that was actually wanted: colour the
     eye receives.

     ⚠️ At 0.23 that filter kept 15 of the owner's 34 custom groups out of the
     opening entirely — 44% of the segment could never open, including every
     quiet one. The curated groups are the owner's data, and excluding nearly
     half of them from the moment a visitor arrives is not a tuning decision to
     make on their behalf. The gate is open at 0; the constant stays so the
     threshold can be raised again deliberately, with the cost known. Pool is
     now 49 of 114 (34 custom, 15 indigo). */
  var OPENING_SEGMENTS = ["自定义", "蓝靛段"];
  /* Reset onto the new scale. At .22 it gates out only 195, 194 and 193 —
     cards whose own saturation is under a third of the ceiling, so they are
     colourless by content, not by clamping. The other 31 custom groups all
     open. Set to 0 to let even those three open. */
  var OPENING_MIN_SATURATION = .22;

  /* How much of a card's colour is allowed to reach the screen. These were
     .26 / .14 / .22, which threw away 60% of the catalogue's saturation: the
     cards average .599, the screen showed .242, and NO group anywhere could
     exceed .26 no matter how saturated its card. The landscape was grey by
     construction, not by palette.
     ⚠️ RIDGE_MAX_SATURATION must be the only definition. It used to be typed
     twice — here and inside onScreenSaturation — so raising one silently left
     the opening gate measuring on the old scale. */
  /* ⭐ FIDELITY MODE (owner's call, 2026-08-22): the curated cards reach the
     screen unchanged. mutedHex is bypassed entirely rather than opened up,
     because an HSL round-trip re-quantises every channel — "no clamp" and
     "untouched" are not the same value, and the requirement is the card.

     The ceilings below are what the toning WOULD use if fidelity is turned
     off again. They are kept, not deleted, so going back is one flag.

     ⚠️ Known cost, accepted deliberately: the 12px note above the fold uses
     --dim directly over the sky with no scrim, so on the darker cards it now
     falls under 4.5:1. That text needs a backing plate or full ink — the sky
     should not be flattened to serve one line of chrome. */
  var PALETTE_FIDELITY = true;
  var RIDGE_MAX_SATURATION = .42;
  var SKY_MAX_SATURATION = .24;
  var WATER_MAX_SATURATION = .34;

  function toned(hex, maxLightness, maxSaturation, minLightness) {
    return PALETTE_FIDELITY ? hex : mutedHex(hex, maxLightness, maxSaturation, minLightness);
  }

  /* ── the group's two hues ─────────────────────────────────────────────────
     ⭐⭐ THE STEP INDEX IS NOT A HUE, any more than it is a brightness. This
     file already says the second thing; the first cost the block routes their
     colour for weeks. Every consumer picked its colours at fixed indices —
     one role off step 4, another off step 6 — and measured across the
     catalogue, a FIXED set of indices lands on one hue in most groups: the
     median smallest gap inside a fixed trio is 5°, and 104 of 114 groups put
     it under 15°. The page then reads as a single colour with the lightness
     turned up and down, which is exactly what it looked like.

     ⭐ The colour is there; it is just not at a fixed address. Measured over
     the catalogue, the median card spans 172° of hue. So the two hues have to
     be CHOSEN PER GROUP: take the most saturated step, then the step furthest
     from it in hue. That pick has a median separation of 160° and falls under
     15° in only 2 of 114 groups.

     ⚠️ Two, not four. A greedy pick of four hues has a median separation of
     7° and three of them are under 15° in 87 groups — the catalogue does not
     contain four hues per card, and naming four plates would have been four
     names for the same colour. Three is marginal (median 29°, 33 groups under
     15°). Two is what the data supports, so two is what gets published.

     ⚠️ Sky and water are candidates alongside the ridge steps, but they do not
     rescue a monochrome card: adding them to the pool leaves the four-hue
     median at 7°. They are in the pool because they are sometimes the most
     saturated thing on the card, not because they add a hue family.

     ⚠️ Near-grey steps are excluded, because hue is meaningless below a chroma
     floor — an almost-grey's hue is rounding noise and would be picked as
     "furthest" every time. A card with fewer than two chromatic colours
     publishes the same hue twice and renders in one colour, which is fidelity
     to that card, not a fault. */
  var HUE_MIN_CHROMA = .045;

  function oklchOf(hex) {
    var n = parseInt(String(hex).replace("#", ""), 16);
    var f = [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255].map(function (c) {
      return c <= .04045 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4);
    });
    var l = Math.cbrt(.4122214708 * f[0] + .5363325363 * f[1] + .0514459929 * f[2]),
        m = Math.cbrt(.2119034982 * f[0] + .6806995451 * f[1] + .1073969566 * f[2]),
        s = Math.cbrt(.0883024619 * f[0] + .2817188376 * f[1] + .6299787005 * f[2]);
    var A = 1.9779984951 * l - 2.4285922050 * m + .4505937099 * s,
        B = .0259040371 * l + .7827717662 * m - .8086757660 * s;
    return { hex: hex, c: Math.hypot(A, B), h: (Math.atan2(B, A) * 180 / Math.PI + 360) % 360 };
  }

  function hueGap(a, b) {
    var d = Math.abs(a - b) % 360;
    return d > 180 ? 360 - d : d;
  }

  function publishHues(root, rows, sky, water) {
    var pool = rows.concat([sky, water]).filter(Boolean).map(oklchOf)
      .filter(function (v) { return v.c >= HUE_MIN_CHROMA; });
    if (!pool.length) {
      root.style.removeProperty("--bw-hue-a");
      root.style.removeProperty("--bw-hue-b");
      return;
    }
    var a = pool.reduce(function (x, y) { return y.c > x.c ? y : x; });
    var b = pool.reduce(function (x, y) {
      return hueGap(y.h, a.h) > hueGap(x.h, a.h) ? y : x;
    }, a);
    root.style.setProperty("--bw-hue-a", a.hex);
    root.style.setProperty("--bw-hue-b", b.hex);
  }

  /* Mean saturation of the ten ridge colours AFTER mutedHex's clamp — the
     value that reaches the screen, not the one on the card. Cheap: 114 groups
     x 10 colours, once per session. */
  function onScreenSaturation(group) {
    var total = 0;
    for (var i = 0; i < group.rows.length; i++) {
      var hex = group.rows[i];
      var n = parseInt(hex.slice(1), 16);
      var r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
      var max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, s = 0;
      if (max !== min) s = l > .5 ? (max - min) / (2 - max - min) : (max - min) / (max + min);
      total += PALETTE_FIDELITY ? s : Math.min(s, RIDGE_MAX_SATURATION);  /* what applyPalette will actually paint */
    }
    return total / group.rows.length;
  }

  function buildPaletteSchedule(groups, seed) {
    /* Sort by id first so the input order is fixed regardless of how the file
       is serialised — the shuffle must depend on the seed alone, otherwise the
       "same seed, same order" guarantee quietly depends on file layout. */
    var sorted = groups.slice().sort(function (a, b) { return a.id.localeCompare(b.id); });
    var rand = mulberry32(seed);

    function shuffle(list) {                             /* Fisher–Yates */
      for (var i = list.length - 1; i > 0; i--) {
        var j = Math.floor(rand() * (i + 1));
        var t = list[i]; list[i] = list[j]; list[j] = t;
      }
      return list;
    }

    var pref = [], rest = [];
    for (var k = 0; k < sorted.length; k++) {
      var inSeg = OPENING_SEGMENTS.indexOf(sorted[k].seg) >= 0;
      (inSeg && onScreenSaturation(sorted[k]) >= OPENING_MIN_SATURATION ? pref : rest)
        .push(sorted[k]);
    }
    /* If the catalogue ever loses those segment names, fall back to one plain
       shuffle rather than building around an empty pool. */
    if (!pref.length || !rest.length) return shuffle(sorted);
    shuffle(pref); shuffle(rest);

    /* ── The preferred groups OPEN the cycle and then recur through it ──────
       Not two halves. Concatenating them ran all 33 preferred groups first —
       eight minutes of curated colour, and then they never came back for the
       remaining twenty. Anyone who did not arrive in the first eight minutes,
       or who reloaded an already-running tab, saw none of them at all. That is
       the whole reason this looked unchanged after two attempts.

       "More likely" has to mean more likely throughout, so they are spread
       evenly instead: Bresenham over the two pools, which places a preferred
       group roughly every 3.5 slots for the whole 28 minutes. Slot 0 is forced
       preferred so the opening bias still holds.

       Still a permutation — every group plays exactly once per cycle. Making
       them genuinely more frequent than that would mean repeating some groups
       within a cycle, which is a different and worse thing: the catalogue would
       stop being a catalogue. */
    var out = [], pi = 0, ri = 0, total = pref.length + rest.length, acc = 0;
    for (var s = 0; s < total; s++) {
      var takePref;
      if (s === 0) takePref = true;                       /* open on colour */
      else if (pi >= pref.length) takePref = false;
      else if (ri >= rest.length) takePref = true;
      else {
        acc += pref.length;
        takePref = acc >= total;
        if (takePref) acc -= total;
      }
      out.push(takePref ? pref[pi++] : rest[ri++]);
    }
    return out;
  }

  /* ⚠️⚠️ The stagger is for pages that DRAW the range. It exists to spread the
     twelve 1.5s `fill` transitions so the SVG repaints as a cascade instead of
     one huge task — measured, on the app route, at 12 long tasks totalling
     1422ms when the gap was 400ms against 1 task of 71ms at 120ms.

     On the two block routes there is no range to repaint. What there IS, is a
     page whose every fill is `oklch(from var(--bw-palette-N) …)`, so each of
     those twelve writes to <html> invalidates the whole document and restyles
     several hundred SVG paths. Spreading them turns ONE restyle into TWELVE.
     Measured at 6x CPU throttle over fifteen seconds on the method page: 44
     long tasks totalling 5926ms with the stagger, from a grand total of 30
     property writes and a single group change. With the range script blocked
     entirely the same page ran at 60fps with no long tasks at all — which is
     how a script that draws nothing on these routes turned out to be the whole
     of the lag being reported.

     So: staggered where it spreads work, batched where it multiplies it. */
  function drawsRange() {
    return !!document.querySelector(".mtn-bg");
  }

  function queuePaletteLayer(delay, fn, immediate) {
    if (immediate || delay === 0 || !drawsRange()) fn();
    else paletteLayerTimers.push(setTimeout(fn, delay));
  }

  function applyPalette(group, immediate) {
    var root = document.documentElement;
    /* The catalogue can contain very pale lilacs and candy-bright accents.
       Keep their hue relationships, but force every live UI colour into the
       same low-glare editorial range before exposing it as a CSS token. */
    var tonedRows = group.rows.map(function (hex) { return toned(hex, .60, RIDGE_MAX_SATURATION); });
    var backgrounds = group.backgrounds || {};
    /* Keep the sky distinctly lighter than the water and ridges without
       introducing a bright white field or another visual treatment. */
    var tonedCloud = toned(backgrounds.sky || group.cloud, .82, SKY_MAX_SATURATION, .76);
    var tonedWater = toned(backgrounds.water || group.rows[4], .64, WATER_MAX_SATURATION, .42);
    var gemIndex = Array.isArray(group.gems) && group.gems.length
      ? Math.max(0, Math.min(9, group.gems[0] - 1))
      : 5;
    paletteLayerTimers.forEach(clearTimeout);
    paletteLayerTimers = [];
    root.dataset.bwPalette = group.id;
    root.dataset.bwPaletteName = group.name || "";
    root.dataset.bwPaletteSegment = group.seg || "";
    root.style.removeProperty("--bw-palette-haze");
    publishHues(root, tonedRows, tonedCloud, tonedWater);
    /* Sky, ten ridges, then water: every plane interpolates for 1.5 seconds,
       while neighbouring planes start 120ms apart.
       ⭐ That gap was 400ms, which put the twelve 1.5s `fill` transitions across
       a six-second window — six seconds of continuous full-SVG repaint every
       fifteen, and the stutter felt on every palette change regardless of what
       else was switched off. Measured over two changes: 12 long tasks totalling
       1422ms at 400ms, 1 totalling 71ms at 120ms.
       ⚠️ Not zero. Collapsing the stagger makes all twelve planes repaint in
       the same frame — one huge task instead of many small ones, measured at 7
       tasks and 542ms. The cascade is what spreads the work; it just has to be
       short enough that the transitions overlap instead of queueing. */
    queuePaletteLayer(0, function () {
      root.style.setProperty("--bw-palette-cloud", tonedCloud);
      /* Text sitting straight on the landscape, tinted by the landscape.
         Two roles because they carry different weights: --bw-ink-on-sky is for
         reading sizes and holds 4.5:1, --bw-ink-on-sky-strong is for the
         display type, which is large enough for 3:1 but reads better dark. */
      /* 5.2, not 4.5. This ink is solved against the cloud colour, but the text
         that uses it lands on whatever ridge happens to be under it — measured
         across 20 groups, five separate pieces of chrome on index all came in at
         exactly 4.46:1, i.e. the solver hit its target and the target was the
         line itself. The extra 0.7 is the margin between the cloud it is solved
         against and the ridge it actually sits on. */
      root.style.setProperty("--bw-ink-on-sky", inkOn(tonedCloud, 5.2));
      root.style.setProperty("--bw-ink-on-sky-strong", inkOn(tonedCloud, 7));
      /* …and one more for the bottom of the screen, solved against the lower
         ridges the footer actually lies across rather than against the sky.
         Rows 5-9 are the band anything anchored to the foot of the viewport can
         touch; 5.5 leaves the same margin over the solve that --bw-ink-on-sky
         carries over its own. */
      /* ⚠️⚠️ Solved against the raw catalogue rows, and that is a MEASURED
         choice, not the obvious one.

         The obvious one was to model what is on the screen — the fills paint at
         .72 over the sky, so a row published as rgb(7,0,0) composites to about
         rgb(108,99,96), and solving against the raw value is solving against a
         colour that is nowhere on the page. That reasoning is correct and the
         result was worse: composited-and-narrowed measured 190 failures over
         the same 24 groups where the raw five-row solve measured 16. The model
         is not wrong about compositing, it is wrong about WHICH ridges are
         under the footer, and there is no way to know that from here — the text
         lies across whatever the silhouettes happen to do at that scroll
         position and that viewport width.
         So the version that measures better ships, and the theory that lost is
         written down rather than deleted, because it will look right again to
         the next person. */
      root.style.setProperty("--bw-ink-on-ridge", inkOnAll(paintedGrounds(tonedRows, tonedCloud).slice(6), 5.5));
      /* The cloud body gets its own value. Its contour lines keep taking the
         gem, so the cloud reads the way a ridge does — a plane plus its own
         line work — rather than as an outline with nothing inside it. */
      var cloudBody = cloudBodyFor(tonedCloud, tonedRows[0]);
      root.style.setProperty("--bw-palette-cloudbody", cloudBody);
      document.querySelectorAll(".mtn-bg .cloud-body").forEach(function (node) {
        node.style.fill = cloudBody;
      });
    }, immediate);

    tonedRows.forEach(function (hex, index) {
      queuePaletteLayer((index + 1) * 120, function () {
        root.style.setProperty("--bw-palette-" + (index + 1), hex);
        root.style.setProperty("--bw-palette-on-" + (index + 1), readableOn(hex));
        document.querySelectorAll(".mtn-bg").forEach(function (el) {
          el.querySelectorAll(".fill.l" + (index + 1)).forEach(function (node) {
            node.style.fill = hex;
          });
        });
        if (index === gemIndex) {
          root.style.setProperty("--bw-palette-gem", hex);
          root.style.setProperty("--bw-palette-on-gem", readableOn(hex));
        }
      }, immediate);
    });

    queuePaletteLayer(4400, function () {
      root.style.setProperty("--bw-palette-water", tonedWater);
      document.querySelectorAll(".mtn-water").forEach(function (node) {
        node.style.fill = tonedWater;
      });
    }, immediate);

    window.dispatchEvent(new CustomEvent("bw:palettechange", {
      detail: { id: group.id, name: group.name, segment: group.seg,
                slot: +(document.documentElement.dataset.bwPaletteSlot || 0) }
    }));
  }

  /* ⚠️⚠️ TRIED AND WITHDRAWN: rasterising the ridges into an <img> and moving
     the picture instead of the drawing.

     The performance case is real and measured — 59fps with 3 of 295 frames over
     20ms, against 52fps with 90 of 261 for the live SVG, which is as cheap as
     having no landscape at all. But the copy has to be self-contained, and
     making it so is where it fell over twice:

     ① `getComputedStyle` on a <g> answers with the INITIAL value for anything
        the group does not set, so `fill` comes back rgb(0,0,0). Writing that
        onto groups painted the whole landscape as a black slab.
     ② Fixed that, and the picture was still wrong: the bake runs 60ms after
        applyPalette, which is 60ms into a 1.5s fill transition, so it captured
        the ridges mid-fade — measured .48 opacity where the sheet says .72.

     Both are fixable. Neither was fixed under a page that has to look right
     now, and a landscape that renders wrong is worse than one that drifts at
     52fps. The drift is smooth and the speed is what stopped it reading as
     steps; the pacing is the part still owed.

     If this is picked up again: bake AFTER the transition settles (1.6s+),
     re-bake on every group change, keep the clouds out of the clone, and
     compare the baked picture against the live one pixel by pixel before
     trusting it. */

  function startPaletteSystem(clockStart, reduce, seed) {
    fetch(paletteUrl, { cache: "force-cache" })
      .then(function (response) {
        if (!response.ok) throw new Error("Palette data " + response.status);
        return response.json();
      })
      .then(function (groups) {
        if (!Array.isArray(groups) || !groups.length || !groups.every(validPaletteGroup)) {
          throw new Error("Palette data failed validation");
        }
        paletteGroups = groups;
        var schedule = buildPaletteSchedule(groups, seed);
        paletteScheduleSlots = schedule.length;
        var firstApply = true;
        function update() {
          var slot = Math.floor((Date.now() - clockStart) / paletteDwellMs);
          var index = ((slot * paletteStep) % schedule.length + schedule.length) % schedule.length;
          /* ⭐ The slot number is published so consumers can key something to
             the turn of the clock rather than to the group's identity. The
             block routes hang day and night off it: two horizon blocks, one lit
             and one dark, trading places every time the colour changes. Parity
             of the group's index would tie the sky to WHICH card is up, so a
             visitor arriving mid-schedule could see the same half of the day
             for a long run; the slot always alternates. The raw count is
             published rather than its parity, so a consumer can also walk
             something ACROSS successive turns — the sun's place in its arc. */
          document.documentElement.dataset.bwPaletteSlot = String(slot);
          applyPalette(schedule[index], firstApply || reduce);
          firstApply = false;
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
    if (flatGlass && !document.getElementById('mtn-flat-glass')) {
      var fg = document.createElement('style');
      fg.id = 'mtn-flat-glass';
      fg.textContent = '*{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}'
        + 'html[data-skin="paper"] body :is(.sidebar,.composer,.method-menu,.carry-menu,.pagehead,'
        + '.top,.card,.panel,.plan,.rate-card,.pack,.term,.ledgerstrip,.account-menu,.popover,'
        + '.modal,.dialog,.sheet,.toast){background-color:rgb(255 255 255 / .92)!important}';
      document.head.appendChild(fg);
    }
    if (!document.getElementById('mtn-bg-css')) {
      var st = document.createElement('style');
      st.id = 'mtn-bg-css';
      st.textContent = CSS;
      document.head.appendChild(st);
    }
    var reduce = matchMedia('(prefers-reduced-motion:reduce)').matches;
    /* The animation phase only needs a stable long clock; palette count is
       discovered asynchronously and may grow beyond the original catalogue. */
    var cycleMs = 86400000;
    var clockKey = 'bw-palette-clock-v4';
    var seedKey = 'bw-palette-seed-v1';
    var seenKey = 'bw-mtn-seen';
    var clockStart;
    var paletteSeed = 0;
    var seen = false;
    try {
      clockStart = +(sessionStorage.getItem(clockKey) || 0);
      if (!clockStart) {
        clockStart = Date.now();
        sessionStorage.setItem(clockKey, String(clockStart));
      }
      /* Drawn once per session and stored beside the clock, for the reason
         given at buildPaletteSchedule: the order has to survive navigation.
         Both keys are read before either is written, so a page that loads
         mid-session inherits the phase AND the permutation. */
      paletteSeed = +(sessionStorage.getItem(seedKey) || 0);
      if (!paletteSeed) {
        paletteSeed = (Math.random() * 4294967296) >>> 0 || 1;
        sessionStorage.setItem(seedKey, String(paletteSeed));
      }
      seen = sessionStorage.getItem(seenKey) === '1';
      sessionStorage.setItem(seenKey, '1');
    } catch (e) {
      /* Private mode / storage blocked: still shuffle, just per page load.
         A visitor who cannot persist anything has no cross-page continuity to
         protect, so a fresh draw is the honest fallback rather than a constant
         that would hand every such visitor the same order. */
      clockStart = Date.now();
      paletteSeed = (Math.random() * 4294967296) >>> 0 || 1;
    }
    /* Shape is chosen once, from the same seed as the palette order, BEFORE
       anything is built — every .mtn-bg on the page must get the same range. */
    pickRidgeVariant(paletteSeed);

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
      if (!el.firstElementChild) {
        el.innerHTML = build({
        vbw: el.dataset.vbw ? +el.dataset.vbw : 1000,
        par: el.dataset.par || 'xMidYMid slice'
        });
      }

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
    startPaletteSystem(clockStart, reduce, paletteSeed);
  }

  /* ⭐ The cloud is published so the block routes can draw THE SAME ONE. Those
     pages switch the range off and build their own skylines, and a hand-made
     lookalike there would be the one cloud on the site that is not this cloud —
     the same argument that put the catalogue's own sun and moon in the horizon
     blocks rather than a plain disc. Body plus its three contour rows, which is
     what makes a cloud read the way a ridge does: a plane and its own line
     work, not an outline with nothing inside it. */
  window.BWRange = {
    cloudBody: CLOUD,
    cloudContour: CLOUDC,
    cloudRows: CLOUD_ROWS,
    /* ⭐ A way to hold one group still. The catalogue is a shuffled permutation
       walked by a session clock, so "pin the seed and rewind the clock" only
       lands on the group you wanted if nothing else moves — and it does: two
       runs of the same sweep reported different group ids, which means a green
       result was a sample, not a sweep. Anything solved across 114 groups needs
       to be checkable across 114 groups.
       Reads the catalogue and repaints; changes no scheduling state, so the
       page carries on from wherever it was. */
    groupIds: function () { return paletteGroups.map(function (g) { return g.id; }); },
    showGroup: function (id) {
      for (var i = 0; i < paletteGroups.length; i++) {
        if (String(paletteGroups[i].id) === String(id)) { applyPalette(paletteGroups[i], true); return true; }
      }
      return false;
    }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
