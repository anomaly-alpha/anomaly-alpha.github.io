# Plan 130: Page Visibility API for Pausing

**Gap:** When the user switches tabs, countdown timers, animations, and background sync continue running for no reason. This wastes CPU and battery.

**Best practice (web.dev):** Use the Page Visibility API (`document.visibilityState`) to pause non-essential work when the page is hidden.

---

## Step 1: Pause countdown interval when hidden

```js
var countdownInterval;

function startCountdowns() {
  countdownInterval = setInterval(updateCountdowns, 5000);
}

document.addEventListener('visibilitychange', function () {
  if (document.hidden) {
    clearInterval(countdownInterval);
    console.log('Paused: tab hidden');
  } else {
    // Refresh immediately on return, then resume interval
    updateCountdowns();
    startCountdowns();
    console.log('Resumed: tab visible');
  }
});
```

---

## Step 2: Pause particle animations via CSS

```css
.page-hidden .gem-particle {
  animation-play-state: paused;
}
```

```js
document.addEventListener('visibilitychange', function () {
  document.documentElement.classList.toggle('page-hidden', document.hidden);
});
```

---

## Step 3: Pause CSS animations (alternative)

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
  }
}

/* Toggle by adding .paused class on visibility change */
.page-hidden * {
  animation-play-state: paused !important;
}
```

---

## Step 4: Resume chart rendering if needed

Charts don't render while the tab is hidden (browsers throttle rAF). When returning:

```js
document.addEventListener('visibilitychange', function () {
  if (!document.hidden) {
    // Force chart redraw
    if (window.Chart) {
      Object.values(Chart.instances).forEach(function (c) {
        c.update('none');
      });
    }
  }
});
```

---

## Step 5: Measure savings

```bash
# Open DevTools → Performance → Record
# Switch tabs → observe: setInterval stops, particles freeze
# Return → immediately resumes
# Expected: 100% CPU reduction when tab hidden
```

---

## Files Modified: `script.js`, `styles.css`
