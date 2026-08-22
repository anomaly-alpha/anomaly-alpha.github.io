# Plan 113: Error.cause Propagation

**Problem:** When errors are caught and re-thrown, the original cause is lost. `Error.cause` provides a standard way to chain errors.

**Goal:** Use Error.cause for error chaining in async operations.

---

## Step 1: Update error handling with cause

```javascript
// script.js
function loadChartJs() {
  return new Promise(function(resolve, reject) {
    var script = document.createElement('script');
    script.src = 'vendor/chart.umd.js';
    script.onload = function() { resolve(); };
    script.onerror = function(e) {
      reject(new Error('Failed to load Chart.js', { cause: e }));
    };
    document.head.appendChild(script);
  });
}
```

## Step 2: Update global error handler

```javascript
window.addEventListener('error', function(e) {
  var message = e.message;
  if (e.error && e.error.cause) {
    message += ' (caused by: ' + e.error.cause.message + ')';
  }
  console.error('[Gem Rewards]', message);
});
```

## Files Modified
- `script.js` — Error.cause usage

## Verification
```bash
npm run build
# DevTools > Console — errors should show cause chain
```
