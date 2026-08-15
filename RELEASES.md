# BourneWise release provenance

This file records the source lineage of production releases. Cloudflare builds
pull-request branches as previews and deploys `main` to the public site. The
`production` branch is an append-only verified mirror and rollback anchor:
release merges keep their parents, and it must never be squashed, rebased, or
force-pushed.

## 20260815e — Lianqian production baseline

- Production target: `main` via pull request
- Verified mirror: `production`
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

The integration branch is previewed before merge. Once its pull request lands
in `main`, Cloudflare promotes the same traceable commit graph to the public
site; `production` retains the verified release point for audit and rollback.
