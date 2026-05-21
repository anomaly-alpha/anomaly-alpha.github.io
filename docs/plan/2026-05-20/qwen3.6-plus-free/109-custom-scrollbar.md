# Plan 109: Custom Scrollbar Styling

**Problem:** The default browser scrollbar doesn't match the sci-fi aesthetic. Custom scrollbar styling would improve visual consistency.

**Goal:** Style scrollbars to match the theme.

---

## Step 1: Add Webkit scrollbar styles

```css
/* styles.css */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: var(--gem-bg-dark);
}

::-webkit-scrollbar-thumb {
  background: var(--gem-bg-light);
  border-radius: 4px;
  border: 2px solid var(--gem-bg-dark);
}

::-webkit-scrollbar-thumb:hover {
  background: var(--gem-cyan);
}

/* Firefox */
* {
  scrollbar-width: thin;
  scrollbar-color: var(--gem-bg-light) var(--gem-bg-dark);
}
```

## Step 2: Add to modal scrollbar

```css
.gem-modal__body::-webkit-scrollbar {
  width: 6px;
}

.gem-modal__body::-webkit-scrollbar-thumb {
  background: var(--gem-cyan);
  border-radius: 3px;
}
```

## Files Modified
- `styles.css` — custom scrollbar styles

## Verification
```bash
npm run build
# Scroll page — scrollbar should match theme
# Modal scroll — should have cyan thumb
```
