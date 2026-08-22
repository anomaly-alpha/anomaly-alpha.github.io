# Plan 121: AbortController for Cleanup

**Gap:** The site adds event listeners, timers (setInterval), and async operations but never cleans them up. If the page is navigated away or a modal is closed, stale listeners continue running.

**Best practice (MDN):** Use `AbortController` to group related listeners and clean them up together. Remove event listeners when they're no longer needed.

---

## Step 1: Create a page-level abort controller

```js
var pageController = new AbortController();
var signal = pageController.signal;
```

---

## Step 2: Pass signal to all listeners

```js
// Before:
window.addEventListener('scroll', onScroll, { passive: true });
setInterval(updateCountdowns, 5000);

// After:
window.addEventListener('scroll', onScroll, { signal, passive: true });
var countdownInterval = setInterval(updateCountdowns, 5000);

// Register interval for cleanup
signal.addEventListener('abort', function () {
  clearInterval(countdownInterval);
});
```

---

## Step 3: Apply to modal listeners

```js
function showCardModal(cardId) {
  var modalController = new AbortController();

  // All modal listeners use this signal
  document.addEventListener('keydown', handleKeydown, { signal: modalController.signal });
  overlay.addEventListener('click', handleOverlayClick, { signal: modalController.signal });

  // Store controller for cleanup on close
  modal._controller = modalController;
}

function closeCardModal() {
  // Clean up all modal listeners at once
  if (modal._controller) {
    modal._controller.abort();
  }
}
```

---

## Step 4: Clean up on page unload

```js
window.addEventListener('pagehide', function () {
  pageController.abort(); // Cancel all listeners
});
```

---

## Step 5: Verify

```bash
# Open modal, close modal
# Open DevTools → Elements → Event Listeners
# Verify modal listeners are removed after close
# Navigate away — verify all page listeners are removed
```

---

## Files Modified: `script.js`
