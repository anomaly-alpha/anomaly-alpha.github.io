# Plan 133: Promise.withResolvers()

**Problem:** The deferred promise pattern (creating a Promise and storing resolve/reject externally) uses a verbose pattern. `Promise.withResolvers()` provides a cleaner API.

**Goal:** Use Promise.withResolvers() for deferred promises.

---

## Step 1: Replace deferred promise pattern

```javascript
// Before
var resolveChart, rejectChart;
var chartPromise = new Promise(function(resolve, reject) {
  resolveChart = resolve;
  rejectChart = reject;
});

// After
var _c = Promise.withResolvers();
var chartPromise = _c.promise;
var resolveChart = _c.resolve;
var rejectChart = _c.reject;
```

## Step 2: Add polyfill for older browsers

```javascript
// script.js — add at top
if (!Promise.withResolvers) {
  Promise.withResolvers = function() {
    var resolve, reject;
    var promise = new Promise(function(res, rej) {
      resolve = res;
      reject = rej;
    });
    return { promise: promise, resolve: resolve, reject: reject };
  };
}
```

## Files Modified
- `script.js` — Promise.withResolvers with polyfill

## Verification
```bash
npm run build
# Deferred promises should work identically
# Chrome 119+, Firefox 121+, Safari 17.4+
```
