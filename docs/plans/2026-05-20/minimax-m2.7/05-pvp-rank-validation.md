# Plan 05: Input Validation for PvP Rank Field

**Problem:** The PvP rank `<select>` element allows any value, but the payout tables only cover ranks 1-120. If a rank value outside this range is somehow selected (e.g., via browser console or unexpected state), `getPvpPayout` returns `undefined` and gem totals become `NaN`.

**Goal:** Add validation to ensure rank is always 1-120. Show visual error state if invalid, prevent NaN in gem counter.

---

## Step 1: Add validation to the rank select change handler
In `script.js`, find the function that handles PvP rank changes and add bounds checking.

Find the existing handler — likely near `updatePvpCard` or the league/rank select `onchange` attributes in the HTML. Add validation:

```javascript
function handleRankChange(arenaId, rank) {
  const rankNum = parseInt(rank, 10);
  if (isNaN(rankNum) || rankNum < 1 || rankNum > 120) {
    var select = document.querySelector('#' + arenaId + ' .gem-select--rank');
    select.classList.add('gem-select--error');
    showToast('Rank must be between 1 and 120', 'error');
    return;
  }
  updatePvpCard(arenaId);
  updateAllPageTotals();
  updateChartsByModes(selectedModes);
}
```

## Step 2: Add error styles for invalid select
Add a CSS rule in `styles.css` for `.gem-select--error`:

```css
.gem-select--error {
  border-color: #ef4444 !important;
  box-shadow: 0 0 8px rgba(239, 68, 68, 0.5);
}
```

## Step 3: Create a showToast helper if it doesn't exist
If `showToast` doesn't exist, add a simple toast system:

```javascript
function showToast(message, type) {
  var existing = document.querySelector('.gem-toast');
  if (existing) existing.remove();
  var toast = document.createElement('div');
  toast.className = 'gem-toast gem-toast--' + (type || 'info');
  toast.textContent = message;
  toast.setAttribute('role', 'alert');
  document.body.appendChild(toast);
  setTimeout(function() { toast.remove(); }, 3000);
}
```

## Files Modified
- `script.js` — add bounds checking in rank change handler
- `styles.css` — add .gem-select--error styles
- `index.html` — may need toast styles added (check if .gem-toast exists)

## Verification
```bash
# Open browser console:
handleRankChange('restricted-arena', 200);
# Should see red border on select + toast error, not NaN gem counter
```