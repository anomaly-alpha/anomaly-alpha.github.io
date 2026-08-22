# Plan 10: Automated Link Checker

**Problem:** No automated checking of links. Broken internal links (e.g., after renaming a guide) and external links (expired promo code redirect pages) are only found manually.

**Goal:** Add a link checker to the CI pipeline that checks all href attributes on all 8 pages, reports broken links, and fails CI if critical links are broken.

---

## Step 1: Install link checker and create config
Install `check-links` or use `lychee` for fast link checking:

```bash
npm install --save-dev lychee
```

Create `lychee.config.js`:

```javascript
module.exports = {
  output: {
    format: 'compact'
  },
  exclude: [
    '/guide/*/index.html', // skip for now, add back after verifying
  ],
  retryCount: 2,
  timeout: 10000,
  userAgent: 'GemRewardsBot/1.0'
};
```

## Step 2: Create link-check script
Add to `package.json`:

```json
{
  "scripts": {
    "check-links": "lychee --config lychee.config.js index.html guide/*/index.html"
  }
}
```

## Step 3: Run and fix broken links
Run the checker:

```bash
npm run check-links
```

Common issues to fix:
- Internal links to guide pages: `/guide/code/` should resolve to `guide/code/index.html`
- Promo code URLs: `redeem.invincible.ubisoft.barcelona` may change — verify
- External game links: verify they still point to correct Ubisoft pages
- Sitemap links: verify all 7 URLs in sitemap.xml are reachable

Fix any 404s or timeouts. Add known broken external links to the exclude list if they can't be fixed.

## Step 4: Add to CI
Add to `.github/workflows/ci.yml`:

```yaml
      - name: Check links
        run: npm run check-links
```

## Files Modified
- `package.json` — add check-links script
- `lychee.config.js` — new file
- `.github/workflows/ci.yml` — add link check step
- `index.html` — fix any broken links found
- `guide/*/index.html` — fix any broken links found

## Verification
```bash
npm run check-links
# 0 failing links (warnings acceptable for rate-limited external URLs)
```