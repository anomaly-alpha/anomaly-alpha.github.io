# Plan 144: appearance:base for Selects

**Problem:** Custom select styling uses `appearance: none` with a custom chevron. The newer `appearance: base` value preserves native widget behavior while allowing styling.

**Goal:** Update select elements to use `appearance: base` where supported.

---

## Step 1: Update select CSS

```css
/* styles.css */
.gem-select {
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  /* Custom chevron background */
  background-image: url("data:image/svg+xml,...");
}

/* Use appearance:base where supported for better native behavior */
@supports (appearance: base) {
  .gem-select {
    appearance: base;
    -webkit-appearance: base;
  }
}
```

## Files Modified
- `styles.css` — appearance: base support

## Verification
```bash
npm run build
# Select elements should still look correct
# Native behavior (keyboard navigation) should be preserved
```
