# Changelog

## Nov 2026

- **Wish Event guide**: New `/guide/wish-event/` page covering event mechanics, wish targets, and reward expectations; added to the guide cluster nav and sitemap.
- **Watch-page hardening**: Every generated watch page now carries a timezone-qualified `uploadDate` (harvested `youtube.publishedAt`, else `YYYY-MM-DDT00:00:00+00:00`), and watch pages are enriched with real video metadata plus verified game context from `data/game-context.json`.
- **About page**: New `/about/` page (indexable, in sitemap) documenting the project and where the reward numbers come from.
- **Codes**: STACHE leads the list as the newest code, taking active codes from 35 to 36 (55 tracked, 19 expired), and the redeem portal address now appears in the `/guide/code/` SERP snippet.
- **Creator refresh**: Seven additional creators found in the community channel's full history; upload discovery reworked to read the channel page after the feed endpoint disappeared.
- **Promo-code expansion**: Active codes grew from 30 to 35 (54 tracked, 19 expired). `data/codes.json` now models item rewards alongside gems/tickets, and `scripts/generate-codes.js` emits a per-code reward table with HIGH/MEDIUM tiers. Ticker, home page, and `guide/code/` all regenerated.
- **Codes accuracy audit**: `docs/reports/2026-10-31/deepseek-v4.1-flash/codes-audit.md` checked `data/codes.json` against external lists — findings 1, 3 and 4 applied, finding 2 left open pending in-game verification.
- **Search Console API puller**: New `scripts/pull-gsc.js` (`npm run pull-gsc`) pulls Search Analytics, sitemaps, and URL inspection into `data/gsc-api/<date>/`; the resulting 181-day report lives at `docs/reports/2026-10-31/deepseek-v4.1-flash/search-console-report.md` (6,774 clicks in the latest 28 days, +54.2%).
- **Redeem intent targeting**: `/guide/redeem/` rewritten against redeem-query impressions, author profile linked, and app store ratings sourced.
- **Code pinning**: Newest codes pinned to the top of listings; KREGG4 retagged as reactivated.
- **Creator refresh**: Verified YouTube uploads re-audited and the creator directory regenerated.
- **Deferred localization**: A five-language localization plan was written and deliberately parked in favour of the codes cluster (`docs/plans/2026-10-31/deepseek-v4.1-flash/`).

## Oct 2026

- **Per-video watch pages**: `scripts/generate-watch-pages.js` now generates one `/watch/<videoId>/` page per indexed creator video (plus a `/watch/` hub), each declaring exactly one `VideoObject` with a timezone-correct upload date, and rewrites the watch region of `sitemap.xml`. The creator directory became a `CollectionPage` linking to those pages instead of emitting `VideoObject` itself. Sitemap grew from 14 to 210 URLs.
- **Watch metadata enrichment**: `scripts/enrich-youtube-creators.js` (`npm run enrich-creators`) harvests real per-video duration, view count, true upload timestamp, creator description, playability, and embeddability; unplayable videos are marked `status: "unavailable"` so no dead watch page is ever published.
- **October SEO refresh**: GSC-evidence-driven landing page optimization, October-titled SEO metadata across game-content pages, and refreshed code data date. New search-performance exports and a content optimization report recorded under `data/` and `docs/reports/2026-10-12/gpt-5/`.
- **Promo-code count**: UPDAT3 (500 gems) brings active codes to 30; `data/codes.json` refreshed (date 2026-10-12) and reward table updated.
- **Creator directory refresh**: Verified video listings refreshed and upload feeds audited, with audit evidence recorded (`docs/reports/2026-10-12/gpt-5/creator-directory-audit.md`).
- **SEO performance report**: Regenerated from the 2026-10-12 export — 13,897 clicks / 103,854 impressions over 92 days (151.1 clicks/day, 13.38% CTR, avg position 5.2). `scripts/analyze-gsc.js` now writes to the canonical report path.

## Sep 2026

- **Promo-code refresh**: New active code RAID02 (Bulletproof + Powerplex). GLOB34 corrected and retained as expired (2026-08-28, 500-gem reward). Expanded from 28 to 29 active codes; expired older codes. All promo data regenerated from `data/codes.json`.
- **Creator and video refresh**: Active and pending creator/video records rechecked, verification timestamps refreshed, existing eligibility thresholds/cap preserved. Creator directory regenerated from `data/youtube-creators.json`.
- **Guide and policy rewrite**: Content refresh on all 9 guide pages (code, beginners, event, pvp, login, faq, xp, redeem, creators) plus privacy and terms policies. Reviewed editorial copy and updated structured data across the guide cluster.
- **Indexability expansion**: Author profile, music, privacy, and terms pages now indexable. Sitemap expanded from 11 to 14 canonical URLs. `robots.txt` unchanged (Allow: /, sitemap reference retained).
- **SEO title refresh**: September-titled SEO metadata for all game-content pages with `[Sep 2026]` suffix. Unique query-first titles targeting 50–60 characters. Synchronized og:title, twitter:title, and JSON-LD headline across all pages.
- **Structured-data repair**: Added datePublished and dateModified to all Article and CollectionPage schemas. Author ProfilePage gains stable Person entity reference. FAQ schema parity verified against visible content. Sitemap and noindex directives validated for all 14 indexable pages.

## Aug 2026

- **Documentation synchronization**: Corrected stale counts (28 active codes, 9 OG images, 9 inline JSON configs, 11 sitemap URLs, 9 guide pages). Expanded file tree to include music, seo, privacy, terms, authors pages, scripts, and tests. Fixed `docs/plan/` → `docs/plans/` paths. Documented ads-disabled/site-message fallback and GA4 analytics. Added ADR-002 reference. Replaced false "no tracking/no data collection" claims in advertising copy with accurate ads-disabled/anonymous-analytics language. Added external-reference-audit report link.

## Jul 2026

- **Site-wide SEO growth**: Interactive gem income forecaster (Chart.js line chart, 3 scenarios, milestones, shareable URL). New XP & progression guide (`/guide/xp/`) with Hero Rank-Up table. PvP league comparator (side-by-side payout comparison). Code age timeline (green/yellow/orange/red bands by release date). "What's New" changelog + localStorage freshness beacon. Meta refresh for event [Jul 2026] and PvP "Guide & Gems" title. Redeem portal rewrite targeting 840 impressions. 5 contextual internal links. FAQ rephrase for GSC query matching.

  > _Correction (2026-10-31): the forecaster was never shipped to users. Its JS (`initForecaster`, `initForecastChart`) is present in `script.js` but guarded on `#gem-forecast-panel`, which was never added to `index.html` — the feature is unreachable dead code. See `CONTEXT.md` and `AGENTS.md`._
- **GSC 0704 audit**: 410 clicks (+242%), 11,402 impressions (+174%), 28 active codes. Per-day normalized: 6.6 clicks/day (+109%).

## Jun 2026

- **Schema expansion**: Article meta, HowTo, WebApplication, VideoGame, Organization logo — all 7 pages.
- **Promo code rework**: Sorted newest-first, added SUMMER, expired FRIEND/DSCORD/CONMAN (25 active).
- **SEO title overhaul**: "Gems" added to all page titles. Code page → "Promo Codes". Homepage → "Gem Calculator — 4,043/Week".
- **Countries list**: GSC 0610 export (107 countries, +16 new).

## May 2026

- **Promo code single source of truth** (ADR-001): `data/codes.json` drives all code data via `scripts/generate-codes.js`.
- **Copywriting overhaul** + ticker redesign. Code guide click-to-copy fix.
- **GSC SEO audit**: Performance report + export analyzer plan (162).
- **Mobile fixes**: Container width fix, padding on tabbed cards, ticker overflow.
- **Docs consolidation**: CONTEXT.md, README.md, AGENTS.md streamlined.
- **100/100 Lighthouse**: Eliminated CLS across all pages (font-display:optional, async Tailwind, position:fixed orbs, counter min-width).
- **Mobile tab overlap fix**: `pr-20 pt-16` on all tabbed cards for narrow screens.
- **Badge redesign**: Guide page badges → right-side tapered tabs, event guide top% indicators.
- **Promo code expiry UI**: Red section for expired codes, SEO meta refresh.
- **Per-code rewards**: Animated per-code gem/ticket total (like PvP cards), verification code redemption flow.
- **26 active codes**: Imported from invincible.rifts.cc, per-code reward structure.

## Apr 2026

- **Performance**: Chart.js lazy-loaded, critical CSS inlined, assets minified. Lighthouse 88→96.
- **Mode selector**: CODE mode inactive by default with CTA. Defaults config-driven.
- **Select redesign**: Category-aware dropdowns with custom chevrons.
- **Multiverse → Alliance War**: Renamed across UI, data, and docs.
- **Docs restructure**: Plans and journals into daily folders (YYYY-MM-DD/).
- **Counter animation fix**: Locked width prevents CLS during rAF updates.

## Earlier

- Initial site launch with hub + 6 guide pages (code, event, pvp, login, faq, beginners), Tailwind CSS, Chart.js 4.4.1, Rajdhani/Orbitron fonts, BEM design system, inline JSON configs.
