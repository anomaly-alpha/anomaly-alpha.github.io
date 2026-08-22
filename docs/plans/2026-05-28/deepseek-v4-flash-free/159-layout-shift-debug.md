# Plan 159: LayoutShift API for CLS Debugging

**Gap:** If CLS regressions occur, there's no automated way to identify which elements shifted. The LayoutShift API provides per-element shift data.

**Best practice (web.dev):** Use `PerformanceObserver` for `layout-shift` entries. Each entry includes `sources[]` identifying the DOM nodes that shifted.

---

## Step 1: Log shift sources

```js
function observeShiftSources() {
  var observer = new PerformanceObserver(function (list) {
    list.getEntries().forEach(function (entry) {
      if (entry.hadRecentInput) return;

      entry.sources.forEach(function (source) {
        var node = source.node;
        var selector = '';
        if (node) {
          selector = node.id ? '#' + node.id :
                     node.className ? '.' + node.className.split(' ')[0] :
                     node.tagName;
        }
        console.warn('CLS source:', selector,
          'currentRect:', source.currentRect,
          'previousRect:', source.previousRect);
      });
    });
  });
  observer.observe({ type: 'layout-shift', buffered: true });
}
```

---

## Step 2: Add debug mode

```js
// Only log in development
if (window.location.hostname === 'localhost' || window.location.protocol === 'file:') {
  observeShiftSources();
}
```

---

## Step 3: Create CLS budget check

```js
window.addEventListener('pagehide', function () {
  var clsValue = 0;
  // Retrieve from a stored variable
  if (window._clsTotal && window._clsTotal > 0.01) {
    console.warn('CLS budget exceeded:', window._clsTotal);
    // alert in dev mode:
    if (window.location.hostname === 'localhost') {
      alert('CLS exceeded budget: ' + window._clsTotal.toFixed(4));
    }
  }
});
```

---

## Files Modified: `script.js`
