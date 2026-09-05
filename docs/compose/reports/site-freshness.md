---
feature: september-2026-site-freshness
status: delivered
specs:
  - docs/compose/specs/2026-09-04-site-freshness.md
plans:
  - docs/compose/plans/2026-09-04-site-freshness.md
branch: main
commits: 8de0006..a311a93
---

# September 2026 Site Freshness Update - Final Report

## What Was Built

The public Invincible GTG site now reflects the 2026-09-04 freshness snapshot across source data, generated outputs, guide and policy copy, SEO metadata, indexation signals, and structured data. The code catalog contains 29 active and 19 expired records, including the active RAID02 reward and corrected expired GLOB34 record. Creator data remains source-driven and preserves the existing eligibility thresholds and rendered cap.

All 14 public routes are indexable and represented in the sitemap: the home page, nine guides, the Anomaly author profile, music, privacy, and terms. The internal SEO dashboard remains noindex/nofollow. Titles, canonical URLs, robots directives, freshness dates, visible content, and JSON-LD were synchronized, including stable game, organization, and author Person entities. Music has separate playlist-content and page-review dates, while original publication dates remain intact.

## Architecture

Source JSON remains authoritative. data/codes.json, data/youtube-creators.json, and data/playlists.json feed their existing generators, which produce the committed code bundle, creator directory, music page, and inline page payloads. Static guide, author, policy, sitemap, and metadata changes remain outside those generated boundaries.

The structured-data regression suite covers all 14 public pages. It validates per-block JSON-LD context and syntax, canonical and sitemap membership, stable entity references, Article requirements, FAQ visible-content parity, indexability boundaries, and generator idempotency.

### Design Decisions

- Stable absolute IDs are used for the game, organization, and Anomaly Person so cross-page references resolve consistently.
- Music keeps its playlist updated value tied to playlist changes and uses a separate reviewed date for page freshness.
- The SEO dashboard remains excluded from the sitemap and retains noindex, nofollow.
- Generator line-ending preservation keeps repeated Windows builds byte-stable.

## Usage

Run npm install once, then use npm run build to regenerate codes, music, creators, Tailwind/CSS, and minified JavaScript. Run npm start to serve the site locally on port 8080. Focused checks are available through npm run test:structured-data, npm run test:creators, npm run test:ads-txt, and npm run test:ads-fallback.

The maintained evidence ledger is docs/reports/2026-09-04/unknown/site-freshness-evidence.md. It contains the research audit trail, title matrix, stale-reference checks, browser inspection, and integration evidence.

## Verification

- npm run build completed with all generators, Tailwind/CSS generation, CSS minification, and JS minification successful.
- npm run test:structured-data passed for 14 pages; npm run test:creators passed 69/69; ads.txt and ad-fallback checks passed; git diff --check returned exit 0.
- A local browser inspection loaded all 14 routes to readyState=complete, with nonempty H1/content, production canonical URLs, and the expected robots directives. The music route reported zero console errors, with existing media warnings.
- Fresh local Lighthouse reports were generated for the eight configured guide routes. All eight scored 100 SEO, 100 accessibility, and 100 best practices in this run; performance varied by route and retained the documented warning-level CLS/TBT issues on the heavier pages.
- npm run lighthouse:all, npm run lighthouse:report, and npm run lighthouse:budget returned exit 0. The batch script suppresses per-page Lighthouse stderr and did not refresh its legacy report filenames in this environment; the explicit local audits are the current Lighthouse evidence. The LHCI wrapper is non-enforcing because @lhci/cli is not installed locally.

## Journey Log

- [lesson] FAQ schema parity required normalization of inline-anchor punctuation and whitespace before the regression gate could distinguish formatting artifacts from real content drift.
- [lesson] Generator idempotency on the Windows checkout required restoring the input file original CRLF/LF style after marker replacement.
- [pivot] Browser inspection moved from the deployed URL and blocked file access to the local repository server so it evaluated the current workspace.
- [lesson] Lighthouse warning thresholds for heavy table/chart pages are pre-existing and were recorded separately from the freshness release.

## Source Materials

| File | Role | Notes |
|------|------|-------|
| docs/compose/specs/2026-09-04-site-freshness.md | Approved specification | Scope, data rules, schema contract, and release criteria |
| docs/compose/plans/2026-09-04-site-freshness.md | Implementation plan | Ordered tasks and integration gate |
| docs/reports/2026-09-04/unknown/site-freshness-evidence.md | Evidence ledger | Research, title matrix, audits, and final integration evidence |
| tests/structured-data.test.js | Regression gate | Strict 14-page schema, indexability, parity, and idempotency checks |
| scripts/generate-codes.js, scripts/generate-youtube-creators.js, scripts/generate-music.js | Generators | Durable source-to-output build boundaries |
