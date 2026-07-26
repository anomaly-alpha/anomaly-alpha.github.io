---
feature: seo-content-rewrite
status: designed
updated: 2026-07-26
branch: main
commits:
---

# SEO Content Rewrite — Capitalize on Main Terms

## Report

## [S1] Problem

The site is growing rapidly (1,727 clicks in 84 days, +321% vs prior period) but leaving significant traffic on the table:

1. **Homepage title mismatch** — Title says "Gems Calculator" but 86% of traffic comes from code searches ("invincible codes", "gtg codes"). Users searching for codes see "calculator" and don't click.
2. **"new" CTR multiplier unused** — Queries with "new" get 15-30% CTR vs 5-8% without. Only the code page mentions "Active" — no page says "New" in title.
3. **Redeem queries zero-click** — "invincible redeemer" (98 imp), "invincible pvp" (50 imp), "invincible gem" (50 imp at pos 2.74!) all have 0 clicks. Titles/descriptions don't match these intents.
4. **H1s are non-descriptive labels** — "ACTIVE CODES", "EVENT REWARDS", "LOGIN REWARDS" don't contain target keywords. Google sometimes uses H1 in snippets.
5. **Meta descriptions repeat titles** — Most pages have identical title and description, wasting the opportunity to address different search intents.

## [S2] Design

Rewrite SEO elements across all 8 pages: `<title>`, `<meta name="description">`, OG/Twitter tags, `<h1>`, and key body headings. Target the top search terms identified in GSC data.

### Target terms by page

| Page | Primary terms (from GSC) | CTR opportunity |
|------|-------------------------|-----------------|
| `/` | "invincible codes", "invincible gtg codes", "gem calculator", "free gems" | Homepage title says "calculator" but codes dominate traffic |
| `/guide/code/` | "new invincible codes", "invincible guarding the globe codes", "promo codes" | Add "New" to title for CTR boost |
| `/guide/pvp/` | "invincible pvp", "pvp guide", "arena rewards" | "invincible pvp" has 50 imp, 0 clicks |
| `/guide/event/` | "event guide", "how to get gems", "invincible event" | Low impressions — needs better keyword targeting |
| `/guide/login/` | "login rewards", "invincible login" | "login rewards" has 2 imp, 1 click — underperforming |
| `/guide/beginners/` | "beginner guide", "how to get gems", "free gems" | "how to get gems" has 26 imp, 0 clicks |
| `/guide/faq/` | "invincible guarding the globe" FAQ queries | Good position but low CTR (1.37%) |
| `/guide/xp/` | "xp calculator", "rank up", "hero xp" | "invincible xp calculator" has 19 imp, 0 clicks |

### SEO copy changes per page

#### 1. Homepage (`/`)

| Element | Current | New |
|---------|---------|-----|
| `<title>` | "Invincible Guarding the Globe Gems Calculator — 4,043/Week" | "Invincible GTG Codes, Gems & PvP Guide — ~4,043/Week [Jul 2026]" |
| `<meta description>` | "Calculate your exact weekly gem income..." | "All active Invincible Guarding the Globe promo codes, gem calculator, PvP rewards, and event guides. ~4,043 gems/week. Updated daily." |
| `<h1>` | (need to verify) | "Invincible Guarding the Globe: Codes, Gems & PvP Guide" |
| OG/Twitter | Mirror title/description | Mirror new title/description |

**Rationale:** Leads with "Codes" (top search intent), includes "GTG" (abbreviation variant), keeps the gem number (differentiator), adds "[Jul 2026]" (freshness signal).

#### 2. Code Guide (`/guide/code/`)

| Element | Current | New |
|---------|---------|-----|
| `<title>` | "Invincible Guarding the Globe Promo Codes — 29 Active [Jul 2026]" | "New Invincible GTG Codes — All Active Promo Codes [Jul 2026]" |
| `<meta description>` | "See all 29 active promo codes — tap to copy..." | "All new Invincible Guarding the Globe promo codes — tap to copy and redeem at the Ubisoft portal. 29 active codes worth 300+ gems each. Updated Jul 2026." |
| `<h1>` | "ACTIVE CODES" | "New Invincible Guarding the Globe Codes" |
| OG/Twitter | Mirror | Mirror new |

**Rationale:** "New" at the start captures the CTR multiplier. "GTG" abbreviation adds keyword coverage. Description adds "redeem" (addresses CTR leak queries).

#### 3. PvP Guide (`/guide/pvp/`)

| Element | Current | New |
|---------|---------|-----|
| `<title>` | "Invincible Guarding the Globe — PvP Guide & Gems: ~1,850/Week" | "Invincible GTG PvP Guide — Arena Payouts & Gem Rewards [Jul 2026]" |
| `<meta description>` | "Invincible Guarding the Globe PvP — all 14 league payouts..." | "Invincible Guarding the Globe PvP guide — all 14 league payouts, Restricted Arena, Open Arena, and Alliance War rewards. Find your rank and earn ~1,850 gems/week." |
| `<h1>` | (need to verify) | "Invincible GTG PvP Guide — Arena Rewards & Payouts" |
| OG/Twitter | Mirror | Mirror new |

**Rationale:** "PvP Guide" is the primary search intent. "Arena Payouts" addresses the specific content. "GTG" adds abbreviation keyword.

#### 4. Event Guide (`/guide/event/`)

| Element | Current | New |
|---------|---------|-----|
| `<title>` | "Invincible Guarding the Globe — Event Rewards: 500 Gems/Week [Jul 2026]" | "Invincible GTG Event Guide — How to Get 500 Gems/Week [Jul 2026]" |
| `<meta description>` | "Plan your Invincible Guarding the Globe event rewards..." | "Invincible Guarding the Globe event guide — earn 500 gems/week from The Long Haul and Earth's Defenders events. Strategy tips and ranking thresholds." |
| `<h1>` | "EVENT REWARDS" | "Invincible GTG Event Guide — 500 Gems/Week" |
| OG/Twitter | Mirror | Mirror new |

**Rationale:** "Event Guide" matches search intent. "How to Get" in title addresses informational queries. Adds "strategy tips" to description for longer snippet.

#### 5. Login Guide (`/guide/login/`)

| Element | Current | New |
|---------|---------|-----|
| `<title>` | "Invincible Guarding the Globe — Login Gems: 1,393/Week" | "Invincible GTG Login Rewards — 1,393 Gems/Week Guide" |
| `<meta description>` | "Login rewards give you 1,393 free gems every week..." | "Invincible Guarding the Globe login rewards — earn 1,393 gems/week from daily logins (910), weekly streaks (460), and monthly bonuses. Your most reliable income." |
| `<h1>` | "LOGIN REWARDS" | "Invincible GTG Login Rewards Guide" |
| OG/Twitter | Mirror | Mirror new |

**Rationale:** "Login Rewards" is the primary search term. Adds "Guide" for informational intent.

#### 6. Beginners Guide (`/guide/beginners/`)

| Element | Current | New |
|---------|---------|-----|
| `<title>` | "Invincible Guarding the Globe — Free Gems: ~4,043/Week Guide" | "Invincible GTG Beginner Guide — How to Get Free Gems [Jul 2026]" |
| `<meta description>` | "How to get free gems in Invincible Guarding the Globe..." | "Invincible Guarding the Globe beginner guide — how to get free gems, earn ~4,043/week from codes, PvP, events, and login rewards. New player tips." |
| `<h1>` | "BEGINNER'S GUIDE" | "Invincible GTG Beginner Guide — Free Gems & Tips" |
| OG/Twitter | Mirror | Mirror new |

**Rationale:** "Beginner Guide" is the primary search term. "How to Get Free Gems" addresses the top informational query (26 imp, 0 clicks).

#### 7. FAQ (`/guide/faq/`)

| Element | Current | New |
|---------|---------|-----|
| `<title>` | "Invincible Guarding the Globe FAQ — How Many Gems Per Week?" | "Invincible GTG FAQ — Gems Per Week, Codes & Rewards Guide" |
| `<meta description>` | "How many gems per week in Invincible Guarding the Globe?..." | "Invincible Guarding the Globe FAQ — how many gems per week, active promo codes, PvP payouts, and reward sources. Complete guide with payout tables." |
| `<h1>` | "GEM REWARDS FAQ" | "Invincible GTG FAQ — Gems, Codes & Rewards" |
| OG/Twitter | Mirror | Mirror new |

**Rationale:** Broadens from just "gems per week" to include "codes" and "rewards" — matches more FAQ-style queries.

#### 8. XP Guide (`/guide/xp/`)

| Element | Current | New |
|---------|---------|-----|
| `<title>` | "Invincible Guarding the Globe XP Guide — Hero Rank-Up Costs Rare to Omnipotent+" | "Invincible GTG XP Guide — Hero Level-Up & Rank Costs" |
| `<meta description>` | "Calculate XP and level up heroes in Invincible Guarding the Globe..." | "Invincible Guarding the Globe XP guide — Hero XP, Agent XP, Hero Special XP sources and rank-up costs from Rare to Omnipotent+. Level up fast." |
| `<h1>` | "XP & PROGRESSION" | "Invincible GTG XP & Progression Guide" |
| OG/Twitter | Mirror | Mirror new |

**Rationale:** Shortens title (was too long). "Level-Up" is more searchable than just "XP". "Rank costs" addresses the calculator intent.

### apple-mobile-web-app-title

Update from "Gem Rewards Calculator" to "Invincible GTG" across all pages for brand consistency.

### og:site_name

Update from "Gem Rewards Calculator" to "Invincible GTG" across all pages. The old name is a leftover from before the organization rename to "Anomaly Alpha".

### Structured data

- **Homepage**: Update `name` field in WebPage schema (currently `"Invincible Guarding the Globe Gem Calculator — 4,043/Week"`)
- **Code guide**: Update `headline` field in Article schema (currently `"Invincible Guarding the Globe Promo Codes — 29 Active [Jul 2026]"`)
- **Other guides**: Update `headline` field in Article schema to match new titles

### Auto-generated content — code guide markers

The code guide (`guide/code/index.html`) has 9 auto-generated marker pairs managed by `scripts/generate-codes.js`. Three of these wrap SEO-critical content:

| Marker | Wraps | Current template |
|--------|-------|-----------------|
| `GUIDE_DESC` | `<meta name="description">` | "See all {count} active promo codes — tap to copy and redeem instantly at the Ubisoft portal. Worth 300 gems each. Updated for {month}." |
| `GUIDE_OG_DESC` | `<meta property="og:description">` | Same as above |
| `GUIDE_TWITTER_DESC` | `<meta name="twitter:description">` | Same as above |

**Problem:** "Worth 300 gems each" is inaccurate — codes have varying rewards (250, 300, 500, 800 gems, or hero shards). Template also lacks "new", "invincible", "GTG" keywords.

**Fix:** Update `generate-codes.js` template to:
```
"New Invincible Guarding the Globe promo codes — tap to copy and redeem at the Ubisoft portal. {count} active codes with gems, hero shards & tickets. Updated {month}."
```

The non-marker elements (title, H1, OG title, structured data headline) are static HTML and can be edited directly.

### Homepage subtitle inconsistency

Homepage subtitle says "28 Active Codes" but code page shows 29. The subtitle is auto-generated? No — it's static HTML. Update to match actual count, or better: make it dynamic by removing the specific number.

**Fix:** Change subtitle from "Calculate Your Full Gem Income — PvP, Events, Login & 28 Active Codes" to "All Active Codes, PvP Rewards, Events & Login Bonuses — Your Complete Gem Guide"

### Current H1 values (verified)

| Page | Current H1 |
|------|-----------|
| `/` | "INVINCIBLE GUARDING THE GLOBE" (with subtitle: "Calculate Your Full Gem Income — PvP, Events, Login & 28 Active Codes") |
| `/guide/code/` | "INVINCIBLE GUARDING THE GLOBE CODES" (with tab: "29 ACTIVE") |
| `/guide/pvp/` | "PVP REWARDS" (with subtitle: "~1,850 Gems/Week — All 14 Leagues, 120 Ranks") |
| `/guide/event/` | "EVENT REWARDS" |
| `/guide/login/` | "LOGIN REWARDS" |
| `/guide/beginners/` | "BEGINNER'S GUIDE" |
| `/guide/faq/` | "GEM REWARDS FAQ" |
| `/guide/xp/` | "XP & PROGRESSION" |

### dateModified inconsistency

Code guide structured data `dateModified` says `"2026-07-04"` while visible "Last updated" text says `"Jul 26, 2026"`. The `GUIDE_ARTICLE_MODIFIED` marker wraps the structured data date — update the `generate-codes.js` template to use current date.

### Implementation order

1. **`scripts/generate-codes.js`** — Update description templates (GUIDE_DESC, GUIDE_OG_DESC, GUIDE_TWITTER_DESC) with new SEO copy
2. Homepage (most complex, JSON-LD configs + inline content)
3. Code guide (run `npm run update-codes` after script change, then edit static elements)
4. PvP guide
5. Event guide
6. Login guide
7. Beginners guide
8. FAQ
9. XP guide

Each page: update `<title>`, `<meta description>`, OG/Twitter tags, `<h1>`, structured data, `apple-mobile-web-app-title`, `og:site_name`.

## [S3] Out of Scope

- No changes to body content beyond H1 headings
- No changes to page layout, CSS, or JavaScript
- No changes to data files (`codes.json`, `arena_payouts.txt`, etc.)
- No changes to 404.html, terms/, privacy/
- No changes to sitemap.xml or robots.txt
- No new pages or removed pages
- No URL changes (canonical tags stay the same)

## Tasks

- [ ] T1: Update `scripts/generate-codes.js` — new description templates for GUIDE_DESC, GUIDE_OG_DESC, GUIDE_TWITTER_DESC markers (covers: S2)
- [ ] T2: Rewrite homepage SEO copy — title, meta desc, OG/Twitter, H1, subtitle, structured data `name`, apple-mobile-web-app-title, og:site_name (covers: S2)
- [ ] T3: Rewrite code guide SEO copy — run `npm run update-codes` after T1, then edit static elements: title, H1, OG title, structured data headline, apple-mobile-web-app-title, og:site_name (covers: S2; depends: T1)
- [ ] T4: Rewrite PvP guide SEO copy — title, meta desc, OG/Twitter, H1, structured data, apple-mobile-web-app-title, og:site_name (covers: S2)
- [ ] T5: Rewrite event guide SEO copy (covers: S2)
- [ ] T6: Rewrite login guide SEO copy (covers: S2)
- [ ] T7: Rewrite beginners guide SEO copy (covers: S2)
- [ ] T8: Rewrite FAQ SEO copy (covers: S2)
- [ ] T9: Rewrite XP guide SEO copy (covers: S2)
- [ ] T10: Build and verify — npm run build passes, all pages have updated titles (covers: S2; depends: T1-T9)
