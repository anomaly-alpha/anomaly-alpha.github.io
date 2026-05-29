# Plan 43: Lighthouse CI

**Problem:** Lighthouse scores are manually checked. There's no automated regression detection — a change that drops performance from 100 to 90 would go unnoticed until someone runs a manual audit.

**Goal:** Add Lighthouse CI to automatically run audits on every PR and report score changes. Fail the build if scores drop below thresholds.

---

## Step 1: Install Lighthouse CI

```bash
npm install -D @lhci/cli
```

---

## Step 2: Create Lighthouse CI config

**File: `lighthouserc.js`** (root)

```js
module.exports = {
  ci: {
    collect: {
      startServerCommand: 'npx serve . -l 3000',
      url: [
        'http://localhost:3000/',
        'http://localhost:3000/guide/code/',
        'http://localhost:3000/guide/event/',
        'http://localhost:3000/guide/pvp/',
        'http://localhost:3000/guide/login/',
        'http://localhost:3000/guide/faq/',
        'http://localhost:3000/guide/beginners/'
      ],
      numberOfRuns: 1,
      settings: {
        preset: 'desktop',
        onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo']
      }
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.95 }],
        'categories:accessibility': ['error', { minScore: 0.95 }],
        'categories:best-practices': ['error', { minScore: 0.90 }],
        'categories:seo': ['error', { minScore: 0.95 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.01 }],
        'total-blocking-time': ['error', { maxNumericValue: 50 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
      }
    },
    upload: {
      target: 'filesystem',
      outputDir: './lhci-reports'
    }
  }
};
```

---

## Step 3: Add npm scripts

```json
"test:lighthouse": "npx lhci autorun",
"test:lighthouse:collect": "npx lhci collect",
"test:lighthouse:assert": "npx lhci assert"
```

---

## Step 4: Run baseline audit

```bash
npx lhci autorun
# Expected: All 7 pages pass with scores >= thresholds
# Reports saved to ./lhci-reports/
```

---

## Step 5: Add to CI workflow

In `.github/workflows/deploy.yml`:

```yaml
- name: Lighthouse CI audit
  run: npx lhci autorun
  env:
    CI: true
  continue-on-error: true  # Don't block deploy for audit warnings
```

Optionally add a separate status check that blocks PRs:

```yaml
lighthouse:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
    - run: npm ci
    - run: npx lhci autorun
```

---

---

## Lighthouse Scoring Deep Dive (from Chrome for Developers)

### Metric Weightings (Lighthouse 10+)

| Metric | Weight | Current Target |
|--------|--------|---------------|
| First Contentful Paint (FCP) | 10% | < 1.8s |
| Speed Index (SI) | 10% | < 3.4s |
| Largest Contentful Paint (LCP) | 25% | < 2.5s |
| Total Blocking Time (TBT) | 30% | < 50ms |
| Cumulative Layout Shift (CLS) | 25% | < 0.01 |

**Key insight:** TBT (30%) + CLS (25%) + LCP (25%) = 80% of the score. Optimizing these three gives the most score impact.

### Scoring Curve (80+ Club)

To get a performance score of 90+, the raw metric values must fall at the 8th percentile of HTTP Archive data. For context:
- LCP 1.2s ≈ score 99
- LCP 2.5s ≈ score 80  
- LCP 4.0s ≈ score 50

The current project achieves LCP ~0.6s and CLS 0.000, well within the 90+ range. The Lighthouse CI config should enforce:
- `minScore: 0.95` (not 0.9) since the site already achieves 100/100
- `maxNumericValue` for CLS at 0.01 (current is 0.000 — budget slack)

### Budget Enforcement Strategy

| Env | Performance | Accessibility | Best Practices | SEO |
|-----|------------|---------------|----------------|-----|
| CI (merge gate) | ≥ 0.95 | ≥ 0.95 | ≥ 0.90 | ≥ 0.95 |
| Warning (alert) | < 0.90 | < 0.85 | < 0.85 | < 0.90 |
| Critical (rollback) | < 0.80 | < 0.75 | < 0.80 | < 0.85 |

### Common Lighthouse Regressions & Prevention

| Regression | Prevention |
|------------|------------|
| New third-party script | Zero CDN policy (documented in AGENTS.md) |
| Large image added | Bundle size budget (Plan 45) |
| Font-display changed to swap | Build-time check (Plan 05 validation) |
| Render-blocking JS added | Audit script tags (Plan 69) |
| CLS from new content | content-visibility: auto (Plan 63) |

---

## Step 6: Add badge to README

```md
[![Lighthouse](https://github.com/anomaly-alpha/anomaly-alpha.github.io/actions/workflows/lighthouse.yml/badge.svg)](...)
```

Or use a static badge if always 100:
```md
![Lighthouse 100](https://img.shields.io/badge/Lighthouse-100-success)
```

---

## Files Created/Modified

| File | Status |
|------|--------|
| `lighthouserc.js` | **New** |
| `package.json` | Add `test:lighthouse` scripts |
| `.github/workflows/deploy.yml` | Add Lighthouse CI step |
| `README.md` | Add Lighthouse badge |

---

## Verification

```bash
# Run full audit:
npx lhci autorun
# Expected:
# ✓ All 7 pages audited
# ✓ Performance >= 0.95
# ✓ Accessibility >= 0.95
# ✓ Best Practices >= 0.90
# ✓ SEO >= 0.95
# ✓ CLS <= 0.01
# ✓ TBT <= 50ms
# ✓ LCP <= 2500ms
```
