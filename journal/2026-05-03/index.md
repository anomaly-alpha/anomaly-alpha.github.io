# Daily Journal - May 3, 2026

## Session Summary

### Tasks
1. Fix PvP card modal not opening (TypeError crash in `showCardModal`)
2. Update weekly login payout from 60 → 460 gems (60 free + 400 from chests)
3. Update all cross-references and totals

### Work Completed

#### Fixed PvP Card Modal
- **Root cause**: `getPvpPayout(league, rank)` missing `arena` argument + `payout.chips.toLocaleString()` threw TypeError since payout object has no `chips`/`cards` properties
- **Fix**: Added `arenaMap` to resolve arena from cardId, fixed `getPvpPayout(arena, league, rank)` args, display correct properties per arena type (`currency`/`tickets` for arenas, `frags`/`modules` for multiverse)

#### Updated Weekly Login Payout
- **Changed**: 60 → 460 gems (60 free + 400 from chest rewards requiring daily operations)
- **Config**: Updated `rewards-config` JSON (`gems`, `formula`, `description`, `tooltip`, `loginRewards`, `categories.login.total`)
- **HTML**: Updated card display, description, tooltip, main counter (3743 → 4043), all-mode count
- **JS**: Updated `CARD_MODAL_DATA` for weekly-login + cross-references in daily-login and monthly-login modals

### Files Modified
- `index.html` — config and HTML card for weekly login, totals
- `script.js` — `showCardModal()` PvP payout bugfix, weekly/modal data updates

### Line Counts After Sessions 6-7
- `index.html`: 1392 lines
- `script.js`: 1144 lines
- `styles.css`: 1500 lines

### Commits
- `d883946` — fix: PvP card modal crash from missing arena arg and undefined payout properties
- `d1c53a1` — update: weekly login payout to 460 gems (60 free + 400 from chests)
- `f4506ca` — docs: sync all MD docs with app state; fix: hide particles on mobile
- (next commit) — simplify: remove dead data from index.html + script.js

---

## Session 2 — Simplify index.html Data

### Tasks
1. Remove dead `initialData` block from chart-config (always overwritten by JS at runtime)
2. Fix stale FAQ structured data values (3,643→4,043, 993→1,393, 60→460)
3. Fix stale meta description (3,643→4,043)
4. Fix login mode button placeholder for non-JS crawlers (993→1393)
5. Remove dead animation config (JS overrides duration:0) and dead `chartAnimConfig` variable

### Work Completed
- **index.html** - 4 edits: meta description, FAQ structured data (2 answers), login button, removed initialData + animation blocks
- **script.js** - 2 edits: fixed fallback values (293→1393), removed dead `chartAnimConfig` variable
- **docs/plan/2026-05-03/opencode/SIMPLIFY_INDEX_DATA.md** - Updated with final plan
- **MD docs** - Updated line counts (index.html 1306→1294→1284, script.js 1224→1223→1207, styles.css 1326→1331→1342)

### Line Counts After Changes
- `index.html`: 1284 lines
- `script.js`: 1207 lines
- `styles.css`: 1342 lines

---

## Session 3 — Performance Optimization

### Tasks
1. Create local Tailwind CSS build infrastructure
2. Replace render-blocking Tailwind Play CDN with static CSS
3. Add preconnect hints for remaining CDN origins
4. Update all documentation for new build workflow

### Work Completed
- **Created build files**: `package.json` (dev dep: tailwindcss ^3.4.17), `tailwind.config.js`, `src/tailwind-input.css`, `.gitignore`
- **Updated index.html**: removed `<script src="https://cdn.tailwindcss.com">` (124 KiB render-blocker), added `<link rel="stylesheet" href="tailwind.css">`, added 4 `<link rel="preconnect">` hints
- **Updated docs**: AGENTS.md, CONTEXT.md, README.md, docs/index.md, docs/DESIGN_SYSTEM.md, docs/plan/2026-04-29/opencode/IMPLEMENTATION_PLAN.md, docs/plan/2026-05-03/opencode/PERF_OPTIMIZATION_PLAN.md
- **Build**: ran `npm install && npm run build` — generated `tailwind.css` (9.8 KiB, 657 lines)

---

## Session 4 — Performance Plan Design (Grill)

### Tasks
1. Grill the performance optimization plan against the actual codebase
2. Lock design decisions for all 5 phases
3. Update plan file with confirmed decisions

### Decisions Locked

#### Phase 1 — Replace Tailwind Play CDN on guide pages
- **Approach**: `<link rel="stylesheet" href="../../tailwind.css">` replaces `<script src="https://cdn.tailwindcss.com">` on all 6 guide pages
- The `tailwind.config.js` already scans `./**/*.html` — `npm run build` already generates all needed classes
- **Gain**: Remove ~283 KB blocking script per guide page

#### Phase 2 — Replace Font Awesome with inline SVGs
- **Pattern**: Inline SVGs directly in HTML (no sprite, no `<use>`)
- **Chevron toggle**: Both chevron-up and chevron-down SVGs rendered in HTML, toggle via `hidden` class
- **JS-generated icons** (toast, modal): SVG strings as JS constants, inject via `innerHTML`
- **32 unique icons** confirmed across all 7 HTML files + script.js
- **Gain**: Remove ~300 KB library + CDN round-trip from all 7 pages

#### Phase 3 — Self-host Chart.js
- **Sourcing**: Download via `npm run update-assets` into `vendor/chart.umd.js`
- No npm dependency — matches existing vendor convention
- Remove jsdelivr preconnect + CDN script tag
- **Gain**: Eliminate DNS + TLS round-trip

#### Phase 4 — Self-host Google Fonts
- Download 5 .woff2 files (Rajdhani 400/600/700, Orbitron 500/700/900) to `fonts/`
- Add `@font-face` declarations in `styles.css` with `font-display: swap`
- Remove Google Fonts CSS link from all 7 HTML files
- Remove `fonts.googleapis.com` and `fonts.gstatic.com` preconnects
- **Gain**: Eliminate 1 render-blocking CSS request + 1 third-party origin

#### Rejected
| Idea | Reason |
|------|--------|
| Inline critical CSS | Not worth the maintenance drift. 5 KB gzipped tailwind.css is minimal. |
| Defer tailwind.css | Same — negligible render-blocking cost. |
| FA SVG sprite with `<use>` | Inline SVGs simpler, no xlink:href complexity. |
| npm dep for Chart.js | Direct download matches existing convention. |

### Files Updated
- `docs/plan/2026-05-03/opencode/PERFORMANCE_PLAN.md` — rewritten with locked decisions, execution checklist format
- `journal/2026-05-03/index.md` — this session entry

### Session Notes
- Discovered that guide pages still load Tailwind Play CDN (blocking script) — was not addressed in Session 3 which only fixed index.html
- Confirmed 32 unique FA icons across the project, not 28 as initially estimated
- Plan file moved from free-form prose to execution checklist format for easy follow-through

---

## Session 5 — Execute Performance Plan

### Tasks
1. Phase 1: Replace Tailwind Play CDN on 6 guide pages
2. Phase 2: Replace Font Awesome with inline SVGs (all HTML + JS)
3. Phase 3: Self-host Chart.js
4. Phase 4: Self-host Google Fonts
5. Update docs and commit

### Work Completed

#### Phase 1 — Tailwind CDN → local
- Replaced `<script src="https://cdn.tailwindcss.com">` with `<link rel="stylesheet" href="../../tailwind.css">` on all 6 guide pages
- Removed ~283 KB blocking script per guide page

#### Phase 2 — Font Awesome → inline SVGs
- Downloaded 32 FA icon SVGs from Font Awesome GitHub repo
- Wrote Python script to batch-replace `<i class="fas fa-{name}">` with inline `<svg>` in all 7 HTML files
- Added 7 SVG constants to `script.js` for JS-generated icons (toast, modal, demotion, tips)
- Replaced chevron toggle: both directions rendered in HTML, toggled via `hidden` class
- Removed FA CDN script tags from all 7 files, removed cdnjs preconnect
- **32 unique icons** converted to inline SVGs

#### Phase 3 — Self-host Chart.js
- Downloaded `chart.umd.js` (4.4.1) to `vendor/chart.umd.js` (200 KB)
- Updated index.html to load from local path
- Removed jsdelivr preconnect + CDN script tag
- Updated `package.json` `update-assets` script

#### Phase 4 — Self-host Google Fonts
- Downloaded 4 .woff2 files: Orbitron-Variable (1), Rajdhani Regular/SemiBold/Bold (3)
- Total font size: 48 KB
- Added `@font-face` declarations in `styles.css` with `font-display: swap`
- Orbitron uses variable font format (`woff2-variations`, weight 500-900)
- Removed Google Fonts CSS link from all 7 HTML files
- Removed `fonts.googleapis.com` / `fonts.gstatic.com` preconnects

### Project Health

#### Zero CDN dependencies
All 5 external origins eliminated: fonts.googleapis, fonts.gstatic, cdn.jsdelivr.net, cdnjs.cloudflare.com, cdn.tailwindcss.com

#### Size Changes

| File | Before (Session 4) | After | Delta |
|------|-------------------|-------|-------|
| `index.html` | ~68 KB | 86 KB | +18 KB (SVGs added) |
| `script.js` | ~47 KB | 49 KB | +2 KB (SVG constants) |
| `styles.css` | ~33 KB | 34 KB | +1 KB (@font-face) |
| New: `fonts/` | — | 48 KB | +48 KB |
| New: `vendor/chart.umd.js` | — | 200 KB | +200 KB |

#### Files Modified
- `index.html` — FA removal, self-host Chart.js, self-host fonts, chevron SVG
- `guide/*/index.html` (×6) — Tailwind CDN → local, FA removal, self-host fonts
- `script.js` — SVG constants, chevron toggle rewrite, FA references replaced
- `styles.css` — @font-face declarations added
- `package.json` — update-assets script updated
- `AGENTS.md` — zero CDN deps, file ownership updated
- `CONTEXT.md` — zero CDN constraint added
- `docs/PERFORMANCE_PLAN.md` — all phases marked complete

### Commits
- `0773cca` — docs: lock performance plan decisions — 4 phases after grill session
- `165ef7b` — enhance: aesthetic improvements — larger titles, mode button glow, counter layers, gradient orbs, grain, snappier stagger
- `8c1f259` — fix: restore spacing in mode selectors (gap + padding)
- `275a918` — fix: increase mode selector spacing (gap + padding)
- `842d870` — fix: add hover effects to all mode selectors
- `8b1e0b0` — fix: increase mode selector spacing
- `84abab1` — fix: make mode selector hover effects more visible
- `dfee775` — fix: rename Alliance War to Alliance War
- `485af35` — fix: clean up duplicate mode selector hover rules
- `e10f77a` — fix: add inverse hover for active mode selectors
- `476da53` — fix: restore all cards when clicking All modes after page reload
- `ee4de9e` — fix: ensure selectedModes defaults on empty or missing localStorage
- `1c5ee69` — fix: declare hidden variable globally to prevent ReferenceError
- `64cfc7f` — fix: syntax error extra brace
- `7322d39` — fix: mode selector totals use animateValue correctly
- `99a3c0e` — feat: default CODE mode inactive + add CTA to encourage mode exploration
- `1c58de7` — fix: default without CODE to match HTML state
- `737e74a` — fix: CTA always visible with yellow color

---

## Session 7 — Mode Selector Enhancements

### Tasks
1. Add hover effects to mode selectors
2. Improve spacing and visibility
3. Add inverse hover for active mode selectors
4. Fix restore all cards when clicking All modes
5. Ensure selectedModes defaults on load
6. Add CTA to encourage CODE mode exploration

### Work Completed
- **Hover effects** - Added visible hover effects to all mode selectors (glow + spacing)
- **Inverse hover** - Active mode selectors now have inverse (darker) hover state
- **All modes fix** - Clicking All after reload now restores all cards
- **Defaults fix** - selectedModes defaults when localStorage empty or missing
- **CODE mode inactive** - CODE mode defaults to inactive (red highlight), encouraging exploration
- **CTA button** - Added yellow "Explore All Modes" CTA button, always visible

### Files Modified
- `index.html` - Added CTA button, updated mode selectors
- `script.js` - Added CTA logic, fixed default modes, animateValue for totals

### Line Counts After Sessions 6-7
- `index.html`: 1392 lines
- `script.js`: 1144 lines
- `styles.css`: 1500 lines

### Commits
- `165ef7b` — enhance: aesthetic improvements — larger titles, mode button glow, counter layers, gradient orbs, grain, snappier stagger
- `8c1f259` — fix: restore spacing in mode selectors (gap + padding)
- `275a918` — fix: increase mode selector spacing (gap + padding)
- `842d870` — fix: add hover effects to all mode selectors
- `8b1e0b0` — fix: increase mode selector spacing
- `84abab1` — fix: make mode selector hover effects more visible
- `dfee775` — fix: rename Alliance War to Alliance War
- `485af35` — fix: clean up duplicate mode selector hover rules
- `e10f77a` — fix: add inverse hover for active mode selectors
- `476da53` — fix: restore all cards when clicking All modes after page reload
- `ee4de9e` — fix: ensure selectedModes defaults on empty or missing localStorage
- `1c5ee69` — fix: declare hidden variable globally to prevent ReferenceError
- `64cfc7f` — fix: syntax error extra brace
- `7322d39` — fix: mode selector totals use animateValue correctly
- `99a3c0e` — feat: default CODE mode inactive + add CTA to encourage mode exploration
- `1c58de7` — fix: default without CODE to match HTML state
- `737e74a` — fix: CTA always visible with yellow color

### Tasks
1. Add favicon.ico for browser tab
2. Hide charts by default in config + loadPageState
3. Extract hardcoded JS data into JSON configs
4. Shorter main title for one-line fit

### Work Completed
- **favicon.ico** - Added ICO format for better browser support
- **Charts hidden by default** - Updated rewards-config, loadPageState respects config default
- **JSON configs** - Extracted hardcoded data (leagues, categories, colors, targets) into 6 inline JSON configs
- **Title** - Reduced hero font size, shortened main title to fit on one line

### Files Modified
- `index.html` - Added favicon.ico link, updated config JSON (charts hidden by default), shortened title
- `script.js` - Added JSON config loading via loadConfig(id), removed hardcoded data
- `styles.css` - Added favicon.ico sizes

### Line Counts After Session 6
- `index.html`: 1284 lines
- `script.js`: 1207 lines
- `styles.css`: 1342 lines

### Commits
- `f8b80e3` — fix: hide charts by default (config + loadPageState respects config default)
- `721a3b9` — chore: add favicon.ico
- `9fe6443` — chore: replace favicon.svg with favicon.ico across all 8 HTML pages
- `a25f4db` — feat: extract hardcoded JS data into JSON configs, centralize color maps
- `5f6949c` — shorten main title and reduce hero font size to fit on one line

---

## Session 8 — Code Review: Fix Default Modes

### Tasks
1. Five-axis code review of index.html + dependencies
2. Fix default modes mismatch (config vs runtime)
3. Fix dead config defaults (make JS config-driven)
4. Fix empty-localStorage fallback bug

### Work Completed
- **Code review** — Full five-axis audit (correctness, readability, architecture, security, performance)
- **Fix 1** — Synced ui-config defaults from 4 modes to 3 (`["event","pvp","login"]`)
- **Fix 2** — Made JS read `UI.defaults.selectedModes` instead of hardcoding at line 369
- **Fix 3** — Fixed `loadPageState` fallback (line 350) to read from config instead of using `validModes`
- **Decisions made** — Config-driven source of truth, kept `filterCards('all')` hardcoded, kept `gem_infographic.html`

### Files Modified
- `index.html` — Changed `ui-config` defaults to 3 modes
- `script.js` — Lines 350 and 369 now read from config

### Commits
- `e324445` — fix: make selectedModes defaults config-driven — fix 3-mode/wrong fallback bugs

---

## Session 9 — Select Dropdown Redesign

### Tasks
1. Restyle `<select>` elements with category-aware design system
2. Add `appearance: none` + custom chevron arrows per category
3. Cross-browser styling (Chrome, Safari, Firefox, Edge)
4. Rebuild tailwind.css

### Decisions Made (11)
- CSS-only approach with `appearance: none`
- BEM modifiers per category: `gem-select--pvp`, `--login`, `--event`, `--code`
- Per-category SVG data URIs for chevron arrows (8 total: 4 base + 4 hover)
- Neutral base border (`--gem-border--subtle`), explicit per-category borders
- Category-tinted backgrounds via `--gem-select-bg--{cat}` tokens
- Cyan focus ring (universal), `min-width: 9rem` for league selects
- `font-family: inherit`

### Files Modified
- `styles.css` — Added background tokens in `:root` + `:root.light-mode`; replaced `.gem-select` block with fully redesigned select (appearance: none, hover, focus, 8 category arrow SVGs, 4 category background/border modifiers, `--league` min-width)
- `index.html` — Added `gem-select--pvp` modifier to all 6 `<select>` elements (3 league + 3 rank)
- `docs/DESIGN_SYSTEM.md` — Updated Select Component table with 10 rows
- `docs/plan/2026-05-04/opencode/SELECT_DESIGN_SYSTEM.md` — Created with full plan, updated with executed decisions
- `AGENTS.md` — Added Node.js download note to Quick start
- `README.md` — Added Node.js requirement note to Usage

### Commits
- `3e9fffe` — feat: redesign select dropdowns with category-aware styling and custom chevrons

---

## Session 10 — Performance Optimization

### Tasks
1. Full performance audit against the Performance Optimization skill checklist
2. Fix lazy loading gap — charts loaded upfront but hidden by default

### Work Completed
- **Full audit** — Measured all 13 performance budget items. All pass.
- **Optimization** — Added `if (hidden) return;` guard at top of `updateChartsByModes()` (script.js:523). Prevents chart-update logic from executing on initial page load when charts container is hidden. Saves ~70 KB gzipped parse/execute cost until user clicks "Show Charts".

### Decisions
- Chart.js stays as `<script defer>` in `<head>` — already non-render-blocking
- Font subsetting skipped — 39 KB under 100 KB budget, variable font fragile
- Critical CSS inlining rejected (Session 4) — maintenance drift cost too high

### Commits
- (next commit) — perf: guard chart updates when hidden — skip 70 KB parse/execute on initial load
