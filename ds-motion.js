/* ds-motion.js — BourneWise shared motion layer.
   One file gives every long-form page the same silk: a scroll-progress rail,
   IntersectionObserver reveals, and SplitText-style word reveals on headings.
   Pure enhancement — with JS off or reduced motion on, the page is fully
   present. Nothing here is required for content to be readable.

   Scrolling is NATIVE. A JS scroll-hijacker (we shipped Lenis for a while)
   runs a permanent rAF loop and lerps the scroll offset by hand, which fought
   the always-animating mountain background and produced the very stutter it
   was meant to cure. Native scroll is browser/GPU-driven and never stutters.

   Opt in per page with:  <body data-motion>   (or call BWMotion.start())
   Markup hooks:
     [data-reveal]            → rises into view (see tokens/motion.css)
     [data-reveal-group]      → auto-stagger direct [data-reveal] children (--i)
     [data-split]             → heading whose words rise one after another */
(function () {
  "use strict";
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var started = false;

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

    /* The -12% bottom margin holds a reveal back until it has risen clear of the
       fold. An element sitting in that last sliver of the DOCUMENT can therefore
       never satisfy the threshold — there is no more page left to scroll, so it
       stays at opacity 0 for good. (guide.html's closing "500 free units are
       waiting" was invisible for exactly this reason.) Sweep the stragglers in
       once the reader reaches the bottom. */
    function sweep() {
      if (scrollY + innerHeight < document.documentElement.scrollHeight - 2) return;
      targets.forEach(function (t) { t.classList.add('is-in'); io.unobserve(t); });
      removeEventListener('scroll', sweep);
      removeEventListener('load', sweep);
    }
    addEventListener('scroll', sweep, { passive: true });
    addEventListener('load', sweep);   // after fonts/images settle the height
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
    addEventListener('scroll', function () { set(); }, { passive: true });
    set(0);
    return rail;
  }

  function start() {
    if (started) return; started = true;
    document.querySelectorAll('[data-split]').forEach(split);
    markGroups();
    progress();
    observe();
    document.documentElement.classList.add('motion-ready');
  }

  window.BWMotion = { start: start };

  function boot() {
    if (document.body && document.body.hasAttribute('data-motion')) start();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
