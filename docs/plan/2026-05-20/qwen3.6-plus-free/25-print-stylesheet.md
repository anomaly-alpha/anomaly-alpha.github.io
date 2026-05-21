# Plan 25: Print Stylesheet

**Problem:** Printing the page produces a dark-background, low-contrast output that wastes ink and is hard to read. No print-specific styles exist.

**Goal:** Add `@media print` styles that produce a clean, white-background, ink-efficient printout of gem totals and card information.

---

## Step 1: Add print media query

```css
/* styles.css */
@media print {
  /* Reset background */
  *, *::before, *::after {
    background: transparent !important;
    color: #000 !important;
    box-shadow: none !important;
    text-shadow: none !important;
  }

  /* Hide non-essential elements */
  .gem-orb,
  .gem-mode-btn,
  .gem-chart,
  .gem-card__info-btn,
  .gem-btn--icon,
  body::after {
    display: none !important;
  }

  /* Show all cards */
  .gem-card--hidden {
    display: block !important;
    opacity: 1 !important;
  }

  /* Card styling for print */
  .gem-card {
    border: 1px solid #ccc;
    break-inside: avoid;
    page-break-inside: avoid;
    margin-bottom: 1rem;
  }

  /* Counter values */
  .gem-counter {
    font-size: 1.5rem;
    font-weight: 700;
  }

  /* Links show URLs */
  a[href]::after {
    content: " (" attr(href) ")";
    font-size: 0.75rem;
    color: #666;
  }

  /* Header */
  .gem-header h1 {
    font-size: 1.5rem;
    margin-bottom: 0.5rem;
  }

  /* Footer with timestamp */
  .gem-footer::after {
    content: "Printed on " attr(data-print-date);
    display: block;
    font-size: 0.75rem;
    color: #999;
    margin-top: 2rem;
  }
}
```

## Step 2: Add print date via JS

```javascript
// script.js — add on load
document.addEventListener('DOMContentLoaded', function() {
  var footer = document.querySelector('.gem-footer');
  if (footer) {
    footer.setAttribute('data-print-date', new Date().toLocaleDateString());
  }
});
```

## Files Modified
- `styles.css` — print media query
- `script.js` — print date attribute

## Verification
```bash
npm run build
# Ctrl+P / Cmd+P in browser
# Print preview should show clean white layout
# No dark backgrounds, no decorative elements
```
