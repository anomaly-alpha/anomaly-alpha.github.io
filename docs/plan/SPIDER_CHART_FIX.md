# Spider Chart Fix Plan

## Problem
Spider chart has 5 labels with 7 data values, and login value doesn't match page totals.

## Root Causes
1. `chartFilterData` (line 72): hardcoded `spider: { a:[0,500,750,180,300], t:[0,800,1000,300,500] }` — 5 elements but "Season" label still exists
2. Init (line 1050): `data: [0,500,750,30,60,90,300]` — 7 values for 5 labels
3. `buildModeData` (line 140): `sp[0] = d.slice(1)` — only 4 values but chart expects 5
4. Login value 180 vs actual 293 (210+60+round(90/4))
5. Target values hardcoded, not derived from actual

## Fix Steps

### Step 1: Update Spider Chart Labels (line 1047)
Change from:
```js
labels: ['Season', 'Events', 'PvP', 'Login', 'Code'],
```
To:
```js
labels: ['Events', 'PvP', 'Login', 'Code'],
```

### Step 2: Fix chartFilterData Spider Data (line 72)
Change from:
```js
spider: { a:[0,500,750,180,300], t:[0,800,1000,300,500] },
```
To (4 values each):
```js
spider: { a:[500,750,293,300], t:[550,1500,360,330] },
```
- Actual: 500 (event) + 750 (pvp) + 293 (login) + 300 (code)
- Target: per-category max with 10% bump for maxed categories (550, 1500, 360, 330)

### Step 3: Fix Spider Chart Init Data (line 1050)
Change from:
```js
data: [0, 500, 750, 30, 60, 90, 300],
```
To:
```js
data: [500, 750, 293, 300],
```

Change from:
```js
data: [2000, 800, 1000, 50, 100, 150, 500],
```
To:
```js
data: [550, 1500, 360, 330],
```

### Step 4: Fix buildModeData Spider (lines 140-152)
Change all `sp[0]` and `sp[1]` arrays to 4 elements (drop Season slot):

```js
// Line 140 - all mode
sp[0] = d.slice(1); // already 4 elements
sp[1] = [550, 1500, 360, 330];

// Line 143 - event mode
sp[0] = [d[1], 0, 0, 0]; // [500,0,0,0]
sp[1] = [550, 0, 0, 0];

// Line 146 - pvp mode
sp[0] = [0, d[2], 0, 0]; // [0,750,0,0]
sp[1] = [0, 1500, 0, 0];

// Line 149 - login mode
sp[0] = [0, 0, d[3], 0]; // [0,0,293,0]
sp[1] = [0, 0, 360, 0];

// Line 152 - code mode
sp[0] = [0, 0, 0, d[4]]; // [0,0,0,300]
sp[1] = [0, 0, 0, 330];
```

### Step 5: Update Spider Chart Update Functions

#### filterChart (lines 496-545)
Spider update at lines 547-549:
```js
spiderChart.data.datasets[0].data = data.spider[0]; // already 4
spiderChart.data.datasets[1].data = data.spider[1]; // already 4
```

#### updateChartsByModes (line 490)
Change from:
```js
const spiderData = [combinedData.distribution.slice(1), [800, 1000, 1200, 500]];
```
To:
```js
const spiderData = [combinedData.distribution.slice(1), [550, 1500, 360, 330]];
```

### Step 6: Verify No Other Spider References
Grep search found all 15 spider references — reviewed above.

## Target Values Rationale
| Category | Actual | Target | Rationale |
|----------|--------|--------|-----------|
| Events | 500 | 550 | 10% bump since already at max (500) |
| PvP | 750 | 1500 | Full potential based on max league/rank payout |
| Login | 293 | 360 | Full monthly cycle (210+60+90) |
| Code | 300 | 330 | 10% bump since already at max (300) |

Targets represent achievable stretch goals + per-category max potential.

## Files to Modify
- `script.js`: lines 72, 140, 143, 146, 149, 152, 490, 496-545, 1047, 1050, 1057

## Verification
After fix, spider chart should show:
- 4 axes: Events, PvP, Login, Code
- Gems dataset: actual values matching page totals
- Target dataset: 1.5× actual values
- No mismatch between labels count and data array length