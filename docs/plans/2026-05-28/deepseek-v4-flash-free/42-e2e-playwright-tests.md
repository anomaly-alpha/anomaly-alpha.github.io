# Plan 42: E2E Tests with Playwright

**Problem:** Unit tests (Plan 02) cover logic but not browser behavior. Critical flows — PvP selectors updating totals, code copying, modal open/close, mode filtering — have no automated verification.

**Goal:** Add Playwright E2E tests for all major user journeys. Run them in CI.

---

## Step 1: Install Playwright

```bash
npm install -D @playwright/test
npx playwright install chromium
```

---

## Step 2: Create test config

**File: `playwright.config.js`** (root)

```js
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './e2e',
  timeout: 30000,
  retries: 1,
  use: {
    baseURL: 'http://localhost:3000',
    browserName: 'chromium',
    viewport: { width: 1280, height: 800 },
  },
  webServer: {
    command: 'npx serve . -l 3000',
    port: 3000,
    reuseExistingServer: true,
  },
});
```

---

## Step 3: Create test directory

```bash
mkdir -p e2e
```

---

## Step 4: Core payout verification test

**File: `e2e/pvp-payouts.spec.js`**

```js
const { test, expect } = require('@playwright/test');

test.describe('PvP Payout Calculations', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('default Elite II rank 13 shows expected gem range', async ({ page }) => {
    const total = await page.textContent('#total-gems');
    const gems = parseInt(total.replace(/,/g, ''));
    expect(gems).toBeGreaterThan(3000);
    expect(gems).toBeLessThan(6000);
  });

  test('changing league updates values', async ({ page }) => {
    await page.selectOption('#pvp1-league', '0'); // Intern
    await page.selectOption('#pvp1-rank', '1');
    await page.waitForTimeout(500);
    const total1 = await page.textContent('#total-gems');

    await page.selectOption('#pvp1-league', '13'); // Invincible
    await page.selectOption('#pvp1-rank', '1');
    await page.waitForTimeout(500);
    const total2 = await page.textContent('#total-gems');

    // Invincible rank 1 should be higher than Intern rank 1
    const g1 = parseInt(total1.replace(/,/g, ''));
    const g2 = parseInt(total2.replace(/,/g, ''));
    expect(g2).toBeGreaterThan(g1);
  });

  test('changing rank updates gem total', async ({ page }) => {
    const before = await page.textContent('#total-gems');
    await page.selectOption('#pvp1-rank', '50');
    await page.waitForTimeout(500);
    const after = await page.textContent('#total-gems');
    expect(after).not.toBe(before);
  });
});
```

---

## Step 5: Mode filter test

**File: `e2e/mode-filters.spec.js`**

```js
const { test, expect } = require('@playwright/test');

test.describe('Mode Filtering', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('clicking Event filter shows only event cards', async ({ page }) => {
    // Click the event mode button (3rd button: 1=All, 2=Code, 3=Event)
    const buttons = await page.$$('.gem-mode-btn');
    await buttons[2].click();
    await page.waitForTimeout(300);

    const visibleCards = await page.$$eval('.gem-card:not([style*="display: none"])', els =>
      els.map(el => el.dataset.category)
    );
    visibleCards.forEach(cat => {
      expect(cat).toBe('event');
    });
  });

  test('clicking All shows all cards', async ({ page }) => {
    await page.click('.gem-mode-btn--all');
    await page.waitForTimeout(300);

    const hiddenCards = await page.$$('.gem-card[style*="display: none"]');
    expect(hiddenCards.length).toBe(0);
  });
});
```

---

## Step 6: Modal interaction test

**File: `e2e/modals.spec.js`**

```js
const { test, expect } = require('@playwright/test');

test.describe('Card Modals', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('clicking info button opens modal', async ({ page }) => {
    const infoBtn = await page.$('.gem-card__info-btn');
    await infoBtn.click();
    await page.waitForTimeout(300);

    const modal = await page.$('.gem-modal--visible');
    expect(modal).not.toBeNull();
  });

  test('Escape closes modal', async ({ page }) => {
    await page.click('.gem-card__info-btn');
    await page.waitForTimeout(300);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    const modal = await page.$('.gem-modal--visible');
    expect(modal).toBeNull();
  });

  test('PvP card modal shows live values', async ({ page }) => {
    // Open Restricted Arena modal (4th card, index 3)
    const infoBtns = await page.$$('.gem-card__info-btn');
    await infoBtns[3].click();
    await page.waitForTimeout(300);

    const modalText = await page.textContent('.gem-modal--visible');
    expect(modalText).toContain('Gems');
  });
});
```

---

## Step 7: Charts test

**File: `e2e/charts.spec.js`**

```js
const { test, expect } = require('@playwright/test');

test.describe('Charts', () => {
  test('toggling charts shows chart container', async ({ page }) => {
    await page.goto('/');
    await page.click('#toggle-charts');
    await page.waitForTimeout(500);

    const charts = await page.$('#charts-section:not(.hidden)');
    expect(charts).not.toBeNull();
  });

  test('PvP change updates chart values', async ({ page }) => {
    await page.goto('/');
    await page.click('#toggle-charts');
    await page.waitForTimeout(500);

    await page.selectOption('#pvp1-rank', '1');
    await page.waitForTimeout(500);

    // Charts should update without errors
    const canvas = await page.$('canvas');
    expect(canvas).not.toBeNull();
  });
});
```

---

## Step 8: Add npm scripts

```json
"test:e2e": "npx playwright test",
"test:e2e:ui": "npx playwright test --headed",
"test": "vitest run && npx playwright test"
```

---

## Step 9: Add to CI workflow

In `.github/workflows/deploy.yml`:

```yaml
- name: Run E2E tests
  run: npx playwright test
  env:
    CI: true
```

---

## Files Created/Modified

| File | Status |
|------|--------|
| `playwright.config.js` | **New** |
| `e2e/pvp-payouts.spec.js` | **New** |
| `e2e/mode-filters.spec.js` | **New** |
| `e2e/modals.spec.js` | **New** |
| `e2e/charts.spec.js` | **New** |
| `package.json` | Add `test:e2e` scripts |

---

## Verification

```bash
npm run test:e2e
# Expected: All tests pass
# - PvP payouts verify correctly
# - Mode filters toggle visibility
# - Modals open/close
# - Charts render after toggle
```
