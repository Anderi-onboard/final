(function () {
  "use strict";
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var body = document.body;
  var page = body && body.dataset.page;
  var patternSources = [
    "./assets/textures/lianqian/lianqian-dense-clay-tile.webp?v=20260901c",
    "./assets/textures/lianqian/lianqian-outline-silver-tile.webp?v=20260901c",
    "./assets/textures/lianqian/lianqian-spaced-medallion-tile.webp?v=20260901c",
    "./assets/textures/lianqian/lianqian-diagonal-clay-tile.webp?v=20260901c"
  ];
  /* The accent marks used to be 112x112 webp crops. At that size they were
     already below one device pixel per source pixel on any 2x screen, so they
     rendered soft, and because the artwork was cut out of a larger tile the
     outer ring of the motif was clipped — blurry and incomplete at once.
     A connected-coin motif is strictly constructible: circles on a square
     pitch that overlap, each with the square hole. Drawing it means it is
     sharp at every zoom and DPI, complete by construction, and takes the
     palette through currentColor instead of baking one colour into a file. */
  function coinMark(rings) {
    var NS = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 120 120");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "1.6");
    svg.setAttribute("aria-hidden", "true");
    var add = function (tag, attrs) {
      var n = document.createElementNS(NS, tag);
      for (var k in attrs) n.setAttribute(k, attrs[k]);
      svg.appendChild(n);
    };
    /* One centre coin plus a ring of four at the cardinal points, at a pitch
       that makes neighbours intersect — the overlap is what turns separate
       coins into 连钱, and the negative space between them into the四-petal. */
    var pitch = rings ? 30 : 34, r = pitch * 0.86, hole = pitch * 0.2;
    var centres = [[60, 60], [60 - pitch, 60], [60 + pitch, 60], [60, 60 - pitch], [60, 60 + pitch]];
    centres.forEach(function (c) {
      add("circle", { cx: c[0], cy: c[1], r: r.toFixed(2) });
      add("path", {
        d: "M" + c[0] + " " + (c[1] - hole) + "L" + (c[0] + hole) + " " + c[1] +
           "L" + c[0] + " " + (c[1] + hole) + "L" + (c[0] - hole) + " " + c[1] + "Z"
      });
    });
    if (rings) centres.forEach(function (c) {
      add("circle", { cx: c[0], cy: c[1], r: (r * 0.58).toFixed(2) });
    });
    return svg;
  }

  function appendAccent(target, type, modifier) {
    if (!target || target.querySelector(".lq-accent")) return;
    var accent = coinMark(type === "medallion");
    accent.setAttribute("class", "lq-accent " + modifier);
    target.appendChild(accent);
  }

  function installAccents() {
    if (page === "about") {
      appendAccent(document.querySelector(".why-hero"), "coin", "lq-accent--about-hero");
      appendAccent(document.querySelectorAll(".why-panel")[1], "coin", "lq-accent--about-panel");
    } else if (page === "guide") {
      appendAccent(document.querySelector(".guide-stage"), "medallion", "lq-accent--guide");
    } else if (page === "legal") {
      appendAccent(document.querySelector(".legal-poster-intro"), "coin", "lq-accent--legal-intro");
      Array.prototype.forEach.call(document.querySelectorAll(".clause"), function (clause, index) {
        if ((index + 1) % 3 === 0) appendAccent(clause, "coin", "lq-accent--legal-clause");
      });
    }
  }

  function installPatternStage() {
    if (["about", "guide", "legal"].indexOf(page) === -1) return;

    var stage = document.createElement("div");
    stage.className = "lq-texture-stage";
    stage.setAttribute("aria-hidden", "true");
    var layers = [document.createElement("span"), document.createElement("span")];
    layers.forEach(function (layer) {
      layer.className = "lq-texture-layer";
      stage.appendChild(layer);
    });
    body.insertBefore(stage, body.firstChild);

    var activeLayer = 0;
    var activePattern = -1;
    function showPattern(value) {
      var index = ((Number(value) || 0) % patternSources.length + patternSources.length) % patternSources.length;
      if (index === activePattern) return;
      var incoming = activePattern < 0 ? layers[activeLayer] : layers[1 - activeLayer];
      var outgoing = activePattern < 0 ? null : layers[activeLayer];
      incoming.style.backgroundImage = 'url("' + patternSources[index] + '")';
      incoming.dataset.pattern = String(index);
      incoming.classList.add("is-current");
      if (outgoing) outgoing.classList.remove("is-current");
      if (activePattern >= 0) activeLayer = 1 - activeLayer;
      activePattern = index;
      stage.dataset.pattern = String(index);
    }

    if (page === "guide") {
      showPattern(body.dataset.posterStep || 0);
      new MutationObserver(function () {
        showPattern(body.dataset.posterStep || 0);
      }).observe(body, { attributes: true, attributeFilter: ["data-poster-step"] });
      return;
    }

    var activeSections = Array.prototype.slice.call(document.querySelectorAll(
      page === "about"
        ? ".why > .why-hero, .why > .editorial-spread, .why > .why-panel, .why > .close"
        : ".legal > .legal-poster-intro, .legal > .clause, .legal > .legal-foot"
    ));
    activeSections.forEach(function (section, index) {
      section.dataset.lqPattern = String(index % patternSources.length);
    });
    showPattern(activeSections[0] ? activeSections[0].dataset.lqPattern : 0);

    if (!("IntersectionObserver" in window)) return;
    var textureObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) showPattern(entry.target.dataset.lqPattern);
      });
    }, { threshold: 0, rootMargin: "-38% 0px -38% 0px" });
    activeSections.forEach(function (section) { textureObserver.observe(section); });
  }

  installPatternStage();
  installAccents();

  var selector = [
    'body[data-page="about"] .why > *',
    'body[data-page="legal"] .legal-poster-intro',
    'body[data-page="legal"] .clause',
    'body[data-page="legal"] .legal-foot'
  ].join(',');
  var sections = Array.prototype.slice.call(document.querySelectorAll(selector));
  if (!sections.length || reduce || !("IntersectionObserver" in window)) return;
  document.documentElement.classList.add("has-poster-observer");
  sections.forEach(function (section) { section.classList.add("poster-section"); });
  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("poster-visible");
      observer.unobserve(entry.target);
    });
  }, { threshold: .08, rootMargin: "0px 0px -8% 0px" });
  sections.forEach(function (section) { observer.observe(section); });
}());
