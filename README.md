# anomaly-alpha.github.io

Gem rewards infographic for Invincible Guarding the Globe featuring interactive charts, mode filtering, hover interactions, and a sci-fi aesthetic matching the game's UI.

## Gem Summary

| Category | Gems | Notes |
|----------|------|-------|
| Event | 500 | The Long Haul (300) + Earth's Defenders (200) |
| PvP | ~1,850 | Varies with league/rank — Restricted Arena, Open Arena, Multiverse Alliance War (Elite II, rank 13 default) |
| Login | 1,393 | Daily (910) + Weekly (460) + Monthly (23) |
| Code | 300 | Promo code 30KGTG (tap to reveal, click to copy) |

**Total: ~4,043 gems/week** (varies with PvP selections)

> **Note:** Login breaks down as Daily 130×7=910, Weekly 60+400=460, Monthly 90÷4=23, totaling 1,393/week.

## Features

### Interactive Elements
- **Animated counter** that counts up on value changes (PvP selections, mode filtering)
- **Promo code reveal** — tap to reveal "30KGTG" with 3D flip animation, tap again to copy
- **Mode selector** — 5 buttons (All, Code, Event, PvP, Login) each showing gem total + countdown timer
- **Multi-select mode filtering** — toggle Event, PvP, Login, Code independently
- **Mode button hover** — hovering a mode button highlights all matching cards in that mode's color
- **Individual card hover** — cards highlight in their own category color (orange/pink/amber/green)
- **Charts toggle** — show/hide charts section with animated chevron
- **Card modals** — 9 cards each trigger an info modal via icon button (Escape to close)
- **Charts update** based on mode selection

### Card Modal System (9 cards, all icon-triggered)
All cards have an info icon button (top-right corner) that opens a modal with:
- Category-colored header with icon box
- Star badge (e.g., ★ Top 5%, ★ Weekly, ★ 30×7)
- Hero tagline (italic, large)
- Description paragraph
- Tips & Strategy section (yellow-tinted box with 5 tips)
- PvP cards show live gems, PvP Currency, Hero Shop Tickets, Totem Frags, and Modules from current league+rank selections
- Multiverse War modal includes demotion zone warning (reads from `pvp3-rank`)

| Card | Icon Color | Badge |
|------|-----------|-------|
| Promo Code | green (code) | ★ Tap to Reveal |
| The Long Haul | orange (event) | ★ Top 5% |
| Earth's Defenders | orange (event) | ★ Top 10% |
| Restricted Arena | pink (pvp) | ★ Weekly |
| Open Arena | pink (pvp) | ★ Weekly |
| Multiverse Alliance War | pink (pvp) | ★ 5 Matches / 2 Weeks |
| Daily Login | amber (login) | ★ 30×7 |
| Weekly Login | amber (login) | ★ 60+400=460 |
| Monthly Login | amber (login) | ★ 90÷4=23 |

### PvP Interactive Cards (3 cards)
- **League selector**: 14 options — Intern, Junior I–III, Intermediate I–III, Senior I–III, Elite I–III, Invincible
- **Rank selector**: 1–120 (per-league player counts in data)
- **Dynamic gems, PvP Currency, Tickets, Totem Frags, Modules** based on per-league payout tables
- **Restricted Arena**: gems + PvP Currency + Hero Shop Tickets
- **Open Arena**: gems + PvP Currency + Hero Shop Tickets
- **Multiverse Alliance War**: gems + Totem Fragments + Modules (6 league groups)
- **Demotion zone warning** at rank 86+ (Multiverse Alliance War card only)
- **localStorage persistence** per card
- **Clear button** to reset to defaults (Elite II, rank 13)

### Visual Effects
- Floating particles in background (9 particles, varied sizes/speeds)
- Corner decorations on main container
- Glow hover effects with category colors
- Grid background overlay
- Card fade-in animations (staggered 0–0.5s delays)

### Charts (3 in single row)
- **Distribution** — Doughnut chart, 4 category segments with mode colors
- **Rewards** — Bar chart, 1–4 bars based on selected modes, dynamic y.max
- **Performance** — Radar/spider chart, actual vs target (550, 2664, 360, 330)
- Rich hover tooltips with gems, %, vs average comparison
- Instant chart updates on filter changes (no animation overhead)
- Toggle show/hide via button

## File Structure

```
anomaly-alpha/
├── index.html           (1284 lines) — Main HTML + inline JSON configs (6 in <head>)
├── script.js            (1207 lines) — All JS: charts, filters, PvP, modals, countdowns
├── styles.css           (1342 lines) — CSS custom properties + BEM component classes
├── tailwind.css         — Generated Tailwind utility classes (657 lines, from npm run build)
├── package.json         — Dev dependencies config
├── tailwind.config.js   — Tailwind content paths config
├── src/
│   └── tailwind-input.css — Tailwind source with @tailwind directives
├── favicon.svg          — Custom cyan-to-pink gradient gem SVG
├── og-image.svg         — 1200×630 social sharing preview card
├── robots.txt           — Allows all crawlers, references sitemap
├── sitemap.xml          — 7 URLs (main + 6 guide pages)
├── AGENTS.md            — Agent instructions for this repo
├── README.md            — This file
├── googleeb60e8e5ee55440e.html — Google Search Console verification
├── guide/               — Topical cluster guide pages
│   ├── code/index.html  — Promo code guide (current code, redemption steps)
│   ├── event/index.html — Event rewards guide (The Long Haul, Earth's Defenders)
│   ├── pvp/index.html   — PvP guide (14 leagues, payout tables, 3 arena modes)
│   ├── login/index.html — Login rewards guide (daily, weekly, monthly breakdown)
│   ├── faq/index.html   — Gem rewards FAQ
│   └── beginners/index.html — New player guide
├── data/                — Source data files
│   ├── arena_payouts.txt     — Open + Restricted arena payout data
│   └── multiverse_war_payouts.txt — Multiverse War payout data
├── docs/
│   ├── DESIGN_SYSTEM.md  — CSS token reference
│   ├── index.md          — Feature documentation
│   └── plan/             — Historical plans and fix notes
```

## Usage

Run `npm install && npm run build` (one-time setup). Then open `index.html` in any browser — the page loads inline JSON configs embedded in the HTML, so it works directly from disk (`file://`) as well as via a local server.

## Design System

CSS custom property design tokens with BEM naming convention:
- **Category tokens**: `--gem-event` (#ff6b35), `--gem-pvp` (#e91e8a), `--gem-login` (#f39c12), `--gem-code` (#2ecc71), `--gem-cyan` (#00e5ff), `--gem-purple` (#9b59b6), `--gem-star` (#ffeb3b)
- **Card modifiers**: `.gem-card--event`, `.gem-card--pvp`, `.gem-card--login`, `.gem-card--code`
- **Label classes**: `.gem-label--event`, `.gem-label--pvp`, etc.
- **Text classes**: `.gem-text--event`, `.gem-text--pvp`, etc.
- **Shadow tokens**: `--gem-shadow--card`, `--gem-shadow--glow-cyan`, `--gem-shadow--glow-pink`, `--gem-shadow--gem`
- **Alert tokens**: `--gem-alert--danger-bg/border/text`, `--gem-alert--success-*`, `--gem-alert--info-*`
- **Hover highlight**: `--card-color` CSS variable per card for dynamic category-color hover effects
- **Info icon**: `.gem-card__info-btn` — circular icon button on every card, triggers modal
- **Modal badge**: `.gem-modal__badge--star` — yellow star badge in modal header
- Light mode via `:root.light-mode` token overrides

Full token reference: [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md)

## Tech Stack

- **Tailwind CSS** (local build via `npm run build`) — utility-first styling
- **Chart.js** 4.4.1 (doughnut, bar, radar charts) — updated via `chart.update('none')`, animations disabled
- **Font Awesome** 6.5.1 — icons
- **Rajdhani** font (Google Fonts) — consistent typography

## Recent Updates (May 2026)

### Core Architecture
- ✅ **Inline JSON configs** — 6 JSON configs embedded in `<head>` as `<script type="application/json">` tags (no fetch, works from file://)
- ✅ **14 PvP leagues** — Intern through Invincible (selectors + config)
- ✅ **7-tier rank system** — Ranks 1–120 with tier-based gems/cards/chips

### UI/UX Enhancements
- ✅ **Mode button hover highlight** — Cards highlight in category color when hovering mode buttons
- ✅ **Per-card hover color** — `--card-color` CSS variable dynamically set per card's data-category
- ✅ **Login cards unified** — All 3 login cards use `gem-card--login` (amber) — no more mixed purple/cyan
- ✅ **Mode selector gem icon** — Flexbox layout, gem icon + number side-by-side
- ✅ **Custom SVG favicon** — Cyan-to-pink gradient gem shape
- ✅ **Charts toggle** — Show/hide charts section with animated chevron
- ✅ **Card modals (9 cards)** — All cards trigger modal via info icon; modal has hero tagline, description, tips, live PvP data, demotion warning
- ✅ **Active mode selector opacity** — Toned down active mode button solid colors to be more transparent

### Data & Calculations
- ✅ **GAME.pvp structure** — 14 leagues with player counts, 3 arena payout tables (restricted, open, multiverse)
- ✅ **getPvpPayout(arena, leagueId, rank)** — Per-league payout table lookup instead of multiplier system
- ✅ **Real arena payout data** — Parsed from `data/arena_payouts.txt` with accurate per-league brackets
- ✅ **Real multiverse war data** — Parsed from `data/multiverse_war_payouts.txt` with 6 league groups
- ✅ **Restricted Arena**: 14 leagues with gems, PvP Currency, Hero Shop Tickets
- ✅ **Open Arena**: 14 leagues with gems, PvP Currency, Hero Shop Tickets  
- ✅ **Multiverse War**: 6 grouped leagues with gems, Totem Fragments, Modules
- ✅ **Spider chart targets** — (550, 2664, 360, 330)
- ✅ **PvP defaults** — Elite II, rank 13
- ✅ **Spider chart live updates** — Spider actuals recompute from live PvP form values via `getModeTotal('pvp')`; spider updates on PvP selector changes and mode toggles (matches distribution + rewards behavior)

### Performance Improvements
- ✅ **Removed search feature** — Eliminated most expensive JS operation (querySelectorAll per keystroke); removed HTML, CSS, and JS
- ✅ **Disabled chart animations** — All `chart.update('active')` changed to `'none'` for instant non-animated canvas redraws
- ✅ **CSS-driven countdown pulse** — Replaced JS class-toggle every 1s with pure CSS `infinite` animation
- ✅ **Reduced countdown interval** — 1000ms → 5000ms, cutting DOM writes 5×
- ✅ **GPU-optimized particles** — Added `will-change: transform` + `translate3d()` to particle CSS
- ✅ **Fixed PvP state persistence** — Removed wipe block; `savePageState()`/`loadPageState()` persist theme, modes, chart filter, visibility across reloads
- ✅ **Removed continuous animations** — 27 sparkle elements, rotating background, scanline, and 3 dead utility classes deleted; 37 → 9 continuous animations (9 particles only)
- ✅ **Inlined `@keyframes pulse`** — Header icon pulse no longer depends on Tailwind CDN
- ✅ **Removed floating controls** — Theme toggle, save/share menu, and export data buttons removed along with their JS functions

### Bug Fixes
- ✅ **Card hover shadow** — Hardcoded cyan values replacing undefined `var(--gem-shadow--card)`
- ✅ **Mode-highlight specificity** — `body ` prefix + `!important` to override `.gem-card--hover:hover`
- ✅ **modeTotals reassignment** — `Object.assign()` instead of trying to reassign `const`
- ✅ **getRewardsChartData GAME.ev** — Replaced with `REWARDS.categories.event.total`
- ✅ **Spider chart frozen actuals** — Replaced `totals.pvp` snapshot with `getModeTotal('pvp')` live call in `buildModeData`; `updatePvPCard` now calls `updateChartsByModes(selectedModes)` to propagate PvP changes to all 3 charts immediately
- ✅ **PvP card modal crash** — Fixed missing `arena` arg in `getPvpPayout()` + undefined `chips`/`cards` properties in `showCardModal` (May 3)
- ✅ **Weekly login payout** — Updated 60 → 460 gems (60 free + 400 from chests); propagated through config, cards, FAQ schema, and total counter (4043) (May 3)

### SEO & Content
- ✅ **Open Graph & Twitter tags** — 10 meta tags for rich social sharing previews
- ✅ **Canonical URL** — Self-referencing canonical on every page
- ✅ **Structured data** — WebPage + FAQPage + Person schema on main page; Guide + BreadcrumbList on detail pages
- ✅ **robots.txt & sitemap.xml** — Crawl directives and all 7 URLs submitted
- ✅ **og-image.svg** — 1200×630 social preview matching the gem theme
- ✅ **6 guide detail pages** — Code, event, PvP, login, FAQ, and beginners guides forming a topical cluster
- ✅ **Full internal linking** — 9 card guide links + bidirectional nav between all pages
- ✅ **Pre-filled PvP defaults** — Non-JS crawlers see real values (520 gems, 590 currency, 1 ticket for arenas; 810 gems, 26 frags, 2 modules for war)
- ✅ **Improved title & H1** — "Invincible Guarding the Globe — Gem Rewards & PvP Guide"
- ✅ **H1 game context** — Screen-reader-only prefix for keyword coverage

## Contributors

- Anomaly
- TheOneTruePanda
- dbp loves allen