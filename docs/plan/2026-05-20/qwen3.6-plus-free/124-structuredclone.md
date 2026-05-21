# Plan 124: structuredClone Usage

**Problem:** Deep cloning objects uses `JSON.parse(JSON.stringify(obj))` which loses functions, Dates, and handles `undefined` poorly. `structuredClone` is the modern standard.

**Goal:** Replace JSON clone pattern with structuredClone.

---

## Step 1: Find JSON clone usage

```bash
grep -n 'JSON.parse(JSON.stringify' script.js
```

## Step 2: Replace with structuredClone

```javascript
// Before
var copy = JSON.parse(JSON.stringify(original));

// After
var copy = structuredClone(original);
```

## Step 3: Add fallback for older browsers

```javascript
// script.js — add at top
var deepClone = typeof structuredClone === 'function'
  ? structuredClone
  : function(obj) { return JSON.parse(JSON.stringify(obj)); };

// Use deepClone() throughout
var copy = deepClone(original);
```

## Files Modified
- `script.js` — structuredClone with fallback

## Verification
```bash
npm run build
# Clone operations should work correctly
# Dates, Maps, Sets should be preserved with structuredClone
```
