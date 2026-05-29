# Plan 101: Back/Forward Cache (bfcache) Optimization

**Gap identified:** bfcache lets browsers instantly load pages from disk cache when using back/forward navigation. No plan addresses this. The site may be inadvertently using APIs that block bfcache (unload listeners, no-cache headers, certain JS patterns).

**Web best practices (Chrome for Developers):** bfcache eligibility requires: no `unload` listeners, no `Cache-Control: no-store`, no `window.opener` references, no beforeunload listeners without user interaction. Audit via Chrome DevTools → Application → Back/forward cache.

---

## Step 1: Remove `unload`/`beforeunload` listeners

```bash
grep -rn 'unload\|beforeunload' script.js
# Expected: none (if found, remove or migrate to 'pagehide')
```

Replace any `unload` with `pagehide`:
```js
// Before:
window.addEventListener('unload', saveState);
// After:
window.addEventListener('pagehide', saveState);
```

---

## Step 2: Check Cache-Control headers

**In `_headers`**, ensure pages are cacheable but not stale:
```
*.html
  Cache-Control: max-age=3600
```
Not `no-cache` (blocks bfcache). Not `no-store` (worst). Use `max-age=3600` (1 hour).

---

## Step 3: Avoid `window.opener` references

```bash
grep -rn 'window\.opener' script.js
# Expected: none
```

---

## Step 4: Test in DevTools

```js
// In DevTools Console, check bfcache eligibility:
window.performance.getEntriesByType('navigation').forEach(n => {
  console.log('bfcache type:', n.type);
});
```

Chrome DevTools → Application → Back-forward cache → Test.

---

## Step 5: Add bfcache test to CI

```bash
npx lighthouse http://localhost:3000 --preset=desktop --only-audits=bf-cache
```

---

## Files Modified: `script.js`, `_headers`
