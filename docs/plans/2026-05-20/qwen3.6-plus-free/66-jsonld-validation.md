# Plan 66: JSON-LD Validation Script

**Problem:** JSON-LD structured data is hand-written and prone to syntax errors. A broken schema silently fails validation and loses rich result eligibility.

**Goal:** Add a build-time script that validates all JSON-LD blocks across all HTML pages.

---

## Step 1: Create validation script

```javascript
// scripts/validate-jsonld.js
const fs = require('fs');
const path = require('path');

const HTML_FILES = [
  'index.html', '404.html',
  'guide/code/index.html', 'guide/event/index.html',
  'guide/pvp/index.html', 'guide/login/index.html',
  'guide/faq/index.html', 'guide/beginners/index.html'
];

let errors = 0;

HTML_FILES.forEach(function(file) {
  const html = fs.readFileSync(file, 'utf8');
  const matches = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g) || [];

  matches.forEach(function(block, i) {
    const jsonMatch = block.match(/>([\s\S]*)<\/script>/);
    if (!jsonMatch) return;

    try {
      JSON.parse(jsonMatch[1].trim());
    } catch (e) {
      console.error(`INVALID JSON-LD: ${file} block ${i + 1}`);
      console.error(`  Error: ${e.message}`);
      errors++;
    }
  });
});

if (errors === 0) {
  console.log('All JSON-LD valid ✓');
} else {
  console.error(`\n${errors} invalid JSON-LD block(s)`);
  process.exit(1);
}
```

## Step 2: Add to build

```json
// package.json
"validate-jsonld": "node scripts/validate-jsonld.js",
"build": "... && npm run validate-jsonld"
```

## Files Modified
- `scripts/validate-jsonld.js` — new file
- `package.json` — validate-jsonld script

## Verification
```bash
npm run validate-jsonld
# Should pass for all pages
# Intentionally break a JSON-LD block — should catch error
```
