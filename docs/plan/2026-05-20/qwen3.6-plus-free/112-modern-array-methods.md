# Plan 112: Modern Array Methods

**Problem:** `script.js` uses `forEach` and `filter` but could benefit from newer array methods like `findLast`, `toSorted`, `toReversed`, and `with` for cleaner code.

**Goal:** Replace older patterns with modern array methods where applicable.

---

## Step 1: Use findLast for payout lookup

```javascript
// Before
function getPvpPayout(arena, leagueId, rank) {
  var table = GAME.pvp.arenas[arena][leagueId];
  var result = null;
  table.forEach(function(row) {
    if (rank >= row.rankStart && rank <= row.rankEnd) result = row;
  });
  return result;
}

// After
function getPvpPayout(arena, leagueId, rank) {
  var table = GAME.pvp.arenas[arena][leagueId];
  return table.find(function(row) {
    return rank >= row.rankStart && rank <= row.rankEnd;
  }) || null;
}
```

## Step 2: Use toSorted for league comparison

```javascript
// Before
var sorted = leagues.slice().sort(function(a, b) { return a.name.localeCompare(b.name); });

// After
var sorted = leagues.toSorted(function(a, b) { return a.name.localeCompare(b.name); });
```

## Step 3: Use toReversed for history list

```javascript
// Before
var history = JSON.parse(localStorage.getItem('gem_history') || '[]').slice().reverse();

// After
var history = JSON.parse(localStorage.getItem('gem_history') || '[]').toReversed();
```

## Files Modified
- `script.js` — modern array methods

## Verification
```bash
npm run build
# All functionality should be identical
# Chrome 119+, Firefox 121+, Safari 17.4+ for newest methods
```
