# Plan 27: Lazy-Load Non-Critical Images and Assets

**Problem:** The OG images (7 PNG files in `og-images/`) are preloaded or loaded eagerly. While they're not rendered visually (only used in meta tags), any fallback or visible image usage could benefit from lazy loading. Also, the favicon is loaded eagerly.

**Goal:** Audit all image/asset loading and add `loading="lazy"` where appropriate. Ensure only critical assets are loaded eagerly.

---

## Step 1: Audit all assets loaded on each page

```bash
# Find all image/asset references:
grep -rn 'href="[^"]*\.\(png\|jpg\|ico\|svg\)"' index.html guide/*/index.html 404.html
grep -rn 'src="[^"]*\.\(png\|jpg\|ico\|svg\|js\)"' index.html guide/*/index.html 404.html
grep -rn 'preload' index.html guide/*/index.html 404.html | grep -v 'as="style"\|as="font"'
```

---

## Step 2: Current asset loading analysis

| Asset | Loading | Notes |
|-------|---------|-------|
| `favicon.svg` | Eager | Needed for tab icon — keep eager |
| `favicon.ico` | Eager | Legacy fallback — keep eager |
| `og-images/*.png` | Meta tags only | Only used in OG meta, not visible — no lazy option needed |
| Fonts (4 woff2) | Preloaded | Critical — keep eager |
| Chart.js (`vendor/chart.umd.js`) | Lazy-loaded | Already lazy (loaded on "Show Charts" click) |
| `script.js` | Eager | Execution-blocking — considered critical |

---

## Step 3: Add `loading="lazy"` to visual images (if any exist)

```bash
# Check for <img> tags that are visually rendered:
grep -rn '<img' index.html guide/*/index.html 404.html
```

The project uses inline SVGs (not `<img>` tags). If no `<img>` tags exist, this plan is already satisfied.

---

## Step 4: Preload critical images only

Verify the preload strategy:

```html
<!-- Current preloads (from earlier analysis): -->
<link rel="preload" as="font" href="fonts/rajdhani-regular.woff2" crossorigin>
<link rel="preload" as="font" href="fonts/rajdhani-semibold.woff2" crossorigin>
<link rel="preload" as="font" href="fonts/rajdhani-bold.woff2" crossorigin>
<link rel="preload" as="font" href="fonts/orbitron-variable.woff2" crossorigin>
```

No image preloads are needed since all OG images are only referenced in meta tags and aren't loaded by the browser until needed (social crawlers).

---

## Step 5: Add `fetchpriority` for critical assets (optimization)

```html
<!-- Boost priority for the first font that renders visible text -->
<link rel="preload" as="font" href="fonts/rajdhani-regular.woff2" crossorigin fetchpriority="high">
```

---

## Step 6: Remove unnecessary preconnect/preload

If any unused preloads exist (e.g., preloading an OG image), remove them:

```bash
grep -rn 'preload\|preconnect\|prefetch' index.html guide/*/index.html 404.html
```

Remove any that reference:
- External domains (there shouldn't be any — zero CDN)
- Non-critical resources
- Resources that are already lazy-loaded

---

## Step 7: Add `importance="low"` for the charts lazy load

When dynamically creating the `<script>` tag for Chart.js:

```js
function loadChartJs() {
  var script = document.createElement('script');
  script.src = 'vendor/chart.umd.js';
  script.fetchPriority = 'low'; // Lowest priority
  script.onload = initCharts;
  document.head.appendChild(script);
}
```

---

## Files Modified

| File | Change |
|------|--------|
| `script.js` | Add `fetchPriority = 'low'` to Chart.js lazy load |
| `index.html` | Add `fetchpriority="high"` to primary font preload |
| `guide/*/index.html` (×6) | Same font preload update |
| `404.html` | Same font preload update |

---

## Verification

```bash
# Check no visual images are loaded eagerly:
grep -rn '<img[^>]*loading="eager"' index.html guide/*/index.html 404.html
# Expected: none (or only favicon)

# Check Chart.js script tag has low priority:
grep -rn 'fetchPriority\|fetchpriority' script.js
# Expected: Chart.js lazy loader has fetchPriority = 'low'
```
