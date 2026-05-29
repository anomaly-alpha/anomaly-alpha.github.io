# Plan 57: PvP Rank Distribution Visualization

**Problem:** Users see their league/rank but don't know where most other players sit. Is rank 13 in Elite II good? How many players are above/below?

**Goal:** Add a distribution bar showing what percentile the user's rank falls in, based on league capacity data.

---

## Step 1: Calculate percentile from league data

```js
function getRankPercentile(cardId) {
  var leagueEl = document.getElementById(cardId + '-league');
  var rankEl = document.getElementById(cardId + '-rank');
  if (!leagueEl || !rankEl) return null;

  var leagueIdx = parseInt(leagueEl.value);
  var rank = parseInt(rankEl.value);
  var league = GAME.pvp.leagues[leagueIdx];
  if (!league) return null;

  var totalPlayers = league.capacity || 500;
  var playersAbove = rank - 1;
  var percentile = ((totalPlayers - playersAbove) / totalPlayers) * 100;

  return {
    rank: rank,
    totalPlayers: totalPlayers,
    playersAbove: playersAbove,
    percentile: Math.round(percentile),
    label: getPercentileLabel(percentile)
  };
}

function getPercentileLabel(pct) {
  if (pct >= 99) return 'Top 1%';
  if (pct >= 95) return 'Top 5%';
  if (pct >= 90) return 'Top 10%';
  if (pct >= 75) return 'Top 25%';
  if (pct >= 50) return 'Top 50%';
  return 'Bottom 50%';
}
```

---

## Step 2: Distribution bar HTML

```html
<div class="gem-distribution" id="dist-pvp1">
  <div class="flex justify-between text-xs gem-text--muted mb-1">
    <span>Rank 120</span>
    <span class="gem-text--cyan font-bold" id="dist-pvp1-label">Top 50%</span>
    <span>Rank 1</span>
  </div>
  <div class="gem-distribution__bar">
    <div class="gem-distribution__fill" id="dist-pvp1-fill" style="width:50%"></div>
    <div class="gem-distribution__marker" id="dist-pvp1-marker" style="left:50%">▼</div>
  </div>
</div>
```

---

## Step 3: Update distribution

```js
function updateDistributions() {
  ['pvp1', 'pvp2', 'pvp3'].forEach(function (id) {
    var data = getRankPercentile(id);
    if (!data) return;
    var fillEl = document.getElementById('dist-' + id + '-fill');
    var labelEl = document.getElementById('dist-' + id + '-label');
    var markerEl = document.getElementById('dist-' + id + '-marker');
    if (fillEl) fillEl.style.width = data.percentile + '%';
    if (markerEl) markerEl.style.left = data.percentile + '%';
    if (labelEl) labelEl.textContent = data.label;
  });
}
```

---

## Step 4: Distribution bar CSS

```css
.gem-distribution__bar {
  height: 8px;
  background: linear-gradient(90deg, rgba(233,30,138,0.1), rgba(0,229,255,0.3));
  border-radius: 4px;
  position: relative;
  overflow: visible;
}
.gem-distribution__fill {
  height: 100%;
  background: linear-gradient(90deg, var(--gem-pvp), var(--gem-cyan));
  border-radius: 4px;
  transition: width 0.4s ease;
}
.gem-distribution__marker {
  position: absolute;
  top: -8px;
  font-size: 0.6rem;
  color: var(--gem-cyan);
  transform: translateX(-50%);
  transition: left 0.4s ease;
}
```

---

## Files Modified: `index.html`, `script.js`, `styles.css`
