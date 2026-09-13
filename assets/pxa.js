/**
 * BWPixel — the player for .pxa colour-cell animations.
 *
 * Two things it has to get right, and they are the two things every
 * hand-rolled sprite player gets wrong:
 *
 * ① SCALE. A cell is a unit, not a pixel. The canvas is sized to an INTEGER
 *    number of device pixels per cell, then centred — because a fractional
 *    scale makes some cells 2px and their neighbours 3px, and a picture whose
 *    own pixels are different sizes reads as broken rather than as small.
 *    Integer scale is computed in DEVICE pixels, not CSS pixels: on a 2x
 *    screen those are not the same number and rounding the wrong one is how
 *    "it's crisp on my machine" happens.
 *
 * ② TIME. Frames advance on a fixed accumulator, never on raw deltaTime. At
 *    12fps on a 60Hz screen an interpolated clock spends 5 display frames on
 *    one cel and 6 on the next, and the animation visibly limps. The
 *    accumulator makes every cel the same length by construction.
 *
 * And one thing only this repo needs: the palette is INDICES, so `@3` resolves
 * to var(--bw-palette-3) at paint time and the animation rotates with the 114
 * colour groups. It re-resolves on bw:palettechange. Every other bitmap on
 * this site is the one thing on the page that does not follow the palette;
 * this one cannot be, because it does not store colour.
 *
 *   import './assets/pxa.js';
 *   BWPixel.mount(el, '/assets/art/rain.pxa.json', { fit: 'integer' });
 *
 * Respects prefers-reduced-motion (holds the poster frame) and stops entirely
 * while off screen — an animation nobody is looking at should cost nothing.
 */
import { decode, cssVarFor } from './pxa-codec.mjs';

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)');

function resolvePalette(doc, host) {
  const probe = getComputedStyle(host);
  return doc.palette.map((entry) => {
    if (entry === '-') return null;
    const varName = cssVarFor(entry);
    if (!varName) return entry;
    const v = probe.getPropertyValue(varName).trim();
    // A slot the engine has not published yet (palette JSON still loading, or
    // a route that does not run mountain-range.js) must not paint black. Hold
    // the cell transparent until the real value arrives — a missing colour is
    // not a colour, and this repo has shipped "declared but never painted"
    // enough times to know how that ends.
    return v || null;
  });
}

/** "#rgb"/"#rrggbb"/"rgb(...)"/"oklch(...)" → [r,g,b] via a 1x1 scratch canvas.
 *  Going through the canvas means the browser's own colour parser does the
 *  work, so oklch() and color-mix() resolve correctly instead of needing a
 *  second parser here that would drift from the first. */
const scratch = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
scratch.canvas.width = scratch.canvas.height = 1;
function toRGB(css) {
  scratch.clearRect(0, 0, 1, 1);
  scratch.fillStyle = '#000';
  scratch.fillStyle = css;
  scratch.fillRect(0, 0, 1, 1);
  const d = scratch.getImageData(0, 0, 1, 1).data;
  return [d[0], d[1], d[2], d[3]];
}

class Clip {
  constructor(host, doc, opts = {}) {
    this.host = host;
    this.doc = doc;
    this.a = decode(doc);
    this.fit = opts.fit || 'integer';
    this.poster = Math.min(opts.poster || 0, this.a.frames.length - 1);
    this.speed = opts.speed || 1;
    this.max = opts.maxScale || Infinity;
    this.onfit = opts.onfit || null;

    this.canvas = document.createElement('canvas');
    this.canvas.setAttribute('role', 'img');
    if (opts.label) this.canvas.setAttribute('aria-label', opts.label);
    else this.canvas.setAttribute('aria-hidden', 'true');
    this.canvas.style.display = 'block';
    this.ctx = this.canvas.getContext('2d', { alpha: true });
    host.appendChild(this.canvas);

    // The filmstrip: every frame laid out in one offscreen canvas at 1 cell =
    // 1 pixel. Playing a frame is then a single drawImage of one band — no
    // putImageData in the hot path, and the scale-up runs on the GPU.
    this.strip = document.createElement('canvas');
    this.strip.width = this.a.w;
    this.strip.height = this.a.h * this.a.frames.length;
    this.sctx = this.strip.getContext('2d', { willReadFrequently: false });

    this.frame = this.poster;
    this.acc = 0;
    this.last = 0;
    this.raf = 0;
    this.visible = true;

    this.paintStrip();
    this.layout();

    this.onResize = () => this.layout();
    this.ro = new ResizeObserver(this.onResize);
    this.ro.observe(host);

    this.onPalette = () => { this.paintStrip(); this.draw(); };
    window.addEventListener('bw:palettechange', this.onPalette);

    this.onMotion = () => this.sync();
    REDUCED.addEventListener('change', this.onMotion);

    this.io = new IntersectionObserver((entries) => {
      this.visible = entries[entries.length - 1].isIntersecting;
      this.sync();
    }, { rootMargin: '64px' });
    this.io.observe(host);

    this.sync();
  }

  paintStrip() {
    const { w, h, frames, palette } = this.a;
    const css = resolvePalette({ palette }, this.host);
    const rgb = css.map((c) => (c === null ? null : toRGB(c)));
    const img = this.sctx.createImageData(w, h * frames.length);
    const d = img.data;
    for (let t = 0; t < frames.length; t++) {
      const g = frames[t], base = t * w * h * 4;
      for (let i = 0; i < g.length; i++) {
        const c = rgb[g[i]];
        const p = base + i * 4;
        if (!c) { d[p + 3] = 0; continue; }
        d[p] = c[0]; d[p + 1] = c[1]; d[p + 2] = c[2]; d[p + 3] = c[3];
      }
    }
    this.sctx.putImageData(img, 0, 0);
  }

  layout() {
    const { w, h } = this.a;
    const r = this.host.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    if (!r.width || !r.height) return;

    const availW = r.width * dpr, availH = r.height * dpr;
    const exact = Math.min(availW / w, availH / h);
    let s = this.fit === 'fill' ? exact : Math.min(this.max, Math.floor(exact));

    // Below 1 device pixel per cell there is no integer scale to fall back on,
    // and a crisp render that overflows its box is worse than an even one that
    // fits. Downscaling also wants smoothing ON: nearest-neighbour below 1:1
    // drops whole cells outright, which is aliasing, not crispness.
    this.down = exact < 1;
    if (s < 1) s = exact;
    // Say so rather than degrading in silence. `crisp` is false exactly when a
    // cell is not a whole number of device pixels — i.e. when this asset is
    // being asked to render smaller than its own grid, or in fill mode. A
    // caller that cares (a chip that must stay sharp) can pick a coarser asset
    // instead of wondering why it looks soft.
    this.crisp = !this.down && Number.isInteger(s);
    if (this.onfit) this.onfit(this);

    const cw = Math.max(1, Math.round(w * s)), ch = Math.max(1, Math.round(h * s));
    if (this.canvas.width !== cw || this.canvas.height !== ch) {
      this.canvas.width = cw; this.canvas.height = ch;
    }
    this.canvas.style.width = `${cw / dpr}px`;
    this.canvas.style.height = `${ch / dpr}px`;
    this.canvas.style.margin = 'auto';
    this.scale = s;
    this.draw();
  }

  draw() {
    const { w, h } = this.a;
    this.ctx.imageSmoothingEnabled = this.down;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.drawImage(this.strip, 0, this.frame * h, w, h, 0, 0, this.canvas.width, this.canvas.height);
  }

  sync() {
    const wantPlay = this.visible && !REDUCED.matches && this.a.frames.length > 1 && !this.paused;
    if (wantPlay && !this.raf) { this.last = 0; this.raf = requestAnimationFrame(this.tick); }
    else if (!wantPlay && this.raf) { cancelAnimationFrame(this.raf); this.raf = 0; }
    if (REDUCED.matches && this.frame !== this.poster) { this.frame = this.poster; this.draw(); }
  }

  tick = (now) => {
    this.raf = requestAnimationFrame(this.tick);
    if (!this.last) { this.last = now; return; }
    const dt = Math.min(250, now - this.last);   // a backgrounded tab must not fast-forward
    this.last = now;
    // Fixed accumulator. Never `frame = floor(elapsed * fps)` and never a
    // per-frame interpolation: both hand one cel 5 display frames and the next
    // 6, and the limp is visible at any rate below ~20fps.
    this.acc += (dt / 1000) * this.a.fps * this.speed;
    if (this.acc < 1) return;
    const steps = Math.floor(this.acc);
    this.acc -= steps;
    this.frame = (this.frame + steps) % this.a.frames.length;
    this.draw();
  };

  pause() { this.paused = true; this.sync(); }
  play() { this.paused = false; this.sync(); }
  seek(i) { this.frame = ((i % this.a.frames.length) + this.a.frames.length) % this.a.frames.length; this.draw(); }

  destroy() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.ro.disconnect(); this.io.disconnect();
    window.removeEventListener('bw:palettechange', this.onPalette);
    REDUCED.removeEventListener('change', this.onMotion);
    this.canvas.remove();
  }
}

const BWPixel = {
  /** el, doc|url, opts → Clip (a promise when given a url). */
  mount(el, src, opts) {
    if (typeof src === 'string') {
      return fetch(src).then((r) => {
        if (!r.ok) throw new Error(`pxa: ${src} → ${r.status}`);
        return r.json();
      }).then((doc) => new Clip(el, doc, opts));
    }
    return new Clip(el, src, opts);
  },
  /** Mount everything carrying data-pxa. */
  auto(root = document) {
    return Promise.all([...root.querySelectorAll('[data-pxa]')].map((el) => BWPixel.mount(el, el.dataset.pxa, {
      fit: el.dataset.pxaFit || 'integer',
      poster: Number(el.dataset.pxaPoster || 0),
      speed: Number(el.dataset.pxaSpeed || 1),
      maxScale: Number(el.dataset.pxaMaxScale || Infinity),
      label: el.dataset.pxaLabel || ''
    }).catch((e) => { console.warn(e); return null; })));
  },
  decode,
  Clip
};

window.BWPixel = BWPixel;
export default BWPixel;
