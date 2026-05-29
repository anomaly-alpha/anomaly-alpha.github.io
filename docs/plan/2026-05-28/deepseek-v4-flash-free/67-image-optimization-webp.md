# Plan 67: Image Optimization (OG PNGs to WebP)

**Problem:** The 7 OG images in `og-images/` are PNG files. PNG is lossless and larger than necessary for social preview images. Converting to WebP can reduce file sizes by 25-35% with no visual quality loss.

**Goal:** Convert all OG PNGs to WebP format. Update meta tags to use WebP. Keep PNG fallbacks for old crawlers.

---

## Step 1: Measure current sizes

```bash
ls -lh og-images/*.png
# Expected: ~15-30 KB each, total ~150 KB
```

---

## Step 2: Convert to WebP

```bash
# Using cwebp (from libwebp):
brew install webp  # or apt install webp

for f in og-images/*.png; do
  cwebp -q 85 "$f" -o "${f%.png}.webp"
done

# Or using sharp (Node.js):
npm install -D sharp
node -e "
  const sharp = require('sharp');
  const fs = require('fs');
  fs.readdirSync('og-images').filter(f => f.endsWith('.png')).forEach(f => {
    sharp('og-images/' + f).webp({ quality: 85 }).toFile('og-images/' + f.replace('.png', '.webp'));
  });
"
```

---

## Step 3: Update OG meta tags

In all 7 pages and 404.html, add WebP image with fallback:

```html
<meta property="og:image" content="https://anomaly-alpha.github.io/og-images/home.webp">
<meta property="og:image:type" content="image/webp">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">

<!-- PNG fallback for crawlers that don't support WebP -->
<meta property="og:image" content="https://anomaly-alpha.github.io/og-images/home.png">
<meta property="og:image:type" content="image/png">
```

---

## Step 4: Update Twitter image tags

```html
<meta name="twitter:image" content="https://anomaly-alpha.github.io/og-images/home.webp">
```

---

## Step 5: Verify with crawler simulators

```bash
# Test OG tags:
curl -s https://anomaly-alpha.github.io | grep -o 'og:image[^"]*"[^"]*"' | head -5
# Should show WebP URLs

# Test with Facebook Sharing Debugger:
# https://developers.facebook.com/tools/debug/
# Verify it picks up the WebP image
```

---

## Files Modified: `og-images/*.webp` (new), `index.html`, `guide/*/index.html`, `404.html`
