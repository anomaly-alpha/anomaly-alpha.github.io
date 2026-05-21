# Plan 14: Mobile UX Improvements

**Problem:** The site works on mobile but has pain points: select dropdowns are narrow for 14-league options, modals can be oversized, card grids stack suboptimally, and touch targets may be too small for comfortable interaction.

**Goal:** Optimize mobile layout, touch targets, and interactions for a seamless phone experience.

---

## Step 1: Audit current mobile layout

Open on a 375px wide viewport (iPhone SE) and document issues:

```bash
# Serve and test:
npx serve .
# Open http://localhost:3000 in Chrome DevTools → iPhone SE preset
```

Document specific issues found. Common ones to check:
- PvP league select width on mobile
- Modal content overflowing viewport
- Promo code grid tap target sizes (< 44px)
- Card spacing on small screens
- Chart container sizing
- Countdown timer wrapping
- Mode button text fitting

---

## Step 2: Fix PvP select dropdowns on mobile

**In `styles.css`**, update `.gem-select--league`:

```css
/* Before: */
.gem-select--league {
  min-width: 9rem;
}

/* After: */
.gem-select--league {
  min-width: 9rem;
  max-width: 100%;
}

/* Mobile override: */
@media (max-width: 640px) {
  .gem-select--league {
    min-width: 7rem;
    font-size: 0.8rem;
  }
  .gem-select {
    padding: 0.4rem 0.5rem;
  }
}
```

---

## Step 3: Improve modal sizing on mobile

**In `styles.css`** (`.gem-modal__content`):

```css
@media (max-width: 640px) {
  .gem-modal__content {
    width: 95%;
    max-height: 85vh;
    margin: 0 auto;
    padding: 1rem;
  }
  .gem-modal__body {
    max-height: 50vh;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }
  .gem-modal__header {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }
}
```

---

## Step 4: Card grid responsive breakpoints

**In `styles.css`** (`.gem-grid--cards`):

```css
/* Current might be 1→2→3 columns. Verify: */
.gem-grid--cards {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
}

@media (min-width: 640px) {
  .gem-grid--cards {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 1024px) {
  .gem-grid--cards {
    grid-template-columns: repeat(3, 1fr);
  }
}
```

---

## Step 5: Touch target size audit

Ensure all interactive elements have a minimum touch target of 44x44px:

```css
/* Mode buttons: */
.gem-mode-btn {
  min-height: 44px;
  min-width: 44px;
  padding: 0.5rem 0.75rem;
}

/* Promo code buttons: */
.gem-code__value {
  min-height: 44px;
  min-width: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

/* Card info buttons: */
.gem-card__info-btn {
  width: 44px;
  height: 44px;
}
```

---

## Step 6: Chart container responsive sizing

**In `styles.css`** (`.gem-chart`):

```css
.gem-chart canvas {
  max-width: 100%;
  height: auto !important; /* Override Chart.js inline height */
}

@media (max-width: 640px) {
  .gem-chart {
    max-height: 250px;
  }
  .gem-grid--charts {
    grid-template-columns: 1fr;
  }
}
```

**In `script.js`**, in `initCharts()`, set responsive option:

```js
Chart.defaults.responsive = true;
Chart.defaults.maintainAspectRatio = true;
```

---

## Step 7: Prevent zoom on select focus (iOS)

iOS Safari zooms the page when a `<select>` is tapped. Prevent with:

```html
<!-- In <head> -->
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
```

Note: This prevents user pinch-zoom entirely. Alternative: use `font-size: 16px` on selects:

```css
/* iOS will zoom if font-size < 16px on focus */
@media (max-width: 640px) {
  .gem-select, .gem-select--league {
    font-size: 16px !important;
  }
}
```

The font-size approach is better — it preserves accessibility without disabling zoom.

---

## Step 8: Add safe-area insets for notched phones

```css
.gem-container {
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
}

body {
  padding-bottom: env(safe-area-inset-bottom);
}
```

---

## Step 9: Prevent 300ms tap delay

The modern viewport meta tag (`width=device-width`) already eliminates the 300ms delay on most browsers. Verify:

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0">
```

Already present. No change needed.

---

## Files Modified

| File | Change |
|------|--------|
| `styles.css` | Select widths, modal sizing, card grid, touch targets, chart sizing, safe areas |
| `script.js` | Chart responsive options |

---

## Verification

```bash
# Serve:
npx serve .

# Test in Chrome DevTools: iPhone SE, iPhone 12, Galaxy S8
# Verify:
# 1. PvP selects are usable without zoom
# 2. Modals fit within viewport
# 3. Cards stack in 1 column on mobile, 2 on tablet, 3 on desktop
# 4. All touch targets >= 44px
# 5. No horizontal scroll
# 6. Charts resize correctly
```
