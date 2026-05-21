# Plan 03: PWA Service Worker

**Problem:** The site works from `file://` but has no offline capability when served over HTTP. Users on unstable connections lose access between visits. No caching strategy exists.

**Goal:** Add a service worker that caches all static assets (HTML, CSS, JS, fonts, images) for offline access, registered only when served over HTTP/HTTPS.

---

## Step 1: Create service worker file

```javascript
// sw.js
const CACHE_NAME = 'gem-rewards-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/tailwind.css',
  '/script.js',
  '/favicon.ico',
  '/favicon.svg',
  '/robots.txt',
  '/sitemap.xml',
  '/guide/code/',
  '/guide/event/',
  '/guide/pvp/',
  '/guide/login/',
  '/guide/faq/',
  '/guide/beginners/',
  '/404.html',
  '/vendor/chart.umd.js',
  '/og-images/home.png',
  '/og-images/code.png',
  '/og-images/event.png',
  '/og-images/pvp.png',
  '/og-images/login.png',
  '/og-images/faq.png',
  '/og-images/beginners.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
```

## Step 2: Register service worker in script.js

Add registration at the end of the DOMContentLoaded handler, guarded by protocol check.

```javascript
// script.js — add after existing initialization
if (location.protocol !== 'file:' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(function() {});
}
```

## Step 3: Add build step to hash cache name

To bust the cache on updates, embed a build-time hash in the service worker.

```json
// package.json — add script
"build:sw": "node -e \"var f=require('fs'),h=Date.now();var c=f.readFileSync('sw.js','utf8').replace(/gem-rewards-v\\d+/,'gem-rewards-v'+h);f.writeFileSync('sw.js',c)\""
```

Add to the main build script: `"build": "... && npm run build:sw"`

## Files Modified
- `sw.js` — new file, service worker
- `script.js` — service worker registration
- `package.json` — build:sw script

## Verification
```bash
npm run build
# Serve locally:
npx serve .
# Open http://localhost:3000
# DevTools > Application > Service Workers — should show "Activated and running"
# Go offline, reload — page should still load
```
