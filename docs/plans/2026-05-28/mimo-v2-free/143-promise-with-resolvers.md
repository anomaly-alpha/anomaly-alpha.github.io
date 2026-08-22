# Plan 143: `Promise.withResolvers()` for Cleaner Async

**Gap:** Creating deferred promises requires a verbose pattern: `new Promise((resolve, reject) => { /* store resolve/reject */ })`. `Promise.withResolvers()` returns `{ promise, resolve, reject }` in one call.

**Best practice (TC39):** Use `Promise.withResolvers()` (baseline 2025) for deferred promise patterns — cleaner, no nesting needed.

---

## Step 1: Find deferred promise patterns

```bash
grep -n 'new Promise.*resolve' script.src.js
```

---

## Step 2: Replace with withResolvers()

**Before:**
```js
function waitForChartLoad() {
  return new Promise(function (resolve) {
    if (window.Chart) { resolve(); return; }
    loadChartJs = resolve;
  });
}
```

**After:**
```js
function waitForChartLoad() {
  if (window.Chart) return Promise.resolve();
  var deferred = Promise.withResolvers();
  var origLoad = loadChartJs;
  loadChartJs = function () {
    origLoad();
    deferred.resolve();
  };
  return deferred.promise;
}
```

---

## Step 3: Apply to any animation-based waits

```js
function waitForAnimation() {
  var deferred = Promise.withResolvers();
  requestAnimationFrame(deferred.resolve);
  return deferred.promise;
}
```

---

## Step 4: Verify

```bash
# Test chart loading flow — no regressions
# Test any promise-dependent flows
```

---

## Files Modified: `script.js`
