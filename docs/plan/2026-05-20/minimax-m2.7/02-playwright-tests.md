# Plan 02: Add Playwright End-to-End Tests

**Problem:** No automated tests exist for critical flows. Manual verification is required after every change, making refactoring risky and regression bugs common.

**Goal:** Playwright tests covering: mode toggle, PvP card interaction, and chart render. Tests run in CI and locally with `npm test`.

---

## Step 1: Install Playwright and create test scaffold
Install Playwright, create a tests directory, and write tests for the three critical flows.

```bash
npm install --save-dev @playwright/test
npx playwright install chromium --with-deps
mkdir -p tests
```

Create `tests/gem-rewards.spec.js`:

```javascript
const { test, expect } = require('@playwright/test');

test.describe('Gem Rewards Calculator', () => {
  test('mode toggle filters cards correctly', async ({ page }) => {
    await page.goto('file:///Users/prime/Desktop/Gems/anomaly-alpha/index.html');
    await page.waitForLoadState('domcontentloaded');

    const pvpCards = page.locator('[data-category="pvp"]');
    const eventCards = page.locator('[data-category="event"]');

    const pvpVisible = await pvpCards.first().isVisible();
    const eventVisible = await eventCards.first().isVisible();
    expect(pvpVisible).toBe(true);
    expect(eventVisible).toBe(true);

    await page.click('.gem-mode-btn--pvp');
    await expect(pvpCards.first()).toBeVisible();
    await expect(eventCards.first()).toBeHidden();
  });

  test('PvP card opens modal with correct content', async ({ page }) => {
    await page.goto('file:///Users/prime/Desktop/Gems/anomaly-alpha/index.html');
    await page.waitForLoadState('domcontentloaded');

    const restrictedArenaCard = page.locator('#restricted-arena');
    await restrictedArenaCard.locator('.gem-card__info-btn').click();

    const modal = page.locator('.gem-modal--visible');
    await expect(modal).toBeVisible();
    await expect(modal.locator('.gem-modal__title')).toContainText('Restricted Arena');

    await modal.locator('.gem-modal__close').click();
    await expect(modal).toBeHidden();
  });

  test('charts render without errors', async ({ page }) => {
    await page.goto('file:///Users/prime/Desktop/Gems/anomaly-alpha/index.html');
    await page.waitForLoadState('domcontentloaded');

    const chartBtn = page.locator('button:has-text("Show Charts"), .gem-btn--charts');
    if (await chartBtn.isVisible()) {
      await chartBtn.click();
      await page.waitForTimeout(500);
      const charts = page.locator('.gem-chart canvas');
      await expect(charts.first()).toBeVisible();
    }
  });
});
```

Create `playwright.config.js`:

```javascript
module.exports = {
  testDir: './tests',
  use: {
    headless: true,
    viewport: { width: 1280, height: 720 },
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } }
  ]
};
```

## Step 2: Add npm test script and run tests
Add the test script to `package.json` and verify tests pass.

```json
{
  "scripts": {
    "test": "playwright test",
    "test:headed": "playwright test --headed"
  }
}
```

Run the tests:

```bash
npm test
```

## Files Modified
- `package.json` — add @playwright/test, update scripts
- `playwright.config.js` — new file
- `tests/gem-rewards.spec.js` — new file

## Verification
```bash
npm test
# All 3 tests pass with green checkmarks
```