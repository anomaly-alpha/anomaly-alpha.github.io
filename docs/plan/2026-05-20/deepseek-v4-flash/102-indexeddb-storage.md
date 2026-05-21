# Plan 102: IndexedDB for History Storage

**Gap identified:** localStorage is used for all state persistence. The weekly history tracker (Plan 33) stores JSON blobs that grow over time. localStorage has a 5-10 MB limit and synchronous API — large history payloads can block the main thread.

**Web best practices (web.dev):** Use IndexedDB for structured data that grows over time. It handles >50 MB, supports indexes for querying, and is asynchronous (non-blocking). `idb-keyval` provides a simple key-value API on top of IndexedDB as a lighter alternative to full IndexedDB.

---

## Step 1: Add idb-keyval (or use raw IndexedDB)

```bash
npm install idb-keyval
```

Or use raw IndexedDB with a small wrapper:

```js
var DB_NAME = 'GemRewardsDB';
var DB_VERSION = 1;
var STORE_NAME = 'kv';

function openDB() {
  return new Promise(function (resolve, reject) {
    var req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = function (e) {
      e.target.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = function (e) { resolve(e.target.result); };
    req.onerror = function (e) { reject(e.target.error); };
  });
}

function dbGet(key) {
  return openDB().then(function (db) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(STORE_NAME, 'readonly');
      var req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  });
}

function dbSet(key, value) {
  return openDB().then(function (db) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(value, key);
      tx.oncomplete = resolve;
      tx.onerror = function () { reject(tx.error); };
    });
  });
}
```

---

## Step 2: Migrate history from localStorage

```js
async function migrateHistoryToDB() {
  var existing = localStorage.getItem('gem_history');
  if (existing) {
    await dbSet('gem_history', JSON.parse(existing));
    localStorage.removeItem('gem_history');
    console.log('Migrated history to IndexedDB');
  }
}
```

---

## Step 3: Update all history functions

```js
// Before (loadHistory):
function loadHistory() {
  try { return JSON.parse(localStorage.getItem('gem_history')) || []; }
  catch (e) { return []; }
}

// After:
async function loadHistory() {
  try { return await dbGet('gem_history') || []; }
  catch (e) { return []; }
}
```

Update `renderHistory()`, `recordWeeklySnapshot()`, etc. to use async/await.

---

## Step 4: Graceful fallback

```js
function isIndexedDBAvailable() {
  try { return !!window.indexedDB; }
  catch (e) { return false; }
}
```

Fall back to localStorage if IndexedDB is unavailable.

---

## Files Modified: `script.js`, `package.json`
