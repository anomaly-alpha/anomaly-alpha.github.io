# Plan 100: Permissions Policy Header

**Problem:** No Permissions Policy (formerly Feature Policy) header exists. This header controls which browser features (camera, microphone, geolocation) the page can use.

**Goal:** Add a Permissions Policy that disables all unnecessary features.

---

## Step 1: Add Permissions Policy meta tag

```html
<!-- index.html — add to <head> -->
<meta http-equiv="Permissions-Policy" content="camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()">
```

## Step 2: Add to Cloudflare headers

```
# _headers
/*
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()
```

## Step 3: Document allowed features

```markdown
# docs/PERMISSIONS.md
## Permissions Policy

All features disabled except:
- None — this is a static calculator, no hardware access needed
```

## Files Modified
- `index.html` — Permissions-Policy meta tag
- `_headers` — Permissions-Policy header
- All guide pages — Permissions-Policy meta tag

## Verification
```bash
# DevTools > Application > Frames — should show permissions
# navigator.camera should be undefined
```
