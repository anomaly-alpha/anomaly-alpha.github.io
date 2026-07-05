# Implementation Plan: High-Impact SEO Improvements

**Source Report:** `docs/compose/reports/2026-07-05-seo-deep-dive.md`
**Date:** Jul 5, 2026
**Estimated Total Impact:** +50-100% organic clicks within 2-3 months

---

## Phase 1: Schema Markup Debugging (Immediate — This Week)

### Task 1.1: Validate All Schemas via Google Rich Results Test

**Files:** All 8 HTML files
**What:** Run each page URL through Google Rich Results Test and fix any validation errors.
**Why:** Schema added May 28 hasn't surfaced in 5+ weeks — likely has errors.
**Verification:** Each page returns "Page is eligible for rich results" with no errors.

### Task 1.2: Fix FAQPage Schema Visibility

**Files:** `index.html`, all `guide/*/index.html`
**What:** Ensure FAQ questions are present in visible HTML, not just in JSON-LD. Google requires FAQ questions to be visible on the page for FAQ rich results.
**Why:** Hidden FAQ content is the most common reason FAQPage schema doesn't surface.
**Approach:**
- Check if FAQ sections are rendered in HTML (even if collapsed by default)
- If FAQ is JS-only, add the questions as visible HTML (can be in a `<details>` element)
- Ensure the visible question text matches the JSON-LD `name` field exactly

### Task 1.3: Fix `dateModified` Freshness Signals

**Files:** `scripts/generate-codes.js`, `index.html`, all `guide/*/index.html`
**What:** Stop auto-updating `dateModified` on every code regeneration. Only update when substantive content changes.
**Why:** Google's publication dates policy warns against date manipulation. `generate-codes.js` lines 74 and 102-103 auto-update both `article:modified_time` and JSON-LD `dateModified` every time `npm run update-codes` runs — even if only the code list changed, not the guide content itself.
**Approach:**
- In `scripts/generate-codes.js`: remove the `article:modified_time` marker update (line 74) and the JSON-LD `dateModified` regex update (lines 102-103)
- Only update `dateModified` manually when guide content (not just code list) changes
- Set current `dateModified` to the last date with real content changes (not just code updates)

### Task 1.4: Request GSC Re-crawl

**Files:** None (manual GSC action)
**What:** Submit all 8 URLs for re-crawl in Google Search Console.
**Why:** Google may not have re-crawled since schema was added.
**Verification:** Check GSC "URL Inspection" → "Request Indexing" for each page.

---

## Phase 2: CTR Leak Fixes (Next 2 Weeks)

### Task 2.1: Fix XP Page Meta Description Mismatch

**Files:** `guide/xp/index.html`
**What:** Fix the meta description to include "XP calculator" — the title already says "XP Calculator" but the meta description says "XP guide" without "calculator." This snippet mismatch is why "invincible gtg xp calculator" (60 impressions, pos 5.62) gets 0 clicks.
**Why:** Title says "Calculator" but description says "guide" — Google shows the description in the snippet, so searchers for "calculator" don't see a match.
**Approach:**
- New meta description: "Calculate XP and level up heroes in Invincible Guarding the Globe — Hero XP, Agent XP, Hero Special XP sources and rank-up costs from Rare to Omnipotent+."
- Update OG and Twitter descriptions to match
- No need to add interactive calculator content — the page already covers XP systems thoroughly

### Task 2.2: Fix FAQ Page CTR

**Files:** `guide/faq/index.html`
**What:** Rewrite the FAQ page title and meta description to be more compelling. Current CTR is 1.16% (below site average of 3.60%).
**Why:** 603 impressions but only 7 clicks. The title "How Many Gems Per Week?" is informational but not click-worthy.
**Approach:**
- New title: "Invincible Guarding the Globe FAQ — All Your Questions Answered"
- New meta: Lead with the most-searched question ("How many gems?"), add social proof ("Updated weekly")
- Ensure FAQ questions match what users actually search for

### Task 2.3: Add "PvP" Content to PvP Guide

**Files:** `guide/pvp/index.html`
**What:** Ensure the PvP guide title and meta target the generic "invincible pvp" query (26 impressions at pos 6.42, 0 clicks).
**Why:** The guide exists but may not be matching the simple "invincible pvp" intent.
**Approach:**
- Check current title/meta for PvP guide
- Add "PvP" prominently in title if not already there
- Ensure meta description answers "what is PvP in Invincible GTG"

### Task 2.4: Optimize Beginners Guide for "How to Get Gems"

**Files:** `guide/beginners/index.html`
**What:** Update title/meta to target "how to get gems in invincible guarding the globe" (18 impressions at pos 6.78, 0 clicks).
**Why:** The beginners guide likely covers this but the snippet doesn't match.
**Approach:**
- Add "How to Get Gems" to the title
- Update meta to mention "free gems" prominently
- Ensure the guide has a clear "how to get gems" section

---

## Phase 3: Content Gap Pages (Next Month)

### Task 3.1: Create /guide/redeem/ Page

**Files:** New file `guide/redeem/index.html`, update `sitemap.xml`, update all guide nav links
**What:** Create a dedicated "How to Redeem Invincible Codes" page targeting "invincible redeem code barcelona" (156 impressions) and related queries.
**Why:** The redemption process is mentioned on the code guide but deserves its own page for this high-volume query.
**Approach:**
- Step-by-step redemption guide following existing guide page structure
- FAQ section covering common redemption issues
- Link to Ubisoft redemption portal
- Schema: HowTo + FAQPage (same pattern as code guide)
- Title: "How to Redeem Invincible Guarding the Globe Codes — Step by Step"
- Update sitemap with new URL
- Add to all guide navigation menus
- Follow CONTEXT.md architecture: inline JSON configs, no fetch, works from file://

---

## Phase 4: Internal Linking & Anchor Text (Next Month)

### Task 4.1: Add Keyword-Rich Anchor Text

**Files:** All 8 HTML files
**What:** Replace generic anchor text ("View Guide", "Learn More") with keyword-rich anchors.
**Why:** Internal link anchor text is a relevance signal. "PvP League Guide" is stronger than "View Guide".
**Approach:**
- Audit all `<a>` tags between pages
- Replace generic text with descriptive, keyword-rich anchors
- Keep anchors natural (not stuffed)

### Task 4.2: Improve Existing Nav Link Anchor Text

**Files:** All 7 guide pages
**What:** The guide pages already have navigation links to other guides. Improve the anchor text on these existing links to be keyword-rich instead of generic.
**Why:** Improves crawl depth and distributes authority between pages without adding new HTML elements.
**Approach:**
- Audit existing `<a>` tags between guide pages
- Replace generic text ("View Guide", "Learn More") with descriptive anchors ("PvP League Guide", "Promo Codes Guide")
- Keep anchors natural (not keyword-stuffed)
- This is a targeted improvement of existing navigation, not adding new sections

---

## Phase 5: Technical Optimizations (Ongoing)

### Task 5.1: Fix Chart.js CLS

**Files:** `styles.css`, `index.html`
**What:** Add explicit dimensions to chart containers to prevent layout shift.
**Why:** Chart.js containers may shift when charts initialize, hurting CLS score.
**Approach:**
- Add `min-height` to chart container elements
- Add `will-change: transform` to chart wrappers
- Test on mobile viewport

### Task 5.2: Verify Publisher Name Consistency

**Files:** All 8 HTML files
**What:** Verify publisher/organization name is consistent across all schema. Currently "Gem Rewards Calculator" is used consistently — confirm no pages use a different name.
**Why:** Entity consistency helps Google understand the site as a single authoritative source.
**Approach:**
- Grep all HTML files for `publisher.name` and `Organization.name`
- Confirm all use "Gem Rewards Calculator" (the established brand)
- If any use a different name, standardize to "Gem Rewards Calculator"

### Task 5.3: Add `content-visibility: auto` to Below-Fold Sections

**Files:** `styles.css`
**What:** Use CSS `content-visibility: auto` on sections below the fold to improve rendering performance.
**Why:** Reduces initial paint work, improving FCP and LCP.
**Approach:**
- Add `content-visibility: auto` to guide content sections, footer, and chart sections
- Add `contain-intrinsic-size` for estimated dimensions
- Test for visual glitches

---

## Verification Checklist

After each phase, verify:

- [ ] Google Rich Results Test passes for all pages
- [ ] GSC re-crawl shows schema detected
- [ ] No CLS regressions (check PageSpeed Insights)
- [ ] All internal links work (no 404s)
- [ ] Sitemap updated with new pages
- [ ] All meta titles ≤60 chars
- [ ] All meta descriptions ≤155 chars
- [ ] Mobile tap targets ≥48x48px

---

## Success Metrics

| Metric | Current | 30-Day Target | 90-Day Target |
|--------|---------|---------------|---------------|
| Daily clicks | 6.6 | 10+ | 15+ |
| CTR | 3.60% | 4.5% | 5.5% |
| Rich results | 0 | FAQ on 3+ pages | FAQ on all pages |
| Avg position | 7.3 | 6.5 | 6.0 |
| Pages with clicks | 7 | 8 (new redeem page) | 8+ |
