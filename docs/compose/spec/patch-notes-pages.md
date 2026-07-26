---
feature: patch-notes-pages
status: delivered
updated: 2026-07-26
branch: feature/patch-notes
commits: 8b12c8c..HEAD
---

# Patch Notes Pages

## Report

**What was built** — Created a complete patch notes section with 27 pages: a hub page (`patch/index.html`) listing all 26 game updates from v1.1 to v3.4, plus 26 individual patch detail pages. Each patch page features a distinctive version badge (cyan glow for major versions), full content sections (New Content, Balancing Changes, Changed, Fixed Issues), breadcrumb navigation, and prev/next patch links. Added "Patch Notes" link to all 7 existing guide page nav bars. Updated sitemap.xml with 27 new URLs.

**Verification** — `npm run build` succeeded with no errors. All 27 patch HTML files generated correctly. CSS patch badge styles appended to styles.css.

**Journey log** — Used a Node.js generator script to create all 26 patch pages from a data array, avoiding manual HTML duplication. Fetched official patch notes from Ubisoft Helpshift for accurate content. The generator script (`scripts/generate-patch-pages.js`) can be re-run to update content if needed.

## [S1] Problem
The site has guide pages for codes, events, PvP, login, FAQ, beginners, and XP — but no patch notes section. Players need a reference for what changed in each game update, including new features, heroes, balancing changes, and bug fixes. All 26 official patches from v1.1 through v3.4 should be documented.

## [S2] Design

### Structure
- `patch/index.html` — main patch notes hub listing all patches chronologically (newest first)
- `patch/<version>/index.html` — individual patch detail pages (e.g., `patch/3.4/index.html`)

### Distinct Patch Element
Each patch page gets a **version badge** — a large, colored pill displaying the version number (e.g., "v3.4") with a subtle glow animation. This is the visual differentiator from guide pages. Color coding:
- Major versions (x.0): cyan accent (`#00e5ff`)
- Minor versions: white with subtle border

### Page Template (individual patch)
Follows the same HTML structure as guide pages:
- Same `<head>` pattern: meta tags, OG tags, canonical, structured data (Article schema), font preloads, tailwind.css + styles.css
- Same body classes: `relative min-h-screen p-5 md:p-10 gem-grid-bg`
- Same container: `gem-container gem-container__shadow max-w-4xl mx-auto` with corner decorations
- Same breadcrumb nav: Home > Patch Notes > [Version]
- Same guide nav bar linking to all other guides + patch index
- Same footer: contributors link + legal footer + back-to-top + script.js

### Content Sections (per patch page)
1. **Version badge** (distinct element) + patch title + date + reward code (if any)
2. **New Content** — bullet list of new features, heroes, artifacts, totems, case files, campaigns
3. **Balancing Changes** — hero/artifact/totem adjustments with before/after values
4. **Changed** — QoL improvements, UI changes
5. **Fixed Issues** — bug fixes
6. **Known Issues** — if any (from official notes)
7. **Related Patches** — links to previous/next patch

### Index Page (`patch/index.html`)
- Lists all 26 patches as cards, newest first
- Each card shows: version badge, date, reward code, 1-line summary
- Links to individual patch pages
- Same nav/footer as guide pages

### Patches to Create (26 total)
| Version | Date | Reward Code |
|---------|------|-------------|
| 3.4 | 2026-07-21 | GLOB34 |
| 3.3 | 2026-06-23 | IGTG33 |
| 3.2 | 2026-05-26 | FRIEND |
| 3.1 | 2026-04-14 | NOT3S1 |
| 3.0 | 2026-03-17 | PATCH3 |
| 2.14 | 2026-02-10 | TROPHY |
| 2.13 | 2026-01-13 | FILES3 |
| 2.12 | 2025-12-03 | — |
| 2.11 | 2025-10-28 | — |
| 2.10 | 2025-10-07 | — |
| 2.8 | 2025-08-19 | — |
| 2.6 | 2025-06-25 | — |
| 2.4 | 2025-05-06 | — |
| 2.2 | 2025-03-18 | — |
| 2.0 | 2025-02-11 | — |
| 1.8 | 2025-01-14 | — |
| 1.7 | 2024-12-17 | — |
| 1.6 | 2024-11-19 | — |
| 1.5 | 2024-10-01 | — |
| 1.4 | 2024-08-12 | — |
| 1.3.10 | 2024-07-18 | — |
| 1.3 | 2024-06-25 | — |
| 1.2.11 | 2024-05-23 | — |
| 1.2 | 2024-05-13 | — |
| 1.1.18 | 2024-04-09 | — |
| 1.1 | 2024-04-09 | — |

### SEO
- Each patch page gets: canonical, OG tags, Article schema, breadcrumbs
- Index page gets: WebPage schema, FAQ-style structure
- Add `patch/` section to sitemap.xml

### Integration
- Add "Patch Notes" link to the guide nav bar on all existing guide pages
- Add "Patch Notes" card to the related guides section at bottom of each guide page

## [S3] Out of Scope
- No dynamic data loading — all content is static HTML
- No JavaScript for patch filtering/search (keep simple)
- No OG images for individual patch pages (reuse existing or generate later)
- No automatic updates from external sources

## Tasks
- [x] T1: Create `patch/index.html` hub page listing all 26 patches — acceptance: page renders with all patch cards, links work (covers: S2)
- [x] T2: Create individual patch pages for v3.0–v3.4 (5 pages) — acceptance: each page has version badge, content sections, nav, footer (covers: S2; depends: T1)
- [x] T3: Create individual patch pages for v2.0–v2.14 (10 pages) — acceptance: each page renders correctly (covers: S2; depends: T1)
- [x] T4: Create individual patch pages for v1.1–v1.8 (11 pages) — acceptance: each page renders correctly (covers: S2; depends: T1)
- [x] T5: Add "Patch Notes" link to all existing guide page nav bars — acceptance: nav bar shows Patch Notes link on all 7 guide pages (covers: S2)
- [x] T6: Update sitemap.xml with all patch URLs — acceptance: sitemap contains 34 new URLs (covers: S2)
- [x] T7: Run `npm run build` and verify — acceptance: build succeeds, no regressions (covers: S2)
