# Plan 76: Twitter Image Meta Tags Per Page

**Problem:** The `twitter:image` meta tag may reference the same image for all pages. Twitter recommends page-specific images for optimal sharing.

**Goal:** Ensure `twitter:image` references the per-page OG image (WebP or PNG), distinct for each guide page.

---

## Step 1: Audit current Twitter image tags

```bash
for f in index.html guide/*/index.html; do
  echo "=== $(basename $(dirname $f)) ==="
  grep 'twitter:image' "$f"
done
```

---

## Step 2: Set per-page Twitter images

| Page | Twitter Image |
|------|---------------|
| Home | `og-images/home.webp` |
| Code Guide | `og-images/code.webp` |
| Event Guide | `og-images/event.webp` |
| PvP Guide | `og-images/pvp.webp` |
| Login Guide | `og-images/login.webp` |
| FAQ Guide | `og-images/faq.webp` |
| Beginners Guide | `og-images/beginners.webp` |

---

## Step 3: Add Twitter image dimensions

```html
<meta name="twitter:image:width" content="1200">
<meta name="twitter:image:height" content="630">
```

---

## Step 4: Test with Twitter Card Validator

```bash
# Go to https://cards-dev.twitter.com/validator
# Enter each page URL
# Verify the correct per-page image appears
```

---

## Files Modified: `index.html`, `guide/*/index.html`, `404.html`
