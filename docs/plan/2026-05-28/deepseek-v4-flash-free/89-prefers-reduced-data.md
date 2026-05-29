# Plan 89: prefers-reduced-data Support

**Problem:** Users on metered connections or with data-saver mode enabled may want to avoid loading non-essential assets (Chart.js, fonts, background particles).

**Goal:** Add `prefers-reduced-data: reduce` support that reduces non-essential resource loading.

---

## Step 1: Detect reduced data preference

```js
function isReducedData() {
  if (navigator.connection && navigator.connection.saveData) {
    return true; // Data Saver mode
  }
  if (window.matchMedia && window.matchMedia('(prefers-reduced-data: reduce)').matches) {
    return true;
  }
  return false;
}
```

---

## Step 2: Skip Chart.js preload

```js
function loadChartJs() {
  if (isReducedData()) {
    showChartMessage('Charts disabled in data saver mode');
    return;
  }
  // ... normal loading ...
}
```

---

## Step 3: Disable background particles

```js
function initParticles() {
  if (isReducedData()) return; // Skip particles
  // ... existing particle initialization ...
}
```

Or via CSS:
```css
@media (prefers-reduced-data: reduce) {
  .gem-particle, .gem-orb { display: none !important; }
}
```

---

## Step 4: Reduce font loading

Skip preloading secondary fonts:
```js
if (!isReducedData()) {
  preloadFont('fonts/orbitron-variable.woff2');
  preloadFont('fonts/rajdhani-bold.woff2');
}
```

---

## Step 5: Add data-saver badge

```html
<div id="data-saver-badge" class="gem-data-saver" style="display:none">
  Data saver mode active — some features disabled
</div>
```

```js
if (isReducedData()) {
  document.getElementById('data-saver-badge').style.display = 'block';
}
```

---

## Files Modified: `script.js`, `styles.css`
