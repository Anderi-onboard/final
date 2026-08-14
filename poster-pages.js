(function () {
  "use strict";
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var body = document.body;
  var page = body && body.dataset.page;
  var patternSources = [
    "./assets/textures/lianqian/lianqian-dense-clay.webp?v=20260815d",
    "./assets/textures/lianqian/lianqian-outline-silver.webp?v=20260815d",
    "./assets/textures/lianqian/lianqian-spaced-medallion.webp?v=20260815d",
    "./assets/textures/lianqian/lianqian-diagonal-clay.webp?v=20260815d"
  ];

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
