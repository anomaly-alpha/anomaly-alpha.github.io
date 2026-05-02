# JSON Data Extraction Plan - Gem Rewards Infographic

**Document Status:** Implementation Guide
**Created:** May 2, 2026
**Last Updated:** May 2, 2026

---

## Overview

Extract all hardcoded data from `script.js` into separate JSON configuration files. Refactor `script.js` to load and consume these configs at runtime. Enable periodic data updates without touching JavaScript logic.

---

## Architecture

### Before (Current State)
```
script.js (hardcoded data)
├── GAME.pvp.base, .mod, .def
├── GAME.ev.event, .login, .code
├── GAME.chart.*
├── categoryData{}
├── chartTooltipConfig{}
├── chartAnimationConfig{}
├── COUNTDOWN_TARGETS{}
└── All other data inline
```

### After (Target State)
```
index.html
├── <script type="application/json" id="game-config">...</script>  (inline, not fetched)
├── <script type="application/json" id="rewards-config">...</script>
├── <script type="application/json" id="chart-config">...</script>
├── <script type="application/json" id="countdown-config">...</script>
├── <script type="application/json" id="ui-config">...</script>
└── <script type="application/json" id="theme-config">...</script>

script.js (consumes JSON)
├── loadConfig(id) → parses inline <script> element textContent
├── loadAllConfigs() → all 6 configs loaded
├── GAME = game-config data
├── REWARDS = rewards-config data
├── CHARTS = chart-config data
├── COUNTDOWN = countdown-config data
├── UI = ui-config data
└── THEME = theme-config data
```

**Note:** JSON is embedded inline in HTML (not fetched via fetch()) to support opening the page directly from disk (`file://`) without CORS errors. Source files remain in `data/` for maintainability.

---

## JSON Files

### 1. `data/game-config.json`

PvP calculation data, spider chart targets, league definitions.

**Key structures:**
- `pvp.leagues[]` - 14 leagues with id, name, multiplier, rankStart, rankEnd
- `pvp.tiers[]` - 7 rank tiers with gems/cards/chips base values
- `pvp.demotionThreshold` - rank number that triggers demotion warning
- `spiderTargets` - target values for radar chart

**Multipliers by league:**
| League | Multiplier | Ranks |
|--------|------------|-------|
| Intern | 0.30 | 1-9 |
| Junior I | 0.40 | 10-18 |
| Junior II | 0.45 | 19-27 |
| Junior III | 0.50 | 28-36 |
| Intermediate I | 0.55 | 37-45 |
| Intermediate II | 0.60 | 46-54 |
| Intermediate III | 0.65 | 55-63 |
| Senior I | 0.70 | 64-72 |
| Senior II | 0.75 | 73-81 |
| Senior III | 0.80 | 82-90 |
| Elite I | 0.70 | 91-100 |
| Elite II | 0.85 | 101-105 |
| Elite III | 1.00 | 106-115 |
| Invincible | 1.25 | 116-120 |

**Tier table (by absolute rank):**
| Rank Range | Base Gems | Cards | Chips |
|------------|-----------|-------|-------|
| 1 | 710 | 4 | 1000 |
| 2 | 670 | 3 | 900 |
| 3 | 640 | 2 | 800 |
| 4-10 | 600 | 1 | 600 |
| 11-30 | 560 | 1 | 600 |
| 31-60 | 520 | 1 | 1600 |
| 61-120 | 490 | 1 | 1500 |

---

### 2. `data/rewards-config.json`

Cards, categories, login rewards, promo code data.

**Key structures:**
- `categories{}` - event, pvp, login, code with title, icon, color, total
- `cards[]` - 9 cards with id, category, title, gems, formula, description, delay
- `loginRewards[]` - Daily, Weekly, Monthly with base/frequency/weeklyTotal
- `promoCode` - "30KGTG"

**Cards:**
1. Promo Code (code) - 300 gems, tap-to-reveal, code: 30KGTG
2. The Long Haul (event) - 300 gems, Top 5%
3. Earth's Defenders (event) - 200 gems, Top 10%
4. Restricted Arena (pvp) - Card index 1, Weekly
5. Open Arena (pvp) - Card index 2, Weekly
6. Multiverse Alliance War (pvp) - Card index 3, 5 matches/2 weeks, hasDemotionWarning
7. Daily Login (login) - 210 gems, formula: 30×7
8. Weekly Login (login) - 60 gems
9. Monthly Login (login) - 23 gems, formula: 90÷4

---

### 3. `data/chart-config.json`

Chart display settings, colors, animation, tooltip.

**Key structures:**
- `colors{}` - hex values for event, pvp, login, code, disabled, cyan, pink, purple
- `labels{}` - distribution/spider chart labels
- `animation{}` - duration, easing, chartDelays
- `tooltip{}` - backgroundColor, borderColor, fonts, padding, cornerRadius
- `initialData{}` - default chart data

---

### 4. `data/countdown-config.json`

Timer settings for weekly, daily, event countdowns.

**Key structures:**
- `weekly{}` - day: sunday, hour: 20, minute: 0
- `daily{}` - hour: 20, minute: 0, timezone: EST, offsetHours: -4
- `events{}` - cecilNightmares (3 days), multiverseArena (30 days)

---

### 5. `data/ui-config.json`

Layout configuration, mode order, grid settings.

**Key structures:**
- `modeOrder[]` - ["all", "code", "event", "pvp", "login"]
- `modeButtonIcons{}` - Font Awesome icon class per mode
- `cardGrid{}` - responsive column counts
- `chartGrid{}` - responsive column counts
- `animationDelays{}` - stagger delays for cards/charts

---

### 6. `data/theme-config.json`

CSS design tokens for dark and light modes.

**Key structures:**
- `dark{}` - colors, background, cardBackground, borderOpacity, text
- `light{}` - override values for light mode

---

## Implementation Steps

### Step 1: Create data/ directory

```
mkdir -p data
```

### Step 2: Create JSON files

Create each JSON file in `data/` directory with embedded version in `index.html`.

### Step 3: Embed JSON in index.html

Add `<script type="application/json" id="config-id">` blocks in `<head>` before other scripts.

### Step 4: Create loadConfig() helper

```javascript
function loadConfig(id) {
  const el = document.getElementById(id);
  return el ? JSON.parse(el.textContent) : {};
}
```

### Step 5: Create loadAllConfigs() in DOMContentLoaded

```javascript
const GAME = loadConfig('game-config');
const REWARDS = loadConfig('rewards-config');
const CHARTS = loadConfig('chart-config');
const COUNTDOWN = loadConfig('countdown-config');
const UI = loadConfig('ui-config');
const THEME = loadConfig('theme-config');
```

### Step 6: Refactor functions to use JSON

- `getPvpPayout(league, rank)` → uses `GAME.pvp`
- `getModeTotal(mode)` → uses `REWARDS.loginRewards`
- `buildModeData(mode, totals)` → uses `GAME.pvp`, `REWARDS`
- `getRewardsChartData(modes)` → uses `CHARTS.colors`
- `initializeCharts()` → uses `CHARTS.animation`, `CHARTS.tooltip`
- `updateCountdowns()` → uses `COUNTDOWN`
- `initializePvPCards()` → uses `GAME.pvp.leagues` (14 options)

### Step 7: Update index.html league selectors

Change from 4 league options to 14:
```html
<option value="intern">Intern</option>
<option value="junior1">Junior I</option>
...
<option value="invincible">Invincible</option>
```

### Step 8: Update documentation

- Update IMPLEMENTATION_PLAN.md with new architecture
- Update docs/index.md if needed

### Step 9: Test and commit

---

## File Structure (After)

```
anomaly-alpha/
├── index.html           (827 lines, inline JSON configs in <head>)
├── script.js            (1162 lines, loadConfig reads inline <script> elements)
├── styles.css           (1183 lines)
├── favicon.svg
├── data/                (source JSON files, embedded in index.html)
│   ├── game-config.json     (PvP, spider targets)
│   ├── rewards-config.json  (cards, categories, login)
│   ├── chart-config.json    (colors, animation, tooltip)
│   ├── countdown-config.json (timer settings)
│   ├── ui-config.json       (layout, mode order)
│   └── theme-config.json    (design tokens)
└── docs/
    ├── index.md
    └── plan/
        ├── IMPLEMENTATION_PLAN.md
        ├── JSON_EXTRACTION_PLAN.md  (this file)
        └── ... (historical fix notes)
```

---

## Calculation Formulas

### PvP Payout
```javascript
gems = tier.gems × league.multiplier
cards = tier.cards  // not multiplied
chips = tier.chips × league.multiplier
isDemotion = rank >= demotionThreshold
```

### Login Total (weekly)
```javascript
dailyTotal = daily.baseGems × daily.frequency      // 30 × 7 = 210
weeklyTotal = weekly.baseGems                        // 60
monthlyWeekly = monthly.baseGems / monthly.frequency // 90 / 4 = 23
loginTotal = dailyTotal + weeklyTotal + monthlyWeekly // 210 + 60 + 23 = 293
```

### Spider Chart Data
```javascript
actual = [event.total, pvp.total, login.total, code.total]
target = [GAME.spiderTargets.events, .pvp, .login, .code]
```

---

## Maintenance

### Updating Data

To update PvP payouts, league multipliers, card values, etc.:
1. Edit the appropriate JSON file in `data/`
2. Update the embedded `<script type="application/json">` block in `index.html`
3. Or update both at once — source files are for reference, embedded blocks are what the page actually uses

### Adding New Features

1. Add data to appropriate JSON file
2. Add embed block to `index.html`
3. Update `script.js` to consume new data

---

## Notes

- All 14 leagues share the same 7-tier rank structure
- Rank numbers are absolute (1-120), not per-league
- Multipliers determine payout difference between leagues
- Cards (reward count) do NOT get multiplied by league
- Chips (currency) DO get multiplied by league
- Demotion threshold (86) applies across all leagues