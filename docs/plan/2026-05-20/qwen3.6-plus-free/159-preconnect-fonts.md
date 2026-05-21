# Plan 159: Preconnect for Fonts

**Problem:** Font files are preloaded but not preconnected. Preconnect establishes the TCP/TLS handshake early, reducing font load time.

**Goal:** Add preconnect hints for font origins.

---

## Step 1: Add preconnect for self-hosted fonts

Since fonts are self-hosted, preconnect to the same origin:

```html
<!-- index.html — add to <head>, before preload -->
<link rel="preconnect" href="/" crossorigin>
<link rel="dns-prefetch" href="/">
```

## Step 2: For future CDN fonts

If fonts ever move to a CDN:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" crossorigin>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
```

## Files Modified
- `index.html` — preconnect hints
- All guide pages — preconnect hints

## Verification
```bash
npm run build
# DevTools > Network — font requests should show earlier connection start
# Waterfall should show reduced TTFB for fonts
```
