# Performance Plan — Execution Checklist

Status: **Complete** (executed 2026-05-03)

| Metric | Before | After |
|--------|--------|-------|
| CDN dependencies | 5 (FA, Chart.js, Tailwind CDN ×2, Google Fonts) | 0 |
| Third-party JS | ~360 KB (FA + Chart.js CDN) | ~200 KB (Chart.js self-hosted) |
| Third-party origins | 5 | 0 |
| Icons library | Font Awesome 6.5.1 (~300 KB) | Inline SVGs (32 icons, ~30 KB) |
| Fonts | Google Fonts CDN (render-blocking) | Self-hosted in `fonts/` (48 KB) |
| Render-blocking CSS | Google Fonts CSS + tailwind.css + styles.css | tailwind.css + styles.css only |

---

## Phase 1 — Replace Tailwind Play CDN on guide pages

**Files:** `guide/*/index.html` ×6
**Gain:** Remove ~283 KB blocking script per page
**Risk:** None (build already generates `tailwind.css` with needed classes)
**Status: ✅ Complete**

**Change 1.1 — Each guide page:**
```diff
- <script src="https://cdn.tailwindcss.com"></script>
+ <link rel="stylesheet" href="../../tailwind.css">
```

## Phase 2 — Replace Font Awesome with inline SVGs

**Files:** `index.html`, `guide/*/index.html` ×6, `script.js`
**Gain:** Remove ~300 KB library, eliminate CDN round-trip
**Risk:** None
**Pattern:** Inline SVGs in HTML. No sprite, no `<use>`.
**Status: ✅ Complete**

### 2.1 Static icons (in HTML)
Replace each `<i class="fas fa-{name}">` with inline `<svg>` directly in the HTML markup.

### 2.2 Chevron toggle (JS-driven)
Render both `<svg>` (chevron-up, chevron-down) in the HTML. Toggle via `hidden` class. No JS icon manipulation.

### 2.3 JS-generated icons (toast, modal)
Store SVG strings as JS constants in `script.js`, inject via `innerHTML`:
```js
const SVG = {
  checkCircle: '<svg ...>...</svg>',
  infoCircle: '<svg ...>...</svg>',
  exclamationTriangle: '<svg ...>...</svg>',
  shieldCheck: '<svg ...>...</svg>',
  lightbulb: '<svg ...>...</svg>',
};
```

### 2.4 Remove CDN
```diff
- <link rel="preconnect" href="https://cdnjs.cloudflare.com">
- <script defer src="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/js/all.min.js"></script>
```
From all 7 HTML files.

### 2.5 32 unique icons to create
calendar-alt, calendar-day, calendar-week, chart-pie, check-circle, chevron-down, chevron-up, clock, coins, compass, cube, door-open, dragon, earth-americas, exclamation-triangle, fist-raised, gem, gift, globe, info-circle, layer-group, lightbulb, microchip, question-circle, shield-check, shield-halved, sign-in-alt, table, th-large, ticket, trophy, user

---

## Phase 3 — Self-host Chart.js

**Files:** `index.html`, `vendor/chart.umd.js` (new), `package.json`
**Gain:** Eliminate DNS + TLS round-trip to jsdelivr
**Risk:** None
**Status: ✅ Complete**

### 3.1 Download
Update `npm run update-assets`:
```diff
- "update-assets": "echo 'Manual: download Chart.js 4.4.1 → vendor/chart.umd.js, Font Awesome 6.5.1 → vendor/fontawesome/'"
+ "update-assets": "curl -Lo vendor/chart.umd.js https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.js"
```
Run: `npm run update-assets`

### 3.2 Update HTML
```diff
- <link rel="preconnect" href="https://cdn.jsdelivr.net">
- <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.js" defer></script>
+ <script src="vendor/chart.umd.js" defer></script>
```

---

## Phase 4 — Self-host Google Fonts

**Files:** `fonts/` (4 .woff2 files), `styles.css`, all 7 HTML files
**Gain:** Eliminate 1 render-blocking CSS request + 1 third-party origin
**Risk:** Low
**Status: ✅ Complete**

### 4.1 Download font files
Download 5 `.woff2` files from Google Fonts:
- Rajdhani 400, 600, 700
- Orbitron 500, 700, 900

Place in `fonts/` directory.

### 4.2 Add `@font-face` to `styles.css`
```css
@font-face {
  font-family: 'Rajdhani';
  src: url('fonts/Rajdhani-Regular.woff2') format('woff2');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'Rajdhani';
  src: url('fonts/Rajdhani-SemiBold.woff2') format('woff2');
  font-weight: 600;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'Rajdhani';
  src: url('fonts/Rajdhani-Bold.woff2') format('woff2');
  font-weight: 700;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'Orbitron';
  src: url('fonts/Orbitron-Medium.woff2') format('woff2');
  font-weight: 500;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'Orbitron';
  src: url('fonts/Orbitron-Bold.woff2') format('woff2');
  font-weight: 700;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'Orbitron';
  src: url('fonts/Orbitron-Black.woff2') format('woff2');
  font-weight: 900;
  font-style: normal;
  font-display: swap;
}
```

### 4.3 Remove Google Fonts from all HTML files
```diff
- <link href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;600;700&family=Orbitron:wght@500;700;900&display=swap" rel="stylesheet">
```
Remove from all 7 HTML files (index + 6 guides).

### 4.4 Remove preconnects
```diff
- <link rel="preconnect" href="https://fonts.googleapis.com">
- <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
```

---

## Skipped / rejected

| Idea | Reason |
|------|--------|
| Inline critical CSS | Not worth the maintenance drift. 5 KB gzipped tailwind.css is minimal. |
| Defer tailwind.css | Same reasoning — negligible render-blocking cost for 5 KB gzipped. |
| FA SVG sprite with `<use>` | Inline SVGs are simpler, no `xlink:href` complexity, no cross-origin issues. |
| npm dependency for Chart.js | Direct download into `vendor/` matches existing convention. |

## Success criteria

| Metric | Before | After |
|--------|--------|-------|
| Render-blocking CSS | 51 KB (tailwind.css + styles.css) | 33 KB (styles.css only) |
| Render-blocking scripts | 1 (Tailwind Play CDN ×6 guide pages) | 0 |
| Third-party JS | ~360 KB (FA + Chart.js CDN) | ~20 KB (Chart.js self-hosted) |
| Third-party origins | 5 (fonts.googleapis, gstatic, jsdelivr, cdnjs, cdn.tailwindcss) | 1 (none — zero when fonts self-hosted too) |
| Total page weight (main) | ~530 KB | ~200 KB |
