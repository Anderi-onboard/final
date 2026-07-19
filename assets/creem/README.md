# Creem product images (16:9)

The six BourneWise "plate" images used in the Creem product listing. Creem
recommends a **16:9** aspect ratio, so these are rendered at **3840×2160**
(1920×1080 @2x) with an editorial split — the wave-glyph mark on the left, the
title block on the right — instead of the original 1:1 square composition.

| File | Product | Grant |
| --- | --- | --- |
| `plate-II-15000.png` | One-time top-up | 15,000 units |
| `plate-III-30000.png` | One-time top-up | 30,000 units |
| `plate-IV-75000.png` | One-time top-up | 75,000 units |
| `plate-V-pro.png` | Pro plan | 22,500 units / month |
| `plate-VI-premium.png` | Premium plan | 45,000 units / month |

The glyph is a stack of wavy bars read as a fill gauge: more filled (ink) bars =
a larger grant; unfilled bars are the muted grey. Premium inverts to cream-on-black.

## Rebuild

```sh
node assets/creem/build.js
```

Requires a Chromium binary (auto-probed from the Playwright cache; override with
`CHROME=/path/to/chrome`). Fonts (BioRhyme, Spinnaker) are read from
`assets/fonts/` and inlined, so the render is self-contained and deterministic.
