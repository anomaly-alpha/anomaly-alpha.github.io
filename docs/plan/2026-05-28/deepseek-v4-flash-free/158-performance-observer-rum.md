# Plan 158: Performance Observer for Real-User Metrics

**Gap:** The site measures Lighthouse scores but has no real-user monitoring (RUM). `PerformanceObserver` captures actual load/CLS/INP metrics from real visitors.

**Best practice (web.dev):** Use `PerformanceObserver` to capture LCP, CLS, INP, and FID metrics. Send to analytics for real-user visibility.

---

## Step 1: Observe LCP

```js
function observeLCP() {
  var lcpObserver = new PerformanceObserver(function (list) {
    var entries = list.getEntries();
    var lastEntry = entries[entries.length - 1];
    if (lastEntry) {
      console.log('LCP:', lastEntry.startTime.toFixed(0) + 'ms');
      // Report to analytics:
      // trackMetric('LCP', lastEntry.startTime);
    }
  });
  lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
}
```

---

## Step 2: Observe CLS

```js
function observeCLS() {
  var clsValue = 0;
  var clsObserver = new PerformanceObserver(function (list) {
    for (var entry of list.getEntries()) {
      if (!entry.hadRecentInput) {
        clsValue += entry.value;
      }
    }
    console.log('CLS:', clsValue.toFixed(4));
  });
  clsObserver.observe({ type: 'layout-shift', buffered: true });

  // Report on pagehide
  window.addEventListener('pagehide', function () {
    // trackMetric('CLS', clsValue);
  });
}
```

---

## Step 3: Observe INP

```js
function observeINP() {
  if (!PerformanceObserver.supportedEntryTypes.includes('first-input')) return;

  var inpObserver = new PerformanceObserver(function (list) {
    var entries = list.getEntries();
    // Last entry is the INP value
    // console.log('INP:', entries[entries.length - 1].duration.toFixed(0) + 'ms');
  });
  inpObserver.observe({ type: 'first-input', buffered: true });
}
```

---

## Step 4: Add observer initialization

```js
if (window.PerformanceObserver) {
  observeLCP();
  observeCLS();
  observeINP();
}
```

---

## Step 5: Send to analytics

If analytics (Plan 10) is active:

```js
function trackMetric(name, value) {
  if (typeof plausible !== 'undefined') {
    plausible(name, { value: Math.round(value) });
  }
}
```

---

## Files Modified: `script.js`
