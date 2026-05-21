# Plan 129: inert Attribute for Modal

**Problem:** When the modal is open, background content is still focusable and interactive. The `inert` attribute prevents interaction with background elements.

**Goal:** Add `inert` to the main content when the modal is open.

---

## Step 1: Update modal open/close

```javascript
// script.js — in showCardModal
function showCardModal(cardId) {
  var modal = document.querySelector('.gem-modal');
  var main = document.querySelector('main');

  modal.classList.add('gem-modal--visible');
  main.setAttribute('inert', '');

  trapFocus(modal);
  var firstFocusable = modal.querySelector(FOCUSABLE_SELECTORS);
  if (firstFocusable) firstFocusable.focus();
}

// In closeCardModal
function closeCardModal() {
  var modal = document.querySelector('.gem-modal');
  var main = document.querySelector('main');

  modal.classList.remove('gem-modal--visible');
  main.removeAttribute('inert');
}
```

## Files Modified
- `script.js` — inert attribute on modal open/close

## Verification
```bash
npm run build
# Open modal — try to Tab to background elements
# Should not be able to focus anything behind modal
# Chrome 114+, Firefox 129+, Safari 17.4+
```
