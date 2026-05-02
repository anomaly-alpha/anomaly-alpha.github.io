# Invincible Gem Rewards Infographic - Implementation Plan

**Document Status:** Current (May 2, 2026)
**Total Gems:** ~1,843 (weekly calculation, varies with PvP)
**Implementation Status:** Complete

---

## 1. Project Overview

### 1.1 Purpose
Interactive infographic displaying gem reward sources from the Invincible mobile game with interactive filtering, dynamic charts, mode hover interactions, card modal system, and a sci-fi aesthetic matching the game's UI.

### 1.2 Technology Stack

| Technology | Purpose | Version/CDN |
|------------|---------|-------------|
| HTML5 | Semantic structure | - |
| Tailwind CSS | Utility-first styling | cdn.tailwindcss.com |
| Chart.js | Interactive charts | 4.4.1 (jsdelivr) |
| html2canvas | PNG export | 1.4.1 (hertzen) |
| Font Awesome | Icons | 6.5.1 (cdnjs) |
| Google Fonts | Rajdhani font | - |

### 1.3 File Structure

```
anomaly-alpha/
├── index.html       (857 lines) - Main infographic + inline JSON configs
├── script.js        (1363 lines) - All JavaScript, loads inline JSON configs
├── styles.css       (1298 lines) - Design tokens + BEM classes
├── favicon.svg      - Custom gem SVG favicon
├── PLAN_card_modals.md - Card modal feature plan and notes
├── README.md        - Project overview
├── data/            - JSON source files (for maintenance, embedded in HTML)
│   ├── game-config.json
│   ├── rewards-config.json
│   ├── chart-config.json
│   ├── countdown-config.json
│   ├── ui-config.json
│   └── theme-config.json
└── docs/
    ├── index.md     - Documentation index
    └── plan/
        ├── IMPLEMENTATION_PLAN.md - This file
        ├── JSON_EXTRACTION_PLAN.md - Data model definition
        └── ... (historical fix notes)
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
| **PvP** | fa-fist-raised | #e91e8a | ~750 | 3 interactive cards (varies with rank/league) |
| **Login** | fa-sign-in-alt | #f39c12 | 293 | Daily (210) + Weekly (60) + Monthly (23) |
| **Code** | fa-gift | #2ecc71 | 300 | Promo code 30KGTG |

**Total: ~1,843 gems/week**

### 2.3 PvP League System (14 Leagues)

| Key | Name | Multiplier |
|-----|------|------------|
| intern | Intern | 0.30 |
| junior1 | Junior I | 0.40 |
| junior2 | Junior II | 0.45 |
| junior3 | Junior III | 0.50 |
| intermediate1 | Intermediate I | 0.55 |
| intermediate2 | Intermediate II | 0.60 |
| intermediate3 | Intermediate III | 0.65 |
| senior1 | Senior I | 0.70 |
| senior2 | Senior II | 0.75 |
| senior3 | Senior III | 0.80 |
| eliteI | Elite I | 0.70 |
| eliteII | Elite II | 0.85 |
| eliteIII | Elite III | 1.00 |
| invincible | Invincible | 1.25 |

**Rank tiers (7 tiers, 1-120):** Each tier has base gems, cards, and chips values. Multiplier from league is applied. Rank 86+ triggers demotion warning.

### 2.4 Reward Cards (9 cards)

All 9 cards have an info icon button (`.gem-card__info-btn`) in the top-right corner that opens a card modal via `showCardModal(cardId)`.

| # | Name | Category | Gems | Modal badge | Notes |
|---|------|----------|------|-------------|-------|
| 1 | Promo Code | Code | 300 | ★ Tap to Reveal | Tap-to-reveal with 3D flip animation, click to copy; info icon always active |
| 2 | The Long Haul | Event | 300 | ★ Top 5% | Info icon opens modal |
| 3 | Earth's Defenders | Event | 200 | ★ Top 10% | Info icon opens modal |
| 4 | Restricted Arena | PvP | dynamic | ★ Weekly | Info icon opens modal; live gems/cards/chips from pvp1-league/rank |
| 5 | Open Arena | PvP | dynamic | ★ Weekly | Info icon opens modal; live gems/cards/chips from pvp2-league/rank |
| 6 | Multiverse Alliance War | PvP | dynamic | ★ 5 Matches / 2 Weeks | Info icon opens modal; live gems/cards/chips from pvp3-league/rank; demotion warning |
| 7 | Daily Login | Login | 210 | ★ 30×7 | Info icon opens modal |
| 8 | Weekly Login | Login | 60 | ★ Weekly | Info icon opens modal |
| 9 | Monthly Login | Login | 23 | ★ 90÷4 | Info icon opens modal |

### 2.5 Spider Chart Targets

| Axis | Actual | Target |
|------|--------|--------|
| Events | 500 | 550 |
| PvP | ~750 (live) | 2664 |
| Login | 293 | 360 |
| Code | 300 | 330 |

**PvP target (2664)** = max combined gems from all 3 PvP cards at best possible (Invincible league, rank 1): `Math.round(710 × 1.25) × 3 = 888 × 3 = 2664`. This represents the theoretical maximum weekly PvP income.

**Live updates:** Spider actual values recompute from live PvP form selectors via `getModeTotal('pvp')` in `buildModeData`. `updatePvPCard` calls `updateChartsByModes(selectedModes)` so spider (and all 3 charts) update immediately on any PvP selector change. Target dataset always shows all 4 targets as reference lines regardless of mode filter state.

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

Hides modal, restores body overflow. `closeDrillDown` is an alias for backward compatibility.

### 4.4 hexToRgb(hex)

Converts hex color to `r, g, b` string for use in `rgba()` CSS values.

### 4.5 Initialization (DOMContentLoaded)

1. `loadAllConfigs()` — load all 6 JSON configs
2. `buildCountdownTargets()` — populate COUNTDOWN_TARGETS
3. Rebuild `chartFilterData`
4. Set `Chart.defaults` (color, borderColor)
5. Create charts
6. `initializePvPCards()` — rank option generation + localStorage load
7. Reset PvP to defaults
8. Set `--card-color` CSS variable on each card
9. Attach mode button hover handlers
10. `updateModeButtonStates()` + `updateAllPageTotals()`
11. `setInterval(updateCountdowns, 1000)`
12. URL parameter parsing

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
function getPvpPayout(leagueId, rank) {
  const league = GAME.pvp.leagues.find(l => l.id === leagueId);
  const multiplier = league ? league.multiplier : 1;
  const tier = GAME.pvp.tiers.find(t => rank >= t.rankStart && rank <= t.rankEnd);
  if (!tier) return { gems: 0, cards: 0, chips: 0, isDemotion: false };
  return {
    gems: Math.round(tier.gems * multiplier),
    cards: tier.cards,
    chips: Math.round(tier.chips * multiplier),
    isDemotion: rank >= GAME.pvp.demotionThreshold
  };
}
```

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
- PvP cards show live gems/cards/chips from current form selections
- Multiverse War adds demotion zone warning (red if rank≥86, green if safe)
- Close via overlay click, × button, or Escape key
- Entry animation: pop-in scale effect

### 6.8 Search
- Expandable search bar with text highlighting
- Searches card titles, descriptions, categories, gem amounts
- "No results" message with suggestions

### 6.9 Save/Share Menu
- Save View (localStorage with name + timestamp)
- Load View (prompt with numbered list)
- Copy Link (URL params: mode, chart, theme)
- Export PNG (html2canvas with 2x scale)

### 6.10 Theme Toggle
- Dark/light mode switch via fixed icon button
- Icon swaps between moon/sun
- URL param `?theme=light` applies on load

### 6.11 Charts Toggle
- Show/hide charts section via toggle button
- Icon rotates (chevron up/down)

### 6.12 Countdown Timers
- 4 timers: weekly, daily, cecilNightmares, multiverseArena
- Per-mode display (only show countdown for active modes)
- Pulse animation on second change

### 6.13 PvP Cards (3 cards)
- League selector: 14 options (Intern through Invincible), default: Elite II
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
| `pvp{N}_league` | intern, junior1, ..., invincible | PvP card N league |
| `pvp{N}_rank` | 1-120 | PvP card N rank |
| `gemInfographicViews` | JSON array | Saved views |

---

## 9. Animations

| Animation | Duration | Easing | Usage |
|-----------|----------|--------|-------|
| gem-fade-in | 0.6s | ease-out | Card entrance |
| gem-code--reveal | 0.8s | cubic-bezier(0.34, 1.56, 0.64, 1) | Code reveal |
| gem-code--glow | 2s | ease-in-out | Code glow pulse (infinite) |
| gem-code--fade-in | 0.5s | ease-out | Copy hint appear |
| gem-scanline | 3s | ease-in-out | Header scan line (infinite) |
| gem-sparkle | 1.5s | ease-in-out | Card sparkle (infinite) |
| gem-rotate-bg | 20s | linear | Total section bg (infinite) |
| gem-float-particle | 15s | linear | Background particles (infinite) |
| gem-countdown-pulse | 1s | ease-out | Countdown second tick |
| gem-modal--pop-in | 0.3s | cubic-bezier(0.34, 1.56, 0.64, 1) | Modal entry (when `.gem-modal--visible` applied to modal) |

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

---

## 11. Files Summary

| File | Lines | Purpose |
|------|-------|---------|
| index.html | 857 | HTML + inline JSON configs (6 in head) |
| script.js | 1363 | All JS: charts, filtering, PvP, modals, countdowns, search, save/share |
| styles.css | 1298 | CSS custom properties, BEM components, animations |
| data/*.json | - | Source JSON files (embedded in index.html) |