# Plan 126: Broadcast Channel for Cross-Tab Sync

**Gap:** If a user opens the calculator in two tabs and changes PvP settings in one, the other tab shows stale data. There's no cross-tab synchronization.

**Best practice (MDN):** Use `BroadcastChannel` to communicate state changes between tabs. When state changes in one tab, broadcast it to all others.

---

## Step 1: Create broadcast channel

```js
var syncChannel = new BroadcastChannel('gem-sync');

// Listen for updates from other tabs
syncChannel.addEventListener('message', function (e) {
  var data = e.data;
  if (data.type === 'pvp-update') {
    // Apply PvP state from another tab
    setPvpSelector('pvp1', data.pvp1.league, data.pvp1.rank);
    setPvpSelector('pvp2', data.pvp2.league, data.pvp2.rank);
    setPvpSelector('pvp3', data.pvp3.league, data.pvp3.rank);
  }
});
```

---

## Step 2: Broadcast on PvP change

```js
function updatePvpCard(id) {
  // ... existing update logic ...

  // Broadcast to other tabs
  syncChannel.postMessage({
    type: 'pvp-update',
    pvp1: { league: getSelectValue('pvp1-league'), rank: getSelectValue('pvp1-rank') },
    pvp2: { league: getSelectValue('pvp2-league'), rank: getSelectValue('pvp2-rank') },
    pvp3: { league: getSelectValue('pvp3-league'), rank: getSelectValue('pvp3-rank') }
  });
}
```

---

## Step 3: Broadcast theme changes

```js
function toggleTheme() {
  // ... existing toggle logic ...
  syncChannel.postMessage({ type: 'theme-update', mode: isLight ? 'light' : 'dark' });
}
```

---

## Step 4: Handle tab close gracefully

```js
// No cleanup needed — BroadcastChannel auto-disconnects when page unloads
```

---

## Step 5: Test

```bash
# Open two tabs side by side
# Change PvP league in tab 1
# Tab 2 updates within milliseconds
```

---

## Files Modified: `script.js`
