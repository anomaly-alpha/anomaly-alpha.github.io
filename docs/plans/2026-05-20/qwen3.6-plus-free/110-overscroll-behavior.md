# Plan 110: Overscroll Behavior

**Problem:** Scrolling inside the modal can cause the background page to scroll (scroll chaining). This is disorienting and breaks the modal isolation.

**Goal:** Prevent scroll chaining with `overscroll-behavior`.

---

## Step 1: Add overscroll-behavior to modal

```css
/* styles.css */
.gem-modal__body {
  overscroll-behavior: contain;
}

/* Prevent body scroll when modal is open */
body.modal-open {
  overscroll-behavior: none;
  overflow: hidden;
}
```

## Step 2: Add class toggle on modal open

```javascript
// script.js — in showCardModal
document.body.classList.add('modal-open');

// In closeCardModal
document.body.classList.remove('modal-open');
```

## Step 3: Add to other scrollable containers

```css
.gem-grid--cards {
  overscroll-behavior: contain;
}

.gem-pvp-comparison__table-wrapper {
  overscroll-behavior: contain;
}
```

## Files Modified
- `styles.css` — overscroll-behavior
- `script.js` — modal-open class toggle

## Verification
```bash
npm run build
# Open modal, scroll to bottom — background should not scroll
# Scroll card grid — should not affect page scroll
```
