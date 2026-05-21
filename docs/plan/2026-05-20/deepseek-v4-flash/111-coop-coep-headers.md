# Plan 111: COOP/COEP Headers (Cross-Origin Isolation)

**Gap:** No cross-origin isolation headers. While the site has no cross-origin content, COOP/COEP prevent side-channel attacks (Spectre) and enable powerful APIs like `SharedArrayBuffer`.

**Best practice (web.dev):** Set `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` for full isolation.

---

## Step 1: Add COOP header

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

**In `_headers`:**
```
/*
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Embedder-Policy: require-corp
```

---

## Step 2: Check for CORP issues

Since all assets are same-origin (zero CDN policy), COEP `require-corp` should cause no issues. Verify:

```bash
# Navigate all pages — check console for COEP violations
# Expected: 0 violations
```

---

## Step 3: Test in Chrome

```bash
# Open DevTools → Application → Check "Cross-Origin Isolation" status
# Expected: "Cross-Origin Isolation" = true
```

---

## Files Modified: `_headers`
