# Plan 55: Subresource Integrity

**Problem:** While all assets are self-hosted (no CDN), the Chart.js library in `vendor/` and any future external scripts lack SRI hashes. If the vendor file is ever replaced or corrupted, there's no integrity check.

**Goal:** Add SRI hashes to all script and stylesheet references.

---

## Step 1: Generate SRI hashes

```bash
# Generate hashes for all assets
for f in script.js styles.css tailwind.css vendor/chart.umd.js; do
  hash=$(cat "$f" | openssl dgst -sha384 -binary | openssl base64 -A)
  echo "$f: sha384-$hash"
done
```

## Step 2: Add integrity attributes

```html
<!-- index.html -->
<script src="script.js" integrity="sha384-..." crossorigin="anonymous"></script>
<link rel="stylesheet" href="styles.css" integrity="sha384-..." crossorigin="anonymous">
<link rel="stylesheet" href="tailwind.css" integrity="sha384-..." crossorigin="anonymous">
```

## Step 3: Automate SRI in build

```javascript
// scripts/generate-sri.js
const fs = require('fs');
const crypto = require('crypto');

function sriHash(filename) {
  const content = fs.readFileSync(filename);
  const hash = crypto.createHash('sha384').update(content).digest('base64');
  return 'sha384-' + hash;
}

const files = ['script.js', 'styles.css', 'tailwind.css'];
const sri = {};
files.forEach(f => { sri[f] = sriHash(f); });
fs.writeFileSync('sri.json', JSON.stringify(sri, null, 2));
console.log('SRI hashes generated');
```

## Files Modified
- `scripts/generate-sri.js` — new file
- `index.html` — integrity attributes
- `guide/*/index.html` — integrity attributes

## Verification
```bash
node scripts/generate-sri.js
cat sri.json
# Tamper with script.js — browser should block loading
```
