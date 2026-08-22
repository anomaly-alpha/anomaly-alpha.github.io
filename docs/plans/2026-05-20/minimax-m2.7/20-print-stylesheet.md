# Plan 20: Print Stylesheet

**Problem:** The page renders poorly when printed — interactive elements show, dark backgrounds waste ink, charts are invisible, and there's no indication of which gems came from which source.

**Goal:** Add a print stylesheet that shows a clean, ink-friendly summary of gem income. Hide navigation, charts, modals, and interactive elements. Show only the card grid and totals.

---

## Step 1: Add print media query to styles.css
Add at the end of `styles.css`:

```css
@media print {
  /* Hide non-essential elements */
  .gem-orb,
  .gem-mode-btn,
  .gem-chart,
  .gem-modal,
  .gem-btn--icon,
  .gem-card__info-btn,
  .gem-toast,
  nav,
  footer,
  .gem-counter__label,
  .gem-card--fade-in {
    display: none !important;
  }

  /* Force white background, black text */
  :root {
    --gem-bg-dark: #ffffff;
    --gem-bg-mid: #f5f5f5;
    --gem-text--primary: #000000;
    --gem-text--secondary: #333333;
    --gem-card-bg--event: #f0f0f0;
    --gem-card-bg--pvp: #f0f0f0;
    --gem-card-bg--login: #f0f0f0;
    --gem-card-bg--code: #f0f0f0;
  }

  body {
    background: white !important;
    color: black !important;
    font-size: 11pt;
  }

  .gem-main-container {
    box-shadow: none;
    max-width: 100%;
  }

  /* Show gem card totals prominently */
  .gem-card {
    break-inside: avoid;
    border: 1px solid #ccc;
    margin-bottom: 0.5cm;
    page-break-inside: avoid;
  }

  .gem-card__title {
    font-size: 14pt;
    font-weight: bold;
  }

  .gem-card__gems {
    font-size: 18pt;
    font-weight: bold;
    color: #000 !important;
  }

  /* Show category color as left border */
  .gem-card--event { border-left: 4px solid #ff6b35; }
  .gem-card--pvp { border-left: 4px solid #e91e8a; }
  .gem-card--login { border-left: 4px solid #f39c12; }
  .gem-card--code { border-left: 4px solid #2ecc71; }

  /* Grand total at top */
  .gem-counter::before {
    content: 'Total Gems: ' attr(data-total);
    display: block;
    font-size: 20pt;
    font-weight: bold;
    margin-bottom: 1cm;
  }

  /* Include source URL */
  .gem-main-container::after {
    content: 'Generated from gem-calculator.app — Invincible Guarding the Globe';
    display: block;
    margin-top: 1cm;
    font-size: 8pt;
    color: #666;
  }

  a { color: #000; text-decoration: none; }
  a::after { content: none; }
}
```

## Step 2: Ensure counter has data-total attribute
Check that the gem counter element has a `data-total` attribute for the print pseudo-element to reference. If not, add:

```html
<div class="gem-counter" id="gemCounter" data-total="3221">
```

Or update the print style to read from the text content directly.

## Files Modified
- `styles.css` — add `@media print` block
- `index.html` — add data-total to counter if missing

## Verification
```bash
# Open index.html, press Ctrl+P (or Cmd+P)
# Preview should show clean print layout with card grid, no charts/interactive elements
```