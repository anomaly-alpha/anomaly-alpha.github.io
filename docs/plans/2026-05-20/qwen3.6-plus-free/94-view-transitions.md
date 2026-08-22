# Plan 94: View Transitions API

**Problem:** Mode toggling and theme switching happen instantly without visual feedback. The View Transitions API would add smooth animated transitions between states.

**Goal:** Add View Transitions for mode filtering and theme switching.

---

## Step 1: Add view transition for mode toggle

```javascript
// script.js — update filterCards
function filterCards() {
  if (!document.startViewTransition) {
    // Fallback for unsupported browsers
    applyFilter();
    return;
  }

  document.startViewTransition(function() {
    applyFilter();
  });
}

function applyFilter() {
  // Existing filter logic
  document.querySelectorAll('.gem-card').forEach(function(card) {
    // ... show/hide logic
  });
}
```

## Step 2: Add view transition for theme toggle

```javascript
// script.js — update theme toggle
function toggleTheme() {
  if (!document.startViewTransition) {
    applyTheme();
    return;
  }

  document.startViewTransition(function() {
    applyTheme();
  });
}
```

## Step 3: Add transition CSS

```css
/* styles.css */
::view-transition-old(root),
::view-transition-new(root) {
  animation-duration: 0.3s;
}

@media (prefers-reduced-motion: reduce) {
  ::view-transition-old(root),
  ::view-transition-new(root) {
    animation-duration: 0s;
  }
}
```

## Files Modified
- `script.js` — view transitions for mode/theme
- `styles.css` — transition animation

## Verification
```bash
npm run build
# Toggle mode — should have smooth crossfade
# Toggle theme — should have smooth color transition
# Chrome 111+ required
```
