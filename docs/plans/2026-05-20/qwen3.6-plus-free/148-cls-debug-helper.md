# Plan 148: CLS Debug Helper

**Problem:** Layout shifts may occur during card filtering or counter animation but are hard to debug. A CLS debug overlay highlights shifting elements.

**Goal:** Add a debug mode that highlights layout shifts.

---

## Step 1: Add CLS debug observer

```javascript
// script.js
function initCLSDebug() {
  if (!('PerformanceObserver' in window)) return;
  if (!new URLSearchParams(window.location.search).has('debug-cls')) return;

  var observer = new PerformanceObserver(function(list) {
    list.getEntries().forEach(function(entry) {
      if (entry.hadRecentInput) return;

      entry.sources.forEach(function(source) {
        if (source.node) {
          source.node.style.outline = '3px solid red';
          setTimeout(function() {
            source.node.style.outline = '';
          }, 2000);
        }
      });

      console.log('[CLS Debug]', entry.value.toFixed(4), entry.sources.map(function(s) {
        return s.node ? s.node.className || s.node.tagName : 'unknown';
      }));
    });
  });
  observer.observe({ type: 'layout-shift', buffered: true });

  console.log('[CLS Debug] Enabled — shifts will be highlighted in red');
}
```

## Step 2: Initialize

```javascript
// script.js — add to DOMContentLoaded
initCLSDebug();
```

## Files Modified
- `script.js` — CLS debug helper

## Verification
```bash
npm run build
# Visit ?debug-cls
# Toggle modes — shifting elements should flash red
```
