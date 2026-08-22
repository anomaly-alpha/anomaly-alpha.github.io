# Plan 146: Storage Manager API

**Gap:** The app uses localStorage for profiles, history, and state. If the user reaches the 5-10 MB limit (unlikely but possible with large alliance rosters), writes silently fail. There's no feedback.

**Best practice (web.dev):** Use `navigator.storage.estimate()` to check available storage and show a warning when approaching limits.

---

## Step 1: Check storage estimate

```js
async function checkStorage() {
  if (!navigator.storage || !navigator.storage.estimate) return;

  var estimate = await navigator.storage.estimate();
  var usedMB = Math.round(estimate.usage / (1024 * 1024) * 100) / 100;
  var quotaMB = Math.round(estimate.quota / (1024 * 1024) * 100) / 100;
  var pct = Math.round((estimate.usage / estimate.quota) * 100);

  return { used: usedMB, quota: quotaMB, percent: pct };
}
```

---

## Step 2: Show warning when approaching limit

```js
async function checkStorageAndWarn() {
  var info = await checkStorage();
  if (!info) return;

  if (info.percent > 80) {
    showToast(
      'Storage at ' + info.percent + '% (' + info.used + 'MB/' + info.quota + 'MB). ' +
      'Consider exporting and clearing old data.',
      'warning'
    );
  }
}
```

---

## Step 3: Check persisted storage

```js
async function ensurePersistedStorage() {
  if (navigator.storage && navigator.storage.persist) {
    var isPersisted = await navigator.storage.persisted();
    if (!isPersisted) {
      var granted = await navigator.storage.persist();
      console.log('Storage persistence:', granted ? 'granted' : 'denied');
    }
  }
}
```

Persisted storage is less likely to be cleared by the browser's storage eviction.

---

## Step 4: Display in footer

```html
<span class="gem-text--muted text-xs" id="storage-info"></span>
```

```js
checkStorage().then(function (info) {
  if (info) {
    setText('storage-info', info.used + 'MB used');
  }
});
```

---

## Files Modified: `script.js`, `index.html`
