# Plan 04: Web App Manifest

**Problem:** No `manifest.json` exists. When users add the site to their home screen on mobile, it uses default browser icons and opens in a browser tab instead of a standalone app window.

**Goal:** Create a web app manifest with app name, icons, theme colors, and display mode for installability.

---

## Step 1: Create manifest.json

```json
{
  "name": "Invincible Gem Rewards Calculator",
  "short_name": "Gem Rewards",
  "description": "Plan your weekly gem income in Invincible Guarding the Globe",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#050a14",
  "theme_color": "#00e5ff",
  "icons": [
    {
      "src": "/favicon.svg",
      "sizes": "any",
      "type": "image/svg+xml",
      "purpose": "any"
    },
    {
      "src": "/og-images/home.png",
      "sizes": "1200x630",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ],
  "categories": ["games", "utilities"]
}
```

## Step 2: Link manifest in all HTML pages

Add to `<head>` of `index.html`, all 6 guide pages, and `404.html`:

```html
<link rel="manifest" href="/manifest.json">
<meta name="theme-color" content="#00e5ff">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
```

## Step 3: Generate proper icon sizes

Create a 192x192 and 512x512 PNG from the existing favicon for PWA requirements.

```bash
# Use existing favicon.svg to generate icons
# Place at /icons/icon-192.png and /icons/icon-512.png
# Update manifest.json src paths accordingly
```

## Files Modified
- `manifest.json` — new file
- `index.html` — manifest link + meta tags
- `guide/*/index.html` — manifest link + meta tags (6 files)
- `404.html` — manifest link + meta tags

## Verification
```bash
# Serve locally
npx serve .
# DevTools > Application > Manifest — should show all fields
# Chrome: Install icon should appear in address bar
```
