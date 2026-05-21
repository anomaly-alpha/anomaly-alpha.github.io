# Plan 81: Keyboard Navigation Cues

**Problem:** Focus indicators are minimal or absent on some interactive elements. Keyboard users can't easily see which element has focus.

**Goal:** Add visible focus indicators to all interactive elements.

---

## Step 1: Add global focus styles

```css
/* styles.css */
:focus-visible {
  outline: 2px solid var(--gem-cyan);
  outline-offset: 2px;
}

/* Remove outline for mouse users */
:focus:not(:focus-visible) {
  outline: none;
}

/* Specific element focus styles */
.gem-mode-btn:focus-visible {
  box-shadow: 0 0 0 3px rgba(0, 229, 255, 0.4);
}

.gem-card:focus-visible {
  box-shadow: 0 0 0 3px rgba(0, 229, 255, 0.4);
}

.gem-select:focus-visible {
  outline: 2px solid var(--gem-cyan);
  outline-offset: 2px;
  box-shadow: 0 0 0 4px rgba(0, 229, 255, 0.2);
}

/* Skip default outline on elements with custom focus */
.gem-btn--icon:focus-visible {
  outline: 2px solid var(--gem-cyan);
  outline-offset: 2px;
}
```

## Files Modified
- `styles.css` — focus-visible styles

## Verification
```bash
npm run build
# Press Tab — each focused element should have cyan outline
# Click with mouse — no outline should appear
```
