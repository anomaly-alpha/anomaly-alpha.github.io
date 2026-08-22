# Plan 153: Enhanced Content Hashing (Deep Cache Busting)

**Gap:** Plan 62 added basic cache busting via query params. This plan enhances it with per-file content hashing in filenames for optimal caching — assets never need revalidation because the filename changes when content changes.

**Best practice (web.dev):** Use `contenthash` in filenames (`styles.a1b2c3d4.css`) instead of query params (`styles.css?v=abc`). Query params may not be cached by all CDNs/proxies.

---

## Step 1: Generate content hashes

```js
// scripts/hash-filenames.js
var crypto = require('crypto');
var fs = require('fs');
var path = require('path');

var files = [
  'script.js',
  'styles.min.css',
  'tailwind.min.css',
  'vendor/chart.umd.js'
];

files.forEach(function (file) {
  var content = fs.readFileSync(file);
  var hash = crypto.createHash('md5').update(content).digest('hex').slice(0, 8);
  var ext = path.extname(file);
  var base = path.basename(file, ext);
  var newName = base + '.' + hash + ext;
  fs.copyFileSync(file, newName);
  console.log(file + ' → ' + newName);
});
```

---

## Step 2: Update HTML references

```js
// Read the generated filenames and update all HTML files
var htmlFiles = ['index.html', 'guide/*/index.html', '404.html'];

// Replace script.js references with hashed versions
// Replace styles.min.css references with hashed versions
```

---

## Step 3: Update service worker to cache hashed files

```js
// sw.js — files with contenthash can be cached forever (immutable)
var PRECACHE_URLS = [
  '/',
  '/index.html',
  '/styles.a1b2c3d4.min.css',  // Hash changes on content change
  '/script.e5f6a7b8.js',
];
```

---

## Step 4: Set aggressive cache headers

```
*.css
  Cache-Control: max-age=31536000, immutable
*.js
  Cache-Control: max-age=31536000, immutable
```

---

## Files Modified: `scripts/hash-filenames.js`, `index.html`, `sw.js`, `_headers`
