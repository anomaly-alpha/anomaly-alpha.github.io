# Plan 14: Mobile Touch Target Sizing

**Problem:** Several interactive elements on mobile are below the recommended 44x44px minimum touch target size: mode button icons, card info buttons, chart filter buttons, and theme toggle. This causes accidental taps and frustration on touch devices.

**Goal:** Ensure all interactive elements meet the 44x44px minimum touch target on screens under 768px.

---

## Step 1: Audit current touch targets

Add a temporary audit script to identify undersized elements:

```javascript
// Run in browser console on mobile viewport
document.querySelectorAll('button, a, [onclick], select, input').forEach(function(el) {
  var rect = el.getBoundingClientRect();
  if (rect.width < 44 || rect.height < 44) {
    el.style.outline = '2px solid red';
    console.log('Small target:', el.className || el.tagName, rect.width + 'x' + rect.height);
  }
});
```

## Step 2: Add mobile touch target CSS

```css
/* styles.css — add media query */
@media (max-width: 767px) {
  .gem-mode-btn {
    min-width: 44px;
    min-height: 44px;
    padding: 0.5rem 0.75rem;
  }
  .gem-card__info-btn {
    min-width: 44px;
    min-height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .gem-btn--icon {
    min-width: 44px;
    min-height: 44px;
  }
  .gem-select {
    min-height: 44px;
  }
  /* Theme toggle */
  [data-theme-toggle] {
    min-width: 44px;
    min-height: 44px;
  }
}
```

## Step 3: Verify with Chrome DevTools

```bash
# Open DevTools > Toggle device toolbar
# Select iPhone SE (375px width)
# All interactive elements should be >= 44x44px
```

## Files Modified
- `styles.css` — mobile touch target media query

## Verification
```bash
npm run build
# Open on mobile or DevTools mobile emulation
# Tap each interactive element — no accidental adjacent taps
```
