# Plan 145: File System Access API for Config Import/Export

**Gap:** Export (Plan 34) downloads files via `<a>` click. Import is not supported. The File System Access API lets users open/save files natively — no download folder clutter.

**Best practice (web.dev):** Use `window.showSaveFilePicker()` and `window.showOpenFilePicker()` for native file dialogs. Works in Chromium browsers.

---

## Step 1: Save with native dialog

```js
async function exportCSVNative() {
  var csv = buildCSV(buildExportData());

  try {
    var handle = await window.showSaveFilePicker({
      suggestedName: 'gem-rewards-export.csv',
      types: [{ description: 'CSV File', accept: { 'text/csv': ['.csv'] } }]
    });

    var writable = await handle.createWritable();
    await writable.write(csv);
    await writable.close();
  } catch (err) {
    if (err.name !== 'AbortError') {
      // User cancelled — fall back to download
      exportCSV();
    }
  }
}
```

---

## Step 2: Import config

```js
async function importConfig() {
  try {
    var [handle] = await window.showOpenFilePicker({
      types: [{ description: 'JSON Config', accept: { 'application/json': ['.json'] } }]
    });

    var file = await handle.getFile();
    var text = await file.text();
    var config = JSON.parse(text);

    if (config.pvp1) {
      setPvpSelector('pvp1', config.pvp1.league, config.pvp1.rank);
    }
    if (config.profiles) {
      localStorage.setItem('gem_profiles', JSON.stringify(config.profiles));
    }

    showToast('Configuration imported', 'success');
  } catch (err) {
    if (err.name !== 'AbortError') {
      showToast('Import failed: ' + err.message, 'error');
    }
  }
}
```

---

## Step 3: Add import button

```html
<button class="gem-btn--icon text-xs" onclick="importConfig()" title="Import config">
  <svg ...upload icon...></svg> Import
</button>
```

---

## Step 4: Check API support

```js
if ('showSaveFilePicker' in window) {
  // Show native save button
} else {
  // Fall back to download
}
```

---

## Files Modified: `script.js`, `index.html`
