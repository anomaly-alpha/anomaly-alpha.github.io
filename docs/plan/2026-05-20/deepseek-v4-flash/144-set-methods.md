# Plan 144: Set Methods for Data Operations

**Gap:** Mode filtering, category selection, and profile management use arrays with `.filter()`, `.includes()`, `.indexOf()`. Set operations (union, intersection, difference) would be cleaner with the new `Set` methods.

**Best practice (TC39):** Use `Set.prototype.intersection()`, `.union()`, `.difference()` (baseline 2025) for set operations. More readable and often faster than array methods.

---

## Step 1: Apply to mode filtering

```js
// Current approach:
var allModes = ['event', 'pvp', 'login', 'code'];
var activeModes = selectedModes;
var inactiveModes = allModes.filter(function (m) { return !activeModes.includes(m); });

// With Set methods:
var allModes = new Set(['event', 'pvp', 'login', 'code']);
var activeModes = new Set(selectedModes);
var inactiveModes = allModes.difference(activeModes);
```

---

## Step 2: Apply to profile comparison

```js
function compareSavedProfiles(nameA, nameB) {
  var profiles = loadProfiles();
  var a = new Set(Object.keys(profiles[nameA] || {}));
  var b = new Set(Object.keys(profiles[nameB] || {}));
  var shared = a.intersection(b);
  var onlyInA = a.difference(b);
  var onlyInB = b.difference(a);
  return { shared: [...shared], onlyInA: [...onlyInA], onlyInB: [...onlyInB] };
}
```

---

## Step 3: Verify Set method support

```js
if (!Set.prototype.intersection) {
  // Polyfill for older browsers
  Set.prototype.intersection = function (other) {
    return new Set([...this].filter(function (x) { return other.has(x); }));
  };
}
```

---

## Files Modified: `script.js`
