# Plan 91: bfcache Compatibility

**Problem:** The page may not be eligible for bfcache (back/forward cache) due to certain JavaScript patterns. bfcache enables instant page restoration when navigating back.

**Goal:** Ensure the page is bfcache-compatible by avoiding blocking patterns.

---

## Step 1: Audit bfcache blockers

```javascript
// script.js — check for these patterns:
// 1. unload event listeners (use pagehide instead)
// 2. open WebSocket connections
// 3. unhandled beforeunload prompts

// Replace any unload listeners
// Before
window.addEventListener('unload', cleanup);

// After
window.addEventListener('pagehide', cleanup);
```

## Step 2: Add pageshow handler for restoration

```javascript
// script.js
window.addEventListener('pageshow', function(e) {
  if (e.persisted) {
    // Page restored from bfcache — reinitialize if needed
    updateAllPageTotals();
    updateChartsByModes(selectedModes);
  }
});
```

## Step 3: Verify bfcache eligibility

```bash
# Chrome DevTools > Application > Back-forward cache
# Navigate away and back — should show "Restored from bfcache"
```

## Files Modified
- `script.js` — pagehide/pageshow handlers

## Verification
```bash
# Navigate to page, click a link, press Back
# Page should restore instantly (not reload)
# DevTools > Performance — no network requests on back navigation
```
