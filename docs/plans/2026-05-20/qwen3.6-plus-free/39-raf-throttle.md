# Plan 39: requestAnimationFrame Throttle

**Problem:** The `animateValue()` function uses `requestAnimationFrame` without throttling. If animations are triggered rapidly (e.g., toggling modes quickly), multiple rAF loops can run simultaneously, causing visual glitches and wasted CPU.

**Goal:** Add a throttle mechanism to prevent overlapping animations on the same element.

---

## Step 1: Update animateValue with rAF tracking

```javascript
// script.js — replace animateValue
var ANIMATION_FRAMES = {};

function animateValue(element, start, end, duration) {
  // Cancel existing animation on this element
  if (ANIMATION_FRAMES[element.id]) {
    cancelAnimationFrame(ANIMATION_FRAMES[element.id]);
  }

  var range = end - start;
  var startTime = null;

  function step(timestamp) {
    if (!startTime) startTime = timestamp;
    var progress = Math.min((timestamp - startTime) / duration, 1);
    var current = Math.floor(start + range * progress);
    element.textContent = current.toLocaleString();

    if (progress < 1) {
      ANIMATION_FRAMES[element.id] = requestAnimationFrame(step);
    } else {
      delete ANIMATION_FRAMES[element.id];
    }
  }

  ANIMATION_FRAMES[element.id] = requestAnimationFrame(step);
}
```

## Step 2: Add cleanup on page unload

```javascript
window.addEventListener('beforeunload', function() {
  Object.values(ANIMATION_FRAMES).forEach(function(id) {
    cancelAnimationFrame(id);
  });
});
```

## Files Modified
- `script.js` — animateValue with rAF tracking

## Verification
```bash
npm run build
# Rapidly toggle modes — counter should not glitch
# DevTools > Performance — no overlapping rAF calls
```
