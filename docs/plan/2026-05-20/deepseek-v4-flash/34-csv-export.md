# Plan 34: CSV Export

**Problem:** Users cannot export their gem data for offline analysis, spreadsheet tracking, or sharing with alliance members. The data exists only in the browser.

**Goal:** Add one-click CSV export of current breakdown + weekly history. Also add a JSON export for import/backup.

---

## Step 1: Build the export data object

```js
// ===== EXPORT =====

function buildExportData() {
  return {
    exportedAt: new Date().toISOString(),
    total: getCurrentTotal(),
    breakdown: {
      event: getModeTotal('event'),
      pvp: getModeTotal('pvp'),
      login: getModeTotal('login'),
      code: getModeTotal('code')
    },
    pvpSettings: {
      restrictedArena: {
        league: getSelectText('pvp1-league'),
        rank: document.getElementById('pvp1-rank').value
      },
      openArena: {
        league: getSelectText('pvp2-league'),
        rank: document.getElementById('pvp2-rank').value
      },
      allianceWar: {
        league: getSelectText('pvp3-league'),
        rank: document.getElementById('pvp3-rank').value
      }
    },
    activeModes: selectedModes,
    theme: document.body.classList.contains('light-mode') ? 'light' : 'dark',
    history: loadHistory()
  };
}

function getSelectText(id) {
  var el = document.getElementById(id);
  return el ? el.options[el.selectedIndex].text : '';
}
```

---

## Step 2: CSV export

```js
function exportCSV() {
  var data = buildExportData();

  // Build CSV rows
  var rows = [
    ['Category', 'Gems/Week'].join(','),
    ['Event', data.breakdown.event].join(','),
    ['PvP', data.breakdown.pvp].join(','),
    ['Login', data.breakdown.login].join(','),
    ['Code', data.breakdown.code].join(','),
    ['Total', data.total].join(','),
    [],
    ['PvP Settings'].join(','),
    ['Arena', 'League', 'Rank'].join(','),
    ['Restricted', data.pvpSettings.restrictedArena.league, data.pvpSettings.restrictedArena.rank].join(','),
    ['Open', data.pvpSettings.openArena.league, data.pvpSettings.openArena.rank].join(','),
    ['Alliance War', data.pvpSettings.allianceWar.league, data.pvpSettings.allianceWar.rank].join(',')
  ];

  // Add history if available
  if (data.history && data.history.length > 0) {
    rows.push([], ['Weekly History'].join(','), ['Week', 'Gems', 'PvP Setup'].join(','));
    data.history.forEach(function (h) {
      rows.push([h.week, h.gems, '"' + (h.pvp || '') + '"'].join(','));
    });
  }

  var csv = rows.join('\n');
  downloadFile(csv, 'gem-rewards-export.csv', 'text/csv');
}
```

---

## Step 3: JSON export

```js
function exportJSON() {
  var data = buildExportData();
  var json = JSON.stringify(data, null, 2);
  downloadFile(json, 'gem-rewards-export.json', 'application/json');
}
```

---

## Step 4: Download helper

```js
function downloadFile(content, filename, mimeType) {
  var blob = new Blob([content], { type: mimeType + ';charset=utf-8' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
```

---

## Step 5: Add export buttons

**In `index.html`** (near total counter or in header):

```html
<div class="gem-export-buttons flex gap-2 mt-2">
  <button class="gem-btn--icon text-xs" onclick="exportCSV()" title="Export as CSV">
    <svg ...file-export icon...></svg>
    CSV
  </button>
  <button class="gem-btn--icon text-xs" onclick="exportJSON()" title="Export as JSON">
    <svg ...code icon...></svg>
    JSON
  </button>
</div>
```

---

## Step 6: CSS for export buttons

```css
.gem-export-buttons .gem-btn--icon {
  font-size: 0.7rem;
  padding: 0.25rem 0.5rem;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  background: rgba(0, 229, 255, 0.08);
  border: 1px solid rgba(0, 229, 255, 0.2);
  border-radius: 4px;
  color: var(--gem-cyan);
  cursor: pointer;
}
.gem-export-buttons .gem-btn--icon:hover {
  background: rgba(0, 229, 255, 0.15);
}
```

---

## Files Modified

| File | Change |
|------|--------|
| `index.html` | Add export buttons |
| `script.js` | Add `buildExportData()`, `exportCSV()`, `exportJSON()`, `downloadFile()`, `getSelectText()` |
| `styles.css` | Add `.gem-export-buttons` styles |

---

## Verification

```bash
# Open index.html
# Click "CSV" — downloads gem-rewards-export.csv
# Open in spreadsheet app — verify:
#   - Category breakdown row
#   - PvP settings section
#   - Weekly history (if any)
# Click "JSON" — downloads gem-rewards-export.json
# Open in editor — verify valid JSON with all fields
```
