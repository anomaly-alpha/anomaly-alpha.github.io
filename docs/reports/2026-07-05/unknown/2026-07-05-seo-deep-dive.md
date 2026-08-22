# SEO Deep Dive Report: High-Impact Improvements

**Date:** Jul 5, 2026
**Site:** anomaly-alpha.github.io (Invincible Guarding the Globe Gem Calculator & Guides)
**GSC Period:** May 2 – Jul 2, 2026 (62 days)

---

## Executive Summary

The site is growing steadily (410 clicks, 11,402 impressions, 3.60% CTR) but has clear, fixable gaps that could double organic traffic within 60 days. Three categories of improvements stand out: **CTR leak fixes** (immediate impact), **schema markup debugging** (rich results eligibility), and **content gap filling** (new page creation for high-impression queries).

**Estimated impact if all recommendations implemented:** +50-100% clicks within 2-3 months.

---

## [R1] CTR Leak Fixes — Quick Wins (Impact: HIGH)

### Problem

Multiple queries rank in top 5-7 positions but get zero clicks. These are "CTR leaks" — the snippet doesn't match search intent, or competing results are more compelling.

| Query | Position | Impressions | Clicks | Estimated Loss |
|-------|----------|-------------|--------|----------------|
| invincible gem | 3.39 | 23 | 0 | ~2-3 clicks/week |
| invincible calculator | 4.33 | 18 | 0 | ~1-2 clicks/week |
| invincible gtg xp calculator | 5.62 | 60 | 0 | ~3-5 clicks/week |
| invincible pvp | 6.42 | 26 | 0 | ~1-2 clicks/week |
| invincible gem | 3.39 | 23 | 0 | ~2-3 clicks/week |
| how to get gems in invincible guarding the globe | 6.78 | 18 | 0 | ~1 click/week |
| invincible new code | 6.25 | 12 | 0 | ~1 click/week |

**Total estimated loss:** 10-15 clicks/week from queries where you already rank well.

### Root Causes

1. **Snippet mismatch** — Homepage meta says "Gem Calculator" but "invincible gem" searchers want to know how to get gems, not use a calculator
2. **No dedicated pages** — XP calculator query has no matching content
3. **Title tags don't match intent** — Generic titles miss specific query variants

### Fixes

| Fix | Target Query | Expected Impact | Effort |
|-----|-------------|----------------|--------|
| Rewrite homepage meta to lead with "gems" value prop | invincible gem, invincible calculator | +2-5 clicks/week | Low (done Jul 5) |
| Create XP calculator section on /guide/xp/ | invincible gtg xp calculator | +3-5 clicks/week | Medium |
| Add "invincible pvp" content to /guide/pvp/ | invincible pvp | +1-2 clicks/week | Low |
| Update /guide/beginners/ title to include "how to get gems" | how to get gems... | +1 click/week | Low |

---

## [R2] Schema Markup Not Surfacing — Debug Required (Impact: HIGH)

### Problem

FAQPage and Article schemas were added May 28, 2026. After 5+ weeks, GSC shows **zero rich results**. This is the single biggest missed opportunity — FAQ rich results can add 2-3x visual real estate in SERPs.

### Root Cause Analysis

1. **Validation issues found:**
   - Homepage FAQPage schema has 4 questions but the page body doesn't have matching visible FAQ content (questions only appear in accordion-style JS)
   - Code guide has both FAQPage AND HowTo schemas — Google may suppress if they conflict
   - Article schema `dateModified` is auto-updated but Google's [publication dates policy](https://developers.google.com/search/docs/appearance/publication-dates) warns against "changing page dates without substantive content changes"

2. **Likely causes of non-appearance:**
   - Google hasn't re-crawled since schema was added (no re-crawl requested)
   - Schema validation errors (missing required fields, mismatched content)
   - `dateModified` updates without content changes may trigger quality signals

3. **Per Google's documentation:**
   - FAQPage requires the questions to be visible on the page (not hidden behind JS)
   - Article schema requires `datePublished` and `dateModified` to reflect actual content changes
   - SoftwareApplication schema is for apps with download links — the game is on app stores, not a download from this site

### Fixes

| Fix | Effort | Expected Impact |
|-----|--------|----------------|
| Request re-crawl in GSC for all 8 pages | Low | Rich results within 1-2 weeks |
| Validate schemas against Google Rich Results Test | Low | Identify specific errors |
| Ensure FAQ questions are visible in page HTML (not just JS) | Medium | FAQPage eligibility |
| Remove `dateModified` auto-update if no content changed | Low | Avoid freshness penalties |
| Fix SoftwareApplication → use only on homepage where WebApplication exists | Low | Cleaner schema |
| Add `mainEntity` pointing to FAQPage on guide pages | Medium | Better entity association |

---

## [R3] Content Gap Pages — New Traffic Sources (Impact: HIGH)

### Problem

The site has 8 pages but GSC shows demand for queries that have no matching page. Creating targeted pages for these queries could capture 15-25 new clicks/week.

### Identified Gaps

| Query Cluster | Monthly Impressions | Current Coverage | Recommended Action |
|--------------|--------------------|-----------------|-----------------------|
| "invincible gtg xp calculator" | 60 | No XP calculator content | Add XP calculation section to /guide/xp/ |
| "invincible redeem code barcelona" | 156 | Mentioned on code guide | Create dedicated /guide/redeem/ page |
| "invincible new code" / "invincible new codes" | 54 | Covered by code guide title | Already covered — fix CTR |
| "how to get gems in invincible guarding the globe" | 18 | Beginners guide mentions it | Add dedicated section |
| "invincible vs ranks lp" | 8 (was higher) | Not covered | Consider /guide/ranks/ page |
| "invincible game promo code" | 27 | Code guide covers it | Fix CTR with better snippet |

### Priority Pages to Create

1. **`/guide/redeem/`** — "How to Redeem Invincible Codes" (targets "redeem code barcelona", "invincible redeem")
2. **Expand `/guide/xp/`** — Add XP calculator content (targets "xp calculator" queries)

---

## [R4] Internal Linking Optimization (Impact: MEDIUM)

### Problem

With only 8 pages, internal linking should be tight. Currently:
- Guide pages link to each other and back to home (good)
- Homepage links to all guides (good)
- But anchor text is generic ("View Guide", "Learn More") instead of keyword-rich

### Fixes

| Fix | Effort | Impact |
|-----|--------|--------|
| Use keyword-rich anchor text in cross-links | Low | +0.5-1% CTR improvement |
| Add "related guides" section at bottom of each guide | Medium | Better crawl depth |
| Link from code guide to redeem guide (once created) | Low | Authority flow |
| Add contextual links within guide body text | Medium | Topical relevance signals |

---

## [R5] Freshness & Update Signals (Impact: MEDIUM)

### Problem

The code guide is updated frequently (daily changefreq in sitemap) but other pages are static. Google's helpful content system considers freshness for time-sensitive content like promo codes.

### Current State
- Code guide: Updated Jul 4 (good)
- Other guides: Updated Jul 4 (meta dates) but content rarely changes
- Homepage: Updated Jul 4 (good)

### Recommendations

1. **Don't auto-update `dateModified`** — Only update when substantive content changes. Google's [publication dates policy](https://developers.google.com/search/docs/appearance/publication-dates) penalizes "freshness manipulation"
2. **Update code guide more frequently** — When new codes drop, update immediately. The "28 Active [Jul 2026]" title freshness signal is working
3. **Add "Last verified" dates to guide content** — Visible to users, signals ongoing maintenance
4. **Sitemap `changefreq`** — Keep code guide as `daily`, others as `monthly` (already correct)

---

## [R6] E-E-A-T for Fan Sites (Impact: MEDIUM)

### Problem

As a fan site (not official), establishing credibility is important. Google's [helpful content system](https://developers.google.com/search/docs/fundamentals/creating-helpful-content) evaluates experience, expertise, authoritativeness, and trustworthiness.

### Current Strengths
- Author names visible (Anomaly, TheOneTruePanda, etc.)
- Accurate game data with specific numbers
- Regular updates

### Gaps & Fixes

| Gap | Fix | Effort |
|-----|-----|--------|
| No "About" page explaining the team | Add brief about section or page | Low |
| No sources cited for game data | Add "Data verified against game version X.X" note | Low |
| No community signals | Consider linking to Discord/community | Low |
| Publisher name inconsistent ("Gem Rewards Calculator" vs "Anomaly Alpha") | Standardize across all schema | Low |

---

## [R7] Core Web Vitals for Calculator Pages (Impact: MEDIUM)

### Problem

The homepage is a Chart.js-heavy interactive calculator. Chart.js is lazy-loaded (good) but may cause layout shift when charts initialize.

### Current Optimizations (Already Good)
- Chart.js lazy-loaded on first "Show Charts" click
- Fonts preloaded with woff2
- CSS inlined for critical path
- `html { visibility: hidden }` FOUC prevention

### Remaining Opportunities

| Optimization | Effort | Impact |
|-------------|--------|--------|
| Add `will-change: transform` to chart containers | Low | CLS reduction |
| Set explicit `min-height` on chart containers | Low | CLS reduction |
| Use `content-visibility: auto` on below-fold sections | Low | Rendering performance |
| Consider `loading="lazy"` on OG images in head (remove preload) | Low | Faster initial load |

---

## [R8] Mobile-First Optimizations (Impact: LOW-MEDIUM)

### Problem

85% of traffic is mobile. The site is responsive (good) but interactive elements may not be optimally sized.

### Recommendations

| Fix | Effort | Impact |
|-----|--------|--------|
| Ensure tap targets are ≥48x48px (especially PvP dropdowns) | Low | Mobile usability |
| Test calculator on 320px viewport | Low | Edge case coverage |
| Add `touch-action: manipulation` to interactive elements | Low | Scroll performance |
| Consider AMP or lite version for code page (most mobile traffic) | High | Potential SERP boost |

---

## [R9] Title Tag Optimization (Impact: MEDIUM)

### Current Title Analysis

| Page | Title | Length | Keyword Match | Verdict |
|------|-------|--------|---------------|---------|
| Home | Invincible Guarding the Globe Gems Calculator — 4,043/Week | 62 chars | Good for "gem calculator" | Good |
| Code | Invincible Guarding the Globe Promo Codes — 28 Active [Jul 2026] | 66 chars | Excellent, includes freshness | Excellent |
| FAQ | Invincible Guarding the Globe FAQ — How Many Gems Per Week? | 61 chars | Good | Good |
| PvP | (not checked) | — | — | Check |
| Event | (not checked) | — | — | Check |
| Login | (not checked) | — | — | Check |
| Beginners | (not checked) | — | — | Check |
| XP | (not checked) | — | — | Check |

### Recommendations
- Ensure all titles are ≤60 chars (Google truncates at ~60)
- Lead with primary keyword, brand at end
- Include freshness signal where applicable (code guide does this well)

---

## Prioritized Action Plan

### Phase 1: Immediate (This Week)
1. ~~Rewrite homepage meta description~~ (DONE Jul 5)
2. Request GSC re-crawl for all 8 pages
3. Validate all schemas via Google Rich Results Test
4. Fix `dateModified` to only update on real content changes

### Phase 2: Short-Term (Next 2 Weeks)
5. Add XP calculator content to /guide/xp/
6. Fix FAQ schema visibility (ensure questions are in HTML)
7. Standardize publisher name across all schema
8. Add keyword-rich anchor text to internal links

### Phase 3: Medium-Term (Next Month)
9. Create /guide/redeem/ page
10. Add "about" section explaining the team
11. Optimize chart containers for CLS
12. Add `content-visibility: auto` to below-fold sections

### Phase 4: Ongoing
13. Update code guide immediately when new codes drop
14. Monitor GSC for rich results appearance
15. Track CTR improvements from meta changes
16. Build backlinks to code guide (target top 5 position)

---

## Sources

- [Google: Structured Data Policies](https://developers.google.com/search/docs/appearance/structured-data/sd-policies)
- [Google: Snippets](https://developers.google.com/search/docs/appearance/snippet)
- [Google: Publication Dates](https://developers.google.com/search/docs/appearance/publication-dates)
- [Google: Helpful Content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content)
- [Google: SoftwareApp Schema](https://developers.google.com/search/docs/appearance/structured-data/software-app)
- [Google: Article Schema](https://developers.google.com/search/docs/appearance/structured-data/article)
- [Ahrefs: Meta Descriptions](https://ahrefs.com/blog/meta-description/)
- [Ahrefs: Title Tags](https://ahrefs.com/blog/title-tag-seo/)
- [Ahrefs: Featured Snippets](https://ahrefs.com/blog/featured-snippets/)
- [Moz: Title Tags](https://moz.com/learn/seo/title-tag)
- [Chart.js: Responsive](https://www.chartjs.org/docs/latest/configuration/responsive.html)
- [Web.dev: Optimize CLS](https://web.dev/articles/optimize-cls)
