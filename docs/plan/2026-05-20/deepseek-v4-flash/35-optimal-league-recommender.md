# Plan 35: Optimal League Recommender

**Problem:** New users don't know which league/rank offers the best value. The current UI shows payouts but doesn't suggest "you should aim for Senior I / rank 25 for the best gem-to-effort ratio."

**Goal:** Add a recommendation engine that analyzes the payout curves and suggests the top 3 leagues by efficiency (gems per rank position). Show a "recommended for you" badge on the PvP card.

---

## Step 1: Build the recommendation algorithm

```js
// ===== OPTIMAL LEAGUE RECOMMENDER =====

function calculateLeagueEfficiency(arena) {
  var payoutTable = GAME.pvp.arenas[arena];
  if (!payoutTable) return [];

  var scores = [];

  GAME.pvp.leagues.forEach(function (league, leagueIndex) {
    var payout = getPvpPayout(arena, leagueIndex, 1);
    var payoutAtHalf = getPvpPayout(arena, leagueIndex, Math.ceil(league.capacity / 2));
    var payoutAtEnd = getPvpPayout(arena, leagueIndex, league.capacity);

    // Efficiency: gem drop-off from rank 1 to midpoint
    // Higher = better retention of value as rank decreases
    var dropoff = payout.gems - payoutAtHalf.gems;
    var efficiency = payout.gems > 0 ? (payoutAtHalf.gems / payout.gems) : 0;

    scores.push({
      league: league.name,
      leagueIndex: leagueIndex,
      maxGems: payout.gems,
      midGems: payoutAtHalf.gems,
      minGems: payoutAtEnd.gems,
      efficiency: Math.round(efficiency * 100),
      playerCount: league.capacity
    });
  });

  // Sort by efficiency (best value retention first)
  scores.sort(function (a, b) { return b.efficiency - a.efficiency; });

  return scores.slice(0, 3);
}
```

---

## Step 2: Display recommendations

```js
function renderRecommendations() {
  var container = document.getElementById('pvp-recommendations');
  if (!container) return;

  var restricted = calculateLeagueEfficiency('restricted');

  container.innerHTML = [
    '<h4 class="gem-text--cyan text-xs font-bold uppercase tracking-wider mb-2">Recommended Leagues</h4>',
    '<div class="space-y-1">',
    restricted.map(function (r, i) {
      var medal = ['🥇', '🥈', '🥉'][i] || '';
      return '<div class="flex justify-between items-center text-xs p-1 ' +
        (i === 0 ? 'gem-card--pvp' : '') + ' rounded px-2">' +
        '<span>' + medal + ' ' + r.league + '</span>' +
        '<span class="gem-text--cyan">' + r.efficiency + '% retention</span>' +
        '</div>';
    }).join(''),
    '</div>'
  ].join('');
}
```

---

## Step 3: Add recommendation container

**In `index.html`** (near PvP cards):

```html
<div id="pvp-recommendations" class="gem-section mt-4"></div>
```

---

## Step 4: Add "Recommended for You" badge

When the user's selected league matches a top recommendation:

```js
function highlightRecommendedLeague(cardId) {
  var leagueEl = document.getElementById(cardId + '-league');
  if (!leagueEl) return;

  var arena = getArenaFromCardId(cardId);
  var topLeagues = calculateLeagueEfficiency(arena);
  var currentLeague = parseInt(leagueEl.value);

  var isRecommended = topLeagues.some(function (r) {
    return r.leagueIndex === currentLeague;
  });

  var badge = document.getElementById(cardId + '-recommended-badge');
  if (badge) {
    badge.style.display = isRecommended ? 'inline' : 'none';
  }
}
```

Add badge HTML inside each PvP card:
```html
<span id="pvp1-recommended-badge" class="gem-badge--recommended" style="display:none">★ Recommended</span>
```

---

## Step 5: CSS for badge

```css
.gem-badge--recommended {
  font-size: 0.65rem;
  background: rgba(0, 229, 255, 0.2);
  color: var(--gem-cyan);
  padding: 0.15rem 0.4rem;
  border-radius: 3px;
  border: 1px solid rgba(0, 229, 255, 0.3);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-left: 0.25rem;
}
```

---

## Step 6: Trigger on load and league change

```js
// In initializePvPCards():
renderRecommendations();

// In updatePvpCard():
highlightRecommendedLeague('pvp1');
highlightRecommendedLeague('pvp2');
highlightRecommendedLeague('pvp3');
```

---

## Files Modified

| File | Change |
|------|--------|
| `index.html` | Add recommendations container + badges |
| `script.js` | Add `calculateLeagueEfficiency()`, `renderRecommendations()`, `highlightRecommendedLeague()` |
| `styles.css` | Add `.gem-badge--recommended` |

---

## Verification

```bash
# Open index.html
# Check recommendations section — top 3 leagues by efficiency
# Select a top-recommended league — "★ Recommended" badge appears
# Select a non-recommended league — badge disappears
# Verify efficiency makes sense (e.g., Elite II should be top because of player count vs payout)
```
