# Daily Journal - May 5, 2026

## Session Summary

### Task
Fix mobile CLS issue when modes are changed — the total counter animation was incorrectly suspected.

### Root Cause
The total counter animation itself did **not** cause CLS (it has `tabular-nums` + `min-width: 5ch` + `inline-block`). The card visibility toggle (`display: none/block` in CSS Grid) caused the layout shift. But the 400ms counter animation ran **concurrently** with the card swap, making the timing look responsible.

### Investigation
- Interview-grilled the plan across 4 decision points
- Locked card collapse strategy (keep `display: none`, no space reservation — height change is acceptable)
- Locked counter width locking at `10ch` (from `5ch`) to accommodate max total (~4,193) with headroom
- Card `content-visibility` approach rejected (user confirmed height change is fine)
- JS min-height measurement approach rejected (too much wasted scroll space)

### Changes

#### 1. styles.css — Lock counter width
Changed `.gem-counter` `min-width: 5ch` → `min-width: 10ch`. Prevents the inline-block box from growing/shrinking as `animateValue()` writes intermediate values during the 400ms rAF loop (e.g. `500` → `4,193`).

#### 2. script.js — Reorder in filterCards()
Moved `a.forEach(...)` (card `display: none/block`) **before** `updateAllPageTotals()` so the card visibility change (layout shift) runs first, and the 400ms counter animation starts on a settled layout.

```diff
  updateModeButtonStates(),
- updateAllPageTotals(),
  a.forEach(e => {
      selectedModes.includes(t) ? e.style.display = "block" : e.style.display = "none"
  }),
+ updateAllPageTotals(),
```

### Files Modified
- `styles.css` — `min-width: 5ch` → `10ch` on `.gem-counter`
- `script.js` — reorder in `filterCards()`
- `CONTEXT.md` — added Counter CLS prevention and Animation timing entries under Performance Architecture
- `docs/index.md` — added bug fix entry under Recent Updates
- `journal/2026-05-05/index.md` — this file

---

## Session 2 — SEO Optimization + Copy Animation

### Tasks
1. SEO audit via seo-audit skill (sitemap, 404, on-page optimization)
2. Execute meta/title/H1 updates based on GSC keyword data
3. Add "Copied!" overlay animation to code chips
4. Update all .md files and docs

### GSC Data Summary
Top queries: "invincible guarding the globe codes" (pos 2.5), "invincible guarding the globe reward code" (pos 1), "invincible codes" (pos 5), "new invincible guarding the globe codes" (pos 4.75). All traffic is mobile.

### Audit Findings
- **Sitemap**: Added `<lastmod>` tags; code guide changefreq changed `monthly`→`weekly`
- **404.html**: Added `noindex`, removed self-referencing canonical
- **Headings**: All pages had proper H1→H2 structure
- **Internal linking**: Bidirectional nav across all 7 pages — good
- **Page speed**: Already excellent (LCP 0.6s, CLS 0.000)
- **HTTPS/Canonicals**: All verified correct

### Decisions Locked (via interview-grilling)
- **PvP page**: Added "Ranked Rewards" to title/meta + body sentence (targets "invincible vs ranked rewards" query at pos 9.5)
- **Code guide title**: Shortened to 50 chars "Invincible Guarding the Globe Codes — 26 Active Codes" (mobile-safe)
- **Copy animation**: `::after` overlay on chip using `gem-code--pop-in` animation
- **"New Codes" section**: Placed after hero, above redemption steps
- **Homepage title**: Swapped "PvP Guide" → "Promo Codes" to target #1 query group

### Changes Made

#### SEO meta/title tags
- **`guide/code/index.html`**: Title, meta desc, OG/Twitter, ld+json, breadcrumb, H1, hero subtitle, intro paragraph, added "New Invincible Guarding the Globe Codes" section, added "Last updated: May 5, 2026" freshness date
- **`guide/pvp/index.html`**: Title, meta desc, OG/Twitter, ld+json, added "ranked rewards" to body, footer link text
- **`index.html`**: Title, meta desc, OG/Twitter, ld+json WebPage name
- **Footer links**: Updated on faq, event, login, pvp guide pages

#### Sitemap + 404
- **`sitemap.xml`**: Added `<lastmod>` to all 7 URLs; code guide `weekly` changefreq
- **`404.html`**: Added `<meta name="robots" content="noindex">`, removed canonical

#### CSS copy animation
- **`styles.css`**: Added `position:relative;display:inline-block` to `.gem-code__chip`; added `.gem-code__chip.copied::after` overlay with "Copied!" text and `gem-code--pop-in` animation

#### Documentation
- `CONTEXT.md` — added SEO keyword note + sitemap config note
- `SEO_PLAN.md` — updated with executed state

### Files Modified
- `guide/code/index.html` — 12 changes (meta, H1, body, new section)
- `guide/pvp/index.html` — 5 changes (meta, body text, footer)
- `index.html` — 5 changes (title, meta, OG/Twitter, ld+json)
- `guide/faq/index.html` — footer link text
- `guide/event/index.html` — footer link text
- `guide/login/index.html` — footer link text
- `sitemap.xml` — lastmod + changefreq
- `404.html` — noindex, remove canonical
- `styles.css` — copy animation overlay
- `CONTEXT.md` — SEO + sitemap notes
- `SEO_PLAN.md` — executed state

### Commits
- (previous session: counter CLS fix)
- (this session) — seo: optimize meta tags for GSC keyword data + audit findings + copy animation

### Pending
- `npm run build` needs to be run on a machine with Node.js (not available in this environment)
- Build generates minified `tailwind.css` and minifies CSS/JS via csso + terser

### Commits
- (this session) — perf: prevent counter animation layout shift on mobile — lock width at 10ch + reorder card swap before animation
