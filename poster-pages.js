(function () {
  "use strict";
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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
