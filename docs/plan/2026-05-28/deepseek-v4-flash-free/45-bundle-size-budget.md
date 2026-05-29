# Plan 45: Bundle Size Budget

**Problem:** There's no upper limit on file sizes. A large dependency or accidentally committed asset could quietly bloat the site. Currently at ~189 KB total (114 KB HTML + 29 KB JS + 33 KB CSS + 12 KB Tailwind), but without monitoring, this could regress.

**Goal:** Set explicit size budgets for key assets. Enforce them in CI. Alert on PRs that exceed budgets.

---

## Step 1: Install size-limit

```bash
npm install -D size-limit @size-limit/file
```

---

## Step 2: Create size-limit config

**In `package.json`**, add:

```json
"size-limit": [
  {
    "name": "HTML (index.html)",
    "path": "index.html",
    "limit": "120 KB"
  },
  {
    "name": "JavaScript (script.js)",
    "path": "script.js",
    "limit": "30 KB"
  },
  {
    "name": "CSS (styles.css + tailwind.css)",
    "path": ["styles.css", "tailwind.css"],
    "limit": "50 KB"
  },
  {
    "name": "Fonts",
    "path": "fonts/*.woff2",
    "limit": "80 KB"
  },
  {
    "name": "Chart.js (vendor)",
    "path": "vendor/chart.umd.js",
    "limit": "210 KB"
  },
  {
    "name": "All OG images combined",
    "path": "og-images/*.png",
    "limit": "200 KB"
  }
]
```

---

## Step 3: Add npm scripts

```json
"test:size": "npx size-limit",
"test:size:why": "npx size-limit --why"
```

---

## Step 4: Add to CI workflow

```yaml
- name: Check bundle size
  run: npx size-limit
```

---

## Step 5: Add badge to README

```md
[![Bundle size](https://img.shields.io/badge/bundle-190KB-success)]()
```

Or configure size-limit to generate badges automatically:

```bash
npx size-limit --json > size-report.json
```

---

## Step 6: Run baseline

```bash
npx size-limit
# Expected output:
# Package size: ~189 KB
# All limits passed
```

---

## Step 7: Set warning thresholds (informational)

Add a second set of "warning" thresholds via CI environment:

```yaml
- name: Check bundle size warnings
  run: |
    SIZE=$(du -sk index.html script.js styles.css tailwind.css fonts/ vendor/ | awk '{sum+=$1} END {print sum}')
    echo "Total size: ${SIZE}KB"
    if [ $SIZE -gt 250 ]; then
      echo "::warning::Total size $SIZE KB exceeds 250 KB warning threshold"
    fi
```

---

## Step 8: Document budgets

In `CONTRIBUTING.md`, add a Budgets section:

```md
## Size Budgets

| Asset | Budget | Current |
|-------|--------|---------|
| index.html | 120 KB | ~114 KB |
| script.js | 30 KB | ~29 KB |
| CSS (combined) | 50 KB | ~45 KB |
| Fonts | 80 KB | ~48 KB |
| Chart.js | 210 KB | ~205 KB |
| **Total** | **~500 KB** | **~189 KB** |

Staying under budget is part of the PR review process. Run `npm run test:size` to verify.
```

---

## Files Modified

| File | Change |
|------|--------|
| `package.json` | Add size-limit config + scripts |
| `CONTRIBUTING.md` | Add size budgets section |
| `.github/workflows/deploy.yml` | Add size check step |

---

## Verification

```bash
npm run test:size
# Expected:
# ✓ HTML (index.html) — 114 KB < 120 KB
# ✓ JavaScript (script.js) — 29 KB < 30 KB
# ✓ CSS — 45 KB < 50 KB
# ✓ Fonts — 48 KB < 80 KB
# ✓ Chart.js — 205 KB < 210 KB
# ✓ All OG images — < 200 KB
# ✓ All limits passed
```
