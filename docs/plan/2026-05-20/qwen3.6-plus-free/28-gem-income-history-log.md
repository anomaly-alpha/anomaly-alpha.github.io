# Plan 28: Gem Income History Log

**Problem:** Users cannot see how their gem income has changed over time. There's no way to log weekly totals and track trends.

**Goal:** Add a simple history log that stores weekly totals in localStorage and displays them as a list.

---

## Step 1: Add history log HTML

```html
<!-- index.html — add in a new section -->
<div class="gem-history" id="gem-history">
  <h3 class="gem-history__title">Income History</h3>
  <button class="gem-btn" onclick="logCurrentWeek()">Log This Week</button>
  <ul class="gem-history__list" id="gem-history-list"></ul>
  <button class="gem-btn--clear" onclick="clearHistory()">Clear</button>
</div>
```

## Step 2: Add history logic

```javascript
// script.js
function logCurrentWeek() {
  var total = calculateGrandTotal();
  var entry = {
    date: new Date().toISOString().slice(0, 10),
    total: total,
    league: getPvpLeague(),
    rank: getPvpRank()
  };

  var history = JSON.parse(localStorage.getItem('gem_history') || '[]');
  history.unshift(entry);
  if (history.length > 52) history = history.slice(0, 52); // Keep 1 year
  localStorage.setItem('gem_history', JSON.stringify(history));
  renderHistory();
}

function renderHistory() {
  var history = JSON.parse(localStorage.getItem('gem_history') || '[]');
  var list = document.getElementById('gem-history-list');
  if (!list) return;

  list.innerHTML = history.map(function(entry) {
    return '<li>' +
      '<span class="gem-history__date">' + entry.date + '</span>' +
      '<span class="gem-history__total">' + entry.total.toLocaleString() + ' gems</span>' +
      '<span class="gem-history__league">' + entry.league + ' ' + entry.rank + '</span>' +
      '</li>';
  }).join('');
}
```

## Files Modified
- `index.html` — history log HTML
- `script.js` — history logic

## Verification
```bash
npm run build
# Click "Log This Week" — entry should appear
# Change league/rank, log again — new entry at top
```
