# Plan 31: Critical CSS Extraction

**Problem:** The current critical CSS is manually inlined in `<head>`. When styles change, the inlined block must be manually updated, leading to drift between inlined and external CSS.

**Goal:** Automate critical CSS extraction during the build process using a tool like `critical` or `penthouse`.

---

## Step 1: Install critical CSS tool

```bash
npm install --save-dev critical
```

## Step 2: Create extraction script

```javascript
// scripts/extract-critical.js
const critical = require('critical');
const fs = require('fs');

critical.generate({
  inline: true,
  base: process.cwd(),
  src: 'index.html',
  dest: 'index.html',
  width: 1300,
  height: 900,
  penthouse: {
    keepLargerMediaQueries: true,
    forceInclude: ['.gem-card', '.gem-mode-btn', '.gem-header']
  }
}).then(function(output) {
  console.log('Critical CSS extracted');
}).catch(function(err) {
  console.error('Error:', err);
  process.exit(1);
});
```

## Step 3: Add to build pipeline

```json
// package.json
"build:critical": "node scripts/extract-critical.js",
"build": "npm run build:tailwind && npm run build:css && npm run build:js && npm run build:critical"
```

## Files Modified
- `scripts/extract-critical.js` — new file
- `package.json` — build:critical script

## Verification
```bash
npm run build
# Open index.html — above-fold content should render instantly
# No FOUC on slow 3G simulation
```
