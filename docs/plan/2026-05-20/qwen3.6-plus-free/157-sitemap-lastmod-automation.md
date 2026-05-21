# Plan 157: Sitemap Lastmod Automation

**Problem:** The sitemap.xml has hardcoded `<lastmod>` dates that don't update when pages change. This misleads search engines about content freshness.

**Goal:** Auto-generate sitemap.xml with accurate lastmod dates from file modification times.

---

## Step 1: Create sitemap generator

```javascript
// scripts/generate-sitemap.js
const fs = require('fs');
const path = require('path');

const PAGES = [
  { url: '/', file: 'index.html', priority: '1.0', changefreq: 'weekly' },
  { url: '/guide/code/', file: 'guide/code/index.html', priority: '0.8', changefreq: 'weekly' },
  { url: '/guide/event/', file: 'guide/event/index.html', priority: '0.8', changefreq: 'monthly' },
  { url: '/guide/pvp/', file: 'guide/pvp/index.html', priority: '0.8', changefreq: 'monthly' },
  { url: '/guide/login/', file: 'guide/login/index.html', priority: '0.8', changefreq: 'monthly' },
  { url: '/guide/faq/', file: 'guide/faq/index.html', priority: '0.7', changefreq: 'monthly' },
  { url: '/guide/beginners/', file: 'guide/beginners/index.html', priority: '0.7', changefreq: 'monthly' },
];

const BASE_URL = 'https://anomaly-alpha.github.io';

let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

PAGES.forEach(function(page) {
  const stat = fs.statSync(page.file);
  const lastmod = new Date(stat.mtime).toISOString().slice(0, 10);

  xml += '  <url>\n';
  xml += '    <loc>' + BASE_URL + page.url + '</loc>\n';
  xml += '    <lastmod>' + lastmod + '</lastmod>\n';
  xml += '    <changefreq>' + page.changefreq + '</changefreq>\n';
  xml += '    <priority>' + page.priority + '</priority>\n';
  xml += '  </url>\n';
});

xml += '</urlset>\n';
fs.writeFileSync('sitemap.xml', xml);
console.log('Sitemap generated with ' + PAGES.length + ' URLs');
```

## Step 2: Add to build

```json
// package.json
"build:sitemap": "node scripts/generate-sitemap.js",
"build": "... && npm run build:sitemap"
```

## Files Modified
- `scripts/generate-sitemap.js` — new file
- `package.json` — build:sitemap script

## Verification
```bash
npm run build:sitemap
cat sitemap.xml
# lastmod dates should match file modification times
```
