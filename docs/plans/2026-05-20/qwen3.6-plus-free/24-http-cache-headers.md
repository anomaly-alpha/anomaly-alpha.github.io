# Plan 24: HTTP Cache Headers Review

**Problem:** The `_headers` file for Cloudflare Pages may not have optimal cache-control directives for all asset types. Fonts and minified assets should be cached aggressively, while HTML should use stale-while-revalidate.

**Goal:** Review and optimize cache headers for each asset type.

---

## Step 1: Review current _headers file

```
# _headers — current content
```

## Step 2: Update cache headers

```
# _headers
/*
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin

/index.html
  Cache-Control: public, max-age=0, must-revalidate

/guide/*/index.html
  Cache-Control: public, max-age=0, must-revalidate

/404.html
  Cache-Control: public, max-age=0, must-revalidate

/*.css
  Cache-Control: public, max-age=31536000, immutable

/*.js
  Cache-Control: public, max-age=31536000, immutable

/fonts/*
  Cache-Control: public, max-age=31536000, immutable

/og-images/*
  Cache-Control: public, max-age=86400, stale-while-revalidate=604800

/manifest.json
  Cache-Control: public, max-age=86400

/sw.js
  Cache-Control: public, max-age=0, must-revalidate

/robots.txt
  Cache-Control: public, max-age=86400

/sitemap.xml
  Cache-Control: public, max-age=3600
```

## Files Modified
- `_headers` — updated cache headers

## Verification
```bash
# Deploy to Cloudflare Pages
curl -I https://anomaly-alpha.github.io/index.html
curl -I https://anomaly-alpha.github.io/styles.css
curl -I https://anomaly-alpha.github.io/fonts/Rajdhani-Regular.woff2
# Check Cache-Control headers match expectations
```
