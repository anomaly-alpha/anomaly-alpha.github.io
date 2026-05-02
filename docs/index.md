# Documentation

## Overview

Gem rewards infographic for Invincible Mobile Game featuring interactive charts, mode filtering, card modals, hover interactions, and a sci-fi aesthetic matching the game's UI.

## Gem Data (Current)

| Category | Gems | Description |
|----------|-----|-------------|
| Event Rewards | 500 | The Long Haul (300) + Earth's Defenders (200) |
| PvP | ~750 (varies) | Restricted Arena + Open Arena + Multiverse Alliance War (Elite II, rank 13 defaults) |
| Login Rewards | 293 | Daily (210) + Weekly (60) + Monthly (23) |
| Promo Code | 300 | Code: 30KGTG |

**Total: ~1,843 gems/week** (varies with PvP selections)

## Features

### Interactive Elements
- **Animated counter** that counts up on value changes
- **Promo code reveal** — tap to reveal with 3D flip animation, tap again to copy
- **Theme toggle** (dark/light mode) — fixed icon button top-right
- **Mode selector** (5 buttons: All, Code, Event, PvP, Login) — each showing gem total + countdown timer
- **Multi-select mode filtering** — toggle Event, PvP, Login, Code independently
- **Mode button hover** — hovering a mode button highlights all matching cards in that mode's color
- **Individual card hover** — each card highlights in its own category color using `--card-color` CSS variable
- **Charts toggle** — show/hide charts section
- **Search/Find** — expandable search bar with text highlighting
- **Save/Share menu** — Save views, load saved, copy share link, export as PNG
- **Export data as JSON**
- **Card modals** — 9 cards each open an info modal via icon button; modal shows hero tagline, description, tips, live PvP data (Escape to close)

### Card Modal System (9 cards)
Every card has a circular info icon button (top-right) that opens a modal containing:
- **Category-colored header** with info-circle icon in a colored box
- **Star badge** in modal title row (★ Top 5%, ★ Weekly, ★ 30×7, etc.)
- **Hero tagline** — large italic text
- **Description** — paragraph explaining the reward/event
- **Tips & Strategy** — yellow-tinted box with 5 bulleted tips
- **Live PvP data** — gems, cards, chips read from current form selections
- **Demotion warning** — Multiverse War modal shows safe/danger status based on pvp3-rank vs threshold 86

| Card | Category | Badge | Gems in modal |
|------|----------|-------|--------------|
| Promo Code | Code | ★ Tap to Reveal | 300 (static) |
| The Long Haul | Event | ★ Top 5% | 300 (static) |
| Earth's Defenders | Event | ★ Top 10% | 200 (static) |
| Restricted Arena | PvP | ★ Weekly | live from pvp1-league/rank |
| Open Arena | PvP | ★ Weekly | live from pvp2-league/rank |
| Multiverse Alliance War | PvP | ★ 5 Matches / 2 Weeks | live from pvp3-league/rank + demotion warning |
| Daily Login | Login | ★ 30×7 | 210 (static) |
| Weekly Login | Login | ★ Weekly | 60 (static) |
| Monthly Login | Login | ★ 90÷4 | 23 (static) |

### PvP Interactive Cards (3 cards)
- League selector (14 options: Intern through Invincible), default: Elite II
- Rank selector (1-120), default: rank 13
- Dynamic gems/cards/chips based on tier + league multiplier
- localStorage persistence per card
- Clear button to reset to defaults
- Demotion zone warning at rank 86+ (Multiverse Alliance War card only)

### Chart Interactions (3 charts)
- **Distribution (doughnut)** — 4 category segments with mode colors
- **Rewards (bar)** — 1-4 bars based on selected modes, dynamic y.max
- **Performance (radar)** — Spider chart showing actual vs target (550, 1500, 360, 330)
- Rich tooltips showing gems, percentage, vs average comparison
- Animated transitions on filter changes

### Visual Effects
- Floating particles in background (9 particles)
- Scanning line animation on header
- Rotating gradient on total section
- Corner decorations on main container
- Sparkle particles on cards
- Glow hover effects on cards
- Grid background overlay
- Card fade-in animations (staggered delays)

## Tech Stack

- **Structure**: `index.html` (857 lines), `styles.css` (1298 lines), `script.js` (1363 lines)
- **Styling**: Tailwind CSS (via CDN) + custom CSS design token system
- **Charts**: Chart.js (doughnut, bar, radar)
- **Export**: html2canvas for PNG export
- **Icons**: Font Awesome
- **Typography**: Rajdhani font (Google Fonts)
- **Data**: Inline JSON configs (6 configs embedded in `<head>`, source in `data/`)

## Design System

CSS custom property design tokens with BEM naming:
- Color tokens: `--gem-event` (#ff6b35), `--gem-pvp` (#e91e8a), `--gem-login` (#f39c12), `--gem-code` (#2ecc71), `--gem-cyan` (#00e5ff)
- Card modifiers: `.gem-card--event`, `.gem-card--pvp`, `.gem-card--login`, `.gem-card--code`
- Label classes: `.gem-label--event`, `.gem-label--pvp`, etc.
- Text classes: `.gem-text--event`, `.gem-text--pvp`, etc.
- Info icon: `.gem-card__info-btn` — circular icon button on every card
- Modal badge: `.gem-modal__badge--star` — yellow star badge
- Shadow tokens: `--gem-shadow--card`, `--gem-shadow--glow-cyan`
- Light mode: `:root.light-mode` with token overrides

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
- ✅ **Sparkle clusters around info button** — All 9 cards have 3-sparkle clusters around the info icon (top-right corner area) with staggered animation delays

### Data & Calculations
- ✅ **PvP defaults** — Elite II, rank 13 (user's actual settings)
- ✅ **Login total** — 293/week (210+60+23)
- ✅ **Spider chart targets** — (550, 1500, 360, 330)
- ✅ **GAME.pvp structure** — 14 leagues with `rankStart`/`rankEnd` fields
- ✅ **getPvpPayout** — Uses league multiplier + tier gems/cards/chips
- ✅ **Spider chart live updates** — Spider actuals recompute from live PvP form values via `getModeTotal('pvp')`; `updatePvPCard` calls `updateChartsByModes(selectedModes)` so all 3 charts update on every PvP selector change

### Bug Fixes
- ✅ **Card hover shadow** — Hardcoded values replacing undefined `var(--gem-shadow--card)`
- ✅ **Mode-highlight specificity** — `body ` prefix + `!important` to override `.gem-card--hover:hover`
- ✅ **modeTotals reassignment** — `Object.assign()` instead of `const` reassignment
- ✅ **getRewardsChartData GAME.ev** — Replaced with `REWARDS.categories.event.total`
- ✅ **Spider chart frozen actuals** — `buildModeData` now uses `getModeTotal('pvp')` live instead of `totals.pvp` snapshot; `updatePvPCard` triggers chart update so spider reflects current PvP selections immediately

## Contributors

- Anomaly
- TheOneTruePanda
- dbp loves allen