# Plan 87: ARIA Expanded Toggle States

**Problem:** Toggle elements (charts toggle, profile expand/collapse, mode filters) don't communicate their expanded state to screen readers. Users can't tell if the charts section is shown or hidden.

**Goal:** Add `aria-expanded` and `aria-controls` to all toggle buttons. Manage them with JS.

---

## Step 1: Audit toggle elements

| Element | Controls | Has aria-expanded? |
|---------|----------|-------------------|
| "Show Charts" button | `#charts-section` | ❌ |
| History toggle | `#gem-history-section` | ❌ |
| Mode filter buttons | Cards by category | ❌ (uses aria-pressed instead) |

---

## Step 2: Add aria-controls and aria-expanded

**Charts toggle:**
```html
<button id="toggle-charts" onclick="toggleCharts()"
        aria-expanded="false" aria-controls="charts-section">
  Show Charts
</button>
```

**Update JS:**
```js
function toggleCharts() {
  var section = document.getElementById('charts-section');
  var btn = document.getElementById('toggle-charts');
  var isHidden = section.classList.contains('hidden');

  if (isHidden) {
    section.classList.remove('hidden');
    btn.setAttribute('aria-expanded', 'true');
    btn.textContent = 'Hide Charts';
  } else {
    section.classList.add('hidden');
    btn.setAttribute('aria-expanded', 'false');
    btn.textContent = 'Show Charts';
  }
}
```

---

## Step 3: History toggle

```html
<button onclick="toggleHistory()"
        aria-expanded="false" aria-controls="gem-history-section">
  Show History
</button>
```

---

## Step 4: Verify with axe-core

```bash
# Run a11y tests — should show no violations for aria-expanded
npx playwright test e2e/accessibility.spec.js
```

---

## Files Modified: `index.html`, `script.js`
