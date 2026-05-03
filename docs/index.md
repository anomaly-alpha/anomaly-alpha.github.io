# Documentation

## Overview

Gem rewards infographic for Invincible Guarding the Globe featuring interactive charts, mode filtering, card modals, hover interactions, and a sci-fi aesthetic matching the game's UI.

## Gem Data (Current)

| Category | Gems | Description |
|----------|-----|-------------|
| Event Rewards | 500 | The Long Haul (300) + Earth's Defenders (200) |
| PvP | ~1,850 (varies) | Restricted Arena + Open Arena + Multiverse Alliance War (Elite II, rank 13 defaults) |
| Login Rewards | 1,393 | Daily (910) + Weekly (460) + Monthly (23) |
| Promo Code | 300 | Code: 30KGTG |

**Total: ~4,043 gems/week** (varies with PvP selections)

## Features

### Interactive Elements
- **Animated counter** that counts up on value changes
- **Promo code reveal** — tap to reveal with 3D flip animation, tap again to copy
- **Mode selector** (5 buttons: All, Code, Event, PvP, Login) — each showing gem total + countdown timer
- **Multi-select mode filtering** — toggle Event, PvP, Login, Code independently
- **Mode button hover** — hovering a mode button highlights all matching cards in that mode's color
- **Individual card hover** — each card highlights in its own category color using `--card-color` CSS variable
- **Charts toggle** — show/hide charts section
- **Card modals** — 9 cards each open an info modal via icon button; modal shows hero tagline, description, tips, live PvP data (Escape to close)

### Card Modal System (9 cards)
Every card has a circular info icon button (top-right) that opens a modal containing:
- **Category-colored header** with info-circle icon in a colored box
- **Star badge** in modal title row (★ Top 5%, ★ Weekly, ★ 30×7, etc.)
- **Hero tagline** — large italic text
- **Description** — paragraph explaining the reward/event
- **Tips & Strategy** — yellow-tinted box with 5 bulleted tips
- **Live PvP data** — gems, PvP Currency, Tickets, Totem Frags, Modules read from current form selections
- **Demotion warning** — Multiverse War modal shows safe/danger status based on pvp3-rank vs threshold 86

| Card | Category | Badge | Gems in modal |
|------|----------|-------|--------------|
| Promo Code | Code | ★ Tap to Reveal | 300 (static) |
| The Long Haul | Event | ★ Top 5% | 300 (static) |
| Earth's Defenders | Event | ★ Top 10% | 200 (static) |
| Restricted Arena | PvP | ★ Weekly | live from pvp1-league/rank |
| Open Arena | PvP | ★ Weekly | live from pvp2-league/rank |
| Multiverse Alliance War | PvP | ★ 5 Matches / 2 Weeks | live from pvp3-league/rank + demotion warning |
| Daily Login | Login | ★ 30×7 | 910 (static) |
| Weekly Login | Login | ★ 60+400=460 | 460 (static) |
| Monthly Login | Login | ★ 90÷4=23 | 23 (static) |

### PvP Interactive Cards (3 cards)
- League selector (14 options: Intern through Invincible), default: Elite II
- Rank selector (1-120), default: rank 13
- Dynamic gems, PvP Currency, Hero Shop Tickets, Totem Frags, Modules per per-league payout tables
- Restricted Arena + Open Arena: 14 leagues with gems, PvP Currency, Tickets
- Multiverse War: 6 grouped leagues with gems, Totem Fragments, Modules
- localStorage persistence per card
- Clear button to reset to defaults
- Demotion zone warning at rank 86+ (Multiverse Alliance War card only)

### Chart Interactions (3 charts)
- **Distribution (doughnut)** — 4 category segments with mode colors
- **Rewards (bar)** — 1-4 bars based on selected modes, dynamic y.max
- **Performance (radar)** — Spider chart showing actual vs target (550, 2664, 360, 330)
- Rich tooltips showing gems, percentage, vs average comparison
- Instant chart updates on filter changes (no animation overhead)

### Guide Pages (Topical Cluster)
- `/guide/code/` — Promo code guide: current code 30KGTG, redemption steps, 5 tips
- `/guide/event/` — Event rewards guide: The Long Haul + Earth's Defenders with full strategies
- `/guide/pvp/` — PvP guide: 14 leagues table, real payout tables, 3 arena modes with demotion zone
- `/guide/login/` — Login rewards guide: daily (910), weekly (460), monthly (23) with income summary table
- `/guide/faq/` — Gem rewards FAQ with FAQPage schema
- `/guide/beginners/` — New player guide with priority checklist and gem spending tips
- Each guide links to all 5 other guides + back to main page for topical relevance

### Visual Effects
- Floating particles in background (9 particles)
- Corner decorations on main container
- Glow hover effects on cards
- Grid background overlay
- Card fade-in animations (staggered delays)

## Tech Stack

- **Structure**: `index.html` (1284 lines), `styles.css` (1342 lines), `script.js` (1207 lines), 6 guide pages (1175 total)
- **Styling**: Tailwind CSS (local build via npm) + custom CSS design token system
- **Charts**: Chart.js (doughnut, bar, radar)
- **Icons**: Font Awesome
- **Typography**: Rajdhani font (Google Fonts)
- **Data**: Inline JSON configs (6 configs embedded in `<head>`, source in `data/`)

## Design System

CSS custom property design tokens with BEM naming:
- Category tokens: `--gem-event` (#ff6b35), `--gem-pvp` (#e91e8a), `--gem-login` (#f39c12), `--gem-code` (#2ecc71), `--gem-cyan` (#00e5ff), `--gem-purple` (#9b59b6), `--gem-star` (#ffeb3b)
- Card modifiers: `.gem-card--event`, `.gem-card--pvp`, `.gem-card--login`, `.gem-card--code`
- Label classes: `.gem-label--event`, `.gem-label--pvp`, etc.
- Text classes: `.gem-text--event`, `.gem-text--pvp`, etc.
- Alert tokens: `--gem-alert--danger/success/info` with bg/border/text variants
- Shadow tokens: `--gem-shadow--card`, `--gem-shadow--glow-cyan`, `--gem-shadow--glow-pink`, `--gem-shadow--gem`
- Info icon: `.gem-card__info-btn` — circular icon button on every card
- Modal badge: `.gem-modal__badge--star` — yellow star badge
- Light mode: `:root.light-mode` with full token override set

Full token reference: [docs/DESIGN_SYSTEM.md](DESIGN_SYSTEM.md)

## Accessibility

- Reduced motion support (`prefers-reduced-motion`)
- Keyboard-navigable buttons
- Sufficient color contrast
- Escape key closes modal

## Recent Updates (May 2026)

### Core Architecture
- ✅ **Inline JSON configs** — 6 JSON configs embedded in `<head>` as `<script type="application/json">` tags for file:// compatibility
- ✅ **Design token system** — CSS custom properties for all colors, shadows, and design values
- ✅ **BEM naming** — Semantic component classes
- ✅ **14 PvP leagues** — Intern through Invincible (updated selectors and config)
- ✅ **7-tier rank system** — Ranks 1-120 with tier-based gems/cards/chips

### UI/UX Enhancements
- ✅ **Mode button hover highlight** — Cards highlight in their category color when hovering mode buttons
- ✅ **Per-card hover color** — `--card-color` CSS variable dynamically set per card's data-category
- ✅ **Login cards unified** — All 3 login cards use `gem-card--login` (amber) instead of mixed purple/cyan
- ✅ **Mode selector gem icon** — Flexbox layout for side-by-side gem icon + number
- ✅ **Custom SVG favicon** — Cyan-to-pink gradient gem shape
- ✅ **Charts toggle** — Show/hide charts section with animated chevron
- ✅ **Card modals (9 cards)** — All cards trigger modal via info icon (`.gem-card__info-btn`); modal has hero tagline, description, tips, live PvP data, demotion warning; star badge in header; entry animation (pop-in)
- ✅ **Toned active mode buttons** — Active mode selector uses more transparent colors (30% bg, 65% border, subtle glow)

### Performance Improvements
- ✅ **Removed search feature** — Eliminated most expensive JS operation (querySelectorAll per keystroke); removed from HTML, CSS, and JS
- ✅ **Disabled chart animations** — All `chart.update('active')` changed to `'none'` for instant non-animated redraws (9 locations)
- ✅ **CSS-driven countdown pulse** — Replaced JS class-toggle every 1s with pure CSS `infinite` animation
- ✅ **Reduced countdown interval** — 1000ms → 5000ms
- ✅ **GPU-optimized particles** — `will-change: transform` + `translate3d()` avoids layout thrashing
- ✅ **Removed continuous animations** — 27 sparkle elements, rotating background gradient, scanline, 3 dead utility classes deleted; 37→9 continuous animations (9 particles)
- ✅ **Inlined `@keyframes pulse`** — Header icon pulse no longer depends on Tailwind CDN
- ✅ **PvP state persists** — Removed localStorage wipe block; `savePageState()`/`loadPageState()` preserve modes, chart filter, and charts visibility
- ✅ **Removed floating controls** — Theme toggle, save/share menu, and export data buttons removed along with their JS functions

### Data & Calculations
- ✅ **PvP defaults** — Elite II, rank 13 (user's actual settings)
- ✅ **Login total** — 1,393/week (910+460+23)
- ✅ **Spider chart targets** — (550, 2664, 360, 330)
- ✅ **Real arena payout data** — 14 per-league tables with gems + PvP Currency + Tickets (Restricted + Open)
- ✅ **Real multiverse war data** — 6 grouped leagues with gems + Totem Fragments + Modules
- ✅ **getPvpPayout(arena, leagueId, rank)** — Core function, reads per-league tables from `GAME.pvp.arenas` and `GAME.pvp.multiverse`
- ✅ **Spider chart live updates** — Spider actuals recompute from live PvP form values via `getModeTotal('pvp')`; `updatePvPCard` calls `updateChartsByModes(selectedModes)` so all 3 charts update on every PvP selector change

### Bug Fixes
- ✅ **Card hover shadow** — Hardcoded values replacing undefined `var(--gem-shadow--card)`
- ✅ **Mode-highlight specificity** — `body ` prefix + `!important` to override `.gem-card--hover:hover`
- ✅ **modeTotals reassignment** — `Object.assign()` instead of `const` reassignment
- ✅ **getRewardsChartData GAME.ev** — Replaced with `REWARDS.categories.event.total`
- ✅ **Spider chart frozen actuals** — `buildModeData` now uses `getModeTotal('pvp')` live instead of `totals.pvp` snapshot; `updatePvPCard` triggers chart update so spider reflects current PvP selections immediately
- ✅ **PvP card modal crash** — Fixed missing `arena` arg in `getPvpPayout()` + undefined `chips`/`cards` properties
- ✅ **Weekly login payout** — Updated 60 → 460 gems; propagated to config, cards, FAQ schema, total counter (4043); login total now 1,393

### SEO & Content
- ✅ **Open Graph & Twitter tags** — 10 meta tags for rich social sharing previews
- ✅ **Canonical URL** — Self-referencing canonical on every page
- ✅ **Structured data** — WebPage + FAQPage + Person schema on main page; Guide + BreadcrumbList on detail pages
- ✅ **robots.txt & sitemap.xml** — Crawl directives and all 7 URLs submitted
- ✅ **og-image.svg** — 1200×630 social preview matching the gem theme
- ✅ **6 guide detail pages** — Code, event, PvP, login, FAQ, and beginners guides forming a topical cluster
- ✅ **Full internal linking** — 9 card guide links + bidirectional nav between all pages
- ✅ **Pre-filled PvP defaults** — Non-JS crawlers see 520 gems, 590 currency, 1 ticket (arenas); 810 gems, 26 frags, 2 modules (war)
- ✅ **Improved title & H1** — "Invincible Guarding the Globe — Gem Rewards & PvP Guide"
- ✅ **H1 game context** — Screen-reader-only prefix for keyword coverage

## Contributors

- Anomaly
- TheOneTruePanda
- dbp loves allen