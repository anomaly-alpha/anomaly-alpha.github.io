# Plan 98: Chart.js Error Boundary

**Problem:** If Chart.js fails to load (corrupted file, network error), the charts section shows no error message. Users see a blank area with no indication of what went wrong.

**Goal:** Add error handling for Chart.js loading failures.

---

## Step 1: Add error handling to loadChartJs

```javascript
// script.js — update loadChartJs
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
      showChartError();
      reject(new Error('Failed to load Chart.js'));
    };
    document.head.appendChild(script);
  });
}
```

## Step 2: Add error display

```javascript
// script.js
function showChartError() {
  var container = document.querySelector('.gem-chart');
  if (!container) return;

  container.innerHTML = '<div class="gem-chart__error" role="alert">' +
    '<p>Charts failed to load.</p>' +
    '<button onclick="retryCharts()">Retry</button>' +
    '</div>';
}

function retryCharts() {
  chartJsLoading = false;
  chartJsLoaded = false;
  loadChartJs().then(function() {
    initCharts();
  }).catch(function() {
    showChartError();
  });
}
```

## Files Modified
- `script.js` — chart error handling

## Verification
```bash
# Rename vendor/chart.umd.js temporarily
# Click "Show Charts" — should show error message with retry button
# Restore file, click Retry — should load successfully
```
