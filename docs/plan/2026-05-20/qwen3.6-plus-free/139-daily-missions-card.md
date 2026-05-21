# Plan 139: Daily Missions Card

**Problem:** Daily missions are a separate gem source not included in the calculator. Users who complete daily missions want to see the additional gem income.

**Goal:** Add an optional daily missions card.

---

## Step 1: Add daily missions card

```html
<!-- index.html — add to card grid -->
<div class="gem-card gem-card--event gem-card--fade-in" data-category="event" data-card="daily-missions">
  <div class="gem-card__body">
    <div class="gem-card__header">
      <span class="gem-label gem-label--event">Event</span>
    </div>
    <h3 class="gem-card__title">Daily Missions</h3>
    <div class="gem-card__formula">
      <span class="gem-icon--gem"></span>
      <span class="gem-counter" id="daily-missions-counter">100</span>
    </div>
    <p class="gem-card__desc">Complete daily operations</p>
    <label class="gem-card__toggle">
      <input type="checkbox" id="daily-missions-toggle" checked onchange="toggleDailyMissions()">
      <span class="gem-card__toggle-slider"></span>
    </label>
  </div>
</div>
```

## Step 2: Add toggle logic

```javascript
// script.js
var DAILY_MISSIONS_GEMS = 100;

function toggleDailyMissions() {
  var checked = document.getElementById('daily-missions-toggle').checked;
  var counter = document.getElementById('daily-missions-counter');
  animateValue(counter, parseInt(counter.textContent) || 0, checked ? DAILY_MISSIONS_GEMS : 0, 400);
  updateAllPageTotals();
}
```

## Files Modified
- `index.html` — daily missions card
- `script.js` — toggle function

## Verification
```bash
npm run build
# Toggle daily missions — total should change by 100
```
