# Plan 123: Error.cause Chains

**Gap:** Errors thrown by the app (config validation, Chart.js load failure, PvP calculation errors) lose context. A "failed to load chart" error doesn't show why — was it a network error, SRI mismatch, or OOM?

**Best practice (MDN):** Use `Error.cause` to chain errors — each error wraps the previous with context, enabling debugging without losing the original error.

---

## Step 1: Add error wrapping

```js
function loadChartJs() {
  try {
    // ... load chart ...
  } catch (err) {
    throw new Error('Failed to initialize charts', { cause: err });
  }
}
```

---

## Step 2: Apply to config loading

```js
function loadConfig(id) {
  var el = document.getElementById(id);
  if (!el) return {};
  try {
    return JSON.parse(el.textContent);
  } catch (err) {
    console.warn('Config parse error', new Error('Failed to parse ' + id, { cause: err }));
    return {};
  }
}
```

---

## Step 3: Apply to PvP calculations

```js
function getPvpPayout(arena, leagueId, rank) {
  try {
    // ... calculation ...
  } catch (err) {
    throw new Error('PvP payout failed for ' + arena + ' L' + leagueId + ' R' + rank, { cause: err });
  }
}
```

---

## Step 4: Create a centralized error handler

```js
function handleError(context, err) {
  var chained = new Error(context, { cause: err });
  console.warn(chained.message, chained.cause);
  // Optionally report to analytics
  if (typeof trackEvent === 'function') {
    trackEvent('Error', { context: context, message: err.message });
  }
  return chained;
}
```

Usage:
```js
try { updatePvpCard(id); }
catch (err) { handleError('updatePvpCard(' + id + ')', err); }
```

---

## Files Modified: `script.js`
