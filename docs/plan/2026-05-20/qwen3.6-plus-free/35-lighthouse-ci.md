# Plan 35: Lighthouse CI Integration

**Problem:** No automated performance auditing exists. Performance regressions (larger fonts, extra CSS, slower JS) go undetected until users complain.

**Goal:** Add Lighthouse CI to the GitHub Actions pipeline to catch performance regressions.

---

## Step 1: Install Lighthouse CI

```bash
npm install --save-dev @lhci/cli
```

## Step 2: Create Lighthouse CI config

```json
// lighthouserc.json
{
  "ci": {
    "collect": {
      "staticDistDir": ".",
      "url": [
        "http://localhost/",
        "http://localhost/guide/code/",
        "http://localhost/guide/pvp/"
      ],
      "settings": {
        "preset": "desktop"
      }
    },
    "assert": {
      "assertions": {
        "categories:performance": ["warn", { "minScore": 0.9 }],
        "categories:accessibility": ["error", { "minScore": 0.95 }],
        "categories:seo": ["error", { "minScore": 0.9 }],
        "largest-contentful-paint": ["warn", { "maxNumericValue": 2500 }],
        "cumulative-layout-shift": ["warn", { "maxNumericValue": 0.1 }]
      }
    },
    "upload": {
      "target": "temporary-public-storage"
    }
  }
}
```

## Step 3: Add to CI workflow

```yaml
# .github/workflows/ci.yml — add job
lighthouse:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: '20'
    - run: npm ci && npm run build
    - run: npm install -g @lhci/cli
    - run: lhci autorun
```

## Files Modified
- `lighthouserc.json` — new file
- `.github/workflows/ci.yml` — Lighthouse job

## Verification
```bash
npm install -g @lhci/cli
lhci autorun
# Should show scores for each page
```
