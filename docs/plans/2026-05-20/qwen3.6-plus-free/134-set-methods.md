# Plan 134: Set Methods

**Problem:** Mode selection uses arrays with `indexOf` checks for membership. `Set` methods like `intersection`, `union`, and `isSubsetOf` provide cleaner set operations.

**Goal:** Use Set for mode management with modern Set methods.

---

## Step 1: Convert selectedModes to Set

```javascript
// script.js
var selectedModes = new Set(UI.defaults.selectedModes);

function toggleMode(mode) {
  if (mode === 'all') {
    selectedModes = new Set(['event', 'pvp', 'login', 'code']);
  } else if (selectedModes.has(mode)) {
    selectedModes.delete(mode);
  } else {
    selectedModes.add(mode);
  }
  filterCards();
  updateAllPageTotals();
  updateChartsByModes(selectedModes);
  savePageState();
}
```

## Step 2: Use Set methods for comparison

```javascript
// Check if all modes are selected
function isAllModesSelected() {
  var allModes = new Set(['event', 'pvp', 'login', 'code']);
  return selectedModes.isSubsetOf(allModes) && selectedModes.size === allModes.size;
}

// Get active categories for charts
function getActiveCategories() {
  return Array.from(selectedModes);
}
```

## Files Modified
- `script.js` — Set for mode management

## Verification
```bash
npm run build
# Toggle modes — should work identically
# Chrome 122+, Firefox 129+, Safari 17.4+ for Set methods
```
