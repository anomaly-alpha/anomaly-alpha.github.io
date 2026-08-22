# Plan 13: Promo Code Data Deduplication

**Problem:** The promo code data is stored in **two places** in the `rewards-config` JSON:
- `cards[0].codes` (inline inside the promo-code card data)
- `promoCodes` (top-level array)

Both contain the same 32 code objects. This is a maintenance hazard — adding or updating a code requires touching both arrays. They can diverge silently.

**Goal:** Eliminate the duplicate by removing `cards[0].codes` and having the card renderer read from the single source of truth: `REWARDS.promoCodes`.

---

## Step 1: Understand how each array is used

Check the JS:

```bash
grep -o "REWARDS\.cards\[0\]\.codes\|REWARDS\.cards\[0\]\[.codes.\]\|REWARDS\.promoCodes" script.src.js
```

If `cards[0].codes` is only used for rendering the promo card, and `promoCodes` is used for everything else, the fix is straightforward.

---

## Step 2: Remove `cards[0].codes` from the config

**In `index.html`**, inside the `rewards-config`, find the `promo-code` card entry:

```json
{
  "id": "promo-code",
  "category": "code",
  "title": "Promo Codes",
  "gems": 300,
  "codes": [/* 32 code objects — DELETE THIS ENTIRE FIELD */],
  "isRevealable": true,
  ...
}
```

Remove the `"codes": [...]` field. Keep everything else.

---

## Step 3: Update the JS to read from `REWARDS.promoCodes`

In the promo card rendering function (where codes are displayed), change:

```js
// Before:
var codes = REWARDS.cards[0].codes || [];

// After:
var codes = REWARDS.promoCodes || [];
```

If the code references `REWARDS.cards[0].codes` anywhere else, update those too.

---

## Step 4: Update total calculation

The promo card gem total may be calculated from the card's `gems` field (which stays at 300). Verify the total is not derived from the `codes` array sum:

```js
// If the total is calculated dynamically:
var total = REWARDS.promoCodes
  .filter(function(c) { return !c.expired; })
  .reduce(function(sum, c) { return sum + (c.gems || 0); }, 0);
```

If the total should reflect the sum of active codes vs. the static 300, this is the opportunity to make that switch.

---

## Step 5: Update documentation references

The docs now reference `REWARDS.promoCodes[]` (already fixed in Plan 01 docs). Verify no remaining references to `codes[]` inside card data:

```bash
grep -rn "cards\[0\]\.codes\|cards\[0\].codes\|\.codes\[" script.js
```

---

## Step 6: Verify rendering

```bash
# Open index.html in browser
# Check promo card — all codes should display as before
# Check total — should match expected value
# Check copy-to-clipboard — should still work
```

---

## Files Modified

| File | Change |
|------|--------|
| `index.html` | Remove `cards[0].codes` array (lines ~438 in config) |
| `script.js` | Replace `REWARDS.cards[0].codes` refs with `REWARDS.promoCodes` |

---

## Verification

```bash
grep -c '"codes"' index.html
# Before: 2 (one in card data + one for promoCodes array name)
# After: 1 (only the promoCodes top-level key)
```
