# Plan 74: OpenGraph Video for Guide Pages

**Problem:** Guide pages have OG:image but no OG:video. If a guide page has an embedded tutorial video (now or in the future), OG:video enables video-rich sharing on social platforms.

**Goal:** Add OG:video meta tags. For now, point to a placeholder. Structure for future video content.

---

## Step 1: Add OG:video tags

```html
<meta property="og:video" content="https://anomaly-alpha.github.io/og-videos/guide-intro.mp4">
<meta property="og:video:type" content="video/mp4">
<meta property="og:video:width" content="1280">
<meta property="og:video:height" content="720">
```

---

## Step 2: Create placeholder directory

```bash
mkdir -p og-videos
# Add a simple animated placeholder using canvas or remove tag until video exists
```

**Better approach:** Only add OG:video tags when actual video content exists. For now, add commented-out template:

```html
<!-- OG:video tags — uncomment when video content is available -->
<!-- <meta property="og:video" content="..."> -->
```

---

## Step 3: Prepare for future content

- Use FFmpeg or similar to create short screen recordings
- Add to CI pipeline to generate video thumbnails
- Self-host videos in `og-videos/` directory

---

## Step 4: Test with social sharing debuggers

```bash
# Facebook Sharing Debugger:
# https://developers.facebook.com/tools/debug/
# Paste URL and verify video appears in share preview
```

---

## Files Modified: `guide/*/index.html` (×6)
