# Performance Optimization Plan

## Status: EXECUTED

## Baseline Measurements

| Resource | Raw | Gzipped | Budget | Status |
|----------|-----|---------|--------|--------|
| index.html | 92 KB | 17 KB | — | ✅ |
| script.js | 43 KB | 11 KB | < 200 KB | ✅ |
| styles.css | 41 KB | 7.5 KB | < 50 KB | ✅ |
| tailwind.css | 18 KB | 4.6 KB | < 50 KB | ✅ |
| vendor/chart.umd.js | 205 KB | 69.5 KB | < 200 KB | ✅ borderline |
| Fonts (4 woff2) | 39 KB | — | < 100 KB | ✅ |
| Images (og-icon + favicon) | 17 KB | — | < 200 KB | ✅ |
| **Total** | **438 KB** | **~109 KB** | — | — |

## Decisions Locked

| # | Question | Decision |
|---|----------|---------|
| 1 | P0 approach | No-op guard: `if (hidden) return;` in `updateChartsByModes` |
| 2 | Font subsetting | Skip — 39 KB under budget |

## Execution

### P0 — Guard chart updates when hidden

**File:** `script.js:523`

Added one line at the top of `updateChartsByModes`:

```diff
 function updateChartsByModes(modes) {
+  if (hidden) return;
   const combinedData = {
```

This prevents the 205 KB Chart.js from executing any chart-update logic on initial page load (when charts are hidden by default). Chart is already `defer`-loaded but its `new Chart(...)` calls run during `DOMContentLoaded` — this guard prevents the subsequent update calls from doing work until the user clicks "Show Charts".

### P1 — Skipped

Font subsetting not worth 10-15 KB savings vs. maintenance burden.

## Verification

```bash
grep -n 'function updateChartsByModes' script.js
# Expect line 523, with "  if (hidden) return;" as first body line
```

## Rollback

```bash
git restore script.js
```
