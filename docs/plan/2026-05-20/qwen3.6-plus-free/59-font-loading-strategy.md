# Plan 59: Font Loading Strategy Review

**Problem:** Fonts use `font-display: optional` which is good for CLS but means users on slow connections may never see the custom font. The current strategy should be reviewed and potentially adjusted per font.

**Goal:** Review and optimize font loading strategy — Orbitron (decorative) can stay `optional`, but Rajdhani (body text) should use `swap`.

---

## Step 1: Update @font-face declarations

```css
/* styles.css — update font-display */

/* Orbitron — decorative headers, optional is fine */
@font-face {
  font-family: 'Orbitron';
  src: url('fonts/Orbitron-Variable.woff2') format('woff2');
  font-display: optional;
  font-weight: 500 900;
}

/* Rajdhani — body text, swap for readability */
@font-face {
  font-family: 'Rajdhani';
  src: url('fonts/Rajdhani-Regular.woff2') format('woff2');
  font-display: swap;
  font-weight: 400;
}

@font-face {
  font-family: 'Rajdhani';
  src: url('fonts/Rajdhani-SemiBold.woff2') format('woff2');
  font-display: swap;
  font-weight: 600;
}

@font-face {
  font-family: 'Rajdhani';
  src: url('fonts/Rajdhani-Bold.woff2') format('woff2');
  font-display: swap;
  font-weight: 700;
}
```

## Step 2: Add font loading fallback CSS

```css
/* Ensure content is readable before fonts load */
body {
  font-family: 'Rajdhani', system-ui, -apple-system, sans-serif;
}
h1, h2, h3 {
  font-family: 'Orbitron', 'Rajdhani', system-ui, sans-serif;
}
```

## Files Modified
- `styles.css` — font-display updated

## Verification
```bash
npm run build
# DevTools > Network > Slow 3G
# Rajdhani should swap in within 100ms
# Orbitron may not load on slow connections — acceptable
```
