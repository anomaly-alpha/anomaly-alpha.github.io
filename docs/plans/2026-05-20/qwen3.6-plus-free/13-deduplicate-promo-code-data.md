# Plan 13: Deduplicate Promo Code Data

**Problem:** Promo codes are defined twice: once in `rewards-config` under `cards[].codes` (promo-code card) and again in `rewards-config.promoCodes[]`. This duplication means updating a code requires changes in two places, and inconsistencies can arise.

**Goal:** Store promo codes once in `rewards-config.promoCodes[]` and reference them from the card config.

---

## Step 1: Remove duplicate codes from card config

In `index.html`, update the promo-code card to remove the `codes` array and reference the shared array:

```json
{
  "id": "promo-code",
  "category": "code",
  "title": "Promo Codes",
  "gems": 300,
  "isRevealable": true,
  "description": "Secret codes whispered among allies—tap to reveal",
  "tooltip": "Code reward",
  "guideUrl": "guide/code/",
  "delay": 0,
  "modal": { ... }
}
```

## Step 2: Update rendering to use shared array

```javascript
// script.js — modify code rendering
function renderPromoCodes() {
  // Use REWARDS.promoCodes directly instead of card.codes
  var codes = REWARDS.promoCodes;
  // ... rest of rendering logic
}
```

## Step 3: Add validation to detect future duplication

```javascript
// In loadAllConfigs() — add after config loading
function validateConfig() {
  var cardCodes = null;
  REWARDS.cards.forEach(function(card) {
    if (card.id === 'promo-code' && card.codes) {
      cardCodes = card.codes;
    }
  });
  if (cardCodes) {
    console.warn('promo-code card has duplicate codes array — remove it and use REWARDS.promoCodes');
  }
}
```

## Files Modified
- `index.html` — remove codes array from promo-code card
- `script.js` — update rendering, add validation

## Verification
```bash
npm run build
# Open console — should see no warnings
# Promo codes should render identically to before
```
