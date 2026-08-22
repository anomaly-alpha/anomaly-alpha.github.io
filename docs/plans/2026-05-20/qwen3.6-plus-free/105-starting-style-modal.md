# Plan 105: @starting-style for Modal

**Problem:** The modal pop-in animation uses `@keyframes` but can't transition from `display: none`. `@starting-style` enables transitions from the initial state.

**Goal:** Use `@starting-style` for smoother modal entry transitions.

---

## Step 1: Update modal CSS

```css
/* styles.css */
.gem-modal__content {
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.9);
  transition: opacity 0.3s ease, transform 0.3s ease;

  @starting-style {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.9);
  }
}

.gem-modal--visible .gem-modal__content {
  opacity: 1;
  transform: translate(-50%, -50%) scale(1);
}
```

## Step 2: Update modal overlay transition

```css
.gem-modal__overlay {
  opacity: 0;
  transition: opacity 0.3s ease;

  @starting-style {
    opacity: 0;
  }
}

.gem-modal--visible .gem-modal__overlay {
  opacity: 1;
}
```

## Files Modified
- `styles.css` — @starting-style for modal

## Verification
```bash
npm run build
# Open modal — should transition smoothly from hidden state
# Chrome 117+, Safari 17.4+, Firefox 129+
```
