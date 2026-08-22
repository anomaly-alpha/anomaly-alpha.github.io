# Plan 149: Daily Missions Gem Calculator

**Gap:** Daily missions (daily quests) reward gems but aren't tracked. Missions vary each day but typically offer 5-15 gems per mission, with 3-5 missions per day.

**Goal:** Add a daily missions tracker with configurable completion state and recurring weekly gem estimate.

---

## Step 1: Add daily missions config

```json
"dailyMissions": {
  "missionsPerDay": 4,
  "gemsPerMission": 10,
  "bonusGems": 20,
  "bonusDescription": "Complete all 4 for bonus",
  "weeklyGems": 360
}
```

---

## Step 2: Add mission card

```html
<div class="gem-card gem-card--daily">
  <div class="gem-card__header">
    <span class="gem-label">Daily Missions</span>
    <span class="gem-card__value" id="daily-gems">0</span>
  </div>
  <div class="gem-card__body">
    <div id="daily-missions-list"></div>
    <label class="gem-text--muted text-xs flex items-center gap-2 mt-2">
      <input type="checkbox" id="daily-bonus" onchange="updateDailyMissions()">
      All 4 completed (+20 bonus)
    </label>
  </div>
</div>
```

---

## Step 3: Render missions

```js
function renderDailyMissions() {
  var list = document.getElementById('daily-missions-list');
  if (!list) return;

  var missions = GAME.dailyMissions;
  if (!missions) return;

  list.innerHTML = '';
  for (var i = 0; i < missions.missionsPerDay; i++) {
    var label = document.createElement('label');
    label.className = 'flex items-center gap-2 text-xs gem-text--muted py-1';
    label.innerHTML = '<input type="checkbox" data-mission="' + i + '" onchange="updateDailyMissions()">' +
      ' Mission ' + (i + 1) + ' (' + missions.gemsPerMission + ' gems)';
    list.appendChild(label);
  }
}

function updateDailyMissions() {
  var config = GAME.dailyMissions;
  if (!config) return;

  var checkboxes = document.querySelectorAll('[data-mission]');
  var completed = 0;
  checkboxes.forEach(function (cb) {
    if (cb.checked) completed++;
  });

  var bonus = document.getElementById('daily-bonus').checked ? config.bonusGems : 0;
  var total = (completed * config.gemsPerMission) + bonus;

  document.getElementById('daily-gems').textContent = total;
  REWARDS.categories.dailyMissions.total = total;
  updateAllPageTotals();
}
```

---

## Step 4: Add weekly projection

```js
// Below the daily card:
var weeklyProjection = total * 7;
// Show as "~2,520 gems/week if you complete all daily missions"
```

---

## Files Modified: `index.html`, `script.js`, `styles.css`
