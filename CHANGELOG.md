# Changelog

## Jul 2026

- **Site-wide SEO growth**: Interactive gem income forecaster (Chart.js line chart, 3 scenarios, milestones, shareable URL). New XP & progression guide (`/guide/xp/`) with Hero Rank-Up table. PvP league comparator (side-by-side payout comparison). Code age timeline (green/yellow/orange/red bands by release date). "What's New" changelog + localStorage freshness beacon. Meta refresh for event [Jul 2026] and PvP "Guide & Gems" title. Redeem portal rewrite targeting 840 impressions. 5 contextual internal links. FAQ rephrase for GSC query matching.
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

- Initial site launch with hub + 6 guide pages, Tailwind CSS, Chart.js 4.4.1, Rajdhani/Orbitron fonts, BEM design system, inline JSON configs.
