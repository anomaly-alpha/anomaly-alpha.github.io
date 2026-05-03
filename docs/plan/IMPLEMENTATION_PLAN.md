# Invincible Guarding the Globe — Gem Rewards Infographic Implementation Plan

**Document Status:** Current (May 3, 2026)
**Total Gems:** ~4,043 (weekly calculation, varies with PvP)
**Implementation Status:** Complete

---

## 1. Project Overview

### 1.1 Purpose
Interactive infographic displaying gem reward sources from Invincible Guarding the Globe mobile game with interactive filtering, dynamic charts, PvP payout calculators (3 arena types with per-league tables), card modal system, guide pages, and a sci-fi aesthetic matching the game's UI.

### 1.2 Technology Stack

| Technology | Purpose | Version/CDN |
|------------|---------|-------------|
| HTML5 | Semantic structure | - |
| Tailwind CSS | Utility-first styling | cdn.tailwindcss.com |
| Chart.js | Interactive charts | 4.4.1 (jsdelivr) |
| Font Awesome | Icons | 6.5.1 (cdnjs) |
| Google Fonts | Rajdhani + Orbitron | - |

### 1.3 File Structure

```
anomaly-alpha/
├── index.html       (1284 lines) — Main infographic + inline JSON configs + SEO tags
├── script.js        (1207 lines) — All JavaScript, loads inline JSON configs
├── styles.css       (1342 lines) — Design tokens + BEM classes + animations
├── favicon.svg      — Custom gem SVG favicon
├── og-image.svg     — 1200×630 social sharing preview
├── robots.txt       — Crawl directives, sitemap reference
├── sitemap.xml      — 7 URLs (main + 6 guides)
├── googleeb60e8e5ee55440e.html — Google Search Console verification
├── AGENTS.md        — Agent instructions for this repo
├── CONTEXT.md       — Domain model, architecture summary
├── README.md        — Project overview
├── guide/           — Topical cluster guide pages (6)
│   ├── code/index.html      (176 lines) — Promo code guide
│   ├── event/index.html     (195 lines) — Event rewards guide
│   ├── pvp/index.html       (245 lines) — PvP guide (leagues, payout tables)
│   ├── login/index.html     (208 lines) — Login rewards guide
│   ├── faq/index.html       (170 lines) — Gem rewards FAQ
│   └── beginners/index.html (181 lines) — New player guide
├── data/            — Source payout data files
│   ├── arena_payouts.txt         — Open + Restricted arena payouts
│   └── multiverse_war_payouts.txt — Multiverse War payouts
├── docs/
│   ├── DESIGN_SYSTEM.md   — CSS token reference (461 lines)
│   ├── index.md           — Documentation index (178 lines)
│   └── plan/              — Historical plans and fix notes
├── journal/               — Development journal entries
│   ├── 2026-05-01.md      — Initial PvP cards, UI consolidation
│   ├── 2026-05-02.md      — Codebase cleanup, removed floating controls
│   └── 2026-05-03.md      — PvP modal fix, weekly login 60→460
└── advertising.md         — Ad placements documentation
```

---

## 2. Data Architecture

### 2.1 JSON Config System

Six JSON config files are maintained in `data/` directory and embedded inline in `index.html` `<head>` as `<script type="application/json">` tags. This approach avoids CORS issues when opening the page directly from disk (`file://`). A `loadConfig(id)` function retrieves embedded config content, and `loadAllConfigs()` is called at startup.

**Global config objects (script.js):**
- `GAME` - PvP leagues (14), rank tiers (7), spider targets, event definitions
- `REWARDS` - Card definitions, categories, login reward calculations, promo code
- `CHARTS` - Colors, labels, animation settings, tooltip config, initial chart data
- `COUNTDOWN` - Weekly/daily/event timer settings (hour, minute, offsetHours, daysOffset)
- `UI` - Mode order, grid layouts, animation delays, default selected modes
- `THEME` - Dark/light mode design tokens

**Config loading (script.js):**
```javascript
function loadConfig(id) {
  const el = document.getElementById(id);
  return el ? JSON.parse(el.textContent) : {};
}

let GAME, REWARDS, CHARTS, COUNTDOWN, UI, THEME;

function loadAllConfigs() {
  GAME = loadConfig('game-config');
  REWARDS = loadConfig('rewards-config');
  CHARTS = loadConfig('chart-config');
  COUNTDOWN = loadConfig('countdown-config');
  UI = loadConfig('ui-config');
  THEME = loadConfig('theme-config');
}
```

### 2.2 Categories (4 Modes)

| Mode | Icon | Color | Total | Calculation |
|------|------|-------|-------|-------------|
| **Event** | fa-dragon | #ff6b35 | 500 | The Long Haul (300) + Earth's Defenders (200) |
| **PvP** | fa-fist-raised | #e91e8a | ~1,850 | 3 interactive cards: Restricted (520) + Open (520) + Multiverse War (810) at Elite II rank 13 |
| **Login** | fa-sign-in-alt | #f39c12 | 1,393 | Daily (910) + Weekly (460) + Monthly (23) |
| **Code** | fa-gift | #2ecc71 | 300 | Promo code 30KGTG |

**Total: ~4,043 gems/week**

### 2.3 PvP League System

**Restricted + Open Arena (14 leagues, shared payout tables):**

| Key | Name | Players | Default Payout (rank 13) |
|-----|------|---------|--------------------------|
| intern | Intern | 500 | 80 gems, 550 currency |
| junior1 | Junior I | 300 | 120 gems, 550 currency |
| junior2 | Junior II | 285 | 160 gems, 560 currency |
| junior3 | Junior III | 260 | 200 gems, 560 currency |
| intermediate1 | Intermediate I | 235 | 240 gems, 560 currency |
| intermediate2 | Intermediate II | 215 | 280 gems, 570 currency |
| intermediate3 | Intermediate III | 195 | 320 gems, 570 currency |
| senior1 | Senior I | 175 | 360 gems, 580 currency |
| senior2 | Senior II | 160 | 400 gems, 580 currency |
| senior3 | Senior III | 145 | 440 gems, 580 currency |
| eliteI | Elite I | 130 | 480 gems, 590 currency |
| eliteII | Elite II | 120 | 520 gems, 590 currency |
| eliteIII | Elite III | 110 | 560 gems, 600 currency |
| invincible | Invincible | 100 | 600 gems, 600 currency |

Each league has 7 rank brackets (e.g., #1, #2, #3, #4-10, #11-30, #31-60, #61+) with specific gems + PvP Currency values. Hero Shop Tickets are awarded in Open Arena at higher leagues/ranks.

**Multiverse War (6 grouped leagues):**

| Group | Maps From | Gems (rank 13) | Totem Frags | Modules |
|-------|-----------|----------------|-------------|---------|
| intern | intern | 650 | 18 | 0 |
| junior | junior1, junior2, junior3 | 690 | 20 | 1 |
| intermediate | intermediate1, intermediate2, intermediate3 | 730 | 22 | 1 |
| senior | senior1, senior2, senior3 | 770 | 24 | 2 |
| elite | eliteI, eliteII, eliteIII | 810 | 26 | 2 |
| invincible | invincible | 850 | 28 | 3 |

**Payout lookup:** `getPvpPayout(arena, leagueId, rank)` reads per-league tables from `GAME.pvp.arenas` (restricted/open) and `GAME.pvp.multiverse` (6 groups). Rank 86+ triggers demotion warning.

### 2.4 Reward Cards (9 cards)

All 9 cards have an info icon button (`.gem-card__info-btn`) in the top-right corner that opens a card modal via `showCardModal(cardId)`.

| # | Name | Category | Gems | Modal badge | Notes |
|---|------|----------|------|-------------|-------|
| 1 | Promo Code | Code | 300 | ★ Tap to Reveal | Tap-to-reveal with 3D flip animation, click to copy |
| 2 | The Long Haul | Event | 300 | ★ Top 5% | Info icon opens modal |
| 3 | Earth's Defenders | Event | 200 | ★ Top 10% | Info icon opens modal |
| 4 | Restricted Arena | PvP | dynamic | ★ Weekly | Live gems + PvP Currency + Tickets from pvp1-league/rank |
| 5 | Open Arena | PvP | dynamic | ★ Weekly | Live gems + PvP Currency + Tickets from pvp2-league/rank |
| 6 | Multiverse Alliance War | PvP | dynamic | ★ 5 Matches / 2 Weeks | Live gems + Totem Frags + Modules from pvp3-league/rank; demotion warning |
| 7 | Daily Login | Login | 910 | ★ 30×7 | Info icon opens modal |
| 8 | Weekly Login | Login | 460 | ★ 60+400=460 | Info icon opens modal |
| 9 | Monthly Login | Login | 23 | ★ 90÷4=23 | Info icon opens modal |

### 2.5 Spider Chart Targets

| Axis | Actual | Target |
|------|--------|--------|
| Events | 500 | 550 |
| PvP | ~1,850 (live) | 2664 |
| Login | 1,393 | 360 |
| Code | 300 | 330 |

**PvP target (2664)** = max combined gems from all 3 PvP cards at Invincible league rank 1: 750 (Restricted) + 750 (Open) + 1000 (Multiverse War) = 2500, with an additional buffer for higher ranks. Represents the theoretical maximum weekly PvP income.

**Live updates:** Spider actual values recompute from live PvP form selectors via `getModeTotal('pvp')` in `buildModeData`. `updatePvPCard` calls `updateChartsByModes(selectedModes)` so spider (and all 3 charts) update immediately on any PvP selector change.

---

## 3. UI Structure

### 3.1 Mode Selector (index.html)

**5 buttons:** All → Code → Event → PvP → Login — each showing gem total and countdown timer.

**Hover interaction:** Hovering over a mode button highlights all matching cards with a colored glow in that mode's color. Implemented via mouseenter/mouseleave handlers adding `gem-card--mode-highlight--{mode}` class.

**Active state styling:** Active mode buttons use toned-down opacity (30% bg, 65% border, subtle 15px glow, scale 1.02) to avoid overwhelming solid colors.

### 3.2 Card Grid (index.html)

**Layout:** 1 column (mobile) → 2 columns (md) → 3 columns (lg)

```css
.gem-grid--cards { display: grid; grid-template-columns: repeat(1, 1fr); gap: 1.25rem; }
@media (min-width: 768px) { .gem-grid--cards { grid-template-columns: repeat(2, 1fr); } }
@media (min-width: 1024px) { .gem-grid--cards { grid-template-columns: repeat(3, 1fr); } }
```

**Card order (left to right, top to bottom):** Code, Event×2, PvP×3, Login×3

**Info icon:** Every card has `.gem-card__info-btn` — a circular button with `position: absolute; top: 0.75rem; right: 0.75rem;` inside the card body. Triggers `showCardModal(cardId)`.

### 3.3 Card Modal (index.html)

Single shared `cardModal` with dynamic content. Structure:
- `#cardModal` (replaces former `drilldownModal`)
- `#cardModalIcon` — colored box with fa-info-circle
- `#cardModalTitle` — uppercase title in category color
- `#cardModalBadge` — star badge (`.gem-modal__badge--star`, yellow)
- `#cardModalTotal` — gems line
- `#cardModalContent` — hero + description + demotion warning + tips
- Close via overlay click, × button, or Escape key

Modal width: 38rem. Content grows to fit (no max-height on body). Entry animation: pop-in (scale 0.9→1, 0.3s cubic-bezier).

### 3.4 Charts Section (index.html)

**3-column grid:** Distribution → Rewards → Performance

Toggle show/hide via "Hide Charts" button.

---

## 4. JavaScript Architecture

### 4.1 CARD_MODAL_DATA

All 9 card modal contents stored in a single `CARD_MODAL_DATA` object keyed by card ID. Each entry has: `category`, `title`, `gems` (null for dynamic PvP), `badge`, `hero`, `description`, `tips[]`.

### 4.2 showCardModal(cardId)

Reads from `CARD_MODAL_DATA[cardId]`:
- Sets icon box background/border color from category hex using `hexToRgb()`
- Sets title (uppercase) and badge (star style)
- For static cards: shows gem count
- For PvP cards: calls `getPvpPayout()` with current league/rank from form fields to show live gems/cards/chips
- For multiverse-war: adds demotion warning based on `pvp3-rank` vs `GAME.pvp.demotionThreshold`
- Renders hero tagline, description, tips section
- Shows modal with `.gem-modal--visible` class

### 4.3 closeCardModal()

Hides modal, restores body overflow.

### 4.4 hexToRgb(hex)

Converts hex color to `r, g, b` string for use in `rgba()` CSS values.

### 4.5 Initialization (DOMContentLoaded)

1. `loadAllConfigs()` — load all 6 JSON configs
2. `buildCountdownTargets()` — populate COUNTDOWN_TARGETS
3. Rebuild `chartFilterData`
4. Set `Chart.defaults` (color, borderColor)
5. Create charts (3: doughnut, bar, radar)
6. `initializePvPCards()` — rank option generation + localStorage load
7. Set `--card-color` CSS variable on each card
8. Attach mode button hover handlers
9. `loadPageState()` — restore theme, modes, chart filter, charts visibility from localStorage
10. `updateModeButtonStates()` + `updateAllPageTotals(true)` (skip animation on init)
11. `setInterval(updateCountdowns, 5000)`
12. `updateCountdowns()` — initial display
13. URL parameter parsing (overrides localStorage state)

### 4.6 Mode Filtering

```javascript
let selectedModes = ['event', 'pvp', 'login', 'code'];

function filterCards(category, evt) {
  if (category === 'all') {
    selectedModes = UI?.defaults?.selectedModes ? [...UI.defaults.selectedModes] : ['event', 'pvp', 'login', 'code'];
  } else {
    const modeIndex = selectedModes.indexOf(category);
    if (modeIndex > -1) selectedModes.splice(modeIndex, 1);
    else selectedModes.push(category);
    if (selectedModes.length === 0) selectedModes = ['event', 'pvp', 'login', 'code'];
  }
  updateModeButtonStates();
  updateAllPageTotals();
  cards.forEach(card => {
    card.style.display = selectedModes.includes(card.dataset.category) ? 'block' : 'none';
  });
  updateChartsByModes(selectedModes);
}
```

### 4.7 Card Hover Highlight System

Each card gets a `--card-color` CSS variable set dynamically from its `data-category`:

```javascript
const colorMap = { event: '#ff6b35', pvp: '#e91e8a', login: '#f39c12', code: '#2ecc71', cyan: '#00e5ff', purple: '#9b59b6' };
document.querySelectorAll('.gem-card').forEach(card => {
  const color = colorMap[card.dataset.category] || colorMap.cyan;
  card.style.setProperty('--card-color', color);
});
```

Hover effect uses `color-mix()` for dynamic color application:

```css
.gem-card--hover:hover {
  border-color: color-mix(in srgb, var(--card-color) 60%, transparent) !important;
  box-shadow: 0 0 20px color-mix(in srgb, var(--card-color) 40%, transparent), 0 8px 32px rgba(0, 0, 0, 0.3);
}
```

Mode button hover adds `gem-card--mode-highlight--{mode}` class to matching cards.

### 4.8 Chart Data Functions

**buildModeData(mode, totals)** — returns `{ distribution, rewards, spider, colors, rewardColors }` for chartFilterData lookup.

**getRewardsChartData(modes)** — returns `{ labels, data, colors }` for bar chart.

### 4.9 PvP Payout Calculation

```javascript
function getPvpPayout(arena, leagueId, rank) {
  if (arena === 'multiverse') {
    const groupMap = { intern:'intern', junior1:'junior', ..., elite:'elite', invincible:'invincible' };
    const group = groupMap[leagueId];
    const tier = GAME.pvp.multiverse[group].find(t => rank >= t.rankStart && rank <= t.rankEnd);
    return { gems: tier.gems, frags: tier.frags, modules: tier.modules, isDemotion };
  }
  const tier = GAME.pvp.arenas[arena][leagueId].find(t => rank >= t.rankStart && rank <= t.rankEnd);
  return { gems: tier.gems, currency: tier.currency, tickets: tier.tickets || 0, isDemotion };
}
```

Three arenas: `'restricted'` (card 1), `'open'` (card 2), `'multiverse'` (card 3). Per-league payout tables stored in `GAME.pvp.arenas` and `GAME.pvp.multiverse`. Multiverse uses 6 grouped leagues with frags/modules instead of currency/tickets.

### 4.10 Countdown System

`COUNTDOWN_TARGETS` built at runtime via `buildCountdownTargets()` from COUNTDOWN config. Four timers: weekly (next Sunday 8pm EST), daily (8pm EST), cecilNightmares (3 days from now), multiverseArena (30 days from now).

---

## 5. CSS Design System

### 5.1 Design Tokens

CSS custom properties for all colors, backgrounds, borders, text, shadows, buttons, modals, tooltips, and fonts.

Category tokens:
```css
:root {
  --gem-event: #ff6b35;    /* orange */
  --gem-pvp: #e91e8a;      /* pink */
  --gem-login: #f39c12;    /* amber */
  --gem-code: #2ecc71;     /* green */
  --gem-cyan: #00e5ff;     /* cyan accent */
  --gem-purple: #9b59b6;   /* purple */
  --gem-star: #ffeb3b;     /* badge/tips yellow */
}
```

Background tokens:
```css
--gem-bg-dark: #050a14;   /* dark mode base */
--gem-bg-mid: #0a1628;    /* dark mode container */
--gem-bg-light: #0d1f3c;  /* dark mode elevated */
```

Alert tokens (complete set per variant):
```css
--gem-alert--danger-bg: rgba(239, 68, 68, 0.20);
--gem-alert--danger-border: rgba(239, 68, 68, 0.50);
--gem-alert--danger-text: #ef4444;
--gem-alert--success-bg: rgba(46, 204, 113, 0.20);
--gem-alert--success-border: rgba(46, 204, 113, 0.30);
--gem-alert--success-text: #2ecc71;
--gem-alert--info-bg: rgba(0, 229, 255, 0.20);
--gem-alert--info-border: rgba(0, 229, 255, 0.30);
--gem-alert--info-text: #00e5ff;
```

Shadow tokens:
```css
--gem-shadow--card: 0 15px 40px rgba(0, 229, 255, 0.3), 0 0 60px rgba(0, 229, 255, 0.1);
--gem-shadow--glow-cyan: 0 0 20px rgba(0, 229, 255, 0.5);
--gem-shadow--glow-pink: 0 0 20px rgba(233, 30, 138, 0.5), inset 0 0 15px rgba(255, 255, 255, 0.3);
--gem-shadow--gem: 0 0 30px rgba(233, 30, 138, 0.6);
```

Full token reference: [docs/DESIGN_SYSTEM.md](../DESIGN_SYSTEM.md)

### 5.2 BEM Component Classes

| Component | Block | Elements | Modifiers |
|-----------|-------|----------|-----------|
| Card | `.gem-card` | `__body`, `__divider`, `__info-btn` | `--event`, `--pvp`, `--login`, `--code`, `--hover`, `--fade-in`, `--delay-N`, `--mode-highlight--*` |
| Label | `.gem-label` | - | `--event`, `--pvp`, `--login`, `--code`, `--cyan` |
| Mode Button | `.gem-mode-btn` | `__icon`, `__count`, `__label`, `__countdown` | `--all`, `--event`, `--pvp`, `--login`, `--code` |
| Chart | `.gem-chart` | `__title` | - |
| Toast | `.gem-toast` | - | `--success`, `--error`, `--info` |
| Modal | `.gem-modal` | `__overlay`, `__content`, `__header`, `__body`, `__footer`, `__icon-box`, `__title`, `__total`, `__badge`, `__close` | `--visible` |
| Modal badge | `.gem-modal__badge` | - | `--star` |
| Modal content | `.gem-modal__hero`, `.gem-modal__body-text` | - | - |
| Tips | `.gem-modal__tips` | `__header` | - |
| Demotion | `.gem-modal__demotion-warning` | - | `--safe` |

### 5.3 Light Mode

`:root.light-mode` overrides background colors, text colors, borders, card backgrounds, and button/modal tokens for a light theme. Toggle adds `light-mode` class to `<body>`.

Key light mode differences:
- Backgrounds: dark grays → light grays
- Text: white with opacity → dark slate with opacity
- Card backgrounds: category-colored translucent → cyan-tinted translucent
- Button/modal: adjusted for light surface contrast

---

## 6. Feature Specifications

### 6.1 Mode Filtering
- Toggle individual modes (Event, PvP, Login, Code) on/off
- "All" button selects all 4 modes
- At least 1 mode must remain selected
- Charts and totals update on each toggle

### 6.2 Mode Button Hover Highlight
- Hover over mode button → matching cards get highlighted with that mode's color
- `mouseenter` adds `gem-card--mode-highlight--{mode}`
- `mouseleave` removes all mode-highlight classes
- All-mode highlights every card in cyan

### 6.3 Individual Card Hover
- Each card has `--card-color` CSS variable set from its category
- Hover uses `color-mix()` to apply category color to border and box-shadow

### 6.4 Dynamic Total Counter
- `animateValue(elementId, newValue, duration)` with ease-out quad easing
- Updates main counter and all mode button counts
- Triggered by PvP selection changes or mode filtering

### 6.5 Charts (3 charts)
- **Distribution (doughnut):** 4 segments (Events, PvP, Login, Code) with mode colors
- **Rewards (bar):** 1-4 bars based on selected modes, mode colors, dynamic y.max
- **Performance (radar):** Actual vs Target spider chart with cyan/pink colors
  - Actual values recompute live from `getModeTotal('pvp')` (not cached snapshots)
  - Updates immediately on PvP selector change (via `updatePvPCard` → `updateChartsByModes`)
  - Targets always show all 4 reference lines regardless of mode filter
  - Combined actuals from `chartFilterData[mode].spider[0]` per active mode when toggling modes
- Toggle show/hide via button

### 6.6 Promo Code Reveal
- First tap: 3D flip animation reveals "30KGTG" with pulsing glow
- Second tap: copies to clipboard with scale-pop animation

### 6.7 Card Modal System (9 cards)
- Every card has `.gem-card__info-btn` (circular icon button, top-right)
- Click opens `#cardModal` with dynamic content per card ID
- Modal header: colored icon box + title (uppercase) + star badge
- Body: hero tagline (italic) + description + tips section
- PvP cards show live gems, PvP Currency, Hero Shop Tickets, Totem Frags, and Modules from current form selections
- Multiverse War adds demotion zone warning (red if rank≥86, green if safe)
- Close via overlay click, × button, or Escape key
- Entry animation: pop-in scale effect

### 6.8 Charts Toggle
- Show/hide charts section via toggle button
- Icon rotates (chevron up/down)

### 6.9 Countdown Timers
- 4 timers: weekly, daily, cecilNightmares, multiverseArena
- Per-mode display (only show countdown for active modes)
- Pulse animation on second change

### 6.10 PvP Cards (3 cards)
- League selector (varies by card): Restricted/Open use 14 leagues; Multiverse uses 6 grouped leagues (Intern/Junior/Intermediate/Senior/Elite/Invincible)
- Rank selector: 1-120 (dynamically generated options)
- Clear button to reset to defaults
- Demotion zone warning at rank 86+ (Multiverse only)
- localStorage persistence per card

---

## 7. URL Parameters

| Param | Values | Effect |
|-------|--------|--------|
| theme | light, dark | Apply light-mode class |
| mode | all, event, pvp, login, code | Filter cards on load |
| chart | all, event, pvp, login, code | Filter charts on load |

Example: `index.html?theme=dark&mode=pvp&chart=event`

---

## 8. localStorage Keys

| Key | Format | Purpose |
|-----|--------|---------|
| `pvp{N}_league` | Arena league ID | PvP card N league |
| `pvp{N}_rank` | 1-120 | PvP card N rank |
| `gem_theme` | light/dark | Theme preference |
| `gem_modes` | JSON array | Selected mode filters |
| `gem_chartFilter` | string | Active chart filter |
| `gem_chartsVisible` | boolean | Charts section visibility |

---

## 9. Animations

| Animation | Duration | Easing | Usage |
|-----------|----------|--------|-------|
| gem-fade-in | 0.6s | ease-out | Card entrance |
| gem-code--reveal | 0.8s | cubic-bezier(0.34, 1.56, 0.64, 1) | Code reveal |
| gem-code--glow | 2s | ease-in-out | Code glow pulse (infinite) |
| gem-code--fade-in | 0.5s | ease-out | Copy hint appear |
| gem-float-particle | 15s | linear | Background particles (infinite) |
| gem-countdown-pulse | 1s | ease-out infinite | Countdown second tick (CSS-only) |
| gem-modal--pop-in | 0.3s | cubic-bezier(0.34, 1.56, 0.64, 1) | Modal entry |

---

## 10. Out of Scope / Removed

The following were in older versions but are NOT in current implementation:
- Season category (removed)
- Warfare category (merged into PvP)
- 4-chart layout (only 3 charts now)
- Chart filter buttons below charts
- Gem Calculator section
- Line chart (Progress)
- Legend section
- Summary info box
- External JSON file loading via fetch (reverted to inline due to file:// CORS)
- Drill-down modal (replaced by cardModal system)
- Search feature (removed for performance)
- 27 sparkle particle elements on cards (removed for performance)
- Rotating background gradient animation on total section (removed for performance)
- Scanline animation (removed)
- Theme toggle floating button (removed)
- Save/share menu and export data buttons (removed)

---

## 11. Files Summary

| File | Lines | Purpose |
|------|-------|---------|
| index.html | 1284 | HTML + inline JSON configs (6 in head) + SEO tags + structured data |
| script.js | 1207 | All JS: charts, filters, PvP, modals, countdowns |
| styles.css | 1342 | CSS custom properties, BEM components, animations |
| guide/code/index.html | 176 | Promo code guide page |
| guide/event/index.html | 195 | Event rewards guide page |
| guide/pvp/index.html | 245 | PvP guide page with payout tables |
| guide/login/index.html | 208 | Login rewards guide page |
| guide/faq/index.html | 170 | Gem rewards FAQ page |
| guide/beginners/index.html | 181 | New player guide page |

### 11.1 SEO Infrastructure

| File | Purpose |
|------|---------|
| robots.txt | Crawl directives, sitemap reference |
| sitemap.xml | 7 URLs (main + 6 guides) |
| og-image.svg | 1200×630 social sharing preview |
| googleeb60e8e5ee55440e.html | Google Search Console verification |

### 11.2 Structured Data

| Page | Schema Types |
|------|-------------|
| index.html | WebPage, FAQPage, Person |
| guide/*/index.html | Guide, BreadcrumbList |
| guide/faq/index.html | FAQPage |

---

## 12. Development Journal

### 2026-05-03 — PvP Modal Fix & Weekly Login Update

**Tasks:** Fix PvP card modal not opening (TypeError), update weekly login 60→460.

**Changes:**
- **PvP Modal Fix:** `getPvpPayout(league, rank)` missing `arena` arg + `payout.chips.toLocaleString()` threw TypeError (no `chips`/`cards` on payout object). Added `arenaMap` from cardId, fixed to `getPvpPayout(arena, league, rank)`, display correct per-arena properties (`currency`/`tickets` for arenas, `frags`/`modules` for multiverse).
- **Weekly Login:** Updated `rewards-config` JSON (`gems: 460`, `formula`, `description`, `tooltip`), `loginRewards` array, `categories.login.total: 1393`. Propagated to card display, main counter (3743→4043), all-mode total. Updated `CARD_MODAL_DATA`.

**Files:** `index.html`, `script.js` — 2 commits.

---

### 2026-05-02 — Codebase Cleanup

**Tasks:** Remove scanline animation, remove floating controls (theme toggle, export data, save/share menu), update documentation.

**Changes:**
- **Removed scanline:** `.gem-scanline` div from HTML, CSS rule and `@keyframes gem-scanline` from styles.css. Continuous animations: 10→9.
- **Removed floating controls:** Theme toggle (`fa-moon`/`fa-sun`), export data (`fa-download`), save/share menu (`fa-save` dropdown). Removed 8 JS functions: `toggleTheme`, `toggleSaveMenu`, `saveCurrentView`, `loadSavedView`, `shareLink`, `showToast`, `exportAsImage`, `exportData`, `closeDrillDown`. Removed `#themeIcon` refs from `loadPageState` and URL param handler. Removed `gem_theme` save from `savePageState`.
- **Updated docs:** README, docs/index, IMPLEMENTATION_PLAN, DESIGN_SYSTEM.

**Line counts after:** index.html=818, script.js=1184, styles.css=1266 (approximately — grown since).

---

### 2026-05-01 — PvP Cards & UI Consolidation (Multiple Sessions)

**Sessions:** ~9 sessions over 8 hours.

**Phase 1 — PvP Cards:**
- Replaced 3 static season cards with interactive PvP cards (Restricted Arena, Open Arena, Multiverse Alliance War)
- Added `getPvpPayout()`, `generateRankOptions()`, `animateValue()`, `updatePvpCard()`, `savePvpSelection()`/`loadPvpSelection()`, `clearPvpSelection()`, `initializePvPCards()`
- Rank 1-120 selectors, league selectors (14 leagues for arenas, 6 groups for multiverse), demotion zone at rank 86+

**Phase 2 — UI Consolidation:**
- Removed Gem Calculator, Season filter, Warfare category (merged into PvP)
- Removed chart filter buttons, legend, summary info box
- Unified mode selector buttons (5: All, Code, Event, PvP, Login) with gem totals + countdowns

**Phase 3 — Refinements:**
- Multi-select mode filtering with `selectedModes` array
- PvP default values to Elite II, rank 13
- Card reordering (Event→PvP→Login→Code)
- Consolidated GAME data structure
- Daily login 100→30 gems, color standardization to mode colors
- Fixed `getModeTotal('pvp')` returning 0 (eventsByMode lacked 'pvp' key)
- Card layout restructure (gem payout at top, selectors at bottom)
- Removed duplicate PvP card, percent badges
- Login rewards total fix (980→1843)
- Dynamic mode totals from eventsByMode

**Files modified:** `gem_infographic.html` (later → `index.html`), README, docs.