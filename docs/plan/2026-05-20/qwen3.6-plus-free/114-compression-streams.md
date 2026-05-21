# Plan 114: Compression Streams API

**Problem:** Exported data (JSON/CSV) could be compressed before download for large datasets. The Compression Streams API enables client-side compression.

**Goal:** Add optional gzip compression to exported files.

---

## Step 1: Add compressed export

```javascript
// script.js
async function exportConfigCompressed(format) {
  var data = getExportData();
  var content = format === 'json' ? JSON.stringify(data) : convertToCSV(data);

  var cs = new CompressionStream('gzip');
  var writer = cs.writable.getWriter();
  writer.write(new TextEncoder().encode(content));
  writer.close();

  var blob = await new Response(cs.readable).blob();
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'gem-rewards-' + new Date().toISOString().slice(0, 10) + '.gz';
  a.click();
  URL.revokeObjectURL(url);
}
```

## Step 2: Add decompression on import

```javascript
async function importConfig(file) {
  var ds = new DecompressionStream('gzip');
  var writer = ds.writable.getWriter();
  writer.write(await file.arrayBuffer());
  writer.close();

  var text = await new TextDecoder().decode(await new Response(ds.readable).arrayBuffer());
  return JSON.parse(text);
}
```

## Files Modified
- `script.js` — compressed export/import

## Verification
```bash
npm run build
# Export compressed — should download .gz file
# Import — should decompress and apply
# Chrome 80+, Firefox 113+, Safari 16.4+
```
