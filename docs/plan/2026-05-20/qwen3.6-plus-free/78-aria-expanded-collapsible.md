# Plan 78: Aria-Expanded on Collapsible

**Problem:** Collapsible elements (`<details>`, custom accordions) don't have `aria-expanded` attributes, so screen readers can't tell whether they're open or closed.

**Goal:** Add `aria-expanded` to all collapsible elements.

---

## Step 1: Update details elements

```html
<!-- For native <details> elements, aria-expanded is automatic -->
<!-- But verify no custom collapsions are missing it -->
```

## Step 2: Add to custom collapsible elements

```html
<!-- Any custom toggle buttons -->
<button aria-expanded="false" aria-controls="collapsible-content" onclick="toggleSection(this)">
  Show more
</button>
<div id="collapsible-content" hidden>...</div>
```

```javascript
// script.js
function toggleSection(button) {
  var target = document.getElementById(button.getAttribute('aria-controls'));
  var expanded = button.getAttribute('aria-expanded') === 'true';
  button.setAttribute('aria-expanded', !expanded);
  target.hidden = expanded;
}
```

## Files Modified
- `script.js` — toggleSection function
- Any custom collapsible elements — aria-expanded

## Verification
```bash
# Screen reader — should announce "collapsed" or "expanded"
# DevTools > Accessibility — aria-expanded should toggle
```
