# Plan 64: Subresource Integrity (SRI) for Vendor Chart.js

**Problem:** The self-hosted Chart.js (`vendor/chart.umd.js`) has no integrity check. If the file is corrupted during download or deployment, the charts will silently fail with hard-to-debug errors.

**Goal:** Add `integrity` attribute to the dynamically loaded Chart.js script tag. Compute and verify the SRI hash.

---

## Step 1: Generate SRI hash for vendor file

```bash
# Generate base64-encoded SHA-384 hash:
cat vendor/chart.umd.js | openssl dgst -sha384 -binary | openssl base64 -A
# Output: abc123... (long hash)
```

---

## Step 2: Store hash as a constant

```js
var CHART_SRI_HASH = 'sha384-abc123...'; // Replace with actual hash
```

Or better, store in config:

```json
"chartSRI": "sha384-abc123..."
```

---

## Step 3: Add integrity to dynamic script tag

```js
function loadChartJs() {
  var script = document.createElement('script');
  script.src = 'vendor/chart.umd.js';
  script.integrity = CHART_SRI_HASH || CHARTS.chartSRI;
  script.crossOrigin = 'anonymous';
  script.fetchPriority = 'low';
  // ... rest of loadChartJs
}
```

---

## Step 4: Generate hash on build

**In `scripts/hash-assets.js`** (from Plan 62), add:

```js
var crypto = require('crypto');
var chartContent = fs.readFileSync('vendor/chart.umd.js');
var hash = crypto.createHash('sha384').update(chartContent).digest('base64');
console.log('Chart.js SRI: sha384-' + hash);
```

Create a script that updates the config in HTML:

```js
var sri = 'sha384-' + hash;
var html = fs.readFileSync('index.html', 'utf8');
html = html.replace(/"chartSRI": "[^"]*"/, '"chartSRI": "' + sri + '"');
fs.writeFileSync('index.html', html);
```

---

## Step 5: Add to CI

In `build` step, after downloading vendor assets:
```yaml
- name: Generate SRI hashes
  run: node scripts/generate-sri.js
```

---

## Step 6: Handle SRI mismatch

If SRI fails, Chart.js won't load. Add fallback:

```js
script.onerror = function () {
  if (script.integrity) {
    console.warn('SRI check failed, retrying without integrity');
    var retry = document.createElement('script');
    retry.src = 'vendor/chart.umd.js';
    retry.onload = initCharts;
    document.head.appendChild(retry);
  } else {
    showChartErrorState();
  }
};
```

---

## Files Modified: `vendor/chart.umd.js` integrity attribute, `script.js`, `scripts/generate-sri.js` (new)
