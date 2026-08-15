# BourneWise release provenance

This file records the source lineage of production releases. The `production`
branch is append-only: release merges keep their parents, and it must never be
squashed, rebased, or force-pushed.

## 20260815e — Lianqian production baseline

- Release branch: `production`
- Integration branch: `codex-creem-integration`
- Visual lineage:
  - `aa49ba2` — replace Baoxianghua with the section-aware Lianqian texture system
  - `d1eac52` — remove Baoxianghua runtime hooks and public composition entry point
- Claude functional lineage:
  - `f246ce8` — preserve partial readings after a cut stream
  - `3401472` — send intent and follow-up prompts as user turns
  - `f761def` — route follow-ups by method
  - `2bc99e8` — derive rate-card figures from the assembled prompt
- Verification:
  - primary pages load Lianqian assets and expose zero Baoxianghua runtime rules
  - JavaScript syntax checks pass
  - billing, copy, request, stream recovery, prompt secrecy, prompt coverage,
    session, and rate-card contracts pass

Cloudflare Pages must use `production` as its Production branch. Other branches
may receive preview deployments, but they are never the public release source.
