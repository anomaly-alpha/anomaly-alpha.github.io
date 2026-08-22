# Plan 121: Network Information API

**Problem:** Users on slow connections don't get an optimized experience. The Network Information API can detect connection quality and adjust accordingly.

**Goal:** Detect slow connections and reduce non-essential features.

---

## Step 1: Detect connection quality

```javascript
// script.js
function isSlowConnection() {
  var conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (!conn) return false;
  return conn.effectiveType === 'slow-2g' || conn.effectiveType === '2g' || conn.effectiveType === '3g';
}

function applySlowConnectionMode() {
  if (!isSlowConnection()) return;

  // Disable chart preloading
  chartPreloadObserver.disconnect();

  // Hide decorative elements
  document.querySelectorAll('.gem-orb').forEach(function(el) {
    el.style.display = 'none';
  });

  // Disable particle animation
  document.body.classList.add('slow-connection');

  console.log('[Gem Rewards] Slow connection mode enabled');
}
```

## Step 2: Add CSS for slow connection

```css
/* styles.css */
.slow-connection .gem-float-particle {
  display: none;
}

.slow-connection .gem-orb {
  display: none;
}
```

## Step 3: Call on load

```javascript
// script.js — add to DOMContentLoaded
applySlowConnectionMode();

// Listen for connection changes
var conn = navigator.connection;
if (conn) {
  conn.addEventListener('change', applySlowConnectionMode);
}
```

## Files Modified
- `script.js` — connection detection
- `styles.css` — slow connection styles

## Verification
```bash
# DevTools > Network > Throttle to Slow 3G
# Orbs and particles should be hidden
```
