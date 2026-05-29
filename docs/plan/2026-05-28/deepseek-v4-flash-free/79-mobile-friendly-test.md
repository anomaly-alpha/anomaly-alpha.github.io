# Plan 79: Mobile-Friendly Test Automation

**Problem:** The site should be mobile-friendly (responsive, touch-optimized), but there's no automated mobile-friendly test. Google's Mobile-Friendly Test is manual.

**Goal:** Add automated mobile-friendly checks using Playwright's mobile emulation and Google's mobile-friendly test API.

---

## Step 1: Add mobile viewport test to Playwright

**In `e2e/mobile-friendly.spec.js`**:

```js
const { test, expect } = require('@playwright/test');

test.describe('Mobile-friendly checks', () => {
  test.use({ viewport: { width: 375, height: 667 } }); // iPhone SE

  test('no horizontal scroll on mobile', async ({ page }) => {
    await page.goto('/');
    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    const vpWidth = await page.evaluate(() => window.innerWidth);
    expect(width).toBeLessThanOrEqual(vpWidth + 1);
  });

  test('PvP selectors usable on mobile', async ({ page }) => {
    await page.goto('/');
    await page.selectOption('#pvp1-league', '5');
    await page.waitForTimeout(300);
    const total = await page.textContent('#total-gems');
    expect(total).toBeTruthy();
  });

  test('promo code buttons tapable on mobile', async ({ page }) => {
    await page.goto('/');
    const promoCard = await page.$('#card-promo-code');
    await promoCard.click();
    await page.waitForTimeout(300);
    // Verify codes are visible
    const codes = await page.$$('.gem-code__value');
    expect(codes.length).toBeGreaterThan(0);
  });

  test('modals fit mobile viewport', async ({ page }) => {
    await page.goto('/');
    await page.click('.gem-card__info-btn');
    await page.waitForTimeout(300);
    const modalHeight = await page.evaluate(() => {
      const m = document.querySelector('.gem-modal--visible');
      return m ? m.offsetHeight : 0;
    });
    expect(modalHeight).toBeLessThan(667);
  });
});
```

---

## Step 2: Add Google Mobile-Friendly Test API check (optional)

```yaml
- name: Mobile-friendly test
  run: |
    curl -s "https://searchconsole.googleapis.com/v1/urlTestingTools/mobileFriendlyTest:run?key=${{ secrets.GOOGLE_API_KEY }}" \
      -H "Content-Type: application/json" \
      -d '{"url": "https://anomaly-alpha.github.io/", "requestScreenshot": false}' \
      | grep -q "MOBILE_FRIENDLY" && echo "✓ Mobile-friendly" || echo "✗ Not mobile-friendly"
```

---

## Step 3: Add to CI

```yaml
- name: Mobile E2E tests
  run: npx playwright test e2e/mobile-friendly.spec.js
```

---

## Files Created: `e2e/mobile-friendly.spec.js`, `.github/workflows/deploy.yml` (updated)
