# Plan 03: PWA Support — Manifest & Service Worker

**Problem:** The site works only when online. There's no manifest, no install prompt, no offline fallback. Mobile users who frequently reference the gem calculator during gameplay may lose access when connectivity is spotty.

**Goal:** Make the site installable (Add to Home Screen) and provide a meaningful offline experience via service worker caching.

---

## Step 1: Generate PWA icons

The site needs icons in multiple sizes for the manifest and splash screens. Use the existing `favicon.svg` as source.

**Required sizes:**
- `192x192` (manifest launcher)
- `512x512` (splash screen)
- `180x180` (Apple touch icon)

**Place in:** `icons/` directory

```bash
mkdir -p icons
# Generate from favicon.svg using a CLI tool like `sharp` or `npx @squoosh/cli`
# Or use an online converter and place manually
```

Add to HTML `<head>`:
```html
<link rel="apple-touch-icon" href="icons/icon-180.png">
<link rel="icon" type="image/svg+xml" href="favicon.svg">
```

---

## Step 2: Create `manifest.json`

**File: `manifest.json`** (root)

```json
{
  "name": "Gem Rewards Calculator — Invincible Guarding the Globe",
  "short_name": "Gem Calculator",
  "description": "Plan your weekly gem income from events, PvP, login rewards, and promo codes.",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#050a14",
  "theme_color": "#00e5ff",
  "categories": ["games", "utilities"],
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
```

---

## Step 3: Add manifest and theme meta to HTML

**In `index.html` `<head>`** (near other meta tags):

```html
<link rel="manifest" href="/manifest.json">
<meta name="theme-color" content="#00e5ff">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
```

**Same additions in all 6 guide pages** (`guide/*/index.html`).

**In `404.html`:**
Same additions.

---

## Step 4: Create the service worker

**File: `sw.js`** (root)

```js
const CACHE_NAME = 'gem-cache-v1';

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/styles.min.css',
  '/tailwind.min.css',
  '/script.js',
  '/favicon.svg',
  '/vendor/chart.umd.js',
  '/fonts/rajdhani-regular.woff2',
  '/fonts/rajdhani-semibold.woff2',
  '/fonts/rajdhani-bold.woff2',
  '/fonts/orbitron-variable.woff2',
  '/guide/code/',
  '/guide/event/',
  '/guide/pvp/',
  '/guide/login/',
  '/guide/faq/',
  '/guide/beginners/',
];

// Install: cache core assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS);
    })
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch: network first, fallback to cache
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful responses
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, clone);
        });
        return response;
      })
      .catch(() => {
        // Offline: serve from cache
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          // For navigation requests, return the offline page
          if (event.request.mode === 'navigate') {
            return caches.match('/');
          }
          return new Response('Offline', { status: 503 });
        });
      })
  );
});
```

**Strategy notes:**
- **Network-first** for fresh data (promo codes, countdown timers)
- **Cache fallback** when offline
- Guide pages are pre-cached on install so they work fully offline
- Chart.js is pre-cached (lazy-loaded, but available offline)

---

## Step 5: Register the service worker

**In `index.html`** (before closing `</body>`, or inline in `<head>`):

```html
<script>
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(() => console.log('SW registered'))
      .catch((err) => console.log('SW registration failed:', err));
  });
}
</script>
```

**In all 6 guide pages**: same registration code.

**In `404.html`**: same (with adapted path, using `/sw.js` absolute URL).

---

## Step 6: Update cache headers in `_headers`

Service worker files should not be cached aggressively:

```
/sw.js
  Cache-Control: no-cache
/manifest.json
  Cache-Control: max-age=604800
/icons/*
  Cache-Control: max-age=31536000, immutable
```

---

## Step 7: Update `404.html` to include SW registration and manifest link

The 404 page should also be installable and cachable for offline use. Add the same:
- `<link rel="manifest">` and `<meta name="theme-color">`
- SW registration script
- Icon preconnect/preload if needed

---

## Step 8: Verify

```bash
# Build first
npm run build

# Serve locally (service workers need HTTPS or localhost):
npx serve .

# In Chrome DevTools:
# 1. Application → Manifest (verify manifest loads)
# 2. Application → Service Workers (verify registration)
# 3. Network → Offline checkbox (test offline experience)
# 4. Lighthouse → PWA audit (target 90+)
```

---

## Files Created/Modified

| File | Status |
|------|--------|
| `manifest.json` | **New** |
| `sw.js` | **New** |
| `icons/icon-192.png` | **New** |
| `icons/icon-512.png` | **New** |
| `icons/icon-180.png` | **New** |
| `index.html` | Add manifest link, theme-color, SW registration |
| `guide/*/index.html` (×6) | Same additions |
| `404.html` | Same additions |
| `_headers` | Add SW/manifest cache rules |

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| SW caches stale config | Network-first strategy; version bump (`gem-cache-v2`) on deploy |
| Fonts fail to cache | Pre-cached in install step; already self-hosted so no CORS issues |
| Chart.js (vendor file) large | 205 KB pre-cached once; minor one-time cost |

---

## Best Practices Compliance (web.dev PWA Checklist)

| Criterion | Status in Plan | Notes |
|-----------|---------------|-------|
| Starts fast, stays fast | ✅ | Already 100/100 Lighthouse |
| Works in any browser | ✅ | Vanilla JS, no browser-specific APIs |
| Responsive to any screen | ⚠️ Needs work | See Plan 14 (Mobile UX) |
| Custom offline page | ✅ | SW serves cached page |
| Installable | ✅ | manifest.json + registration |
| Offline experience | ✅ | Network-first + cache fallback |
| Fully accessible | ⚠️ Needs work | See Plan 04 + Plan 44 |
| Discoverable in search | ✅ | Already 100/100 SEO |
| Any input type | ⚠️ Needs work | Plan 04 + Plan 90 (keyboard) |
| Permission context | ✅ | Notifications after user action (Plan 52) |
| Healthy code | ⚠️ Needs work | Plan 09 (linting) + Plan 46 (JSDoc) |

### Workbox Alternative

For a production-grade service worker:

```bash
npm install -D workbox-webpack-plugin
npx workbox wizard
```

```js
// workbox-config.js
module.exports = {
  globDirectory: '.',
  globPatterns: ['*.html', '*.css', '*.js', 'fonts/*.woff2', 'vendor/*.js'],
  swDest: 'sw.js',
  runtimeCaching: [{
    urlPattern: /\.(?:html|css|js|woff2)$/,
    handler: 'NetworkFirst',
    options: { cacheName: 'gem-static' }
  }]
};
```

### SW Testing Checklist

```bash
# Cold load (no SW) — all assets load
# SW install — registered in DevTools → Application → SW
# Offline navigation — each guide page renders from cache
# Cache update — deploy changes, verify new content loads
# Uninstall — clear site data, verify clean state
```
