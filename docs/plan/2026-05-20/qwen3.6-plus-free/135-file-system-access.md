# Plan 135: File System Access API

**Problem:** Export/Import uses download/upload which requires user interaction with file dialogs. The File System Access API enables direct file saving and loading.

**Goal:** Add optional File System Access API for export/import.

---

## Step 1: Add file system export

```javascript
// script.js
async function exportWithFileSystem(format) {
  if (!window.showSaveFilePicker) {
    // Fallback to download
    exportConfig(format);
    return;
  }

  var data = getExportData();
  var content = format === 'json' ? JSON.stringify(data, null, 2) : convertToCSV(data);
  var mime = format === 'json' ? 'application/json' : 'text/csv';
  var ext = format === 'json' ? 'json' : 'csv';

  var handle = await window.showSaveFilePicker({
    suggestedName: 'gem-rewards-' + new Date().toISOString().slice(0, 10) + '.' + ext,
    types: [{
      description: format === 'json' ? 'JSON' : 'CSV',
      accept: { [mime]: ['.' + ext] }
    }]
  });

  var writable = await handle.createWritable();
  await writable.write(content);
  await writable.close();
}
```

## Step 2: Add file system import

```javascript
async function importWithFileSystem() {
  if (!window.showOpenFilePicker) {
    return;
  }

  var handles = await window.showOpenFilePicker({
    types: [{ accept: { 'application/json': ['.json'] } }]
  });

  var file = await handles[0].getFile();
  var text = await file.text();
  var data = JSON.parse(text);
  applyImportData(data);
}
```

## Files Modified
- `script.js` — File System Access functions

## Verification
```bash
npm run build
# Export — should show native save dialog
# Import — should show native open dialog
# Chrome 86+, Edge 86+
```
