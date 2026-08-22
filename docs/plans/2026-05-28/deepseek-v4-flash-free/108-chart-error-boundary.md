# Plan 108: Chart Error Boundary & Recovery

**Gap identified:** Chart.js failures (network error loading vendor file, SRI mismatch, OOM on large datasets) leave the charts section broken with no recovery path.

**Web best practices (web.dev/Resilient Web Design):** Use error boundaries around third-party dependencies. Provide meaningful fallbacks. Log errors for debugging without breaking the page.

---

## Step 1: Wrap chart initialization

```js
function safeInitCharts() {
  try {
    if (typeof Chart === 'undefined') {
      showChartErrorState('Chart library not loaded');
      return;
    }
    initCharts();
  } catch (e) {
    console.error('Chart initialization failed:', e);
    showChartErrorState('Failed to render charts: ' + e.message);
    // Report to analytics if available
    if (typeof trackEvent === 'function') {
      trackEvent('Chart Error', { message: e.message });
    }
  }
}
```

---

## Step 2: Add chart error boundary CSS

```css
.gem-chart__error {
  text-align: center;
  padding: 2rem;
  background: rgba(239, 68, 68, 0.05);
  border: 1px solid rgba(239, 68, 68, 0.15);
  border-radius: 8px;
}
.gem-chart__error-title {
  color: #ef4444;
  font-weight: 700;
  font-size: 0.9rem;
}
.gem-chart__error-detail {
  color: var(--gem-text--muted);
  font-size: 0.75rem;
  margin-top: 0.5rem;
  word-break: break-word;
  max-width: 100%;
}
```

---

## Step 3: Add recovery strategies

```js
function recoverChartError() {
  // Strategy 1: Reload Chart.js
  var script = document.querySelector('script[src*="chart.umd"]');
  if (script) {
    script.remove();
    delete window.Chart;
  }
  showChartLoadingState();
  loadChartJs();
}

function showChartErrorState(message) {
  var container = document.querySelector('.gem-grid--charts');
  if (!container) return;

  container.innerHTML = [
    '<div class="gem-chart__error col-span-full">',
    '<div class="gem-chart__error-title">⚠ Charts Unavailable</div>',
    '<div class="gem-chart__error-detail">' + (message || 'Could not load chart library') + '</div>',
    '<div class="flex gap-2 justify-center mt-3">',
    '<button class="gem-btn--icon text-xs" onclick="recoverChartError()">Retry</button>',
    '<button class="gem-btn--icon text-xs" onclick="showChartDataTable()">View data table</button>',
    '</div>',
    '</div>'
  ].join('');
}
```

---

## Step 4: Add data table fallback

```js
function showChartDataTable() {
  var container = document.querySelector('.gem-grid--charts');
  if (!container) return;

  var modes = selectedModes.length > 0 ? selectedModes : ['event', 'pvp', 'login', 'code'];
  var rows = modes.map(function (m) {
    return '<tr><td class="p-1 gem-text--' + m + '">' + m + '</td>' +
      '<td class="p-1 text-right">' + getModeTotal(m).toLocaleString() + '</td></tr>';
  }).join('');

  container.innerHTML = [
    '<div class="gem-chart__table col-span-full">',
    '<table class="w-full text-sm" role="table" aria-label="Gem income data">',
    '<caption class="gem-text--cyan text-sm font-bold mb-2">Gem Income Breakdown</caption>',
    '<tr><th class="text-left p-1 gem-text--muted">Category</th><th class="text-right p-1 gem-text--muted">Gems/Week</th></tr>',
    rows,
    '<tr class="border-t border-white/10"><td class="p-1 font-bold">Total</td>',
    '<td class="p-1 text-right font-bold gem-text--cyan">' + getCurrentTotal().toLocaleString() + '</td></tr>',
    '</table></div>'
  ].join('');
}
```

---

## Files Modified: `script.js`, `styles.css`
