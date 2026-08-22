# SEO Content Rewrite — Implementation Plan

**Spec:** `docs/specs/2026-07-26/unknown/seo-content-rewrite.md`
**Date:** 2026-07-26
**Branch:** `fix/seo-content-rewrite` (to be created)

---

## Overview

Rewrite SEO elements across all 8 pages to match search intent identified in GSC data. The site is growing rapidly (+321% clicks) but leaving traffic on the table due to title/description mismatches.

---

## Pre-flight

1. Create worktree: `git worktree add .worktrees/seo-rewrite -b fix/seo-rewrite`
2. Install deps: `npm install`
3. Verify clean state: `git status`

---

## T1: Update `scripts/generate-codes.js`

**File:** `scripts/generate-codes.js`

**What to change:** Update 4 description templates (lines 59-79).

### Current templates (to replace):

```js
// GUIDE_DESC (line 60-61)
`<!--GUIDE_DESC_START-->\n    <meta name="description" content="See all ${activeCount} active promo codes — tap to copy and redeem instantly at the Ubisoft portal. Worth 300 gems each. Updated for ${monthYear}.">\n<!--GUIDE_DESC_END-->`

// GUIDE_OG_DESC (line 64-65)
`<!--GUIDE_OG_DESC_START-->\n    <meta property="og:description" content="See all ${activeCount} active promo codes — tap to copy and redeem instantly at the Ubisoft portal. Worth 300 gems each. Updated for ${monthYear}.">\n<!--GUIDE_OG_DESC_END-->`

// GUIDE_TWITTER_DESC (line 72-73)
`<!--GUIDE_TWITTER_DESC_START-->\n    <meta name="twitter:description" content="See all ${activeCount} active promo codes — tap to copy and redeem instantly at the Ubisoft portal. Worth 300 gems each. Updated for ${monthYear}.">\n<!--GUIDE_TWITTER_DESC_END-->`

// GUIDE_LD_DESC (line 78-79)
`          "description": "Find active Invincible Guarding the Globe promo codes, codes, and reward codes. ${activeCount} active promo codes with gems, hero shards & tickets.",`
```

### New templates:

```js
// GUIDE_DESC
`<!--GUIDE_DESC_START-->\n    <meta name="description" content="New Invincible Guarding the Globe promo codes — tap to copy and redeem at the Ubisoft portal. ${activeCount} active codes with gems, hero shards & tickets. Updated ${monthYear}.">\n<!--GUIDE_DESC_END-->`

// GUIDE_OG_DESC
`<!--GUIDE_OG_DESC_START-->\n    <meta property="og:description" content="New Invincible Guarding the Globe promo codes — tap to copy and redeem at the Ubisoft portal. ${activeCount} active codes with gems, hero shards & tickets. Updated ${monthYear}.">\n<!--GUIDE_OG_DESC_END-->`

// GUIDE_TWITTER_DESC
`<!--GUIDE_TWITTER_DESC_START-->\n    <meta name="twitter:description" content="New Invincible Guarding the Globe promo codes — tap to copy and redeem at the Ubisoft portal. ${activeCount} active codes with gems, hero shards & tickets. Updated ${monthYear}.">\n<!--GUIDE_TWITTER_DESC_END-->`

// GUIDE_LD_DESC
`          "description": "New Invincible Guarding the Globe promo codes — ${activeCount} active codes with gems, hero shards & tickets. Tap to copy and redeem at the Ubisoft portal.",`

// Title regex (line 98) — update to match new "GTG" format
// OLD: [/(Invincible Guarding the Globe).*?— \d+[A-Za-z ]+\[[A-Z][a-z]{2} \d{4}\]/g, `$1 Promo Codes — ${activeCount} Active [${monthYear}]`]
// NEW: [/(Invincible Guarding the Globe|Invincible GTG).*?— .*?\[[A-Z][a-z]{2} \d{4}\]/g, `New Invincible GTG Codes — All Active [${monthYear}]`]

// JSON-LD headline regex (line 101) — update similarly
// OLD: [/("headline": "Invincible Guarding the Globe).*?— \d+[A-Za-z ]+\[[A-Z][a-z]{2} \d{4}("\s*,\n)/g, `$1 Promo Codes — ${activeCount} Active [${monthYear}$2`]
// NEW: [/("headline": ".*?Invincible).*?— .*?\[[A-Z][a-z]{2} \d{4}("\s*,\n)/g, `"headline": "New Invincible GTG Codes — All Active [${monthYear}]"$2`]
```

**Verification:** Run `npm run update-codes` and check `guide/code/index.html` has new descriptions.

---

## T2: Homepage (`index.html`)

**File:** `index.html`

### Changes (line references from current file):

| Line | Element | Current | New |
|------|---------|---------|-----|
| 8 | `apple-mobile-web-app-title` | "Gem Rewards Calculator" | "Invincible GTG" |
| 11 | `<meta name="description">` | "Calculate your exact weekly gem income in Invincible Guarding the Globe — 4,043/week from promo codes, PvP rewards, login bonuses, and weekly events. Free gem calculator." | "All active Invincible Guarding the Globe promo codes, gem calculator, PvP rewards, and event guides. ~4,043 gems/week. Updated daily." |
| 16 | `<meta property="og:title">` | "Invincible Guarding the Globe Gems Calculator — 4,043/Week" | "Invincible GTG Codes, Gems & PvP Guide — ~4,043/Week [Jul 2026]" |
| 17 | `<meta property="og:description">` | (same as meta desc) | (same as new meta desc) |
| 20 | `<meta property="og:site_name">` | "Gem Rewards Calculator" | "Invincible GTG" |
| 26 | `<meta property="og:image:alt">` | "Gem Rewards & PvP Guide — ~4,043 GEMS/WEEK" | "Invincible GTG — Codes, Gems & PvP Guide" |
| 31 | `<meta name="twitter:title">` | "Invincible Guarding the Globe Gems Calculator — 4,043/Week" | "Invincible GTG Codes, Gems & PvP Guide — ~4,043/Week [Jul 2026]" |
| 32 | `<meta name="twitter:description">` | (same as meta desc) | (same as new meta desc) |
| 33 | `<title>` | "Invincible Guarding the Globe Gems Calculator — 4,043/Week" | "Invincible GTG Codes, Gems & PvP Guide — ~4,043/Week [Jul 2026]" |
| ~849 | JSON-LD `name` | "Invincible Guarding the Globe Gem Calculator — 4,043/Week" | "Invincible GTG Codes, Gems & PvP Guide — ~4,043/Week [Jul 2026]" |
| 1100-1102 | `<h1>` | "INVINCIBLE GUARDING THE GLOBE" | "INVINCIBLE GUARDING THE GLOBE — CODES, GEMS & PVP GUIDE" |
| 1104 | subtitle `<p>` | "Calculate Your Full Gem Income — PvP, Events, Login & 28 Active Codes" | "All Active Codes, PvP Rewards, Events & Login Bonuses — Your Complete Gem Guide" |

**Note:** The H1 stays as the brand name. The subtitle becomes the descriptive text that contains keywords.

---

## T3: Code Guide (`guide/code/index.html`)

**File:** `guide/code/index.html`

### Auto-generated (via T1 + `npm run update-codes`):

After running `npm run update-codes`, these markers will be updated automatically:
- `GUIDE_DESC` — new description template
- `GUIDE_OG_DESC` — new description template
- `GUIDE_TWITTER_DESC` — new description template
- `GUIDE_ARTICLE_MODIFIED` — date will be updated

### Static edits (after `npm run update-codes`):

| Line | Element | Current | New |
|------|---------|---------|-----|
| 8 | `apple-mobile-web-app-title` | "Gem Rewards Calculator" | "Invincible GTG" |
| 21 | `<meta property="og:title">` | "Invincible Guarding the Globe Promo Codes — 29 Active [Jul 2026]" | "New Invincible GTG Codes — All Active Promo Codes [Jul 2026]" |
| 25 | `<meta property="og:site_name">` | "Gem Rewards Calculator" | "Invincible GTG" |
| 48 | `<meta property="og:image:alt">` | "Codes Guide — 29 ACTIVE PROMO CODES" | "New Invincible GTG Codes — Active Promo Codes" |
| ~55 | `<meta name="twitter:title">` | (check current) | "New Invincible GTG Codes — All Active Promo Codes [Jul 2026]" |
| ~60 | `<title>` | (auto-generated by script) | "New Invincible GTG Codes — All Active [Jul 2026]" (script regex must be updated) |
| ~104 | JSON-LD `headline` | "Invincible Guarding the Globe Promo Codes — 29 Active [Jul 2026]" | "New Invincible GTG Codes — All Active Promo Codes [Jul 2026]" |
| 267-269 | `<h1>` | "INVINCIBLE GUARDING THE GLOBE CODES" | "INVINCIBLE GUARDING THE GLOBE CODES" (keep — title already has "New" for CTR) |

**Note:** The `<title>` may be auto-generated by the script. Check after `npm run update-codes`. If it is, update the script template too.

---

## T4: PvP Guide (`guide/pvp/index.html`)

**File:** `guide/pvp/index.html`

| Line | Element | Current | New |
|------|---------|---------|-----|
| 8 | `apple-mobile-web-app-title` | "Gem Rewards Calculator" | "Invincible GTG" |
| 11 | `<meta name="description">` | "Invincible Guarding the Globe PvP — all 14 league payouts, Restricted Arena, Open Arena, and Alliance War gem earnings. Find your rank and see weekly income." | "Invincible Guarding the Globe PvP guide — all 14 league payouts, Restricted Arena, Open Arena, and Alliance War rewards. Find your rank and earn ~1,850 gems/week." |
| 19 | `<meta property="og:title">` | "Invincible Guarding the Globe — PvP Guide & Gems: ~1,850/Week" | "Invincible GTG PvP Guide — Arena Payouts & Gem Rewards [Jul 2026]" |
| 20 | `<meta property="og:description">` | (same as meta desc) | (same as new meta desc) |
| 21 | `<meta property="og:site_name">` | "Gem Rewards Calculator" | "Invincible GTG" |
| 42 | `<meta property="og:image:alt">` | "PvP Rewards Guide — Ranked Payouts" | "Invincible GTG PvP Guide — Arena Payouts" |
| 47 | `<meta name="twitter:title">` | "Invincible Guarding the Globe — PvP Guide & Gems: ~1,850/Week" | "Invincible GTG PvP Guide — Arena Payouts & Gem Rewards [Jul 2026]" |
| 48 | `<meta name="twitter:description">` | (same as meta desc) | (same as new meta desc) |
| 49 | `<title>` | "Invincible Guarding the Globe — PvP Guide & Gems: ~1,850/Week" | "Invincible GTG PvP Guide — Arena Payouts & Gem Rewards [Jul 2026]" |
| ~108 | JSON-LD `headline` | (check) | "Invincible GTG PvP Guide — Arena Payouts & Gem Rewards [Jul 2026]" |
| 274 | `<h1>` | "PVP REWARDS" | "INVINCIBLE GTG PVP GUIDE" |

---

## T5: Event Guide (`guide/event/index.html`)

**File:** `guide/event/index.html`

| Element | Current | New |
|---------|---------|-----|
| `apple-mobile-web-app-title` | "Gem Rewards Calculator" | "Invincible GTG" |
| `<meta name="description">` | "Plan your Invincible Guarding the Globe event rewards — 500 gems/week from The Long Haul (300) and Earth's Defenders (200). Updated for Jul 2026 events." | "Invincible Guarding the Globe event guide — earn 500 gems/week from The Long Haul and Earth's Defenders events. Strategy tips and ranking thresholds." |
| `<title>` | "Invincible Guarding the Globe — Event Rewards: 500 Gems/Week [Jul 2026]" | "Invincible GTG Event Guide — How to Get 500 Gems/Week [Jul 2026]" |
| OG/Twitter | Mirror title/description | Mirror new |
| `og:site_name` | "Gem Rewards Calculator" | "Invincible GTG" |
| `<h1>` | "EVENT REWARDS" | "INVINCIBLE GTG EVENT GUIDE" |
| JSON-LD `headline` | (check) | "Invincible GTG Event Guide — 500 Gems/Week [Jul 2026]" |

---

## T6: Login Guide (`guide/login/index.html`)

**File:** `guide/login/index.html`

| Element | Current | New |
|---------|---------|-----|
| `apple-mobile-web-app-title` | "Gem Rewards Calculator" | "Invincible GTG" |
| `<meta name="description">` | "Login rewards give you 1,393 free gems every week in Invincible Guarding the Globe — daily logins (910), weekly streaks (460), and monthly bonuses. Your most reliable gem income source." | "Invincible Guarding the Globe login rewards — earn 1,393 gems/week from daily logins (910), weekly streaks (460), and monthly bonuses. Your most reliable income." |
| `<title>` | "Invincible Guarding the Globe — Login Gems: 1,393/Week" | "Invincible GTG Login Rewards — 1,393 Gems/Week Guide" |
| OG/Twitter | Mirror title/description | Mirror new |
| `og:site_name` | "Gem Rewards Calculator" | "Invincible GTG" |
| `<h1>` | "LOGIN REWARDS" | "INVINCIBLE GTG LOGIN REWARDS" |
| JSON-LD `headline` | (check) | "Invincible GTG Login Rewards — 1,393 Gems/Week" |

---

## T7: Beginners Guide (`guide/beginners/index.html`)

**File:** `guide/beginners/index.html`

| Element | Current | New |
|---------|---------|-----|
| `apple-mobile-web-app-title` | "Gem Rewards Calculator" | "Invincible GTG" |
| `<meta name="description">` | "How to get free gems in Invincible Guarding the Globe — login rewards, events, PvP payouts, and 28 promo codes. Earn ~4,043 gems/week as a new player." | "Invincible Guarding the Globe beginner guide — how to get free gems, earn ~4,043/week from codes, PvP, events, and login rewards. New player tips." |
| `<title>` | "Invincible Guarding the Globe — Free Gems: ~4,043/Week Guide" | "Invincible GTG Beginner Guide — How to Get Free Gems [Jul 2026]" |
| OG/Twitter | Mirror title/description | Mirror new |
| `og:site_name` | "Gem Rewards Calculator" | "Invincible GTG" |
| `<h1>` | "BEGINNER'S GUIDE" | "INVINCIBLE GTG BEGINNER GUIDE" |
| JSON-LD `headline` | (check) | "Invincible GTG Beginner Guide — Free Gems & Tips" |

---

## T8: FAQ (`guide/faq/index.html`)

**File:** `guide/faq/index.html`

| Element | Current | New |
|---------|---------|-----|
| `apple-mobile-web-app-title` | "Gem Rewards Calculator" | "Invincible GTG" |
| `<meta name="description">` | "How many gems per week in Invincible Guarding the Globe? ~4,043 from PvP, events, login streaks, and 28 active promo codes. Complete FAQ with payout tables and redemption guide." | "Invincible Guarding the Globe FAQ — how many gems per week, active promo codes, PvP payouts, and reward sources. Complete guide with payout tables." |
| `<title>` | "Invincible Guarding the Globe FAQ — How Many Gems Per Week?" | "Invincible GTG FAQ — Gems Per Week, Codes & Rewards Guide" |
| OG/Twitter | Mirror title/description | Mirror new |
| `og:site_name` | "Gem Rewards Calculator" | "Invincible GTG" |
| `<h1>` | "GEM REWARDS FAQ" | "INVINCIBLE GTG FAQ" |
| JSON-LD `headline` | (check) | "Invincible GTG FAQ — Gems, Codes & Rewards" |

---

## T9: XP Guide (`guide/xp/index.html`)

**File:** `guide/xp/index.html`

| Element | Current | New |
|---------|---------|-----|
| `apple-mobile-web-app-title` | "Gem Rewards Calculator" | "Invincible GTG" |
| `<meta name="description">` | "Calculate XP and level up heroes in Invincible Guarding the Globe — Hero XP, Agent XP, Hero Special XP sources and rank-up costs from Rare to Omnipotent+." | "Invincible Guarding the Globe XP guide — Hero XP, Agent XP, Hero Special XP sources and rank-up costs from Rare to Omnipotent+. Level up fast." |
| `<title>` | "Invincible Guarding the Globe XP Guide — Hero Rank-Up Costs Rare to Omnipotent+" | "Invincible GTG XP Guide — Hero Level-Up & Rank Costs" |
| OG/Twitter | Mirror title/description | Mirror new |
| `og:site_name` | "Gem Rewards Calculator" | "Invincible GTG" |
| `<h1>` | "XP & PROGRESSION" | "INVINCIBLE GTG XP & PROGRESSION" |
| JSON-LD `headline` | (check) | "Invincible GTG XP Guide — Hero Level-Up & Rank Costs" |

---

## T10: Build & Verify

1. `npm run update-codes` — regenerate code guide markers
2. `npm run build` — full build (Tailwind + CSS min + JS min)
3. Verify each page's `<title>` contains "Invincible GTG"
4. Verify each page's `<meta name="description">` is unique (not repeating title)
5. Verify `og:site_name` is "Invincible GTG" on all pages
6. Verify `apple-mobile-web-app-title` is "Invincible GTG" on all pages
7. Verify code guide descriptions updated by script
8. Grep for "Gem Rewards Calculator" — should only appear in license/copyright, not in SEO tags

---

## Commit strategy

Single commit per task or batch:
- Commit 1: T1 (script change)
- Commit 2: T2-T9 (all page rewrites)
- Commit 3: T10 (build output)

Or: single commit for everything if the user prefers.

---

## Risk assessment

- **Low risk:** Title/meta/OG changes don't affect page functionality
- **Medium risk:** H1 changes could affect layout if text is too long (check CSS)
- **Medium risk:** `generate-codes.js` template change affects auto-generated content
- **No risk:** No body content, CSS, or JS changes
- **Verification:** `npm run build` must pass; grep for old strings must return 0 matches in SEO tags
