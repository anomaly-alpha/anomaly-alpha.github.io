# Plan 22: PvP League Comparison Table

**Problem:** Users cannot easily compare payouts across leagues. To see the difference between Elite I and Elite II, they must manually change the league selector and note the values. No side-by-side comparison exists.

**Goal:** Add a comparison table showing gem payouts for all 14 leagues at a fixed rank, making it easy to see the progression.

---

## Step 1: Add comparison table HTML

```html
<!-- index.html — add after PvP cards, before charts -->
<div class="gem-pvp-comparison" id="pvp-comparison">
  <h3 class="gem-pvp-comparison__title">League Comparison <span class="gem-text--muted">(Rank 13)</span></h3>
  <div class="gem-pvp-comparison__table-wrapper">
    <table class="gem-pvp-comparison__table">
      <thead>
        <tr>
          <th>League</th>
          <th>Restricted</th>
          <th>Open</th>
          <th>Alliance War</th>
          <th>Total</th>
        </tr>
      </thead>
      <tbody id="pvp-comparison-body"></tbody>
    </table>
  </div>
</div>
```

## Step 2: Build comparison data

```javascript
// script.js — add function
function buildPvpComparison() {
  var tbody = document.getElementById('pvp-comparison-body');
  if (!tbody) return;

  var rank = 13;
  var html = '';

  GAME.pvp.leagues.forEach(function(league) {
    var restricted = getPvpPayout('restricted', league.id, rank);
    var open = getPvpPayout('open', league.id, rank);
    var mvGroup = GAME.pvp.multiverseLeagueMap[league.id];
    var multiverse = mvGroup ? getPvpPayout('multiverse', mvGroup, rank) : null;

    var total = (restricted ? restricted.gems : 0) +
                (open ? open.gems : 0) +
                (multiverse ? multiverse.gems : 0);

    html += '<tr>' +
      '<td>' + league.name + '</td>' +
      '<td>' + (restricted ? restricted.gems : '—') + '</td>' +
      '<td>' + (open ? open.gems : '—') + '</td>' +
      '<td>' + (multiverse ? multiverse.gems : '—') + '</td>' +
      '<td class="gem-pvp-comparison__total">' + total + '</td>' +
      '</tr>';
  });

  tbody.innerHTML = html;
}
```

## Step 3: Add CSS

```css
.gem-pvp-comparison {
  margin: 2rem 0;
}
.gem-pvp-comparison__table-wrapper {
  overflow-x: auto;
}
.gem-pvp-comparison__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
}
.gem-pvp-comparison__table th,
.gem-pvp-comparison__table td {
  padding: 0.5rem 0.75rem;
  text-align: center;
  border-bottom: 1px solid var(--gem-border--subtle);
}
.gem-pvp-comparison__table th {
  color: var(--gem-cyan);
  font-weight: 600;
}
.gem-pvp-comparison__total {
  color: var(--gem-pvp);
  font-weight: 700;
}
```

## Files Modified
- `index.html` — comparison table HTML
- `script.js` — buildPvpComparison function
- `styles.css` — comparison table styles

## Verification
```bash
npm run build
# Scroll to PvP section — comparison table should show all 14 leagues
```
