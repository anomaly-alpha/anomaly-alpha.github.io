# Plan 57: Deferred Chart.js Loading

**Problem:** Chart.js (205KB) is loaded on first "Show Charts" click, but the loading isn't deferred optimally. The script blocks parsing during load.

**Goal:** Use `<script type="module">` with dynamic import for non-blocking Chart.js loading.

---

## Step 1: Update loadChartJs function

```javascript
// script.js — replace existing loadChartJs
var chartJsLoaded = false;
var chartJsLoading = false;

function loadChartJs() {
  if (chartJsLoaded || chartJsLoading) return Promise.resolve();
  chartJsLoading = true;

  return new Promise(function(resolve, reject) {
    var script = document.createElement('script');
    script.src = 'vendor/chart.umd.js';
    script.onload = function() {
      chartJsLoaded = true;
      chartJsLoading = false;
      resolve();
    };
    script.onerror = function() {
      chartJsLoading = false;
      reject(new Error('Failed to load Chart.js'));
    };
    document.head.appendChild(script);
  });
}
```

## Step 2: Add preload hint when charts section is near viewport

```javascript
// script.js — add to scroll handler or IntersectionObserver
var chartPreloadObserver = new IntersectionObserver(function(entries) {
  entries.forEach(function(entry) {
    if (entry.isIntersecting && !chartJsLoaded && !chartJsLoading) {
      // Preload but don't execute
      var link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'script';
      link.href = 'vendor/chart.umd.js';
      document.head.appendChild(link);
      chartPreloadObserver.disconnect();
    }
  });
}, { rootMargin: '500px' });

chartPreloadObserver.observe(document.querySelector('.gem-chart'));
```

## Files Modified
- `script.js` — improved loadChartJs, preload observer

## Verification
```bash
npm run build
# Network tab — Chart.js should preload when scrolled near
# Click "Show Charts" — should use preloaded version
```
