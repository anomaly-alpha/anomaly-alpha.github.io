# Plan 49: PvP Heatmap by Rank

**Problem:** Users can't visualize how gem rewards change across the 120 rank range. A heatmap would show the reward gradient at a glance.

**Goal:** Add a rank heatmap showing gem payouts from rank 1 to 120 for the selected league.

---

## Step 1: Add heatmap HTML

```html
<!-- index.html -->
<div class="gem-heatmap" id="pvp-heatmap">
  <h3 class="gem-heatmap__title">Reward Heatmap — <span id="heatmap-league">Elite II</span></h3>
  <div class="gem-heatmap__grid" id="heatmap-grid"></div>
  <div class="gem-heatmap__legend">
    <span>Low</span>
    <div class="gem-heatmap__legend-bar"></div>
    <span>High</span>
  </div>
</div>
```

## Step 2: Build heatmap

```javascript
// script.js
function buildHeatmap() {
  var grid = document.getElementById('heatmap-grid');
  if (!grid) return;

  var league = getSelectedLeague();
  var payouts = [];
  var maxGems = 0;

  for (var rank = 1; rank <= 120; rank++) {
    var payout = getPvpPayout('restricted', league, rank);
    var gems = payout ? payout.gems : 0;
    payouts.push(gems);
    if (gems > maxGems) maxGems = gems;
  }

  document.getElementById('heatmap-league').textContent = league;

  grid.innerHTML = payouts.map(function(gems, i) {
    var intensity = gems / maxGems;
    var hue = 340 - (intensity * 340); // Pink to cyan
    return '<div class="gem-heatmap__cell" style="background:hsl(' + hue + ',80%,' + (20 + intensity * 40) + '%)" title="Rank ' + (i + 1) + ': ' + gems + ' gems">' + (i + 1) + '</div>';
  }).join('');
}
```

## Files Modified
- `index.html` — heatmap HTML
- `script.js` — buildHeatmap function
- `styles.css` — heatmap grid styles

## Verification
```bash
npm run build
# Heatmap should show 120 cells with color gradient
# Change league — heatmap should update
```
