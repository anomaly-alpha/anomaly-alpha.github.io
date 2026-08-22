# Plan 36: Accessibility CI Gate

**Problem:** No automated accessibility testing in CI. A11y regressions (missing alt text, broken focus order, insufficient contrast) ship without detection.

**Goal:** Add axe-core accessibility testing to CI as a blocking gate.

---

## Step 1: Install axe-core CLI

```bash
npm install --save-dev @axe-core/cli
```

## Step 2: Add a11y test script

```json
// package.json
"test:a11y": "axe http://localhost:3000 --exit --load-delay=1000"
```

## Step 3: Create a11y test script for all pages

```javascript
// scripts/a11y-test.js
const { AxePuppeteer } = require('@axe-core/puppeteer');
const puppeteer = require('puppeteer');
const path = require('path');

const PAGES = [
  '/',
  '/guide/code/',
  '/guide/event/',
  '/guide/pvp/',
  '/guide/login/',
  '/guide/faq/',
  '/guide/beginners/',
];

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  let violations = 0;

  for (const pagePath of PAGES) {
    const page = await browser.newPage();
    await page.goto('file://' + path.resolve(__dirname, '..') + (pagePath === '/' ? '/index.html' : pagePath));

    const results = await new AxePuppeteer(page).analyze();
    results.violations.forEach(v => {
      console.error(`VIOLATION: ${v.id} — ${v.description}`);
      v.nodes.forEach(n => console.error(`  → ${n.html}`));
      violations++;
    });
    await page.close();
  }

  await browser.close();

  if (violations > 0) {
    console.error(`\n${violations} accessibility violation(s) found`);
    process.exit(1);
  }
  console.log('All accessibility checks passed ✓');
})();
```

## Step 4: Add to CI

```yaml
# .github/workflows/ci.yml
- name: Accessibility audit
  run: npm run test:a11y
```

## Files Modified
- `scripts/a11y-test.js` — new file
- `package.json` — test:a11y script

## Verification
```bash
npm run test:a11y
# Should pass or show specific violations to fix
```
