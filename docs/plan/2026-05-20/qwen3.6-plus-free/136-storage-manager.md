# Plan 136: Storage Manager API

**Problem:** Users can't see how much storage the PWA is using or request more storage when needed. The Storage Manager API provides storage info and persistence.

**Goal:** Add storage usage display and persistence request.

---

## Step 1: Add storage info display

```javascript
// script.js
async function showStorageInfo() {
  if (!navigator.storage) return;

  var estimate = await navigator.storage.estimate();
  var used = (estimate.usage / 1024 / 1024).toFixed(2);
  var total = (estimate.quota / 1024 / 1024).toFixed(2);

  console.log('[Gem Rewards] Storage: ' + used + 'MB / ' + total + 'MB');
}
```

## Step 2: Request persistent storage

```javascript
// script.js
async function requestPersistence() {
  if (!navigator.storage) return;

  var isPersisted = await navigator.storage.persisted();
  if (isPersisted) {
    console.log('[Gem Rewards] Storage is persistent');
    return;
  }

  var granted = await navigator.storage.persist();
  if (granted) {
    console.log('[Gem Rewards] Persistent storage granted');
  } else {
    console.log('[Gem Rewards] Persistent storage denied');
  }
}
```

## Step 3: Add button in settings

```html
<!-- index.html -->
<button class="gem-btn" onclick="requestPersistence()">Keep data persistent</button>
```

## Files Modified
- `script.js` — storage manager functions
- `index.html` — persistence button

## Verification
```bash
npm run build
# Click button — should request persistent storage
# DevTools > Application > Storage — should show usage
```
