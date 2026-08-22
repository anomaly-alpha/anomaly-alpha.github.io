# Plan 56: Compare with Average Player

**Problem:** Users see their own gem total but have no reference point. Is 4,043 gems/week good? Average? Below average?

**Goal:** Add a comparison showing how the user's total compares to the estimated average player (based on median league/rank).

---

## Step 1: Define average/median baseline

```js
var AVERAGE_PLAYER = {
  restricted: { league: 7, rank: 50 },  // Senior I / rank 50
  open: { league: 6, rank: 60 },        // Intermediate III / rank 60
  multiverse: { league: 2, rank: 50 },  // Junior III / rank 50
};

function getAveragePlayerTotal() {
  var total = 0;
  total += getPvpPayout('restricted', AVERAGE_PLAYER.restricted.league, AVERAGE_PLAYER.restricted.rank).gems || 0;
  total += getPvpPayout('open', AVERAGE_PLAYER.open.league, AVERAGE_PLAYER.open.rank).gems || 0;
  total += getPvpPayout('multiverse', AVERAGE_PLAYER.multiverse.league, AVERAGE_PLAYER.multiverse.rank).gems || 0;
  total += 500; // events
  total += 1393; // login
  total += 300; // codes
  return total;
}
```

---

## Step 2: Comparison display

```html
<div class="gem-comparison text-xs mt-2">
  <span class="gem-text--muted">Your total: </span>
  <span class="gem-text--cyan font-bold" id="comparison-user">0</span>
  <span class="gem-text--muted"> vs avg player: </span>
  <span class="gem-text--secondary font-bold" id="comparison-avg">0</span>
  <span id="comparison-diff" class="font-bold"></span>
</div>
```

---

## Step 3: Comparison JS

```js
function updateComparison() {
  var userTotal = getCurrentTotal();
  var avgTotal = getAveragePlayerTotal();
  var diff = userTotal - avgTotal;
  var pct = avgTotal > 0 ? Math.round((diff / avgTotal) * 100) : 0;

  document.getElementById('comparison-user').textContent = userTotal.toLocaleString();
  document.getElementById('comparison-avg').textContent = avgTotal.toLocaleString();

  var diffEl = document.getElementById('comparison-diff');
  if (diff > 0) {
    diffEl.textContent = '(+' + pct + '% above average)';
    diffEl.className = 'font-bold gem-text--code';
  } else if (diff < 0) {
    diffEl.textContent = '(' + pct + '% below average)';
    diffEl.className = 'font-bold gem-text--event';
  } else {
    diffEl.textContent = '(exactly average)';
    diffEl.className = 'font-bold gem-text--muted';
  }
}
```

Call from `updateAllPageTotals()`.

---

## Step 4: Add percentile estimate

```js
function estimatePercentile(userTotal, avgTotal) {
  if (userTotal > avgTotal * 1.5) return 'Top 10%';
  if (userTotal > avgTotal * 1.25) return 'Top 25%';
  if (userTotal > avgTotal * 0.9) return 'Above Average';
  if (userTotal > avgTotal * 0.75) return 'Average';
  return 'Below Average';
}
```

Display in the comparison section: `"You're in the Top 25% of players"`

---

## Files Modified: `index.html`, `script.js`, `styles.css`
