# Plan 110: Permissions Policy Headers

**Gap:** No `Permissions-Policy` header restricts which browser APIs the site can use. This is a best practice for privacy and security, preventing accidental misuse of powerful features.

**Best practice (W3C):** Disable all unused permissions via `Permissions-Policy` HTTP header.

---

## Step 1: Add Permissions-Policy header

Since the site is on GitHub Pages (no custom server headers), use a `<meta>` equivalent or add to `_headers`.

**In `_headers`:**
```
/*
  Permissions-Policy: geolocation=(), camera=(), microphone=(), usb=(), bluetooth=(), midi=(), sync-xhr=(), accelerometer=(), gyroscope=(), magnetometer=(), payment=(), display-capture=(), publickey-credentials-get=()
```

Or use the `<meta http-equiv>` approach (less reliable — only Safari supports it for permissions-policy):

```html
<meta http-equiv="Permissions-Policy" content="geolocation=(), camera=(), microphone=()">
```

---

## Step 2: Enable only what's used

The site only uses:
- `localStorage` (no permission needed)
- `Notification` API (for Plan 52 reset notifications)
- `clipboard-write` (for Plan 54 share link)

Allow only those:
```
Permissions-Policy: clipboard-write=(self), notifications=(self)
```

---

## Step 3: Verify via DevTools

```bash
# Open DevTools → Network → Check response headers
# Verify Permissions-Policy header is present
```

---

## Files Modified: `_headers`, `index.html`
