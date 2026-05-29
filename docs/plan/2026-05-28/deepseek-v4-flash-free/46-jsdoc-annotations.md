# Plan 46: JSDoc Annotations

**Problem:** The JS has no type annotations. All 40+ functions have implicit parameter types and return values. This makes the code harder to understand, refactor, and lint effectively. Editors provide no autocomplete or parameter hints.

**Goal:** Add JSDoc annotations to all public functions. This enables editor intellisense, type checking (with `// @ts-check`), and clearer documentation.

---

## Step 1: Add `@ts-check` to enable TypeScript-level checking

**At the top of `script.src.js`:**

```js
// @ts-check
```

This enables the TypeScript compiler to check JSDoc-annotated JS for type errors.

---

## Step 2: Annotate core functions

**`loadConfig()`:**
```js
/**
 * Loads and parses an inline JSON config by element ID.
 * @param {string} id - The element ID of the <script type="application/json"> tag
 * @returns {object} Parsed config object, or empty object if not found
 */
function loadConfig(id) { ... }
```

**`getPvpPayout()`:**
```js
/**
 * Get PvP payout for a given arena, league, and rank.
 * @param {'restricted'|'open'|'multiverse'} arena - Arena type
 * @param {number} leagueId - League index (0-13)
 * @param {number} rank - Rank position (1-120)
 * @returns {{gems: number, currency?: number, tickets?: number, totemFragments?: number, modules?: number}}
 */
function getPvpPayout(arena, leagueId, rank) { ... }
```

**`filterCards()`:**
```js
/**
 * Filter displayed cards by mode.
 * @param {string} mode - Mode name ('all', 'event', 'pvp', 'login', 'code')
 * @param {Event} [event] - Optional click event (for button highlighting)
 * @returns {void}
 */
function filterCards(mode, event) { ... }
```

**`animateValue()`:**
```js
/**
 * Animate a number counter from start to end.
 * @param {HTMLElement} element - DOM element to update
 * @param {number} start - Starting value
 * @param {number} end - Ending value
 * @param {number} duration - Animation duration in ms
 * @returns {void}
 */
function animateValue(element, start, end, duration) { ... }
```

---

## Step 3: Annotate config-related functions

**`loadAllConfigs()`:**
```js
/**
 * Load all inline JSON configs into global variables.
 * @returns {void}
 * @global GAME - Game configuration (leagues, arenas, payouts)
 * @global REWARDS - Rewards configuration (categories, cards, codes)
 * @global CHARTS - Chart.js configuration (colors, labels)
 * @global COUNTDOWN - Countdown timer configuration
 * @global UI - UI configuration (colors, modes, layout)
 * @global THEME - Theme configuration (dark/light tokens)
 */
function loadAllConfigs() { ... }
```

---

## Step 4: Annotate PvP card functions

```js
/**
 * @param {string} id - Card ID ('pvp1', 'pvp2', or 'pvp3')
 * @returns {void}
 */
function updatePvpCard(id) { ... }

/**
 * @param {number} cardId - Card index (0-2)
 */
function updatePvpCardById(cardId) { ... }
```

---

## Step 5: Annotate modal functions

```js
/**
 * Open a card modal by card ID.
 * @param {string} cardId - Card ID from REWARDS.cards (e.g., 'restricted-arena')
 * @returns {void}
 */
function showCardModal(cardId) { ... }

/**
 * Close the currently open modal.
 * @returns {void}
 */
function closeCardModal() { ... }

/**
 * Find card data by ID from REWARDS.cards.
 * @param {string} id - Card ID to find
 * @returns {object|undefined} Card object or undefined
 */
function findCardById(id) { ... }
```

---

## Step 6: Annotate chart functions

```js
/**
 * Update all charts based on selected modes.
 * @param {string[]} modes - Array of mode names
 * @returns {void}
 */
function updateChartsByModes(modes) { ... }

/**
 * Initialize Chart.js charts (called after Chart.js loads).
 * @returns {void}
 */
function initCharts() { ... }

/**
 * Dynamically load Chart.js from vendor file.
 * @returns {void}
 */
function loadChartJs() { ... }
```

---

## Step 7: Annotate state management

```js
/**
 * Save current page state to localStorage.
 * @returns {void}
 */
function savePageState() { ... }

/**
 * Load page state from localStorage and URL params.
 * @returns {void}
 */
function loadPageState() { ... }
```

---

## Step 8: Verify with TypeScript checking

Add a script to run the TypeScript compiler in check mode:

```json
"typecheck": "tsc --noEmit --allowJs --checkJs script.src.js"
```

If `typescript` is not installed:
```bash
npm install -D typescript
```

Create a minimal `tsconfig.json` for the check:

```json
{
  "compilerOptions": {
    "target": "ES2021",
    "module": "none",
    "allowJs": true,
    "checkJs": true,
    "noEmit": true,
    "strict": false,
    "lib": ["ES2021", "DOM"]
  },
  "include": ["script.src.js"]
}
```

---

## Step 9: Add to CI

```yaml
- name: Type-check JS
  run: npm run typecheck
```

---

## Files Modified

| File | Change |
|------|--------|
| `script.src.js` | Add JSDoc annotations to all functions, add `// @ts-check` |
| `tsconfig.json` | **New** |
| `package.json` | Add `typecheck` script |

---

## Verification

```bash
npm run typecheck
# Expected: No type errors (or only pre-existing implicit-any warnings)

# Editor check:
# In VS Code, open script.src.js
# Hover over function calls — should see parameter types and return types
```
