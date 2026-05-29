# Plan 135: stale-while-revalidate Caching Strategy

**Gap:** The service worker (Plan 03) uses network-first strategy. For config data that changes infrequently (payout tables, leagues), `stale-while-revalidate` offers faster loads: serve cached data immediately, then update in background.

**Best practice (web.dev):** Use stale-while-revalidate for API-like responses (config data) and network-first for HTML. This gives instant loads with fresh data shortly after.

---

## Step 1: Update service worker strategy

```js
// sw.js — add separate handlers for config vs. HTML

self.addEventListener('fetch', function (event) {
  var url = new URL(event.request.url);

  // Config-ish URLs: stale-while-revalidate
  if (url.pathname === '/' || url.pathname.startsWith('/guide/')) {
    event.respondWith(staleWhileRevalidate(event.request));
  } else {
    // Static assets: cache-first
    event.respondWith(cacheFirst(event.request));
  }
});

async function staleWhileRevalidate(request) {
  var cache = await caches.open(CACHE_NAME);
  var cached = await cache.match(request);

  // Return cached immediately (even if stale)
  var response = cached || new Response('', { status: 408 });

  // Update cache in background
  fetch(request).then(function (networkResponse) {
    if (networkResponse && networkResponse.ok) {
      cache.put(request, networkResponse);
    }
  }).catch(function () {
    // Network failed — cached version is better than nothing
  });

  return response;
}

async function cacheFirst(request) {
  var cache = await caches.open(CACHE_NAME);
  var cached = await cache.match(request);
  if (cached) return cached;

  var networkResponse = await fetch(request);
  if (networkResponse && networkResponse.ok) {
    cache.put(request, networkResponse.clone());
  }
  return networkResponse;
}
```

---

## Step 2: Add versioning to force refresh

```js
var CACHE_VERSION = 'v2';
var CACHE_NAME = 'gem-cache-' + CACHE_VERSION;
```

Bump `CACHE_VERSION` on each deploy to invalidate old caches.

---

## Step 3: Measure performance

```bash
# First visit: network request (normal)
# Second visit (online): served from cache, updated in bg
# Third visit (offline): served from cache
# Time to Interactive:
#   Before (network-first): ~800ms
#   After (stale-while-revalidate): ~200ms (instant from cache)
```

---

## Files Modified: `sw.js`
