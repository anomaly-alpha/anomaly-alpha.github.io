# Fix Total Gems & Login Display

## Root Cause

The `eventsByMode` object in `gem_infographic.html` has incorrect values for login rewards, causing total to show 980 instead of expected ~1843.

## Changes Required

### 1. Update eventsByMode (JavaScript)

**File:** `gem_infographic.html`
**Location:** Lines 1703-1707

```javascript
// Change from:
login: [
    { name: 'Daily', gems: 30 },
    { name: 'Weekly', gems: 60 },
    { name: 'Monthly', gems: 90 }
],

// To:
login: [
    { name: 'Daily', gems: 210 },
    { name: 'Weekly', gems: 293 },
    { name: 'Monthly', gems: 90 }
],
```

### 2. Update Daily Login Card Display

**File:** `gem_infographic.html`
**Location:** ~line 460

- Change display from "30 GEMS" to "30×7 = 210 GEMS"

### 3. Update Monthly Login Card Display

**File:** `gem_infographic.html`
**Location:** ~line 500

- Change display from "90 GEMS" to "90÷4 = 23 GEMS"

## Expected Totals (Rounded)

| Category | Value |
|----------|-------|
| Event | 500 |
| Login | 293 |
| Code | 300 |
| PvP | 750 |
| Total | 1843 |