# Plan 05: Data Validation Layer

**Problem:** The inline JSON configs (`game-config`, `rewards-config`, etc.) are parsed without any validation. A malformed config — missing league, wrong payout format, or undefined `cards` array — causes silent failures. `loadConfig()` returns `{}` when the element is missing, and the app may show NaN, broken modals, or empty charts without any error.

**Goal:** Add runtime validation for all 7 configs that runs at load time and surfaces errors via console warnings (non-blocking in production, more verbose in dev).

---

## Step 1: Create a validation schema

**In `script.js`** (add before or within `loadAllConfigs()`):

```js
// ===== VALIDATION SCHEMAS =====

const CONFIG_SCHEMAS = {
  'game-config': {
    required: ['pvp'],
    checks: [
      {
        name: 'pvp.leagues has 14 entries',
        test: (cfg) => cfg.pvp && cfg.pvp.leagues && cfg.pvp.leagues.length === 14,
      },
      {
        name: 'pvp.arenas has restricted + open',
        test: (cfg) => cfg.pvp && cfg.pvp.arenas &&
          cfg.pvp.arenas.restricted && cfg.pvp.arenas.open,
      },
      {
        name: 'pvp.multiverse exists',
        test: (cfg) => cfg.pvp && cfg.pvp.multiverse,
      },
      {
        name: 'demotionThreshold is a number',
        test: (cfg) => typeof cfg.pvp.demotionThreshold === 'number',
      },
    ],
  },
  'rewards-config': {
    required: ['categories', 'cards'],
    checks: [
      {
        name: 'categories has event, pvp, login, code',
        test: (cfg) =>
          ['event', 'pvp', 'login', 'code'].every((c) => cfg.categories && cfg.categories[c]),
      },
      {
        name: 'cards has exactly 9 entries',
        test: (cfg) => cfg.cards && cfg.cards.length === 9,
      },
      {
        name: 'each card has id, category, modal with 5 tips',
        test: (cfg) =>
          cfg.cards &&
          cfg.cards.every(
            (card) =>
              card.id &&
              card.category &&
              card.modal &&
              card.modal.tips &&
              card.modal.tips.length === 5
          ),
      },
      {
        name: 'promoCodes exists',
        test: (cfg) => Array.isArray(cfg.promoCodes),
      },
    ],
  },
  'chart-config': {
    required: ['colors'],
    checks: [
      {
        name: 'colors has disabled, event, pvp, login, code',
        test: (cfg) =>
          ['disabled', 'event', 'pvp', 'login', 'code'].every(
            (c) => cfg.colors && cfg.colors[c]
          ),
      },
    ],
  },
  'countdown-config': {
    required: ['weekly', 'daily'],
    checks: [
      {
        name: 'weekly has day and time',
        test: (cfg) => cfg.weekly && cfg.weekly.day && cfg.weekly.time,
      },
    ],
  },
  'ui-config': {
    required: ['categoryColors', 'modeOrder'],
    checks: [
      {
        name: 'categoryColors has event, pvp, login, code',
        test: (cfg) =>
          ['event', 'pvp', 'login', 'code'].every(
            (c) => cfg.categoryColors && cfg.categoryColors[c]
          ),
      },
      {
        name: 'modeOrder has entries',
        test: (cfg) => cfg.modeOrder && cfg.modeOrder.length > 0,
      },
    ],
  },
  'theme-config': {
    required: ['dark', 'light'],
    checks: [],
  },
  'contributors-config': {
    required: ['contributors'],
    checks: [
      {
        name: 'contributors is non-empty array',
        test: (cfg) =>
          Array.isArray(cfg.contributors) && cfg.contributors.length > 0,
      },
    ],
  },
};
```

---

## Step 2: Add validation function

```js
function validateConfig(id, config) {
  const schema = CONFIG_SCHEMAS[id];
  if (!schema) return; // no schema for this config

  const errors = [];

  // Check required top-level keys
  schema.required.forEach((key) => {
    if (config[key] === undefined) {
      errors.push(`Missing required key: "${key}"`);
    }
  });

  // Run custom checks
  schema.checks.forEach((check) => {
    if (!check.test(config)) {
      errors.push(`Validation failed: ${check.name}`);
    }
  });

  if (errors.length > 0) {
    console.warn(`[${id}] ${errors.length} validation error(s):`);
    errors.forEach((e) => console.warn(`  ✗ ${e}`));
    console.warn(`  Config:`, config);
    return false;
  }

  console.log(`[${id}] Validation passed ✓`);
  return true;
}
```

---

## Step 3: Integrate into `loadAllConfigs()`

```js
function loadAllConfigs() {
  // Load as before
  GAME = loadConfig('game-config');
  REWARDS = loadConfig('rewards-config');
  CHARTS = loadConfig('chart-config');
  COUNTDOWN = loadConfig('countdown-config');
  UI = loadConfig('ui-config');
  THEME = loadConfig('theme-config');

  // Validate each loaded config
  const isDev = window.location.hostname === 'localhost' ||
                window.location.protocol === 'file:';

  if (isDev) {
    validateConfig('game-config', GAME);
    validateConfig('rewards-config', REWARDS);
    validateConfig('chart-config', CHARTS);
    validateConfig('countdown-config', COUNTDOWN);
    validateConfig('ui-config', UI);
    validateConfig('theme-config', THEME);
    validateConfig('contributors-config', loadConfig('contributors-config'));
  }
}
```

This skips validation in production (avoids console noise for end users) but validates aggressively in dev.

---

## Step 4: Type-safe defaults (defensive programming)

Add fallback defaults for critical config paths to prevent NaN when data is missing:

```js
// After loadAllConfigs(), add safe accessors:

function getLeagues() {
  return (GAME && GAME.pvp && GAME.pvp.leagues) || [];
}

function getCards() {
  return (REWARDS && REWARDS.cards) || [];
}

function getPromoCodes() {
  return (REWARDS && REWARDS.promoCodes) || [];
}

function getCategoryColor(category) {
  return (
    UI &&
    UI.categoryColors &&
    UI.categoryColors[category]
  ) || '#ffffff';
}
```

These are optional — can be adopted incrementally when refactoring existing functions.

---

## Step 5: Bonus — validate guide page HTML meta consistency

Use a simple node script to check that all 7 pages have consistent meta tags:

**File: `scripts/validate-meta.js`** (new)

```js
const { readFileSync } = require('fs');
const path = require('path');

const PAGES = [
  'index.html',
  'guide/code/index.html',
  'guide/event/index.html',
  'guide/pvp/index.html',
  'guide/login/index.html',
  'guide/faq/index.html',
  'guide/beginners/index.html',
];

let hasError = false;

PAGES.forEach((page) => {
  const html = readFileSync(path.join(__dirname, '..', page), 'utf8');

  // Check required meta tags
  const checks = [
    ['og:title', html.includes('property="og:title"')],
    ['og:description', html.includes('property="og:description"')],
    ['og:url', html.includes('property="og:url"')],
    ['og:image', html.includes('property="og:image"')],
    ['twitter:card', html.includes('name="twitter:card"')],
    ['canonical', html.includes('rel="canonical"')],
    ['viewport', html.includes('name="viewport"')],
  ];

  const failures = checks.filter(([, passes]) => !passes).map(([name]) => name);
  if (failures.length > 0) {
    console.error(`✗ ${page}: Missing [${failures.join(', ')}]`);
    hasError = true;
  }
});

if (!hasError) {
  console.log('✓ All 7 pages pass meta validation');
}
process.exit(hasError ? 1 : 0);
```

**Add to `package.json`:**
```json
"validate:meta": "node scripts/validate-meta.js",
"validate": "npm run validate:meta"
```

---

## Files Modified/Created

| File | Status |
|------|--------|
| `script.js` | Add `CONFIG_SCHEMAS`, `validateConfig()`, integrate into `loadAllConfigs()`, add safe accessors |
| `scripts/validate-meta.js` | **New** — meta consistency checker |
| `package.json` | Add validate scripts |

---

## Verification

```bash
# Open index.html from file:// in dev mode
# Check browser console for validation messages:
#   [game-config] Validation passed ✓
#   [rewards-config] Validation passed ✓
#   ...

# Run meta validation:
node scripts/validate-meta.js
# Expected: ✓ All 7 pages pass meta validation
```
