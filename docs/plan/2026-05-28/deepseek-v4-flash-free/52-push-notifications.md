# Plan 52: Desktop Push Notifications for Weekly Reset

**Problem:** Users must manually check the countdown timer to know when weekly reset happens. There's no proactive alert.

**Goal:** Add browser push notification (using Notification API) that fires when the weekly reset countdown reaches 0.

---

## Step 1: Check notification permission

```js
function requestNotificationPermission() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') {
    Notification.requestPermission();
  }
}
```

---

## Step 2: Add notification toggle

```html
<label class="gem-notification-toggle text-xs gem-text--muted">
  <input type="checkbox" id="notif-toggle" onchange="toggleResetNotification(this.checked)">
  Notify me at reset
</label>
```

---

## Step 3: Schedule notification

```js
function scheduleResetNotification() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  var saved = localStorage.getItem('gem_notif_enabled');
  if (saved !== 'true') return;

  var now = new Date();
  var reset = getNextWeeklyReset(); // from existing countdown logic
  var msUntilReset = reset - now;

  if (msUntilReset > 0 && msUntilReset < 7 * 86400000) {
    setTimeout(function () {
      new Notification('Weekly Reset!', {
        body: 'Your PvP rewards have reset. Check your new gem income!',
        icon: '/favicon.svg'
      });
    }, msUntilReset);
  }
}

function toggleResetNotification(enabled) {
  localStorage.setItem('gem_notif_enabled', enabled ? 'true' : 'false');
  if (enabled) {
    requestNotificationPermission();
    scheduleResetNotification();
  }
}
```

---

## Step 4: Show notification countdown in tab title

Update the page title to show minutes until reset when the tab is inactive:

```js
function updateTitleWithCountdown() {
  var reset = getNextWeeklyReset();
  var diff = reset - new Date();
  if (diff > 0) {
    var hours = Math.floor(diff / 3600000);
    var mins = Math.floor((diff % 3600000) / 60000);
    document.title = '[' + hours + 'h ' + mins + 'm] Gem Rewards';
  }
}
setInterval(updateTitleWithCountdown, 60000);
```

---

## Files Modified: `index.html`, `script.js`, `styles.css`
