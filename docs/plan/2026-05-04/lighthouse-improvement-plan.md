# Lighthouse Performance Improvement Plan

**Current Score: 88 (desktop)**

Run: `npm run build && CHROME_PATH="/Applications/Google Chrome.app/.../Google Chrome" lighthouse http://localhost:3000 --preset=desktop --output html --output-path lighthouse-report.html`

Server: `/usr/bin/python3 -m http.server 3000 --directory .`

---

## 1. Fix render-blocking CSS

**Impact**: ~190ms FCP/LCP savings | **Score impact**: FCP 1.0, LCP 1.0

**What**: `styles.css` (40KB) + `tailwind.css` (18KB) block initial render.

**How**:
- Inline critical above-fold styles into `<style>` in `<head>` (~14KB)
- Load both CSS files asynchronously:

```html
<link rel="preload" href="tailwind.css" as="style" onload="this.rel='stylesheet'">
<link rel="preload" href="styles.css" as="style" onload="this.rel='stylesheet'">
<noscript><link rel="stylesheet" href="tailwind.css"><link rel="stylesheet" href="styles.css"></noscript>
```

**What to inline**: Key visible styles — `.gem-container`, `.gem-title--hero`, `.gem-subtitle--hero`, `.gem-section--total`, `.gem-counter`, `.particles`, `.gem-grid-bg`, `.gem-mode-btn`, layout utilities.

---

## 2. Purge unused CSS

**Impact**: -33KB transferred | **Score impact**: Speed Index, network

**What**: `styles.css` is 54% unused (22KB wasted), `tailwind.css` is 66% unused (12KB).

**How**:
1. Update `tailwind.config.js` to scan JS files:
   ```js
   module.exports = {
     content: ["./**/*.html", "./**/*.js"],
   };
   ```
2. Rebuild: `npm run build`
3. Audit `styles.css` for unused rules (sections commented with `/* ===== NAME ===== */` — remove any entire section not visible)

---

## 3. Minify CSS

**Impact**: -15KB transferred

**How**:
1. Install: `npm install --save-dev cssnano postcss postcss-cli`
2. Add to `package.json` scripts:
   ```json
   "minify-css": "postcss tailwind.css styles.css --use cssnano --dir . --ext .min.css"
   ```
3. Or manually using: `npx csso styles.css --output styles.css`
4. Replace `<link>` references to use minified files (if using `.min.css`)

---

## 4. Lazy-load Chart.js

**Impact**: -81KB unused JS, TBT ↓ ~100ms | **Score impact**: TBT → 0.9+

**What**: `chart.umd.js` (205KB) loaded on every page via `<script defer>`. Only 2 of 7 pages use charts.

**How in `index.html`**:
```html
<!-- Remove the static script load -->
<!-- <script src="vendor/chart.umd.js" defer></script> -->
```

**How in `script.js`**:
Wrap chart creation in a dynamic loader, only loading Chart.js when user toggles chart visibility:

```js
function loadChartJs(callback) {
  if (window.Chart) { callback(); return; }
  var s = document.createElement('script');
  s.src = 'vendor/chart.umd.js';
  s.onload = callback;
  document.head.appendChild(s);
}

// Usage in toggleCharts():
function toggleCharts() {
  if (chartsVisible) {
    loadChartJs(function() {
      createCharts(); // existing chart creation logic
    });
  } else {
    hideCharts();
  }
}
```

---

## 5. Fix forced reflow

**Impact**: 227ms TBT | **Score impact**: TBT → ~0.85

**What**: `script.js:940` — `DOMContentLoaded` handler causes layout thrashing.

**How**: In `script.js`, wrap the DOMContentLoaded handler body in `requestAnimationFrame`:

```js
document.addEventListener('DOMContentLoaded', function() {
  requestAnimationFrame(function() {
    // existing init code...
  });
});
```

Also batch reads before writes in:
- `buildCountdownTargets()` — reads DOM, then writes
- Chart creation — separate element measurement from canvas rendering

---

## 6. Minify script.js

**Impact**: -8KB transferred

**How**:
1. Install: `npm install --save-dev terser`
2. Add to `package.json`:
   ```json
   "minify-js": "terser script.js -o script.js -c -m"
   ```
3. Run: `npm run minify-js`
4. Update `index.html` to load the minified output (or run in-place)

---

## 7. Reduce HTML document size (optional)

**Impact**: ~50KB initial HTML | **Score impact**: Document latency, FCP

**What**: Index.html is 92KB due to inline JSON configs (mostly `game-config` at ~60KB).

**Options**:
- Strip whitespace from all inline `<script type="application/json">` blocks
- Or: remove optional configs and lazy-load them via `loadConfig()` (but architecture says no `fetch()`)

**Quick win**: Minify the JSON configs inline (remove all indentation). Saves ~10-15KB.

---

## Execution results (2026-05-04)

| Step | Status | Savings |
|------|--------|---------|
| 4. Lazy-load Chart.js | ✅ Done | 205KB deferred, TBT ↓ |
| 5. Fix forced reflow | ✅ Done | DOMContentLoaded in RAF |
| 2. Purge unused CSS | ✅ Done | Tailwind config + rebuild |
| 1. Inline critical CSS | ✅ Done | 22KB inline, async CSS load |
| 3. Minify CSS | ✅ Done | styles.css: 41→33KB, tailwind.css: 21→13KB |
| 6. Minify JS | ✅ Done | script.js: 43→28KB |

### Final audit result: Performance 88 → **96**

```
Category           Old Score    New Score
Performance           88           96
Accessibility        100          100
Best Practices       100          100
SEO                  100          100
```

### Key metric improvements

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| LCP | 1.1s | 0.6s | -45% |
| TBT | 240ms | 30ms | -88% |
| CLS | 0.045 | 0.007 | -84% |
| FCP | 0.5s | 0.5s | — |

### Remaining opportunities

- **Speed Index 2.1s** (score 0.6) — trade-off from async CSS loading
- **Unused CSS 17KB** — styles.css BEM classes (deferred styles)
- **Document request latency** — 92KB HTML (inline JSON configs)

---

## Re-run audit after changes

```bash
# Rebuild Tailwind
npm run build

# Start server
/usr/bin/python3 -m http.server 3000 --directory . &

# Run audit
CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  lighthouse http://localhost:3000 \
  --preset=desktop \
  --output html \
  --output-path lighthouse-report.html \
  --chrome-flags="--headless=new --no-sandbox"

# Or JSON for programmatic scoring
CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  lighthouse http://localhost:3000 \
  --preset=desktop \
  --output json \
  --output-path lighthouse-report.json \
  --chrome-flags="--headless=new --no-sandbox" \
  --quiet

# Kill server
kill %1
```
