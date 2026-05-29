# Plan 84: Screen Reader Announcements for Dynamic Content

**Problem:** Dynamic content changes (counter animation, PvP value updates, chart renders) are not announced to screen readers. Users relying on assistive technology miss important state changes.

**Goal:** Add `aria-live` regions for all dynamic content areas. Ensure meaningful announcements.

---

## Step 1: Audit dynamic content areas

| Element | Current Announced? | Fix |
|---------|-------------------|-----|
| Total gem counter | ❌ | Add `aria-live="polite"` + `aria-atomic="true"` |
| PvP card values | ❌ | Add `aria-live="polite"` per card |
| Mode filter change | ❌ | Announce active modes count |
| Chart section visibility | ❌ | Announce "Charts shown/hidden" |
| Promo code copy | ❌ | Use `aria-live="assertive"` announcer |
| Modal open | ✅ | Focus management already planned (Plan 04) |

---

## Step 2: Add announcer element

```html
<div id="gem-announcer" class="sr-only" aria-live="polite" aria-atomic="true"></div>
```

---

## Step 3: Create announce function

```js
function announce(message, priority) {
  var el = document.getElementById('gem-announcer');
  if (!el) return;
  el.setAttribute('aria-live', priority || 'polite');
  el.textContent = '';
  // Force reflow to ensure announcement repeats for same message
  void el.offsetWidth;
  el.textContent = message;
}
```

---

## Step 4: Add announcements to key events

```js
// After updateAllPageTotals():
announce('Total gems updated to ' + getCurrentTotal().toLocaleString());

// After filterCards():
var count = selectedModes.length;
announce('Showing ' + count + ' mode' + (count !== 1 ? 's' : ''));

// After PvP change:
announce('PvP payout recalculated');

// After code copy:
function copyToClipboard(code) {
  // ... existing logic ...
  announce('Code ' + code + ' copied to clipboard', 'assertive');
}

// After chart toggle:
announce(chartsVisible ? 'Charts shown' : 'Charts hidden');
```

---

## Step 5: Debounce announcements

Prevent rapid announcements from queuing:

```js
var announceTimeout;
function announce(message, priority) {
  clearTimeout(announceTimeout);
  announceTimeout = setTimeout(function () {
    var el = document.getElementById('gem-announcer');
    if (!el) return;
    el.setAttribute('aria-live', priority || 'polite');
    el.textContent = '';
    void el.offsetWidth;
    el.textContent = message;
  }, 150); // Wait 150ms for rapid changes to settle
}
```

---

## Files Modified: `index.html`, `script.js`
