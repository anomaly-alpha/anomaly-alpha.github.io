# Plan 44: axe-core Accessibility CI

**Problem:** Accessibility checks are manual (Lighthouse a11y audit). There's no automated test for WCAG violations like missing labels, incorrect ARIA attributes, or insufficient color contrast.

**Goal:** Add axe-core automated accessibility testing in CI. Fail the build on critical/serious violations.

---

## Step 1: Install axe-core

```bash
npm install -D @axe-core/playwright
```

Or use the CLI tool:
```bash
npm install -D axe-cli
```

---

## Step 2: Create axe test (Playwright integration)

**File: `e2e/accessibility.spec.js`**

```js
const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;

const PAGES = [
  { path: '/', name: 'Home' },
  { path: '/guide/code/', name: 'Code Guide' },
  { path: '/guide/event/', name: 'Event Guide' },
  { path: '/guide/pvp/', name: 'PvP Guide' },
  { path: '/guide/login/', name: 'Login Guide' },
  { path: '/guide/faq/', name: 'FAQ Guide' },
  { path: '/guide/beginners/', name: 'Beginners Guide' },
  { path: '/404.html', name: '404 Page' },
];

PAGES.forEach(({ path, name }) => {
  test(`${name}: no critical accessibility violations`, async ({ page }) => {
    await page.goto(path);

    // Open modal on main page to test modal a11y
    if (path === '/') {
      const infoBtn = await page.$('.gem-card__info-btn');
      if (infoBtn) await infoBtn.click();
      await page.waitForTimeout(300);
    }

    const results = await new AxeBuilder({ page }).analyze();

    // Filter to only violations (not incomplete)
    const violations = results.violations;

    if (violations.length > 0) {
      console.log(`\n=== ${name}: ${violations.length} violation(s) ===`);
      violations.forEach(v => {
        console.log(`  ${v.help} (${v.impact})`);
        v.nodes.forEach(n => {
          console.log(`    - ${n.target.join(', ')}`);
        });
      });
    }

    // No critical or serious violations
    const critical = violations.filter(v => v.impact === 'critical' || v.impact === 'serious');
    expect(critical).toEqual([]);
  });
});
```

---

## Step 3: Add standalone axe audit script

**File: `scripts/axe-audit.js`** (for CI without Playwright)

```js
const { execSync } = require('child_process');

const PAGES = [
  'https://anomaly-alpha.github.io/',
  'https://anomaly-alpha.github.io/guide/code/',
  'https://anomaly-alpha.github.io/guide/event/',
  'https://anomaly-alpha.github.io/guide/pvp/',
  'https://anomaly-alpha.github.io/guide/login/',
  'https://anomaly-alpha.github.io/guide/faq/',
  'https://anomaly-alpha.github.io/guide/beginners/',
  'https://anomaly-alpha.github.io/404.html',
];

PAGES.forEach(url => {
  console.log(`Auditing: ${url}`);
  try {
    const output = execSync(`npx axe ${url} --exit --show-errors`, {
      encoding: 'utf8',
      timeout: 30000,
    });
    console.log(output);
  } catch (err) {
    console.error(`✗ ${url}:`, err.stderr || err.message);
  }
});
```

---

## Step 4: Add npm scripts

```json
"test:a11y": "npx playwright test e2e/accessibility.spec.js",
"test:a11y:ci": "node scripts/axe-audit.js"
```

---

## Step 5: Add to CI workflow

```yaml
- name: Accessibility audit (axe-core)
  run: npx playwright test e2e/accessibility.spec.js
  env:
    CI: true
```

---

## Step 6: Fix any violations found

Initial run may find violations. Common fixes:

- **Missing form labels**: Add `aria-label` or `<label>` to selects
- **Insufficient contrast**: Adjust token values
- **Missing heading levels**: Add missing `<h2>`/`<h3>` elements
- **ARIA attributes**: Audit and fix invalid ARIA usage

Fix each violation and re-run until all pass.

---

---

## WCAG Technique References for Violation Fixes

When axe-core finds violations, use these WCAG techniques for fixes:

| axe Rule | WCAG SC | Common Fix |
|----------|---------|------------|
| `color-contrast` | 1.4.3 | Adjust `--gem-text--secondary` opacity to ≥ 0.66 |
| `link-name` | 2.4.4 / 4.1.2 | Add `aria-label` to icon-only links |
| `button-name` | 4.1.2 | Add `aria-label` to icon buttons |
| `image-alt` | 1.1.1 | Add `alt` or `role="presentation"` to SVGs |
| `heading-order` | 1.3.1 | Reorder h2/h3 to avoid skips |
| `label` | 1.3.1 / 3.3.2 | Add `<label>` or `aria-label` to selects |
| `landmark-one-main` | 1.3.1 | Ensure exactly one `<main>` per page |
| `region` | 1.3.1 | Wrap content in semantic landmarks |
| `tabindex` | 2.4.3 | Remove positive `tabindex` values |
| `scrollable-region-focusable` | 2.1.1 | Ensure scrollable containers are keyboard-accessible |
| `aria-valid-attr` | 4.1.2 | Fix misspelled ARIA attributes |
| `aria-required-children` | 1.3.1 | Add required child roles to ARIA widgets |
| `bypass` | 2.4.1 | Add skip-to-content link (Plan 04 Step 1) |

### Running a Full WCAG Audit

```bash
# Automated (axe-core):
npm run test:a11y

# Semi-automated (Lighthouse):
npx lhci collect --preset=desktop --only-audits=accessibility

# Manual (WCAG 2.2 checklist):
# Use the full WCAG quickref: https://www.w3.org/WAI/WCAG22/quickref/
# Focus on criteria marked as untestable by axe:
# - 1.4.1 Use of Color (manual review)
# - 2.4.7 Focus Visible (manual check)
# - 3.2.3 Consistent Navigation (visual review)
# - 3.2.4 Consistent Identification (visual review)
```

### Accessibility Budget

| Level | Violations Allowed | Action |
|-------|-------------------|--------|
| Critical | 0 | Block PR merge |
| Serious | 0 | Block PR merge |
| Moderate | ≤ 2 | Warning, fix before release |
| Minor | ≤ 5 | Document for backlog |

---

## Step 7: Generate a11y report artifact

In CI, save the axe results as a build artifact:

```yaml
- name: Run a11y audit
  run: npx playwright test e2e/accessibility.spec.js --reporter=json 2>&1 | tee a11y-report.json

- name: Upload a11y report
  uses: actions/upload-artifact@v4
  with:
    name: a11y-report
    path: a11y-report.json
```

---

## Files Created/Modified

| File | Status |
|------|--------|
| `e2e/accessibility.spec.js` | **New** |
| `scripts/axe-audit.js` | **New** |
| `package.json` | Add `test:a11y` scripts |
| `.github/workflows/deploy.yml` | Add a11y audit step |

---

## Verification

```bash
# Run a11y tests:
npm run test:a11y

# Expected:
# ✓ Home: no critical accessibility violations
# ✓ Code Guide: no critical accessibility violations
# ✓ Event Guide: no critical accessibility violations
# ✓ PvP Guide: no critical accessibility violations
# ✓ Login Guide: no critical accessibility violations
# ✓ FAQ Guide: no critical accessibility violations
# ✓ Beginners Guide: no critical accessibility violations
# ✓ 404 Page: no critical accessibility violations
```
