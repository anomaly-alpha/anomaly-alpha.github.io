# Plan 102: Trusted Types

**Problem:** `innerHTML` usage is a DOM XSS vector. Trusted Types provides a programmatic way to prevent DOM XSS by requiring all HTML to go through a sanitizer.

**Goal:** Add a Trusted Types policy that sanitizes HTML before insertion.

---

## Step 1: Create Trusted Types policy

```javascript
// script.js — add at top
var gemPolicy = null;
if (window.trustedTypes && trustedTypes.createPolicy) {
  gemPolicy = trustedTypes.createPolicy('gem-policy', {
    createHTML: function(input) {
      // Simple sanitization — strip script tags
      return input.replace(/<script[\s\S]*?<\/script>/gi, '')
                  .replace(/on\w+="[^"]*"/gi, '');
    }
  });
}
```

## Step 2: Use policy for innerHTML

```javascript
// Before
el.innerHTML = htmlString;

// After
el.innerHTML = gemPolicy ? gemPolicy.createHTML(htmlString) : htmlString;
```

## Step 3: Add CSP header for Trusted Types

```
# _headers
/*
  Content-Security-Policy: ... require-trusted-types-for 'script'; trusted-types gem-policy
```

## Files Modified
- `script.js` — Trusted Types policy
- `_headers` — CSP with Trusted Types

## Verification
```bash
# DevTools > Console — no Trusted Types violations
# Attempting to set innerHTML without policy should fail
```
