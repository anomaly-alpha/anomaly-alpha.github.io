# Plan 161: Gems/Codes SEO + Breadcrumbs + Article Schema

**Date:** 2026-05-28
**Model:** deepseek-v4-flash-free
**Keywords:** "invincible guarding the globe gems", "invincible guarding the globe codes"

---

## Overview

Three workstreams:

1. **Dynamic Code Count** — build-time script that keeps the active code count accurate in meta
2. **SERP Meta Optimization** — keyword-targeted titles/descriptions for gems + codes pages
3. **Breadcrumbs + Article Schema** — visual breadcrumbs, semantic `<article>` elements, Article structured data on all 6 guide pages

---

## Workstream A: Dynamic Code Count Script

### New file: `scripts/update-code-count.js`

A Node.js script that:

1. Reads `index.html`
2. Extracts the `promoCodes` JSON array via regex
3. Filters to active codes (`!c.expired`)
4. Counts active codes → `N`
5. Reads `guide/code/index.html`
6. Replaces all hardcoded `"## active"` patterns with `"{N} active"` in:
   - `<meta name="description">`
   - `<meta property="og:description">`
   - `<meta name="twitter:description">`
   - `<meta property="og:image:alt">`
   - Tab badge text (`gem-card__tab--code`)
   - Hero subtitle text
   - Body paragraph text (3 locations)
   - JSON-LD `"description"` fields
7. Writes the file back

### Modified file: `package.json`

Add script and chain into build:

```json
"scripts": {
  "update-code-count": "node scripts/update-code-count.js",
  "build": "node scripts/update-code-count.js && tailwindcss -i src/tailwind-input.css -o tailwind.css && node -e \"...\" && node -e \"...\"",
  ...
}
```

**Rationale:** Meta descriptions must be static HTML for SEO crawlers. A build-time script keeps them accurate without runtime JS. Every code add/expiry automatically propagates to all SERP-facing text on `npm run build`.

---

## Workstream B: SERP Meta Optimization

### Target keywords

| Keyphrase | Primary Page |
|-----------|-------------|
| `invincible guarding the globe gems` | `index.html` |
| `invincible guarding the globe codes` | `guide/code/index.html` |

### Titles (50-60 chars)

| Page | Current | Proposed | Chars |
|------|---------|----------|-------|
| `index.html` | Invincible Guarding the Globe — Gem Rewards &amp; Promo Codes | **Invincible Guarding the Globe Gems — Weekly Rewards Calculator** | 59 ✓ |
| `guide/code/index.html` | Invincible Guarding the Globe Codes — 26 Active Codes | **Invincible Guarding the Globe Codes — {N} Active Promo Codes** | dynamic |
| `guide/event/index.html` | Invincible Event Rewards Guide — The Long Haul & Earth's Defenders | **Invincible Guarding the Globe — Event Rewards Guide** | 50 |
| `guide/pvp/index.html` | Invincible PvP Ranked Rewards Guide — Leagues, Arena & War Payouts | **Invincible Guarding the Globe — PvP Rewards Guide** | 46 |
| `guide/login/index.html` | Invincible Login Rewards Guide — 1,393 Gems/Week | **Invincible Guarding the Globe — Login Rewards Guide** | 50 |
| `guide/faq/index.html` | How Many Gems Per Week? Invincible Guarding the Globe FAQ | **Invincible Guarding the Globe FAQ — How Many Gems Per Week?** | 60 ✓ |
| `guide/beginners/index.html` | How to Get Free Gems in Invincible Guarding the Globe | **Invincible Guarding the Globe — Beginner's Guide to Free Gems** | 56 ✓ |
| `404.html` | 404 — Page Not Found &#124; Gem Rewards Calculator | **Page Not Found — Gem Rewards Calculator** | 39 ✓ |

### Meta descriptions (~155 chars)

| Page | Current | Proposed |
|------|---------|----------|
| `index.html` | 195 chars — too long | How many gems can you earn in Invincible Guarding the Globe? Calculator with codes, PvP, login streaks & events — ~4,043 gems/week from all sources. **(157 chars)** |
| `guide/code/index.html` | 193 chars — too long | Find all active Invincible Guarding the Globe codes. {N} active promo codes worth gems, hero shards & tickets — redeem via verification code at the Ubisoft portal. **(~153 chars)** |
| `guide/event/index.html` | 206 chars — too long | Earn up to 500 gems per week from Invincible Guarding the Globe events. Strategies for The Long Haul and Earth's Defenders top rankings. **(~150 chars)** |
| `guide/pvp/index.html` | 181 chars — too long | Complete guide to Invincible Guarding the Globe PvP rewards. All 14 league payout tables for Restricted Arena, Open Arena & Alliance War. **(~155 chars)** |
| `guide/login/index.html` | 251 chars — too long | Earn 1,393 gems per week from Invincible Guarding the Globe login rewards. Daily (910), weekly (460) & monthly bonuses explained. **(~152 chars)** |
| `guide/faq/index.html` | 178 chars — too long | How many gems per week in Invincible Guarding the Globe? ~4,043 from all sources. FAQ covering PvP leagues, promo codes & login rewards. **(~148 chars)** |
| `guide/beginners/index.html` | 196 chars — too long | New to Invincible Guarding the Globe? Earn ~4,043 free gems per week from login rewards, events, PvP payouts & promo codes. Beginner's guide. **(~156 chars)** |
| `404.html` | 178 chars — too long | Page not found — Gem Rewards Calculator for Invincible Guarding the Globe. Return to plan your weekly gem income. **(~130 chars)** |

### Additional meta tags to add (all pages)

```html
<meta name="robots" content="max-snippet:150, max-image-preview:large">
<meta name="twitter:image" content="https://anomaly-alpha.github.io/og-images/[page].png">
```

### Fix OG image alt text

| Page | Current | Fix |
|------|---------|-----|
| `index.html` | Gem Rewards &amp; PvP Guide — ~3,221 GEMS/WEEK | Gem Rewards &amp; PvP Guide — ~4,043 GEMS/WEEK **(stale number)** |
| `guide/code/index.html` | Codes Guide — 26 ACTIVE CODES | Codes Guide — {N} ACTIVE CODES **(via build script)** |

### Pages affected by Workstream B

- `index.html` — title, description, og:title, og:description, twitter:title, twitter:description, og:image:alt, robots, twitter:image
- `guide/code/index.html` — handled by build script
- `guide/event/index.html` — title, description, meta tags
- `guide/pvp/index.html` — title, description, meta tags
- `guide/login/index.html` — title, description, meta tags
- `guide/faq/index.html` — title, description, meta tags
- `guide/beginners/index.html` — title, description, meta tags
- `404.html` — title, description, meta tags, twitter:image

---

## Workstream C: Breadcrumbs + Article Schema

### C1: Visual breadcrumbs

Each guide page gets a `<nav aria-label="Breadcrumb">` placed above the existing inter-guide nav:

```html
<nav aria-label="Breadcrumb" class="gem-breadcrumb mb-3">
  <ol class="gem-breadcrumb__list">
    <li class="gem-breadcrumb__item">
      <a href="../../" class="gem-breadcrumb__link">Home</a>
      <span class="gem-breadcrumb__sep" aria-hidden="true">›</span>
    </li>
    <li class="gem-breadcrumb__item gem-breadcrumb__item--current" aria-current="page">
      [Guide Page Title]
    </li>
  </ol>
</nav>
```

Per-page breadcrumb title text:

| Page | Breadcrumb title |
|------|-----------------|
| code | Invincible Guarding the Globe Codes |
| event | Event Rewards Guide |
| pvp | PvP Rewards Guide |
| login | Login Rewards Guide |
| faq | Gem Rewards FAQ |
| beginners | Beginner's Guide |

### C2: Breadcrumb CSS in `styles.css`

Add BEM classes for breadcrumb styling:

```css
.gem-breadcrumb{margin-bottom:.5rem;font-size:.75rem}
.gem-breadcrumb__list{display:flex;flex-wrap:wrap;gap:.25rem;list-style:none;padding:0;margin:0;align-items:center}
.gem-breadcrumb__item{display:flex;align-items:center;gap:.25rem}
.gem-breadcrumb__sep{color:rgba(255,255,255,.3);margin:0 .15rem}
.gem-breadcrumb__link{color:var(--gem-cyan);transition:color .2s}
.gem-breadcrumb__link:hover{color:#fff}
.gem-breadcrumb__item--current{color:rgba(255,255,255,.6)}
```

Uses existing `--gem-cyan` custom property. Consistent with the site's dark theme.

### C3: Fix BreadcrumbList JSON-LD

All 6 guide pages already have `BreadcrumbList` structured data. Fix `position:1` name for consistency with visual breadcrumb:

```diff
- "name": "Gem Rewards Infographic"
+ "name": "Home"
```

This standardizes the label across visual + structured breadcrumbs.

### C4: Article structured data (replace Guide schema)

On 5 guide pages (code, event, pvp, login, beginners), replace the existing `@type: "Guide"` entry with `@type: "Article"`:

```json
{
  "@type": "Article",
  "headline": "[same as current Guide.name]",
  "description": "[same as current Guide.description]",
  "url": "[same]",
  "about": { "@type": "VideoGame", "name": "Invincible Guarding the Globe" },
  "author": [
    { "@type": "Person", "name": "Anomaly" },
    { "@type": "Person", "name": "TheOneTruePanda" }
  ],
  "publisher": {
    "@type": "Organization",
    "name": "Gem Rewards Calculator",
    "url": "https://anomaly-alpha.github.io/"
  },
  "image": "https://anomaly-alpha.github.io/og-images/[page].png",
  "datePublished": "2026-04-29",
  "dateModified": "2026-05-28"
}
```

On `guide/faq/index.html`, **add** `Article` to the `@graph` as an additional entry (keep existing `FAQPage`).

### C5: Semantic `<article>` elements

Wrap guide page content inside `<article>`:

```html
<main>
  <article>
    <div class="text-center mb-10 relative">
      <h1>...</h1>
    </div>
    <!-- all existing content -->
  </article>
</main>
```

Pages: all 6 guides (code, event, pvp, login, faq, beginners).

### C6: `<time>` elements

On `guide/code/index.html`, upgrade the existing "Last updated" text:

```diff
- <p class="text-xs gem-text--code mb-2">Last updated: May 20, 2026</p>
+ <p class="text-xs gem-text--code mb-2">Last updated: <time datetime="2026-05-20">May 20, 2026</time></p>
```

On the other 5 guide pages, add a similar line inside the first content card:

```html
<p class="text-xs gem-text--muted mb-2">Last updated: <time datetime="2026-05-28">May 28, 2026</time></p>
```

### Pages affected by Workstream C

- `guide/code/index.html` — breadcrumb nav, Article schema, `<article>` tag, `<time>` upgrade, BreadcrumbList name fix
- `guide/event/index.html` — breadcrumb nav, Article schema, `<article>` tag, `<time>` add, BreadcrumbList name fix
- `guide/pvp/index.html` — breadcrumb nav, Article schema, `<article>` tag, `<time>` add, BreadcrumbList name fix
- `guide/login/index.html` — breadcrumb nav, Article schema, `<article>` tag, `<time>` add, BreadcrumbList name fix
- `guide/faq/index.html` — breadcrumb nav, Article schema (add alongside FAQPage), `<article>` tag, `<time>` add, BreadcrumbList name fix
- `guide/beginners/index.html` — breadcrumb nav, Article schema, `<article>` tag, `<time>` add, BreadcrumbList name fix
- `styles.css` — add breadcrumb CSS classes

---

## Sitemap Update

| Field | Current | New |
|-------|---------|-----|
| `<lastmod>` | 2026-05-12 (all URLs) | 2026-05-28 (all URLs) |

**File:** `sitemap.xml` — update all 7 `<lastmod>` values.

---

## Files Summary

### New files (1)
| File | Purpose |
|------|---------|
| `scripts/update-code-count.js` | Build-time code count updater |

### Modified files (9)
| File | A | B | C |
|------|---|---|---|
| `index.html` | — | title, desc, OG/Twitter tags, og:image:alt, robots, twitter:image | — |
| `guide/code/index.html` | meta rewritten by script | — | breadcrumb nav, Article, `<article>`, `<time>`, BreadcrumbList fix |
| `guide/event/index.html` | — | title, desc, meta tags, twitter:image | breadcrumb nav, Article, `<article>`, `<time>`, BreadcrumbList fix |
| `guide/pvp/index.html` | — | title, desc, meta tags, twitter:image | breadcrumb nav, Article, `<article>`, `<time>`, BreadcrumbList fix |
| `guide/login/index.html` | — | title, desc, meta tags, twitter:image | breadcrumb nav, Article, `<article>`, `<time>`, BreadcrumbList fix |
| `guide/faq/index.html` | — | title, desc, meta tags, twitter:image | breadcrumb nav, Article (add), `<article>`, `<time>`, BreadcrumbList fix |
| `guide/beginners/index.html` | — | title, desc, meta tags, twitter:image | breadcrumb nav, Article, `<article>`, `<time>`, BreadcrumbList fix |
| `404.html` | — | title, desc, twitter:image | — |
| `styles.css` | — | — | breadcrumb CSS classes |
| `sitemap.xml` | — | lastmod → 2026-05-28 | — |
| `package.json` | add update-code-count script, chain into build | — | — |

---

## Build & Verification

```bash
npm run build        # runs update-code-count → tailwind → minify CSS → minify JS
```

### Verification steps

1. **Code count**: Open `guide/code/index.html` — confirm meta says "27 active" (or current count)
2. **Breadcrumbs**: Open any guide page — confirm breadcrumb nav shows "Home › Guide Name"
3. **Article schema**: Use Google Rich Results Test on each guide page — confirm Article schema is valid and eligible
4. **Meta descriptions**: Check each page's `<meta name="description">` — confirm ~155 chars, unique, keyword-rich
5. **twitter:image**: Confirm each page has its own twitter:image tag pointing to the correct OG image
6. **Sitemap**: Confirm sitemap.xml lastmod is 2026-05-28

---

## What's intentionally NOT in this plan

- **Organization schema on main page** — site is not a business entity
- **Visual breadcrumbs on main page** — main page IS the home, no breadcrumb needed
- **User-generated content** — all content is static
- **Hreflang** — single language site
- **Backlinks** — cannot be controlled via code
- **Guide page title rewrites for non-target pages** — kept clean but not keyword-stuffed; only gems and codes pages get keyword-first titles
