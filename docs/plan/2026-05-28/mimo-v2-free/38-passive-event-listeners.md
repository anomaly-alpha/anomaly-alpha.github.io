# Plan 38: Passive Event Listeners for Scroll Performance

**Problem:** Scroll and wheel event listeners (like the one in Plan 16 scroll-to-top) can block scrolling on some browsers if not marked `passive`. Chrome DevTools may show warnings about non-passive listeners hurting scroll performance.

**Goal:** Audit all `scroll`, `wheel`, `touchstart`, `touchmove`, and `mousewheel` event listeners and add `{ passive: true }` where `preventDefault()` is not called.

---

## Step 1: Audit existing listeners

```bash
# Find all addEventListener calls:
grep -n 'addEventListener' script.src.js
```

Check for:
```js
element.addEventListener('scroll', handler)
element.addEventListener('touchmove', handler)
element.addEventListener('wheel', handler)
window.addEventListener('scroll', handler)
```

---

## Step 2: Add `{ passive: true }` to scroll-related listeners

**In `script.js`** (Plan 16's scroll-to-top):

```js
// Before:
window.addEventListener('scroll', onScroll);

// After:
window.addEventListener('scroll', onScroll, { passive: true });
```

---

## Step 3: Keep non-passive only where needed

Only remove `passive` if the handler calls `preventDefault()`:

```js
// Must NOT be passive (calls preventDefault):
element.addEventListener('touchstart', function (e) {
  e.preventDefault(); // Only if actually needed
}, { passive: false });

// CAN be passive (no preventDefault):
window.addEventListener('scroll', onScroll, { passive: true });
element.addEventListener('click', handler); // click is always synchronous
```

Common cases where `passive: false` is needed:
- `touchstart` with `preventDefault()` (e.g., custom swipe)
- `wheel` with `preventDefault()` (e.g., custom zoom)
- `keydown` with `preventDefault()` (always safe without passive flag)

---

## Step 4: Check for existing touch/wheel listeners

```bash
grep -rn 'touchstart\|touchmove\|touchend\|wheel\|mousewheel' script.js
```

If any exist, add `{ passive: false }` if they call `preventDefault()`, or `{ passive: true }` if they don't.

---

## Step 5: Verify with Lighthouse

```bash
npx lighthouse http://localhost:3000 --view --preset=desktop --categories=performance
# Check "Does not use passive listeners to improve scrolling performance"
# Target: no warnings in this category
```

---

## Step 6: Check in Chrome DevTools

1. Open DevTools → Console
2. Check for warnings:
   ```
   [Violation] Added non-passive event listener to a scroll-blocking 'touchstart' event
   ```
3. Fix any violations found

---

## Files Modified

| File | Change |
|------|--------|
| `script.js` | Add `{ passive: true }` to scroll/wheel listeners that don't call `preventDefault()` |

---

## Verification

```bash
grep -n 'addEventListener' script.src.js
# Verify all scroll/wheel/touch listeners have passive option
# Click "Show all 30+ files" if grep output exceeds limit

# DevTools check:
# Open Console — no passive listener violations
```
