# Plan 10: GitHub Actions CI Pipeline

**Problem:** No CI pipeline exists. Changes are committed and pushed without automated validation. Broken builds, lint failures, or missing files only surface when someone opens the site.

**Goal:** Create a GitHub Actions workflow that runs build, lint, and basic file checks on every push and PR.

---

## Step 1: Create CI workflow

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

permissions:
  contents: read

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run linter
        run: npm run lint

      - name: Build assets
        run: npm run build

      - name: Verify required files
        run: |
          for f in index.html script.js styles.css tailwind.css manifest.json robots.txt sitemap.xml; do
            test -f "$f" || { echo "MISSING: $f"; exit 1; }
          done
          for d in guide/code guide/event guide/pvp guide/login guide/faq guide/beginners; do
            test -f "$d/index.html" || { echo "MISSING: $d/index.html"; exit 1; }
          done
          echo "All required files present"

      - name: Validate JSON configs
        run: |
          node -e "
            const fs = require('fs');
            const html = fs.readFileSync('index.html', 'utf8');
            const configs = html.matchAll(/<script type=\"application\/json\" id=\"([^\"]+)\">([\s\S]*?)<\/script>/g);
            for (const [, id, json] of configs) {
              try { JSON.parse(json.trim()); console.log(id + ': valid'); }
              catch(e) { console.error(id + ': INVALID — ' + e.message); process.exit(1); }
            }
          "
```

## Files Modified
- `.github/workflows/ci.yml` — new file

## Verification
```bash
# Push to a branch and check Actions tab
# Or test locally:
npm ci && npm run lint && npm run build
```
