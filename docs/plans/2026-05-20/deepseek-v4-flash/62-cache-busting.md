# Plan 62: Cache Busting Strategy

**Problem:** Static assets (CSS, JS) are loaded without versioning. When a new build is deployed, returning visitors may load stale cached files. The `_headers` file sets `Cache-Control: max-age=604800` (1 week), so updates can take up to a week to propagate.

**Goal:** Add content-based cache busting: append a hash of the file content to the filename or as a query parameter.

---

## Step 1: Choose approach

**Option A: Query parameter** (simpler)
```html
<link rel="stylesheet" href="styles.min.css?v=2.0.0">
<script src="script.js?v=2.0.0"></script>
```

**Option B: Hash-based filename** (more robust, needs build step)
```
styles.a1b2c3d4.min.css
script.e5f6a7b8.js
```

Recommend **Option A** for simplicity — update the version param on each build.

---

## Step 2: Create version hash on build

**In `package.json` build script**:

```json
"prebuild": "node scripts/update-version.js && node scripts/hash-assets.js"
```

**File: `scripts/hash-assets.js`**:

```js
var crypto = require('crypto');
var fs = require('fs');

var assets = {
  'styles.min.css': 'styles.min.css',
  'script.js': 'script.js',
  'tailwind.css': 'tailwind.css',
};

var hash = crypto.createHash('md5');
Object.keys(assets).forEach(function (file) {
  var content = fs.readFileSync(file);
  hash.update(content);
});

var version = hash.digest('hex').slice(0, 8);

var PAGES = [
  'index.html',
  'guide/code/index.html',
  'guide/event/index.html',
  'guide/pvp/index.html',
  'guide/login/index.html',
  'guide/faq/index.html',
  'guide/beginners/index.html',
  '404.html'
];

PAGES.forEach(function (page) {
  var html = fs.readFileSync(page, 'utf8');
  html = html.replace(/(href="[^"]+\.css)(")/g, '$1?v=' + version + '$2');
  html = html.replace(/(src="script\.js)(")/g, '$1?v=' + version + '$2');
  fs.writeFileSync(page, html);
  console.log('✓ Cache-busted: ' + page);
});
```

---

## Step 3: Update `_headers`

Remove long cache times for HTML (HTML must always be fresh since it contains versioned links):

```
*.html
  Cache-Control: no-cache
```

Keep CSS/JS cache at 1 year (since filename changes when content changes):
```
*.css
  Cache-Control: max-age=31536000, immutable
*.js
  Cache-Control: max-age=31536000, immutable
```

---

## Step 4: Add to CI

In `.github/workflows/deploy.yml`:
```yaml
- name: Hash assets for cache busting
  run: node scripts/hash-assets.js
```

---

## Files Modified: `scripts/hash-assets.js` (new), `package.json`, `_headers`, `.github/workflows/deploy.yml`
