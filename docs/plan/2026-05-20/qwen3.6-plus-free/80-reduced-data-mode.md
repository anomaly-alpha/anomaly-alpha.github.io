# Plan 80: Reduced Data Mode

**Problem:** Users on metered connections or with "Reduce Data" enabled on their device still load the full page including Chart.js preload hints and font preloads.

**Goal:** Respect `Save-Data` header and `prefers-reduced-data` media query to reduce bandwidth.

---

## Step 1: Detect reduced data preference

```javascript
// script.js — add to loadAllConfigs
function isReducedData() {
  // Check navigator.connection.saveData
  if (navigator.connection && navigator.connection.saveData) return true;

  // Check prefers-reduced-data (future standard)
  if (window.matchMedia('(prefers-reduced-data: reduce)').matches) return true;

  return false;
}
```

## Step 2: Skip non-essential loads

```javascript
// script.js — modify font preload and chart preload
if (!isReducedData()) {
  // Only preload fonts and charts when not in reduced data mode
  // Preload links are already in HTML — remove them dynamically
  document.querySelectorAll('link[rel="preload"][as="font"]').forEach(function(link) {
    link.remove();
  });
}

// Chart preload
if (isReducedData()) {
  // Don't preload Chart.js — load only on explicit click
  chartPreloadObserver.disconnect();
}
```

## Step 3: Add reduced-data CSS

```css
@media (prefers-reduced-data: reduce) {
  .gem-orb { display: none; }
  body::after { display: none; }
  .gem-float-particle { display: none; }
}
```

## Files Modified
- `script.js` — reduced data detection
- `styles.css` — reduced data media query

## Verification
```bash
# DevTools > Network > Slow 3G + Save-Data header
# Fonts should not preload
# Orbs and particles should be hidden
```
