# Plan 61: Asset Size Tracking

**Problem:** No historical tracking of asset sizes exists. It's impossible to know if the JS file has grown 5KB over the last month without manually checking.

**Goal:** Track asset sizes over time in a JSON file, updated on each build.

---

## Step 1: Create size tracking script

```javascript
// scripts/track-sizes.js
const fs = require('fs');
const path = require('path');

const TRACKED_FILES = [
  'script.js', 'styles.css', 'tailwind.css',
  'index.html', 'vendor/chart.umd.js'
];

const sizesFile = path.resolve(__dirname, '../docs/asset-sizes.json');
let history = [];

if (fs.existsSync(sizesFile)) {
  history = JSON.parse(fs.readFileSync(sizesFile, 'utf8'));
}

const entry = {
  date: new Date().toISOString().slice(0, 10),
  files: {}
};

TRACKED_FILES.forEach(function(file) {
  if (fs.existsSync(file)) {
    entry.files[file] = fs.statSync(file).size;
  }
});

// Avoid duplicate entries for same day
const lastEntry = history[history.length - 1];
if (lastEntry && lastEntry.date === entry.date) {
  history[history.length - 1] = entry;
} else {
  history.push(entry);
}

// Keep last 90 days
if (history.length > 90) history = history.slice(-90);

fs.writeFileSync(sizesFile, JSON.stringify(history, null, 2));
console.log('Asset sizes tracked');
```

## Step 2: Add to build

```json
// package.json
"track-sizes": "node scripts/track-sizes.js",
"build": "... && npm run track-sizes"
```

## Files Modified
- `scripts/track-sizes.js` — new file
- `docs/asset-sizes.json` — new file (auto-generated)
- `package.json` — track-sizes script

## Verification
```bash
npm run track-sizes
cat docs/asset-sizes.json
# Should show today's sizes
```
