# Plan 131: Network Information API for Adaptive Loading

**Gap:** The same experience is delivered regardless of connection quality. On slow connections (2G/3G), Chart.js (205 KB) and high-resolution assets add significant delay.

**Best practice (web.dev):** Use `navigator.connection.effectiveType` to detect connection quality and adapt: skip Chart.js on slow connections, load smaller assets, or show a simplified view.

---

## Step 1: Detect connection quality

```js
function getConnectionType() {
  var conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (!conn) return 'unknown';
  return conn.effectiveType; // 'slow-2g', '2g', '3g', '4g', '5g'
}

function isSlowConnection() {
  var type = getConnectionType();
  return type === 'slow-2g' || type === '2g' || type === '3g';
}
```

---

## Step 2: Skip Chart.js on slow connections

```js
function loadChartJs() {
  if (isSlowConnection()) {
    showChartMessage('Charts disabled on slow connection to save data');
    return;
  }
  // ... normal loading ...
}
```

---

## Step 3: Show simplified layout on slow connections

```js
if (isSlowConnection()) {
  document.body.classList.add('slow-connection');
}
```

```css
.slow-connection .gem-particle,
.slow-connection .gem-orb {
  display: none;
}

.slow-connection .gem-card {
  animation: none;
  opacity: 1;
}
```

---

## Step 4: Listen for connection changes

```js
var conn = navigator.connection;
if (conn) {
  conn.addEventListener('change', function () {
    if (isSlowConnection()) {
      document.body.classList.add('slow-connection');
    } else {
      document.body.classList.remove('slow-connection');
    }
  });
}
```

---

## Step 5: Test

```bash
# Chrome DevTools → Network → Throttling → Slow 3G
# Reload — particles disabled, charts skipped
# Switch to "No throttling" — normal experience resumes
```

---

## Files Modified: `script.js`, `styles.css`
