# PvP Total Fix Plan

## Issue
TOTAL GEMS OBTAINED shows 0 on page load - PvP total not included

## Root Cause
The PvP element value check is too strict: `if (leagueEl && rankEl && leagueEl.value && rankEl.value)`
This fails if elements exist but values aren't set yet, causing total to be 0

## Fix
Simplify the PvP element check to only verify element exists (not values):

### File: gem_infographic.html
### Location: Around line 1748

Change:
```javascript
if (leagueEl && rankEl && leagueEl.value && rankEl.value) {
```

To:
```javascript
if (leagueEl && rankEl) {
```

This way, if elements exist, the code uses their values OR falls back to defaults:
```javascript
const league = leagueEl.value || pvpDefaults[i].league;
const rank = parseInt(rankEl.value) || pvpDefaults[i].rank;
```

## Expected Results After Fix
- TOTAL GEMS OBTAINED: 980 + 1,326 = 2,306 (includes all 4 modes)
- Event mode button: 500
- PvP mode button: 1,326
- Login mode button: 180
- Code mode button: 300