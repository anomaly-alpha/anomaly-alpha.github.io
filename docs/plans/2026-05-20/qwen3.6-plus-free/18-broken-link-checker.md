# Plan 18: Broken Link Checker Script

**Problem:** With 8 HTML pages and dozens of internal links (guide cross-links, mode button links, footer links), broken links can creep in when pages are reorganized. No automated check exists.

**Goal:** Add a Node.js script that parses all HTML files and verifies every internal `href` points to an existing file.

---

## Step 1: Create link checker script

```javascript
// scripts/check-links.js
const fs = require('fs');
const path = require('path');

const HTML_FILES = [
  'index.html',
  '404.html',
  'guide/code/index.html',
  'guide/event/index.html',
  'guide/pvp/index.html',
  'guide/login/index.html',
  'guide/faq/index.html',
  'guide/beginners/index.html',
];

let errors = 0;

HTML_FILES.forEach(file => {
  const html = fs.readFileSync(file, 'utf8');
  const hrefs = html.match(/href="([^"]+)"/g) || [];

  hrefs.forEach(href => {
    const url = href.match(/href="([^"]+)"/)[1];
    // Skip external URLs, anchors, and data URIs
    if (url.startsWith('http') || url.startsWith('#') || url.startsWith('data:') || url.startsWith('mailto:')) return;

    // Resolve relative path
    const dir = path.dirname(file);
    const resolved = path.normalize(path.join(dir, url.replace(/\/$/, '/index.html')));

    if (!fs.existsSync(resolved)) {
      console.error(`BROKEN: ${file} → ${url} (resolved: ${resolved})`);
      errors++;
    }
  });
});

if (errors === 0) {
  console.log('All internal links valid ✓');
} else {
  console.error(`\n${errors} broken link(s) found`);
  process.exit(1);
}
```

## Step 2: Add to package.json

```json
// package.json
"check-links": "node scripts/check-links.js"
```

## Step 3: Add to CI pipeline

Add to `.github/workflows/ci.yml`:

```yaml
- name: Check internal links
  run: npm run check-links
```

## Files Modified
- `scripts/check-links.js` — new file
- `package.json` — check-links script

## Verification
```bash
npm run check-links
# Should output: All internal links valid ✓
```
