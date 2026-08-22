# Plan 43: Browser Notification for Reset

**Problem:** Users don't know when the weekly PvP reset happens (Sunday 8 PM EST). Missing the reset window means lost rewards for the week.

**Goal:** Add an optional browser notification that alerts users 1 hour before the weekly reset.

---

## Step 1: Add notification permission request

```javascript
// script.js
function requestNotificationPermission() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') return;
  if (Notification.permission === 'denied') return;

  // Ask after user interaction
  var btn = document.getElementById('notify-reset-btn');
  if (btn) {
    btn.addEventListener('click', function() {
      Notification.requestPermission().then(function(perm) {
        if (perm === 'granted') {
          scheduleResetNotification();
          btn.textContent = 'Notifications enabled ✓';
          btn.disabled = true;
        }
      });
    });
  }
}
```

## Step 2: Schedule notification

```javascript
// script.js
function scheduleResetNotification() {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  // Calculate next Sunday 7 PM EST (1 hour before reset)
  var now = new Date();
  var nextSunday = new Date();
  nextSunday.setDate(now.getDate() + ((7 - now.getDay()) % 7 || 7));
  nextSunday.setHours(19, 0, 0, 0); // 7 PM EST

  if (nextSunday < now) nextSunday.setDate(nextSunday.getDate() + 7);

  var delay = nextSunday - now;
  if (delay > 0 && delay < 604800000) { // Within a week
    setTimeout(function() {
      new Notification('Gem Rewards', {
        body: 'PvP reset in 1 hour! Claim your rewards now.',
        icon: '/favicon.svg',
        tag: 'pvp-reset'
      });
      // Reschedule for next week
      scheduleResetNotification();
    }, delay);
  }
}
```

## Step 3: Add enable button

```html
<!-- index.html — in footer or settings area -->
<button id="notify-reset-btn" class="gem-btn">
  🔔 Notify me before weekly reset
</button>
```

## Files Modified
- `script.js` — notification logic
- `index.html` — notification button

## Verification
```bash
npm run build
# Click notification button — should prompt for permission
# Use DevTools to test notification timing
```
