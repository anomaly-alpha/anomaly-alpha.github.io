# Plan 128: Screen Wake Lock API

**Gap:** Users may reference the calculator while playing the game on the same device. The screen may lock/sleep while they're actively looking at payout tables or promo codes.

**Best practice (web.dev):** Use `navigator.wakeLock.request('screen')` to keep the screen awake while the charts or promo code sections are visible.

---

## Step 1: Request wake lock when charts are shown

```js
var wakeLock = null;

async function requestWakeLock() {
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', function () {
      console.log('Wake lock released');
    });
  } catch (err) {
    console.log('Wake lock not available:', err.name);
  }
}

function releaseWakeLock() {
  if (wakeLock) {
    wakeLock.release();
    wakeLock = null;
  }
}
```

---

## Step 2: Toggle wake lock with charts visibility

```js
function toggleCharts() {
  var isHidden = chartsSection.classList.contains('hidden');
  if (!isHidden && 'wakeLock' in navigator) {
    requestWakeLock();
  } else {
    releaseWakeLock();
  }
}
```

---

## Step 3: Re-acquire on visibility change

```js
document.addEventListener('visibilitychange', function () {
  if (!document.hidden && chartsSection && !chartsSection.classList.contains('hidden')) {
    requestWakeLock(); // Re-acquire if user returns
  }
});
```

---

## Step 4: Test on mobile

```bash
# Open page on mobile, show charts
# Set screen timeout to 30 seconds
# Wait — screen stays on
# Hide charts — screen locks normally after timeout
```

---

## Files Modified: `script.js`
