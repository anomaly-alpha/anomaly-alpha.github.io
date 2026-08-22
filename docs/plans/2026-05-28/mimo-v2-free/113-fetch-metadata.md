# Plan 113: Fetch Metadata Headers

**Gap:** No `Sec-Fetch-*` headers are enforced server-side. These headers tell the server the context of a request (user click vs. JS-initiated vs. embed), enabling request forgery protection.

**Best practice (W3C):** Validate `Sec-Fetch-Site`, `Sec-Fetch-Mode`, `Sec-Fetch-Dest` on the server. For static sites, these are set automatically by browsers — document what the expected values are.

---

## Step 1: Document expected Fetch Metadata values

| Header | Expected Value | Meaning |
|--------|---------------|---------|
| `Sec-Fetch-Site` | `same-origin` | All requests from our domain |
| `Sec-Fetch-Mode` | `navigate` (HTML) / `no-cors` (assets) | Standard navigation, asset loading |
| `Sec-Fetch-Dest` | `document` (HTML) / `style` (CSS) / `script` (JS) | Resource type |
| `Sec-Fetch-User` | `?1` | User-initiated navigation |

---

## Step 2: Add validation in CI

```js
// scripts/check-fetch-metadata.js
// Verify all pages return expected Sec-Fetch headers
```

---

## Step 3: Since GH Pages can't enforce server-side...

Document this as a best practice note: "If migrating to a server that can evaluate request headers, add `Sec-Fetch-*` validation for CSRF protection."

---

## Files Modified: None (documentation only)
