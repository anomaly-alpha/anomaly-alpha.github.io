# Plan 38: Constants Extraction from script.js

**Problem:** Magic numbers and strings are scattered throughout `script.js`: `400` (animation duration), `5000` (countdown interval), `86` (demotion threshold), `'#ff6b35'` (category colors hardcoded in JS). These should be centralized constants.

**Goal:** Extract all magic values into a constants object at the top of `script.js`.

---

## Step 1: Create constants object

```javascript
// script.js — add at top, after loadAllConfigs
var CONSTANTS = {
  ANIMATION_DURATION: 400,
  COUNTDOWN_INTERVAL: 5000,
  DEMOTION_THRESHOLD: 86,
  CHART_LAZY_LOAD_DELAY: 100,
  CARD_FADE_STAGGER: 75,
  LOCALSTORAGE_KEYS: {
    MODES: 'gem_modes',
    CHART_FILTER: 'gem_chartFilter',
    CHARTS_VISIBLE: 'gem_chartsVisible',
    THEME: 'gem_theme',
    PVP_LEAGUE: 'pvp{0}_league',
    PVP_RANK: 'pvp{0}_rank',
    GOAL: 'gem_goal',
    HISTORY: 'gem_history'
  },
  URL_PARAMS: {
    THEME: 'theme',
    MODE: 'mode',
    CHART: 'chart'
  },
  DEFAULT_SELECTED_MODES: ['event', 'pvp', 'login'],
  CODE_REVEAL_DELAY: 300,
  COPY_FEEDBACK_DURATION: 1500
};
```

## Step 2: Replace magic values

```javascript
// Before
setTimeout(function() { ... }, 400);
setInterval(updateCountdown, 5000);
if (rank >= 86) { ... }

// After
setTimeout(function() { ... }, CONSTANTS.ANIMATION_DURATION);
setInterval(updateCountdown, CONSTANTS.COUNTDOWN_INTERVAL);
if (rank >= CONSTANTS.DEMOTION_THRESHOLD) { ... }
```

## Files Modified
- `script.js` — constants object, replaced magic values

## Verification
```bash
npm run build
# Functionality should be identical
# grep for remaining magic numbers
grep -n '400\|5000\|86' script.js | grep -v 'CONSTANTS'
```
