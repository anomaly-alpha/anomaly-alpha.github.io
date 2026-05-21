# Plan 34: Playwright E2E Smoke Tests

**Problem:** No end-to-end tests exist. Manual testing is the only way to verify that the full user journey works: page loads, cards display, mode toggling works, charts render, PvP calculation is correct.

**Goal:** Set up Playwright with smoke tests covering the critical user journey.

---

## Step 1: Install Playwright

```bash
npm install --save-dev @playwright/test
npx playwright install chromium
```

## Step 2: Create Playwright config

```javascript
// playwright.config.js
module.exports = {
  testDir: './e2e',
  use: {
    baseURL: 'http://localhost:3000',
    viewport: { width: 1280, height: 720 },
  },
  webServer: {
    command: 'npx serve . -p 3000',
    port: 3000,
    reuseExistingServer: true,
  },
};
```

## Step 3: Write smoke tests

```javascript
// e2e/smoke.spec.js
const { test, expect } = require('@playwright/test');

test('page loads with all cards visible', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.gem-card')).toHaveCount(9);
});

test('mode toggle filters cards', async ({ page }) => {
  await page.goto('/');
  await page.click('[data-mode="event"]');
  const eventCards = await page.locator('[data-category="event"]').count();
  expect(eventCards).toBeGreaterThan(0);
});

test('PvP payout calculates correctly', async ({ page }) => {
  await page.goto('/');
  await page.selectOption('#pvp-1-league', 'eliteII');
  await page.selectOption('#pvp-1-rank', '13');
  const total = await page.locator('.gem-total-counter').textContent();
  expect(total).toContain('4,043');
});

test('charts render when toggled', async ({ page }) => {
  await page.goto('/');
  await page.click('#charts-toggle');
  await expect(page.locator('.gem-chart canvas')).toHaveCount(2);
});

test('theme toggle switches to light mode', async ({ page }) => {
  await page.goto('/');
  await page.click('[data-theme-toggle]');
  await expect(page.locator('body')).toHaveClass(/light-mode/);
});
```

## Step 4: Add test script

```json
// package.json
"test:e2e": "playwright test"
```

## Files Modified
- `playwright.config.js` — new file
- `e2e/smoke.spec.js` — new file
- `package.json` — test:e2e script

## Verification
```bash
npm run test:e2e
# Should show 5 passing tests
```
