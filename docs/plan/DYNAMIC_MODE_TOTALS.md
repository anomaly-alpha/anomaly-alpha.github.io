# Dynamic Mode Totals Plan

## Issues Found

1. **Mode Selector Totals are HARDCODED** - HTML shows static values (Login: 180) instead of calculated from eventsByMode
2. **eventsByMode.login has wrong values** - stores (210, 293, 90) instead of individual rewards (210, 60, 90)
3. **No JavaScript updates mode selector** - totals never update dynamically

## Fix 1: Update eventsByMode.login

**File:** gem_infographic.html
**Location:** Lines 1703-1707

```javascript
// Change from:
login: [
    { name: 'Daily', gems: 210 },
    { name: 'Weekly', gems: 293 },
    { name: 'Monthly', gems: 90 }
],

// To:
login: [
    { name: 'Daily', gems: 210 },    // 30×7
    { name: 'Weekly', gems: 60 },    // just weekly reward
    { name: 'Monthly', gems: 90 }    // just monthly reward
],
```

## Fix 2: Update getModeTotal() for Login

**Location:** Around line 1737, add explicit calculation

```javascript
// Add explicit calculation for login mode:
if (mode === 'login') {
    const daily = modeEvents.find(e => e.name === 'Daily')?.gems || 0;
    const weekly = modeEvents.find(e => e.name === 'Weekly')?.gems || 0;
    const monthly = modeEvents.find(e => e.name === 'Monthly')?.gems || 0;
    return daily + weekly + Math.round(monthly / 4);
}
```

## Fix 3: Add updateModeSelectorTotals()

Add function after getModeTotal():

```javascript
function updateModeSelectorTotals() {
    const modes = ['event', 'pvp', 'login', 'code'];
    modes.forEach(mode => {
        const btn = document.querySelector(`.filter-${mode}`);
        if (btn) {
            const totalEl = btn.querySelector('.text-3xl');
            if (totalEl) {
                const total = getModeTotal(mode);
                totalEl.textContent = Math.round(total);
            }
        }
    });
}
```

## Fix 4: Call updateModeSelectorTotals()

Add calls in:
- `updateAllPageTotals()` function - add call at end
- `initializePvPCards()` - add call after card init
- `updatePvpCard()` - add call at end (for PvP changes)

## Fix 5: Fix PvP Card Percentage Calculation

**Location:** In updatePvpCard() function (around line 1818)

```javascript
// Change from:
const totalGems = 2550;
const percent = ((payout.gems / totalGems) * 100).toFixed(1);

// To:
const totalGems = getModeTotal('event') + getModeTotal('pvp') + getModeTotal('login') + getModeTotal('code');
const percent = ((payout.gems / totalGems) * 100).toFixed(1);
```

## Expected Results

| Mode | Display Value |
|------|---------------|
| All | 1,843 (500+293+300+750) |
| Event | 500 |
| PvP | 750 (dynamic) |
| Login | 293 |
| Code | 300 |