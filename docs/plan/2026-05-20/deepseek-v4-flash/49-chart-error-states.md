# Plan 49: Chart Loading States & Error Handling

**Problem:** The charts section shows nothing until "Show Charts" is clicked. When clicked, Chart.js is loaded dynamically — if it fails (network error, file missing), the user sees a blank section with no error message.

**Goal:** Add loading spinner, error state with retry button, and empty state for charts. Gracefully handle Chart.js load failure.

---

## Step 1: Update the chart toggle function

```js
function toggleCharts() {
  var section = document.getElementById('charts-section');
  if (!section) return;

  var isHidden = section.classList.contains('hidden');

  if (isHidden) {
    section.classList.remove('hidden');
    showChartLoadingState();
    loadChartJs();
  } else {
    section.classList.add('hidden');
  }
}
```

---

## Step 2: Add loading state

```js
function showChartLoadingState() {
  var container = document.querySelector('.gem-grid--charts');
  if (!container) return;

  container.innerHTML = [
    '<div class="gem-chart__loading col-span-full flex flex-col items-center justify-center py-10">',
    '<div class="gem-spinner"></div>',
    '<p class="gem-text--muted text-sm mt-3">Loading charts...</p>',
    '</div>'
  ].join('');
}
```

**CSS for spinner:**
```css
.gem-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid rgba(0, 229, 255, 0.15);
  border-top-color: var(--gem-cyan);
  border-radius: 50%;
  animation: gem-spin 0.8s linear infinite;
}
@keyframes gem-spin {
  to { transform: rotate(360deg); }
}
```

---

## Step 3: Add error state

```js
function showChartErrorState() {
  var container = document.querySelector('.gem-grid--charts');
  if (!container) return;

  container.innerHTML = [
    '<div class="gem-chart__error col-span-full flex flex-col items-center justify-center py-10">',
    '<svg ... warning icon ...></svg>',
    '<p class="gem-text--event text-sm mt-2">Failed to load charts</p>',
    '<p class="gem-text--muted text-xs mt-1">The chart library could not be loaded.</p>',
    '<button class="gem-btn--icon mt-3 text-xs" onclick="retryCharts()">Retry</button>',
    '</div>'
  ].join('');
}

function retryCharts() {
  showChartLoadingState();
  loadChartJs();
}
```

---

## Step 4: Update `loadChartJs()` with error handling

```js
function loadChartJs() {
  if (window.Chart) {
    initCharts();
    return;
  }

  var script = document.createElement('script');
  script.src = 'vendor/chart.umd.js';
  script.fetchPriority = 'low';

  script.onload = function () {
    console.log('Chart.js loaded successfully');
    initCharts();
  };

  script.onerror = function () {
    console.error('Failed to load Chart.js');
    showChartErrorState();
  };

  script.ontimeout = function () {
    console.error('Chart.js load timed out');
    showChartErrorState();
  };

  // 10 second timeout
  script.timeout = 10000;

  document.head.appendChild(script);
}
```

---

## Step 5: Add empty state when no data

If all modes are deselected, charts have no data to display:

```js
function showChartEmptyState() {
  var container = document.querySelector('.gem-grid--charts');
  if (!container || window.Chart) return;

  container.innerHTML = [
    '<div class="gem-chart__empty col-span-full flex flex-col items-center justify-center py-10">',
    '<p class="gem-text--muted text-sm">Select a mode to see charts</p>',
    '</div>'
  ].join('');
}
```

Call from `updateChartsByModes()` when `modes.length === 0`.

---

## Step 6: Add loading skeleton for charts

Before Chart.js renders, show a CSS-only skeleton:

```css
.gem-chart__skeleton {
  height: 250px;
  background: linear-gradient(90deg,
    rgba(255,255,255,0.03) 25%,
    rgba(255,255,255,0.08) 50%,
    rgba(255,255,255,0.03) 75%
  );
  background-size: 200% 100%;
  animation: gem-shimmer 1.5s ease-in-out infinite;
  border-radius: 8px;
}
@keyframes gem-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

---

## Step 7: Handle Chart.js update errors

```js
function safeChartUpdate(chart) {
  try {
    if (chart && chart.update) {
      chart.update('none');
    }
  } catch (e) {
    console.warn('Chart update failed:', e);
  }
}
```

Wrap all `chart.update()` calls in `safeChartUpdate()` to prevent one broken chart from breaking the entire page.

---

## Files Modified

| File | Change |
|------|--------|
| `script.js` | Add loading/error/empty states, error handling in `loadChartJs()`, `safeChartUpdate()` |
| `styles.css` | Add `.gem-spinner`, `.gem-chart__skeleton`, `.gem-chart__loading` styles |
| `index.html` | Optionally add chart container fallback markup |

---

## Verification

```bash
# Normal flow:
# Click "Show Charts" → spinner appears → charts render

# Error flow:
# Rename vendor/chart.umd.js → vendor/chart.umd.js.bak
# Click "Show Charts" → spinner → error message + retry button

# Empty state:
# Deselect all modes
# Charts section shows "Select a mode" message

# Rapid toggle:
# Click "Show Charts" → "Hide Charts" → "Show Charts"
# No duplicate chart instances
```
