# Plan 76: Reading Order Audit

**Problem:** The DOM order may not match the visual order in some cases (e.g., flexbox `order` property, absolute positioning). Screen readers follow DOM order, not visual order.

**Goal:** Audit and fix any mismatches between visual and DOM reading order.

---

## Step 1: Audit reading order

```javascript
// Run in browser console
var elements = document.querySelectorAll('h1, h2, h3, p, a, button, [role]');
elements.forEach(function(el, i) {
  var rect = el.getBoundingClientRect();
  console.log(i + ': ' + (el.textContent || el.getAttribute('aria-label') || el.tagName) +
    ' — top:' + Math.round(rect.top) + ' left:' + Math.round(rect.left));
});
```

## Step 2: Fix any order mismatches

If mode buttons use `order` property, ensure DOM order matches visual order:

```html
<!-- Ensure mode buttons are in correct DOM order -->
<div class="gem-grid--modes">
  <button data-mode="all">All</button>
  <button data-mode="event">Event</button>
  <button data-mode="pvp">PvP</button>
  <button data-mode="login">Login</button>
  <button data-mode="code">Code</button>
</div>
```

## Step 3: Verify with tab order

```bash
# Open page, press Tab repeatedly
# Focus should move in logical reading order
# Top to bottom, left to right
```

## Files Modified
- `index.html` — DOM order fixes if needed
- `styles.css` — remove order property if causing mismatch

## Verification
```bash
# Tab through page — order should be logical
# Screen reader — should read in visual order
```
