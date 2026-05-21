# Plan 47: League Comparison Mode

**Problem:** Users want to see "what's the difference between Elite I and Elite II?" but must manually switch leagues and compare numbers from memory.

**Goal:** Add a comparison mode that shows two league payouts side by side with a diff column.

---

## Step 1: Add comparison mode UI

```html
<!-- index.html -->
<div class="gem-league-compare" id="league-compare">
  <select id="compare-league-a"></select>
  <span class="gem-text--muted">vs</span>
  <select id="compare-league-b"></select>
  <button onclick="compareLeagues()">Compare</button>
  <div class="gem-league-compare__result" id="compare-result"></div>
</div>
```

## Step 2: Add comparison logic

```javascript
// script.js
function compareLeagues() {
  var leagueA = document.getElementById('compare-league-a').value;
  var leagueB = document.getElementById('compare-league-b').value;
  var result = document.getElementById('compare-result');
  if (!leagueA || !leagueB) return;

  var rank = 13; // Default comparison rank
  var aRestricted = getPvpPayout('restricted', leagueA, rank);
  var bRestricted = getPvpPayout('restricted', leagueB, rank);
  var aOpen = getPvpPayout('open', leagueA, rank);
  var bOpen = getPvpPayout('open', leagueB, rank);

  var aTotal = aRestricted.gems + aOpen.gems;
  var bTotal = bRestricted.gems + bOpen.gems;
  var diff = bTotal - aTotal;

  result.innerHTML = '<div class="gem-league-compare__row">' +
    '<span>' + leagueA + ': ' + aTotal + ' gems</span>' +
    '<span>' + leagueB + ': ' + bTotal + ' gems</span>' +
    '<span class="' + (diff > 0 ? 'gem-text--event' : diff < 0 ? 'gem-text--code' : '') + '">' +
    (diff > 0 ? '+' : '') + diff + ' difference</span>' +
    '</div>';
}
```

## Files Modified
- `index.html` — comparison UI
- `script.js` — comparison logic

## Verification
```bash
npm run build
# Select two leagues, click Compare
# Should show gem totals and difference
```
