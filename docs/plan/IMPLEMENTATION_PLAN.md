# Invincible Gem Rewards Infographic - Implementation Plan

**Document Status:** Current (May 2, 2026)
**Total Gems:** 1,843 (weekly calculation, varies with PvP)
**Implementation Status:** Complete

---

## 1. Project Overview

### 1.1 Purpose
Interactive infographic displaying gem reward sources from the Invincible mobile game with interactive filtering, dynamic charts, and a sci-fi aesthetic matching the game's UI.

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
├── index.html       (678 lines) - Main infographic + embedded JSON configs
├── script.js        (1137 lines) - All JavaScript, loads JSON configs
├── styles.css       (1182 lines) - Design tokens + BEM classes
├── README.md        - Project overview
├── data/            - JSON config files (for maintainability)
│   ├── game-config.json      (PvP leagues, tiers, spider targets)
│   ├── rewards-config.json   (card definitions, categories, login rewards)
│   ├── chart-config.json     (colors, labels, animation, tooltip)
│   ├── countdown-config.json (weekly/daily/event timer settings)
│   ├── ui-config.json        (mode order, grid layouts, animation delays)
│   └── theme-config.json     (dark/light mode design tokens)
└── docs/
    ├── index.md    - Documentation index
    └── plan/       - Implementation notes
    └── JSON_EXTRACTION_PLAN.md - Data model definition (Apr 29, 2026)
```

---

## 2. Data Architecture

### 2.1 JSON Config System

Six JSON config files are maintained in `data/` directory and embedded in `<head>` via `<script type="application/json">` tags for zero network overhead. A `loadConfig(id)` function retrieves them, and `loadAllConfigs()` is called at startup.

**Global config objects (script.js):**
- `GAME` - PvP leagues (14), rank tiers (7), spider targets, event definitions
- `REWARDS` - Card definitions, categories, login reward calculations, promo code
- `CHARTS` - Colors, labels, animation settings, tooltip config, initial chart data
- `COUNTDOWN` - Weekly/daily/event timer settings (hour, minute, offsetHours, daysOffset)
- `UI` - Mode order, grid layouts, animation delays, default selected modes
- `THEME` - Dark/light mode design tokens

**Config loading (script.js lines 17-35):**
```javascript
const CONFIG_IDS = ['game', 'rewards', 'chart', 'countdown', 'ui', 'theme'];
const CONFIG_GLOBALS = { game: 'GAME', rewards: 'REWARDS', chart: 'CHARTS', countdown: 'COUNTDOWN', ui: 'UI', theme: 'THEME' };
function loadConfig(id) { ... }
function loadAllConfigs() { CONFIG_IDS.forEach(id => loadConfig(id)); }
```

### 2.2 Categories (4 Modes)

| Mode | Icon | Color | Total | Calculation |
|------|------|-------|-------|-------------|
| **Event** | fa-dragon | #ff6b35 | 500 | The Long Haul (300) + Earth's Defenders (200) |
| **PvP** | fa-fist-raised | #e91e8a | 750 | 3 interactive cards (varies with rank/league) |
| **Login** | fa-sign-in-alt | #f39c12 | 293 | Daily (210) + Weekly (60) + Monthly (23) |
| **Code** | fa-gift | #2ecc71 | 300 | Promo code 30KGTG |

**Total: 1,843 gems/week**

### 2.3 PvP League System (14 Leagues)

| Key | Name | Multiplier |
|-----|------|------------|
| intern | Intern | 0.30 |
| junior1 | Junior I | 0.35 |
| junior2 | Junior II | 0.40 |
| junior3 | Junior III | 0.45 |
| intermediate1 | Intermediate I | 0.50 |
| intermediate2 | Intermediate II | 0.55 |
| intermediate3 | Intermediate III | 0.60 |
| senior1 | Senior I | 0.62 |
| senior2 | Senior II | 0.65 |
| senior3 | Senior III | 0.68 |
| eliteI | Elite I | 0.70 |
| eliteII | Elite II | 0.85 |
| eliteIII | Elite III | 1.00 |
| invincible | Invincible | 1.25 |

**Rank tiers (7 tiers, 1-120):** Each tier has base gems, cards, and chips values. Multiplier from league is applied.

### 2.4 Reward Cards (9 cards)

| # | Name | Category | Gems | Notes |
|---|------|----------|------|-------|
| 1 | Promo Code | Code | 300 | Tap-to-reveal with 3D animation |
| 2 | The Long Haul | Event | 300 | Top 5% ranking |
| 3 | Earth's Defenders | Event | 200 | Top 10% ranking |
| 4 | Restricted Arena | PvP | dynamic | League + rank selector (14 leagues) |
| 5 | Open Arena | PvP | dynamic | League + rank selector |
| 6 | Multiverse Alliance War | PvP | dynamic | 5 matches/2 weeks, demotion warning |
| 7 | Daily Login | Login | 210 | 30×7=210 |
| 8 | Weekly Login | Login | 60 | Fixed |
| 9 | Monthly Login | Login | 23 | 90÷4=23 |

### 2.5 Spider Chart Targets

| Axis | Actual | Target |
|------|--------|--------|
| Events | 500 | 550 |
| PvP | 750 | 1500 |
| Login | 293 | 360 |
| Code | 300 | 330 |

---

## 3. UI Structure

### 3.1 Mode Selector (index.html lines 97-127)

**Order:** All → Code → Event → PvP → Login (from UI.config.modeOrder)

```html
<nav class="gem-grid--modes my-4">
    <button onclick="filterCards('all', event)" class="gem-mode-btn gem-mode-btn--all active">...</button>
    <button onclick="filterCards('code', event)" class="gem-mode-btn gem-mode-btn--code active">...</button>
    ...
</nav>
```

**Active State CSS:**
- Background opacity: 0.12 → 0.50
- Border opacity: 0.30 → 0.90
- Box shadow glow effect
- Transform scale: 1.03

### 3.2 Card Grid (index.html lines 129-395)

**Layout:** 1 column (mobile) → 2 columns (md) → 3 columns (lg) — configurable via UI.config.gridLayouts

### 3.3 Charts Section (index.html lines ~540-600)

**3-column grid:** Distribution → Rewards → Performance

---

## 4. JavaScript Architecture

### 4.1 Initialization (script.js lines 963-1126)

All initialization inside `DOMContentLoaded`:
1. `loadAllConfigs()` — load all 6 JSON configs into globals
2. `buildCountdownTargets()` — populate COUNTDOWN_TARGETS from COUNTDOWN config
3. Rebuild `chartFilterData` now that configs are loaded
4. Chart.js defaults configuration
5. Chart instantiation (categoryChart, rewardsChart, spiderChart)
6. `initializePvPCards()` — rank option generation + localStorage load
7. PvP defaults reset on load (clears localStorage)
8. `updateModeButtonStates()` and `updateAllPageTotals()`
9. `setInterval(updateCountdowns, 1000)` for countdown timers
10. URL parameter parsing for theme/mode/chart

**Important:** `getRewardsChartData()` is defined BEFORE DOMContentLoaded so it's available when charts initialize inside DOMContentLoaded.

### 4.2 Mode Filtering (script.js lines ~326-358)

```javascript
let selectedModes = UI?.defaults?.selectedModes ? [...UI.defaults.selectedModes] : ['event', 'pvp', 'login', 'code'];
```

`filterCards(category, evt)` toggles individual modes. `updateChartsByModes(selectedModes)` syncs charts.

### 4.3 Chart Data Functions

**getRewardsChartData(modes)** - Returns { labels, data, colors } for bar chart, uses CHARTS.colors

**buildModeData(mode, totals)** - Returns { distribution, rewards, spider, colors, rewardColors } for chartFilterData lookup table. Uses GAME.spiderTargets and CHARTS.colors.

### 4.4 PvP Payout Calculation (script.js lines ~253)

```javascript
function getPvpPayout(leagueKey, rank) {
  const tiers = GAME.pvp.tiers;  // Array of {min, max, gems, cards, chips}
  const mod = GAME.pvp.leagues[leagueKey]?.multiplier || 1;
  const tier = tiers.find(t => rank >= t.min && rank <= t.max);
  if (!tier) return { gems: 0, cards: 0, chips: 0, isDemotion: false };
  return {
    gems: Math.round(tier.gems * mod),
    cards: tier.cards,
    chips: Math.round(tier.chips * mod),
    isDemotion: rank >= 86
  };
}
```

### 4.5 Countdown System

`COUNTDOWN_TARGETS` built at runtime via `buildCountdownTargets()` from COUNTDOWN config:

```javascript
function buildCountdownTargets() {
  COUNTDOWN_TARGETS = {
    weekly: getNextSunday(COUNTDOWN.weekly),
    daily: getNextDailyReset(COUNTDOWN.daily),
    multiverseArena: new Date(Date.now() + COUNTDOWN.events.multiverseArena.daysOffset * 86400000),
    cecilNightmares: new Date(Date.now() + COUNTDOWN.events.cecilNightmares.daysOffset * 86400000)
  };
}
```

---

## 5. CSS Design System

### 5.1 Design Tokens (styles.css lines 9-95)

```css
:root {
  /* Category colors */
  --gem-event: #ff6b35;
  --gem-pvp: #e91e8a;
  --gem-login: #f39c12;
  --gem-code: #2ecc71;
  --gem-cyan: #00e5ff;
  /* Background colors */
  --gem-bg-dark: #050a14;
  --gem-bg-mid: #0a1628;
  --gem-bg-light: #0d1f3c;
  /* Cards, borders, shadows... */
}
```

Theme tokens (light mode) defined in `data/theme-config.json` and applied via `.light-mode` class.

### 5.2 BEM Component Classes

| Component | Block | Elements | Modifiers |
|-----------|-------|----------|-----------|
| Card | `.gem-card` | `__body`, `__divider` | `--event`, `--pvp`, `--login`, `--code`, `--hover`, `--fade-in` |
| Label | `.gem-label` | - | `--event`, `--pvp`, `--login`, `--code`, `--cyan` |
| Mode Button | `.gem-mode-btn` | `__icon`, `__count`, `__label`, `__countdown` | `--all`, `--event`, `--pvp`, `--login`, `--code` |
| Chart | `.gem-chart` | `__title` | - |
| Toast | `.gem-toast` | - | `--success`, `--error`, `--info` |
| Modal | `.gem-modal` | `__overlay`, `__content`, `__header`, `__body`, `__footer` | `--visible` |

### 5.3 Promo Code Reveal Animation (styles.css lines 168-283)

Three-stage animation: reveal (3D flip) → glow (pulse) → copied (scale pop)

---

## 6. Feature Specifications

### 6.1 Mode Filtering
- **All Modes:** Shows all 9 cards, total = 1,843
- **Individual modes:** Toggle on/off, at least 1 must be selected
- **Charts:** Updated via `updateChartsByModes(selectedModes)`
- **Mode buttons:** CSS `.active` class controls visual state

### 6.2 Dynamic Total Counter
- `animateValue(elementId, newValue, duration)` with ease-out quad easing
- Updates totalCounter and all mode button counts

### 6.3 Spider Chart
- **Actual dataset:** Cyan, dynamic based on selected modes
- **Target dataset:** Pink, static from GAME.spiderTargets
- **Animation:** From CHARTS.animation config (750ms easeOutQuart default)

### 6.4 Rewards Bar Chart
- **Dynamic bars:** 1-4 bars based on selected modes
- **Mode order:** From getRewardsChartData (code, event, pvp, login)
- **Colors:** From CHARTS.colors per mode

### 6.5 PvP Cards (14 Leagues)
- League selector: Intern through Invincible (14 options, default: Elite II)
- Rank selector: 1-120 (tier-based, dynamically generated)
- Clear button to reset defaults
- Demotion zone warning at rank 86+ (Multiverse only)
- localStorage persistence

### 6.6 Countdown Timers
- **Update interval:** 1000ms
- **Timer targets:** cecilNightmares, multiverseArena, weekly, daily — all from COUNTDOWN config
- Display format: "Xd Xh", "Xh Xm", or "Xm Xs"

### 6.7 Search Function
- Toggle via search icon
- Search targets: Card titles, descriptions, categories, gem amounts
- Highlight matching text

### 6.8 Save/Share
- **Save View:** localStorage with name + timestamp
- **Load View:** Prompt with numbered list
- **Copy Link:** URL params (mode, chart, theme)
- **Export PNG:** html2canvas with 2x scale

---

## 7. Component States

### 7.1 Mode Button States

| State | Background | Border | Shadow | Scale |
|-------|------------|--------|--------|-------|
| Default | 0.12 opacity | 0.30 opacity | none | 1.0 |
| Active | 0.50 opacity | 0.90 opacity | glow + inset | 1.03 |
| Hover | - | - | - | 1.05 |

### 7.2 Card States

| State | Transform | Box Shadow | Border |
|-------|-----------|------------|--------|
| Default | none | none | category 0.20 |
| Hover | translateY(-8px) scale(1.02) | cyan glow | category 0.40 |
| Hidden | display: none | - | - |

### 7.3 Promo Code States

1. **Initial:** Hint text "A secret code whispered among allies—tap to reveal"
2. **Revealed:** 3D flip animation reveals "30KGTG" with copy hint
3. **Copied:** Scale pop + "✓ COPIED" text

---

## 8. CSS Animations

| Animation | Duration | Easing | Usage |
|-----------|----------|--------|-------|
| gem-fade-in | 0.6s | ease-out | Card entrance |
| gem-code--reveal | 0.8s | cubic-bezier(0.34, 1.56, 0.64, 1) | Code reveal |
| gem-code--glow | 2s | ease-in-out | Code glow pulse (infinite) |
| gem-scanline | 3s | ease-in-out | Header scan line (infinite) |
| gem-sparkle | 1.5s | ease-in-out | Card sparkle (infinite) |
| gem-rotate-bg | 20s | linear | Total section bg (infinite) |
| gem-countdown-pulse | 1s | ease-out | Countdown second tick |

---

## 9. URL Parameters

| Param | Values | Effect |
|-------|--------|--------|
| theme | light, dark | Apply light-mode class |
| mode | all, event, pvp, login, code | Filter cards on load |
| chart | all, event, pvp, login, code | Filter charts on load |

Example: `index.html?theme=dark&mode=pvp&chart=event`

---

## 10. localStorage Keys

| Key | Format | Purpose |
|-----|--------|---------|
| `pvp{N}_league` | intern, junior1, ..., invincible | PvP card N league |
| `pvp{N}_rank` | 1-120 | PvP card N rank |
| `gemInfographicViews` | JSON array | Saved views |

---

## 11. Implementation Notes

### 11.1 JSON Config Embedding

JSON configs are embedded in `index.html` `<head>` as `<script type="application/json" id="config-{name}">`. The `loadConfig(id)` function retrieves element content and parses it, then assigns to the corresponding global variable (GAME, REWARDS, CHARTS, COUNTDOWN, UI, THEME).

Separate JSON files in `data/` directory allow periodic updates without touching HTML. The embed is updated by a build step (not automated in this version).

### 11.2 Chart.js Initialization Order

1. `loadAllConfigs()` + `buildCountdownTargets()`
2. Rebuild `chartFilterData` with config values
3. Set Chart.defaults (color, borderColor)
4. Create charts with initial data from config
5. Initialize PvP cards (rank options from GAME.pvp.tiers)
6. Reset PvP to defaults from GAME.pvp.defaults
7. `updateModeButtonStates()` + `updateAllPageTotals()`
8. Start countdown interval

### 11.3 Spider Chart Data Flow

1. `buildModeData()` creates base data using GAME.spiderTargets and CHARTS.colors
2. `chartFilterData` stores pre-computed data for all/all/event/pvp/login/code
3. `updateChartsByModes()` combines selected modes' data
4. Spider actuals use combined distribution.slice(1), targets use GAME.spiderTargets

### 11.4 Why JSON Configs?

Separating game data (leagues, tiers, rewards, targets) from code allows:
- Periodic data updates without touching JS/HTML
- Easy validation of data structure
- Single source of truth for multi-place references (e.g., spider targets used in chart and UI)
- Reduced hardcoding in JavaScript

---

## 12. Out of Scope / Removed

The following were in older versions but are NOT in current implementation:
- Season category (removed May 1, 2026)
- Warfare category (merged into PvP)
- 4-chart layout (only 3 charts now)
- Chart filter buttons below charts
- Gem Calculator section
- Line chart (Progress)
- Legend section
- Summary info box

---

## 13. Files Summary

| File | Lines | Purpose |
|------|-------|---------|
| index.html | 678 | HTML + embedded JSON configs (6 configs in head) |
| script.js | 1137 | All JS: charts, filtering, PvP, countdowns, search, save/share |
| styles.css | 1182 | CSS custom properties, BEM components, animations |
| data/game-config.json | - | PvP 14 leagues, 7 tiers, spider targets, events |
| data/rewards-config.json | - | Card definitions, categories, login rewards, promo code |
| data/chart-config.json | - | Colors, labels, animation, tooltip, initial data |
| data/countdown-config.json | - | Weekly/daily/event timer settings |
| data/ui-config.json | - | Mode order, grid layouts, animation delays |
| data/theme-config.json | - | Dark/light mode design tokens |