# Plan 65: OG Video Tags for Share

**Problem:** OG tags only include static images. Adding video tags (even a short animated preview) would make shares more engaging on platforms that support video previews.

**Goal:** Create a short animated OG video and add video tags to meta.

---

## Step 1: Create OG video

Use a screen recording of the calculator in action (mode toggling, counter animation, chart display) — 15 seconds, 1280x720, MP4.

```bash
# Place at og-images/preview.mp4
```

## Step 2: Add video OG tags

```html
<!-- index.html — add to <head> -->
<meta property="og:video" content="https://anomaly-alpha.github.io/og-images/preview.mp4">
<meta property="og:video:type" content="video/mp4">
<meta property="og:video:width" content="1280">
<meta property="og:video:height" content="720">
<meta property="og:video:secure_url" content="https://anomaly-alpha.github.io/og-images/preview.mp4">
```

## Files Modified
- `og-images/preview.mp4` — new file
- `index.html` — video OG tags

## Verification
```bash
# Facebook Sharing Debugger
https://developers.facebook.com/tools/debug/
# Should show video preview option
```
