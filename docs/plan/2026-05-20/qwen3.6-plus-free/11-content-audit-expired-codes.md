# Plan 11: Content Audit — Expired Codes

**Problem:** The promo codes list contains 8 expired codes mixed with 24 active codes. Expired codes are marked with `expired: true` but still displayed in the card, cluttering the UI and potentially confusing users who try to redeem them.

**Goal:** Auto-hide expired codes from the default view, showing them only in an "Expired" collapsible section.

---

## Step 1: Separate active/expired codes in rendering

```javascript
// script.js — modify the code rendering function
function renderPromoCodes() {
  var codes = REWARDS.promoCodes;
  var active = codes.filter(function(c) { return !c.expired; });
  var expired = codes.filter(function(c) { return c.expired; });

  var container = document.getElementById('promo-codes-list');
  if (!container) return;

  // Render active codes
  var activeHtml = active.map(function(c) {
    return '<button class="gem-code__item" onclick="copyCode(\'' + c.code + '\')">' +
      '<span class="gem-code__value">' + c.code + '</span>' +
      '<span class="gem-code__reward">' + c.gems + ' gems</span>' +
      '</button>';
  }).join('');

  // Render expired codes in collapsible
  var expiredHtml = '<details class="gem-code__expired-section">' +
    '<summary>Expired codes (' + expired.length + ')</summary>' +
    expired.map(function(c) {
      return '<div class="gem-code__item gem-code__item--expired">' +
        '<span class="gem-code__value">' + c.code + '</span>' +
        '<span class="gem-code__expired-date">Expired: ' + c.expiredDate + '</span>' +
        '</div>';
    }).join('') +
    '</details>';

  container.innerHTML = activeHtml + expiredHtml;
}
```

## Step 2: Add CSS for expired codes section

```css
/* styles.css */
.gem-code__expired-section {
  margin-top: 1rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--gem-border--subtle);
}
.gem-code__expired-section summary {
  color: var(--gem-text--muted);
  font-size: 0.8rem;
  cursor: pointer;
}
.gem-code__item--expired {
  opacity: 0.4;
  text-decoration: line-through;
  pointer-events: none;
}
```

## Files Modified
- `script.js` — renderPromoCodes function updated
- `styles.css` — expired code styles

## Verification
```bash
npm run build
# Open index.html
# Promo code card should show 24 active codes
# "Expired codes (8)" collapsible at bottom
```
