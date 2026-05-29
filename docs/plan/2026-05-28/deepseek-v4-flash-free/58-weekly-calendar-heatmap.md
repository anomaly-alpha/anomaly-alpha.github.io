# Plan 58: Weekly Reset History Calendar

**Problem:** Weekly snapshots (Plan 33) are stored as a table. There's no visual calendar view showing "how much I earned each week" at a glance.

**Goal:** Add a mini calendar heatmap (like GitHub contribution graph) showing weekly gem totals over the past 12 weeks.

---

## Step 1: Process history into calendar format

```js
function buildCalendarData() {
  var history = loadHistory();
  var now = new Date();
  var weeks = [];

  for (var i = 11; i >= 0; i--) {
    var d = new Date(now);
    d.setDate(d.getDate() - i * 7);
    var weekKey = getISOWeek(d);
    var entry = history.find(function (h) { return h.week === weekKey; });
    weeks.push({
      week: weekKey,
      gems: entry ? entry.gems : 0,
      recorded: !!entry,
      date: d
    });
  }
  return weeks;
}

function getISOWeek(date) {
  var startOfYear = new Date(date.getFullYear(), 0, 1);
  var diff = date - startOfYear;
  var week = Math.ceil((diff / 86400000 + startOfYear.getDay() + 1) / 7);
  return date.getFullYear() + '-W' + String(week).padStart(2, '0');
}
```

---

## Step 2: Calendar heatmap

```html
<div class="gem-calendar" id="history-calendar">
  <h4 class="gem-text--muted text-xs uppercase tracking-wider mb-2">Weekly History</h4>
  <div class="gem-calendar__grid" id="calendar-grid"></div>
</div>
```

---

## Step 3: Render calendar

```js
function renderCalendar() {
  var grid = document.getElementById('calendar-grid');
  if (!grid) return;
  var weeks = buildCalendarData();
  var maxGems = Math.max.apply(null, weeks.map(function (w) { return w.gems || 0; }));

  grid.innerHTML = weeks.map(function (w) {
    var intensity = maxGems > 0 ? Math.round((w.gems / maxGems) * 4) : 0;
    var colorClass = w.recorded ? 'gem-cal__cell--' + intensity : 'gem-cal__cell--empty';
    return '<div class="gem-cal__cell ' + colorClass + '" title="' + w.week + ': ' + w.gems.toLocaleString() + ' gems">' +
      '<span class="gem-cal__label">' + w.week.slice(-2) + '</span>' +
      '</div>';
  }).join('');
}
```

---

## Step 4: Calendar CSS

```css
.gem-calendar__grid { display: grid; grid-template-columns: repeat(12, 1fr); gap: 3px; }
.gem-cal__cell {
  aspect-ratio: 1; border-radius: 3px; display: flex; align-items: center; justify-content: center;
  font-size: 0.55rem; color: var(--gem-text--muted);
}
.gem-cal__cell--empty { background: rgba(255,255,255,0.03); }
.gem-cal__cell--0 { background: rgba(0,229,255,0.08); }
.gem-cal__cell--1 { background: rgba(0,229,255,0.2); }
.gem-cal__cell--2 { background: rgba(0,229,255,0.4); }
.gem-cal__cell--3 { background: rgba(0,229,255,0.6); }
.gem-cal__cell--4 { background: rgba(0,229,255,0.85); color: #000; font-weight: 700; }
```

---

## Files Modified: `index.html`, `script.js`, `styles.css`
