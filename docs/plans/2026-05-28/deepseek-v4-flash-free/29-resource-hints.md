# Plan 29: Resource Hints for Self-Hosted Assets

**Problem:** The site already has zero CDN dependencies, but resource hints (`preload`, `prefetch`, `preconnect`) can further optimize loading order. Fonts are preloaded, but other critical resources could benefit from explicit priority hints.

**Goal:** Audit and optimize resource hint usage across all pages. Ensure fonts, CSS, and critical JS are in the optimal loading order.

---

## Step 1: Audit current resource hints

```bash
grep -rn 'rel="preload\|rel="prefetch\|rel="preconnect\|rel="dns-prefetch' index.html guide/*/index.html 404.html
```

---

## Step 2: Optimize font loading order

Fonts are the most critical non-render-blocking resource. Ensure they're loaded in order of visual priority:

```html
<!-- 1. Body font (most text) — high priority -->
<link rel="preload" as="font" href="fonts/rajdhani-regular.woff2" crossorigin fetchpriority="high">

<!-- 2. Headings font (less text but visible) — normal priority -->
<link rel="preload" as="font" href="fonts/orbitron-variable.woff2" crossorigin>

<!-- 3. Bold body font (used in labels) — low priority -->
<link rel="preload" as="font" href="fonts/rajdhani-bold.woff2" crossorigin fetchpriority="low">

<!-- 4. Semibold body font (least used) — lowest priority -->
<link rel="preload" as="font" href="fonts/rajdhani-semibold.woff2" crossorigin fetchpriority="low">
```

---

## Step 3: Add `prefetch` for Chart.js (optional, controversial)

Chart.js is lazy-loaded on first "Show Charts" click. If users frequently open charts, prefetching could improve UX — but it adds 205 KB upfront cost.

**Option A:** No prefetch (current behavior — keep it lazy)
**Option B:** `prefetch` after initial load completes

If choosing Option B:

```html
<link rel="prefetch" as="script" href="vendor/chart.umd.js">
```

Add this dynamically in JS after page load:

```js
window.addEventListener('load', function () {
  var link = document.createElement('link');
  link.rel = 'prefetch';
  link.as = 'script';
  link.href = 'vendor/chart.umd.js';
  document.head.appendChild(link);
});
```

This downloads Chart.js in idle time after the page is fully loaded, so the first "Show Charts" click is instant.

---

## Step 4: Add `preconnect` hint for any external APIs (none currently)

There are zero external origins. No `preconnect` needed. If analytics (Plan 10) is added:

```html
<link rel="preconnect" href="https://plausible.io">
```

---

## Step 5: Add `dns-prefetch` for the domain (self, for sub-resources)

Not needed since all resources are same-origin.

---

## Step 6: Optimize CSS loading

Ensure CSS is loaded in the optimal order:

```html
<!-- 1. Critical CSS blocks first paint -->
<style>
  html { visibility: hidden }
  /* ... above-fold styles ... */
  html { visibility: visible }
</style>

<!-- 2. Full CSS loaded asynchronously -->
<link rel="preload" as="style" href="styles.min.css" onload="this.rel='stylesheet'">

<!-- 3. Fallback for no-JS browsers -->
<noscript><link rel="stylesheet" href="styles.min.css"></noscript>
```

---

## Step 7: Verify using Chrome DevTools Network panel

```bash
npm run build && npx serve .

# Open DevTools → Network
# Sort by "Initiator" or "Priority"
# Verify:
# - Fonts are "Highest" priority
# - CSS is "High"
# - script.js is "High"
# - chart.umd.js is not loaded until click (or is "Lowest" if prefetched)
```

---

## Step 8: Test with Lighthouse

```bash
npx lighthouse http://localhost:3000 --view --preset=desktop
# Check "Resource Hints" or "Preload" audit
# Target: No "Preload key requests" or "Avoid enormous network payloads" warnings
```

---

## Files Modified

| File | Change |
|------|--------|
| `index.html` | Add `fetchpriority` to font preloads |
| `guide/*/index.html` (×6) | Same font preload updates |
| `404.html` | Same font preload updates |
| `script.js` | Add optional Chart.js prefetch on window load |

---

## Verification

```bash
# Check preload tags:
grep -rn 'fetchpriority="high"' index.html guide/*/index.html 404.html
# Expected: 1 match per page (Rajdhani Regular font)

# Check Chart.js prefetch (if implemented):
grep -rn 'prefetch.*chart' index.html script.js
# Expected: in script.js window.load listener
```
