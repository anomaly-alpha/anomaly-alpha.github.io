# Plan 50: Season Tracker

**Problem:** The game has seasonal content that affects rewards, but no tracker shows which season is active or when the next season starts.

**Goal:** Add a season tracker that estimates the current season number and days remaining.

---

## Step 1: Add season tracker HTML

```html
<!-- index.html -->
<div class="gem-season" id="gem-season">
  <div class="gem-season__info">
    <span class="gem-season__number">Season <span id="season-number">?</span></span>
    <span class="gem-season__days"><span id="season-days">?</span> days remaining</span>
  </div>
  <div class="gem-season__bar">
    <div class="gem-season__bar-fill" id="season-bar-fill"></div>
  </div>
</div>
```

## Step 2: Calculate season

```javascript
// script.js
function updateSeasonTracker() {
  // Estimate: Season 1 started ~Oct 2024, seasons are ~60 days
  var SEASON_START = new Date('2024-10-01');
  var SEASON_LENGTH = 60; // days

  var now = new Date();
  var daysSinceStart = Math.floor((now - SEASON_START) / (1000 * 60 * 60 * 24));
  var seasonNumber = Math.floor(daysSinceStart / SEASON_LENGTH) + 1;
  var daysIntoSeason = daysSinceStart % SEASON_LENGTH;
  var daysRemaining = SEASON_LENGTH - daysIntoSeason;
  var progress = (daysIntoSeason / SEASON_LENGTH) * 100;

  document.getElementById('season-number').textContent = seasonNumber;
  document.getElementById('season-days').textContent = daysRemaining;
  document.getElementById('season-bar-fill').style.width = progress + '%';
}
```

## Files Modified
- `index.html` — season tracker
- `script.js` — updateSeasonTracker function

## Verification
```bash
npm run build
# Should show estimated season number and days remaining
```
