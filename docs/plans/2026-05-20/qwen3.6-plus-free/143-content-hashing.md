# Plan 143: Content Hashing for Assets

**Problem:** When assets are updated, the filename doesn't change, so browsers may serve cached versions. Content hashing in filenames ensures fresh loads.

**Goal:** Add content hash to asset filenames during build.

---

## Step 1: Create hashing script

```javascript
// scripts/hash-assets.js
const fs = require('fs');
const crypto = require('crypto');

function hashFile(filename) {
  const content = fs.readFileSync(filename);
  const hash = crypto.createHash('sha256').update(content).digest('hex').slice(0, 8);
  const ext = path.extname(filename);
  const base = filename.slice(0, -ext.length);
  return base + '-' + hash + ext;
}

const files = ['script.js', 'styles.css', 'tailwind.css'];
const mapping = {};

files.forEach(function(file) {
  const hashed = hashFile(file);
  fs.copyFileSync(file, hashed);
  mapping[file] = hashed;
});

// Save mapping for HTML update
fs.writeFileSync('asset-mapping.json', JSON.stringify(mapping, null, 2));
console.log('Assets hashed');
```

## Step 2: Update HTML references

```javascript
// scripts/update-html.js
const fs = require('fs');
const mapping = JSON.parse(fs.readFileSync('asset-mapping.json', 'utf8'));

const htmlFiles = ['index.html', '404.html'];
// Add guide pages
['code', 'event', 'pvp', 'login', 'faq', 'beginners'].forEach(function(g) {
  htmlFiles.push('guide/' + g + '/index.html');
});

htmlFiles.forEach(function(file) {
  let html = fs.readFileSync(file, 'utf8');
  Object.entries(mapping).forEach(function([orig, hashed]) {
    html = html.replace(new RegExp(orig.replace('.', '\\.'), 'g'), hashed);
  });
  fs.writeFileSync(file, html);
});
```

## Files Modified
- `scripts/hash-assets.js` — new file
- `scripts/update-html.js` — new file
- `package.json` — build pipeline

## Verification
```bash
npm run build
ls *-*.js *-*.css  # Hashed files exist
grep '-' index.html  # References updated
```
