# Plan 68: Font Loading Strategy Enhancement

**Problem:** Fonts use `font-display: optional` (already good — eliminates CLS from font swap). But on slow connections, fonts may never load, leaving the fallback sans-serif visible throughout the session. There's no revalidation if the font becomes available later.

**Goal:** Add a font watcher that detects when fonts have loaded and adds a class to `document.documentElement` for CSS-driven enhancement. Also preload fonts more aggressively.

---

## Step 1: Add font loading detection

```js
// Wait for fonts to load (or timeout after 3 seconds)
function watchFontLoading() {
  if ('fonts' in document) {
    Promise.race([
      document.fonts.ready,
      new Promise(function (_, reject) {
        setTimeout(reject, 3000);
      })
    ]).then(function () {
      document.documentElement.classList.add('fonts-loaded');
    }).catch(function () {
      // Fonts didn't load in time — update when they arrive
      document.fonts.ready.then(function () {
        document.documentElement.classList.add('fonts-loaded');
      });
    });
  }
}
```

---

## Step 2: Add CSS enhancement classes

```css
/* Default: system fallback */
body { font-family: 'Rajdhani', sans-serif; }

/* After fonts load: use custom font with confidence */
.fonts-loaded body {
  font-family: 'Rajdhani', sans-serif; /* Same rule, but now loaded */
  /* Optionally adjust letter-spacing for the loaded font */
  letter-spacing: normal;
}
```

---

## Step 3: Add font swap fallback adjustment

The current `font-display: optional` means the browser has ~100ms to load the font. If it misses this window, switch to `swap` + revalidation:

```css
@font-face {
  font-family: 'Rajdhani';
  font-display: optional; /* Fast first visit */
  /* The fonts-loaded class overrides to swap on subsequent views */
}
```

---

## Step 4: Preload fonts with higher priority

```html
<!-- Preconnect to self for font loading (instant) -->
<link rel="preconnect" href="/" crossorigin>

<!-- Preload primary font with high priority -->
<link rel="preload" as="font" href="fonts/rajdhani-regular.woff2" crossorigin fetchpriority="high">

<!-- Preload secondary fonts with normal priority -->
<link rel="preload" as="font" href="fonts/orbitron-variable.woff2" crossorigin>
```

---

## Step 5: Test font loading behavior

```bash
# DevTools → Network → Slow 3G
# Reload — quick flash of system font (optional), then swap to Rajdhani
# DevTools → Application → Frames → Fonts
# Verify fonts load within 3 seconds even on slow connections
```

---

## Files Modified: `styles.css`, `index.html`, `script.js`
