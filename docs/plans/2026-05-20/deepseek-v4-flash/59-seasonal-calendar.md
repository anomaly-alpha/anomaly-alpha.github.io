# Plan 59: Seasonal Calendar

**Problem:** The game runs on seasonal cycles (e.g., "Season 4") but the calculator doesn't track seasons. Users can't see which season is active or when it ends.

**Goal:** Add season tracking with calendar, season pass countdown, and season-specific rewards info.

---

## Step 1: Add season data to config

```json
"season": {
  "current": 4,
  "name": "Season 4: Omega Rising",
  "startDate": "2026-05-01",
  "endDate": "2026-07-15",
  "passGems": 1480,
  "passCost": 999,
  "freeGems": 320
}
```

---

## Step 2: Season display

```html
<div class="gem-season">
  <h3 class="gem-text--cyan text-sm font-bold tracking-wider uppercase mb-1">
    <span id="season-name">Season 4: Omega Rising</span>
  </h3>
  <div class="flex justify-between text-xs gem-text--muted mb-1">
    <span>Started <span id="season-start">May 1</span></span>
    <span id="season-countdown" class="gem-text--cyan"></span>
  </div>
  <div class="gem-distribution__bar">
    <div class="gem-distribution__fill" id="season-progress" style="width:35%"></div>
  </div>
  <div class="flex justify-between text-xs mt-1">
    <span class="gem-text--muted">Free pass: <span class="gem-text--code" id="season-free-gems">320</span> gems</span>
    <span class="gem-text--muted">Premium: <span class="gem-text--pvp" id="season-premium-gems">1,480</span> gems</span>
  </div>
</div>
```

---

## Step 3: Season calculations

```js
function updateSeasonDisplay() {
  var season = GAME.season;
  if (!season) return;

  setText('season-name', season.name || '');
  setText('season-start', formatShortDate(season.startDate));
  setText('season-free-gems', (season.freeGems || 0).toLocaleString());
  setText('season-premium-gems', (season.passGems || 0).toLocaleString());

  var start = new Date(season.startDate);
  var end = new Date(season.endDate);
  var now = new Date();
  var total = end - start;
  var elapsed = now - start;
  var pct = Math.min(100, Math.max(0, (elapsed / total) * 100));
  var remaining = Math.max(0, Math.ceil((end - now) / 86400000));

  var progEl = document.getElementById('season-progress');
  if (progEl) progEl.style.width = pct + '%';

  setText('season-countdown', remaining + ' days remaining');
}
```

---

## Step 4: Add to total (optional)

If the user has purchased the premium pass, add those gems to the total:

```html
<label class="text-xs gem-text--muted mt-1 flex items-center gap-1">
  <input type="checkbox" id="season-pass-owned" onchange="toggleSeasonPass(this.checked)">
  I own the premium season pass
</label>
```

```js
function toggleSeasonPass(owned) {
  localStorage.setItem('gem_season_pass', owned ? 'true' : 'false');
  updateAllPageTotals();
}
```

---

## Files Modified: `index.html`, `script.js`, `styles.css`
