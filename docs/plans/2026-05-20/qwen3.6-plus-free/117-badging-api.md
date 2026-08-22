# Plan 117: Badging API

**Problem:** The PWA has no way to show a notification badge on the app icon when the weekly reset is approaching.

**Goal:** Use the Badging API to show a badge when reset is within 24 hours.

---

## Step 1: Add badge logic

```javascript
// script.js
function updateBadge() {
  if (!('setAppBadge' in navigator)) return;

  var now = new Date();
  var nextReset = getNextSundayReset();
  var hoursUntilReset = (nextReset - now) / (1000 * 60 * 60);

  if (hoursUntilReset <= 24 && hoursUntilReset > 0) {
    navigator.setAppBadge(1);
  } else {
    navigator.clearAppBadge();
  }
}

function getNextSundayReset() {
  var now = new Date();
  var reset = new Date(now);
  reset.setDate(now.getDate() + ((7 - now.getDay()) % 7 || 7));
  reset.setHours(20, 0, 0, 0);
  if (reset < now) reset.setDate(reset.getDate() + 7);
  return reset;
}
```

## Step 2: Schedule badge updates

```javascript
// Check every hour
setInterval(updateBadge, 3600000);
updateBadge(); // Initial check
```

## Files Modified
- `script.js` — badge logic

## Verification
```bash
npm run build
# Install as PWA
# Within 24 hours of reset — app icon should show badge
```
