# Plan 70: Mobile-Friendly Test Automation

**Problem:** Mobile-friendliness is checked manually. No automated test verifies that the site passes Google's Mobile-Friendly Test criteria.

**Goal:** Add an automated mobile-friendliness check to the CI pipeline.

---

## Step 1: Create mobile test script

```javascript
// scripts/mobile-test.js
const puppeteer = require('puppeteer');
const path = require('path');

const MOBILE_VIEWPORTS = [
  { name: 'iPhone SE', width: 375, height: 667 },
  { name: 'iPhone 12', width: 390, height: 844 },
  { name: 'Pixel 5', width: 393, height: 851 },
  { name: 'iPad', width: 768, height: 1024 },
];

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  let issues = 0;

  for (const vp of MOBILE_VIEWPORTS) {
    const page = await browser.newPage();
    await page.setViewport({ width: vp.width, height: vp.height });
    await page.goto('file://' + path.resolve(__dirname, '../index.html'));

    // Check for horizontal scroll
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    if (scrollWidth > viewportWidth) {
      console.error(`HORIZONTAL SCROLL: ${vp.name} (${scrollWidth}px > ${viewportWidth}px)`);
      issues++;
    }

    // Check touch targets
    const smallTargets = await page.evaluate(() => {
      const elements = document.querySelectorAll('button, a, [onclick]');
      const small = [];
      elements.forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.width < 44 || rect.height < 44) {
          small.push(el.className || el.tagName);
        }
      });
      return small;
    });

    if (smallTargets.length > 0) {
      console.error(`SMALL TOUCH TARGETS on ${vp.name}: ${smallTargets.join(', ')}`);
      issues += smallTargets.length;
    }

    await page.close();
  }

  await browser.close();

  if (issues === 0) {
    console.log('Mobile-friendly checks passed ✓');
  } else {
    console.error(`\n${issues} issue(s) found`);
    process.exit(1);
  }
})();
```

## Step 2: Add to CI

```json
// package.json
"test:mobile": "node scripts/mobile-test.js"
```

## Files Modified
- `scripts/mobile-test.js` — new file
- `package.json` — test:mobile script

## Verification
```bash
npm run test:mobile
# Should pass on all mobile viewports
```
