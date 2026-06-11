# Documentation

## Overview

Gem rewards infographic for Invincible Guarding the Globe featuring interactive charts, mode filtering, card modals, hover interactions, and a sci-fi aesthetic matching the game's UI.

## Gem Data (Current)

| Category | Gems | Description |
|----------|-----|-------------|
| Event Rewards | 500 | The Long Haul (300) + Earth's Defenders (200) |
| PvP | ~1,850 (varies) | Restricted Arena + Open Arena + Alliance War (Elite II, rank 13 defaults) |
| Login Rewards | 1,393 | Daily (910) + Weekly (460) + Monthly (23) |
| Promo Codes | Variable | 25 active codes (gems + tickets) |

**Total: ~4,043 gems/week** (varies with PvP selections)

## Features

### Interactive Elements
- **Animated counter** that counts up on value changes
- **Promo code reveal** — tap to reveal with 3D flip animation, tap again to copy
- **Scrolling ticker banner** ("Why Use This") — 44px monochrome newspaper-style ticker showing PvP 1,850+/wk • Codes 25 active • Login 1,393/wk • Events 500/wk • Total ~4,043/wk
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
- **Demotion warning** — Alliance War modal shows safe/danger status based on pvp3-rank vs threshold 86

| Card | Category | Badge | Gems in modal |
|------|----------|-------|--------------|
| Promo Code | Code | ★ Tap to Reveal | 300 (static) |
| The Long Haul | Event | ★ Top 5% | 300 (static) |
| Earth's Defenders | Event | ★ Top 10% | 200 (static) |
| Restricted Arena | PvP | ★ Weekly | live from pvp1-league/rank |
| Open Arena | PvP | ★ Weekly | live from pvp2-league/rank |
| Alliance War | PvP | ★ 5 Matches / 2 Weeks | live from pvp3-league/rank + demotion warning |
| Daily Login | Login | ★ 30×7 | 910 (static) |
| Weekly Login | Login | ★ 60+400=460 | 460 (static) |
| Monthly Login | Login | ★ 90÷4=23 | 23 (static) |

### PvP Interactive Cards (3 cards)
- League selector (14 options: Intern through Invincible), default: Elite II
- Rank selector (1-120), default: rank 13
- Dynamic gems, PvP Currency, Hero Shop Tickets, Totem Frags, Modules per per-league payout tables
- Restricted Arena + Open Arena: 14 leagues with gems, PvP Currency, Tickets
- Alliance War: 6 grouped leagues with gems, Totem Fragments, Modules
- localStorage persistence per card
- Clear button to reset to defaults
- Demotion zone warning at rank 86+ (Alliance War card only)

### Chart Interactions (3 charts)
- **Distribution (doughnut)** — 4 category segments with mode colors
- **Rewards (bar)** — 1-4 bars based on selected modes, dynamic y.max
- **Performance (radar)** — Spider chart showing actual vs target (550, 2664, 360, 330)
- Rich tooltips showing gems, percentage, vs average comparison
- Instant chart updates on filter changes (no animation overhead)

### Guide Pages (Topical Cluster)
- `/guide/code/` — Promo code guide: 25 active codes with click-to-copy (`copyCode()`), verification code redemption, 5 tips
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

- **Structure**: Main HTML + inline JSON configs, 6 guide pages
- **Styling**: Tailwind CSS (local build via npm) + custom CSS design token system
- **Charts**: Chart.js (doughnut, bar, radar) — self-hosted in `vendor/chart.umd.js`, lazy-loaded on first toggle
- **Icons**: Inline SVGs (32 icons, replaced Font Awesome)
- **Typography**: Rajdhani + Orbitron — self-hosted woff2 files in `fonts/`
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

## Improvement Plans

160 executable improvement plans at `docs/plan/2026-05-20/deepseek-v4-flash/` cover every aspect of the project:

| Category | Plans | Focus |
|----------|-------|-------|
| Architecture | 01-10 | Source maps, testing, PWA, CI/CD, linting |
| Content/SEO | 11-20, 71-80 | Guide audit, FAQ, breadcrumbs, structured data |
| UX | 21-30, 51-60 | Mobile, shortcuts, scroll-top, presets, profiles |
| Performance | 31-40, 61-70 | Fonts, Brotli, caching, container queries, code splitting |
| Features | 41-50, 148-150 | Battle pass, goals, export, recommender, campaign |
| Testing | 42-45, 79 | E2E, Lighthouse CI, axe-core, mobile-friendly |
| Accessibility | 81-90, 04, 44, 160 | WCAG 2.2, HCM, color blindness, SR announcements |
| DevOps | 91-100, 151-152 | Danger, Renovate, ADRs, depcheck, bundle viz |
| Security | 109-113 | CSP, Trusted Types, COOP/COEP, Permissions |
| Modern CSS | 114-120, 136-137 | @layer, @starting-style, :has(), light-dark(), @scope |
| Web APIs | 125-131, 145-147 | Web Share, Broadcast, Wake Lock, File System |
| PWA | 03, 127, 129, 135, 147 | Workbox, badges, window controls, SW strategy |
| Build | 132-133 | Biome, Lightning CSS |
| Code Quality | 46-48, 121-124 | JSDoc, magic numbers, AbortController, Error.cause |

## SEO Reports

Live SEO performance analysis from Google Search Console exports at `docs/reports/SEO_PERFORMANCE.md`. Updated periodically by running plan 162 (`docs/plan/2026-05-28/deepseek-v4-flash-free/162-gsc-export-analyzer.md`) against new GSC exports in `data/`.
## Contributors

- Anomaly
- TheOneTruePanda
- dbp loves allen
- Sy