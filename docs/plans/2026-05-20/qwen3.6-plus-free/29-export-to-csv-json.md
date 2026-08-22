# Plan 29: Export to CSV/JSON

**Problem:** Users cannot export their current configuration (league, rank, selected modes, totals) for sharing or record-keeping.

**Goal:** Add an export button that downloads the current configuration as CSV or JSON.

---

## Step 1: Add export button

```html
<!-- index.html — add near total counter -->
<div class="gem-export">
  <button class="gem-btn" onclick="exportConfig('json')">Export JSON</button>
  <button class="gem-btn" onclick="exportConfig('csv')">Export CSV</button>
</div>
```

## Step 2: Add export logic

```javascript
// script.js
function exportConfig(format) {
  var data = {
    date: new Date().toISOString(),
    league: getSelectedLeague(),
    rank: getSelectedRank(),
    multiverseLeague: getSelectedMultiverseLeague(),
    multiverseRank: getSelectedMultiverseRank(),
    modes: selectedModes,
    totals: {
      event: calculateCategoryTotal('event'),
      pvp: calculateCategoryTotal('pvp'),
      login: calculateCategoryTotal('login'),
      code: calculateCategoryTotal('code'),
      grand: calculateGrandTotal()
    }
  };

  var content, filename, type;

  if (format === 'json') {
    content = JSON.stringify(data, null, 2);
    filename = 'gem-rewards-' + data.date.slice(0, 10) + '.json';
    type = 'application/json';
  } else {
    content = 'Category,Gems\n' +
      'Event,' + data.totals.event + '\n' +
      'PvP,' + data.totals.pvp + '\n' +
      'Login,' + data.totals.login + '\n' +
      'Code,' + data.totals.code + '\n' +
      'Total,' + data.totals.grand + '\n';
    filename = 'gem-rewards-' + data.date.slice(0, 10) + '.csv';
    type = 'text/csv';
  }

  var blob = new Blob([content], { type: type });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
```

## Files Modified
- `index.html` — export buttons
- `script.js` — exportConfig function

## Verification
```bash
npm run build
# Click Export JSON — should download .json file
# Click Export CSV — should download .csv file
# Open files to verify content
```
