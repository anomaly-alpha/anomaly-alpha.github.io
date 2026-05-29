# Plan 48: requestAnimationFrame Throttling for Expensive Handlers

**Problem:** Some event handlers (scroll, PvP change) trigger expensive operations — recalculation of all payouts, chart updates, goal progress refresh. If these fire rapidly (e.g., sliding a rank range input), they can cause jank and frame drops.

**Goal:** Throttle expensive handlers using `requestAnimationFrame`. Batch multiple state changes into a single render pass.

---

## Step 1: Create a rAF throttle helper

```js
// ===== RAF THROTTLING =====

/**
 * Creates a throttled version of a function that runs at most once per frame.
 * @param {Function} fn - The function to throttle
 * @returns {Function} Throttled function
 */
function rafThrottle(fn) {
  var ticking = false;
  return function () {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(function () {
        fn();
        ticking = false;
      });
    }
  };
}
```

---

## Step 2: Apply to scroll handlers

```js
// Before:
window.addEventListener('scroll', onScroll, { passive: true });

// After:
window.addEventListener('scroll', rafThrottle(onScroll), { passive: true });
```

---

## Step 3: Apply to PvP change handlers

```js
// Wrap the expensive update chain:
var throttledPvpUpdate = rafThrottle(function (id) {
  updatePvpCard(id);
  updatePvpCardModal(id);
  updateCurrencyAggregate();
});

// In the PvP change event listener:
function onPvpChange(id) {
  savePvpState(id);
  throttledPvpUpdate(id);
}
```

---

## Step 4: Apply to resize handlers

If any resize listeners exist, wrap them too:

```js
window.addEventListener('resize', rafThrottle(handleResize), { passive: true });
```

---

## Step 5: Apply to chart updates

```js
var throttledChartUpdate = rafThrottle(function (modes) {
  updateChartsByModes(modes);
});
```

---

## Step 6: Batch DOM reads/writes

Use the rAF callback to batch DOM writes:

```js
function scheduleDOMUpdate(updateFn) {
  if (window._pendingDOMUpdate) return;
  window._pendingDOMUpdate = true;
  requestAnimationFrame(function () {
    updateFn();
    window._pendingDOMUpdate = false;
  });
}
```

This ensures multiple state changes within the same frame are batched into a single DOM write.

---

## Step 7: Measure before/after

```bash
# Before throttling:
# Open Chrome DevTools → Performance
# Rapidly change PvP rank 10 times
# Measure "Scripting" time — e.g., 120ms

# After throttling:
# Same test — scripting time should drop ~50%
# Only 1 update per frame (vs. 10 updates queued)
```

---

## Step 8: Where NOT to use rAF

Don't throttle these:
- `animateValue()` — it already uses rAF internally (throttling would break the animation)
- Click handlers (one-off, not continuous)
- Keyboard shortcuts (single-fire, not continuous)

---

## Files Modified

| File | Change |
|------|--------|
| `script.src.js` | Add `rafThrottle()`, apply to scroll, PvP change, resize, chart update handlers |

---

## Verification

```bash
# Performance test:
# Open DevTools → Performance → Record

# Rapid test:
# 1. Quickly change PvP league 5 times in 1 second
# 2. Check frames — no dropped frames (no red bars)
# 3. Check total script time — should be <50ms per frame

# Correctness test:
# 4. Final PvP selection should be applied correctly
# 5. Charts should reflect the final (not intermediate) state
```
