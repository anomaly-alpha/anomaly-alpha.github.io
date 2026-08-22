# Plan 120: Page Visibility API

**Problem:** The countdown timer and chart animations continue running when the tab is hidden, wasting CPU and battery.

**Goal:** Pause non-essential processing when the tab is not visible.

---

## Step 1: Add visibility change handler

```javascript
// script.js
var isVisible = true;

document.addEventListener('visibilitychange', function() {
  isVisible = document.visibilityState === 'visible';

  if (isVisible) {
    // Resume countdown
    startCountdown();
    // Update charts if they were paused
    if (chartsVisible && chartJsLoaded) {
      updateChartsByModes(selectedModes);
    }
  } else {
    // Pause countdown
    stopCountdown();
  }
});
```

## Step 2: Update countdown to check visibility

```javascript
// script.js
function updateCountdown() {
  if (!isVisible) return; // Skip if tab is hidden
  // ... existing countdown logic
}
```

## Files Modified
- `script.js` — visibility handler, countdown check

## Verification
```bash
npm run build
# Switch to another tab — countdown should pause
# Switch back — countdown should resume with correct time
# DevTools > Performance — no CPU usage when hidden
```
