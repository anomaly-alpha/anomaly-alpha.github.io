# Unified Total Calculation Plan

## Goal
Unify all calculations of totals on the page. Each event has a payout, events belong to modes with a total for each mode, modes are able to be toggled on and off, all numbers on the page should reflect the total of the active modes.

---

## Data Structure

### Global eventsByMode Map

```javascript
const eventsByMode = {
    event: [
        { name: 'The Long Haul', gems: 300, seasonDays: 14 },
        { name: "Earth's Defenders", gems: 200, seasonDays: 7 }
    ],
    daily: [
        { gems: 30 }  // recurring daily payout
    ],
    weekly: [
        { gems: 60 }  // recurring weekly payout
    ],
    monthly: [
        { gems: 90 }  // recurring monthly payout
    ],
    code: [
        { name: 'Promo Code', gems: 300, active: true }
    ]
};
```

Note: PvP is calculated separately from 3 card selectors with league/rank.

---

## Current Issues to Solve

1. Mode totals are hardcoded in code - need to derive from data structure
2. Multiple places do similar calculations (calculateSelectedTotal, updateModeButtonTotals)
3. Main total and mode buttons use different code paths
4. Code duplication across functions
5. Weekly Reward and Daily Login cards have wrong values (400 and 700) - should be removed

---

## Implementation Steps

### Step 1: Create global eventsByMode data structure

Define `eventsByMode` map at top of script section (near other global data).
Use this for: getModeTotal(), chart data, JSON export.

### Step 2: Create unified mode calculation function (getModeTotal)

Add this function after getPvpPayout definition:

```javascript
function getModeTotal(mode) {
    const modeEvents = eventsByMode[mode];
    if (!modeEvents) return 0;

    if (mode === 'pvp') {
        // PvP calculated from 3 card selectors
        let total = 0;
        const defaults = { 1: { league: 'eliteI', rank: 50 }, 2: { league: 'eliteIII', rank: 50 }, 3: { league: 'eliteII', rank: 50 } };
        for (let i = 1; i <= 3; i++) {
            const leagueEl = document.getElementById(`pvp${i}-league`);
            const rankEl = document.getElementById(`pvp${i}-rank`);
            if (leagueEl && rankEl) {
                const league = leagueEl.value || defaults[i].league;
                const rank = parseInt(rankEl.value) || defaults[i].rank;
                const payout = getPvpPayout(league, rank);
                if (payout) total += payout.gems;
            }
        }
        return total;
    }

    // For other modes, sum gems from data structure
    return modeEvents.reduce((sum, event) => sum + (event.gems || 0), 0);
}
```

### Step 3: Create single function to update all totals (updateAllPageTotals)

```javascript
function updateAllPageTotals() {
    // 1. Update main counter (top section)
    const mainTotal = selectedModes.reduce((sum, mode) => sum + getModeTotal(mode), 0);
    const mainCounter = document.getElementById('totalCounter');
    if (mainCounter) animateValue('totalCounter', mainTotal, 400);

    // 2. Update mode button totals
    ['event', 'pvp', 'daily', 'weekly', 'monthly', 'code'].forEach(mode => {
        const btn = document.querySelector(`.filter-${mode}`);
        if (btn) {
            const totalEl = btn.querySelector('p.text-3xl.font-bold');
            if (totalEl) animateValue(totalEl, getModeTotal(mode), 400);
        }
    });

    // 3. Update All button
    const allBtn = document.querySelector('.filter-all');
    if (allBtn) {
        const allTotalEl = allBtn.querySelector('p.text-3xl.font-bold');
        if (allTotalEl) animateValue(allTotalEl, mainTotal, 400);
    }
}
```

### Step 4: Update call sites to use updateAllPageTotals

Replace calls to updateTotalGems() and updateModeButtonTotals():

1. **In updatePvpCard()** (line ~1798):
   - Change `updateTotalGems()` to `updateAllPageTotals()`

2. **In window.onload** (line ~1709):
   - Change `updateTotalGems()` to `updateAllPageTotals()`

3. **After initialization** (line ~1893-1894):
   - Change `updateModeButtonTotals()` and `updateTotalGems()` to `updateAllPageTotals()`

4. **In filterCards()** (line ~776-777):
   - Remove direct `calculateSelectedTotal()` and `animateValue()` calls
   - Add `updateAllPageTotals()` after mode selection logic

### Step 5: Clean up - Remove duplicate functions

After Step 4, these functions are no longer needed:
- updateTotalGems()
- updateModeButtonTotals()

### Step 6: Remove old cards with wrong values

- Remove Weekly Reward card (was showing 400, should be removed)
- Remove Daily Login card (was showing 700, should be removed)

### Step 7: Handle edge cases

- If event has gems: null or undefined, treat as 0
- If PvP card's league/rank select doesn't exist, use defaults
- If selectedModes is empty, return 0

### Step 8: Update chart data and JSON export to use eventsByMode

---

## Mode Totals Summary

| Mode    | Total Calculation                    |
|---------|--------------------------------------|
| Event   | Sum of event cards (300 + 200 = 500)|
| PvP     | Sum of 3 PvP card payouts (dynamic) |
| Daily   | 30 (recurring)                       |
| Weekly  | 60 (recurring)                       |
| Monthly | 90 (recurring)                       |
| Code    | From data structure (dropdown)       |

---

## Notes

- selectedModes array contains currently active modes (e.g., ['event', 'pvp', 'daily', 'weekly', 'monthly', 'code'])
- getModeTotal() calculates total for a specific mode from eventsByMode
- updateAllPageTotals() updates all 7 display locations:
  - Main counter (top)
  - Event mode button
  - PvP mode button
  - Daily mode button
  - Weekly mode button
  - Monthly mode button
  - Code mode button
  - All Modes button
- Use animateValue() for all value changes
- Use pvpDefaults (line ~1730) - no duplicate data
- Season (event duration) is a property on each event, not a mode
- Code mode supports multiple codes via dropdown selector