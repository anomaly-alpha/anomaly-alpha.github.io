# Plan 127: Badging API for PWA App Icon Badges

**Gap:** After install (Plan 03), the PWA app icon shows no badge. The badge could show the gem total or a countdown indicator.

**Best practice (web.dev):** Use `navigator.setAppBadge()` to set a badge count on the installed PWA icon. Clears when the user opens the app.

---

## Step 1: Set badge with gem total

```js
function updateAppBadge() {
  if (navigator.setAppBadge) {
    var total = getCurrentTotal();
    var badgeCount = Math.min(99, Math.round(total / 100));
    navigator.setAppBadge(badgeCount);
  }
}
```

---

## Step 2: Clear badge on focus

```js
window.addEventListener('focus', function () {
  if (navigator.clearAppBadge) {
    navigator.clearAppBadge();
  }
});
```

---

## Step 3: Update badge when PvP changes

Call `updateAppBadge()` from `updateAllPageTotals()`.

---

## Step 4: Check support

```js
if ('setAppBadge' in navigator) {
  updateAppBadge();
}
```

Only works in installed PWA on Android/ChromeOS. No-op on other platforms.

---

## Files Modified: `script.js`
