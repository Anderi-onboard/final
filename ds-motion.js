/* ds-motion.js — BourneWise shared motion layer.
   One file gives every long-form page the same silk: Lenis inertial scroll,
   a scroll-progress rail, IntersectionObserver reveals, and SplitText-style
   word reveals on headings. Pure enhancement — if Lenis fails to load or the
   visitor prefers reduced motion, the page is fully present and native scroll
   takes over. Nothing here is required for content to be readable.

   Opt in per page with:  <body data-motion>   (or call BWMotion.start())
   Markup hooks:
     [data-reveal]            → rises into view (see tokens/motion.css)
     [data-reveal-group]      → auto-stagger direct [data-reveal] children (--i)
     [data-split]             → heading whose words rise one after another
   Respect the reader: [data-motion-lenis="off"] on <html> keeps native scroll
   but still runs reveals. */
(function () {
  "use strict";
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var started = false;
  var lenis = null;

  /* ── word-split a heading into <span class="w"><span class="ww">word</span></span>
     preserving spaces, so overflow:hidden can clip each word's rise. Skips if
     already split or if the node has element children (keep it simple/safe). */
  function split(el) {
    if (el.__split) return;
    el.__split = true;
    var words = [];
    (el.textContent || '').split(/(\s+)/).forEach(function (tok) {
      if (tok.trim() === '') { words.push(document.createTextNode(tok)); return; }
      words.push(tok);
    });
    el.textContent = '';
    var wi = 0;
    words.forEach(function (tok) {
      if (typeof tok !== 'string') { el.appendChild(tok); return; }
      var w = document.createElement('span'); w.className = 'w';
      var ww = document.createElement('span'); ww.className = 'ww';
      ww.textContent = tok;
      ww.style.setProperty('--wi', wi++);
      w.appendChild(ww); el.appendChild(w);
    });
  }

  function markGroups() {
    document.querySelectorAll('[data-reveal-group]').forEach(function (g) {
      var n = 0;
      Array.prototype.forEach.call(g.children, function (c) {
        if (c.hasAttribute('data-reveal') && !c.style.getPropertyValue('--i')) {
          c.style.setProperty('--i', n++);
        }
      });
    });
  }

  function observe() {
    var targets = [].slice.call(document.querySelectorAll('[data-reveal],[data-split]'));
    if (!('IntersectionObserver' in window) || reduce) {
      targets.forEach(function (t) { t.classList.add('is-in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });
    targets.forEach(function (t) { io.observe(t); });
  }

  /* progress rail — reflect scroll fraction into --scroll on <html> */
  function progress() {
    var rail = document.querySelector('.scroll-rail');
    var doc = document.documentElement;
    function set(y) {
      var max = (doc.scrollHeight - innerHeight) || 1;
      var f = Math.min(1, Math.max(0, (y != null ? y : (scrollY || pageYOffset)) / max));
      doc.style.setProperty('--scroll', f.toFixed(4));
    }
    if (lenis) { lenis.on('scroll', function (e) { set(e.animatedScroll != null ? e.animatedScroll : e.scroll); }); }
    else { addEventListener('scroll', function () { set(); }, { passive: true }); }
    set(0);
    return rail;
  }

  function initLenis() {
    if (reduce) return null;
    if (document.documentElement.getAttribute('data-motion-lenis') === 'off') return null;
    if (typeof Lenis === 'undefined') return null;      // vendor script absent → native scroll
    try {
      var l = new Lenis({
        // sondaven-grade feel: a long, exponential ease and gentle wheel gain.
        duration: 1.15,
        easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); },
        smoothWheel: true,
        wheelMultiplier: 0.9,
        touchMultiplier: 1.4,
        lerp: 0.09
      });
      function raf(time) { l.raf(time); requestAnimationFrame(raf); }
      requestAnimationFrame(raf);
      return l;
    } catch (e) { return null; }
  }

  function start() {
    if (started) return; started = true;
    document.querySelectorAll('[data-split]').forEach(split);
    markGroups();
    lenis = initLenis();
    progress();
    observe();
    document.documentElement.classList.add('motion-ready');
  }

  window.BWMotion = { start: start, get lenis() { return lenis; } };

  function boot() {
    if (document.body && document.body.hasAttribute('data-motion')) start();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
