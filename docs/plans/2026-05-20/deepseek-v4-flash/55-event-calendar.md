# Plan 55: Event Calendar

**Problem:** Events like "The Long Haul" and "Earth's Defenders" recur on a schedule, but users must know the schedule manually. There's no visual calendar showing when events start/end.

**Goal:** Add a visual event calendar showing active and upcoming events with countdowns, sourced from config.

---

## Step 1: Add event schedule data

**In `game-config`**: (add inside the existing config)

```json
"events": [
  {
    "name": "The Long Haul",
    "startDay": 1,
    "durationDays": 7,
    "pattern": "biweekly",
    "description": "Endurance event — top 5% earn 300 gems"
  },
  {
    "name": "Earth's Defenders",
    "startDay": 4,
    "durationDays": 5,
    "pattern": "biweekly",
    "description": "Defense event — top 10% earn 200 gems"
  }
]
```

`startDay` = day of week (0=Sunday), `pattern` = how often it repeats.

---

## Step 2: Calculate current/upcoming events

```js
function getCurrentEvents() {
  var events = GAME.events || [];
  var now = new Date();
  var dayOfWeek = now.getDay();

  return events.map(function (e) {
    var startOffset = (e.startDay - dayOfWeek + 7) % 7;
    var startDate = new Date(now);
    startDate.setDate(now.getDate() + startOffset);

    var endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + e.durationDays);

    var isActive = now >= startDate && now <= endDate;
    var daysUntil = Math.ceil((startDate - now) / 86400000);

    return {
      name: e.name,
      startDate: startDate,
      endDate: endDate,
      isActive: isActive,
      daysUntil: isActive ? 0 : daysUntil,
      description: e.description
    };
  });
}
```

---

## Step 3: Render event calendar

```html
<div class="gem-event-calendar">
  <h3 class="gem-text--cyan text-sm font-bold tracking-wider uppercase mb-2">Event Calendar</h3>
  <div id="event-list"></div>
</div>
```

```js
function renderEventCalendar() {
  var container = document.getElementById('event-list');
  if (!container) return;
  var events = getCurrentEvents();
  container.innerHTML = events.map(function (e) {
    var statusClass = e.isActive ? 'gem-event--active' : 'gem-event--upcoming';
    var statusLabel = e.isActive ? 'LIVE' : (e.daysUntil + 'd');
    return '<div class="gem-event ' + statusClass + '">' +
      '<div class="gem-event__status">' + statusLabel + '</div>' +
      '<div class="gem-event__info">' +
      '<div class="gem-event__name">' + e.name + '</div>' +
      '<div class="gem-event__desc">' + e.description + '</div>' +
      '<div class="gem-event__dates">' + formatDate(e.startDate) + ' — ' + formatDate(e.endDate) + '</div>' +
      '</div></div>';
  }).join('');
}
```

---

## Step 4: CSS for events

```css
.gem-event { display: flex; gap: 0.75rem; padding: 0.5rem; border-radius: 6px; margin-bottom: 0.5rem; background: rgba(255,255,255,0.03); }
.gem-event--active { border-left: 3px solid var(--gem-cyan); }
.gem-event__status { font-size: 0.65rem; font-weight: 700; color: var(--gem-cyan); min-width: 2rem; }
.gem-event--active .gem-event__status { color: #2ecc71; }
.gem-event__name { font-size: 0.85rem; font-weight: 600; }
.gem-event__desc { font-size: 0.7rem; color: var(--gem-text--muted); }
.gem-event__dates { font-size: 0.65rem; color: var(--gem-text--muted); }
```

---

## Files Modified: `index.html`, `script.js`, `styles.css`
