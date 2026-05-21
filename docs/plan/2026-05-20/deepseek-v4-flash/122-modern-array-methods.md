# Plan 122: Modern Array Methods Migration

**Gap:** The JS may use older array methods (for loops, `.reduce()`, `.concat()`) where newer methods (`Array.groupBy()`, `.toSorted()`, `.toReversed()`, `.with()`, `Array.fromAsync()`) offer clearer intent and immutable operations.

**Best practice (TC39):** Use immutable array methods for safer code. `groupBy()` for categorizing, `toSorted()` for sorting without mutation.

---

## Step 1: Identify migration candidates

```bash
# Find forEach loops that could be groupBy
grep -n 'forEach\|for .*in\|for .*of' script.src.js

# Find .concat() that could use spread
grep -n '\.concat(' script.src.js

# Find .sort() that mutates
grep -n '\.sort(' script.src.js
```

---

## Step 2: Replace `.sort()` with `.toSorted()`

```js
// Before (mutates original):
payouts.sort(function (a, b) { return b.gems - a.gems; });

// After (immutable):
var sorted = payouts.toSorted(function (a, b) { return b.gems - a.gems; });
```

---

## Step 3: Replace `.reverse()` with `.toReversed()`

```js
// Before:
history.reverse();

// After:
var reversed = history.toReversed();
```

---

## Step 4: Replace loops with `Object.groupBy()`

```js
// Before:
var byCategory = {};
cards.forEach(function (c) {
  if (!byCategory[c.category]) byCategory[c.category] = [];
  byCategory[c.category].push(c);
});

// After:
var byCategory = Object.groupBy(cards, function (c) { return c.category; });
```

---

## Step 5: Verify

```bash
# Run test suite — all tests pass
# Check that no .sort() calls still mutate originals
```

---

## Files Modified: `script.js`
