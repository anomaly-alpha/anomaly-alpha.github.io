# Plan 147: PerformanceObserver Setup

**Problem:** No real-user performance monitoring exists. PerformanceObserver can capture Core Web Vitals metrics from actual users.

**Goal:** Add PerformanceObserver to track LCP, CLS, and INP.

---

## Step 1: Add PerformanceObserver

```javascript
// script.js
function initPerformanceObserver() {
  if (!('PerformanceObserver' in window)) return;

  // LCP
  var lcpObserver = new PerformanceObserver(function(list) {
    var entries = list.getEntries();
    var lastEntry = entries[entries.length - 1];
    console.log('[Perf] LCP:', Math.round(lastEntry.startTime) + 'ms');
    // Send to analytics
    sendMetric('lcp', Math.round(lastEntry.startTime));
  });
  lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });

  // CLS
  var clsValue = 0;
  var clsObserver = new PerformanceObserver(function(list) {
    list.getEntries().forEach(function(entry) {
      if (!entry.hadRecentInput) {
        clsValue += entry.value;
      }
    });
    console.log('[Perf] CLS:', clsValue.toFixed(4));
    sendMetric('cls', clsValue);
  });
  clsObserver.observe({ type: 'layout-shift', buffered: true });

  // INP
  var inpObserver = new PerformanceObserver(function(list) {
    var entries = list.getEntries();
    var maxDuration = 0;
    entries.forEach(function(entry) {
      if (entry.duration > maxDuration) maxDuration = entry.duration;
    });
    console.log('[Perf] INP:', Math.round(maxDuration) + 'ms');
    sendMetric('inp', Math.round(maxDuration));
  });
  inpObserver.observe({ type: 'event', buffered: true });
}

function sendMetric(name, value) {
  // Store in localStorage for later export
  var metrics = JSON.parse(localStorage.getItem('gem_perf_metrics') || '[]');
  metrics.push({ name: name, value: value, date: Date.now() });
  if (metrics.length > 100) metrics = metrics.slice(-100);
  localStorage.setItem('gem_perf_metrics', JSON.stringify(metrics));
}
```

## Step 2: Initialize on load

```javascript
// script.js — add to DOMContentLoaded
requestAnimationFrame(function() {
  initPerformanceObserver();
});
```

## Files Modified
- `script.js` — PerformanceObserver setup

## Verification
```bash
npm run build
# DevTools > Console — should show LCP, CLS, INP metrics
# localStorage — should store metrics
```
