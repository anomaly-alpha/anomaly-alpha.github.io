# Plan 30: Print Stylesheet

**Problem:** The dark mode design doesn't translate well to print. Dark backgrounds with light text waste ink. Charts lose interactivity. The sci-fi aesthetic adds visual noise on paper. Users may want to print payout tables or promo code lists for reference.

**Goal:** Create a print-optimized stylesheet that converts to light backgrounds, removes decorative elements, and presents data clearly in black and white.

---

## Step 1: Add print media query to styles.css

**In `styles.css`**:

```css
/* ===== PRINT STYLES ===== */

@media print {
  /* Reset dark theme to light */
  body {
    background: #fff !important;
    color: #000 !important;
  }

  /* Hide decorative elements */
  .gem-orb,
  .gem-particle,
  .gem-corner,
  body::after {
    display: none !important;
  }

  /* Remove fixed backgrounds */
  .gem-grid-bg {
    background: none !important;
  }

  /* Card containers — light background, remove shadows */
  .gem-card {
    background: #f5f5f5 !important;
    border: 1px solid #ccc !important;
    box-shadow: none !important;
    break-inside: avoid;
    page-break-inside: avoid;
  }

  /* Text colors to black */
  .gem-text--primary,
  .gem-text--secondary,
  .gem-text--muted,
  .gem-text--80,
  .gem-text--event,
  .gem-text--pvp,
  .gem-text--login,
  .gem-text--code,
  .gem-text--cyan {
    color: #000 !important;
  }

  /* Labels get light gray backgrounds */
  .gem-label--event,
  .gem-label--pvp,
  .gem-label--login,
  .gem-label--code {
    background: #e0e0e0 !important;
    border-color: #999 !important;
  }

  /* Hide interactive elements */
  .gem-card__info-btn,
  .gem-mode-btn,
  .gem-btn--icon,
  .gem-btn--clear,
  .gem-btn--compare,
  #gem-scroll-top,
  .gem-chart,
  .gem-toast {
    display: none !important;
  }

  /* Show promo codes without animation */
  .gem-code__hint {
    display: none !important;
  }
  .gem-code__reveal {
    display: block !important;
    opacity: 1 !important;
    transform: none !important;
  }

  /* Modals are always hidden in print */
  .gem-modal,
  .gem-modal__overlay {
    display: none !important;
  }

  /* Links show URLs */
  a[href^="http"]:after {
    content: " (" attr(href) ")";
    font-size: 0.8em;
    color: #666;
  }

  /* Images and SVGs */
  svg {
    color: #000 !important;
  }

  /* Ensure page breaks are sensible */
  .gem-card {
    break-inside: avoid;
  }

  /* Hide countdown timers */
  .gem-mode-btn__countdown {
    display: none !important;
  }

  /* Header */
  h1, h2, h3 {
    color: #000 !important;
  }
}
```

---

## Step 2: Add print-specific meta tag (optional)

```html
<meta name="color-scheme" content="light">
```

This tells the browser the print layout uses a light color scheme.

---

## Step 3: Add print button for desktop (optional)

**In `index.html`**:

```html
<button onclick="window.print()" class="gem-btn--icon"
        aria-label="Print this page"
        title="Print (Ctrl+P)">
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor" width="16" height="16">
    <path d="M128 0C92.7 0 64 28.7 64 64l0 96 64 0 0-96 226.7 0L384 93.3l0 66.7 64 0 0-66.7c0-17-6.7-33.3-18.7-45.3L400 18.7C388 6.7 371.7 0 354.7 0L128 0zM384 352l0 32 0 64-256 0 0-64 0-16 0-16 256 0zm64 32l-64 0 0 64c0 35.3-28.7 64-64 64l-256 0c-35.3 0-64-28.7-64-64l0-64 0-48c0-35.3 28.7-64 64-64l320 0c35.3 0 64 28.7 64 64l0 48z"/>
  </svg>
</button>
```

---

## Step 4: Verify print output

```bash
# Serve and print-preview:
npx serve .

# In Chrome: File → Print (Ctrl+P)
# Check:
# - No dark backgrounds
# - All text readable in black
# - No decorative particles/orbs
# - Cards break appropriately across pages
# - Promo codes are visible (not hidden behind reveal animation)
# - URLs shown after links
```

---

## Step 5: Test print on guide pages

Each guide page has different content (payout tables, FAQ, code list). Verify the print style handles:
- Code guide: all 32 codes visible
- PvP guide: payout tables readable
- FAQ guide: all Q&A pairs on paper
- Beginners guide: checklist items visible

---

## Files Modified

| File | Change |
|------|--------|
| `styles.css` | Add `@media print` block |
| `index.html` | Optionally add print button |
| `guide/*/index.html` (×6) | Optionally add print button |
| `404.html` | Optionally add print button |

---

## Verification

```bash
# Check print styles are present:
grep -c '@media print' styles.css
# Expected: at least 1

# Simulate print via JS:
# In DevTools console:
// matchMedia('print').matches should work after clicking "Print"
```
