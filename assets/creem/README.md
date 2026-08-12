# Creem storefront art

Art for the Creem store: eight product images, the store logo, and the store
banner. Sizes follow what Creem's dashboard asks for.

| Asset | Size | Where Creem uses it |
| --- | --- | --- |
| `plate-*.png` | 3840×2160 (16:9) | Product image on each product |
| `store-logo-52.png` | 52×52 | Checkout + storefront (商店徽标) |
| `store-logo-52-transparent.png` | 52×52 | Same, transparent ground |
| `store-logo-512.png` | 512×512 | Master for other surfaces |
| `store-banner-1920x400.png` | 3840×800 (1920×400 @2x) | Public storefront top (商店横幅) |

## Product plates

One visual identity across all eight SKUs: the same trademark, layout, and
type. Only the gauge fill and the interval copy change, so the set reads as a
family rather than eight different covers.

| File | Creem product | Grant | Gauge |
| --- | --- | --- | --- |
| `plate-I-7500.png` | 7,500 Unit Pack | 7,500 one-time | 1 of 5 |
| `plate-II-15000.png` | 15,000 Unit Pack | 15,000 one-time | 2 of 5 |
| `plate-III-30000.png` | 30,000 Unit Pack | 30,000 one-time | 3 of 5 |
| `plate-IV-75000.png` | 75,000 Unit Pack | 75,000 one-time | 4 of 5 |
| `plate-V-pro-monthly.png` | Pro Monthly | 28,500 / month | full |
| `plate-VI-pro-annual.png` | Pro Annual | 342,000 / year | full |
| `plate-VII-premium-monthly.png` | Premium Monthly | 43,500 / month | full (inverted) |
| `plate-VIII-premium-annual.png` | Premium Annual | 522,000 / year | full (inverted) |

Pro and Premium are separated by ground (cream vs. ink), monthly and annual by
the interval line. The mark itself is never altered to distinguish a SKU.

## The mark

`MARK_PATHS` in `build.js` is the BourneWise logomark, copied verbatim from
`index.html` (viewBox `0 0 512 416`, `stroke-width: 40`, round caps). It is
always the same five waves — never more, never fewer. Only stroke colour
changes, to signal a tier's fill level.

## Rebuild

```sh
node assets/creem/build.js
```

Requires a Chromium binary (auto-probed from the Playwright cache; override
with `CHROME=/path/to/chrome`). Fonts are read from `assets/fonts/` and inlined,
so renders are self-contained and deterministic.

## Source of truth

Unit counts and intervals here follow the Creem integration brief. They do not
currently match `pricing.html` — see the notes in that brief before publishing.
