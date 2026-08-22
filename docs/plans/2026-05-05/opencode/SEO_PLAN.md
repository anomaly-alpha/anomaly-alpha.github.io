# SEO Plan: Google Search Console Keyword Optimization [EXECUTED]

## Source data
`data/https___anomaly-alpha/Queries.csv`, `Pages.csv`, `Devices.csv`

## Audit findings (seo-audit skill)

| # | Issue | Priority |
|---|-------|----------|
| 1 | Sitemap missing `<lastmod>` tags — code page `changefreq:monthly` should be `weekly` | High |
| 2 | 404.html has self-referencing canonical — should be noindex | Low |
| 3 | No freshness date on code guide | Low (quick win) |
| 4 | Title tags near mobile truncation limit | Fixed in plan |

## Changes executed

### 1. `/guide/code/index.html`

| What | Before | After |
|------|--------|-------|
| `<title>` | Invincible Promo Codes — Free Gem Rewards Guide | **Invincible Guarding the Globe Codes — 26 Active Codes** |
| `<meta description>` | Complete guide to Invincible Guarding the Globe promo codes... | **Find all current Invincible Guarding the Globe codes, promo codes, and reward codes — how to redeem, where to find new codes, and tips.** |
| OG/Twitter desc | 26 active promo codes worth 300 gems each... | **Find all current Invincible Guarding the Globe codes and reward codes.** |
| `Guide.description` ld+json | Learn how to redeem promo codes... | **Find active Invincible Guarding the Globe codes, promo codes, and reward codes.** |
| Breadcrumb name | Promo Codes Guide | **Invincible Guarding the Globe Codes** |
| H1 hero | PROMO CODES | **INVINCIBLE GUARDING THE GLOBE CODES** |
| Hero subtitle | 26 codes available | **26 active codes — find new codes, redeem rewards** |
| Intro paragraph | Promotional codes that reward gems when redeemed... | **Find all current Invincible Guarding the Globe codes, promo codes, and reward codes in one place.** + existing content |
| New section after hero | *(missing)* | Added **"New Invincible Guarding the Globe Codes"** section after hero, above redemption steps |
| Freshness date | *(missing)* | Added **"Last updated: May 5, 2026"** badge in hero |

### 2. `/guide/pvp/index.html`

| What | Before | After |
|------|--------|-------|
| `<title>` | Invincible PvP Rewards Guide — Leagues & Arena Payouts | **Invincible PvP Ranked Rewards Guide — League Tiers & Arena Payouts** |
| `<meta description>` | Complete guide to Invincible Guarding the Globe PvP rewards... | **Master Invincible PvP ranked rewards — all 14 leagues from Intern to Invincible with per-league payout tables. Learn how ranked league tier and arena mode determine your gem income.** |
| OG/Twitter title | Invincible PvP Rewards Guide — Leagues & Arena Payouts | **Invincible PvP Ranked Rewards Guide — League Tiers & Arena Payouts** |
| OG/Twitter desc | Master Invincible PvP rewards... | **Master Invincible PvP ranked rewards — 14 leagues, payout tables, and 3 arena modes. Calculate your gem income.** |
| `Guide.name` ld+json | Invincible PvP Rewards Guide — Leagues & Arena Payouts | **Invincible PvP Ranked Rewards Guide** |
| `Guide.description` ld+json | Complete guide to PvP rewards... | **Guide to Invincible PvP ranked rewards with 14 league tiers and payout tables.** |
| Footer H3 | Promo Codes Guide | **Invincible Guarding the Globe Codes** |
| Footer text | 26 active codes — 300 free gems each... | **Invincible Guarding the Globe codes — 300 free gems each, how to redeem, and more** |
| Body content | *(missing)* | Added **"ranked rewards"** reference in PvP Income Overview section |

### 3. `index.html` (homepage)

| What | Before | After |
|------|--------|-------|
| `<title>` | Invincible Guarding the Globe — Gem Rewards & PvP Guide | **Invincible Guarding the Globe — Gem Rewards & Promo Codes** |
| `<meta description>` | Plan your weekly gem income... | **Plan your weekly gem income with Invincible Guarding the Globe codes, promo codes, and PvP ranked rewards calculator. ~4,043 gems/week from all sources.** |
| OG/Twitter description | Plan your weekly gem income... | Updated to include "codes" and "ranked rewards" keywords |

### 4. Footer cross-links

| File | Before | After |
|------|--------|-------|
| `guide/faq/index.html` | 26 active codes — how to redeem, and more | **Invincible Guarding the Globe codes — how to redeem, and more** |
| `guide/event/index.html` | 26 active codes — 300 free gems each... | **Invincible Guarding the Globe codes — 300 free gems each, how to redeem, and more** |
| `guide/login/index.html` | 26 active codes — 300 free gems each... | **Invincible Guarding the Globe codes — 300 free gems each, how to redeem, and more** |
| `guide/pvp/index.html` | Promo Codes Guide (H3) | **Invincible Guarding the Globe Codes** |

### 5. Sitemap

- Added `<lastmod>` tags to all 7 URLs
- Changed code guide `changefreq` from `monthly` to `weekly`

### 6. 404.html

- Removed self-referencing canonical
- Added `<meta name="robots" content="noindex">`

### 7. CSS: Copy animation overlay

Added to `styles.css`:
```css
.gem-code__chip{position:relative;display:inline-block}
.gem-code__chip.copied::after{content:"Copied!";position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(46,204,113,.95);color:#fff;font-family:"Courier New",monospace;font-size:.75rem;font-weight:700;letter-spacing:.1em;border-radius:.375rem;animation:gem-code--pop-in .3s cubic-bezier(.34,1.56,.64,1) forwards}
```

### 8. Build

```bash
npm run build
```

### 9. Commit

```bash
git add -A && git commit -m "seo: optimize for GSC keyword data + audit findings + copy animation"
```
