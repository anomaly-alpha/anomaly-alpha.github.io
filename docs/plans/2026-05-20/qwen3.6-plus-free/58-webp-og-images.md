# Plan 58: WebP OG Images

**Problem:** OG images are PNG files (~200KB each). Converting to WebP reduces size by ~60% while maintaining quality, improving page load for social sharing previews.

**Goal:** Convert OG images to WebP and update meta tags.

---

## Step 1: Convert images to WebP

```bash
# Using cwebp (install via brew install webp)
for f in og-images/*.png; do
  cwebp -q 85 "$f" -o "${f%.png}.webp"
done
```

## Step 2: Update meta tags with both formats

```html
<!-- index.html — update OG image tags -->
<meta property="og:image" content="https://anomaly-alpha.github.io/og-images/home.webp">
<meta property="og:image:type" content="image/webp">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<!-- Fallback for platforms that don't support WebP -->
<meta property="og:image" content="https://anomaly-alpha.github.io/og-images/home.png">
<meta property="og:image:type" content="image/png">
```

## Step 3: Add picture element for responsive images

```html
<!-- For guide pages that display OG images -->
<picture>
  <source srcset="og-images/home.webp" type="image/webp">
  <img src="og-images/home.png" alt="Gem Rewards" loading="lazy">
</picture>
```

## Files Modified
- `og-images/*.webp` — new WebP files
- `index.html` — OG meta tags updated
- `guide/*/index.html` — OG meta tags updated

## Verification
```bash
ls og-images/*.webp  # Should exist
# Check file sizes — WebP should be ~60% smaller
# Facebook Sharing Debugger — should show image
```
