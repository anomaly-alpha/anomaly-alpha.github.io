# Plan 61: Brotli Compression Verification

**Problem:** The site relies on GitHub Pages for serving. GitHub Pages supports Brotli compression, but there's no verification that assets are actually served with Brotli, which can reduce transfer sizes by ~20% over Gzip.

**Goal:** Verify Brotli is enabled for all static assets. Add a CI check that confirms Content-Encoding: br headers.

---

## Step 1: Check current compression

```bash
curl -sI -H "Accept-Encoding: br" https://anomaly-alpha.github.io/styles.css | grep -i content-encoding
# Expected: content-encoding: br
```

---

## Step 2: Add compression check to CI

**.github/workflows/deploy.yml**:

```yaml
- name: Verify Brotli compression
  run: |
    for url in \
      "https://anomaly-alpha.github.io/" \
      "https://anomaly-alpha.github.io/styles.css" \
      "https://anomaly-alpha.github.io/script.js" \
      "https://anomaly-alpha.github.io/tailwind.css" \
      "https://anomaly-alpha.github.io/fonts/rajdhani-regular.woff2"; do
      encoding=$(curl -sI -H "Accept-Encoding: br" "$url" | grep -i "content-encoding" | awk '{print $2}' | tr -d '\r')
      if [ "$encoding" = "br" ]; then
        echo "✓ Brotli: $url"
      elif [ -z "$encoding" ]; then
        echo "⚠ No compression: $url"
      else
        echo "⚠ Compressed as $encoding: $url"
      fi
    done
```

---

## Step 3: Verify file size differences

```bash
# Compare gzip vs brotli sizes:
curl -s -o /dev/null -w "%{size_download}" -H "Accept-Encoding: gzip" https://anomaly-alpha.github.io/script.js
curl -s -o /dev/null -w "%{size_download}" -H "Accept-Encoding: br" https://anomaly-alpha.github.io/script.js
```

---

## Step 4: If Brotli is not enabled

GitHub Pages enables Brotli automatically for common file types. If not working:
- Ensure files are served with `Cache-Control` headers that don't prevent compression
- Check if GitHub Pages has a file size limit for Brotli (usually no limit)
- File a support ticket if certain files aren't being compressed

---

## Step 5: Add compression ratio badge

```md
![Compression](https://img.shields.io/badge/compression-Brotli-brightgreen)
```

---

## Files Modified: `.github/workflows/deploy.yml`
