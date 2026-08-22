# Plan 52: Brotli Compression

**Problem:** Static assets are served without Brotli compression on Cloudflare Pages. Brotli achieves ~15-20% better compression than gzip for text assets.

**Goal:** Pre-compress assets with Brotli and configure Cloudflare to serve them.

---

## Step 1: Install Brotli tool

```bash
npm install --save-dev brotli
```

## Step 2: Add Brotli compression to build

```json
// package.json
"build:brotli": "node -e \"var f=require('fs'),b=require('brotli');['script.js','styles.css','tailwind.css','index.html'].forEach(function(p){var c=f.readFileSync(p);f.writeFileSync(p+'.br',b.compress(c,{quality:11}))})\""
```

## Step 3: Configure Cloudflare Pages

Add to `_headers`:

```
/*.br
  Content-Encoding: br
  Content-Type: application/octet-stream
```

Or use Cloudflare's automatic Brotli compression in dashboard settings (Auto Minify + Brotli).

## Files Modified
- `package.json` — build:brotli script

## Verification
```bash
npm run build:brotli
ls *.br  # Should show compressed files
# Compare sizes
wc -c script.js script.js.br
```
