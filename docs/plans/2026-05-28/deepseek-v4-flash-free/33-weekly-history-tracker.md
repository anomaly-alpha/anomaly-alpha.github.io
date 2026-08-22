# Plan 33: Weekly History Tracker

**Problem:** The calculator shows only current-week projections. There's no way to track gem income over time — users can't see "I earned 3,800 gems last week vs 4,200 the week before."

**Goal:** Add a lightweight weekly history that stores the user's gem total each time they visit. Display a simple trend chart or table of the last 12 weeks.

---

## Step 1: Data model

```json
{
  "gem_history": [
    {"week": "2026-W19", "gems": 4043, "pvp": "Elite II / rank 13"},
    {"week": "2026-W18", "gems": 4200, "pvp": "Elite II / rank 10"},
    {"week": "2026-W17", "gems": 3800, "pvp": "Senior I / rank 20"}
  ]
}
```

Stored in `localStorage` key `gem_history`.

---

## Step 2: Create the history record function

```js
// ===== WEEKLY HISTORY =====

function getCurrentWeekKey() {
  // Return ISO week string (e.g., "2026-W20")
  var now = new Date();
  var startOfYear = new Date(now.getFullYear(), 0, 1);
  var diff = now - startOfYear;
  var week = Math.ceil((diff / 86400000 + startOfYear.getDay() + 1) / 7);
  return now.getFullYear() + '-W' + String(week).padStart(2, '0');
}

function recordWeeklySnapshot() {
  var weekKey = getCurrentWeekKey();
  var history = loadHistory();
  var total = getCurrentTotal();

  // Don't overwrite if already recorded this week
  if (history.some(function (h) { return h.week === weekKey; })) return;

  // Get current PvP selections for context
  var pvpContext = '';
  ['pvp1', 'pvp2', 'pvp3'].forEach(function (id) {
    var leagueEl = document.getElementById(id + '-league');
    var rankEl = document.getElementById(id + '-rank');
    if (leagueEl && rankEl) {
      var leagueName = leagueEl.options[leagueEl.selectedIndex].text;
      pvpContext += leagueName + '/' + rankEl.value + ' ';
    }
  });

  history.push({
    week: weekKey,
    gems: total,
    pvp: pvpContext.trim(),
    date: new Date().toISOString()
  });

  // Keep last 24 weeks max
  if (history.length > 24) {
    history = history.slice(-24);
  }

  localStorage.setItem('gem_history', JSON.stringify(history));
}

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem('gem_history')) || [];
  } catch (e) {
    return [];
  }
}

function getCurrentTotal() {
  var el = document.getElementById('total-gems');
  return parseInt((el.textContent || '0').replace(/,/g, '')) || 0;
}
```

**Trigger** on page load and on reset day:
```js
// In DOMContentLoaded:
recordWeeklySnapshot();
```

---

## Step 3: Display history section

**In `index.html`** (below charts section):

```html
<div id="gem-history-section" class="gem-section" style="display:none">
  <h3 class="gem-text--cyan text-sm font-bold tracking-wider uppercase mb-3">
    Weekly History
    <button class="gem-btn--clear text-xs ml-2" onclick="clearHistory()">Clear</button>
  </h3>
  <div class="gem-history__table-wrapper overflow-x-auto">
    <table class="gem-history__table w-full text-sm">
      <thead>
        <tr class="gem-text--muted text-xs uppercase tracking-wider">
          <th class="text-left p-2">Week</th>
          <th class="text-right p-2">Gems</th>
          <th class="text-right p-2">vs. Avg</th>
          <th class="text-left p-2">PvP Setup</th>
        </tr>
      </thead>
      <tbody id="gem-history-body"></tbody>
    </table>
  </div>
  <button class="gem-text--cyan text-xs mt-2" onclick="toggleHistory()">
    <span id="history-toggle-text">Show History</span>
  </button>
</div>
```

---

## Step 4: Render history table

```js
function renderHistory() {
  var history = loadHistory();
  var tbody = document.getElementById('gem-history-body');
  if (!tbody) return;

  if (history.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="gem-text--muted text-center p-4">No history yet — check back next week</td></tr>';
    return;
  }

  var avg = history.reduce(function (s, h) { return s + h.gems; }, 0) / history.length;

  tbody.innerHTML = history.slice().reverse().map(function (h) {
    var diff = h.gems - avg;
    var diffClass = diff > 0 ? 'gem-text--code' : (diff < 0 ? 'gem-text--event' : 'gem-text--muted');
    var diffStr = diff > 0 ? '+' + Math.round(diff) : Math.round(diff).toString();
    return '<tr>' +
      '<td class="p-2 gem-text--cyan">' + h.week + '</td>' +
      '<td class="p-2 text-right">' + h.gems.toLocaleString() + '</td>' +
      '<td class="p-2 text-right ' + diffClass + '">' + diffStr + '</td>' +
      '<td class="p-2 gem-text--muted text-xs">' + (h.pvp || '-') + '</td>' +
      '</tr>';
  }).join('');
}

function toggleHistory() {
  var section = document.getElementById('gem-history-section');
  var toggle = document.getElementById('history-toggle-text');
  if (section.style.display === 'none') {
    section.style.display = 'block';
    toggle.textContent = 'Hide History';
  } else {
    section.style.display = 'none';
    toggle.textContent = 'Show History';
  }
}

function clearHistory() {
  localStorage.removeItem('gem_history');
  renderHistory();
}
```

**Add to DOMContentLoaded:**
```js
renderHistory();
```

---

## Step 5: Add a mini sparkline chart (optional)

If Chart.js is already loaded, add a line chart for the last 12 weeks:

```js
function renderHistoryChart() {
  var history = loadHistory();
  if (history.length < 2) return;

  var canvas = document.getElementById('history-chart');
  if (!canvas) return;

  var ctx = canvas.getContext('2d');
  new Chart(ctx, {
    type: 'line',
    data: {
      labels: history.map(function (h) { return h.week; }),
      datasets: [{
        label: 'Weekly Gems',
        data: history.map(function (h) { return h.gems; }),
        borderColor: '#00e5ff',
        backgroundColor: 'rgba(0, 229, 255, 0.1)',
        fill: true,
        tension: 0.3,
        pointBackgroundColor: '#00e5ff'
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } }
    }
  });
}
```

---

## Files Modified

| File | Change |
|------|--------|
| `index.html` | Add history section HTML |
| `script.js` | Add history functions, table render, chart |
| `styles.css` | Add `.gem-history__table` styles |

---

## Verification

```bash
# Open index.html
# Show history — table is empty ("No history yet")
# Reload page — snapshot recorded
# Show history — see current week entry
# Change PvP and reload — still only one entry (same week)
# Manually adjust localStorage to add old entries:
#   localStorage.setItem('gem_history', JSON.stringify([{week:'2026-W19',gems:4000}, {week:'2026-W18',gems:3800}]))
# Reload — see 2 entries with average comparison
```
