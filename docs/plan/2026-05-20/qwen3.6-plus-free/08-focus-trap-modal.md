# Plan 08: Focus Trap in Modal

**Problem:** The card modal (`.gem-modal`) does not trap focus. When the modal is open, Tab key navigation escapes to the background page, and Shift+Tab from the first focusable element doesn't loop to the last. This violates WCAG 2.1.2 (No Keyboard Trap) in reverse — focus leaks out.

**Goal:** Implement focus trapping so Tab cycles through modal elements only, and Escape closes the modal.

---

## Step 1: Add focus trap function

```javascript
// script.js — add near modal functions
var FOCUSABLE_SELECTORS = 'a[href], button:not([disabled]), select, textarea, input, [tabindex]:not([tabindex="-1"])';

function trapFocus(container) {
  var elements = container.querySelectorAll(FOCUSABLE_SELECTORS);
  var first = elements[0];
  var last = elements[elements.length - 1];

  container.addEventListener('keydown', function(e) {
    if (e.key !== 'Tab') return;

    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });
}
```

## Step 2: Wire into showCardModal

```javascript
// In showCardModal(cardId) — after modal becomes visible
var modal = document.querySelector('.gem-modal');
if (modal) {
  trapFocus(modal);
  var firstFocusable = modal.querySelector(FOCUSABLE_SELECTORS);
  if (firstFocusable) firstFocusable.focus();
}
```

## Step 3: Ensure Escape closes modal

```javascript
// In existing modal keydown handler, verify:
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    closeCardModal();
  }
});
```

## Files Modified
- `script.js` — trapFocus function, integration into showCardModal

## Verification
```bash
npm run build
# Open any card modal
# Press Tab repeatedly — focus should cycle within modal
# Press Shift+Tab — should cycle backwards
# Press Escape — modal should close
```
