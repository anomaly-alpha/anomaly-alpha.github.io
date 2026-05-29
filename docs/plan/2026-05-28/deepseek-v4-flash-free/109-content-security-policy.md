# Plan 109: Content Security Policy Headers

**Gap:** No CSP headers exist. While the site has no user input or XSS surface, CSP provides defense-in-depth against injected scripts and limits what resources can load.

**Best practice:** Use `Content-Security-Policy` HTTP header or `<meta>` tag. Start with report-only mode, then enforce.

---

## Step 1: Add CSP via meta tag

```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self' 'unsafe-inline';
  style-src 'self' 'unsafe-inline';
  font-src 'self';
  img-src 'self' data:;
  connect-src 'none';
  form-action 'none';
  frame-ancestors 'none';
  base-uri 'self';
">
```

**Rationale for each directive:**
- `script-src 'self' 'unsafe-inline'` — needed for inline event handlers (`onclick`) and inline `<script>` blocks
- `style-src 'self' 'unsafe-inline'` — needed for inline `<style>` blocks
- `connect-src 'none'` — no fetch/XHR used (by design)
- `form-action 'none'` — no forms exist
- `frame-ancestors 'none'` — prevent clickjacking

---

## Step 2: Add to all pages

Same `<meta>` tag in `index.html`, all 6 guide pages, and `404.html`.

---

## Step 3: Test with report-only first

Change `Content-Security-Policy` to `Content-Security-Policy-Report-Only` and monitor browser console for violations before enforcing.

---

## Step 4: Verify no console errors

```bash
# Open each page — check for CSP violation messages in console
# Expected: 0 violations
```

---

## Files Modified: `index.html`, `guide/*/index.html`, `404.html`
