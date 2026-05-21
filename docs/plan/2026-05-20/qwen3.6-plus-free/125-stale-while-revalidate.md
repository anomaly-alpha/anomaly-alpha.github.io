# Plan 125: Stale-While-Revalidate Caching

**Problem:** The service worker (Plan 03) uses a cache-first strategy. Updated content won't appear until the cache is busted. Stale-while-revalidate serves cached content immediately while fetching updates in the background.

**Goal:** Update the service worker to use stale-while-revalidate for HTML pages.

---

## Step 1: Update service worker fetch handler

```javascript
// sw.js — replace fetch handler
self.addEventListener('fetch', function(event) {
  var request = event.request;

  // HTML pages: stale-while-revalidate
  if (request.destination === 'document' || request.url.endsWith('.html')) {
    event.respondWith(
      caches.open(CACHE_NAME).then(function(cache) {
        return cache.match(request).then(function(cached) {
          var fetchPromise = fetch(request).then(function(response) {
            cache.put(request, response.clone());
            return response;
          }).catch(function() { return cached; });
          return cached || fetchPromise;
        });
      })
    );
    return;
  }

  // Static assets: cache-first
  event.respondWith(
    caches.match(request).then(function(cached) {
      return cached || fetch(request);
    })
  );
});
```

## Files Modified
- `sw.js` — updated fetch handler

## Verification
```bash
# First load — cached version served
# In background — fresh version fetched and cached
# Second load — updated version served
```
