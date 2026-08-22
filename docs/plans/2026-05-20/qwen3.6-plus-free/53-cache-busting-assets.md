# Plan 53: Cache Busting for Assets

**Problem:** CSS and JS files are cached aggressively (1 year) per the cache headers, but when updated, users may still see old versions until they hard-refresh.

**Goal:** Add content-hash-based filenames or query-string cache busting to force fresh loads after updates.

---

## Step 1: Add hash to filenames during build

```javascript
// scripts/cache-bust.js
const fs = require('fs');
const crypto = require('crypto');

function hashFile(filename) {
  const content = fs.readFileSync(filename);
  const hash = crypto.createHash('md5').update(content).digest('hex').slice(0, 8);
  const ext = filename.split('.').pop();
  const base = filename.replace('.' + ext, '');
  const hashed = base + '-' + hash + '.' + ext;

  fs.copyFileSync(filename, hashed);
  return hashed;
}

const hashedCSS = hashFile('styles.css');
const hashedTW = hashFile('tailwind.css');
const hashedJS = hashFile('script.js');

// Update HTML references
['index.html', 'guide/code/index.html', 'guide/event/index.html', 'guide/pvp/index.html', 'guide/login/index.html', 'guide/faq/index.html', 'guide/beginners/index.html', '404.html'].forEach(function(htmlFile) {
  let html = fs.readFileSync(htmlFile, 'utf8');
  html = html.replace(/href="styles\.css"/g, 'href="' + hashedCSS + '"');
  html = html.replace(/href="tailwind\.css"/g, 'href="' + hashedTW + '"');
  html = html.replace(/src="script\.js"/g, 'src="' + hashedJS + '"');
  fs.writeFileSync(htmlFile, html);
});

console.log('Cache busting applied');
```

## Step 2: Add to build pipeline

```json
// package.json
"build": "... && node scripts/cache-bust.js"
```

## Files Modified
- `scripts/cache-bust.js` — new file
- `package.json` — build pipeline update

## Verification
```bash
npm run build
ls styles-*.css tailwind-*.css script-*.js  # Hashed files exist
grep 'styles-' index.html  # References updated
```
