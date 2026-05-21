# Plan 06: CI/CD Pipeline — GitHub Actions

**Problem:** No automated build or deployment pipeline exists. The `npm run build` step must be run manually after every HTML/JS/CSS change. There is no linting, testing, or validation gate before deployment.

**Goal:** Add a GitHub Actions workflow that builds, validates, and deploys to GitHub Pages on every push to `main`.

---

## Step 1: Create the workflow file

**File: `.github/workflows/deploy.yml`**

```yaml
name: Build & Deploy

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Build (Tailwind + minification)
        run: npm run build

      - name: Validate meta tags (all 7 pages)
        run: node scripts/validate-meta.js
        continue-on-error: true  # Warn but don't block deploy

      - name: Run tests
        run: npm test
        continue-on-error: true

      - name: Upload Pages artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: '.'
          exclude: |
            node_modules/**
            scripts/**
            test/**
            vitest.config.js
            *.md
            src/**
            journal/**
            data/**
            docs/plan/**
            .github/**
            .obsidian/**

  deploy:
    needs: build
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

---

## Step 2: Add status badge to README

**In `README.md`** (at the top, after the title):

```md
[![Build & Deploy](https://github.com/anomaly-alpha/anomaly-alpha.github.io/actions/workflows/deploy.yml/badge.svg)](https://github.com/anomaly-alpha/anomaly-alpha.github.io/actions/workflows/deploy.yml)
```

---

## Step 3: Validate meta script (prerequisite)

The `validate:meta` script from Plan 05 is referenced in the workflow. Create `scripts/validate-meta.js`:

```js
const { readFileSync } = require('fs');
const path = require('path');

const PAGES = [
  'index.html',
  'guide/code/index.html',
  'guide/event/index.html',
  'guide/pvp/index.html',
  'guide/login/index.html',
  'guide/faq/index.html',
  'guide/beginners/index.html',
];

let hasError = false;

PAGES.forEach((page) => {
  const html = readFileSync(path.join(__dirname, '..', page), 'utf8');
  const checks = [
    ['og:title', html.includes('property="og:title"')],
    ['og:description', html.includes('property="og:description"')],
    ['og:url', html.includes('property="og:url"')],
    ['og:image', html.includes('property="og:image"')],
    ['twitter:card', html.includes('name="twitter:card"')],
    ['canonical', html.includes('rel="canonical"')],
    ['viewport', html.includes('name="viewport"')],
  ];
  const failures = checks.filter(([, passes]) => !passes).map(([name]) => name);
  if (failures.length > 0) {
    console.error(`✗ ${page}: Missing [${failures.join(', ')}]`);
    hasError = true;
  }
});

if (!hasError) {
  console.log('✓ All 7 pages pass meta validation');
}
process.exit(hasError ? 1 : 0);
```

---

## Step 4: Add `npm test` to `package.json` (prerequisite for test step)

After implementing Plan 02:

```json
"test": "vitest run",
"validate": "npm run validate:meta"
```

---

## Step 5: Test the workflow locally with `act` (optional)

```bash
# Install act: https://github.com/nektos/act
act push --job build
```

Or push to a test branch and verify via GitHub UI.

---

## Step 6: Configure GitHub Pages

The workflow uses `actions/deploy-pages@v4`. Ensure the GitHub repo settings:

1. **Settings → Pages → Source**: Select "GitHub Actions" (not a branch)
2. **Settings → Actions → General → Workflow permissions**: "Read and write permissions"

---

## Files Created/Modified

| File | Status |
|------|--------|
| `.github/workflows/deploy.yml` | **New** |
| `README.md` | Add status badge |
| `scripts/validate-meta.js` | **New** (prerequisite) |
| `package.json` | Add `test` and `validate` scripts (if not already) |

---

## Verification

1. Push to `main` branch
2. Go to GitHub → Actions tab
3. Verify "Build & Deploy" workflow runs successfully
4. Verify site updates at `https://anomaly-alpha.github.io`
5. Check the status badge in README shows "passing"
