# Plan 67: Twitter Card Testing

**Problem:** Twitter card meta tags exist but haven't been validated with the Twitter Card Validator. The `twitter:image` tag is missing (only `og:image` is set).

**Goal:** Add missing Twitter-specific tags and validate with the card validator.

---

## Step 1: Add missing Twitter tags

```html
<!-- index.html — add to <head> -->
<meta name="twitter:image" content="https://anomaly-alpha.github.io/og-images/home.png">
<meta name="twitter:image:alt" content="Gem Rewards Calculator — Invincible Guarding the Globe">
<meta name="twitter:site" content="@anomaly">
<meta name="twitter:creator" content="@anomaly">
```

## Step 2: Add Twitter tags to all pages

Each page should have its own `twitter:image` pointing to the page-specific OG image.

## Step 3: Validate with Twitter Card Validator

```bash
# Visit https://cards-dev.twitter.com/validator
# Enter URL for each page
# Verify card renders correctly
```

## Files Modified
- All 8 HTML pages — Twitter card tags

## Verification
```bash
# Twitter Card Validator — all pages should show summary_large_image
```
