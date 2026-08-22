# Plan 47: Extract Magic Numbers to Constants

**Problem:** The JS has hardcoded numerical values scattered throughout: scroll thresholds (400), animation durations (400), chart target values (550, 2664, 360, 330), grid delays, default league/rank values, etc. These "magic numbers" make the code harder to understand, maintain, and tune.

**Goal:** Extract all significant numeric constants into a single `CONSTANTS` object at the top of the file. Name each constant meaningfully.

---

## Step 1: Create the CONSTANTS block

**At the top of `script.src.js`** (after config declarations):

```js
// ===== CONSTANTS =====

var CONSTANTS = {
  // Animation durations (ms)
  COUNTER_DURATION: 400,
  MODAL_TRANSITION: 300,
  CODE_REVEAL_DELAY: 100,
  TOAST_DISPLAY: 3000,

  // PvP defaults
  DEFAULT_LEAGUE: 11,    // Elite II
  DEFAULT_RANK: 13,

  // Scroll thresholds
  SCROLL_TOP_THRESHOLD: 400,   // px before scroll-to-top appears
  SCROLL_DEBOUNCE: 100,        // ms

  // Chart targets (spider chart)
  CHART_TARGET_EVENT: 550,
  CHART_TARGET_PVP: 2664,
  CHART_TARGET_LOGIN: 360,
  CHART_TARGET_CODE: 330,

  // PvP limits
  LEAGUE_COUNT: 14,
  MAX_RANK: 120,
  DEMOTION_THRESHOLD: 86,       // rank 86+
  PLAYER_COUNT_PERCENTILE: 0.5, // midpoint rank for efficiency calc

  // Card grid
  CARD_DELAY_INCREMENT: 75,     // ms between card fade-ins
  CARD_COUNT: 9,

  // Mode filter defaults
  DEFAULT_MODES: ['event', 'pvp', 'login'],
  ALL_MODES: ['event', 'pvp', 'login', 'code'],

  // Charts
  CHART_ANIMATION_DURATION: 0,  // Charts disabled (instant update)
  CHART_UPDATE_MODE: 'none',
};
```

---

## Step 2: Replace magic numbers in the code

**Search patterns to find and replace:**

```bash
# Find potential magic numbers:
grep -n '400\|300\|100\|86\|120\|13\|11\|750\|550\|2664\|360\|330' script.src.js
```

**Specific replacements:**

```js
// Before:
if (window.scrollY > 400) {

// After:
if (window.scrollY > CONSTANTS.SCROLL_TOP_THRESHOLD) {
```

```js
// Before:
var duration = 400;

// After:
var duration = CONSTANTS.COUNTER_DURATION;
```

```js
// Before:
var targets = [550, 2664, 360, 330];

// After:
var targets = [
  CONSTANTS.CHART_TARGET_EVENT,
  CONSTANTS.CHART_TARGET_PVP,
  CONSTANTS.CHART_TARGET_LOGIN,
  CONSTANTS.CHART_TARGET_CODE
];
```

```js
// Before:
var demotionRank = 86;

// After:
var demotionRank = CONSTANTS.DEMOTION_THRESHOLD;
```

```js
// Before:
defaultLeague: 11,
defaultRank: 13,

// After:
defaultLeague: CONSTANTS.DEFAULT_LEAGUE,
defaultRank: CONSTANTS.DEFAULT_RANK,
```

---

## Step 3: Handle game data constants separately

Game-related numbers (payout values, league sizes) should stay in the config (`GAME.pvp.*`), not in CONSTANTS. Only extract application logic numbers.

---

## Step 4: Add validation for constants

```js
// Assert critical constants are valid at load time:
function validateConstants() {
  var errors = [];
  if (CONSTANTS.DEFAULT_LEAGUE < 0 || CONSTANTS.DEFAULT_LEAGUE >= CONSTANTS.LEAGUE_COUNT) {
    errors.push('DEFAULT_LEAGUE out of range');
  }
  if (CONSTANTS.DEFAULT_RANK < 1 || CONSTANTS.DEFAULT_RANK > CONSTANTS.MAX_RANK) {
    errors.push('DEFAULT_RANK out of range');
  }
  if (errors.length > 0) {
    console.warn('[CONSTANTS] Validation errors:', errors);
  }
}
```

---

## Step 5: Create a constants reference comment

```js
/*
 * ===================== CONSTANTS REFERENCE =====================
 * ANIMATION:    COUNTER_DURATION=400, MODAL_TRANSITION=300
 * PVP:          DEFAULT_LEAGUE=11(EliteII), DEFAULT_RANK=13, MAX_RANK=120
 * CHARTS:       TARGETS=[550, 2664, 360, 330], ANIMATION_DURATION=0
 * SCROLL:       SCROLL_TOP_THRESHOLD=400px
 * ================================================================
 */
```

---

## Files Modified

| File | Change |
|------|--------|
| `script.src.js` | Add `CONSTANTS` object, replace all magic numbers with references |

---

## Verification

```bash
# Search for remaining magic numbers (exclude constants and config data):
grep -n '\b[0-9]\{3,\}\b' script.src.js | grep -v 'CONSTANTS\.\|GAME\.\|REWARDS\.\|UI\.\|var \|=\s*[0-9]'

# Expected output: only game-data numbers (payout values, league capacities, etc.)
# Application logic numbers should all be CONSTANTS references
```
