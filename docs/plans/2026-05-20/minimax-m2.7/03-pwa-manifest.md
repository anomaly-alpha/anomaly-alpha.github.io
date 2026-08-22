# Plan 03: Progressive Web App Manifest

**Problem:** The site is not installable on mobile — no manifest.json or service worker means users can't add it to their home screen, and offline access is impossible.

**Goal:** Add a web app manifest and service worker so users can install the app and access it offline. Verified by opening Chrome DevTools > Application > PWA and seeing all criteria met.

---

## Step 1: Create manifest.json
Create `manifest.json` in the project root with all required PWA fields.

```json
{
  "name": "Gem Rewards Calculator - Invincible Guarding the Globe",
  "short_name": "Gem Calculator",
  "description": "Calculate your weekly gem income from Events, PvP, Login, and Promo Codes",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#050a14",
  "theme_color": "#00e5ff",
  "orientation": "portrait-primary",
  "icons": [
    {
      "src": "og-images/home.png",
      "sizes": "1200x630",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "favicon.svg",
      "sizes": "any",
      "type": "image/svg+xml",
      "purpose": "maskable"
    }
  ],
  "categories": ["games", "utilities"],
  "lang": "en-US"
}
```

## Step 2: Add manifest link and theme-color to all HTML pages
Add the manifest link and theme-color meta tag to `index.html` and all 6 guide pages.

```html
<link rel="manifest" href="/manifest.json">
<meta name="theme-color" content="#00e5ff">
```

Add to `index.html` in the `<head>` after the canonical link.

## Step 3: Create service worker
Create `sw.js` for basic offline support:

```javascript
const CACHE_NAME = 'gem-rewards-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/tailwind.css',
  '/script.js',
  '/manifest.json',
  '/favicon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
});
```

## Step 4: Register service worker in HTML
Add service worker registration to the end of the DOMContentLoaded block in script.js or as an inline script in HTML:

```javascript
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
```

Add this to index.html before the closing `</body>`.

## Files Modified
- `manifest.json` — new file
- `sw.js` — new file
- `index.html` — add manifest link, theme-color, SW registration
- `guide/*/index.html` — add manifest link, theme-color

## Verification
```bash
# After building, serve with a local server and test:
npx serve .
# Open Chrome DevTools > Application > Service Workers > PWA > Manifest
# Check "Add to homescreen" and verify no errors
```