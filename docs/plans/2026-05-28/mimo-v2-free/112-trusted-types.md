# Plan 112: Trusted Types

**Gap:** The site uses `innerHTML` for modal content, promo code rendering, and dynamic UI elements. Without Trusted Types, any injection vulnerability in these strings could lead to XSS.

**Best practice (W3C):** Enforce Trusted Types to prevent DOM XSS. Only allow strings created by a policy or sanitizer to be assigned to `innerHTML`.

---

## Step 1: Add Trusted Types policy

```js
// Create a sanitization policy
var htmlPolicy = trustedTypes.createPolicy('gem-html', {
  createHTML: function (input) {
    // Remove script tags and event handlers
    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/\bon\w+\s*=\s*"[^"]*"/gi, '')
      .replace(/\bon\w+\s*=\s*'[^']*'/gi, '');
  }
});

// Usage instead of direct innerHTML:
element.innerHTML = htmlPolicy.createHTML(htmlString);
```

---

## Step 2: Enforce Trusted Types via CSP

```html
<meta http-equiv="Content-Security-Policy" content="
  require-trusted-types-for 'script';
  trusted-types gem-html;
">
```

---

## Step 3: Audit all innerHTML assignments

```bash
grep -n 'innerHTML\s*=' script.src.js
```

Replace each with `htmlPolicy.createHTML()`.

---

## Step 4: Test

```bash
# Open page — check console for Trusted Types violations
# Expected: 0 violations
# If any, either add the string to a policy or use safe DOM methods (createElement, textContent)
```

---

## Files Modified: `script.js`, `index.html`
