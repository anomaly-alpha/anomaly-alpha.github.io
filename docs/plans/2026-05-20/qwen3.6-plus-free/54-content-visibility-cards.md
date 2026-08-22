# Plan 54: Content-Visibility for Cards

**Problem:** All 9 cards render immediately on page load, even those below the fold. This increases initial paint time and memory usage.

**Goal:** Use `content-visibility: auto` on below-fold cards to defer their rendering until scrolled into view.

---

## Step 1: Add content-visibility CSS

```css
/* styles.css */
.gem-card {
  content-visibility: auto;
  contain-intrinsic-size: 0 200px; /* Estimated card height */
}
```

## Step 2: Ensure cards above fold render immediately

Cards in the first viewport row should not use content-visibility:

```css
/* First row cards — render immediately */
.gem-card--delay-0,
.gem-card--delay-1,
.gem-card--delay-2 {
  content-visibility: visible;
  contain-intrinsic-size: none;
}
```

## Step 3: Verify with DevTools

```bash
# DevTools > Rendering > Paint flashing
# Scroll page — cards should paint as they enter viewport
# Initial paint should be faster
```

## Files Modified
- `styles.css` — content-visibility rules

## Verification
```bash
npm run build
# DevTools > Performance — reduced initial render time
# Visual check — no layout shifts when cards render
```
