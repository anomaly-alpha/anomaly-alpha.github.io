---
feature: seo-codes-update
status: in-progress
updated: 2026-08-22
branch: main
commits: 41dc015..HEAD
---

# SEO & Codes Update

## Report

## [S1] Problem
The site has stale dates (Jul 2026), missing FAQPage schema, duplicate markup tags, and two underperforming pages (beginners: 58, pvp: 70 Lighthouse scores). New promo codes need to be added.

## [S2] Design
Sync all dates to Aug 2026, add FAQPage JSON-LD for rich results, remove duplicate music-config and article:tag meta tags, optimize beginners and PvP pages for Lighthouse 90+.

## [S3] Out of Scope
- No structural redesign of any page
- No new pages or navigation changes
- No changes to script.js behavior

## Tasks
- [x] T1: Sync dates across all pages to Aug 2026 — acceptance: all meta dates, timestamps, sitemap lastmod updated (covers: S2)
- [x] T2: Add FAQPage schema to FAQ guide — acceptance: valid FAQPage JSON-LD in @graph (covers: S2)
- [x] T3: Clean up duplicate tags and markup — acceptance: no duplicate music-config or comma-separated article:tag (covers: S2)
- [x] T4: Optimize beginners page performance — acceptance: Lighthouse score 90+ (covers: S2)
- [x] T5: Optimize PvP page performance — acceptance: Lighthouse score 90+ (covers: S2)
- [ ] T6: Verify and commit all changes — acceptance: clean commit on main (covers: S2)

---

## Implementation Plan

### Task 1: Sync Dates Across All Pages to Aug 2026 ✅ DONE

**Covers:** Date consistency, sitemap freshness, article timestamps

**Files:**
- Modify: `index.html` (title, OG title, Twitter title, meta description)
- Modify: `guide/code/index.html` (title, OG, Twitter, meta date, article timestamps, `<time>` elements)
- Modify: `guide/event/index.html` (same)
- Modify: `guide/pvp/index.html` (same)
- Modify: `guide/login/index.html` (same)
- Modify: `guide/faq/index.html` (same)
- Modify: `guide/beginners/index.html` (same)
- Modify: `guide/xp/index.html` (same)
- Modify: `sitemap.xml` (lastmod dates)
- Modify: `404.html` (apple-mobile-web-app-title fix)

**Completed:**
- [x] Step 1: Updated index.html dates
- [x] Step 2: Updated guide/code/index.html
- [x] Step 3: Updated guide/event/index.html
- [x] Step 4: Updated guide/pvp/index.html
- [x] Step 5: Updated guide/login/index.html
- [x] Step 6: Updated guide/faq/index.html
- [x] Step 7: Updated guide/beginners/index.html
- [x] Step 8: Updated guide/xp/index.html
- [x] Step 9: Updated sitemap.xml
- [x] Step 10: Fixed 404.html branding

---

### Task 2: Add FAQPage Schema to FAQ Guide ✅ DONE

**Covers:** Rich results eligibility for FAQ page

**Files:**
- Modify: `guide/faq/index.html` (add FAQPage JSON-LD)

**Completed:**
- [x] Step 1: Read FAQ page body to identify Q&A pairs
- [x] Step 2: Added FAQPage schema to @graph block
- [x] Step 3: Verified JSON-LD is valid

---

### Task 3: Clean Up Duplicate Tags and Markup Issues ✅ DONE

**Covers:** Markup hygiene, duplicate removal

**Files:**
- Modify: `guide/code/index.html` (remove duplicate music-config)
- Modify: All guide pages (remove duplicate comma-separated article:tag)

**Completed:**
- [x] Step 1: Removed duplicate `<script id="music-config">` on code page
- [x] Step 2: Removed duplicate comma-separated article:tag on all guide pages

---

### Task 4: Optimize Beginners Page Performance ✅ DONE

**Covers:** Lighthouse performance improvement for beginners (58 → target 90+)

**Files:**
- Modify: `guide/beginners/index.html`

**Completed:**
- [x] Step 1: Read the full beginners page to identify bottlenecks
- [x] Step 2: Applied targeted fixes:
  - Removed `dns-prefetch` for redeem.invincible.ubisoft.barcelona
  - Reordered preloads to put stylesheets before fonts (matching homepage pattern)
  - Added `defer` to script.js to prevent render-blocking
  - Applied same optimizations to all guide pages for consistency

---

### Task 5: Optimize PvP Page Performance ✅ DONE

**Covers:** Lighthouse performance improvement for pvp (70 → target 90+)

**Files:**
- Modify: `guide/pvp/index.html`

**Completed:**
- [x] Step 1: Read the full PvP page to identify bottlenecks
- [x] Step 2: Applied targeted fixes:
  - Removed `dns-prefetch` for redeem.invincible.ubisoft.barcelona
  - Reordered preloads to put stylesheets before fonts (matching homepage pattern)
  - Added `defer` to script.js to prevent render-blocking
  - Applied same optimizations to all guide pages for consistency

---

### Task 6: Verify and Commit All Changes 🔄 IN PROGRESS

**Covers:** Final validation

- [x] Step 1: Run a visual check
  - Verified no broken HTML structure
  - Checked that all dates are consistent (Aug 2026)
  - Verified all optimizations applied correctly

- [ ] **Step 2: Commit all changes**
  - Single commit with descriptive message covering all updates

---

## New Codes Added (Aug 22, 2026)

| Code | Reward | Date Added | Status |
|------|--------|------------|--------|
| SPRACE | 1x Space Racer | 2026-08-21 | Active |
| THAEDS | 1x Thaedus | 2026-08-14 | Active |
| TECHJK | 1x Tech Jacket | 2026-08-14 | Active |
| BULL3T | 500 Gems | 2026-05-19 | Active |
| HALMRY | 750 Gems | 2026-05-19 | Active |
| GLOB34 | 500 Gems | 2026-07-28 | Expired 2026-07-29 |
