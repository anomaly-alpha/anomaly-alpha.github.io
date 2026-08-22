# Plan 21: Link Checker + HTML Validation CI

**Problem:** No automated checking ensures internal/external links work, or that HTML is valid. Broken links in guide pages degrade user experience and SEO. Invalid HTML can cause inconsistent rendering across browsers.

**Goal:** Add automated link checking and HTML validation to the CI pipeline (from Plan 06).

---

## Step 1: Install tools

```bash
npm install -D html-validate linkinator
```

---

## Step 2: Add npm scripts

```json
"validate:html": "html-validate index.html guide/*/index.html 404.html",
"validate:links": "linkinator https://anomaly-alpha.github.io --recurse --skip '^(?!https://anomaly-alpha.github.io)'",
"validate:links:local": "linkinator http://localhost:3000 --recurse --skip '^(?!http://localhost:3000)'",
"validate": "npm run validate:html && npm run validate:links"
```

---

## Step 3: Create HTML-validate config

**File: `.htmlvalidate.json`**:

```json
{
  "extends": ["html-validate:recommended"],
  "rules": {
    "void-style": ["warn", {"style": "omit"}],
    "doctype-style": ["warn", "uppercase"],
    "attr-quotes": ["warn", "double"],
    "no-trailing-whitespace": "warn",
    "no-inline-style": "off",
    "no-unknown-elements": "error",
    "heading-level": "warn",
    "prefer-native-element": "warn",
    "no-deprecated-attr": "error",
    "no-dup-class": "warn",
    "wcag/h71": "warn",
    "element-required-attributes": ["error", {"button": ["type"]}]
  }
}
```

---

## Step 4: Run initial validation

```bash
npx html-validate index.html
# Fix all errors and address warnings

npx html-validate guide/*/index.html
# Fix per-page issues

npx html-validate 404.html
```

**Common HTML issues to fix:**
- Missing `<button type="button">` (defaults to `submit` in forms)
- Invalid nesting (e.g., `<div>` inside `<button>`)
- Duplicate IDs
- Missing `alt` on non-decorative images
- Unclosed tags
- Invalid ARIA attributes

---

## Step 5: Add link checking

```bash
# Start local server first
npx serve . -l 3000 &
sleep 2

# Check all internal links
npx linkinator http://localhost:3000 --recurse --skip '^(?!http://localhost:3000)'

# Kill server
kill %1
```

**Common link issues to fix:**
- Broken internal links (404s)
- Redirects that should be direct links
- External links that return errors
- Missing trailing slashes causing redirects

---

## Step 6: Fix broken links systematically

For each broken link found:
1. If internal 404: fix the `href` or create the missing page
2. If redirect (301): update link to final destination
3. If external timeout: consider removing or adding skip pattern

---

## Step 7: Add to GitHub Actions workflow

**In `.github/workflows/deploy.yml`**, add validation job:

```yaml
lint:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: 20
        cache: npm
    - run: npm ci
    - run: npx html-validate index.html guide/*/index.html 404.html
    - run: npx linkinator https://anomaly-alpha.github.io --recurse --skip '^(?!https://anomaly-alpha.github.io)'
      continue-on-error: true  # Don't block deploy for external link issues
```

---

## Step 8: Add more specific checks

**In `scripts/validate-meta.js`** (from Plan 05/06), add check for broken guide links:

```js
// Verify all cross-guide links point to existing files
var guides = ['code', 'event', 'pvp', 'login', 'faq', 'beginners'];
guides.forEach(function(page) {
  var html = readFileSync('guide/' + page + '/index.html', 'utf8');
  guides.forEach(function(target) {
    if (page !== target) {
      var pattern = 'href="guide/' + target + '/"';
      if (!html.includes(pattern)) {
        console.error('✗ guide/' + page + ' missing link to guide/' + target);
        hasError = true;
      }
    }
  });
});
```

---

## Files Created/Modified

| File | Status |
|------|--------|
| `.htmlvalidate.json` | **New** |
| `package.json` | Add `validate:html`, `validate:links`, `validate:links:local` scripts |
| `.github/workflows/deploy.yml` | Add lint/validation job |
| `scripts/validate-meta.js` | Add cross-guide link check |

---

## Verification

```bash
npm run validate:html
# Expected: No errors, warnings reviewed

# If running locally:
npm run validate:links:local
# Expected: All links return 200
```
