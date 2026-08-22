# Plan 46: Event Calendar Widget

**Problem:** Users don't know when events like "Cecil's Nightmares" or "Multiverse Arena" start/end. The countdown config has event offsets but no visual calendar display.

**Goal:** Add a mini calendar widget showing upcoming event windows based on countdown config.

---

## Step 1: Add calendar widget HTML

```html
<!-- index.html -->
<div class="gem-calendar" id="gem-calendar">
  <h3 class="gem-calendar__title">Upcoming Events</h3>
  <div class="gem-calendar__events" id="calendar-events"></div>
</div>
```

## Step 2: Build event calendar

```javascript
// script.js
function buildEventCalendar() {
  var container = document.getElementById('calendar-events');
  if (!container) return;

  var events = COUNTDOWN.events;
  var now = new Date();
  var html = '';

  Object.keys(events).forEach(function(key) {
    var event = events[key];
    var eventDate = new Date(now);
    eventDate.setDate(eventDate.getDate() + event.daysOffset);

    html += '<div class="gem-calendar__event">' +
      '<span class="gem-calendar__event-name">' + formatEventName(key) + '</span>' +
      '<span class="gem-calendar__event-date">' + eventDate.toLocaleDateString() + '</span>' +
      '<span class="gem-calendar__event-countdown">' + getDaysUntil(eventDate) + ' days</span>' +
      '</div>';
  });

  container.innerHTML = html;
}

function formatEventName(key) {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, function(s) { return s.toUpperCase(); });
}

function getDaysUntil(date) {
  var diff = date - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
```

## Files Modified
- `index.html` — calendar widget
- `script.js` — calendar logic

## Verification
```bash
npm run build
# Calendar should show events with dates and countdown
```
