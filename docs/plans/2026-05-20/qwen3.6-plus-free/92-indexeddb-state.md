# Plan 92: IndexedDB for State

**Problem:** localStorage has a 5MB limit and is synchronous, blocking the main thread. As more state is stored (profiles, history, goals), this becomes a bottleneck.

**Goal:** Migrate state storage from localStorage to IndexedDB for async, larger-capacity storage.

---

## Step 1: Create IndexedDB wrapper

```javascript
// script.js
var DB_NAME = 'gem-rewards';
var DB_VERSION = 1;
var STORE_NAME = 'state';

function openDB() {
  return new Promise(function(resolve, reject) {
    var request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = function(e) {
      e.target.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = function(e) { resolve(e.target.result); };
    request.onerror = function(e) { reject(e.target.error); };
  });
}

function dbGet(key) {
  return openDB().then(function(db) {
    return new Promise(function(resolve) {
      var tx = db.transaction(STORE_NAME, 'readonly');
      var store = tx.objectStore(STORE_NAME);
      var request = store.get(key);
      request.onsuccess = function() { resolve(request.result); };
    });
  });
}

function dbSet(key, value) {
  return openDB().then(function(db) {
    return new Promise(function(resolve) {
      var tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(value, key);
      tx.oncomplete = function() { resolve(); };
    });
  });
}
```

## Step 2: Replace localStorage calls

```javascript
// Before
localStorage.setItem('gem_goal', target);
var modes = localStorage.getItem('gem_modes');

// After
dbSet('gem_goal', target);
dbGet('gem_modes').then(function(modes) { ... });
```

## Files Modified
- `script.js` — IndexedDB wrapper, replaced localStorage

## Verification
```bash
npm run build
# DevTools > Application > IndexedDB — should show gem-rewards database
# State should persist across reloads
```
