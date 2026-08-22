# Plan 04: Accessibility Audit with axe-core

**Problem:** No automated accessibility testing exists. Pages likely have WCAG 2.2 violations around color contrast, focus management, and ARIA attributes that are hard to catch manually.

**Goal:** Integrate axe-core into CI, run a full audit on all 8 pages, and fix all critical and serious violations.

---

## Step 1: Add axe-core to the project
Install `@axe-core/playwright` and configure it in the existing Playwright setup.

```bash
npm install --save-dev @axe-core/playwright
```

Update `tests/a11y.spec.js`:

```javascript
const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;

const PAGES = [
  { name: 'home', url: 'file:///Users/prime/Desktop/Gems/anomaly-alpha/index.html' },
  { name: 'code-guide', url: 'file:///Users/prime/Desktop/Gems/anomaly-alpha/guide/code/index.html' },
  { name: 'event-guide', url: 'file:///Users/prime/Desktop/Gems/anomaly-alpha/guide/event/index.html' },
  { name: 'pvp-guide', url: 'file:///Users/prime/Desktop/Gems/anomaly-alpha/guide/pvp/index.html' },
  { name: 'login-guide', url: 'file:///Users/prime/Desktop/Gems/anomaly-alpha/guide/login/index.html' },
  { name: 'faq-guide', url: 'file:///Users/prime/Desktop/Gems/anomaly-alpha/guide/faq/index.html' },
  { name: 'beginners-guide', url: 'file:///Users/prime/Desktop/Gems/anomaly-alpha/guide/beginners/index.html' },
];

for (const page of PAGES) {
  test(`${page.name} has no critical accessibility violations`, async ({ page: pw }) => {
    await pw.goto(page.url);
    await pw.waitForLoadState('domcontentloaded');

    const results = await new AxeBuilder({ page: pw })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    const critical = results.violations.filter(v => v.impact === 'critical');
    const serious = results.violations.filter(v => v.impact === 'serious');

    if (critical.length > 0 || serious.length > 0) {
      console.log(`VIOLATIONS on ${page.name}:`, JSON.stringify(results.violations, null, 2));
    }

    expect(critical).toHaveLength(0);
    expect(serious).toHaveLength(0);
  });
}
```

## Step 2: Run audit and fix violations
Run the tests to see all violations:

```bash
npx playwright test tests/a11y.spec.js --reporter=list
```

Common fixes expected:
- **Color contrast**: Ensure text on card backgrounds meets 4.5:1 ratio
- **Focus visible**: Add `outline: 2px solid var(--gem-cyan)` to `:focus` styles
- **aria-expanded**: Add to all collapsible elements (modal toggle buttons)
- **aria-label**: Add descriptive labels to icon-only buttons
- **Heading order**: Ensure h1 > h2 > h3 hierarchy is maintained

## Step 3: Add to CI
Update `package.json` scripts:

```json
{
  "scripts": {
    "test:a11y": "playwright test tests/a11y.spec.js --reporter=list"
  }
}
```

Add to `.github/workflows/ci.yml` (see Plan 06):

```yaml
- run: npm run test:a11y
```

## Files Modified
- `package.json` — add @axe-core/playwright, add test:a11y script
- `tests/a11y.spec.js` — new file

## Verification
```bash
npm run test:a11y
# All pages pass with 0 critical + 0 serious violations
```