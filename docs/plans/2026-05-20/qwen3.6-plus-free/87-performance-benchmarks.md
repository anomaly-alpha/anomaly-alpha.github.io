# Plan 87: Performance Benchmarks

**Problem:** No baseline performance metrics exist. It's impossible to know if a change improved or degraded performance without manual comparison.

**Goal:** Create a benchmark script that measures key metrics and stores results for comparison.

---

## Step 1: Create benchmark script

```javascript
// scripts/benchmark.js
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();

  // Enable performance metrics
  await page.setCacheEnabled(false);

  const start = Date.now();
  await page.goto('file://' + path.resolve(__dirname, '../index.html'), {
    waitUntil: 'networkidle0'
  });
  const loadTime = Date.now() - start;

  // Get performance entries
  const metrics = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    return {
      domContentLoaded: Math.round(nav.domContentLoadedEventEnd - nav.startTime),
      loadComplete: Math.round(nav.loadEventEnd - nav.startTime),
      domInteractive: Math.round(nav.domInteractive - nav.startTime),
      transferSize: Math.round(nav.transferSize / 1024) + 'KB'
    };
  });

  await browser.close();

  const result = {
    date: new Date().toISOString().slice(0, 10),
    loadTime: loadTime + 'ms',
    ...metrics
  };

  console.log(JSON.stringify(result, null, 2));

  // Append to history
  const historyFile = path.resolve(__dirname, '../docs/benchmarks.json');
  let history = [];
  if (fs.existsSync(historyFile)) {
    history = JSON.parse(fs.readFileSync(historyFile, 'utf8'));
  }
  history.push(result);
  fs.writeFileSync(historyFile, JSON.stringify(history, null, 2));
})();
```

## Step 2: Add script

```json
// package.json
"benchmark": "node scripts/benchmark.js"
```

## Files Modified
- `scripts/benchmark.js` — new file
- `docs/benchmarks.json` — new file (auto-generated)
- `package.json` — benchmark script

## Verification
```bash
npm run benchmark
# Should show metrics and append to history
```
