# Plan 151: Code Expiry Auto-Hide

**Problem:** Expired codes are visible in the promo code card. They should be automatically hidden after a grace period.

**Goal:** Auto-hide codes that expired more than 7 days ago.

---

## Step 1: Add expiry check

```javascript
// script.js
function isCodeExpired(code) {
  if (!code.expired || !code.expiredDate) return false;
  var expiredDate = new Date(code.expiredDate);
  var now = new Date();
  var gracePeriod = 7 * 24 * 60 * 60 * 1000; // 7 days
  return (now - expiredDate) > gracePeriod;
}

function getActiveCodes() {
  return REWARDS.promoCodes.filter(function(code) {
    return !isCodeExpired(code);
  });
}
```

## Step 2: Update rendering

```javascript
// script.js — in renderPromoCodes
function renderPromoCodes() {
  var active = getActiveCodes();
  var recentlyExpired = REWARDS.promoCodes.filter(function(code) {
    return code.expired && !isCodeExpired(code);
  });
  var oldExpired = REWARDS.promoCodes.filter(function(code) {
    return isCodeExpired(code);
  });

  // Render active + recently expired (with "expired" label)
  // Old expired codes are not rendered at all
}
```

## Files Modified
- `script.js` — expiry check, updated rendering

## Verification
```bash
npm run build
# Codes expired > 7 days ago should not appear
# Recently expired codes should show with "expired" label
```
