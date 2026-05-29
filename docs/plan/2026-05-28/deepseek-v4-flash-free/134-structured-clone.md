# Plan 134: structuredClone for State Serialization

**Gap:** State is serialized with `JSON.parse(JSON.stringify(obj))` or manual object copying. This pattern has limitations: it can't clone `undefined`, `BigInt`, `Map`, `Set`, `Date`, or circular references.

**Best practice (MDN):** Use `structuredClone()` (baseline 2023) for deep cloning. Faster than JSON roundtrip and handles more types.

---

## Step 1: Find JSON.parse(JSON.stringify()) patterns

```bash
grep -n 'JSON.parse.*JSON.stringify\|JSON.stringify.*JSON.parse' script.src.js
```

---

## Step 2: Replace with structuredClone

```js
// Before:
var copy = JSON.parse(JSON.stringify(original));

// After:
var copy = structuredClone(original);
```

---

## Step 3: Find manual object copying

```bash
grep -n 'Object.assign\|\.slice()' script.src.js
```

Replace with:
```js
// Before:
var saved = Object.assign({}, state);

// After:
var saved = structuredClone(state);
```

---

## Step 4: Verify deep clone handles config objects

```js
// Config objects with nested arrays and objects
var configCopy = structuredClone(GAME.pvp);
// Should handle leagues[], arenas, multiverse without issues
```

---

## Step 5: Check localStorage compatibility

`structuredClone` works for in-memory cloning only. For localStorage, still use JSON.stringify (since localStorage requires strings):

```js
// localStorage: still needs JSON.stringify
localStorage.setItem('gem_profiles', JSON.stringify(profiles));

// In-memory: use structuredClone
var workingCopy = structuredClone(profiles);
```

---

## Files Modified: `script.js`
