# Plan 73: High Contrast Mode

**Problem:** Windows High Contrast Mode and macOS Increase Contrast settings may not be fully supported. Some elements rely on color alone to convey meaning.

**Goal:** Ensure the site is usable in high contrast mode by using forced-colors media query.

---

## Step 1: Add forced-colors support

```css
/* styles.css */
@media (forced-colors: active) {
  .gem-card {
    border: 2px solid CanvasText;
  }

  .gem-label--event { border-color: LinkText; }
  .gem-label--pvp { border-color: LinkText; }
  .gem-label--login { border-color: LinkText; }
  .gem-label--code { border-color: LinkText; }

  .gem-btn--icon {
    border: 1px solid ButtonText;
  }

  .gem-mode-btn--active {
    outline: 2px solid SelectedItem;
  }

  .gem-card__info-btn {
    forced-color-adjust: none;
    color: LinkText;
  }

  /* Ensure icons are visible */
  .gem-icon--gem {
    forced-color-adjust: none;
    fill: Highlight;
  }
}
```

## Files Modified
- `styles.css` — forced-colors media query

## Verification
```bash
# Windows: Settings > Ease of Access > High Contrast > On
# Or DevTools: Emulate CSS forced-colors: active
# All elements should have visible borders
```
