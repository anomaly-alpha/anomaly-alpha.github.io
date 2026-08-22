# Plan 156: robots.txt Enhancement

**Problem:** The current robots.txt is minimal. It should include sitemap reference, crawl delay hints, and disallow rules for non-public paths.

**Goal:** Enhance robots.txt with comprehensive directives.

---

## Step 1: Update robots.txt

```
# robots.txt
User-agent: *
Allow: /
Allow: /guide/
Allow: /og-images/

# Disallow non-public paths
Disallow: /docs/
Disallow: /scripts/
Disallow: /src/
Disallow: /data/
Disallow: /journal/
Disallow: /node_modules/

# Sitemap
Sitemap: https://anomaly-alpha.github.io/sitemap.xml

# Crawl-delay for polite crawling
Crawl-delay: 1
```

## Step 2: Add OG images to sitemap

Ensure all OG image URLs are accessible to crawlers.

## Files Modified
- `robots.txt` — enhanced directives

## Verification
```bash
# Visit /robots.txt
# Should show all directives
# Google Search Console — test robots.txt
```
