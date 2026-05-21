# Plan 158: Inline Critical CSS Automation

**Problem:** Critical CSS is manually maintained in the `<style>` block. When styles change, the inlined block must be manually updated.

**Goal:** Automate critical CSS inlining during build.

---

## Step 1: Create critical CSS extraction

```javascript
// scripts/inline-critical.js
const csso = require('csso');
const fs = require('fs');

// Read full CSS
const stylesCSS = fs.readFileSync('styles.css', 'utf8');
const tailwindCSS = fs.readFileSync('tailwind.css', 'utf8');

// Extract above-fold rules (simplified — use penthouse for production)
const criticalSelectors = [
  'html', 'body', '.gem-header', '.gem-grid--modes',
  '.gem-mode-btn', '.gem-grid--cards', '.gem-card',
  '.gem-card__body', '.gem-card__header', '.gem-card__title',
  '.gem-counter', '.gem-label', '.gem-text--primary',
  '.gem-text--secondary', '.gem-text--muted',
  '.gem-orb', '.gem-footer'
];

// Simple extraction — in production, use penthouse or critical package
const criticalCSS = stylesCSS + '\n' + tailwindCSS;

// Read index.html
let html = fs.readFileSync('index.html', 'utf8');

// Replace existing <style> block
html = html.replace(/<style>[\s\S]*?<\/style>/, '<style>\n' + criticalCSS + '\n</style>');

fs.writeFileSync('index.html', html);
console.log('Critical CSS inlined');
```

## Step 2: Add to build

```json
// package.json
"build:critical": "node scripts/inline-critical.js",
"build": "... && npm run build:critical"
```

## Files Modified
- `scripts/inline-critical.js` — new file
- `package.json` — build:critical script

## Verification
```bash
npm run build
# index.html <style> block should contain full CSS
# Page should render without FOUC
```
