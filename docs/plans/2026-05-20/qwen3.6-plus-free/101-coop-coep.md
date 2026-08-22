# Plan 101: COOP/COEP Headers

**Problem:** Cross-Origin-Opener-Policy and Cross-Origin-Embedder-Policy headers aren't set. These enable powerful APIs like SharedArrayBuffer and improve isolation.

**Goal:** Add COOP and COEP headers for better process isolation.

---

## Step 1: Add to Cloudflare headers

```
# _headers
/*
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Embedder-Policy: require-corp
```

## Step 2: Add meta tags for non-Cloudflare hosting

```html
<!-- These can't be set via meta, but document the requirement -->
<!-- Requires server-side headers -->
```

## Step 3: Verify with DevTools

```bash
# DevTools > Application > Frames
# Should show crossOriginIsolated: true
# Enables SharedArrayBuffer if needed
```

## Files Modified
- `_headers` — COOP/COEP headers

## Verification
```bash
curl -I https://anomaly-alpha.github.io/
# Should show COOP and COEP headers
```
