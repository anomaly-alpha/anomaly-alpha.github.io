# Plan 111: AbortController for Timers

**Problem:** `setInterval` and `setTimeout` timers are never cleaned up properly. If the page is navigated away and back, timers may accumulate.

**Goal:** Use AbortController to manage timer lifecycle.

---

## Step 1: Create timer manager

```javascript
// script.js
var TIMER_CONTROLLER = new AbortController();

function managedInterval(fn, ms) {
  var id = setInterval(function() {
    if (TIMER_CONTROLLER.signal.aborted) {
      clearInterval(id);
      return;
    }
    fn();
  }, ms);
  return id;
}

function managedTimeout(fn, ms) {
  var id = setTimeout(function() {
    if (TIMER_CONTROLLER.signal.aborted) return;
    fn();
  }, ms);
  return id;
}

function clearAllTimers() {
  TIMER_CONTROLLER.abort();
  TIMER_CONTROLLER = new AbortController();
}
```

## Step 2: Replace existing timers

```javascript
// Before
setInterval(updateCountdown, 5000);

// After
managedInterval(updateCountdown, 5000);
```

## Step 3: Clean up on pagehide

```javascript
window.addEventListener('pagehide', clearAllTimers);
```

## Files Modified
- `script.js` — timer manager, replaced timers

## Verification
```bash
npm run build
# Navigate away and back — no duplicate timers
# DevTools > Performance — no orphaned intervals
```
