# Plan 40: Global Error Handler

**Problem:** No global error handler exists. If a JavaScript error occurs (malformed config, missing DOM element, chart failure), it fails silently and users see broken UI with no indication of what went wrong.

**Goal:** Add a global error handler that catches uncaught errors and displays a user-friendly message.

---

## Step 1: Add global error handler

```javascript
// script.js — add after loadAllConfigs
window.addEventListener('error', function(e) {
  console.error('[Gem Rewards] Error:', e.message, 'at', e.filename + ':' + e.lineno);

  // Show user-friendly toast
  showErrorToast('Something went wrong. Please refresh the page.');
});

window.addEventListener('unhandledrejection', function(e) {
  console.error('[Gem Rewards] Unhandled promise rejection:', e.reason);
  showErrorToast('A background task failed. Please refresh the page.');
});
```

## Step 2: Add error toast function

```javascript
// script.js
function showErrorToast(message) {
  var existing = document.querySelector('.gem-toast--error');
  if (existing) existing.remove();

  var toast = document.createElement('div');
  toast.className = 'gem-toast gem-toast--error';
  toast.setAttribute('role', 'alert');
  toast.innerHTML = '<span class="gem-toast__icon">⚠</span><span class="gem-toast__message">' + message + '</span>';
  document.body.appendChild(toast);

  setTimeout(function() {
    toast.classList.add('gem-toast--fade-out');
    setTimeout(function() { toast.remove(); }, 300);
  }, 5000);
}
```

## Step 3: Add toast CSS

```css
.gem-toast--error {
  background: var(--gem-alert--danger-bg);
  border: 1px solid var(--gem-alert--danger-border);
  color: var(--gem-alert--danger-text);
}
.gem-toast--fade-out {
  opacity: 0;
  transition: opacity 0.3s;
}
```

## Files Modified
- `script.js` — global error handler, error toast
- `styles.css` — error toast styles

## Verification
```bash
npm run build
# Intentionally cause an error in console: throw new Error('test')
# Should show error toast
```
