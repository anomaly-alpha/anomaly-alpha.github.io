# Plan 99: Content Security Policy

**Problem:** No CSP header exists. A CSP would prevent XSS attacks by restricting what scripts, styles, and resources can load.

**Goal:** Add a CSP that allows only the site's own resources.

---

## Step 1: Add CSP via meta tag

```html
<!-- index.html — add to <head> -->
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data: blob:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self';">
```

## Step 2: Add to Cloudflare Pages headers

```
# _headers
/*
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data: blob:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'
```

## Step 3: Test CSP

```bash
# Chrome DevTools > Console — should show no CSP violations
# Try injecting a script — should be blocked
```

## Files Modified
- `index.html` — CSP meta tag
- `_headers` — CSP header
- All guide pages — CSP meta tag

## Verification
```bash
# DevTools > Console — no CSP errors
# All features should work normally
```
