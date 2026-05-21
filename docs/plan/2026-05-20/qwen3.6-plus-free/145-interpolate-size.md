# Plan 145: interpolate-size

**Problem:** Animating between `height: 0` and `height: auto` requires JS measurement. `interpolate-size: allow-keywords` enables this in CSS.

**Goal:** Use interpolate-size for smooth height animations on collapsible elements.

---

## Step 1: Enable interpolate-size

```css
/* styles.css */
html {
  interpolate-size: allow-keywords;
}
```

## Step 2: Use for collapsible sections

```css
/* styles.css */
.gem-code__expired-section[open] > div {
  height: auto;
  opacity: 1;
  transition: height 0.3s ease, opacity 0.3s ease;
}

.gem-code__expired-section:not([open]) > div {
  height: 0;
  opacity: 0;
  overflow: hidden;
}
```

## Files Modified
- `styles.css` — interpolate-size

## Verification
```bash
npm run build
# Expand/collapse sections — should animate smoothly
# Chrome 129+, Safari 17.4+
```
