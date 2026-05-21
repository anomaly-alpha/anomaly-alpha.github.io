# Plan 09: Bundle Size Budget

**Problem:** No size limits exist. Over time, CSS and JS bundles can grow unchecked, degrading load performance especially on mobile networks.

**Goal:** Set size budgets in `package.json` and fail CI if any asset exceeds its budget. Tailwind CSS ≤ 15 KB, script.js ≤ 32 KB, styles.css ≤ 36 KB.

---

## Step 1: Define budget in package.json
Add a `budget` field to `package.json`:

```json
{
  "budget": [
    {
      "type": "asset",
      "path": "tailwind.css",
      "maximumWarning": "12kb",
      "maximumError": "15kb"
    },
    {
      "type": "asset",
      "path": "styles.css",
      "maximumWarning": "30kb",
      "maximumError": "36kb"
    },
    {
      "type": "asset",
      "path": "script.js",
      "maximumWarning": "28kb",
      "maximumError": "32kb"
    }
  ]
}
```

## Step 2: Add budget check to CI
Add a size-check script to `package.json`:

```json
{
  "scripts": {
    "check-sizes": "node scripts/check-sizes.js"
  }
}
```

Create `scripts/check-sizes.js`:

```javascript
const fs = require('fs');
const path = require('path');
const thresholds = {
  'tailwind.css': { warn: 12 * 1024, error: 15 * 1024 },
  'styles.css': { warn: 30 * 1024, error: 36 * 1024 },
  'script.js': { warn: 28 * 1024, error: 32 * 1024 }
};

let hasError = false;
for (const [file, limits] of Object.entries(thresholds)) {
  const filePath = path.join(__dirname, '..', file);
  if (!fs.existsSync(filePath)) continue;
  const size = fs.statSync(filePath).size;
  if (size > limits.error) {
    console.error(`ERROR: ${file} is ${(size/1024).toFixed(1)}KB (max ${limits.error/1024}KB)`);
    hasError = true;
  } else if (size > limits.warn) {
    console.warn(`WARN: ${file} is ${(size/1024).toFixed(1)}KB (max ${limits.warn/1024}KB)`);
  } else {
    console.log(`OK: ${file} is ${(size/1024).toFixed(1)}KB`);
  }
}
if (hasError) process.exit(1);
```

## Step 3: Add to CI build step
Add to `.github/workflows/ci.yml` after the build step:

```yaml
      - name: Check bundle sizes
        run: npm run check-sizes
```

## Files Modified
- `package.json` — add budget field and check-sizes script
- `scripts/check-sizes.js` — new file
- `.github/workflows/ci.yml` — add size check step

## Verification
```bash
npm run check-sizes
# All files show OK within budget
```