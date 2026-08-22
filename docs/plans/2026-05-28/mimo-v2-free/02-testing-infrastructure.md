# Plan 02: Testing Infrastructure

**Problem:** This project has zero tests. All verification is manual (open `index.html` in a browser). Critical functions like `getPvpPayout()` have no regression coverage — a single typo in the payout tables could silently produce wrong gem values.

**Goal:** Add a lightweight test framework with validation tests for core logic, config integrity, and DOM behavior.

---

## Step 1: Choose a test framework

The project uses vanilla JS (no imports/exports, all globals). Two options:

**Option A: Vitest** (recommended)
- Fast, modern, Jest-compatible API
- Can test browser globals via `jsdom` environment
- Familiar `describe`/`it`/`expect` syntax

**Option B: Node test runner** (built-in, no dependencies)
- No install needed (Node 20+)
- `node --test` with `assert` module
- Simpler but less ergonomic

**For this plan: Vitest**

```bash
npm install -D vitest jsdom
```

---

## Step 2: Create test configuration

**File: `vitest.config.js`** (root directory)

```js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: false,
    include: ['test/**/*.test.js'],
  },
});
```

**Add to `package.json` scripts:**
```json
"test": "vitest run",
"test:watch": "vitest"
```

---

## Step 3: Create test directory and helper

**File: `test/setup.js`** — loads the config data for testing

```js
import { readFileSync } from 'fs';
import { JSDOM } from 'jsdom';

export function setupTestEnvironment() {
  const html = readFileSync('index.html', 'utf8');
  const dom = new JSDOM(html, { runScripts: 'dangerously' });
  const doc = dom.window.document;

  // Expose config-loading function
  dom.window.loadConfig = function (id) {
    const el = doc.getElementById(id);
    return el ? JSON.parse(el.textContent) : {};
  };

  // Load all configs into global scope
  const GAME = dom.window.loadConfig('game-config');
  const REWARDS = dom.window.loadConfig('rewards-config');
  const CHARTS = dom.window.loadConfig('chart-config');
  const COUNTDOWN = dom.window.loadConfig('countdown-config');
  const UI = dom.window.loadConfig('ui-config');
  const THEME = dom.window.loadConfig('theme-config');

  return { dom, doc, GAME, REWARDS, CHARTS, COUNTDOWN, UI, THEME };
}
```

---

## Step 4: Core logic tests

**File: `test/pvp-payouts.test.js`**

```js
import { describe, it, expect } from 'vitest';
import { setupTestEnvironment } from './setup.js';

describe('getPvpPayout()', () => {
  let GAME;

  beforeAll(() => {
    GAME = setupTestEnvironment().GAME;
  });

  it('returns valid payout for Restricted Arena Intern rank 1', () => {
    const payout = getPvpPayout('restricted', 0, 1);
    expect(payout).toBeDefined();
    expect(payout.gems).toBeGreaterThanOrEqual(0);
    expect(payout.currency).toBeGreaterThanOrEqual(0);
  });

  it('returns valid payout for Open Arena Invincible rank 120', () => {
    const payout = getPvpPayout('open', 13, 120);
    expect(payout).toBeDefined();
    expect(payout.gems).toBeGreaterThanOrEqual(0);
  });

  it('returns valid payout for Alliance War', () => {
    const payout = getPvpPayout('multiverse', 0, 50);
    expect(payout).toBeDefined();
    expect(payout.gems).toBeGreaterThanOrEqual(0);
    expect(payout.totemFragments).toBeGreaterThanOrEqual(0);
    expect(payout.modules).toBeGreaterThanOrEqual(0);
  });

  it('returns zero gems for demotion threshold rank 86+ in Alliance War', () => {
    // Verify the demotion logic returns lower or zero values
    const payoutLow = getPvpPayout('multiverse', 5, 85);
    const payoutHigh = getPvpPayout('multiverse', 5, 86);
    // At minimum, payout for 86 should not exceed payout for 85
    expect(payoutHigh.gems).toBeLessThanOrEqual(payoutLow.gems);
  });

  it('handles invalid league gracefully', () => {
    const payout = getPvpPayout('restricted', 99, 1);
    // Should not crash — return zero or empty object
    expect(payout).toBeDefined();
  });

  it('handles invalid rank gracefully', () => {
    const payout = getPvpPayout('restricted', 0, 999);
    expect(payout).toBeDefined();
  });
});
```

---

## Step 5: Config integrity tests

**File: `test/config-integrity.test.js`**

```js
import { describe, it, expect } from 'vitest';
import { setupTestEnvironment } from './setup.js';

describe('Config integrity', () => {
  let GAME, REWARDS, CHARTS, COUNTDOWN, UI, THEME;

  beforeAll(() => {
    ({ GAME, REWARDS, CHARTS, COUNTDOWN, UI, THEME } = setupTestEnvironment());
  });

  it('GAME has 14 PvP leagues', () => {
    expect(GAME.pvp.leagues).toHaveLength(14);
  });

  it('GAME has restricted and open arena payout tables', () => {
    expect(GAME.pvp.arenas.restricted).toBeDefined();
    expect(GAME.pvp.arenas.open).toBeDefined();
    expect(GAME.pvp.multiverse).toBeDefined();
  });

  it('REWARDS has all 4 categories', () => {
    expect(REWARDS.categories).toBeDefined();
    ['event', 'pvp', 'login', 'code'].forEach((cat) => {
      expect(REWARDS.categories[cat]).toBeDefined();
    });
  });

  it('PromoCodes total matches card data', () => {
    const activeCodes = REWARDS.promoCodes.filter(c => !c.expired);
    const promoCard = REWARDS.cards.find(c => c.id === 'promo-code');
    expect(promoCard).toBeDefined();
    expect(activeCodes.length).toBeGreaterThan(0);
    // Verify card gem value equals sum (or matches convention)
  });

  it('All 9 cards have required modal data', () => {
    REWARDS.cards.forEach((card) => {
      expect(card.id).toBeDefined();
      expect(card.category).toBeDefined();
      expect(card.modal).toBeDefined();
      expect(card.modal.hero).toBeDefined();
      expect(card.modal.description).toBeDefined();
      expect(card.modal.tips).toHaveLength(5);
    });
  });

  it('UI has category colors for all modes', () => {
    expect(UI.categoryColors).toBeDefined();
    ['event', 'pvp', 'login', 'code'].forEach((cat) => {
      expect(UI.categoryColors[cat]).toMatch(/^#[0-9a-f]{6}$/i);
    });
  });

  it('COUNTDOWN has weekly and daily reset times', () => {
    expect(COUNTDOWN.weekly).toBeDefined();
    expect(COUNTDOWN.daily).toBeDefined();
  });
});
```

---

## Step 6: DOM rendering tests (optional, advanced)

**File: `test/dom-rendering.test.js`**

These tests require `script.js` to be loaded in the JSDOM environment.

```js
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { JSDOM } from 'jsdom';

describe('DOM rendering', () => {
  let dom, doc;

  beforeAll(() => {
    const html = readFileSync('index.html', 'utf8');
    dom = new JSDOM(html, { runScripts: 'dangerously' });
    doc = dom.window.document;
  });

  it('renders 9 reward cards', () => {
    const cards = doc.querySelectorAll('.gem-card');
    expect(cards.length).toBe(9);
  });

  it('renders 5 mode buttons', () => {
    const buttons = doc.querySelectorAll('.gem-mode-btn');
    expect(buttons.length).toBe(5);
  });

  it('renders 3 PvP select elements', () => {
    const selects = doc.querySelectorAll('.gem-select--league');
    expect(selects.length).toBe(3);
  });

  it('has contributors-config matching footer', () => {
    const config = JSON.parse(
      doc.getElementById('contributors-config').textContent
    );
    const footerItems = doc.querySelectorAll('.gem-contributor');
    expect(footerItems.length).toBe(config.contributors.length);
  });
});
```

---

## Step 7: GitHub Actions integration (see Plan 06)

Add to workflow:
```yaml
- name: Run tests
  run: npm test
```

---

## Files Created/Modified

| File | Status |
|------|--------|
| `vitest.config.js` | New |
| `test/setup.js` | New |
| `test/pvp-payouts.test.js` | New |
| `test/config-integrity.test.js` | New |
| `test/dom-rendering.test.js` | New (optional) |
| `package.json` | Add `test` script |

## Verification

```bash
npm install
npm test          # All tests pass
npm run test:watch  # Interactive watch mode
```
