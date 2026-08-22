# Plan 25: PvP Quick Compare — This Rank vs. Next Rank

**Problem:** PvP players often wonder "what if I rank up one step?" The current calculator shows one payout at a time. Users wanting to compare "rank 13 vs rank 12" must manually change the selector and remember the difference.

**Goal:** Add a "Compare Next Rank" button for each PvP card that shows the payout difference if you improve by one rank.

---

## Step 1: Add compare button to each PvP card

**In `index.html`**, inside each PvP card (restricted, open, alliance war), add:

```html
<button class="gem-btn--compare"
        data-card-id="restricted-arena"
        onclick="showRankCompare('pvp1')">
  Compare next rank ↑
</button>
```

Repeat for `pvp2` and `pvp3` cards with appropriate card IDs.

---

## Step 2: CSS for compare button

```css
.gem-btn--compare {
  font-size: 0.75rem;
  padding: 0.25rem 0.75rem;
  background: rgba(0, 229, 255, 0.1);
  border: 1px solid rgba(0, 229, 255, 0.2);
  color: var(--gem-cyan);
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.2s;
  white-space: nowrap;
}
.gem-btn--compare:hover {
  background: rgba(0, 229, 255, 0.2);
}
```

---

## Step 3: JS comparison logic

```js
// ===== PVP QUICK COMPARE =====

function showRankCompare(cardId) {
  var leagueEl = document.getElementById(cardId + '-league');
  var rankEl = document.getElementById(cardId + '-rank');
  if (!leagueEl || !rankEl) return;

  var arena = getArenaFromCardId(cardId);
  var league = parseInt(leagueEl.value);
  var currentRank = parseInt(rankEl.value);
  var nextRank = Math.max(1, currentRank - 1); // lower number = better rank

  var currentPayout = getPvpPayout(arena, league, currentRank);
  var nextPayout = getPvpPayout(arena, league, nextRank);

  if (!currentPayout || !nextPayout) return;

  var diff = {
    gems: nextPayout.gems - currentPayout.gems,
    currency: (nextPayout.currency || 0) - (currentPayout.currency || 0),
    tickets: (nextPayout.tickets || 0) - (currentPayout.tickets || 0),
  };

  showCompareModal(cardId, currentRank, nextRank, currentPayout, nextPayout, diff);
}

function getArenaFromCardId(cardId) {
  switch (cardId) {
    case 'pvp1': return 'restricted';
    case 'pvp2': return 'open';
    case 'pvp3': return 'multiverse';
    default: return 'restricted';
  }
}
```

---

## Step 4: Comparison display modal

```js
function showCompareModal(cardId, currentRank, nextRank, current, next, diff) {
  var existing = document.getElementById('compare-modal');
  if (existing) existing.remove();

  var overlay = document.createElement('div');
  overlay.id = 'compare-modal';
  overlay.className = 'gem-modal__overlay';
  overlay.style.cssText = 'display:flex;align-items:center;justify-content:center;z-index:10000;';

  overlay.innerHTML = [
    '<div class="gem-modal__content" style="max-width:450px;padding:1.5rem;">',
    '<div class="gem-modal__header"><h2 class="gem-text--cyan text-lg font-bold">Rank Comparison</h2>',
    '<button onclick="document.getElementById(\'compare-modal\').remove()" class="gem-modal__close">&times;</button></div>',
    '<div class="gem-modal__body" style="margin-top:1rem">',
    '<table style="width:100%;border-collapse:collapse;text-align:center">',
    '<tr><th></th><th class="gem-text--muted p-2">Rank ' + currentRank + '</th>',
    '<th class="gem-text--cyan p-2">Rank ' + nextRank + '</th>',
    '<th class="gem-text--code p-2">Diff</th></tr>',
    '<tr><td class="gem-text--muted p-2 text-left">Gems</td>',
    '<td class="p-2">' + current.gems + '</td>',
    '<td class="p-2">' + next.gems + '</td>',
    '<td class="p-2 gem-text--' + (diff.gems > 0 ? 'code' : 'muted') + '">' + (diff.gems > 0 ? '+' : '') + diff.gems + '</td></tr>',
    '<tr><td class="gem-text--muted p-2 text-left">Currency</td>',
    '<td class="p-2">' + (current.currency || 0) + '</td>',
    '<td class="p-2">' + (next.currency || 0) + '</td>',
    '<td class="p-2 gem-text--' + (diff.currency > 0 ? 'code' : 'muted') + '">' + (diff.currency > 0 ? '+' : '') + diff.currency + '</td></tr>',
    diff.tickets !== undefined ? '<tr><td class="gem-text--muted p-2 text-left">Tickets</td><td class="p-2">' + (current.tickets || 0) + '</td><td class="p-2">' + (next.tickets || 0) + '</td><td class="p-2 gem-text--' + (diff.tickets > 0 ? 'code' : 'muted') + '">' + (diff.tickets > 0 ? '+' : '') + diff.tickets + '</td></tr>' : '',
    '</table>',
    '<p class="gem-text--muted text-xs mt-4 text-center">Lower rank number = better position</p>',
    '</div></div>'
  ].join('');

  document.body.appendChild(overlay);
  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) overlay.remove();
  });
}
```

---

## Step 5: Extra — compare "current vs demotion safe zone"

For Alliance War (`pvp3`), add a second button:

```html
<button class="gem-btn--compare"
        onclick="showDemotionCompare()">
  Demotion check ↓
</button>
```

This shows current payout vs. payout if you drop to rank 86 (demotion threshold).

---

## Files Modified

| File | Change |
|------|--------|
| `index.html` | Add compare buttons to PvP cards |
| `script.js` | Add `showRankCompare()`, `getArenaFromCardId()`, `showCompareModal()`, `showDemotionCompare()` |
| `styles.css` | Add `.gem-btn--compare` styles |

---

## Verification

```bash
# Open index.html
# Set PvP1 to Elite II, rank 13
# Click "Compare next rank ↑"
# Modal shows rank 13 vs rank 12 with gem/currency/ticket differences
# Close modal (click overlay or X)

# Test Alliance War demotion check:
# Set rank to 90
# Click "Demotion check ↓"
# Verify warning about demotion zone
```
