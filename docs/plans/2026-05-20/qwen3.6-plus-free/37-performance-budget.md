# Plan 37: Performance Budget

**Problem:** No performance budget exists. The JS file is 29KB minified, CSS is 45KB combined, and there's no guard against these growing beyond acceptable limits.

**Goal:** Define and enforce performance budgets for key metrics.

---

## Step 1: Define performance budget

```json
// performance-budget.json
{
  "limits": {
    "script.js": 35000,
    "styles.css": 40000,
    "tailwind.css": 15000,
    "index.html": 130000,
    "total-css": 55000,
    "total-js": 210000,
    "total-html": 200000,
    "fonts": 120000,
    "vendor/chart.umd.js": 210000
  }
}
```

## Step 2: Create budget check script

```javascript
// scripts/check-budget.js
const fs = require('fs');
const budget = require('../performance-budget.json');

let violations = 0;

Object.entries(budget.limits).forEach(([file, maxBytes]) => {
  if (!fs.existsSync(file)) {
    console.error(`MISSING: ${file}`);
    violations++;
    return;
  }

  const size = fs.statSync(file).size;
  const kb = (size / 1024).toFixed(1);
  const maxKb = (maxBytes / 1024).toFixed(1);

  if (size > maxBytes) {
    console.error(`OVER BUDGET: ${file} — ${kb}KB (limit: ${maxKb}KB, +${((size - maxBytes) / 1024).toFixed(1)}KB)`);
    violations++;
  } else {
    console.log(`OK: ${file} — ${kb}KB / ${maxKb}KB`);
  }
});

if (violations > 0) {
  console.error(`\n${violations} budget violation(s)`);
  process.exit(1);
}
console.log('\nAll within budget ✓');
```

## Step 3: Add to build

```json
// package.json
"check-budget": "node scripts/check-budget.js",
"build": "... && npm run check-budget"
```

## Files Modified
- `performance-budget.json` — new file
- `scripts/check-budget.js` — new file
- `package.json` — check-budget script

## Verification
```bash
npm run check-budget
# Should show all files within budget
```
