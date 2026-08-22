# Plan 118: Wake Lock API

**Problem:** When users are reading guides or comparing PvP payouts, the screen may turn off. The Wake Lock API prevents this during active use.

**Goal:** Request a wake lock when the user is actively interacting with the calculator.

---

## Step 1: Add wake lock management

```javascript
// script.js
var wakeLock = null;

async function requestWakeLock() {
  if (!('wakeLock' in navigator)) return;
  try {
    wakeLock = await navigator.wakeLock.request('visible');
    wakeLock.addEventListener('release', function() {
      wakeLock = null;
    });
  } catch (e) {
    // Wake lock not granted — not critical
  }
}

function releaseWakeLock() {
  if (wakeLock) {
    wakeLock.release();
    wakeLock = null;
  }
}
```

## Step 2: Request on interaction

```javascript
// script.js — request wake lock when user starts interacting
document.addEventListener('click', function requestOnce() {
  requestWakeLock();
  document.removeEventListener('click', requestOnce);
});

// Release when page is hidden
document.addEventListener('visibilitychange', function() {
  if (document.visibilityState === 'hidden') {
    releaseWakeLock();
  } else if (wakeLock === null) {
    requestWakeLock();
  }
});
```

## Files Modified
- `script.js` — wake lock management

## Verification
```bash
npm run build
# Interact with page — screen should stay on
# Chrome 131+, Android Chrome, Edge
```
