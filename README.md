# anomaly-alpha.github.io

Gem rewards infographic for Invincible Mobile Game featuring interactive charts, mode filtering, hover interactions, and a sci-fi aesthetic matching the game's UI.

## Gem Summary

| Category | Gems | Notes |
|----------|------|-------|
| Event | 500 | The Long Haul (300) + Earth's Defenders (200) |
| PvP | ~750 | Varies with league/rank — Restricted Arena, Open Arena, Multiverse Alliance War |
| Login | 293 | Daily (210) + Weekly (60) + Monthly (23) |
| Code | 300 | Promo code 30KGTG (tap to reveal, click to copy) |

**Total: ~1,843 gems/week** (varies with PvP selections)

## Features

### Interactive Elements
- **Animated counter** that counts up on value changes (PvP selections, mode filtering)
- **Promo code reveal** — tap to reveal "30KGTG" with 3D flip animation, tap again to copy
- **Theme toggle** — dark/light mode via fixed icon button (top-right)
- **Mode selector** — 5 buttons (All, Code, Event, PvP, Login) each showing gem total + countdown timer
- **Multi-select mode filtering** — toggle Event, PvP, Login, Code independently
- **Mode button hover** — hovering a mode button highlights all matching cards in that mode's color
- **Individual card hover** — cards highlight in their own category color (orange/pink/amber/green)
- **Charts toggle** — show/hide charts section with animated chevron
- **Search** — expandable search bar with text highlighting and match count
- **Save/Share menu** — Save views (localStorage), load saved, copy link, export as PNG
- **Export data as JSON**
- **Card modals** — 9 cards each trigger an info modal via icon button (Escape to close)
- **Charts update** based on mode selection

### Card Modal System (9 cards, all icon-triggered)
All cards have an info icon button (top-right corner) that opens a modal with:
- Category-colored header with icon box
- Star badge (e.g., ★ Top 5%, ★ Weekly, ★ 30×7)
- Hero tagline (italic, large)
- Description paragraph
- Tips & Strategy section (yellow-tinted box with 5 tips)
- PvP cards show live gems/cards/chips from current league+rank selections
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
| Weekly Login | amber (login) | ★ Weekly |
| Monthly Login | amber (login) | ★ 90÷4 |

### PvP Interactive Cards (3 cards)
- **League selector**: 14 options — Intern, Junior I–III, Intermediate I–III, Senior I–III, Elite I–III, Invincible
- **Rank selector**: 1–120
- **Dynamic gems/cards/chips** based on tier + league multiplier
- **Demotion zone warning** at rank 86+ (Multiverse Alliance War card only)
- **localStorage persistence** per card
- **Clear button** to reset to defaults (Elite II, rank 13)

### Visual Effects
- Floating particles in background (9 particles, varied sizes/speeds)
- Scanning line animation on header
- Rotating gradient on total section
- Corner decorations on main container
- Sparkle particles on cards
- Glow hover effects with category colors
- Grid background overlay
- Card fade-in animations (staggered 0–0.5s delays)

### Charts (3 in single row)
- **Distribution** — Doughnut chart, 4 category segments with mode colors
- **Rewards** — Bar chart, 1–4 bars based on selected modes, dynamic y.max
- **Performance** — Radar/spider chart, actual vs target (550, 1500, 360, 330)
- Rich hover tooltips with gems, %, vs average comparison
- Smooth animated transitions on filter changes
- Toggle show/hide via button

## File Structure

```
anomaly-alpha/
├── index.html           (857 lines) — Main HTML + inline JSON configs (6 in <head>)
├── script.js            (1363 lines) — All JS: charts, filters, PvP, modals, countdowns, search
├── styles.css           (1298 lines) — CSS custom properties + BEM component classes
├── favicon.svg          — Custom cyan-to-pink gradient gem SVG
├── PLAN_card_modals.md  — Card modal feature plan and implementation notes
├── README.md            — This file
├── data/                — Source JSON files (embedded in index.html)
│   ├── game-config.json     (14 leagues, 7 tiers, spider targets)
│   ├── rewards-config.json  (cards, categories, login rewards)
│   ├── chart-config.json    (colors, animation, tooltip)
│   ├── countdown-config.json (timer settings)
│   ├── ui-config.json       (layout, mode order)
│   └── theme-config.json    (design tokens)
└── docs/
    ├── index.md         — Feature documentation
    └── plan/
        ├── IMPLEMENTATION_PLAN.md    — Full technical specification
        ├── JSON_EXTRACTION_PLAN.md   — Data model definition
        └── [historical fix notes]
```

## Usage

Open `index.html` in any browser — no build step required. The page loads inline JSON configs embedded in the HTML, so it works directly from disk (`file://`) as well as via a local server.

## Design System

CSS custom property design tokens with BEM naming convention:
- **Color tokens**: `--gem-event` (#ff6b35), `--gem-pvp` (#e91e8a), `--gem-login` (#f39c12), `--gem-code` (#2ecc71), `--gem-cyan` (#00e5ff)
- **Card modifiers**: `.gem-card--event`, `.gem-card--pvp`, `.gem-card--login`, `.gem-card--code`
- **Label classes**: `.gem-label--event`, `.gem-label--pvp`, etc.
- **Text classes**: `.gem-text--event`, `.gem-text--pvp`, etc.
- **Shadow tokens**: `--gem-shadow--card`, `--gem-shadow--glow-cyan`
- **Hover highlight**: `--card-color` CSS variable per card for dynamic category-color hover effects
- **Info icon**: `.gem-card__info-btn` — circular icon button on every card, triggers modal
- **Modal badge**: `.gem-modal__badge--star` — yellow star badge in modal header
- Light mode via `:root.light-mode` token overrides

## Tech Stack

- **Tailwind CSS** (via CDN) — utility-first styling
- **Chart.js** 4.4.1 (doughnut, bar, radar charts)
- **html2canvas** 1.4.1 — PNG export
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
- ✅ **Login total corrected** — 293/week (210+60+23)
- ✅ **Card modals (9 cards)** — All cards trigger modal via info icon; modal has hero tagline, description, tips, live PvP data, demotion warning
- ✅ **Active mode selector opacity** — Toned down active mode button solid colors to be more transparent

### Data & Calculations
- ✅ **GAME.pvp structure** — 14 leagues with `rankStart`/`rankEnd` fields
- ✅ **getPvpPayout** — Uses league multiplier + tier gems/cards/chips
- ✅ **Spider chart targets** — (550, 1500, 360, 330)
- ✅ **PvP defaults** — Elite II, rank 13

### Bug Fixes
- ✅ **Card hover shadow** — Hardcoded cyan values replacing undefined `var(--gem-shadow--card)`
- ✅ **Mode-highlight specificity** — `body ` prefix + `!important` to override `.gem-card--hover:hover`
- ✅ **modeTotals reassignment** — `Object.assign()` instead of trying to reassign `const`
- ✅ **getRewardsChartData GAME.ev** — Replaced with `REWARDS.categories.event.total`

## Contributors

- Anomaly
- TheOneTruePanda
- dbp loves allen