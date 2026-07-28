/* BourneWise — wave wipe.
   ONE device, used site-wide, so the pages stop reading as separate builds:
   a ridge from the same range that runs behind everything sweeps across (or
   down) and the content on either side of it is simply old or new. No fading —
   every pixel is one state or the other, and the seam always rides under the
   ridge body so the cut is never visible.

     BWWipe.rotate(el, lines[, opts])   horizontal — cycles a headline
     BWWipe.reveal(el[, opts])          vertical  — wipes a section into view

   Motion is transform + clip-path only, driven by one progress value so the
   ridge and the seam can never drift apart. Nothing here animates a paint
   property, and nothing touches the background engine. */
(function () {
  "use strict";

  /* the same ridge geometry the range itself is built from (layer 6 — the one
     with enough relief to swallow a line of type and let it go again) */
  var RIDGE = "M -2000 330 L -1820 328 C -1660 328 -1630 180 -1470 180 C -1330 180 -1300 322 -1160 322 L -820 318 C -700 318 -688 208 -568 208 C -462 208 -448 316 -342 316 L 0 330 L 180 328 C 340 328 370 180 530 180 C 670 180 700 322 840 322 L 1180 318 C 1300 318 1312 208 1432 208 C 1538 208 1552 316 1658 316 L 2000 330";

  var CSS_ID = "bw-wipe-css";
  function injectCSS() {
    if (document.getElementById(CSS_ID)) return;
    var s = document.createElement("style");
    s.id = CSS_ID;
    s.textContent = [
      ".bw-wipe{position:relative;isolation:isolate}",
      /* the two states sit exactly on top of each other; clip decides which
         half of the world you are looking at */
      ".bw-wipe-face{grid-area:1/1}",
      ".bw-wipe-stack{display:grid}",
      ".bw-wipe-ridge{position:absolute;pointer-events:none;z-index:3;will-change:transform;",
      "opacity:0;transition:opacity .28s linear}",
      ".bw-wipe-ridge.on{opacity:1}",
      ".bw-wipe-ridge svg{display:block;width:100%;height:100%}",
      /* Feather the band's own edges. Without this the ridge arrives as a hard
         rectangle pasted over the page — the exact bolted-on look this device
         exists to remove. Same trick .mtn-bg uses to dissolve into the paper. */
      /* horizontal: a wide band that crosses the line */
      /* Feather BOTH axes and intersect them, so the band has no straight edge
         anywhere — the host box is only as wide as its text, so without the
         second gradient the ridge ends on a visible vertical cut at the
         headline's bounds. */
      ".bw-wipe-ridge.x{top:-70%;left:0;width:150%;height:240%;",
      "-webkit-mask-image:linear-gradient(to bottom,transparent 0,#000 22%,#000 74%,transparent 100%),",
      "linear-gradient(to right,transparent 0,#000 9%,#000 91%,transparent 100%);",
      "mask-image:linear-gradient(to bottom,transparent 0,#000 22%,#000 74%,transparent 100%),",
      "linear-gradient(to right,transparent 0,#000 9%,#000 91%,transparent 100%);",
      "-webkit-mask-composite:source-in;mask-composite:intersect}",
      /* vertical: the same ridge stood on its side, sweeping down a section */
      ".bw-wipe-ridge.y{left:-70%;top:0;width:240%;height:150%;",
      "-webkit-mask-image:linear-gradient(to right,transparent 0,#000 22%,#000 74%,transparent 100%),",
      "linear-gradient(to bottom,transparent 0,#000 9%,#000 91%,transparent 100%);",
      "mask-image:linear-gradient(to right,transparent 0,#000 22%,#000 74%,transparent 100%),",
      "linear-gradient(to bottom,transparent 0,#000 9%,#000 91%,transparent 100%);",
      "-webkit-mask-composite:source-in;mask-composite:intersect}",
      "@media (prefers-reduced-motion:reduce){.bw-wipe-ridge{display:none}}"
    ].join("");
    document.head.appendChild(s);
  }

  /* the ridge, rendered in the paper palette so it reads as the same land */
  function ridgeSVG(vertical) {
    var band =
      '<use href="#bw-wipe-rg" fill="var(--wipe-1,#CBB99C)"/>' +
      '<use href="#bw-wipe-rg" y="16" fill="none" stroke="rgba(42,32,22,.20)" stroke-width="3"/>' +
      '<use href="#bw-wipe-rg" y="32" fill="none" stroke="rgba(42,32,22,.20)" stroke-width="3"/>' +
      '<use href="#bw-wipe-rg" y="48" fill="none" stroke="rgba(42,32,22,.20)" stroke-width="3"/>' +
      '<use href="#bw-wipe-rg" y="112" fill="var(--wipe-2,#B6A386)"/>' +
      '<use href="#bw-wipe-rg" y="156" fill="var(--wipe-3,#9E8A6B)"/>';
    return '<svg viewBox="-700 150 2200 430" preserveAspectRatio="none" aria-hidden="true"' +
      (vertical ? ' style="transform:rotate(90deg);transform-origin:50% 50%"' : '') + '>' +
      '<defs><path id="bw-wipe-rg" d="' + RIDGE + ' L 4000 900 L -2000 900 Z"/></defs>' +
      band + '</svg>';
  }

  function reduced() {
    return window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  /* easeInOutCubic — the same weighted curve the rest of the site moves on */
  function ease(t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

  /* ── horizontal: swap a headline as the ridge crosses it ───────────────── */
  function rotate(host, lines, opts) {
    if (!host || !lines || lines.length < 2) return null;
    opts = opts || {};
    injectCSS();
    var dur = opts.duration || 5200;
    var every = opts.every || 34000;

    host.classList.add("bw-wipe");
    var stack = document.createElement("span");
    stack.className = "bw-wipe-stack";
    var oldFace = document.createElement("span"); oldFace.className = "bw-wipe-face";
    var newFace = document.createElement("span"); newFace.className = "bw-wipe-face";
    /* the incoming face is a purely visual understudy — at rest it is clipped
       to nothing, and only oldFace ever holds the line that is actually being
       shown. Hide it from assistive tech or the headline gets read twice, as
       two different sentences run together. */
    newFace.setAttribute("aria-hidden", "true");
    var i = 0;
    oldFace.textContent = lines[0];
    newFace.textContent = lines[1 % lines.length];
    stack.appendChild(oldFace); stack.appendChild(newFace);
    host.textContent = ""; host.appendChild(stack);

    var ridge = document.createElement("span");
    ridge.className = "bw-wipe-ridge x";
    ridge.innerHTML = ridgeSVG(false);
    host.appendChild(ridge);

    function seat(p) {
      var w = host.clientWidth || 1;
      var seam = p * w;
      ridge.style.transform = "translate3d(" + (seam - w * 0.75) + "px,0,0)";
      newFace.style.clipPath = "inset(0 " + (w - seam) + "px 0 0)";
      oldFace.style.clipPath = "inset(0 0 0 " + seam + "px)";
    }
    seat(0);

    var busy = false;
    function run() {
      if (busy || document.hidden || reduced()) return;
      busy = true; ridge.classList.add("on");
      var t0 = performance.now();
      (function step(now) {
        var e = Math.min(1, (now - t0) / dur);
        seat(ease(e));
        if (e < 1) requestAnimationFrame(step);
        else {
          i = (i + 1) % lines.length;
          oldFace.textContent = lines[i];
          newFace.textContent = lines[(i + 1) % lines.length];
          ridge.classList.remove("on");
          seat(0); busy = false;
        }
      })(t0);
    }
    var timer = setInterval(run, every);
    return { run: run, stop: function () { clearInterval(timer); } };
  }

  /* ── vertical: wipe a section into view the first time it is reached ───── */
  function reveal(el, opts) {
    if (!el) return;
    opts = opts || {};
    injectCSS();
    var dur = opts.duration || 1500;
    if (reduced()) { el.style.clipPath = ""; return; }

    el.classList.add("bw-wipe");
    var ridge = document.createElement("div");
    ridge.className = "bw-wipe-ridge y";
    ridge.innerHTML = ridgeSVG(true);
    el.appendChild(ridge);

    var done = false;
    function seat(p) {
      var h = el.clientHeight || 1;
      var seam = p * h;
      ridge.style.transform = "translate3d(0," + (seam - h * 0.75) + "px,0)";
      el.style.clipPath = "inset(0 0 " + Math.max(0, h - seam) + "px 0)";
    }
    seat(0);

    function play() {
      if (done) return; done = true;
      ridge.classList.add("on");
      var t0 = performance.now();
      (function step(now) {
        var e = Math.min(1, (now - t0) / dur);
        seat(ease(e));
        if (e < 1) requestAnimationFrame(step);
        else { el.style.clipPath = ""; ridge.classList.remove("on");
               setTimeout(function () { ridge.remove(); }, 320); }
      })(t0);
    }

    if (!("IntersectionObserver" in window)) { el.style.clipPath = ""; return; }
    var io = new IntersectionObserver(function (es) {
      if (es[0].isIntersecting) { io.disconnect(); play(); }
    }, { rootMargin: "-12% 0px -12% 0px" });
    io.observe(el);
  }

  window.BWWipe = { rotate: rotate, reveal: reveal };
})();
