# Plan 79: Touch Target Minimum 44px

**Problem:** WCAG 2.5.5 (Target Size) recommends 44x44px minimum for touch targets. Some elements (info icons, small buttons) are below this threshold.

**Goal:** Ensure all interactive elements meet the 44x44px minimum.

---

## Step 1: Add global minimum touch target

```css
/* styles.css */
@media (pointer: coarse) {
  button, a, [onclick], select, input[type="checkbox"],
  .gem-card__info-btn, .gem-mode-btn, .gem-btn--icon {
    min-width: 44px;
    min-height: 44px;
  }

  /* Increase padding for small buttons */
  .gem-card__info-btn {
    padding: 0.75rem;
  }

  /* Ensure checkbox has adequate size */
  input[type="checkbox"] {
    width: 24px;
    height: 24px;
    margin: 10px; /* Extra hit area */
  }
}
```

## Step 2: Verify with DevTools

```bash
# DevTools > Device Mode > Select any mobile device
# All interactive elements should be >= 44x44px
```

## Files Modified
- `styles.css` — touch target media query

## Verification
```bash
npm run build
# Test on actual mobile device
# All tappable elements should be easy to hit
```
