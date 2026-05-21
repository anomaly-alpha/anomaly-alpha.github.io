# Plan 116: Broadcast Channel API

**Problem:** If the site is open in multiple tabs, changes in one tab (league selection, mode toggle) don't reflect in others. Users see stale data.

**Goal:** Use BroadcastChannel to sync state across tabs.

---

## Step 1: Create broadcast channel

```javascript
// script.js
var CHANNEL = new BroadcastChannel('gem-rewards-sync');

CHANNEL.onmessage = function(e) {
  var data = e.data;
  if (data.type === 'state-change') {
    // Apply changes from other tab
    if (data.modes) {
      selectedModes = data.modes;
      filterCards();
    }
    if (data.league) {
      setPvpLeague(data.cardId, data.league);
    }
    if (data.rank) {
      setPvpRank(data.cardId, data.rank);
    }
    updateAllPageTotals();
  }
};
```

## Step 2: Broadcast changes

```javascript
// script.js — in updatePvpCard, filterCards, etc.
function broadcastChange(changes) {
  CHANNEL.postMessage({ type: 'state-change', ...changes });
}

// In setPvpLeague
function setPvpLeague(cardId, league) {
  // ... existing logic
  broadcastChange({ cardId: cardId, league: league });
}
```

## Files Modified
- `script.js` — BroadcastChannel setup, broadcast calls

## Verification
```bash
npm run build
# Open site in two tabs
# Change league in Tab 1 — should update in Tab 2
```
